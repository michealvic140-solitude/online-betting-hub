import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Vote, X, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Poll = { id: string; question: string; options: any };

/**
 * Floating poll interrupt, mirrors SurveyPopout. Shows the first active poll
 * the current user hasn't voted on or dismissed for this session.
 * "Ignore" persists a dismissal by casting a sentinel vote of -1? No — polls
 * table has no dismissal concept, so we persist ignore in localStorage.
 */
export function PollPopout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<Poll | null>(null);

  async function load() {
    if (!user) return;
    const [{ data: polls }, { data: enabled }, { data: votes }] = await Promise.all([
      (supabase as any).from("polls").select("id,question,options").eq("is_active", true).order("created_at", { ascending: false }),
      (supabase as any).from("app_settings").select("polls_enabled").eq("id", 1).maybeSingle(),
      (supabase as any).from("poll_votes").select("poll_id").eq("user_id", user.id),
    ]);
    if (!enabled?.polls_enabled) { setPoll(null); return; }
    const voted = new Set((votes ?? []).map((v: any) => v.poll_id));
    const dismissed = new Set<string>(JSON.parse(localStorage.getItem(`lsl-poll-dismissed-${user.id}`) || "[]"));
    const next = (polls ?? []).find((p: any) => !voted.has(p.id) && !dismissed.has(p.id));
    setPoll((next as Poll) ?? null);
  }

  useEffect(() => {
    if (!user) { setPoll(null); return; }
    load();
    const ch = supabase.channel(`poll-popout-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "polls" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!poll || !user) return null;

  function ignore() {
    const key = `lsl-poll-dismissed-${user!.id}`;
    const cur: string[] = JSON.parse(localStorage.getItem(key) || "[]");
    if (!cur.includes(poll!.id)) cur.push(poll!.id);
    localStorage.setItem(key, JSON.stringify(cur));
    setPoll(null);
  }
  function remindLater() { setPoll(null); }
  function take() { setPoll(null); navigate({ to: "/polls" }); }

  const count = Array.isArray(poll.options) ? poll.options.length : 0;

  return (
    <div className="fixed inset-x-0 bottom-24 z-[114] flex justify-center px-4 animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
        <button onClick={remindLater} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" aria-label="Remind me later"><X className="h-4 w-4" /></button>
        <div className="flex items-start gap-3 pr-6">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-gold shadow-gold"><Vote className="h-5 w-5 text-background" /></span>
          <div className="min-w-0">
            <h3 className="font-bold text-foreground leading-snug">New poll: cast your vote</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{poll.question}</p>
            <p className="text-[11px] text-primary mt-1">{count} option{count === 1 ? "" : "s"} · Community prediction</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={take} className="btn-luxury inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-sm font-bold">Vote now<ArrowRight className="h-4 w-4" /></button>
          <button onClick={remindLater} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><Clock className="h-3.5 w-3.5" />Later</button>
          <button onClick={ignore} className="rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive">Ignore</button>
        </div>
      </div>
    </div>
  );
}

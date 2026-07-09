import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Save, ChevronDown, ChevronRight, Users, Coins, X } from "lucide-react";
import { logAudit } from "@/lib/audit";

type Poll = {
  id: string;
  question: string;
  options: string[];
  closes_at: string | null;
  is_active: boolean;
};

type Vote = { id: string; user_id: string; selected_index: number; created_at: string };
type ProfileLite = { id: string; full_name: string | null; email: string | null; token_balance: number | null };

export function PollsAdminPanel() {
  const [rows, setRows] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [votesByPoll, setVotesByPoll] = useState<Record<string, Vote[]>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [giftAmount, setGiftAmount] = useState<Record<string, string>>({}); // per voteId

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any[]) ?? []).map((p) => ({ ...p, options: Array.isArray(p.options) ? p.options : (p.options ?? []) })) as Poll[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function loadVotes(pollId: string) {
    const { data: votes, error } = await (supabase as any).from("poll_votes").select("id,user_id,selected_index,created_at").eq("poll_id", pollId).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setVotesByPoll((m) => ({ ...m, [pollId]: (votes ?? []) as Vote[] }));
    const ids = (Array.from(new Set((votes ?? []).map((v: any) => v.user_id as string))) as string[]).filter((id) => !profiles[id]);
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email,token_balance").in("id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p; });
      setProfiles((prev) => ({ ...prev, ...map }));
    }
  }

  function toggleOpen(id: string) {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next && !votesByPoll[next]) loadVotes(next);
  }

  async function addRow() {
    const { error } = await supabase.from("polls").insert({ question: "New poll question", options: ["Yes", "No"] as any, is_active: true });
    if (error) return toast.error(error.message);
    load();
  }
  async function save(r: Poll) {
    const { error } = await supabase.from("polls").update({
      question: r.question,
      options: r.options as any,
      closes_at: r.closes_at,
      is_active: r.is_active,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("polls").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  async function removeVote(pollId: string, voteId: string, userId: string) {
    if (!confirm("Remove this user's vote? They will be able to vote again.")) return;
    const { error } = await (supabase as any).from("poll_votes").delete().eq("id", voteId);
    if (error) return toast.error(error.message);
    await logAudit("remove_poll_vote", "poll", pollId, { vote_id: voteId, user_id: userId });
    setVotesByPoll((m) => ({ ...m, [pollId]: (m[pollId] ?? []).filter((v) => v.id !== voteId) }));
    toast.success("Vote removed");
  }

  async function giftTokens(pollId: string, voteId: string, userId: string) {
    const raw = giftAmount[voteId];
    const amt = Number(raw);
    if (!raw || !Number.isFinite(amt) || amt === 0) { toast.error("Enter an amount (positive to gift, negative to remove)"); return; }
    const prof = profiles[userId];
    const currentBal = prof?.token_balance ?? 0;
    const newBal = currentBal + amt;
    if (newBal < 0) { toast.error("Balance cannot go negative"); return; }
    const { error } = await supabase.from("profiles").update({ token_balance: newBal }).eq("id", userId);
    if (error) return toast.error(error.message);
    await logAudit(amt > 0 ? "grant_tokens" : "revoke_tokens", "user", userId, {
      amount: amt, balance_from: currentBal, balance_to: newBal, reason: "poll_reward", poll_id: pollId,
    });
    setProfiles((p) => ({ ...p, [userId]: { ...(prof ?? { id: userId, full_name: null, email: null, token_balance: 0 }), token_balance: newBal } }));
    setGiftAmount((g) => ({ ...g, [voteId]: "" }));
    toast.success(`${amt > 0 ? "Gifted" : "Removed"} ${Math.abs(amt).toLocaleString()} tokens`);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Prediction Polls</div>
          <div className="text-[11px] text-muted-foreground">Community polls shown on /polls. Everyone can vote once per poll.</div>
        </div>
        <Button size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No polls yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const votes = votesByPoll[r.id] ?? [];
            const counts: number[] = new Array(r.options.length).fill(0);
            votes.forEach((v) => { if (v.selected_index >= 0 && v.selected_index < counts.length) counts[v.selected_index] += 1; });
            const total = votes.length;
            const isOpen = openId === r.id;
            return (
              <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-2">
                <Input value={r.question} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="Question" />
                <div className="space-y-1">
                  {r.options.map((opt, k) => (
                    <div key={k} className="flex gap-2">
                      <Input value={opt} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: x.options.map((o, m) => m === k ? e.target.value : o) } : x))} />
                      <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: x.options.filter((_, m) => m !== k) } : x))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: [...x.options, ""] } : x))}><Plus className="h-4 w-4 mr-1" /> Option</Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="text-[11px] text-muted-foreground">Closes at</label>
                  <Input className="w-56" type="datetime-local" value={r.closes_at ? new Date(r.closes_at).toISOString().slice(0, 16) : ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null } : x))} />
                  <div className="flex items-center gap-2 text-[11px]"><Switch checked={r.is_active} onCheckedChange={(v) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, is_active: v } : x))} /> Active</div>
                </div>
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => toggleOpen(r.id)} className="text-xs">
                    {isOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                    <Users className="h-3.5 w-3.5 mr-1" />
                    Results {isOpen && `· ${total} vote${total === 1 ? "" : "s"}`}
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => save(r)}><Save className="h-4 w-4 mr-1" /> Save</Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {isOpen && (
                  <div className="rounded-lg border border-primary/20 bg-card/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wide text-primary">Vote breakdown</div>
                      <Badge variant="outline" className="border-primary/40 text-primary">Total: {total}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {r.options.map((opt, k) => {
                        const c = counts[k] || 0;
                        const pct = total ? Math.round((c / total) * 100) : 0;
                        return (
                          <div key={k} className="relative rounded-md border border-border/50 p-2 overflow-hidden">
                            <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                            <div className="relative flex justify-between text-xs">
                              <span className="font-semibold truncate">{opt || <em className="text-muted-foreground">option {k + 1}</em>}</span>
                              <span className="tabular-nums text-muted-foreground">{c} · <span className="text-primary font-bold">{pct}%</span></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Individual votes</div>
                      {votes.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No votes yet.</div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                          {votes.map((v) => {
                            const p = profiles[v.user_id];
                            return (
                              <div key={v.id} className="rounded-md border border-border/40 p-2 space-y-1.5">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold truncate">{p?.full_name || p?.email || v.user_id.slice(0, 8)}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">{p?.email}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      Voted: <span className="text-primary font-semibold">{r.options[v.selected_index] || `#${v.selected_index}`}</span> · {new Date(v.created_at).toLocaleString()}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="border-amber-500/50 text-amber-300 whitespace-nowrap">
                                    <Coins className="h-3 w-3 mr-1" />{(p?.token_balance ?? 0).toLocaleString()}
                                  </Badge>
                                </div>
                                <div className="flex gap-1.5 items-center flex-wrap">
                                  <Input
                                    type="number"
                                    placeholder="Amount (± tokens)"
                                    className="h-8 text-xs w-36"
                                    value={giftAmount[v.id] ?? ""}
                                    onChange={(e) => setGiftAmount((g) => ({ ...g, [v.id]: e.target.value }))}
                                  />
                                  <Button size="sm" className="h-8 btn-luxury" onClick={() => giftTokens(r.id, v.id, v.user_id)}>
                                    <Coins className="h-3.5 w-3.5 mr-1" /> Gift
                                  </Button>
                                  <Button size="sm" variant="destructive" className="h-8" onClick={() => removeVote(r.id, v.id, v.user_id)}>
                                    <X className="h-3.5 w-3.5 mr-1" /> Remove vote
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/components/Countdown";
import { GrandPrizeWinners } from "@/components/GrandPrizeWinners";
import { Ticket, Newspaper, Award } from "lucide-react";

type Lottery = { id: string; name: string; prize_label: string; numbers: string | null; draws_at: string | null; results: string | null; buy_url: string | null };
type News = { id: string; title: string; summary: string | null; image_url: string | null; link_url: string | null };

export function LotteryNewsCluster() {
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: l }, { data: n }] = await Promise.all([
        (supabase as any).from("home_lottery_draws").select("*").eq("is_active", true).order("sort_order"),
        (supabase as any).from("home_news").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setLotteries((l as Lottery[]) ?? []);
      setNews((n as News[]) ?? []);
    })();
    const ch = supabase
      .channel("home-lottery-news")
      .on("postgres_changes", { event: "*", schema: "public", table: "home_lottery_draws" }, async () => {
        const { data } = await (supabase as any).from("home_lottery_draws").select("*").eq("is_active", true).order("sort_order");
        setLotteries((data as Lottery[]) ?? []);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "home_news" }, async () => {
        const { data } = await (supabase as any).from("home_news").select("*").eq("is_active", true).order("sort_order");
        setNews((data as News[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (lotteries.length === 0 && news.length === 0) return null;

  const upcoming = lotteries.filter((l) => !l.results);
  const results = lotteries.filter((l) => !!l.results);

  return (
    <section className="container mt-8 grid lg:grid-cols-[1fr_320px] gap-4">
      <div className="space-y-3">
        {upcoming.length > 0 && (
          <Card className="glass border-primary/25 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
              <Ticket className="h-4 w-4 text-primary" />
              <div className="font-black italic text-sm gradient-gold-text">Lottery</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-px bg-border/50">
              {upcoming.slice(0, 4).map((l) => (
                <div key={l.id} className="bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm truncate">{l.name}</div>
                    {l.draws_at && (
                      <div className="text-[10px] font-mono text-primary shrink-0"><Countdown target={l.draws_at} /></div>
                    )}
                  </div>
                  <div className="mt-1 gradient-gold-text font-black text-lg tracking-tight">{l.prize_label}</div>
                  {l.numbers && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.numbers.split(/[\s,]+/).filter(Boolean).slice(0, 8).map((n, i) => (
                        <span key={i} className="h-6 w-6 grid place-items-center rounded-full bg-primary/15 border border-primary/30 text-[10px] font-black text-primary">{n}</span>
                      ))}
                    </div>
                  )}
                  {l.buy_url && (
                    <a href={l.buy_url} className="mt-2 inline-block text-[11px] font-bold text-emerald-300 hover:underline">Buy Now →</a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
        {results.length > 0 && (
          <Card className="glass border-accent/25 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-accent/10 to-transparent">
              <Award className="h-4 w-4 text-accent" />
              <div className="font-black italic text-sm text-accent">Lottery Results</div>
            </div>
            <ul className="divide-y divide-border/40">
              {results.slice(0, 6).map((l) => (
                <li key={l.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm truncate">{l.name}</div>
                    <div className="text-[10px] text-muted-foreground shrink-0">NO. {l.id.slice(0, 6).toUpperCase()}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(l.results ?? "").split(/[\s,]+/).filter(Boolean).slice(0, 8).map((n, i) => (
                      <span key={i} className="h-6 w-6 grid place-items-center rounded-full border border-emerald-400/50 text-emerald-300 text-[10px] font-black">{n}</span>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-300 font-bold">Win: {l.prize_label}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        {news.length > 0 && (
          <Card className="glass border-primary/25 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
              <Newspaper className="h-4 w-4 text-primary" />
              <div className="font-black italic text-sm">News</div>
            </div>
            <div>
              {news.slice(0, 1).map((n) => {
                const inner = (
                  <>
                    {n.image_url && <img src={n.image_url} alt="" className="w-full h-40 object-cover" />}
                    <div className="p-3">
                      <div className="font-bold text-sm">{n.title}</div>
                      {n.summary && <div className="text-xs text-muted-foreground line-clamp-2">{n.summary}</div>}
                    </div>
                  </>
                );
                return n.link_url ? <a key={n.id} href={n.link_url}>{inner}</a> : <div key={n.id}>{inner}</div>;
              })}
            </div>
            {news.length > 1 && (
              <ul className="divide-y divide-border/40 border-t border-border/40">
                {news.slice(1, 4).map((n) => (
                  <li key={n.id} className="p-2 text-xs">
                    <a href={n.link_url ?? "#"} className="line-clamp-2 hover:text-primary">{n.title}</a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <GrandPrizeWinners />
      </div>
    </section>
  );
}

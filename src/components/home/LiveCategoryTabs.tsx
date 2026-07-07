import { useMemo, useState } from "react";
import { MatchCardLive } from "@/components/MatchCardLive";
import type { MatchRow } from "@/lib/queries";
import { Radio } from "lucide-react";

const CATS = [
  { key: "duel", label: "Duel" },
  { key: "squad", label: "Squad" },
  { key: "ranked", label: "Ranked" },
  { key: "tournament", label: "Tournament" },
  { key: "virtual", label: "Virtual" },
] as const;

type Key = (typeof CATS)[number]["key"];

export function LiveCategoryTabs({ matches }: { matches: MatchRow[] }) {
  const [tab, setTab] = useState<Key>("duel");

  const buckets = useMemo(() => {
    const b: Record<Key, MatchRow[]> = { duel: [], squad: [], ranked: [], tournament: [], virtual: [] };
    for (const m of matches) {
      if ((m as any).is_virtual || m.match_kind === "virtual") { b.virtual.push(m); continue; }
      if (m.match_kind === "future") { b.tournament.push(m); continue; }
      const cat = (m.category?.name ?? "").toLowerCase();
      if (cat.includes("squad")) b.squad.push(m);
      else if (cat.includes("rank")) b.ranked.push(m);
      else if (cat.includes("tourn")) b.tournament.push(m);
      else b.duel.push(m);
    }
    return b;
  }, [matches]);

  const items = buckets[tab].filter((m) => m.status === "live" || m.status === "scheduled").slice(0, 6);

  return (
    <section className="container mt-8">
      <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-md overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent">
          <Radio className="h-4 w-4 text-primary animate-pulse" />
          <div className="font-black italic text-sm">Live</div>
        </div>
        <div className="flex items-center gap-1 px-2 pt-2 overflow-x-auto no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={`px-3 py-1.5 text-xs font-bold rounded-t transition whitespace-nowrap ${
                tab === c.key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
              <span className="ml-1 text-[10px] opacity-60">({buckets[c.key].length})</span>
            </button>
          ))}
        </div>
        <div className="p-3">
          {items.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">No {tab} matches right now.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {items.map((m) => <MatchCardLive key={m.id} match={m} />)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

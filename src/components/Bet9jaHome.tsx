import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { BarChart2, Crosshair, Flame, Target, Trophy, Zap } from "lucide-react";
import { useBetSlip } from "@/contexts/BetSlipContext";
import type { MatchRow, OddRow } from "@/lib/queries";

/**
 * Bet9ja-style highlights section:
 * - Sport / category chip tabs
 * - Live Highlights table (live matches with live scores + 1/X/2 odds)
 * - Highlights table (upcoming matches grouped by day with 1/X/2 odds)
 * - Left rail of categories (desktop)
 *
 * Data-driven from existing matches/categories. Admins already control what
 * shows here from the Admin Console via the Matches, Content, and Categories
 * quick actions (categories become the tabs, matches drive the rows).
 */

type Group = { id: string; name: string; icon: string | null; items: MatchRow[] };

function pickThreeWay(match: MatchRow): { market_id: string; market_name: string; odds: OddRow[] } | null {
  if (!match.markets?.length) return null;
  const preferred =
    match.markets.find((m) => /full time|1x2|3\s*way|match result|winner/i.test(m.name)) ??
    match.markets.find((m) => m.odds?.length === 3) ??
    match.markets[0];
  if (!preferred?.odds?.length) return null;
  // Sort to conventional 1 / X / 2 ordering
  const sorted = [...preferred.odds].sort((a, b) => {
    const rank = (l: string) => (/^1\b|home|win/i.test(l) ? 0 : /draw|^x$/i.test(l) ? 1 : /^2\b|away|lose/i.test(l) ? 2 : 3);
    return rank(a.label) - rank(b.label);
  });
  return { market_id: preferred.id, market_name: preferred.name, odds: sorted.slice(0, 3) };
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const base = d.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Tomorrow · ${base}`;
  return base;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function OddButton({
  match, market_id, market_name, odd, disabled,
}: {
  match: MatchRow;
  market_id: string;
  market_name: string;
  odd: OddRow;
  disabled?: boolean;
}) {
  const { selections, add, remove, setOpen } = useBetSlip();
  const selected = selections.some((s) => s.odd_id === odd.id);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (selected) { remove(odd.id); return; }
        add({
          match_id: match.id, match_name: match.name,
          market_id, market_name, odd_id: odd.id,
          selection_label: odd.label, odds: Number(odd.value),
        });
        setOpen(true);
      }}
      className={[
        "h-11 rounded-md border font-mono font-bold text-sm transition select-none",
        "grid place-items-center min-w-0 px-1",
        selected
          ? "bg-primary text-primary-foreground border-primary shadow-gold"
          : "bg-emerald-600/85 hover:bg-emerald-500 text-white border-emerald-500/60 hover:border-emerald-400",
        disabled ? "opacity-40 cursor-not-allowed" : "",
      ].join(" ")}
      aria-label={`${odd.label} ${Number(odd.value).toFixed(2)}`}
    >
      {Number(odd.value).toFixed(2)}
    </button>
  );
}

function MatchRowLine({ match, live }: { match: MatchRow; live?: boolean }) {
  const three = pickThreeWay(match);
  const home = match.home_team?.name ?? match.home_player?.name ?? "Home";
  const away = match.away_team?.name ?? match.away_player?.name ?? "Away";
  const leftTag = live
    ? <span className="text-[11px] font-black text-destructive tracking-wider">LIVE</span>
    : <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{timeLabel(match.start_time)}</span>;
  return (
    <div className="grid grid-cols-[42px_1fr_28px_repeat(3,minmax(46px,1fr))] items-center gap-1.5 px-2 py-2 border-b border-border/40 last:border-b-0 hover:bg-primary/[0.04] transition-colors">
      <div className="text-center">{leftTag}</div>
      <Link to="/matches/$matchId" params={{ matchId: match.id }} className="min-w-0 leading-tight">
        <div className="text-[13px] font-semibold text-foreground truncate">{home}</div>
        <div className="text-[13px] font-semibold text-foreground truncate">{away}</div>
      </Link>
      <div className="text-center font-mono text-[11px] leading-tight">
        {live ? (
          <div>
            <div className="text-emerald-300 font-black">{match.home_score}</div>
            <div className="text-emerald-300 font-black">{match.away_score}</div>
          </div>
        ) : (
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
        )}
      </div>
      {three ? (
        three.odds.map((o) => (
          <OddButton key={o.id} match={match} market_id={three.market_id} market_name={three.market_name} odd={o} />
        ))
      ) : (
        <>
          <div className="h-11 rounded-md bg-muted/30 grid place-items-center text-[10px] text-muted-foreground">—</div>
          <div className="h-11 rounded-md bg-muted/30 grid place-items-center text-[10px] text-muted-foreground">—</div>
          <div className="h-11 rounded-md bg-muted/30 grid place-items-center text-[10px] text-muted-foreground">—</div>
        </>
      )}
    </div>
  );
}

function GroupTable({
  title, action, sportTabs, activeSport, onSportChange, live, matches, emptyLabel,
}: {
  title: string;
  action?: React.ReactNode;
  sportTabs: Group[];
  activeSport: string | "all";
  onSportChange: (id: string) => void;
  live?: boolean;
  matches: MatchRow[];
  emptyLabel: string;
}) {
  // group by day (upcoming) or single bucket (live)
  const byDay = useMemo(() => {
    if (live) return [{ day: "", items: matches }];
    const map = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const k = dayLabel(m.start_time);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()].map(([day, items]) => ({ day, items }));
  }, [matches, live]);

  return (
    <Card className="glass-strong overflow-hidden border-primary/20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card/60">
        <div className="flex items-center gap-2">
          {live ? <Flame className="h-4 w-4 text-destructive" /> : <Crosshair className="h-4 w-4 text-primary" />}
          <h3 className="font-black text-sm tracking-wide uppercase">{title}</h3>
        </div>
        {action}
      </div>
      {/* Sport tabs (categories) */}
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-2 border-b border-border/40 bg-card/40">
        <button
          onClick={() => onSportChange("all")}
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border transition ${activeSport === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          All
        </button>
        {sportTabs.map((g) => (
          <button
            key={g.id}
            onClick={() => onSportChange(g.id)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border transition ${activeSport === g.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {g.icon ? <span className="text-sm leading-none">{g.icon}</span> : <Target className="h-3 w-3" />}
            <span>{g.name}</span>
          </button>
        ))}
      </div>
      {/* Header row */}
      <div className="grid grid-cols-[42px_1fr_28px_repeat(3,minmax(46px,1fr))] gap-1.5 px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-card/30 border-b border-border/30">
        <div className="text-center">Time</div>
        <div>Match</div>
        <div />
        <div className="text-center">1</div>
        <div className="text-center">X</div>
        <div className="text-center">2</div>
      </div>
      {matches.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        byDay.map((bucket) => (
          <div key={bucket.day || "live"}>
            {bucket.day && (
              <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-primary bg-primary/[0.06] border-y border-primary/20">
                {bucket.day}
              </div>
            )}
            {bucket.items.map((m) => (
              <MatchRowLine key={m.id} match={m} live={live} />
            ))}
          </div>
        ))
      )}
    </Card>
  );
}

export function Bet9jaHome({ live, upcoming, categoryGroups }: {
  live: MatchRow[];
  upcoming: MatchRow[];
  categoryGroups: Group[];
}) {
  const [liveSport, setLiveSport] = useState<string | "all">("all");
  const [upSport, setUpSport] = useState<string | "all">("all");

  const filteredLive = liveSport === "all" ? live : live.filter((m) => m.category?.id === liveSport);
  const filteredUp = upSport === "all" ? upcoming : upcoming.filter((m) => m.category?.id === upSport);

  return (
    <section className="container mt-10 grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Left rail — categories/leagues */}
      <aside className="hidden lg:block">
        <Card className="glass-strong overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 bg-card/60 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <div className="text-[11px] font-black tracking-widest uppercase">Leagues</div>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {categoryGroups.length === 0 && (
              <div className="p-4 text-xs text-muted-foreground">No categories yet.</div>
            )}
            {categoryGroups.map((g) => (
              <button
                key={g.id}
                onClick={() => { setLiveSport(g.id); setUpSport(g.id); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left border-b border-border/30 hover:bg-primary/[0.06] transition"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {g.icon ? <span className="text-base leading-none shrink-0">{g.icon}</span> : <Trophy className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <span className="text-[12px] font-semibold truncate">{g.name}</span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{g.items.length}</span>
              </button>
            ))}
          </div>
        </Card>
      </aside>

      <div className="min-w-0 space-y-4">
        <GroupTable
          title="Live Highlights"
          action={<Link to="/matches" className="text-[11px] font-bold text-primary hover:underline">View Live Betting</Link>}
          sportTabs={categoryGroups}
          activeSport={liveSport}
          onSportChange={setLiveSport}
          live
          matches={filteredLive}
          emptyLabel="No live matches right now."
        />
        <GroupTable
          title="Highlights"
          action={<Link to="/matches" className="text-[11px] font-bold text-primary hover:underline">View Highlights</Link>}
          sportTabs={categoryGroups}
          activeSport={upSport}
          onSportChange={setUpSport}
          matches={filteredUp}
          emptyLabel="No upcoming matches scheduled."
        />
      </div>
    </section>
  );
}

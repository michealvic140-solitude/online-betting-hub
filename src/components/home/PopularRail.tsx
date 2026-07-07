import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Flame } from "lucide-react";

type Row = { id: string; label: string; href: string; icon: string | null; sort_order: number; is_active: boolean };

const DEFAULTS: Omit<Row, "id" | "is_active" | "sort_order">[] = [
  { label: "2 Hours Rounds", href: "/matches?window=2h", icon: null },
  { label: "Today's Matches", href: "/matches?window=today", icon: null },
  { label: "Grand Tournament", href: "/tournament", icon: null },
  { label: "iBot AI", href: "/chat", icon: null },
  { label: "Virtual League", href: "/virtual", icon: null },
  { label: "Ranked Duels", href: "/matches?cat=ranked", icon: null },
  { label: "Lucky Winner", href: "/leaderboard", icon: null },
];

export function PopularRail() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("home_popular_links")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setRows((data as Row[]) ?? []);
    })();
    const ch = supabase
      .channel("popular-links")
      .on("postgres_changes", { event: "*", schema: "public", table: "home_popular_links" }, async () => {
        const { data } = await (supabase as any)
          .from("home_popular_links")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        setRows((data as Row[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const items = rows && rows.length > 0 ? rows : DEFAULTS.map((d, i) => ({ ...d, id: `d-${i}`, sort_order: i, is_active: true } as Row));

  return (
    <aside className="rounded-2xl border border-primary/20 bg-card/70 backdrop-blur-md overflow-hidden">
      <div className="px-3 py-2 border-b border-primary/15 flex items-center gap-2">
        <Flame className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary">Popular</span>
      </div>
      <ul className="divide-y divide-border/40">
        {items.map((r) => (
          <li key={r.id}>
            <Link
              to={r.href as any}
              className="flex items-center justify-between px-3 py-2 text-xs hover:bg-primary/10 transition"
            >
              <span className="truncate text-foreground">{r.label}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

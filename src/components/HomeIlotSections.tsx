import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { ChevronRight, Ticket, Newspaper, Gift, Flame, Sparkles, Trophy, Clock } from "lucide-react";
import { Countdown } from "@/components/Countdown";

/**
 * iLOTBET-inspired home sections. Admin configures via existing quick actions:
 *  - Popular rail   → Settings › home_popular_links (JSON array of {label, href})
 *  - Featured Games → Content › Advertisements (marked is_featured or all active)
 *  - Highlight tab  → Content › Highlights
 *  - Gifts tab      → Content › Advertisements with tag "gift" (link_url starts with promo)
 *  - Lottery        → Settings › home_lottery_draws (JSON array of draws)
 *  - News           → Content › Announcements
 */

type PopularLink = { label: string; href: string };

const DEFAULT_POPULAR: PopularLink[] = [
  { label: "2 Hours Football", href: "/matches" },
  { label: "Today's Matches", href: "/matches" },
  { label: "World Cup", href: "/matches" },
  { label: "LSL AI Picks", href: "/dashboard" },
  { label: "Virtual League", href: "/virtual" },
  { label: "sFootball", href: "/matches" },
  { label: "Lucky Winner", href: "/leaderboard" },
];

export function PopularRail({ settings }: { settings: any }) {
  const links: PopularLink[] = Array.isArray(settings?.home_popular_links) && settings.home_popular_links.length
    ? settings.home_popular_links
    : DEFAULT_POPULAR;
  return (
    <aside className="lg:sticky lg:top-20 self-start">
      <Card className="glass-strong overflow-hidden">
        <div className="px-3 py-2 border-b border-border/40 bg-card/60">
          <div className="text-[11px] font-black uppercase tracking-widest text-primary">Popular</div>
        </div>
        <ul>
          {links.map((l, i) => (
            <li key={i}>
              <Link
                to={l.href as any}
                className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-semibold border-b border-border/30 last:border-b-0 hover:bg-primary/[0.08] hover:text-primary transition"
              >
                <span className="truncate">{l.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Featured / Highlight / Gifts tabs                                   */
/* ------------------------------------------------------------------ */

export function FeaturedTabsBoard() {
  const [tab, setTab] = useState<"featured" | "highlight" | "gifts">("featured");
  const [ads, setAds] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("advertisements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(24)
      .then(({ data }) => setAds(data ?? []));
    supabase.from("highlights").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(24)
      .then(({ data }) => setHighlights(data ?? []));
  }, []);

  const featured = ads.filter((a) => !/(gift|promo|invite|reward)/i.test(a.link_url ?? "") && !/(gift|reward|invite)/i.test(a.title ?? ""));
  const gifts = ads.filter((a) => /(gift|promo|invite|reward|freely|register|deposit)/i.test((a.link_url ?? "") + " " + (a.title ?? "")));

  const cards = tab === "featured" ? featured : tab === "highlight" ? highlights : gifts;
  const empty = cards.length === 0;

  return (
    <Card className="glass-strong overflow-hidden">
      <div className="flex items-center gap-1 px-2 pt-2 border-b border-border/40">
        <TabBtn active={tab === "featured"} onClick={() => setTab("featured")} icon={<Flame className="h-3.5 w-3.5" />}>Featured Games</TabBtn>
        <TabBtn active={tab === "highlight"} onClick={() => setTab("highlight")} icon={<Sparkles className="h-3.5 w-3.5" />}>Highlight</TabBtn>
        <TabBtn active={tab === "gifts"} onClick={() => setTab("gifts")} icon={<Gift className="h-3.5 w-3.5" />}>Gifts</TabBtn>
      </div>
      <div className="p-3">
        {empty ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nothing here yet — add items from Admin › Content.</div>
        ) : (
          <Carousel opts={{ align: "start", dragFree: true, loop: cards.length > 4 }}
            plugins={cards.length > 4 ? [Autoplay({ delay: 4500, stopOnInteraction: false })] : []}>
            <CarouselContent>
              {cards.map((c) => {
                const img = c.image_url || c.media_url;
                const inner = (
                  <Card className="glass overflow-hidden border-primary/20 hover:border-primary/50 transition">
                    {img
                      ? (c.media_type === "video"
                          ? <video src={img} muted className="w-full h-28 object-cover" />
                          : <img src={img} alt={c.title ?? ""} className="w-full h-28 object-cover" />)
                      : <div className="w-full h-28 bg-gradient-gold grid place-items-center"><Trophy className="h-8 w-8 text-primary-foreground" /></div>}
                    <div className="px-2 py-2">
                      <div className="text-[12px] font-black truncate">{c.title || "Untitled"}</div>
                    </div>
                  </Card>
                );
                return (
                  <CarouselItem key={c.id} className="basis-[70%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                    {c.link_url ? <a href={c.link_url} target="_blank" rel="noreferrer">{inner}</a> : inner}
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        )}
      </div>
    </Card>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-3 py-2 text-[12px] font-black uppercase tracking-wider transition ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      <span>{children}</span>
      {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full" />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Lottery + Results                                                   */
/* ------------------------------------------------------------------ */

type Draw = { code: string; label: string; prize: number; next_at: string; numbers?: number[]; is_new?: boolean };

const DEFAULT_DRAWS: Draw[] = [
  { code: "5/90", label: "5/90", prize: 2_950_000, next_at: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), numbers: [9, 31, 41, 4, 80] },
  { code: "quick3", label: "Quick 3", prize: 15_000, next_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(), numbers: [2, 3, 1] },
  { code: "super590", label: "Super 5/90", prize: 10_000_000, next_at: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(), is_new: true },
];

export function LotterySection({ settings }: { settings: any }) {
  const draws: Draw[] = Array.isArray(settings?.home_lottery_draws) && settings.home_lottery_draws.length
    ? settings.home_lottery_draws
    : DEFAULT_DRAWS;

  const results = draws.filter((d) => d.numbers?.length);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
      {/* Lottery draws */}
      <Card className="glass-strong overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-card/60">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-black uppercase tracking-wider">Lottery</h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold">
            {draws.map((d) => (
              <span key={d.code} className="text-primary flex items-center gap-1">
                {d.label}
                {d.is_new && <span className="rounded-full bg-accent/20 text-accent px-1.5 text-[9px]">new</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 p-3">
          {draws.slice(0, 2).map((d) => (
            <div key={d.code} className="rounded-lg border border-border/50 bg-card/70 p-3">
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-black">{d.label}</div>
                <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /><Countdown target={d.next_at} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] px-1.5 rounded bg-amber-500/25 text-amber-300 font-black">WIN</span>
                <span className="font-mono font-black text-primary text-sm">₦{d.prize.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {(d.numbers ?? [0, 0, 0]).slice(0, 5).map((n, i) => (
                    <span key={i} className="h-6 w-6 rounded-full border border-primary/40 bg-primary/10 grid place-items-center text-[10px] font-mono font-black text-primary">
                      {String(n).padStart(2, "0")}
                    </span>
                  ))}
                </div>
                <Link to="/virtual" className="text-[10px] font-black uppercase tracking-widest rounded bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 transition">
                  Buy Now
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {/* Results */}
      <Card className="glass-strong overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-card/60">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wider">Lottery Results</h3>
        </div>
        <div className="p-3 space-y-3">
          {results.length === 0 && <div className="text-[12px] text-muted-foreground">No results yet.</div>}
          {results.map((d) => (
            <div key={d.code} className="border-b border-border/30 pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-black">{d.label}</div>
                <div className="text-[10px] text-muted-foreground font-mono">NO. {String(Math.floor(Math.random() * 900000 + 100000))}</div>
              </div>
              <div className="mt-1 flex items-center gap-1">
                {(d.numbers ?? []).map((n, i) => (
                  <span key={i} className="h-6 w-6 rounded-full border border-emerald-500/40 bg-emerald-500/10 grid place-items-center text-[10px] font-mono font-black text-emerald-300">
                    {String(n).padStart(2, "0")}
                  </span>
                ))}
              </div>
              <div className="mt-1 text-[11px]">Win: <span className="font-mono font-black text-primary">₦{d.prize.toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* News card                                                           */
/* ------------------------------------------------------------------ */

export function NewsCard() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("announcements").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(6)
      .then(({ data }) => setItems(data ?? []));
  }, []);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(iv);
  }, [items.length]);
  const cur = items[idx];

  return (
    <Card className="glass-strong overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-card/60">
        <Newspaper className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-black uppercase tracking-wider">News</h3>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No news yet.</div>
      ) : (
        <div>
          {cur?.image_url ? (
            <img src={cur.image_url} alt="" className="w-full h-40 object-cover" />
          ) : (
            <div className="w-full h-40 bg-gradient-emerald grid place-items-center"><Newspaper className="h-8 w-8 text-primary-foreground" /></div>
          )}
          <div className="p-3">
            <div className="text-[13px] font-black leading-tight line-clamp-2">{cur?.title}</div>
            {cur?.body && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{cur.body}</div>}
            {items.length > 1 && (
              <div className="mt-2 flex justify-center gap-1">
                {items.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

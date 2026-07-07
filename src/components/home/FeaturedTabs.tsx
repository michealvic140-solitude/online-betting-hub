import { useState } from "react";
import { HighlightsRow } from "@/components/HomeContent";
import { GiftsRow } from "@/components/home/GiftsRow";
import { HotBets } from "@/components/HotBets";

type Tab = "featured" | "highlight" | "gifts";

export function FeaturedTabs() {
  const [tab, setTab] = useState<Tab>("featured");
  return (
    <section className="container mt-6">
      <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-md p-3">
        <div className="flex items-center gap-1 border-b border-border/40">
          {(["featured", "highlight", "gifts"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2 text-sm font-black italic tracking-wide transition ${
                tab === t ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "featured" ? "Featured Games" : t === "highlight" ? "Highlight" : "Gifts"}
              {tab === t && <span className="absolute left-2 right-2 -bottom-px h-0.5 bg-gradient-gold rounded-full" />}
            </button>
          ))}
        </div>
        <div>
          {tab === "featured" && <div className="pt-2"><HotBets /></div>}
          {tab === "highlight" && <div className="pt-1"><HighlightsRow /></div>}
          {tab === "gifts" && <GiftsRow />}
        </div>
      </div>
    </section>
  );
}

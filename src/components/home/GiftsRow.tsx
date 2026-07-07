import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Gift } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

type Row = { id: string; title: string; subtitle: string | null; image_url: string | null; link_url: string | null };

export function GiftsRow() {
  const [items, setItems] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("home_gifts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setItems((data as Row[]) ?? []);
    })();
    const ch = supabase
      .channel("home-gifts")
      .on("postgres_changes", { event: "*", schema: "public", table: "home_gifts" }, async () => {
        const { data } = await (supabase as any).from("home_gifts").select("*").eq("is_active", true).order("sort_order", { ascending: true });
        setItems((data as Row[]) ?? []);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <Carousel opts={{ align: "start", dragFree: true }}>
        <CarouselContent>
          {items.map((g) => {
            const inner = (
              <Card className="glass overflow-hidden hover:border-primary/40 transition h-full">
                <div className="relative aspect-[4/3] w-full">
                  {g.image_url ? (
                    <img src={g.image_url} alt={g.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-emerald grid place-items-center">
                      <Gift className="h-8 w-8 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                    <div className="text-[11px] font-black text-white truncate">{g.title}</div>
                    {g.subtitle && <div className="text-[9px] text-emerald-300 uppercase tracking-wider truncate">{g.subtitle}</div>}
                  </div>
                </div>
              </Card>
            );
            return (
              <CarouselItem key={g.id} className="basis-[45%] sm:basis-1/3 md:basis-1/4 lg:basis-1/5">
                {g.link_url ? <a href={g.link_url} target="_blank" rel="noreferrer">{inner}</a> : inner}
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}

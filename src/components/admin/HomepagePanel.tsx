import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";

type BaseRow = { id?: string; sort_order?: number; is_active?: boolean };

function useTable<T extends BaseRow>(table: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any).from(table).select("*").order("sort_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows((data as T[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  async function save(row: T) {
    const payload = { ...row };
    const { error } = row.id
      ? await (supabase as any).from(table).update(payload).eq("id", row.id)
      : await (supabase as any).from(table).insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    load();
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  }
  return { rows, setRows, loading, save, remove, load };
}

function BaseFieldsInline({ row, setRow }: { row: any; setRow: (r: any) => void }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <Input type="number" value={row.sort_order ?? 0} onChange={(e) => setRow({ ...row, sort_order: Number(e.target.value) })} className="w-16 h-8 text-xs" placeholder="Order" />
      <label className="flex items-center gap-1 text-xs">
        <Switch checked={row.is_active !== false} onCheckedChange={(v) => setRow({ ...row, is_active: v })} />
        <span className="text-muted-foreground">Active</span>
      </label>
    </div>
  );
}

function RowShell({ children, onSave, onDelete }: { children: React.ReactNode; onSave: () => void; onDelete?: () => void }) {
  return (
    <Card className="p-3 flex flex-wrap items-center gap-2 border-primary/20">
      {children}
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" onClick={onSave} className="h-8"><Save className="h-3 w-3 mr-1" />Save</Button>
        {onDelete && <Button size="sm" variant="destructive" onClick={onDelete} className="h-8 px-2"><Trash2 className="h-3 w-3" /></Button>}
      </div>
    </Card>
  );
}

function PopularLinksAdmin() {
  const { rows, save, remove } = useTable<any>("home_popular_links");
  const [draft, setDraft] = useState<any>({ label: "", href: "/", sort_order: 0, is_active: true });
  return (
    <div className="space-y-2">
      <RowShell onSave={() => { if (!draft.label) return toast.error("Label required"); save(draft); setDraft({ label: "", href: "/", sort_order: 0, is_active: true }); }}>
        <Input placeholder="Label (e.g. World Cup)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="w-40 h-8 text-xs" />
        <Input placeholder="Href (/matches)" value={draft.href} onChange={(e) => setDraft({ ...draft, href: e.target.value })} className="w-40 h-8 text-xs" />
        <BaseFieldsInline row={draft} setRow={setDraft} />
      </RowShell>
      {rows.map((r) => <PopularRow key={r.id} row={r} save={save} remove={remove} />)}
    </div>
  );
}
function PopularRow({ row, save, remove }: any) {
  const [r, setR] = useState(row);
  useEffect(() => setR(row), [row]);
  return (
    <RowShell onSave={() => save(r)} onDelete={() => remove(r.id)}>
      <Input value={r.label} onChange={(e) => setR({ ...r, label: e.target.value })} className="w-40 h-8 text-xs" />
      <Input value={r.href} onChange={(e) => setR({ ...r, href: e.target.value })} className="w-40 h-8 text-xs" />
      <BaseFieldsInline row={r} setRow={setR} />
    </RowShell>
  );
}

function GiftsAdmin() {
  const { rows, save, remove } = useTable<any>("home_gifts");
  const [d, setD] = useState<any>({ title: "", subtitle: "", image_url: "", link_url: "", sort_order: 0, is_active: true });
  return (
    <div className="space-y-2">
      <RowShell onSave={() => { if (!d.title) return toast.error("Title required"); save(d); setD({ title: "", subtitle: "", image_url: "", link_url: "", sort_order: 0, is_active: true }); }}>
        <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className="w-32 h-8 text-xs" />
        <Input placeholder="Subtitle" value={d.subtitle} onChange={(e) => setD({ ...d, subtitle: e.target.value })} className="w-32 h-8 text-xs" />
        <Input placeholder="Image URL" value={d.image_url} onChange={(e) => setD({ ...d, image_url: e.target.value })} className="w-40 h-8 text-xs" />
        <Input placeholder="Link URL" value={d.link_url} onChange={(e) => setD({ ...d, link_url: e.target.value })} className="w-40 h-8 text-xs" />
        <BaseFieldsInline row={d} setRow={setD} />
      </RowShell>
      {rows.map((r) => <GiftRow key={r.id} row={r} save={save} remove={remove} />)}
    </div>
  );
}
function GiftRow({ row, save, remove }: any) {
  const [r, setR] = useState(row);
  useEffect(() => setR(row), [row]);
  return (
    <RowShell onSave={() => save(r)} onDelete={() => remove(r.id)}>
      <Input value={r.title ?? ""} onChange={(e) => setR({ ...r, title: e.target.value })} className="w-32 h-8 text-xs" />
      <Input value={r.subtitle ?? ""} onChange={(e) => setR({ ...r, subtitle: e.target.value })} className="w-32 h-8 text-xs" />
      <Input value={r.image_url ?? ""} onChange={(e) => setR({ ...r, image_url: e.target.value })} className="w-40 h-8 text-xs" />
      <Input value={r.link_url ?? ""} onChange={(e) => setR({ ...r, link_url: e.target.value })} className="w-40 h-8 text-xs" />
      <BaseFieldsInline row={r} setRow={setR} />
    </RowShell>
  );
}

function NewsAdmin() {
  const { rows, save, remove } = useTable<any>("home_news");
  const [d, setD] = useState<any>({ title: "", summary: "", image_url: "", link_url: "", sort_order: 0, is_active: true });
  return (
    <div className="space-y-2">
      <Card className="p-3 border-primary/20 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className="w-56 h-8 text-xs" />
          <Input placeholder="Image URL" value={d.image_url} onChange={(e) => setD({ ...d, image_url: e.target.value })} className="w-56 h-8 text-xs" />
          <Input placeholder="Link URL" value={d.link_url} onChange={(e) => setD({ ...d, link_url: e.target.value })} className="w-56 h-8 text-xs" />
          <BaseFieldsInline row={d} setRow={setD} />
          <Button size="sm" onClick={() => { if (!d.title) return toast.error("Title required"); save(d); setD({ title: "", summary: "", image_url: "", link_url: "", sort_order: 0, is_active: true }); }} className="h-8 ml-auto"><Plus className="h-3 w-3 mr-1" />Add</Button>
        </div>
        <Textarea placeholder="Summary" value={d.summary} onChange={(e) => setD({ ...d, summary: e.target.value })} rows={2} className="text-xs" />
      </Card>
      {rows.map((r) => <NewsRow key={r.id} row={r} save={save} remove={remove} />)}
    </div>
  );
}
function NewsRow({ row, save, remove }: any) {
  const [r, setR] = useState(row);
  useEffect(() => setR(row), [row]);
  return (
    <Card className="p-3 border-primary/20 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={r.title ?? ""} onChange={(e) => setR({ ...r, title: e.target.value })} className="w-56 h-8 text-xs" />
        <Input value={r.image_url ?? ""} onChange={(e) => setR({ ...r, image_url: e.target.value })} className="w-56 h-8 text-xs" />
        <Input value={r.link_url ?? ""} onChange={(e) => setR({ ...r, link_url: e.target.value })} className="w-56 h-8 text-xs" />
        <BaseFieldsInline row={r} setRow={setR} />
        <div className="ml-auto flex gap-1">
          <Button size="sm" onClick={() => save(r)} className="h-8"><Save className="h-3 w-3 mr-1" />Save</Button>
          <Button size="sm" variant="destructive" onClick={() => remove(r.id)} className="h-8 px-2"><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      <Textarea value={r.summary ?? ""} onChange={(e) => setR({ ...r, summary: e.target.value })} rows={2} className="text-xs" />
    </Card>
  );
}

function LotteryAdmin() {
  const { rows, save, remove } = useTable<any>("home_lottery_draws");
  const [d, setD] = useState<any>({ name: "", prize_label: "", numbers: "", draws_at: null, results: "", buy_url: "", sort_order: 0, is_active: true });
  return (
    <div className="space-y-2">
      <Card className="p-3 border-primary/20 flex flex-wrap items-center gap-2">
        <Input placeholder="Name (e.g. 5/90)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className="w-32 h-8 text-xs" />
        <Input placeholder="Prize (e.g. 2,950,000)" value={d.prize_label} onChange={(e) => setD({ ...d, prize_label: e.target.value })} className="w-40 h-8 text-xs" />
        <Input placeholder="Numbers (space-sep)" value={d.numbers ?? ""} onChange={(e) => setD({ ...d, numbers: e.target.value })} className="w-40 h-8 text-xs" />
        <Input placeholder="Results (space-sep)" value={d.results ?? ""} onChange={(e) => setD({ ...d, results: e.target.value })} className="w-40 h-8 text-xs" />
        <Input type="datetime-local" value={d.draws_at ? d.draws_at.slice(0, 16) : ""} onChange={(e) => setD({ ...d, draws_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-44 h-8 text-xs" />
        <Input placeholder="Buy URL" value={d.buy_url ?? ""} onChange={(e) => setD({ ...d, buy_url: e.target.value })} className="w-40 h-8 text-xs" />
        <BaseFieldsInline row={d} setRow={setD} />
        <Button size="sm" onClick={() => { if (!d.name) return toast.error("Name required"); save(d); setD({ name: "", prize_label: "", numbers: "", draws_at: null, results: "", buy_url: "", sort_order: 0, is_active: true }); }} className="h-8"><Plus className="h-3 w-3 mr-1" />Add</Button>
      </Card>
      {rows.map((r) => <LotteryRow key={r.id} row={r} save={save} remove={remove} />)}
    </div>
  );
}
function LotteryRow({ row, save, remove }: any) {
  const [r, setR] = useState(row);
  useEffect(() => setR(row), [row]);
  return (
    <Card className="p-3 border-primary/20 flex flex-wrap items-center gap-2">
      <Input value={r.name ?? ""} onChange={(e) => setR({ ...r, name: e.target.value })} className="w-32 h-8 text-xs" />
      <Input value={r.prize_label ?? ""} onChange={(e) => setR({ ...r, prize_label: e.target.value })} className="w-40 h-8 text-xs" />
      <Input value={r.numbers ?? ""} onChange={(e) => setR({ ...r, numbers: e.target.value })} className="w-40 h-8 text-xs" />
      <Input value={r.results ?? ""} onChange={(e) => setR({ ...r, results: e.target.value })} className="w-40 h-8 text-xs" />
      <Input type="datetime-local" value={r.draws_at ? r.draws_at.slice(0, 16) : ""} onChange={(e) => setR({ ...r, draws_at: e.target.value ? new Date(e.target.value).toISOString() : null })} className="w-44 h-8 text-xs" />
      <Input value={r.buy_url ?? ""} onChange={(e) => setR({ ...r, buy_url: e.target.value })} className="w-40 h-8 text-xs" />
      <BaseFieldsInline row={r} setRow={setR} />
      <div className="ml-auto flex gap-1">
        <Button size="sm" onClick={() => save(r)} className="h-8"><Save className="h-3 w-3 mr-1" />Save</Button>
        <Button size="sm" variant="destructive" onClick={() => remove(r.id)} className="h-8 px-2"><Trash2 className="h-3 w-3" /></Button>
      </div>
    </Card>
  );
}

export function HomepagePanel() {
  return (
    <div>
      <div className="mb-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold">Homepage content</div>
        <div className="text-xs text-muted-foreground">Manage the Popular rail, Gifts, News, and Lottery draws shown on the homepage.</div>
      </div>
      <Tabs defaultValue="popular">
        <TabsList>
          <TabsTrigger value="popular">Popular Links</TabsTrigger>
          <TabsTrigger value="gifts">Gifts</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="lottery">Lottery</TabsTrigger>
        </TabsList>
        <TabsContent value="popular" className="mt-3"><PopularLinksAdmin /></TabsContent>
        <TabsContent value="gifts" className="mt-3"><GiftsAdmin /></TabsContent>
        <TabsContent value="news" className="mt-3"><NewsAdmin /></TabsContent>
        <TabsContent value="lottery" className="mt-3"><LotteryAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

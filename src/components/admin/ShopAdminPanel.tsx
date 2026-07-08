import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  cost: number;
  stock: number | null;
  is_active: boolean;
};

export function ShopAdminPanel() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("shop_items").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Item[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addRow() {
    const { error } = await supabase.from("shop_items").insert({ name: "New reward", description: "", cost: 100000, is_active: true });
    if (error) return toast.error(error.message);
    load();
  }
  async function save(r: Item) {
    const { error } = await supabase.from("shop_items").update({
      name: r.name, description: r.description, image_url: r.image_url,
      cost: r.cost, stock: r.stock, is_active: r.is_active,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("shop_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Rewards Shop</div>
          <div className="text-[11px] text-muted-foreground">Items users redeem with tokens on /shop.</div>
        </div>
        <Button size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No shop items yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-[220px] flex-1" placeholder="Name" value={r.name} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input className="w-40" type="number" placeholder="Cost" value={r.cost} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, cost: Number(e.target.value) } : x))} />
                <Input className="w-32" type="number" placeholder="Stock" value={r.stock ?? ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, stock: e.target.value === "" ? null : Number(e.target.value) } : x))} />
                <div className="flex items-center gap-2 text-[11px]"><Switch checked={r.is_active} onCheckedChange={(v) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, is_active: v } : x))} /> Active</div>
              </div>
              <Input placeholder="Image URL" value={r.image_url ?? ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, image_url: e.target.value } : x))} />
              <Textarea rows={2} placeholder="Description" value={r.description ?? ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => save(r)}><Save className="h-4 w-4 mr-1" /> Save</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

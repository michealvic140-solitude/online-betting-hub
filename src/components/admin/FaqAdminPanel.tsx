import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
};

export function FaqAdminPanel() {
  const [rows, setRows] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("faqs").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Faq[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addRow() {
    const { error } = await supabase.from("faqs").insert({ question: "New question", answer: "Answer here", category: "General", sort_order: rows.length, is_active: true });
    if (error) return toast.error(error.message);
    toast.success("Added");
    load();
  }
  async function save(r: Faq) {
    const { error } = await supabase.from("faqs").update({
      question: r.question, answer: r.answer, category: r.category, sort_order: r.sort_order, is_active: r.is_active,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("faqs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">FAQ / Help Center</div>
          <div className="text-[11px] text-muted-foreground">Questions & answers shown on /faq. Users see only active items.</div>
        </div>
        <Button size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No FAQs yet. Click Add to create one.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-[220px] flex-1" placeholder="Question" value={r.question} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
                <Input className="w-40" placeholder="Category" value={r.category ?? ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
                <Input className="w-24" type="number" value={r.sort_order} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, sort_order: Number(e.target.value) } : x))} />
                <div className="flex items-center gap-2 text-[11px]"><Switch checked={r.is_active} onCheckedChange={(v) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, is_active: v } : x))} /> Active</div>
              </div>
              <Textarea rows={3} value={r.answer} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))} />
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

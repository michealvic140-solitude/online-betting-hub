import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";

type Poll = {
  id: string;
  question: string;
  options: string[];
  closes_at: string | null;
  is_active: boolean;
};

export function PollsAdminPanel() {
  const [rows, setRows] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("polls").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any[]) ?? []).map((p) => ({ ...p, options: Array.isArray(p.options) ? p.options : (p.options ?? []) })) as Poll[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addRow() {
    const { error } = await supabase.from("polls").insert({ question: "New poll question", options: ["Yes", "No"] as any, is_active: true });
    if (error) return toast.error(error.message);
    load();
  }
  async function save(r: Poll) {
    const { error } = await supabase.from("polls").update({
      question: r.question,
      options: r.options as any,
      closes_at: r.closes_at,
      is_active: r.is_active,
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("polls").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Prediction Polls</div>
          <div className="text-[11px] text-muted-foreground">Community polls shown on /polls. Everyone can vote once per poll.</div>
        </div>
        <Button size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No polls yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.id} className="rounded-lg border border-border/40 p-3 space-y-2">
              <Input value={r.question} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="Question" />
              <div className="space-y-1">
                {r.options.map((opt, k) => (
                  <div key={k} className="flex gap-2">
                    <Input value={opt} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: x.options.map((o, m) => m === k ? e.target.value : o) } : x))} />
                    <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: x.options.filter((_, m) => m !== k) } : x))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((x, j) => j === i ? { ...x, options: [...x.options, ""] } : x))}><Plus className="h-4 w-4 mr-1" /> Option</Button>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-[11px] text-muted-foreground">Closes at</label>
                <Input className="w-56" type="datetime-local" value={r.closes_at ? new Date(r.closes_at).toISOString().slice(0, 16) : ""} onChange={(e) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, closes_at: e.target.value ? new Date(e.target.value).toISOString() : null } : x))} />
                <div className="flex items-center gap-2 text-[11px]"><Switch checked={r.is_active} onCheckedChange={(v) => setRows((rs) => rs.map((x, j) => j === i ? { ...x, is_active: v } : x))} /> Active</div>
              </div>
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

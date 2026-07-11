import { useEffect, useMemo, useState } from "react";
import { Star, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Student } from "@/lib/api";

const CRITERIA = ["batting", "bowling", "fielding", "fitness", "temperament"] as const;
type Criterion = (typeof CRITERIA)[number];

const Stars = ({
  value,
  editable,
  onChange,
}: {
  value: number;
  editable?: boolean;
  onChange?: (v: number) => void;
}) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => {
      const filled = i < Math.round(value);
      return (
        <button
          key={i}
          type="button"
          disabled={!editable}
          onClick={() => onChange?.(i + 1)}
          className={cn(!editable && "pointer-events-none")}
        >
          <Star className={cn("h-3.5 w-3.5", filled ? "text-amber-400 fill-amber-400" : "text-muted")} />
        </button>
      );
    })}
  </div>
);

const Performance = () => {
  const { batches, students, initialsOf, initialsColor, api, refresh, loading } = useAcademy();
  const [batchId, setBatchId] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Student | null>(null);
  const [scores, setScores] = useState({ batting: 3, bowling: 3, fielding: 3, fitness: 3, temperament: 3 });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!batchId && batches[0]?.id) setBatchId(batches[0].id);
  }, [batches, batchId]);

  const list = useMemo(() => students.filter((s) => s.batchId === batchId), [batchId, students]);
  const preview = students.find((s) => s.id === previewId);

  const openEdit = (s: Student) => {
    setEditing(s);
    setScores({ ...s.scores });
  };

  const saveScores = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.updateStudent(editing.id, { scores } as Partial<Student>);
      toast.success(`Updated scores for ${editing.name}`);
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const radarData = preview
    ? CRITERIA.map((k) => ({
        skill: k.charAt(0).toUpperCase() + k.slice(1),
        value: preview.scores[k],
      }))
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance Tracking"
        description="Edit cricket assessment scores — saved to the database."
        actions={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!list[0]}
            onClick={() => setPreviewId(list[0]?.id ?? null)}
          >
            <FileText className="h-4 w-4 mr-1.5" /> View Progress Card
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4">
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder={loading ? "Loading…" : "Select batch"} /></SelectTrigger>
          <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Student</th>
              <th className="text-left px-3 py-3 font-medium">Batting</th>
              <th className="text-left px-3 py-3 font-medium">Bowling</th>
              <th className="text-left px-3 py-3 font-medium">Fielding</th>
              <th className="text-left px-3 py-3 font-medium">Fitness</th>
              <th className="text-left px-3 py-3 font-medium">Temperament</th>
              <th className="text-left px-3 py-3 font-medium">Overall</th>
              <th className="text-right px-3 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No students in this batch.</td></tr>
            ) : (
              list.map((s) => {
                const overall = ((s.scores.batting + s.scores.bowling + s.scores.fielding + s.scores.fitness + s.scores.temperament) / 5).toFixed(1);
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Stars value={s.scores.batting} /></td>
                    <td className="px-3 py-3"><Stars value={s.scores.bowling} /></td>
                    <td className="px-3 py-3"><Stars value={s.scores.fielding} /></td>
                    <td className="px-3 py-3"><Stars value={s.scores.fitness} /></td>
                    <td className="px-3 py-3"><Stars value={s.scores.temperament} /></td>
                    <td className="px-3 py-3 font-semibold text-primary">{overall}</td>
                    <td className="px-3 py-3 text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => setPreviewId(s.id)}>Card</Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit scores — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {CRITERIA.map((k) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm capitalize">{k}</span>
                <Stars
                  value={scores[k]}
                  editable
                  onChange={(v) => setScores((s) => ({ ...s, [k]: v }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void saveScores()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save scores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.name} — Progress card</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="skill" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Performance;

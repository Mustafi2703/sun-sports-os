import { useMemo, useState } from "react";
import { Star, FileText, Gauge, TrendingUp, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const Stars = ({ value }: { value: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(value) ? "text-amber-400 fill-amber-400" : "text-muted")} />
    ))}
  </div>
);

const Performance = () => {
  const { batches, students, initialsOf, initialsColor } = useAcademy();
  const [batchId, setBatchId] = useState(batches[0].id);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const list = useMemo(() => students.filter(s => s.batchId === batchId), [batchId]);
  const bowlers = useMemo(() => students.filter(s => s.lastBowlingSpeed).slice(0, 6), []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Performance Tracking"
        description="Cricket-specific assessments per athlete."
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPreviewId(list[0]?.id ?? null)}>
            <FileText className="h-4 w-4 mr-1.5" /> Generate Progress Cards
          </Button>
        }
      />

      <div className="rounded-2xl border border-border bg-card p-4">
        <Select value={batchId} onValueChange={setBatchId}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
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
            {list.map(s => {
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
                  <td className="px-3 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setPreviewId(s.id)}>View Card</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold">Bowling Speed Tracker</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Bowler</th>
                <th className="text-left px-4 py-3 font-medium">Reading 1</th>
                <th className="text-left px-4 py-3 font-medium">Reading 2</th>
                <th className="text-left px-4 py-3 font-medium">Reading 3</th>
                <th className="text-left px-4 py-3 font-medium">Reading 4</th>
                <th className="text-left px-4 py-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bowlers.map(s => {
                const speeds = s.lastBowlingSpeed!;
                const improving = speeds[3] > speeds[0];
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    {speeds.map((sp, i) => <td key={i} className="px-4 py-3">{sp} kph</td>)}
                    <td className="px-4 py-3">
                      {improving
                        ? <span className="inline-flex items-center gap-1 text-primary"><TrendingUp className="h-4 w-4" /> Improving</span>
                        : <span className="inline-flex items-center gap-1 text-destructive"><TrendingDown className="h-4 w-4" /> Declining</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProgressCardDialog studentId={previewId} onClose={() => setPreviewId(null)} />
    </div>
  );
};

const ProgressCardDialog = ({ studentId, onClose }: { studentId: string | null; onClose: () => void }) => {
  const s = studentId ? students.find(x => x.id === studentId) : null;
  if (!s) return null;
  const data = [
    { skill: "Batting", value: s.scores.batting },
    { skill: "Bowling", value: s.scores.bowling },
    { skill: "Fielding", value: s.scores.fielding },
    { skill: "Fitness", value: s.scores.fitness },
    { skill: "Temper.", value: s.scores.temperament },
  ];
  return (
    <Dialog open={!!studentId} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Progress Card — {s.name}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 p-5">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Radar name={s.name} dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline">Download PDF</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Share via WhatsApp</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Performance;
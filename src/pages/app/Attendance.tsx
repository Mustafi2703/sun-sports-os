import { useMemo, useState } from "react";
import { Calendar, Check, X, Clock, MessageCircle, Save } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { batches, students, getBatch, attendanceByBatch, initialsOf, initialsColor } from "@/data/academy";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mark = "present" | "absent" | "late";

const Attendance = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [batchId, setBatchId] = useState(batches[0].id);
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const batchStudents = useMemo(() => students.filter(s => s.batchId === batchId), [batchId]);

  const set = (id: string, mark: Mark) => setMarks(prev => ({ ...prev, [id]: mark }));

  const markAllPresent = () => {
    const next: Record<string, Mark> = {};
    batchStudents.forEach(s => { next[s.id] = "present"; });
    setMarks(next);
    toast.success(`All ${batchStudents.length} students marked present`);
  };

  const atRisk = students.filter(s => s.attendancePct < 70).slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" description="Mark today's attendance in seconds." />

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm" />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1.5 block">Batch</label>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={markAllPresent} variant="outline">
          <Check className="h-4 w-4 mr-1.5" /> Mark All Present
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => toast.success("Attendance saved")}>
          <Save className="h-4 w-4 mr-1.5" /> Save
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold">{getBatch(batchId)?.name} — {batchStudents.length} students</h3>
        </div>
        <div className="divide-y divide-border max-h-[480px] overflow-y-auto scrollbar-thin">
          {batchStudents.map(s => {
            const m = marks[s.id];
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">Att: {s.attendancePct}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <MarkBtn active={m === "present"} tone="success" onClick={() => set(s.id, "present")}><Check className="h-3.5 w-3.5" /></MarkBtn>
                  <MarkBtn active={m === "late"} tone="warning" onClick={() => set(s.id, "late")}><Clock className="h-3.5 w-3.5" /></MarkBtn>
                  <MarkBtn active={m === "absent"} tone="danger" onClick={() => set(s.id, "absent")}><X className="h-3.5 w-3.5" /></MarkBtn>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4">Attendance % by batch (last 4 weeks)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceByBatch}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="batch" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="w1" name="Week 1" fill="hsl(var(--primary) / 0.4)" radius={4} />
                <Bar dataKey="w2" name="Week 2" fill="hsl(var(--primary) / 0.6)" radius={4} />
                <Bar dataKey="w3" name="Week 3" fill="hsl(var(--primary) / 0.8)" radius={4} />
                <Bar dataKey="w4" name="Week 4" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="font-display font-semibold mb-1">At-risk students</h3>
          <p className="text-xs text-muted-foreground mb-4">Below 70% attendance this month</p>
          <div className="space-y-2">
            {atRisk.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-destructive">{s.attendancePct}% attendance</p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-primary"><MessageCircle className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MarkBtn = ({ active, tone, children, onClick }: { active: boolean; tone: "success" | "warning" | "danger"; children: React.ReactNode; onClick: () => void }) => {
  const styles = {
    success: active ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-primary",
    warning: active ? "bg-amber-500 text-background" : "border border-border text-muted-foreground hover:text-amber-400",
    danger: active ? "bg-destructive text-destructive-foreground" : "border border-border text-muted-foreground hover:text-destructive",
  }[tone];
  return <button onClick={onClick} className={cn("h-8 w-8 rounded-md flex items-center justify-center transition-colors", styles)}>{children}</button>;
};

export default Attendance;
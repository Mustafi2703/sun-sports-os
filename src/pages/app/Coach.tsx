import { useMemo, useState } from "react";
import { Award, Calendar, Users, FileText } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademy } from "@/context/AcademyContext";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const trendData = [
  { week: "W1", attendance: 82 },
  { week: "W2", attendance: 85 },
  { week: "W3", attendance: 88 },
  { week: "W4", attendance: 92 },
];

const Coach = () => {
  const { coaches, batches, students, initialsOf, initialsColor } = useAcademy();
  const [coachId, setCoachId] = useState(coaches[0].id);
  const coach = coaches.find(c => c.id === coachId)!;
  const myBatches = useMemo(() => batches.filter(b => b.coachId === coachId), [coachId]);
  const myStudents = useMemo(() => students.filter(s => myBatches.some(b => b.id === s.batchId)), [myBatches]);

  return (
    <div className="space-y-5">
      <PageHeader title="Coach Dashboard" description="What each coach sees when they log in." />

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Select value={coachId} onValueChange={setCoachId}>
          <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-3 ml-auto">
          <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">{coach.initials}</div>
          <div>
            <p className="font-medium text-sm">{coach.name}</p>
            <p className="text-xs text-muted-foreground">{coach.specialty}</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">My batches</div>
          <p className="mt-1 font-display text-2xl font-bold">{myBatches.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">My students</div>
          <p className="mt-1 font-display text-2xl font-bold">{myStudents.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">Avg attendance</div>
          <p className="mt-1 font-display text-2xl font-bold text-primary">89%</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Today's batches</h3>
          </div>
          <div className="divide-y divide-border">
            {myBatches.map(b => (
              <div key={b.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.time} • {b.venue}</p>
                </div>
                <Badge variant="outline">{b.studentCount} students</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-3">Attendance trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[60, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">My students</h3></div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
            {myStudents.slice(0, 12).map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Att {s.attendancePct}%</p>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-primary">Mark</Button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Pending assessments</h3></div>
          <div className="p-5 space-y-3">
            {myStudents.slice(0, 4).map(s => (
              <div key={s.id} className="rounded-lg border border-border bg-muted/20 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">Monthly assessment due</p>
                </div>
                <Button size="sm" variant="outline">Assess</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coach;
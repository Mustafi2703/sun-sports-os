import { useEffect, useMemo, useState } from "react";
import { Calendar, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/app/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademy } from "@/context/AcademyContext";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Coach = () => {
  const { coaches, batches, students, initialsOf, initialsColor, attendanceByBatch, loading } = useAcademy();
  const [coachId, setCoachId] = useState("");

  useEffect(() => {
    if (!coachId && coaches[0]?.id) setCoachId(coaches[0].id);
  }, [coaches, coachId]);

  const coach = coaches.find((c) => c.id === coachId);
  const myBatches = useMemo(() => batches.filter((b) => b.coachId === coachId), [coachId, batches]);
  const myStudents = useMemo(
    () => students.filter((s) => myBatches.some((b) => b.id === s.batchId)),
    [myBatches, students]
  );
  const avgAtt = myStudents.length
    ? Math.round(myStudents.reduce((a, s) => a + s.attendancePct, 0) / myStudents.length)
    : 0;

  const trendData = useMemo(() => {
    const rows = attendanceByBatch.filter((b) => myBatches.some((mb) => mb.name === b.batch));
    if (!rows.length) return [
      { week: "W1", attendance: 0 },
      { week: "W2", attendance: 0 },
      { week: "W3", attendance: 0 },
      { week: "W4", attendance: 0 },
    ];
    const avg = (key: "w1" | "w2" | "w3" | "w4") =>
      Math.round(rows.reduce((a, r) => a + r[key], 0) / rows.length);
    return [
      { week: "W1", attendance: avg("w1") },
      { week: "W2", attendance: avg("w2") },
      { week: "W3", attendance: avg("w3") },
      { week: "W4", attendance: avg("w4") },
    ];
  }, [attendanceByBatch, myBatches]);

  return (
    <div className="space-y-5">
      <PageHeader title="Coach Dashboard" description="Batches and students assigned to each coach." />

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Select value={coachId} onValueChange={setCoachId}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder={loading ? "Loading…" : "Select coach"} /></SelectTrigger>
          <SelectContent>{coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        {coach && (
          <div className="flex items-center gap-3 ml-auto">
            <div className="h-10 w-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">{coach.initials}</div>
            <div>
              <p className="font-medium text-sm">{coach.name}</p>
              <p className="text-xs text-muted-foreground">{coach.specialty}</p>
            </div>
          </div>
        )}
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
          <p className="mt-1 font-display text-2xl font-bold text-primary">{avgAtt || "—"}{avgAtt ? "%" : ""}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">My batches</h3>
            </div>
            <Link to="/app/attendance">
              <Button size="sm" className="bg-primary text-primary-foreground">Mark attendance</Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {myBatches.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No batches assigned to this coach.</p>
            ) : (
              myBatches.map((b) => (
                <div key={b.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.time} • {b.venue}</p>
                  </div>
                  <Badge variant="outline">{b.studentCount} students</Badge>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-3">Attendance trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">My students</h3>
        </div>
        <div className="divide-y divide-border max-h-80 overflow-y-auto">
          {myStudents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No students in assigned batches.</p>
          ) : (
            myStudents.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.role || "Player"} · {s.parentPhone}</p>
                  </div>
                </div>
                <span className={cn("text-xs font-medium", s.attendancePct < 70 && s.attendancePct > 0 ? "text-destructive" : "text-primary")}>
                  {s.attendancePct > 0 ? `${s.attendancePct}%` : "—"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Coach;

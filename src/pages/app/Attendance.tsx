import { useEffect, useMemo, useState } from "react";
import { Calendar, Check, MessageCircle, Save } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { AttendanceStatusPicker, WeekendOffNotice } from "@/components/app/AttendanceStatusPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademy } from "@/context/AcademyContext";
import { isHistoricalStatus, isMarkableStatus, isWeekend, weekdayName, type MarkableStatus } from "@/lib/academyDays";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Mark = "present" | "absent" | "late" | "leave" | "no_session";

const Attendance = () => {
  const { batches, students, getBatch, attendanceByBatch, initialsOf, initialsColor, api, refresh } = useAcademy();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [batchId, setBatchId] = useState("");
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [notesByStudent, setNotesByStudent] = useState<Record<string, string>>({});
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [closures, setClosures] = useState<{ id: string; date: string; title: string; reason: string; type: string }[]>([]);
  const [closureForm, setClosureForm] = useState({ date: today, title: "", reason: "", type: "holiday" });
  const [closureBusy, setClosureBusy] = useState(false);

  useEffect(() => {
    void api.listClosures().then(setClosures).catch(() => setClosures([]));
  }, [api]);

  useEffect(() => {
    if (!batchId && batches[0]?.id) setBatchId(batches[0].id);
  }, [batches, batchId]);

  // Load real marks for selected date + batch from API
  useEffect(() => {
    if (!date) return;
    setLoadingMarks(true);
    void api
      .listAttendance({ date, ...(batchId ? { batchId } : {}) })
      .then((rows) => {
        const next: Record<string, Mark> = {};
        const notes: Record<string, string> = {};
        for (const r of rows) {
          if (r.status === "present" || r.status === "absent" || r.status === "late" || r.status === "leave" || r.status === "no_session") {
            next[r.studentId] = r.status;
            if (r.note) notes[r.studentId] = r.note;
          }
        }
        setMarks(next);
        setNotesByStudent(notes);
      })
      .catch(() => {
        setMarks({});
        setNotesByStudent({});
      })
      .finally(() => setLoadingMarks(false));
  }, [date, batchId, api]);

  const batchStudents = useMemo(() => students.filter((s) => s.batchId === batchId), [batchId, students]);

  const weekend = isWeekend(date);

  const set = (id: string, mark: MarkableStatus) => {
    setMarks((prev) => {
      if (isHistoricalStatus(prev[id])) return prev;
      return { ...prev, [id]: mark };
    });
  };

  const markAllPresent = () => {
    if (weekend) return;
    setMarks((prev) => {
      const next = { ...prev };
      batchStudents.forEach((s) => {
        if (isHistoricalStatus(next[s.id])) return;
        next[s.id] = "present";
      });
      return next;
    });
    toast.success("Weekday roster marked present. Saved leave and late marks were left as they are.");
  };

  const saveAttendance = async () => {
    if (weekend) {
      toast.error("No session on Saturday or Sunday.");
      return;
    }
    const payload = Object.entries(marks)
      .filter(([, status]) => isMarkableStatus(status))
      .map(([studentId, status]) => ({
        studentId,
        status,
        note: notesByStudent[studentId] || undefined,
      }));
    if (!payload.length) {
      toast.error("Mark at least one student");
      return;
    }
    try {
      await api.saveAttendance({ date, batchId, marks: payload });
      toast.success(`Saved attendance for ${payload.length} students`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const atRisk = students.filter((s) => s.attendancePct > 0 && s.attendancePct < 70).slice(0, 8);
  const hasChartData = attendanceByBatch.some((b) => b.w1 || b.w2 || b.w3 || b.w4);

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" description="Mark weekday sessions. Saturday and Sunday are off for every batch. Saved leave and late marks stay on record, and academy holidays still show on calendars." />

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <h3 className="font-display font-semibold">Academy holidays / no-session days</h3>
        <p className="text-xs text-muted-foreground">Shown on parent & coach calendars for holiday understanding.</p>
        <div className="grid sm:grid-cols-4 gap-2">
          <input type="date" value={closureForm.date} onChange={(e) => setClosureForm((f) => ({ ...f, date: e.target.value }))} className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
          <Input placeholder="Title" value={closureForm.title} onChange={(e) => setClosureForm((f) => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Reason for parents" value={closureForm.reason} onChange={(e) => setClosureForm((f) => ({ ...f, reason: e.target.value }))} />
          <Button
            className="bg-primary text-primary-foreground"
            disabled={closureBusy || !closureForm.title.trim()}
            onClick={async () => {
              setClosureBusy(true);
              try {
                await api.createClosure({ ...closureForm, title: closureForm.title.trim(), reason: closureForm.reason || undefined, scope: "academy" });
                toast.success("No-session day published");
                setClosureForm((f) => ({ ...f, title: "", reason: "" }));
                setClosures(await api.listClosures());
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              } finally {
                setClosureBusy(false);
              }
            }}
          >
            Publish
          </Button>
        </div>
        {closures.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {closures.slice(0, 12).map((c) => (
              <Badge key={c.id} variant="outline" className="gap-2">
                {c.date}: {c.title}
                <button
                  type="button"
                  className="text-destructive"
                  onClick={async () => {
                    await api.deleteClosure(c.id);
                    setClosures(await api.listClosures());
                  }}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-md border border-border bg-background text-sm" />
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1.5 block">Batch</label>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
            <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={markAllPresent} variant="outline" disabled={weekend || !batchStudents.length}>
          <Check className="h-4 w-4 mr-1.5" /> Mark All Present
        </Button>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={weekend} onClick={() => void saveAttendance()}>
          <Save className="h-4 w-4 mr-1.5" /> Save
        </Button>
      </div>

      {weekend ? <WeekendOffNotice date={date} weekday={weekdayName(date)} /> : null}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-display font-semibold">
            {getBatch(batchId)?.name ?? "Batch"} — {batchStudents.length} students
            {loadingMarks ? <span className="text-xs text-muted-foreground font-normal ml-2">Loading saved marks…</span> : null}
          </h3>
        </div>
        <div className="divide-y divide-border md:max-h-[480px] md:overflow-y-auto scrollbar-thin">
          {batchStudents.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No students in this batch.</p>
          ) : (
            batchStudents.map((s) => {
              const m = marks[s.id];
              return (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.attendancePct > 0 ? `Att: ${s.attendancePct}%` : "No sessions marked yet"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch sm:items-end gap-1.5">
                    <AttendanceStatusPicker variant="icons" value={m} locked={weekend} onChange={(status) => set(s.id, status)} />
                    {(weekend || isHistoricalStatus(m)) && notesByStudent[s.id] ? (
                      <p className="text-[11px] text-muted-foreground max-w-xs sm:text-right">{notesByStudent[s.id]}</p>
                    ) : null}
                    {!weekend && m === "no_session" ? (
                      <Input
                        className="h-8 text-xs sm:w-64"
                        placeholder="Note for parents"
                        value={notesByStudent[s.id] || ""}
                        onChange={(e) => setNotesByStudent((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-4">Attendance % by batch (last 4 weeks)</h3>
          {!hasChartData ? (
            <p className="text-sm text-muted-foreground h-64 flex items-center justify-center border border-dashed border-border rounded-xl">
              No attendance history yet — save session marks to populate this chart.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByBatch}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="batch" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="w1" name="Week 1" fill="hsl(var(--primary) / 0.4)" radius={4} />
                  <Bar dataKey="w2" name="Week 2" fill="hsl(var(--primary) / 0.6)" radius={4} />
                  <Bar dataKey="w3" name="Week 3" fill="hsl(var(--primary) / 0.8)" radius={4} />
                  <Bar dataKey="w4" name="Week 4" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <h3 className="font-display font-semibold mb-1">At-risk students</h3>
          <p className="text-xs text-muted-foreground mb-4">Below 70% from recorded sessions</p>
          {atRisk.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet — needs marked attendance history.</p>
          ) : (
            <div className="space-y-2">
              {atRisk.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-destructive">{s.attendancePct}% attendance</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-primary"
                    onClick={() => {
                      const phone = (s.parentPhone || "").replace(/\D/g, "").slice(-10);
                      if (phone.length < 10) {
                        toast.error("No parent WhatsApp on this student");
                        return;
                      }
                      const text = `Hi, this is Sun Sports. ${s.name}'s attendance is currently ${s.attendancePct}%. Please ensure regular sessions.`;
                      window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;

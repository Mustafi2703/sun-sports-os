import { useEffect, useMemo, useState } from "react";
import {
  Calendar, Users, CreditCard, Award, Home, AlertTriangle, TrendingUp, Trophy,
  CalendarCheck, ArrowRight, Layers,
} from "lucide-react";
import { PortalShell } from "@/components/portals/PortalShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  api,
  initialsColor,
  initialsOf,
  inr,
  type AttendanceMark,
  type CoachPortalData,
  type Student,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

const MARKS: { value: AttendanceMark; label: string }[] = [
  { value: "present", label: "P" },
  { value: "late", label: "L" },
  { value: "absent", label: "A" },
];

export default function CoachHome() {
  const [data, setData] = useState<CoachPortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({});
  const [saving, setSaving] = useState(false);
  const [studentFilter, setStudentFilter] = useState<"all" | "overdue" | "lowatt">("all");
  const [assessId, setAssessId] = useState("");
  const [scoreDraft, setScoreDraft] = useState({ batting: 3, bowling: 3, fielding: 3, fitness: 3, temperament: 3 });
  const [noteText, setNoteText] = useState("");
  const [assessBusy, setAssessBusy] = useState(false);

  const refresh = async () => {
    const d = await api.coachPortal();
    setData(d);
    if (!batchId && d.batches[0]) setBatchId(d.batches[0].id);
    return d;
  };

  useEffect(() => {
    void refresh()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batches = data?.batches ?? [];
  const students = data?.students ?? [];
  const tournaments = data?.tournaments ?? [];
  const notes = data?.notes ?? [];
  const activeBatch = batchId || batches[0]?.id || "";
  const batchStudents = useMemo(
    () => students.filter((s) => s.batchId === activeBatch),
    [students, activeBatch]
  );
  const assessStudent = students.find((s) => s.id === assessId) ?? students[0];

  useEffect(() => {
    if (!assessStudent) return;
    setAssessId(assessStudent.id);
    setScoreDraft({ ...assessStudent.scores });
  }, [assessStudent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const overdue = students.filter((s) => s.feeStatus !== "paid");
  const lowAtt = students.filter((s) => s.attendancePct > 0 && s.attendancePct < 70);
  const avgAtt = students.length
    ? Math.round(students.reduce((a, s) => a + s.attendancePct, 0) / students.length)
    : 0;
  const overdueAmount = overdue.reduce((a, s) => a + s.feeAmount, 0);

  const filteredStudents = useMemo(() => {
    if (studentFilter === "overdue") return overdue;
    if (studentFilter === "lowatt") return lowAtt;
    return students;
  }, [studentFilter, students, overdue, lowAtt]);

  const trendData = useMemo(() => {
    const rows = data?.attendanceByBatch ?? [];
    if (!rows.length) {
      return [
        { week: "W1", attendance: 0 },
        { week: "W2", attendance: 0 },
        { week: "W3", attendance: 0 },
        { week: "W4", attendance: 0 },
      ];
    }
    const avg = (key: "w1" | "w2" | "w3" | "w4") =>
      Math.round(rows.reduce((a, r) => a + r[key], 0) / rows.length);
    return [
      { week: "W1", attendance: avg("w1") },
      { week: "W2", attendance: avg("w2") },
      { week: "W3", attendance: avg("w3") },
      { week: "W4", attendance: avg("w4") },
    ];
  }, [data]);

  const saveScores = async () => {
    if (!assessStudent) return;
    setAssessBusy(true);
    try {
      await api.coachUpdateScores(assessStudent.id, scoreDraft);
      toast.success(`Scores updated for ${assessStudent.name} — parents see this on Performance`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Score update failed");
    } finally {
      setAssessBusy(false);
    }
  };

  const saveNote = async () => {
    if (!assessStudent || !noteText.trim()) {
      toast.error("Enter a note");
      return;
    }
    setAssessBusy(true);
    try {
      await api.coachAddNote({ studentId: assessStudent.id, note: noteText.trim() });
      toast.success("Note saved");
      setNoteText("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Note failed");
    } finally {
      setAssessBusy(false);
    }
  };

  const saveAttendance = async () => {
    const payload = batchStudents
      .map((s) => ({ studentId: s.id, status: marks[s.id] }))
      .filter((m): m is { studentId: string; status: AttendanceMark } => !!m.status && m.status !== "none");
    if (!payload.length) {
      toast.error("Mark at least one student");
      return;
    }
    setSaving(true);
    try {
      await api.coachSaveAttendance({ date, batchId: activeBatch, marks: payload });
      toast.success(`Saved ${payload.length} marks`);
      setMarks({});
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "home", label: "Dashboard", shortLabel: "Home", icon: <Home className="h-4 w-4" /> },
    { id: "students", label: "Players", shortLabel: "Players", icon: <Users className="h-4 w-4" /> },
    { id: "attendance", label: "Attendance", shortLabel: "Attend.", icon: <Calendar className="h-4 w-4" /> },
    { id: "fees", label: "Fee Status", shortLabel: "Fees", icon: <CreditCard className="h-4 w-4" /> },
    { id: "assess", label: "Assessments", shortLabel: "Assess", icon: <Award className="h-4 w-4" /> },
  ];

  return (
    <PortalShell
      title="Coach Dashboard"
      subtitle="Sun Sports"
      roleLabel="Coach"
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
    >
      {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading coach dashboard…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <div className="space-y-6">
          {tab === "home" && (
            <div className="space-y-6">
              <PageHeader
                title="Welcome back"
                description={`Here's what's happening across your batches, ${data.coach.name.split(" ")[0]}.`}
                actions={
                  <Button className="bg-primary text-primary-foreground" onClick={() => setTab("attendance")}>
                    <CalendarCheck className="h-4 w-4 mr-2" /> Mark attendance
                  </Button>
                }
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Batches" value={String(batches.length)} icon={<Layers className="h-4 w-4" />} />
                <StatCard label="Players" value={String(students.length)} icon={<Users className="h-4 w-4" />} />
                <StatCard
                  label="Avg attendance"
                  value={avgAtt ? `${avgAtt}%` : "—"}
                  icon={<CalendarCheck className="h-4 w-4" />}
                  tone={avgAtt > 0 && avgAtt < 70 ? "warning" : "success"}
                />
                <StatCard
                  label="Overdue fees"
                  value={String(overdue.length)}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  hint={overdue.length ? inr(overdueAmount) : "All clear"}
                  tone={overdue.length ? "danger" : "success"}
                />
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <AlertCard
                  tone={overdue.length ? "danger" : "info"}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title={overdue.length ? `${overdue.length} player(s) with overdue fees` : "No fee alerts"}
                  desc={overdue.length ? `${inr(overdueAmount)} pending across your batches.` : "All players paid up."}
                  cta="Review fees"
                  onClick={() => { setStudentFilter("overdue"); setTab("fees"); }}
                />
                <AlertCard
                  tone={lowAtt.length ? "warning" : "info"}
                  icon={<TrendingUp className="h-4 w-4" />}
                  title={lowAtt.length ? `${lowAtt.length} below 70% attendance` : "Attendance healthy"}
                  desc="Based on recorded sessions in your batches."
                  cta="View players"
                  onClick={() => { setStudentFilter("lowatt"); setTab("students"); }}
                />
                <AlertCard
                  tone="info"
                  icon={<Award className="h-4 w-4" />}
                  title="Update assessments"
                  desc="Edit monthly batting, bowling, fielding scores."
                  cta="Assessments"
                  onClick={() => setTab("assess")}
                />
              </div>

              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-5">
                  <div className="mb-4">
                    <h3 className="font-display font-semibold">Attendance trend</h3>
                    <p className="text-xs text-muted-foreground">Your batches — last 4 weeks</p>
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={28} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-semibold">Your batches</h3>
                      <p className="text-xs text-muted-foreground">{students.length} players assigned</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-primary" onClick={() => setTab("attendance")}>
                      Mark <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                  <div className="divide-y divide-border">
                    {batches.length === 0 ? (
                      <p className="px-5 py-6 text-sm text-muted-foreground">No batches assigned yet.</p>
                    ) : (
                      batches.map((b) => (
                        <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{b.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{b.time} · {b.venue}</p>
                          </div>
                          <Badge variant="outline">{b.studentCount}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {tournaments.length > 0 && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="p-5 border-b border-border flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <h3 className="font-display font-semibold">Tournaments</h3>
                  </div>
                  <div className="divide-y divide-border sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
                    {tournaments.slice(0, 3).map((t) => (
                      <div key={t.id} className="px-5 py-4 border-b border-border sm:border-b-0 sm:border-r last:border-0">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.format} · {t.startDate} → {t.endDate}
                        </p>
                        <Badge variant="outline" className="mt-2 text-[10px] capitalize">{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "students" && (
            <div className="space-y-6">
              <PageHeader title="Players" description="Students in your assigned batches." />
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {([
                  ["all", `All (${students.length})`],
                  ["overdue", `Fees due (${overdue.length})`],
                  ["lowatt", `Low att. (${lowAtt.length})`],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStudentFilter(id)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-lg text-xs border",
                      studentFilter === id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="divide-y divide-border">
                  {filteredStudents.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-muted-foreground text-center">No players in this filter.</p>
                  ) : (
                    filteredStudents.map((s) => <StudentRow key={s.id} s={s} batches={batches} />)
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "attendance" && (
            <div className="space-y-6">
              <PageHeader
                title="Attendance"
                description="Mark present, late, or absent for today's session."
                actions={
                  <Button
                    className="bg-primary text-primary-foreground"
                    disabled={saving || !batchStudents.length}
                    onClick={() => void saveAttendance()}
                  >
                    {saving ? "Saving…" : "Save attendance"}
                  </Button>
                }
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Batch</label>
                  <Select value={activeBatch} onValueChange={setBatchId}>
                    <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
                    <SelectContent>
                      {batches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Date</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h3 className="font-display font-semibold">Roster</h3>
                  <p className="text-xs text-muted-foreground">{batchStudents.length} students</p>
                </div>
                <div className="divide-y divide-border">
                  {batchStudents.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-muted-foreground text-center">No students in this batch.</p>
                  ) : (
                    batchStudents.map((s) => (
                      <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0", initialsColor(s.name))}>
                            {initialsOf(s.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{s.role || "Player"}</p>
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {MARKS.map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => setMarks((prev) => ({ ...prev, [s.id]: m.value }))}
                              className={cn(
                                "h-9 w-9 rounded-lg text-xs font-semibold border",
                                marks[s.id] === m.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:bg-muted/30"
                              )}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "fees" && (
            <div className="space-y-6">
              <PageHeader title="Fee Status" description="Fee overview for players in your batches." />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Overdue players" value={String(overdue.length)} icon={<AlertTriangle className="h-4 w-4" />} tone={overdue.length ? "danger" : "success"} />
                <StatCard label="Amount pending" value={inr(overdueAmount)} icon={<CreditCard className="h-4 w-4" />} tone={overdueAmount ? "danger" : "success"} />
                <StatCard label="Total players" value={String(students.length)} icon={<Users className="h-4 w-4" />} />
                <StatCard label="Paid up" value={String(students.length - overdue.length)} icon={<CalendarCheck className="h-4 w-4" />} tone="success" />
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h3 className="font-display font-semibold">Fee status by player</h3>
                </div>
                <div className="divide-y divide-border">
                  {(overdue.length ? overdue : students).map((s) => (
                    <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Parent: {s.parentPhone || "—"}
                          {s.daysOverdue ? ` · ${s.daysOverdue}d overdue` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{inr(s.feeAmount)}</p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            s.feeStatus === "paid" && "text-primary border-primary/30",
                            s.feeStatus !== "paid" && "text-destructive border-destructive/30"
                          )}
                        >
                          {s.feeStatus === "paid" ? "Paid" : "Overdue"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "assess" && (
            <div className="space-y-6">
              <PageHeader title="Assessments" description="Update monthly performance scores and coach notes." />
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No players in your batches yet.</p>
              ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Player</label>
                      <Select
                        value={assessStudent?.id || ""}
                        onValueChange={(id) => {
                          setAssessId(id);
                          const s = students.find((x) => x.id === id);
                          if (s) setScoreDraft({ ...s.scores });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
                        <SelectContent>
                          {students.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                      <h3 className="font-display font-semibold">Monthly assessment (1–5)</h3>
                      {(
                        [
                          ["batting", "Batting"],
                          ["bowling", "Bowling"],
                          ["fielding", "Fielding"],
                          ["fitness", "Fitness"],
                          ["temperament", "Temperament"],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between gap-3">
                          <span className="text-sm">{label}</span>
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            step={0.5}
                            className="w-20 h-9"
                            value={scoreDraft[key]}
                            onChange={(e) =>
                              setScoreDraft((d) => ({
                                ...d,
                                [key]: Math.min(5, Math.max(1, Number(e.target.value) || 1)),
                              }))
                            }
                          />
                        </div>
                      ))}
                      <Button
                        className="w-full bg-primary text-primary-foreground"
                        disabled={assessBusy || !assessStudent}
                        onClick={() => void saveScores()}
                      >
                        {assessBusy ? "Saving…" : "Save scores"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-display font-semibold">Coach note</h3>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder={`Note about ${assessStudent?.name || "player"}…`}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    <Button variant="outline" className="w-full" disabled={assessBusy} onClick={() => void saveNote()}>
                      Add note
                    </Button>
                    <div className="divide-y divide-border max-h-56 overflow-y-auto">
                      {notes
                        .filter((n) => n.studentId === assessStudent?.id)
                        .slice(0, 8)
                        .map((n) => (
                          <div key={n.id} className="py-3">
                            <p className="text-xs text-muted-foreground">
                              {n.author || "Coach"} · {new Date(n.createdAt).toLocaleDateString("en-IN")}
                            </p>
                            <p className="text-sm mt-0.5">{n.note}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </PortalShell>
  );
}

function AlertCard({
  tone,
  icon,
  title,
  desc,
  cta,
  onClick,
}: {
  tone: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  const tones = {
    danger: "border-destructive/30 bg-destructive/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };
  return (
    <div className={cn("rounded-2xl border p-5 h-full", tones[tone])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3 h-8 text-xs" onClick={onClick}>
            {cta} <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudentRow({ s, batches }: { s: Student; batches: { id: string; name: string }[] }) {
  const batch = batches.find((b) => b.id === s.batchId);
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-2 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0", initialsColor(s.name))}>
          {initialsOf(s.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{s.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {batch?.name || "Unassigned"} · {s.role || "Player"}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p className={cn("text-sm font-medium", s.attendancePct > 0 && s.attendancePct < 70 ? "text-destructive" : "text-primary")}>
          {s.attendancePct > 0 ? `${s.attendancePct}%` : "—"}
        </p>
        {s.feeStatus !== "paid" && (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Fee due</Badge>
        )}
      </div>
    </div>
  );
}

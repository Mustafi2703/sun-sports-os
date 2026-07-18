import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, Calendar, CreditCard, MessageCircle, TrendingUp, User, Home, Phone, Trophy,
  AlertTriangle, CalendarCheck, Users, ArrowRight, StickyNote, Star,
} from "lucide-react";
import { PortalShell } from "@/components/portals/PortalShell";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api, initialsColor, initialsOf, inr, type ParentChild, type ParentPortalData, type TournamentSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const FEE_LABEL: Record<string, string> = {
  paid: "Paid up to date",
  overdue1: "Overdue (1–7 days)",
  overdue8: "Overdue (8+ days)",
};

type ParentNote = NonNullable<ParentChild["notes"]>[number];

type ParentNotification = {
  id: string;
  tone: "danger" | "warning" | "success" | "info";
  kind: "fee" | "attendance" | "score" | "note" | "info";
  title: string;
  desc: string;
  studentId?: string;
  studentName?: string;
  note?: ParentNote;
  scores?: ParentChild["scores"];
  scoresUpdatedAt?: string;
  time?: string;
};

function fmtWhen(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isRecent(iso?: string | null, days = 45) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < days * 86400000;
}

export default function ParentHome() {
  const { user } = useAuth();
  const [data, setData] = useState<ParentPortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tab, setTab] = useState("home");
  const [activeNote, setActiveNote] = useState<ParentNotification | null>(null);

  const loadPortal = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
    try {
      const d = await api.parentPortal();
      setData(d);
      setError("");
      setStudentId((prev) => {
        if (prev && d.children.some((c) => c.id === prev)) return prev;
        return d.children[0]?.id || "";
      });
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      throw e;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadPortal().catch(() => undefined);
  }, [loadPortal]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadPortal({ soft: true }).catch(() => undefined);
      }
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadPortal]);

  const onTabChange = (id: string) => {
    setTab(id);
    if (id === "progress" || id === "home" || id === "fees") {
      void loadPortal({ soft: true }).catch(() => undefined);
    }
  };

  const child = data?.children.find((c) => c.id === studentId) ?? data?.children[0];
  const overdueKids = useMemo(
    () => (data?.children ?? []).filter((c) => c.feeStatus !== "paid"),
    [data]
  );

  const notifications = useMemo(() => {
    const items: ParentNotification[] = [];
    for (const c of data?.children ?? []) {
      for (const n of c.notes ?? []) {
        items.push({
          id: `note-${n.id}`,
          tone: "info",
          kind: "note",
          title: `Coach note — ${c.name}`,
          desc: n.note.length > 100 ? `${n.note.slice(0, 100)}…` : n.note,
          studentId: c.id,
          studentName: c.name,
          note: n,
          time: n.createdAt,
        });
      }
      if (c.scoresUpdatedAt && isRecent(c.scoresUpdatedAt)) {
        const overall =
          (c.scores.batting + c.scores.bowling + c.scores.fielding + c.scores.fitness + c.scores.temperament) / 5;
        items.push({
          id: `score-${c.id}-${c.scoresUpdatedAt}`,
          tone: "success",
          kind: "score",
          title: `Performance updated — ${c.name}`,
          desc: `Overall ${overall.toFixed(1)}/5 · tap to view full scorecard`,
          studentId: c.id,
          studentName: c.name,
          scores: c.scores,
          scoresUpdatedAt: c.scoresUpdatedAt,
          time: c.scoresUpdatedAt,
        });
      }
      if (c.feeStatus === "overdue8") {
        items.push({
          id: `fee8-${c.id}`,
          tone: "danger",
          kind: "fee",
          title: `Fee overdue for ${c.name}`,
          desc: `${inr(c.feeAmount)} · ${c.daysOverdue} days late. Please clear dues soon.`,
          studentId: c.id,
          studentName: c.name,
        });
      } else if (c.feeStatus === "overdue1") {
        items.push({
          id: `fee1-${c.id}`,
          tone: "warning",
          kind: "fee",
          title: `Fee reminder — ${c.name}`,
          desc: `${inr(c.feeAmount)} pending · ${c.daysOverdue || "a few"} days overdue.`,
          studentId: c.id,
          studentName: c.name,
        });
      }
      if (c.attendancePct > 0 && c.attendancePct < 70) {
        items.push({
          id: `att-${c.id}`,
          tone: "warning",
          kind: "attendance",
          title: `Attendance low — ${c.name}`,
          desc: `Currently at ${c.attendancePct}%. Please ensure regular sessions.`,
          studentId: c.id,
          studentName: c.name,
        });
      }
    }
    items.sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return tb - ta;
    });
    if (!items.length && (data?.children.length ?? 0) > 0) {
      items.push({
        id: "clear",
        tone: "success",
        kind: "info",
        title: "All clear",
        desc: "Fees are up to date and no new coach updates right now.",
      });
    }
    return items;
  }, [data]);

  const dashboardNotes = useMemo(() => {
    const rows: { child: ParentChild; note: ParentNote }[] = [];
    for (const c of data?.children ?? []) {
      for (const n of (c.notes ?? []).slice(0, 3)) rows.push({ child: c, note: n });
    }
    return rows
      .sort((a, b) => new Date(b.note.createdAt).getTime() - new Date(a.note.createdAt).getTime())
      .slice(0, 5);
  }, [data]);

  const openNotification = (n: ParentNotification) => {
    if (n.studentId) setStudentId(n.studentId);
    if (n.kind === "note" || n.kind === "score") {
      setActiveNote(n);
      return;
    }
    if (n.kind === "fee") setTab("fees");
    else if (n.kind === "attendance") setTab("attendance");
  };

  const tabs = [
    { id: "home", label: "Dashboard", shortLabel: "Home", icon: <Home className="h-4 w-4" /> },
    { id: "fees", label: "Fee Management", shortLabel: "Fees", icon: <CreditCard className="h-4 w-4" /> },
    { id: "attendance", label: "Attendance", shortLabel: "Attend.", icon: <Calendar className="h-4 w-4" /> },
    { id: "progress", label: "Performance", shortLabel: "Progress", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "info", label: "Profile", shortLabel: "Profile", icon: <User className="h-4 w-4" /> },
  ];

  return (
    <PortalShell
      title="Parent Dashboard"
      subtitle="Sun Sports"
      roleLabel="Parent"
      tabs={tabs}
      activeTab={tab}
      onTabChange={onTabChange}
    >
      {loading && <p className="text-sm text-muted-foreground py-8 text-center">Loading your dashboard…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && data && data.children.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">
          No students linked to this phone yet. Contact the academy office.
        </div>
      )}

      {child && data && (
        <div className="space-y-6">
          {data.children.length > 1 && (
            <Select value={child.id} onValueChange={setStudentId}>
              <SelectTrigger className="w-full sm:max-w-xs bg-card">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {data.children.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.feeStatus !== "paid" ? " · Fee due" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {tab === "home" && (
            <HomeTab
              child={child}
              parentName={user?.name || data.parent.name}
              notifications={notifications}
              dashboardNotes={dashboardNotes}
              overdueCount={overdueKids.length}
              tournaments={data.tournaments ?? []}
              onPay={() => setTab("fees")}
              onAttendance={() => setTab("attendance")}
              onProgress={() => setTab("progress")}
              onMessage={() => toast.info("WhatsApp academy: +91 90330 02641")}
              onOpenNotification={openNotification}
              onOpenNote={(c, note) =>
                setActiveNote({
                  id: `note-${note.id}`,
                  tone: "info",
                  kind: "note",
                  title: `Coach note — ${c.name}`,
                  desc: note.note,
                  studentId: c.id,
                  studentName: c.name,
                  note,
                  time: note.createdAt,
                })
              }
              onOpenScores={(c) =>
                setActiveNote({
                  id: `score-${c.id}`,
                  tone: "success",
                  kind: "score",
                  title: `Performance — ${c.name}`,
                  desc: "Latest assessment scores from the coaching team.",
                  studentId: c.id,
                  studentName: c.name,
                  scores: c.scores,
                  scoresUpdatedAt: c.scoresUpdatedAt,
                  time: c.scoresUpdatedAt,
                })
              }
            />
          )}
          {tab === "fees" && <FeesTab child={child} />}
          {tab === "attendance" && <AttendanceTab child={child} />}
          {tab === "progress" && (
            <ProgressTab
              child={child}
              refreshing={refreshing}
              onRefresh={() =>
                void loadPortal({ soft: true })
                  .then(() => toast.success("Scores refreshed"))
                  .catch(() => toast.error("Refresh failed"))
              }
              onOpenNote={(note) =>
                setActiveNote({
                  id: `note-${note.id}`,
                  tone: "info",
                  kind: "note",
                  title: `Coach note — ${child.name}`,
                  desc: note.note,
                  studentId: child.id,
                  studentName: child.name,
                  note,
                  time: note.createdAt,
                })
              }
            />
          )}
          {tab === "info" && (
            <InfoTab child={child} parentName={data.parent.name} tournaments={data.tournaments ?? []} />
          )}
        </div>
      )}

      <UpdateDialog
        notification={activeNote}
        onClose={() => setActiveNote(null)}
        onGoPerformance={() => {
          setActiveNote(null);
          setTab("progress");
        }}
      />
    </PortalShell>
  );
}

function UpdateDialog({
  notification,
  onClose,
  onGoPerformance,
}: {
  notification: ParentNotification | null;
  onClose: () => void;
  onGoPerformance: () => void;
}) {
  const scores = notification?.scores;
  const rows = scores
    ? ([
        ["Batting", scores.batting],
        ["Bowling", scores.bowling],
        ["Fielding", scores.fielding],
        ["Fitness", scores.fitness],
        ["Temperament", scores.temperament],
      ] as const)
    : [];
  const overall = rows.length ? rows.reduce((a, [, v]) => a + Number(v), 0) / rows.length : 0;

  return (
    <Dialog open={!!notification} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display pr-6">{notification?.title || "Update"}</DialogTitle>
        </DialogHeader>

        {notification?.kind === "note" && notification.note && (
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5 text-primary" />
              <span>{notification.note.author || "Coach"}</span>
              <span>·</span>
              <span>{fmtWhen(notification.note.createdAt)}</span>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{notification.note.note}</p>
            </div>
            {notification.studentName && (
              <p className="text-xs text-muted-foreground">For {notification.studentName}</p>
            )}
          </div>
        )}

        {notification?.kind === "score" && scores && (
          <div className="space-y-4 py-1">
            {notification.scoresUpdatedAt && (
              <p className="text-xs text-muted-foreground">Updated {fmtWhen(notification.scoresUpdatedAt)}</p>
            )}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
              <p className="text-xs text-muted-foreground">Overall rating</p>
              <p className="font-display text-3xl font-bold text-primary mt-1">
                {overall.toFixed(1)}
                <span className="text-base text-muted-foreground">/5</span>
              </p>
            </div>
            <div className="space-y-3">
              {rows.map(([label, value]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      {label}
                    </span>
                    <span className="text-primary font-medium">{Number(value).toFixed(1)}/5</span>
                  </div>
                  <Progress value={Number(value) * 20} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {(notification?.kind === "note" || notification?.kind === "score") && (
            <Button variant="outline" onClick={onGoPerformance}>
              Open Performance
            </Button>
          )}
          <Button className="bg-primary text-primary-foreground" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HomeTab({
  child,
  parentName,
  notifications,
  dashboardNotes,
  overdueCount,
  tournaments,
  onPay,
  onAttendance,
  onProgress,
  onMessage,
  onOpenNotification,
  onOpenNote,
  onOpenScores,
}: {
  child: ParentChild;
  parentName: string;
  notifications: ParentNotification[];
  dashboardNotes: { child: ParentChild; note: ParentNote }[];
  overdueCount: number;
  tournaments: TournamentSummary[];
  onPay: () => void;
  onAttendance: () => void;
  onProgress: () => void;
  onMessage: () => void;
  onOpenNotification: (n: ParentNotification) => void;
  onOpenNote: (c: ParentChild, note: ParentNote) => void;
  onOpenScores: (c: ParentChild) => void;
}) {
  const overall =
    (child.scores.batting + child.scores.bowling + child.scores.fielding + child.scores.fitness + child.scores.temperament) / 5;
  const childTournaments = tournaments
    .filter((t) => t.studentIds.includes(child.id) || t.status !== "completed")
    .slice(0, 4);
  const present = child.attendanceGrid.filter((d) => d.status === "present" || d.status === "late").length;
  const marked = child.attendanceGrid.filter((d) => d.status !== "none").length;
  const noteCount = notifications.filter((n) => n.kind === "note").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        description={`Here's what's happening for ${child.name} at Sun Sports.`}
        actions={
          child.feeStatus !== "paid" ? (
            <Button className="bg-primary text-primary-foreground" onClick={onPay}>
              <CreditCard className="h-4 w-4 mr-2" /> Pay fees
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Fee status"
          value={child.feeStatus === "paid" ? "Paid" : "Due"}
          icon={<CreditCard className="h-4 w-4" />}
          hint={child.feeStatus === "paid" ? inr(child.feeAmount) : `${inr(child.feeAmount)} pending`}
          tone={child.feeStatus === "paid" ? "success" : "danger"}
        />
        <StatCard
          label="Attendance"
          value={child.attendancePct > 0 ? `${child.attendancePct}%` : "—"}
          icon={<CalendarCheck className="h-4 w-4" />}
          hint={marked ? `${present}/${marked} last 30 days` : "No sessions marked"}
          tone={child.attendancePct > 0 && child.attendancePct < 70 ? "warning" : "success"}
        />
        <button type="button" className="text-left" onClick={() => onOpenScores(child)}>
          <StatCard
            label="Overall score"
            value={`${overall.toFixed(1)}/5`}
            icon={<TrendingUp className="h-4 w-4" />}
            hint={child.scoresUpdatedAt ? `Updated ${fmtWhen(child.scoresUpdatedAt)}` : "Tap to view"}
          />
        </button>
        <StatCard
          label="Coach notes"
          value={String((child.notes ?? []).length)}
          icon={<StickyNote className="h-4 w-4" />}
          hint={noteCount ? `${noteCount} recent` : "No new notes"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display font-semibold">Latest coach updates</h3>
            <p className="text-xs text-muted-foreground">Performance notes & scorecard changes</p>
          </div>
          <Button size="sm" variant="ghost" className="text-primary shrink-0" onClick={onProgress}>
            All scores <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
        {dashboardNotes.length === 0 ? (
          <div className="px-5 py-6 space-y-3">
            <p className="text-sm text-muted-foreground">No coach notes yet for your children.</p>
            <Button variant="outline" size="sm" onClick={() => onOpenScores(child)}>
              View current scorecard
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dashboardNotes.map(({ child: c, note }) => (
              <button
                key={note.id}
                type="button"
                onClick={() => onOpenNote(c, note)}
                className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <StickyNote className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{c.name}</p>
                      <Badge variant="outline" className="text-[10px]">Coach note</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{note.note}</p>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {note.author || "Coach"} · {fmtWhen(note.createdAt)} · Tap to read
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <AlertCard
          tone={overdueCount ? "danger" : "info"}
          icon={overdueCount ? <AlertTriangle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          title={overdueCount ? `${overdueCount} fee alert${overdueCount > 1 ? "s" : ""}` : "Fees up to date"}
          desc={overdueCount ? "Clear dues to keep sessions uninterrupted." : "No overdue fees for your children."}
          cta="Open Fees"
          onClick={onPay}
        />
        <AlertCard
          tone={child.attendancePct > 0 && child.attendancePct < 70 ? "warning" : "info"}
          icon={<Calendar className="h-4 w-4" />}
          title={child.attendancePct > 0 && child.attendancePct < 70 ? "Attendance below 70%" : "Attendance on track"}
          desc="Review the 30-day calendar for absences."
          cta="Attendance"
          onClick={onAttendance}
        />
        <AlertCard
          tone="info"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Performance card"
          desc={`Latest overall ${overall.toFixed(1)}/5 · ${dashboardNotes.length} note${dashboardNotes.length === 1 ? "" : "s"}.`}
          cta="View details"
          onClick={() => onOpenScores(child)}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">Coach notes, scores, fees & attendance</p>
            </div>
            <Button size="sm" variant="ghost" className="text-primary" onClick={onMessage}>
              Message academy <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
          <div className="divide-y divide-border max-h-[28rem] overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNotification(n)}
                className="w-full text-left px-5 py-4 flex gap-3 hover:bg-muted/20 transition-colors"
              >
                <div
                  className={cn(
                    "mt-1.5 h-2 w-2 rounded-full shrink-0",
                    n.tone === "danger" && "bg-destructive",
                    n.tone === "warning" && "bg-amber-400",
                    n.tone === "success" && "bg-primary",
                    n.tone === "info" && "bg-blue-400"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{n.title}</p>
                    {(n.kind === "note" || n.kind === "score") && (
                      <Badge variant="outline" className="text-[10px]">{n.kind === "note" ? "Note" : "Scores"}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.desc}</p>
                  {n.time && <p className="text-[11px] text-muted-foreground mt-1">{fmtWhen(n.time)} · Tap to open</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-display font-semibold">Upcoming / recent</h3>
            <p className="text-xs text-muted-foreground">Tournaments & schedule</p>
          </div>
          {childTournaments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">No tournaments listed yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {childTournaments.map((t) => (
                <div key={t.id} className="px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Trophy className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.format} · {t.startDate}</p>
                      <Badge variant="outline" className="mt-2 text-[10px] capitalize">{t.status}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className={cn("h-12 w-12 rounded-lg flex items-center justify-center font-bold shrink-0", initialsColor(child.name))}>
          {initialsOf(child.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-semibold">{child.name}</p>
          <p className="text-sm text-muted-foreground">
            Parent: {parentName}
            {child.batch ? ` · ${child.batch.name}` : ""}
            {child.batch?.time ? ` · ${child.batch.time}` : ""}
          </p>
        </div>
        <Button variant="outline" onClick={onMessage}>
          <MessageCircle className="h-4 w-4 mr-2" /> Contact academy
        </Button>
      </div>
    </div>
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

function FeesTab({ child }: { child: ParentChild }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Fee Management" description={`Payment status and history for ${child.name}.`} />
      <div
        className={cn(
          "rounded-2xl border p-5",
          child.feeStatus === "paid" ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Current status</p>
            <p className="font-display font-bold text-xl mt-0.5">{FEE_LABEL[child.feeStatus]}</p>
            <p className="text-sm mt-1">{inr(child.feeAmount)} / month</p>
            {child.feeStatus !== "paid" && (
              <p className="text-xs text-destructive mt-1">{child.daysOverdue} days overdue</p>
            )}
          </div>
          <CreditCard className="h-8 w-8 text-primary opacity-60" />
        </div>
        {child.feeStatus !== "paid" && (
          <Button
            className="w-full sm:w-auto mt-4 bg-primary text-primary-foreground"
            onClick={() => toast.info("Pay via UPI at academy desk or WhatsApp +91 90330 02641")}
          >
            Pay {inr(child.feeAmount)} now
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display font-semibold">Payment history</h3>
          <p className="text-xs text-muted-foreground">Recorded receipts</p>
        </div>
        {child.payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No payments recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {child.payments.map((p) => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{inr(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paidAt).toLocaleDateString("en-IN")} · {p.method}
                    {p.month ? ` · ${p.month}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-primary border-primary/30">Paid</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceTab({ child }: { child: ParentChild }) {
  const present = child.attendanceGrid.filter((d) => d.status === "present" || d.status === "late").length;
  const absent = child.attendanceGrid.filter((d) => d.status === "absent").length;
  const marked = child.attendanceGrid.filter((d) => d.status !== "none").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={`30-day calendar for ${child.name}.`} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Rate" value={child.attendancePct > 0 ? `${child.attendancePct}%` : "—"} icon={<CalendarCheck className="h-4 w-4" />} />
        <StatCard label="Present" value={String(present)} icon={<Users className="h-4 w-4" />} tone="success" />
        <StatCard label="Absent" value={String(absent)} icon={<AlertTriangle className="h-4 w-4" />} tone={absent > 3 ? "danger" : "default"} />
        <StatCard label="Marked days" value={String(marked)} icon={<Calendar className="h-4 w-4" />} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-display font-semibold mb-1">Last 30 days</p>
        <p className="text-xs text-muted-foreground mb-4">{marked} sessions marked</p>
        <div className="grid grid-cols-10 gap-1.5">
          {child.attendanceGrid.map((m) => (
            <div
              key={m.date}
              title={`${m.date}: ${m.status}`}
              className={cn(
                "aspect-square rounded-md",
                m.status === "present" && "bg-primary/80",
                m.status === "late" && "bg-amber-500/80",
                m.status === "absent" && "bg-destructive/80",
                m.status === "none" && "bg-muted/40"
              )}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/80" /> Present</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/80" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/80" /> Absent</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted/40" /> No session</span>
        </div>
      </div>
    </div>
  );
}

function ProgressTab({
  child,
  refreshing,
  onRefresh,
  onOpenNote,
}: {
  child: ParentChild;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpenNote?: (note: NonNullable<ParentChild["notes"]>[number]) => void;
}) {
  const scores = child.scores || { batting: 0, bowling: 0, fielding: 0, fitness: 0, temperament: 0 };
  const rows = [
    ["Batting", scores.batting],
    ["Bowling", scores.bowling],
    ["Fielding", scores.fielding],
    ["Fitness", scores.fitness],
    ["Temperament", scores.temperament],
  ] as const;
  const overall = rows.reduce((a, [, v]) => a + Number(v || 0), 0) / rows.length;
  const notes = child.notes ?? [];
  const updatedLabel = child.scoresUpdatedAt
    ? new Date(child.scoresUpdatedAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description={`Live assessment scores for ${child.name}${updatedLabel ? ` · updated ${updatedLabel}` : ""}.`}
        actions={
          <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? "Refreshing…" : "Refresh scores"}
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Overall" value={`${overall.toFixed(1)}/5`} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatCard label="Batting" value={`${Number(scores.batting).toFixed(1)}`} />
        <StatCard label="Bowling" value={`${Number(scores.bowling).toFixed(1)}`} />
        <StatCard label="Fielding" value={`${Number(scores.fielding).toFixed(1)}`} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-display font-semibold">Skill breakdown</h3>
        {rows.map(([l, v]) => (
          <div key={l}>
            <div className="flex justify-between text-sm mb-1.5">
              <span>{l}</span>
              <span className="text-primary font-medium">{Number(v).toFixed(1)}/5</span>
            </div>
            <Progress value={Number(v) * 20} className="h-2" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-display font-semibold">Coach notes</h3>
          <p className="text-xs text-muted-foreground">Feedback from your child's coach</p>
        </div>
        {notes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No coach notes yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onOpenNote?.(n)}
                className="w-full text-left px-5 py-4 hover:bg-muted/20 transition-colors"
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {n.author || "Coach"} · {new Date(n.createdAt).toLocaleDateString("en-IN")} · Tap to open
                </p>
                <p className="text-sm">{n.note}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoTab({
  child,
  parentName,
  tournaments,
}: {
  child: ParentChild;
  parentName: string;
  tournaments: TournamentSummary[];
}) {
  const mine = tournaments.filter((t) => t.studentIds.includes(child.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Batch, coach and account details." />
      <div className="grid lg:grid-cols-2 gap-4">
        {child.coach && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-3">Assigned coach</p>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                {initialsOf(child.coach.name)}
              </div>
              <div>
                <p className="font-medium">{child.coach.name}</p>
                <p className="text-xs text-muted-foreground">{child.coach.specialty}</p>
              </div>
            </div>
            {child.coach.phone && (
              <a href={`tel:${child.coach.phone}`} className="mt-4 inline-flex items-center text-xs text-primary">
                <Phone className="h-3.5 w-3.5 mr-1" /> {child.coach.phone}
              </a>
            )}
          </div>
        )}

        {child.batch && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
            <p className="text-xs text-muted-foreground">Batch schedule</p>
            <p className="font-display font-semibold">{child.batch.name}</p>
            <p className="text-sm">{child.batch.schedule}</p>
            <p className="text-sm text-muted-foreground">{child.batch.time}</p>
            <p className="text-sm text-muted-foreground">{child.batch.venue}</p>
          </div>
        )}
      </div>

      {mine.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <p className="font-display font-semibold">Tournament participation</p>
          </div>
          <div className="divide-y divide-border">
            {mine.map((t) => (
              <div key={t.id} className="px-5 py-4">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.venue || "Venue TBD"} · {t.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 space-y-1 text-sm">
        <p className="text-xs text-muted-foreground mb-3">Account</p>
        <p>Parent: <span className="font-medium">{parentName || child.parentName}</span></p>
        <p>Phone: <span className="font-medium">{child.parentPhone}</span></p>
        {child.age ? <p>Age: <span className="font-medium">{child.age}</span></p> : null}
      </div>

      <Button variant="outline" onClick={() => toast.info("WhatsApp academy: +91 90330 02641")}>
        <MessageCircle className="h-4 w-4 mr-2" /> Contact academy
      </Button>
    </div>
  );
}

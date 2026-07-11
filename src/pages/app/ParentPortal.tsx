import { useEffect, useState } from "react";
import { CreditCard, Calendar, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcademy } from "@/context/AcademyContext";
import type { AttendanceGridDay, FeePayment } from "@/lib/api";
import { cn } from "@/lib/utils";

const ParentPortal = () => {
  const { students, getBatch, getCoach, initialsOf, initialsColor, inr, api } = useAcademy();
  const [view, setView] = useState("parent");
  const [studentId, setStudentId] = useState("");
  const [grid, setGrid] = useState<AttendanceGridDay[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);

  useEffect(() => {
    if (!studentId && students[0]?.id) setStudentId(students[0].id);
  }, [students, studentId]);

  useEffect(() => {
    if (!studentId) return;
    void api.attendanceGrid(studentId, 30).then((r) => setGrid(r.grid)).catch(() => setGrid([]));
    void api.listPayments(studentId).then(setPayments).catch(() => setPayments([]));
  }, [studentId, api]);

  const student = students.find((s) => s.id === studentId) ?? students[0];
  if (!student) {
    return (
      <div className="space-y-5">
        <PageHeader title="Parent Portal" description="No students loaded from the API yet." />
      </div>
    );
  }

  const batch = getBatch(student.batchId);
  const coach = batch ? getCoach(batch.coachId) : undefined;
  const latestPayment = payments[0];
  const FEE_LABEL: Record<string, string> = { paid: "Paid", overdue1: "Overdue", overdue8: "Overdue" };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parent Portal"
        description="Live preview from real student, attendance, and payment records."
        actions={
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="admin">View as Admin</TabsTrigger>
              <TabsTrigger value="parent">Preview as Parent</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {view === "admin" ? (
        <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
          <p className="text-sm text-muted-foreground">Parents with portal access (one per student contact)</p>
          <p className="font-display text-2xl font-bold">{students.length} parents</p>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Preview student" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="max-w-md mx-auto rounded-3xl border border-border bg-card overflow-hidden shadow-card">
          <div className="bg-gradient-to-br from-primary/30 to-secondary/20 p-5">
            <div className="flex items-center gap-3">
              <div className={cn("h-14 w-14 rounded-full ring-2 ring-background flex items-center justify-center font-bold text-lg", initialsColor(student.name))}>
                {initialsOf(student.name)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parent of</p>
                <p className="font-display font-bold text-lg">{student.name}</p>
                <p className="text-xs text-muted-foreground">{batch?.name ?? "Unassigned"}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className={cn(
              "rounded-xl border p-4",
              student.feeStatus === "paid" ? "border-primary/30 bg-primary/10" : "border-destructive/30 bg-destructive/10"
            )}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4" /> {FEE_LABEL[student.feeStatus] ?? student.feeStatus}
              </div>
              <p className="mt-1 text-sm">{inr(student.feeAmount)} monthly fee</p>
              {latestPayment ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Last payment {inr(latestPayment.amount)} · {new Date(latestPayment.paidAt).toLocaleDateString("en-IN")} · {latestPayment.method}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">No payments recorded yet</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Last 30 days — {student.attendancePct > 0 ? `${student.attendancePct}%` : "no marks yet"}
              </p>
              <div className="grid grid-cols-10 gap-1">
                {grid.map((m) => (
                  <div
                    key={m.date}
                    title={`${m.date}: ${m.status}`}
                    className={cn(
                      "aspect-square rounded-sm",
                      m.status === "present" && "bg-primary/80",
                      m.status === "late" && "bg-amber-500/80",
                      m.status === "absent" && "bg-destructive/80",
                      m.status === "none" && "bg-muted/40",
                    )}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Progress</p>
              <div className="space-y-2">
                {[
                  ["Batting", student.scores.batting],
                  ["Bowling", student.scores.bowling],
                  ["Fielding", student.scores.fielding],
                  ["Fitness", student.scores.fitness],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="flex justify-between text-xs mb-1"><span>{l}</span><span className="text-primary">{(v as number).toFixed(1)}/5</span></div>
                    <Progress value={(v as number) * 20} className="h-1.5" />
                  </div>
                ))}
              </div>
            </div>

            {coach && (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground mb-1">Coach</p>
                <p className="text-sm font-medium">{coach.name}</p>
                <p className="text-xs text-muted-foreground">{coach.specialty}</p>
              </div>
            )}

            {batch && (
              <div>
                <p className="text-sm font-medium mb-2">Batch schedule</p>
                <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
                  <span>{batch.schedule}</span>
                  <span className="text-muted-foreground">{batch.time}</span>
                </div>
              </div>
            )}

            {student.feeStatus !== "paid" && (
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Pay Now</Button>
            )}
            <Button variant="outline" className="w-full"><MessageCircle className="h-4 w-4 mr-2" /> Message Coach</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentPortal;

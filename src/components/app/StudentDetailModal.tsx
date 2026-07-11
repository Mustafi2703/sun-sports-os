import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Phone, Calendar } from "lucide-react";
import { students, getBatch, getCoach, attendanceGridFor, initialsOf, initialsColor, inr } from "@/data/academy";
import { cn } from "@/lib/utils";

export const StudentDetailModal = ({ studentId, onClose }: { studentId: string | null; onClose: () => void }) => {
  const student = studentId ? students.find(s => s.id === studentId) : null;
  if (!student) return <Dialog open={false} onOpenChange={onClose}><DialogContent /></Dialog>;
  const batch = getBatch(student.batchId)!;
  const coach = getCoach(batch.coachId)!;
  const grid = attendanceGridFor(student.id);

  const feeHistory = ["Jan","Feb","Mar","Apr","May","Jun"].map((m, i) => ({
    month: m,
    paid: i < 4 || (i === 4 && student.feeStatus === "paid"),
    amount: student.feeAmount,
  }));

  const scoreRows: [string, number][] = [
    ["Batting", student.scores.batting],
    ["Bowling", student.scores.bowling],
    ["Fielding", student.scores.fielding],
    ["Fitness", student.scores.fitness],
  ];

  return (
    <Dialog open={!!studentId} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="sr-only">{student.name}</DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-4 pb-5 border-b border-border">
          <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center text-lg font-bold", initialsColor(student.name))}>
            {initialsOf(student.name)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-bold">{student.name}</h2>
            <p className="text-sm text-muted-foreground">{batch.name}{student.role ? ` · ${student.role}` : ""} • Coach {coach.name} • Age {student.age}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">Parent: {student.parentName}</Badge>
              <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" />{student.parentPhone}</Badge>
            </div>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 hidden sm:inline-flex">
            <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-5 pt-2">
          {/* Fee history */}
          <section>
            <h3 className="font-display font-semibold mb-3">Fee history (last 6 months)</h3>
            <div className="space-y-1.5">
              {feeHistory.map(f => (
                <div key={f.month} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <span className="text-sm">{f.month} 2026</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{inr(f.amount)}</span>
                    <Badge variant="outline" className={f.paid ? "bg-primary/15 text-primary border-primary/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
                      {f.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Attendance grid */}
          <section>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Last 30 days</h3>
            <div className="grid grid-cols-10 gap-1.5">
              {grid.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "aspect-square rounded",
                    m === "present" && "bg-primary/80",
                    m === "late" && "bg-amber-500/80",
                    m === "absent" && "bg-destructive/80",
                    m === "none" && "bg-muted/40",
                  )}
                  title={`Day ${i+1}: ${m}`}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-primary/80" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-500/80" /> Late</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-destructive/80" /> Absent</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-muted/40" /> No session</span>
            </div>
            <p className="mt-2 text-sm">Attendance this month: <span className="text-primary font-semibold">{student.attendancePct}%</span></p>
          </section>

          {/* Performance */}
          <section className="md:col-span-2">
            <h3 className="font-display font-semibold mb-3">Performance</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {scoreRows.map(([label, val]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">{label}</span>
                    <span className="text-sm font-semibold text-primary">{val.toFixed(1)} / 5</span>
                  </div>
                  <Progress value={val * 20} className="h-1.5" />
                </div>
              ))}
            </div>
          </section>

          <section className="md:col-span-2">
            <h3 className="font-display font-semibold mb-2">Coach notes</h3>
            <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
              <p className="text-muted-foreground italic">"{student.name.split(' ')[0]}'s technique has improved significantly this month. Focus area for next 2 weeks: defensive footwork against full-length deliveries."</p>
              <p className="mt-2 text-xs text-muted-foreground">— Coach {coach.name}, 3 days ago</p>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
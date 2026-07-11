import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MessageCircle, Phone, Calendar, Pencil, Trash2 } from "lucide-react";
import { useAcademy } from "@/context/AcademyContext";
import { cn } from "@/lib/utils";
import type { Student } from "@/lib/api";

export const StudentDetailModal = ({
  studentId,
  onClose,
  onEdit,
  onDelete,
}: {
  studentId: string | null;
  onClose: () => void;
  onEdit?: (s: Student) => void;
  onDelete?: (s: Student) => void;
}) => {
  const { students, getBatch, getCoach, attendanceGridFor, initialsOf, initialsColor, inr } = useAcademy();
  const student = studentId ? students.find((s) => s.id === studentId) : null;
  if (!student) return <Dialog open={false} onOpenChange={onClose}><DialogContent /></Dialog>;
  const batch = getBatch(student.batchId);
  const coach = batch ? getCoach(batch.coachId) : undefined;
  const grid = attendanceGridFor(student.id);

  const feeHistory = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) => ({
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

  const wa = student.parentPhone.replace(/\D/g, "").replace(/^91/, "");

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
            <p className="text-sm text-muted-foreground">
              {batch?.name ?? "Unassigned"}{student.role ? ` · ${student.role}` : ""}
              {coach ? ` • Coach ${coach.name}` : ""} • Age {student.age}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">Parent: {student.parentName}</Badge>
              <Badge variant="outline" className="gap-1"><Phone className="h-3 w-3" />{student.parentPhone}</Badge>
            </div>
          </div>
          <div className="hidden sm:flex gap-2">
            {onEdit && (
              <Button size="sm" variant="outline" onClick={() => onEdit(student)}>
                <Pencil className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            )}
            {onDelete && (
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDelete(student)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <a href={`https://wa.me/91${wa}`} target="_blank" rel="noreferrer">
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
              </Button>
            </a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 pt-2">
          <section>
            <h3 className="font-display font-semibold mb-3">Fee history (last 6 months)</h3>
            <div className="space-y-1.5">
              {feeHistory.map((f) => (
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

          <section>
            <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Calendar className="h-4 w-4" /> Last 30 days</h3>
            <div className="grid grid-cols-10 gap-1.5">
              {grid.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "aspect-square rounded",
                    m === "present" && "bg-primary/80",
                    m === "absent" && "bg-destructive/80",
                    m === "late" && "bg-amber-500/80",
                    m === "none" && "bg-muted"
                  )}
                  title={m}
                />
              ))}
            </div>
          </section>

          <section className="md:col-span-2">
            <h3 className="font-display font-semibold mb-3">Performance scores</h3>
            <div className="space-y-3">
              {scoreRows.map(([label, score]) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{label}</span>
                    <span className="text-muted-foreground">{score}/5</span>
                  </div>
                  <Progress value={(score / 5) * 100} className="h-2" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

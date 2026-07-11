import { useState } from "react";
import { Heart, CreditCard, Calendar, FileText, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAcademy } from "@/context/AcademyContext";
import { cn } from "@/lib/utils";

const ParentPortal = () => {
  const { students, getBatch, getCoach, attendanceGridFor, initialsOf, initialsColor, inr } = useAcademy();
  const [view, setView] = useState("parent");
  const student = students[0];
  const batch = getBatch(student.batchId)!;
  const coach = getCoach(batch.coachId)!;
  const grid = attendanceGridFor(student.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Parent Portal"
        description="See exactly what each parent sees in their portal."
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
        <div className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Parent portal access:</p>
          <p className="mt-2 font-display text-2xl font-bold">20 active parents</p>
          <p className="text-xs text-muted-foreground mt-1">Average daily logins: 14 • 89% engagement</p>
        </div>
      ) : (
        <div className="max-w-md mx-auto rounded-3xl border border-border bg-card overflow-hidden shadow-card">
          {/* Phone-style header */}
          <div className="bg-gradient-to-br from-primary/30 to-secondary/20 p-5">
            <div className="flex items-center gap-3">
              <div className={cn("h-14 w-14 rounded-full ring-2 ring-background flex items-center justify-center font-bold text-lg", initialsColor(student.name))}>
                {initialsOf(student.name)}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Parent of</p>
                <p className="font-display font-bold text-lg">{student.name}</p>
                <p className="text-xs text-muted-foreground">{batch.name}</p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Fee status */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary"><CreditCard className="h-4 w-4" /> Paid</div>
              <p className="mt-1 text-sm">{inr(student.feeAmount)} on April 3, 2026</p>
              <button className="mt-2 text-xs text-primary underline">Download receipt</button>
            </div>

            {/* Attendance */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> This month — {student.attendancePct}%</p>
              <div className="grid grid-cols-10 gap-1">
                {grid.map((m, i) => (
                  <div key={i} className={cn(
                    "aspect-square rounded-sm",
                    m === "present" && "bg-primary/80",
                    m === "late" && "bg-amber-500/80",
                    m === "absent" && "bg-destructive/80",
                    m === "none" && "bg-muted/40",
                  )} />
                ))}
              </div>
            </div>

            {/* Progress */}
            <div>
              <p className="text-sm font-medium mb-2">Progress this month</p>
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

            {/* Coach note */}
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground mb-1">Latest note from Coach {coach.name}</p>
              <p className="text-sm italic">"Arjun's cover drive has improved significantly this month. Needs to work on yorker defense."</p>
            </div>

            {/* Upcoming */}
            <div>
              <p className="text-sm font-medium mb-2">Upcoming sessions</p>
              <div className="space-y-1.5">
                {[batch.schedule, batch.time].slice(0, 1).map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 text-sm flex items-center justify-between">
                    <span>{batch.schedule}</span>
                    <span className="text-muted-foreground">{batch.time}</span>
                  </div>
                ))}
              </div>
            </div>

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
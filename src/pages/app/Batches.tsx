import { Layers, Users, Plus, Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { batches, getCoach, inr } from "@/data/academy";
import { cn } from "@/lib/utils";

const Batches = () => {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Batches"
        description={`Manage your ${batches.length} active training batches.`}
        actions={<Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4 mr-1.5" /> New Batch</Button>}
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map(b => {
          const c = getCoach(b.coachId)!;
          const fillPct = (b.studentCount / b.capacity) * 100;
          const isFull = b.studentCount >= b.capacity;
          return (
            <div key={b.id} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                {isFull && <Badge className="bg-amber-500/15 text-amber-400 border-0">Full</Badge>}
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg">{b.name}</h3>
              <p className="text-xs text-muted-foreground">{b.ageGroup} • {inr(b.monthlyFee)}/month</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> {b.schedule} • {b.time}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {b.venue}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Coach {c.name}</div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className={cn("font-medium", isFull ? "text-amber-400" : "text-foreground")}>{b.studentCount}/{b.capacity}</span>
                </div>
                <Progress value={fillPct} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Batches;
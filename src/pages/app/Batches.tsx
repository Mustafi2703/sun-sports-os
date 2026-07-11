import { useState } from "react";
import { Layers, Users, Plus, Clock, MapPin, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BatchFormDialog, type BatchFormValues } from "@/components/app/BatchFormDialog";
import { useAcademy } from "@/context/AcademyContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Batch } from "@/lib/api";

const Batches = () => {
  const { batches, coaches, getCoach, inr, api, refresh, loading } = useAcademy();
  const [editing, setEditing] = useState<Batch | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const save = async (values: BatchFormValues) => {
    setBusy(true);
    try {
      const body = {
        name: values.name.trim(),
        ageGroup: values.ageGroup,
        schedule: values.schedule,
        time: values.time,
        venue: values.venue,
        capacity: Number(values.capacity) || 20,
        monthlyFee: Number(values.monthlyFee) || 15000,
        coachId: values.coachId || undefined,
      };
      if (editing) await api.updateBatch(editing.id, body);
      else await api.createBatch(body);
      toast.success(editing ? "Batch updated" : "Batch created");
      setEditing(undefined);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (b: Batch) => {
    if (!confirm(`Delete batch "${b.name}"? Students will be unassigned.`)) return;
    try {
      await api.deleteBatch(b.id);
      toast.success("Batch deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Batches"
        description={loading ? "Loading…" : `Manage your ${batches.length} active training batches.`}
        actions={
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setEditing(null)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Batch
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((b) => {
          const c = getCoach(b.coachId);
          const fillPct = b.capacity ? (b.studentCount / b.capacity) * 100 : 0;
          const isFull = b.studentCount >= b.capacity;
          return (
            <div key={b.id} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-2">
                  {isFull && <Badge className="bg-amber-500/15 text-amber-400 border-0">Full</Badge>}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void remove(b)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <h3 className="mt-4 font-display font-semibold text-lg">{b.name}</h3>
              <p className="text-xs text-muted-foreground">{b.ageGroup} • {inr(b.monthlyFee)}/month</p>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-4 w-4" /> {b.schedule} • {b.time}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> {b.venue}</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Coach {c?.name ?? "Unassigned"}</div>
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

      <BatchFormDialog
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        batch={editing ?? null}
        coaches={coaches}
        onSubmit={save}
        busy={busy}
      />
    </div>
  );
};

export default Batches;

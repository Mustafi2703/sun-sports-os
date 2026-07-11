import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Batch, Coach } from "@/lib/api";

export type BatchFormValues = {
  name: string;
  ageGroup: string;
  schedule: string;
  time: string;
  venue: string;
  capacity: string;
  monthlyFee: string;
  coachId: string;
};

export function BatchFormDialog({
  open,
  onClose,
  batch,
  coaches,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  batch: Batch | null;
  coaches: Coach[];
  onSubmit: (values: BatchFormValues) => Promise<void>;
  busy?: boolean;
}) {
  const [form, setForm] = useState<BatchFormValues>({
    name: "",
    ageGroup: "Open",
    schedule: "Mon–Fri",
    time: "5:00 – 7:30 PM",
    venue: "Sun Sports Ground",
    capacity: "20",
    monthlyFee: "15000",
    coachId: coaches[0]?.id || "",
  });

  useEffect(() => {
    if (!open) return;
    if (batch) {
      setForm({
        name: batch.name,
        ageGroup: batch.ageGroup,
        schedule: batch.schedule,
        time: batch.time,
        venue: batch.venue,
        capacity: String(batch.capacity),
        monthlyFee: String(batch.monthlyFee),
        coachId: batch.coachId || coaches[0]?.id || "",
      });
    } else {
      setForm({
        name: "",
        ageGroup: "Open",
        schedule: "Mon–Fri",
        time: "5:00 – 7:30 PM",
        venue: "Sun Sports Ground",
        capacity: "20",
        monthlyFee: "15000",
        coachId: coaches[0]?.id || "",
      });
    }
  }, [open, batch, coaches]);

  const set = (key: keyof BatchFormValues, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit batch" : "New batch"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Batch name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Age group</Label>
              <Input value={form.ageGroup} onChange={(e) => set("ageGroup", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Coach</Label>
              <Select value={form.coachId} onValueChange={(v) => set("coachId", v)}>
                <SelectTrigger><SelectValue placeholder="Coach" /></SelectTrigger>
                <SelectContent>
                  {coaches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Schedule</Label>
            <Input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Timings</Label>
            <Input value={form.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Venue</Label>
            <Input value={form.venue} onChange={(e) => set("venue", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Capacity</Label>
              <Input type="number" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Monthly fee ₹</Label>
              <Input type="number" value={form.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !form.name.trim()}
            onClick={() => void onSubmit(form)}
          >
            {busy ? "Saving…" : batch ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

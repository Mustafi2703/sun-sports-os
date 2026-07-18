import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Batch, Coach, Student } from "@/lib/api";

export type StudentFormValues = {
  name: string;
  dob: string;
  parentName: string;
  parentPhone: string;
  batchId: string;
  role: string;
  feeStatus: string;
  feeAmount: string;
  daysOverdue: string;
  joinDate: string;
  medicalNotes: string;
};

const empty = (batches: Batch[]): StudentFormValues => ({
  name: "",
  dob: "",
  parentName: "",
  parentPhone: "",
  batchId: batches[0]?.id || "",
  role: "",
  feeStatus: "paid",
  feeAmount: String(batches[0]?.monthlyFee || 15000),
  daysOverdue: "0",
  joinDate: new Date().toISOString().slice(0, 10),
  medicalNotes: "",
});

export function StudentFormDialog({
  open,
  onClose,
  student,
  batches,
  coaches = [],
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  batches: Batch[];
  coaches?: Coach[];
  onSubmit: (values: StudentFormValues) => Promise<void>;
  busy?: boolean;
}) {
  const [form, setForm] = useState<StudentFormValues>(empty(batches));

  useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        name: student.name,
        dob: student.dob || "",
        parentName: student.parentName || "",
        parentPhone: student.parentPhone || "",
        batchId: student.batchId || batches[0]?.id || "",
        role: student.role || "",
        feeStatus: student.feeStatus,
        feeAmount: String(student.feeAmount),
        daysOverdue: String(student.daysOverdue),
        joinDate: student.joinDate || "",
        medicalNotes: student.medicalNotes || "",
      });
    } else {
      setForm(empty(batches));
    }
  }, [open, student, batches]);

  const set = (key: keyof StudentFormValues, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const selectedBatch = batches.find((b) => b.id === form.batchId);
  const assignedCoach = coaches.find((c) => c.id === selectedBatch?.coachId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date of birth">
              <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
            </Field>
            <Field label="Join date">
              <Input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
            </Field>
          </div>
          <Field label="Parent / guardian">
            <Input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} />
          </Field>
          <Field label="Parent WhatsApp">
            <Input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Batch">
              <Select
                value={form.batchId}
                onValueChange={(v) => {
                  set("batchId", v);
                  const b = batches.find((x) => x.id === v);
                  if (b?.monthlyFee) set("feeAmount", String(b.monthlyFee));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Role / specialty">
              <Input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Batting, Bowling…" />
            </Field>
          </div>
          {selectedBatch && (
            <p className="text-xs text-muted-foreground -mt-1">
              Coach for this batch:{" "}
              <span className="text-foreground font-medium">
                {assignedCoach?.name || "Unassigned — set coach on Batches page"}
              </span>
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fee status">
              <Select value={form.feeStatus} onValueChange={(v) => set("feeStatus", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue1">Overdue 1–7d</SelectItem>
                  <SelectItem value="overdue8">Overdue 8+d</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fee ₹">
              <Input type="number" value={form.feeAmount} onChange={(e) => set("feeAmount", e.target.value)} />
            </Field>
            <Field label="Days overdue">
              <Input type="number" value={form.daysOverdue} onChange={(e) => set("daysOverdue", e.target.value)} />
            </Field>
          </div>
          <Field label="Medical notes">
            <Textarea value={form.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !form.name.trim()}
            onClick={() => void onSubmit(form)}
          >
            {busy ? "Saving…" : student ? "Save changes" : "Add student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

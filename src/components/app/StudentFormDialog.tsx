import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Batch, Coach, Student } from "@/lib/api";

export type FeePackageOption = {
  id: string;
  name: string;
  description?: string;
  months: number;
  monthlyAmount: number;
  totalAmount: number;
  active?: boolean;
};

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
  /** Per-student rate card (monthly ₹) */
  feeRate1: string;
  feeRate3: string;
  feeRate6: string;
  feeRate12: string;
  /** Apply / replace fee enrollment on save */
  enrollFee: boolean;
  /** Active plan length for this student */
  planMonths: string;
  startMonth: string;
  packageId: string;
  /** Kept for callers that still check mode — always duration-based with custom rates */
  feePlanMode: "package" | "duration";
};

function currentMonthLabel() {
  return new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function monthOptions() {
  const out: string[] = [];
  const now = new Date();
  for (let i = -1; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(d.toLocaleString("en-IN", { month: "short", year: "numeric" }));
  }
  return out;
}

function endMonthFrom(startLabel: string, months: number): string {
  const d = new Date(`${startLabel} 1`);
  if (Number.isNaN(d.getTime()) || months < 1) return startLabel;
  const end = new Date(d.getFullYear(), d.getMonth() + (months - 1), 1);
  return end.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

const DURATION_PRESETS = [
  { months: 1, label: "1 month", rateKey: "feeRate1" as const },
  { months: 3, label: "3 months", rateKey: "feeRate3" as const },
  { months: 6, label: "6 months", rateKey: "feeRate6" as const },
  { months: 12, label: "1 year", rateKey: "feeRate12" as const },
] as const;

function rateForPlan(form: StudentFormValues, months: number): number {
  if (months >= 12) return Number(form.feeRate12) || 12000;
  if (months >= 6) return Number(form.feeRate6) || 13000;
  if (months >= 3) return Number(form.feeRate3) || 14000;
  return Number(form.feeRate1) || 15000;
}

const empty = (batches: Batch[], packages: FeePackageOption[]): StudentFormValues => {
  const byMonths = (m: number) => packages.find((p) => p.months === m && p.active !== false);
  const r1 = byMonths(1)?.monthlyAmount || batches[0]?.monthlyFee || 15000;
  const r3 = byMonths(3)?.monthlyAmount || 14000;
  const r6 = byMonths(6)?.monthlyAmount || 13000;
  const r12 = byMonths(12)?.monthlyAmount || 12000;
  return {
    name: "",
    dob: "",
    parentName: "",
    parentPhone: "",
    batchId: batches[0]?.id || "",
    role: "",
    feeStatus: "paid",
    feeAmount: String(r1),
    daysOverdue: "0",
    joinDate: new Date().toISOString().slice(0, 10),
    medicalNotes: "",
    feeRate1: String(r1),
    feeRate3: String(r3),
    feeRate6: String(r6),
    feeRate12: String(r12),
    enrollFee: true,
    planMonths: "1",
    startMonth: currentMonthLabel(),
    packageId: byMonths(1)?.id || "",
    feePlanMode: "duration",
  };
};

export function StudentFormDialog({
  open,
  onClose,
  student,
  batches,
  coaches = [],
  packages = [],
  activeEnrollment,
  onSubmit,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  student: Student | null;
  batches: Batch[];
  coaches?: Coach[];
  packages?: FeePackageOption[];
  activeEnrollment?: {
    packageId?: string | null;
    packageName?: string;
    months?: number;
    monthlyAmount?: number;
    startMonth?: string;
    endMonth?: string;
  } | null;
  onSubmit: (values: StudentFormValues) => Promise<void>;
  busy?: boolean;
}) {
  const [form, setForm] = useState<StudentFormValues>(empty(batches, packages));
  const activePackages = useMemo(() => packages.filter((p) => p.active !== false), [packages]);

  useEffect(() => {
    if (!open) return;
    if (student) {
      const rates = student.feeRates || {
        m1: student.feeAmount || 15000,
        m3: 14000,
        m6: 13000,
        m12: 12000,
      };
      const hasPlan = !!(activeEnrollment?.months);
      const months = activeEnrollment?.months || 1;
      const matched = activePackages.find((p) => p.months === months);
      setForm({
        name: student.name,
        dob: student.dob || "",
        parentName: student.parentName || "",
        parentPhone: student.parentPhone || "",
        batchId: student.batchId || batches[0]?.id || "",
        role: student.role || "",
        feeStatus: student.feeStatus,
        feeAmount: String(activeEnrollment?.monthlyAmount || student.feeAmount),
        daysOverdue: String(student.daysOverdue),
        joinDate: student.joinDate || "",
        medicalNotes: student.medicalNotes || "",
        feeRate1: String(rates.m1),
        feeRate3: String(rates.m3),
        feeRate6: String(rates.m6),
        feeRate12: String(rates.m12),
        enrollFee: !hasPlan,
        planMonths: String(months),
        startMonth: activeEnrollment?.startMonth || currentMonthLabel(),
        packageId: matched?.id || activeEnrollment?.packageId || "",
        feePlanMode: "duration",
      });
    } else {
      setForm(empty(batches, activePackages));
    }
  }, [open, student, batches, activePackages, activeEnrollment]);

  const set = (key: keyof StudentFormValues, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedBatch = batches.find((b) => b.id === form.batchId);
  const assignedCoach = coaches.find((c) => c.id === selectedBatch?.coachId);
  const planMonths = Math.max(1, Number(form.planMonths) || 1);
  const monthlyAmount = rateForPlan(form, planMonths);
  const endMonth = endMonthFrom(form.startMonth, planMonths);
  const totalAmount = monthlyAmount * planMonths;

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
            <Input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} placeholder="Parent name" />
          </Field>
          <Field label="Parent WhatsApp (required for portal login)">
            <Input
              value={form.parentPhone}
              onChange={(e) => set("parentPhone", e.target.value)}
              inputMode="tel"
              placeholder="10-digit mobile"
              required
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Creates/updates the parent portal account for this number.
            </p>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Batch">
              <Select value={form.batchId} onValueChange={(v) => set("batchId", v)}>
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

          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">This student’s fee structure</p>
                <p className="text-[11px] text-muted-foreground">
                  Each student has their own amounts for 1 / 3 / 6 / 12 month plans.
                </p>
              </div>
              {student && (
                <label className="flex items-center gap-2 text-xs shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={form.enrollFee}
                    onChange={(e) => set("enrollFee", e.target.checked)}
                  />
                  {activeEnrollment ? "Update plan" : "Set plan"}
                </label>
              )}
            </div>

            {student && activeEnrollment && !form.enrollFee && (
              <p className="text-xs rounded-lg border border-border/60 bg-background/60 px-3 py-2">
                Current: <span className="font-medium">{activeEnrollment.packageName || "Plan"}</span>
                {" · "}
                {activeEnrollment.startMonth} → {activeEnrollment.endMonth}
                {" · "}₹{(activeEnrollment.monthlyAmount || 0).toLocaleString("en-IN")}/mo
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["feeRate1", "1 month ₹/mo"],
                  ["feeRate3", "3 months ₹/mo"],
                  ["feeRate6", "6 months ₹/mo"],
                  ["feeRate12", "1 year ₹/mo"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    min={0}
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </Field>
              ))}
            </div>

            {(form.enrollFee || !student) && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Enroll on plan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DURATION_PRESETS.map((d) => (
                      <button
                        key={d.months}
                        type="button"
                        className={cn(
                          "text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
                          Number(form.planMonths) === d.months
                            ? "border-primary/50 bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        )}
                        onClick={() => {
                          set("planMonths", String(d.months));
                          set("feeAmount", form[d.rateKey]);
                          const pkg = activePackages.find((p) => p.months === d.months);
                          set("packageId", pkg?.id || "");
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Fee start month">
                  <Select value={form.startMonth} onValueChange={(v) => set("startMonth", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthOptions().map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs space-y-0.5">
                  <p>
                    <span className="text-muted-foreground">Schedule: </span>
                    <span className="font-medium">{form.startMonth}</span>
                    <span className="text-muted-foreground"> → </span>
                    <span className="font-medium">{endMonth}</span>
                    <span className="text-muted-foreground"> ({planMonths} dues)</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">This student: </span>
                    <span className="font-medium">₹{monthlyAmount.toLocaleString("en-IN")}/mo</span>
                    <span className="text-muted-foreground"> · total </span>
                    <span className="font-medium">₹{totalAmount.toLocaleString("en-IN")}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          <Field label="Medical notes">
            <Textarea value={form.medicalNotes} onChange={(e) => set("medicalNotes", e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !form.name.trim() || form.parentPhone.replace(/\D/g, "").length < 10}
            onClick={() => {
              const months = Math.max(1, Number(form.planMonths) || 1);
              void onSubmit({
                ...form,
                feeAmount: String(rateForPlan(form, months)),
                feePlanMode: "duration",
              });
            }}
          >
            {busy ? "Saving…" : student ? "Save changes" : "Add student & set plan"}
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

import { useEffect, useMemo, useState } from "react";
import { CreditCard, AlertTriangle, Calendar, Send, MessageCircle, Pencil, Banknote, Search } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FeeStatus, Student } from "@/lib/api";

const FEE_BADGES: Record<string, string> = {
  paid: "bg-primary/15 text-primary border-primary/30",
  overdue1: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  overdue8: "bg-destructive/15 text-destructive border-destructive/30",
};
const FEE_LABEL: Record<string, string> = {
  paid: "Paid",
  overdue1: "Overdue 1–7d",
  overdue8: "Overdue 8+d",
};

function currentFeeMonth() {
  return new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function monthOptions() {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toLocaleString("en-IN", { month: "short", year: "numeric" }));
  }
  return out;
}

const Fees = () => {
  const { students, batches, getBatch, monthlyRevenue, overdueAmount, inr, api, refresh } = useAcademy();
  const [tab, setTab] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [payStudent, setPayStudent] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (tab !== "all" && s.feeStatus !== tab) return false;
      if (batchFilter !== "all" && s.batchId !== batchFilter) return false;
      if (q && !s.name.toLowerCase().includes(q.toLowerCase()) && !s.parentPhone.includes(q)) return false;
      return true;
    });
  }, [tab, batchFilter, q, students]);

  const expectedBook = students.reduce((a, s) => a + s.feeAmount, 0);
  const overdueCount = students.filter((s) => s.feeStatus !== "paid").length;
  const overdueIds = students.filter((s) => s.feeStatus !== "paid").map((s) => s.id);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAllFiltered = () => {
    if (filtered.every((s) => selected.has(s.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.id)));
    }
  };

  const saveFeeSetup = async (values: {
    feeAmount: number;
    feeStatus: FeeStatus;
    daysOverdue: number;
  }) => {
    if (!editStudent) return;
    setBusy(true);
    try {
      await api.updateStudentFees(editStudent.id, {
        feeAmount: values.feeAmount,
        feeStatus: values.feeStatus,
        daysOverdue: values.feeStatus === "paid" ? 0 : values.daysOverdue,
      });
      toast.success(`Fee updated for ${editStudent.name}`);
      setEditStudent(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async (values: {
    amount: number;
    month: string;
    method: string;
    note: string;
    markPaid: boolean;
  }) => {
    if (!payStudent) return;
    setBusy(true);
    try {
      await api.createPayment({
        studentId: payStudent.id,
        amount: values.amount,
        month: values.month,
        method: values.method,
        note: values.note || "Manual entry",
        markPaid: values.markPaid,
      });
      if (values.markPaid) {
        toast.success(`Payment recorded — ${payStudent.name} marked paid`);
      } else {
        toast.success("Payment recorded (status unchanged)");
      }
      setPayStudent(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkSetStatus = async (feeStatus: FeeStatus) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    try {
      const daysOverdue = feeStatus === "paid" ? 0 : feeStatus === "overdue1" ? 3 : 10;
      await Promise.all(
        ids.map((id) => api.updateStudentFees(id, { feeStatus, daysOverdue }))
      );
      toast.success(`Updated status for ${ids.length} student${ids.length > 1 ? "s" : ""}`);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBusy(false);
    }
  };

  const applyBatchMonthlyFee = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true);
    try {
      let updated = 0;
      for (const id of ids) {
        const s = students.find((x) => x.id === id);
        if (!s) continue;
        const batch = getBatch(s.batchId);
        const feeAmount = batch?.monthlyFee || s.feeAmount;
        await api.updateStudentFees(id, { feeAmount });
        updated += 1;
      }
      toast.success(`Applied batch monthly fee to ${updated} student${updated > 1 ? "s" : ""}`);
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply fees");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fee Management"
        description="Set monthly fees, update payment status per student, and record collections."
      />

      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Collected this month" value={inr(monthlyRevenue)} icon={<CreditCard className="h-4 w-4" />} tone="success" />
        <StatCard label="Total overdue" value={inr(overdueAmount)} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" hint={`${overdueCount} students`} />
        <StatCard label="Monthly fee book" value={inr(expectedBook)} icon={<Calendar className="h-4 w-4" />} hint={`${students.length} students`} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="overdue1">1–7 days</TabsTrigger>
                <TabsTrigger value="overdue8">8+ days</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap items-center gap-2">
              {selected.size > 0 && (
                <>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulkSetStatus("paid")}>
                    Mark paid ({selected.size})
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulkSetStatus("overdue1")}>
                    Mark overdue
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void bulkSetStatus("overdue8")}>
                    Mark critical
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void applyBatchMonthlyFee()}>
                    Apply batch fee
                  </Button>
                  <Button size="sm" onClick={() => setPreviewIds(Array.from(selected))} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <Send className="h-3.5 w-3.5 mr-1.5" /> Remind ({selected.size})
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setPreviewIds(overdueIds)} disabled={!overdueIds.length}>
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Remind overdue
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search student or parent phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                    onCheckedChange={() => toggleAllFiltered()}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Batch</th>
                <th className="text-left px-4 py-3 font-medium">Monthly fee</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Days overdue</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No students match these filters.
                  </td>
                </tr>
              )}
              {filtered.map((s) => {
                const b = getBatch(s.batchId);
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.parentName || "—"} · {s.parentPhone || "no phone"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <p>{b?.name ?? "—"}</p>
                      {b?.monthlyFee ? (
                        <p className="text-[11px] text-muted-foreground">Batch default {inr(b.monthlyFee)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium">{inr(s.feeAmount)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={FEE_BADGES[s.feeStatus]}>
                        {FEE_LABEL[s.feeStatus]}
                      </Badge>
                    </td>
                    <td className={cn("px-4 py-3", s.feeStatus === "overdue8" ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {s.daysOverdue > 0 ? `${s.daysOverdue}d` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditStudent(s)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit fee
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPayStudent(s)}>
                          <Banknote className="h-3.5 w-3.5 mr-1" /> Record payment
                        </Button>
                        {s.feeStatus !== "paid" && (
                          <Button size="sm" variant="ghost" onClick={() => setPreviewIds([s.id])}>
                            Remind
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FeeSetupDialog
        student={editStudent}
        batchDefault={editStudent ? getBatch(editStudent.batchId)?.monthlyFee : undefined}
        busy={busy}
        onClose={() => setEditStudent(null)}
        onSave={saveFeeSetup}
      />

      <RecordPaymentDialog
        student={payStudent}
        busy={busy}
        onClose={() => setPayStudent(null)}
        onSave={savePayment}
      />

      <ReminderModal ids={previewIds} students={students} onClose={() => { setPreviewIds(null); setSelected(new Set()); }} />
    </div>
  );
};

function FeeSetupDialog({
  student,
  batchDefault,
  busy,
  onClose,
  onSave,
}: {
  student: Student | null;
  batchDefault?: number;
  busy: boolean;
  onClose: () => void;
  onSave: (v: { feeAmount: number; feeStatus: FeeStatus; daysOverdue: number }) => Promise<void>;
}) {
  const [feeAmount, setFeeAmount] = useState("");
  const [feeStatus, setFeeStatus] = useState<FeeStatus>("paid");
  const [daysOverdue, setDaysOverdue] = useState("0");

  useEffect(() => {
    if (!student) return;
    setFeeAmount(String(student.feeAmount));
    setFeeStatus(student.feeStatus);
    setDaysOverdue(String(student.daysOverdue || 0));
  }, [student]);

  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit fee — {student.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Monthly fee (₹)</Label>
            <Input
              type="number"
              min={0}
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
            />
            {batchDefault != null && (
              <button
                type="button"
                className="text-[11px] text-primary hover:underline"
                onClick={() => setFeeAmount(String(batchDefault))}
              >
                Use batch default ({batchDefault.toLocaleString("en-IN")})
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fee status</Label>
            <Select value={feeStatus} onValueChange={(v) => {
              const status = v as FeeStatus;
              setFeeStatus(status);
              if (status === "paid") setDaysOverdue("0");
              else if (status === "overdue1" && Number(daysOverdue) === 0) setDaysOverdue("3");
              else if (status === "overdue8" && Number(daysOverdue) < 8) setDaysOverdue("10");
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue1">Overdue 1–7 days</SelectItem>
                <SelectItem value="overdue8">Overdue 8+ days (critical)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Days overdue</Label>
            <Input
              type="number"
              min={0}
              disabled={feeStatus === "paid"}
              value={daysOverdue}
              onChange={(e) => setDaysOverdue(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Parent portal shows this status and amount for this student only.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !feeAmount || Number(feeAmount) < 0}
            onClick={() =>
              void onSave({
                feeAmount: Number(feeAmount) || 0,
                feeStatus,
                daysOverdue: feeStatus === "paid" ? 0 : Math.max(0, Number(daysOverdue) || 0),
              })
            }
          >
            {busy ? "Saving…" : "Save fee setup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({
  student,
  busy,
  onClose,
  onSave,
}: {
  student: Student | null;
  busy: boolean;
  onClose: () => void;
  onSave: (v: { amount: number; month: string; method: string; note: string; markPaid: boolean }) => Promise<void>;
}) {
  const months = monthOptions();
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(currentFeeMonth());
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [markPaid, setMarkPaid] = useState(true);

  useEffect(() => {
    if (!student) return;
    setAmount(String(student.feeAmount));
    setMonth(currentFeeMonth());
    setMethod("cash");
    setNote("");
    setMarkPaid(true);
  }, [student]);

  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment — {student.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (₹)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">For month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Receipt / reference" />
          </div>
          <label className="flex items-center gap-2 text-sm rounded-lg border border-border px-3 py-2.5">
            <Checkbox checked={markPaid} onCheckedChange={(c) => setMarkPaid(!!c)} />
            Mark student as paid (clears overdue)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !amount || Number(amount) <= 0}
            onClick={() =>
              void onSave({
                amount: Number(amount),
                month,
                method,
                note,
                markPaid,
              })
            }
          >
            {busy ? "Saving…" : "Save payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ReminderModal = ({
  ids,
  students,
  onClose,
}: {
  ids: string[] | null;
  students: Student[];
  onClose: () => void;
}) => {
  if (!ids) return null;
  const sample = students.find((s) => s.id === ids[0]);
  if (!sample) return null;
  const amount = "₹" + sample.feeAmount.toLocaleString("en-IN");
  const feeMonth = currentFeeMonth();
  const phone = (sample.parentPhone || "").replace(/\D/g, "").slice(-10);
  const text = `Hi ${sample.parentName || "Parent"}, friendly reminder that ${sample.name}'s fee of ${amount} for ${feeMonth} is overdue. Please pay at your earliest convenience. — Sun Sports`;
  return (
    <Dialog open={!!ids} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp Reminder Preview</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-700/30 p-4">
          <div className="rounded-lg bg-emerald-900/40 p-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {text}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Opens WhatsApp with a prefilled message.
          {ids.length > 1 ? ` Preview shows 1 of ${ids.length} selected.` : ""}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              if (phone.length >= 10) {
                window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                toast.success("Opening WhatsApp");
              } else {
                toast.error("No parent WhatsApp on this student");
              }
              onClose();
            }}
          >
            <Send className="h-4 w-4 mr-1.5" /> Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Fees;

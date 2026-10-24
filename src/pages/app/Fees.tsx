import { useCallback, useEffect, useState } from "react";
import {
  CreditCard, AlertTriangle, Calendar, Package, Clock, Plus,
} from "lucide-react";
import { FeeCollectionBoard } from "@/components/app/FeeCollectionBoard";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FeeLedger, Student } from "@/lib/api";

type FeePackage = {
  id: string;
  name: string;
  description: string;
  months: number;
  monthlyAmount: number;
  totalAmount: number;
  active: boolean;
};

type Metrics = {
  thisMonth: string;
  collectedThisMonth: number;
  expectedThisMonth: number;
  collectionRate: number;
  paidInstallments: number;
  overdueInstallments: number;
  pendingInstallments: number;
  activePackages: number;
  packageBookValue: number;
  totalCollected: number;
  coachSalaryBill: number;
};

function currentMonth() {
  return new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function monthOptions() {
  const out: string[] = [];
  const now = new Date();
  for (let i = -1; i < 14; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(d.toLocaleString("en-IN", { month: "short", year: "numeric" }));
  }
  return out;
}

const Fees = () => {
  const { students, api, inr, refresh } = useAcademy();
  const [tab, setTab] = useState("dues");
  const [packages, setPackages] = useState<FeePackage[]>([]);
  const [ledger, setLedger] = useState<FeeLedger | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [pkgOpen, setPkgOpen] = useState(false);

  const load = useCallback(async () => {
    const [pkgs, nextLedger, met] = await Promise.all([
      api.listFeePackages(),
      api.feeLedger(),
      api.feeMetrics(),
    ]);
    setPackages(pkgs.filter((p) => p.active));
    setLedger(nextLedger);
    setMetrics(met);
  }, [api]);

  useEffect(() => {
    void load().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load fees"));
  }, [load]);

  const markReceived = async (studentId: string, studentName: string, month: string) => {
    const key = `${studentId}:${month}`;
    setBusyKey(key);
    try {
      const res = await api.recordFeeReceived({ studentId, month });
      toast.success(
        res.alreadyRecorded
          ? `${studentName} — ${month} was already received`
          : `${studentName} — ${month} marked received`
      );
      await load();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record fee");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fee Management"
        description="See every month that was received, who still owes, and mark each month as it comes in."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPkgOpen(true)}>
              <Package className="h-4 w-4 mr-1.5" /> Packages
            </Button>
            <Button className="bg-primary text-primary-foreground" onClick={() => setEnrollOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Enroll student
            </Button>
          </div>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label={`Collected (${metrics?.thisMonth || "…"})`}
          value={inr(metrics?.collectedThisMonth || 0)}
          icon={<CreditCard className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Expected this month"
          value={inr(metrics?.expectedThisMonth || 0)}
          icon={<Calendar className="h-4 w-4" />}
          hint={`${metrics?.collectionRate ?? 0}% collected`}
        />
        <StatCard
          label="Overdue installments"
          value={String(metrics?.overdueInstallments || 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="danger"
          hint={`${metrics?.pendingInstallments || 0} pending`}
        />
        <StatCard
          label="Active packages"
          value={String(metrics?.activePackages || 0)}
          icon={<Package className="h-4 w-4" />}
          hint={`Book ${inr(metrics?.packageBookValue || 0)}`}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="dues">Collection</TabsTrigger>
          <TabsTrigger value="packages">Fee packages</TabsTrigger>
        </TabsList>

        <TabsContent value="dues" className="mt-4 space-y-3">
          <FeeCollectionBoard ledger={ledger} inr={inr} busyKey={busyKey} onMark={(id, name, month) => void markReceived(id, name, month)} />
        </TabsContent>

        <TabsContent value="packages" className="mt-4">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {packages.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-semibold">{p.name}</h3>
                  <Badge variant="outline">{p.months} mo</Badge>
                </div>
                <p className="text-xs text-muted-foreground min-h-[32px]">{p.description || "—"}</p>
                <p className="text-sm">
                  <span className="font-semibold">{inr(p.monthlyAmount)}</span>
                  <span className="text-muted-foreground"> / month</span>
                </p>
                <p className="text-xs text-muted-foreground">Package total {inr(p.totalAmount)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Enrolling a student creates dues for every month until the package ends. Mark each month paid from Monthly dues.
          </p>
        </TabsContent>
      </Tabs>

      <EnrollDialog
        open={enrollOpen}
        students={students}
        packages={packages}
        busy={busy}
        onClose={() => setEnrollOpen(false)}
        onSave={async (body) => {
          setBusy(true);
          try {
            await api.enrollFeePackage(body);
            toast.success("Package enrolled — monthly dues created through package end");
            setEnrollOpen(false);
            await load();
            await refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Enroll failed");
          } finally {
            setBusy(false);
          }
        }}
      />

      <CreatePackageDialog
        open={pkgOpen}
        busy={busy}
        onClose={() => setPkgOpen(false)}
        onSave={async (body) => {
          setBusy(true);
          try {
            await api.createFeePackage(body);
            toast.success("Package created");
            setPkgOpen(false);
            await load();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not create package");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
};

function EnrollDialog({
  open,
  students,
  packages,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  students: Student[];
  packages: FeePackage[];
  busy: boolean;
  onClose: () => void;
  onSave: (body: { studentId: string; packageId?: string; startMonth?: string; months?: number; monthlyAmount?: number; packageName?: string }) => Promise<void>;
}) {
  const [studentId, setStudentId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [startMonth, setStartMonth] = useState(currentMonth());
  const [mode, setMode] = useState<"package" | "monthly">("package");

  useEffect(() => {
    if (!open) return;
    setStudentId(students[0]?.id || "");
    setPackageId(packages[0]?.id || "");
    setStartMonth(currentMonth());
    setMode("package");
  }, [open, students, packages]);

  const selectedPkg = packages.find((p) => p.id === packageId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll on fee package</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Student</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/60">
            <button
              type="button"
              className={cn("flex-1 text-xs py-2 rounded-lg", mode === "package" ? "bg-primary/20 font-medium" : "text-muted-foreground")}
              onClick={() => setMode("package")}
            >
              Select package
            </button>
            <button
              type="button"
              className={cn("flex-1 text-xs py-2 rounded-lg", mode === "monthly" ? "bg-primary/20 font-medium" : "text-muted-foreground")}
              onClick={() => setMode("monthly")}
            >
              Monthly only
            </button>
          </div>
          {mode === "package" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Package</Label>
              <Select value={packageId} onValueChange={setPackageId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.months} mo · ₹{p.monthlyAmount.toLocaleString("en-IN")}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPkg && (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Creates {selectedPkg.months} dues from {startMonth} through package end. Total ₹{selectedPkg.totalAmount.toLocaleString("en-IN")}.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Creates a rolling 1-month enrollment using the student’s current monthly fee amount.
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Start month</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions().map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={busy || !studentId || (mode === "package" && !packageId)}
            onClick={() => {
              if (mode === "package") {
                void onSave({ studentId, packageId, startMonth });
              } else {
                const s = students.find((x) => x.id === studentId);
                void onSave({
                  studentId,
                  startMonth,
                  months: 1,
                  monthlyAmount: s?.feeAmount ?? 15000,
                  packageName: "Monthly",
                });
              }
            }}
          >
            {busy ? "Saving…" : "Enroll & create dues"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePackageDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (body: { name: string; description?: string; months: number; monthlyAmount: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [months, setMonths] = useState("3");
  const [monthlyAmount, setMonthlyAmount] = useState("15000");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setMonths("3");
    setMonthlyAmount("15000");
    setDescription("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create fee package</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quarterly HP" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Months</Label>
              <Input type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Monthly ₹</Label>
              <Input type="number" min={0} value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Package total: ₹{((Number(months) || 0) * (Number(monthlyAmount) || 0)).toLocaleString("en-IN")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-primary text-primary-foreground"
            disabled={
              busy ||
              !name.trim() ||
              !Number(months) ||
              monthlyAmount.trim() === "" ||
              !Number.isFinite(Number(monthlyAmount)) ||
              Number(monthlyAmount) < 0
            }
            onClick={() =>
              void onSave({
                name: name.trim(),
                description,
                months: Number(months),
                monthlyAmount: Number(monthlyAmount),
              })
            }
          >
            {busy ? "Saving…" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default Fees;

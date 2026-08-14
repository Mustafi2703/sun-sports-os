import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Phone, Wallet } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import type { Coach } from "@/lib/api";
import { cn } from "@/lib/utils";

const emptyForm = () => ({
  name: "",
  phone: "",
  specialty: "",
  email: "",
  salaryMonthly: "0",
  status: "active",
  joinDate: new Date().toISOString().slice(0, 10),
  notes: "",
});

const CoachesPage = () => {
  const { coaches, batches, students, api, refresh, inr, loading } = useAcademy();
  const [edit, setEdit] = useState<Coach | null | undefined>(undefined);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return coaches.filter((c) => {
      if (!q) return true;
      const hay = `${c.name} ${c.phone} ${c.specialty}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [coaches, q]);

  const salaryBill = coaches
    .filter((c) => c.status !== "inactive")
    .reduce((a, c) => a + (c.salaryMonthly || 0), 0);
  const activeCount = coaches.filter((c) => c.status !== "inactive").length;

  const open = (c?: Coach | null) => {
    setEdit(c === undefined ? undefined : c);
    setForm(
      c
        ? {
            name: c.name,
            phone: c.phone,
            specialty: c.specialty || "",
            email: c.email || "",
            salaryMonthly: String(c.salaryMonthly ?? 0),
            status: c.status || "active",
            joinDate: c.joinDate || new Date().toISOString().slice(0, 10),
            notes: c.notes || "",
          }
        : emptyForm()
    );
  };

  const save = async () => {
    if (!form.name.trim() || form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Name and 10-digit phone required");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone,
        specialty: form.specialty,
        email: form.email,
        salaryMonthly: Number(form.salaryMonthly) || 0,
        status: form.status,
        joinDate: form.joinDate || undefined,
        notes: form.notes || undefined,
      };
      if (edit) await api.updateCoach(edit.id, body);
      else await api.createCoach(body);
      toast.success(edit ? "Coach updated" : "Coach added — portal login ready");
      setEdit(undefined);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Coach) => {
    if (!confirm(`Delete coach ${c.name}? Batches will be unassigned.`)) return;
    try {
      await api.deleteCoach(c.id);
      toast.success("Coach removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Coach Management"
        description="Manage coaches, salaries, specialties, and portal phones."
        actions={
          <Button className="bg-primary text-primary-foreground" onClick={() => open(null)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add coach
          </Button>
        }
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard label="Active coaches" value={String(activeCount)} icon={<Phone className="h-4 w-4" />} />
        <StatCard label="Monthly salary bill" value={inr(salaryBill)} icon={<Wallet className="h-4 w-4" />} tone="success" />
        <StatCard label="Total coaches" value={String(coaches.length)} icon={<Phone className="h-4 w-4" />} hint={loading ? "Loading…" : undefined} />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <Input placeholder="Search coaches" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Coach</th>
                <th className="text-left px-4 py-3 font-medium">Phone / portal</th>
                <th className="text-left px-4 py-3 font-medium">Specialty</th>
                <th className="text-left px-4 py-3 font-medium">Batches</th>
                <th className="text-left px-4 py-3 font-medium">Players</th>
                <th className="text-left px-4 py-3 font-medium">Salary / mo</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => {
                const myBatches = batches.filter((b) => b.coachId === c.id);
                const batchIds = new Set(myBatches.map((b) => b.id));
                const playerCount = students.filter((s) => batchIds.has(s.batchId)).length;
                return (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.specialty || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{myBatches.length}</td>
                    <td className="px-4 py-3 text-muted-foreground">{playerCount}</td>
                    <td className="px-4 py-3 font-medium">{inr(c.salaryMonthly || 0)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "capitalize",
                          c.status === "inactive"
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/15 text-primary border-primary/30"
                        )}
                      >
                        {c.status || "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => open(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void remove(c)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={edit !== undefined} onOpenChange={(o) => !o && setEdit(undefined)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit ? "Edit coach" : "Add coach"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone (portal login)</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Specialty</Label>
                <Input value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monthly salary (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.salaryMonthly}
                  onChange={(e) => setForm((f) => ({ ...f, salaryMonthly: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Join date</Label>
                <Input
                  type="date"
                  value={form.joinDate}
                  onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(undefined)}>Cancel</Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function StatCard({
  label,
  value,
  icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "success";
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", tone === "success" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
          {icon}
        </div>
      </div>
      <p className="font-display text-xl font-semibold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export default CoachesPage;

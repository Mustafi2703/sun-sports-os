import { useMemo, useState } from "react";
import { CreditCard, AlertTriangle, Calendar, Send, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { useAcademy } from "@/context/AcademyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FEE_BADGES: Record<string, string> = {
  paid: "bg-primary/15 text-primary border-primary/30",
  overdue1: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  overdue8: "bg-destructive/15 text-destructive border-destructive/30",
};
const FEE_LABEL: Record<string, string> = { paid: "Paid", overdue1: "Overdue 1-7d", overdue8: "Overdue 8+d" };

const Fees = () => {
  const { students, getBatch, monthlyRevenue, overdueAmount, inr, api, refresh } = useAcademy();
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);

  const filtered = useMemo(() => students.filter(s => {
    if (tab === "all") return true;
    return s.feeStatus === tab;
  }), [tab, students]);

  const upcoming = students.slice(0, 8).reduce((a, s) => a + s.feeAmount, 0);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const overdueIds = students.filter(s => s.feeStatus !== "paid").map(s => s.id);

  const recordPayment = async (studentId: string, amount: number) => {
    try {
      await api.createPayment({ studentId, amount, method: "cash", month: "Jul 2026", note: "Manual entry" });
      toast.success("Payment recorded");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Management" description="Track collections, send reminders, and reconcile payments." />

      <div className="grid sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Collected this month" value={inr(monthlyRevenue)} icon={<CreditCard className="h-4 w-4" />} tone="success" trend={{ value: "+12%", up: true }} />
        <StatCard label="Total overdue" value={inr(overdueAmount)} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" hint="23 students" />
        <StatCard label="Upcoming next 7 days" value={inr(upcoming)} icon={<Calendar className="h-4 w-4" />} hint="8 students" />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue1">1-7 days</TabsTrigger>
              <TabsTrigger value="overdue8">8+ days</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button size="sm" onClick={() => setPreviewIds(Array.from(selected))} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Bulk Reminder ({selected.size})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setPreviewIds(overdueIds)}>
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> Remind all overdue
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Batch</th>
                <th className="text-left px-4 py-3 font-medium">Amount</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Days</th>
                <th className="text-right px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => {
                const b = getBatch(s.batchId);
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3"><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} /></td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium">{inr(s.feeAmount)}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={FEE_BADGES[s.feeStatus]}>{FEE_LABEL[s.feeStatus]}</Badge></td>
                    <td className={cn("px-4 py-3", s.feeStatus === "overdue8" ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {s.daysOverdue > 0 ? `${s.daysOverdue}d` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      {s.feeStatus !== "paid" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void recordPayment(s.id, s.feeAmount)}>Record payment</Button>
                          <Button size="sm" variant="outline" onClick={() => setPreviewIds([s.id])}>Remind</Button>
                        </>
                      )}
                      {s.feeStatus === "paid" && <span className="text-xs text-muted-foreground">Paid</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ReminderModal ids={previewIds} students={students} onClose={() => { setPreviewIds(null); setSelected(new Set()); }} />
    </div>
  );
};

const ReminderModal = ({ ids, students, onClose }: { ids: string[] | null; students: { id: string; name: string; feeAmount: number; daysOverdue: number; parentName: string }[]; onClose: () => void }) => {
  if (!ids) return null;
  const sample = students.find(s => s.id === ids[0]);
  if (!sample) return null;
  const amount = "₹" + sample.feeAmount.toLocaleString("en-IN");
  return (
    <Dialog open={!!ids} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>WhatsApp Reminder Preview</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-emerald-950/40 border border-emerald-700/30 p-4">
          <div className="rounded-lg bg-emerald-900/40 p-3 text-sm text-foreground/90 leading-relaxed">
            Hi <span className="font-semibold">{sample.parentName}</span>, this is a friendly reminder that <span className="font-semibold">{sample.name}'s</span> fee of <span className="font-semibold">{amount}</span> for July 2026 is overdue.
            <br /><br />
            Please pay at your earliest convenience:
            <br />
            <span className="inline-block mt-2 text-emerald-300 underline">[Pay Now via UPI →]</span>
            <br /><br />
            Sun Sports — High Performance
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {ids.length === 1 ? "1 message will be sent" : `${ids.length} messages will be sent — each personalized with parent name, student name and amount.`}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { toast.success(`${ids.length} reminder${ids.length>1?'s':''} queued (Meta Business connection pending)`); onClose(); }}>
            <Send className="h-4 w-4 mr-1.5" /> Confirm & Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Fees;
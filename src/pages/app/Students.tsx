import { useMemo, useState } from "react";
import { Search, Grid3x3, List, MessageCircle, Eye } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { students, batches, getBatch, getCoach, initialsOf, initialsColor, inr } from "@/data/academy";
import { StudentDetailModal } from "@/components/app/StudentDetailModal";
import { cn } from "@/lib/utils";

const FEE_BADGES: Record<string, string> = {
  paid: "bg-primary/15 text-primary border-primary/30",
  overdue1: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  overdue8: "bg-destructive/15 text-destructive border-destructive/30",
};
const FEE_LABEL: Record<string, string> = { paid: "Paid", overdue1: "Overdue", overdue8: "Critical" };

const Students = () => {
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [feeFilter, setFeeFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => students.filter(s => {
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    if (batchFilter !== "all" && s.batchId !== batchFilter) return false;
    if (feeFilter !== "all" && s.feeStatus !== feeFilter) return false;
    return true;
  }), [q, batchFilter, feeFilter]);

  return (
    <div className="space-y-5">
      <PageHeader title="Students" description={`${students.length} active athletes across ${batches.length} batches.`} />

      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search students..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={feeFilter} onValueChange={setFeeFilter}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Fee status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue1">Overdue 1-7d</SelectItem>
            <SelectItem value="overdue8">Overdue 8+d</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border border-border">
          <button onClick={() => setView("grid")} className={cn("px-3 py-2", view === "grid" ? "bg-primary/15 text-primary" : "text-muted-foreground")}><Grid3x3 className="h-4 w-4" /></button>
          <button onClick={() => setView("list")} className={cn("px-3 py-2", view === "list" ? "bg-primary/15 text-primary" : "text-muted-foreground")}><List className="h-4 w-4" /></button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : view === "grid" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(s => {
            const b = getBatch(s.batchId)!;
            const c = getCoach(b.coachId)!;
            return (
              <div key={s.id} className="rounded-2xl border border-border bg-card p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={cn("h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm", initialsColor(s.name))}>
                    {initialsOf(s.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.name}{s.role ? ` · ${s.role}` : ""} • {c.name}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant="outline" className={cn("text-[10px]", FEE_BADGES[s.feeStatus])}>{FEE_LABEL[s.feeStatus]} • {inr(s.feeAmount)}</Badge>
                  <span className={cn("text-xs font-medium", s.attendancePct < 70 ? "text-destructive" : "text-primary")}>{s.attendancePct}%</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setOpenId(s.id)}>
                    <Eye className="h-3 w-3 mr-1" /> View
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs">
                    <MessageCircle className="h-3 w-3 mr-1" /> Message
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Batch</th>
                <th className="text-left px-4 py-3 font-medium">Fee</th>
                <th className="text-left px-4 py-3 font-medium">Attendance</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(s => {
                const b = getBatch(s.batchId)!;
                return (
                  <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold", initialsColor(s.name))}>{initialsOf(s.name)}</div>
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{b.name}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className={FEE_BADGES[s.feeStatus]}>{FEE_LABEL[s.feeStatus]}</Badge></td>
                    <td className={cn("px-4 py-3 font-medium", s.attendancePct < 70 ? "text-destructive" : "text-primary")}>{s.attendancePct}%</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>View</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <StudentDetailModal studentId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
};

const EmptyState = () => (
  <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
    <div className="text-5xl mb-3">🏏</div>
    <p className="font-display font-semibold">No students match your filters</p>
    <p className="text-sm text-muted-foreground mt-1">Try clearing your filters or adding a new student.</p>
  </div>
);

export default Students;
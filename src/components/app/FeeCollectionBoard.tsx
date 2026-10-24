import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FeeLedger, FeeLedgerMonth } from "@/lib/api";

type Filter = "due" | "received" | "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "due", label: "To collect" },
  { id: "received", label: "Received" },
  { id: "all", label: "All players" },
];

function monthTone(status: FeeLedgerMonth["status"]) {
  if (status === "paid") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "overdue") return "border-destructive/30 bg-destructive/10";
  if (status === "upcoming") return "border-border bg-muted/30 text-muted-foreground";
  return "border-amber-500/30 bg-amber-500/10";
}

export function FeeCollectionBoard({
  ledger,
  inr,
  busyKey,
  onMark,
}: {
  ledger: FeeLedger | null;
  inr: (n: number) => string;
  busyKey: string | null;
  onMark: (studentId: string, studentName: string, month: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("due");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (ledger?.rows ?? []).filter((row) => {
      if (filter === "due" && row.openMonths === 0) return false;
      if (filter === "received" && row.openMonths > 0) return false;
      if (!query) return true;
      return (
        row.studentName.toLowerCase().includes(query) ||
        row.parentName.toLowerCase().includes(query) ||
        row.parentPhone.includes(query)
      );
    });
  }, [ledger, filter, q]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground">Still to collect</p>
          <p className="font-display text-xl font-bold mt-1">{inr(ledger?.toCollect ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {ledger?.peopleToCollect ?? 0} player{(ledger?.peopleToCollect ?? 0) === 1 ? "" : "s"} · through {ledger?.asOfMonth || "this month"}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Received</p>
          <p className="font-display text-xl font-bold mt-1">{inr(ledger?.received ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">All recorded months</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Clear</p>
          <p className="font-display text-xl font-bold mt-1">{ledger?.peopleClear ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">No month left to collect</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "px-3 py-2 text-xs rounded-md min-h-[36px]",
                filter === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search player or parent phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {rows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "due" ? "Nothing left to collect." : "No players in this view."}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.studentId} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{row.studentName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {row.parentName || "Parent"} · {row.parentPhone || "no phone"} · {inr(row.monthlyAmount)}/mo
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn("text-sm font-semibold", row.toCollect > 0 ? "text-destructive" : "text-primary")}>
                  {row.toCollect > 0 ? inr(row.toCollect) : "Clear"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {row.toCollect > 0 ? "to collect" : `Received ${inr(row.received)}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {row.months.map((month) => {
                const open = month.status === "pending" || month.status === "overdue";
                const key = `${row.studentId}:${month.monthLabel}`;
                return (
                  <div
                    key={month.monthLabel}
                    className={cn("min-w-[148px] rounded-xl border px-3 py-2 space-y-1.5", monthTone(month.status))}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{month.monthLabel}</p>
                      {month.status === "paid" && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                    <p className="text-sm font-semibold">{inr(month.amount)}</p>
                    {month.status === "paid" ? (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Received</Badge>
                    ) : month.status === "upcoming" ? (
                      <Badge variant="outline" className="text-[10px]">Later</Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 w-full bg-primary text-primary-foreground"
                        disabled={busyKey === key}
                        onClick={() => onMark(row.studentId, row.studentName, month.monthLabel)}
                      >
                        <Banknote className="h-3.5 w-3.5 mr-1" />
                        {busyKey === key ? "…" : "Mark received"}
                      </Button>
                    )}
                    {open && month.status === "overdue" && (
                      <p className="text-[10px] text-destructive">Not received yet</p>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

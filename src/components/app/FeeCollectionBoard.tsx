import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { FeeLedger, FeeLedgerMonth, FeeLedgerRow } from "@/lib/api";

type Filter = "due" | "received" | "all";
const ALL_MONTHS = "all";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "due", label: "To collect" },
  { id: "received", label: "Received" },
  { id: "all", label: "All players" },
];

function monthIndex(label: string) {
  const d = new Date(`${label} 1`);
  if (Number.isNaN(d.getTime())) return 0;
  return d.getFullYear() * 12 + d.getMonth();
}

function monthLabel(d: Date) {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function monthOptions(ledger: FeeLedger | null) {
  const labels = new Set<string>();
  const now = new Date();
  for (let i = 17; i >= -2; i--) {
    labels.add(monthLabel(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  for (const row of ledger?.rows ?? []) {
    for (const month of row.months) labels.add(month.monthLabel);
  }
  return [...labels].sort((a, b) => monthIndex(a) - monthIndex(b));
}

function monthTone(status: FeeLedgerMonth["status"]) {
  if (status === "paid") return "border-primary/30 bg-primary/10 text-primary";
  if (status === "overdue") return "border-destructive/30 bg-destructive/10";
  if (status === "upcoming") return "border-border bg-muted/30 text-muted-foreground";
  return "border-amber-500/30 bg-amber-500/10";
}

function monthSlice(row: FeeLedgerRow, selected: string, asOf: string): FeeLedgerMonth {
  const wanted = monthIndex(selected);
  const found = row.months.find((month) => month.monthLabel === selected || monthIndex(month.monthLabel) === wanted);
  if (found) return { ...found, monthLabel: found.monthLabel };
  const current = monthIndex(asOf || monthLabel(new Date()));
  const status: FeeLedgerMonth["status"] = wanted > current ? "upcoming" : wanted < current ? "overdue" : "pending";
  return { monthLabel: selected, amount: row.monthlyAmount, status, paidAt: null };
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
  const [month, setMonth] = useState<string | null>(null);
  const selected = month || ledger?.asOfMonth || monthLabel(new Date());
  const options = useMemo(() => monthOptions(ledger), [ledger]);

  const monthRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const asOf = ledger?.asOfMonth || monthLabel(new Date());
    return (ledger?.rows ?? [])
      .map((row) => ({ row, month: selected === ALL_MONTHS ? null : monthSlice(row, selected, asOf) }))
      .filter(({ row, month: slice }) => {
        if (selected !== ALL_MONTHS && slice) {
          const open = slice.status === "pending" || slice.status === "overdue" || slice.status === "upcoming";
          if (filter === "due" && !open) return false;
          if (filter === "received" && slice.status !== "paid") return false;
        } else {
          if (filter === "due" && row.openMonths === 0) return false;
          if (filter === "received" && row.openMonths > 0) return false;
        }
        if (!query) return true;
        return (
          row.studentName.toLowerCase().includes(query) ||
          row.parentName.toLowerCase().includes(query) ||
          row.parentPhone.includes(query)
        );
      });
  }, [ledger, filter, q, selected]);

  const monthTotals = useMemo(() => {
    if (selected === ALL_MONTHS || !ledger) return null;
    const asOf = ledger.asOfMonth || monthLabel(new Date());
    const slices = ledger.rows.map((row) => monthSlice(row, selected, asOf));
    const open = slices.filter((item) => item.status !== "paid");
    const paid = slices.filter((item) => item.status === "paid");
    return {
      toCollect: open.reduce((sum, item) => sum + item.amount, 0),
      received: paid.reduce((sum, item) => sum + item.amount, 0),
      peopleToCollect: open.length,
      peopleClear: paid.length,
    };
  }, [ledger, selected]);

  const toCollect = monthTotals?.toCollect ?? ledger?.toCollect ?? 0;
  const received = monthTotals?.received ?? ledger?.received ?? 0;
  const peopleToCollect = monthTotals?.peopleToCollect ?? ledger?.peopleToCollect ?? 0;
  const peopleClear = monthTotals?.peopleClear ?? ledger?.peopleClear ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-xs text-muted-foreground">Still to collect{selected !== ALL_MONTHS ? ` · ${selected}` : ""}</p>
          <p className="font-display text-xl font-bold mt-1">{inr(toCollect)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {peopleToCollect} player{peopleToCollect === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Received{selected !== ALL_MONTHS ? ` · ${selected}` : ""}</p>
          <p className="font-display text-xl font-bold mt-1">{inr(received)}</p>
          <p className="text-xs text-muted-foreground mt-1">{selected === ALL_MONTHS ? "All recorded months" : "Marked for this month"}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Clear</p>
          <p className="font-display text-xl font-bold mt-1">{peopleClear}</p>
          <p className="text-xs text-muted-foreground mt-1">{selected === ALL_MONTHS ? "No month left to collect" : "Received this month"}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <Select value={selected} onValueChange={setMonth}>
          <SelectTrigger className="w-full lg:w-52 h-10">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MONTHS}>All months</SelectItem>
            {[...options].reverse().map((label) => (
              <SelectItem key={label} value={label}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      <p className="text-xs text-muted-foreground">
        Pick a month, including older months, and mark that month received. A month already received stays locked.
      </p>

      {monthRows.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {filter === "due" ? "Nothing left to collect for this view." : "No players in this view."}
        </p>
      )}

      {selected !== ALL_MONTHS ? (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {monthRows.map(({ row, month: slice }) => {
            if (!slice) return null;
            const key = `${row.studentId}:${slice.monthLabel}`;
            const open = slice.status !== "paid";
            return (
              <div key={row.studentId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.studentName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.parentName || "Parent"} · {row.parentPhone || "no phone"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-semibold">{inr(slice.amount)}</p>
                  {open ? (
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground"
                      disabled={busyKey === key}
                      onClick={() => onMark(row.studentId, row.studentName, slice.monthLabel)}
                    >
                      <Banknote className="h-3.5 w-3.5 mr-1" />
                      {busyKey === key ? "…" : "Mark received"}
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Received
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {monthRows.map(({ row }) => (
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
                {row.months.map((item) => {
                  const key = `${row.studentId}:${item.monthLabel}`;
                  const open = item.status !== "paid";
                  return (
                    <div key={item.monthLabel} className={cn("min-w-[148px] rounded-xl border px-3 py-2 space-y-1.5", monthTone(item.status))}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium">{item.monthLabel}</p>
                        {item.status === "paid" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </div>
                      <p className="text-sm font-semibold">{inr(item.amount)}</p>
                      {open ? (
                        <Button
                          size="sm"
                          className="h-8 w-full bg-primary text-primary-foreground"
                          disabled={busyKey === key}
                          onClick={() => onMark(row.studentId, row.studentName, item.monthLabel)}
                        >
                          {busyKey === key ? "…" : "Mark received"}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Received</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/** Month label helpers — "Aug 2026" style used across fee packages */

export function monthLabelFromDate(d: Date): string {
  return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

export function parseMonthLabel(label: string): Date {
  const d = new Date(`${label} 1`);
  if (Number.isNaN(d.getTime())) {
    // Fallback: try "Aug 2026"
    const parts = label.trim().split(/\s+/);
    if (parts.length >= 2) {
      const try2 = new Date(`${parts[0]} 1, ${parts[1]}`);
      if (!Number.isNaN(try2.getTime())) return try2;
    }
    return new Date();
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

export function buildMonthSchedule(startLabel: string, months: number): { monthLabel: string; dueDate: Date }[] {
  const start = parseMonthLabel(startLabel);
  const out: { monthLabel: string; dueDate: Date }[] = [];
  for (let i = 0; i < months; i++) {
    const due = addMonths(start, i);
    out.push({ monthLabel: monthLabelFromDate(due), dueDate: due });
  }
  return out;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(0, Math.floor((b - a) / 86400000));
}

/** Map installment status → student.feeStatus for parent/team dashboards */
export function studentFeeFieldsFromInstallment(inst: {
  status: string;
  amount: number;
  daysOverdue: number;
} | null): { feeStatus: string; feeAmount: number; daysOverdue: number } {
  if (!inst) {
    return { feeStatus: "paid", feeAmount: 0, daysOverdue: 0 };
  }
  if (inst.status === "paid") {
    return { feeStatus: "paid", feeAmount: inst.amount, daysOverdue: 0 };
  }
  const days = inst.daysOverdue || 0;
  return {
    feeStatus: days >= 8 ? "overdue8" : "overdue1",
    feeAmount: inst.amount,
    daysOverdue: days,
  };
}

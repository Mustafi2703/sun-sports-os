import { prisma } from "./prisma.js";

/** Recompute attendancePct from real AttendanceRecord rows (present+late count as attended). */
export async function recomputeAttendancePct(studentId: string) {
  const records = await prisma.attendanceRecord.findMany({ where: { studentId } });
  if (!records.length) {
    await prisma.student.update({ where: { id: studentId }, data: { attendancePct: 0 } });
    return 0;
  }
  const attended = records.filter((r) => r.status === "present" || r.status === "late").length;
  const pct = Math.round((attended / records.length) * 100);
  await prisma.student.update({ where: { id: studentId }, data: { attendancePct: pct } });
  return pct;
}

export async function recomputeAttendancePctMany(studentIds: string[]) {
  await Promise.all([...new Set(studentIds)].map((id) => recomputeAttendancePct(id)));
}

/** Last N calendar days for a student — real DB marks only (none = no session recorded). */
export async function attendanceGrid(studentId: string, days = 30) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const records = await prisma.attendanceRecord.findMany({
    where: { studentId, date: { gte: start, lte: end } },
  });
  const byDay = new Map(
    records.map((r) => [r.date.toISOString().slice(0, 10), r.status as "present" | "absent" | "late"])
  );

  const grid: { date: string; status: "present" | "absent" | "late" | "none" }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    grid.push({ date: key, status: byDay.get(key) ?? "none" });
  }
  return grid;
}

/** Weekly present% per batch for the last 4 weeks from real records. */
export async function attendanceByBatchWeeks() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 28);
  start.setHours(0, 0, 0, 0);

  const [batches, records] = await Promise.all([
    prisma.batch.findMany({ orderBy: { name: "asc" } }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: start, lte: end } },
    }),
  ]);

  const weekIndex = (d: Date) => {
    const diff = Math.floor((end.getTime() - d.getTime()) / (86400000));
    return Math.min(3, Math.max(0, Math.floor(diff / 7))); // 0 = most recent week → map to w4
  };

  return batches.map((b) => {
    const weeks = [0, 0, 0, 0].map(() => ({ present: 0, total: 0 }));
    for (const r of records) {
      if (r.batchId !== b.id) continue;
      const wi = 3 - weekIndex(new Date(r.date)); // w1 oldest … w4 newest
      weeks[wi].total += 1;
      if (r.status === "present" || r.status === "late") weeks[wi].present += 1;
    }
    const pct = (w: { present: number; total: number }) =>
      w.total ? Math.round((w.present / w.total) * 100) : 0;
    return {
      batch: b.name,
      batchId: b.id,
      w1: pct(weeks[0]),
      w2: pct(weeks[1]),
      w3: pct(weeks[2]),
      w4: pct(weeks[3]),
    };
  });
}

export async function monthlyRevenueFromPayments() {
  const now = new Date();
  const series: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const agg = await prisma.feePayment.aggregate({
      where: { paidAt: { gte: d, lt: next } },
      _sum: { amount: true },
    });
    series.push({
      month: d.toLocaleString("en-IN", { month: "short" }),
      revenue: agg._sum.amount ?? 0,
    });
  }
  return series;
}

export async function recentActivityFeed(limit = 8) {
  const [payments, attendance] = await Promise.all([
    prisma.feePayment.findMany({
      include: { student: true },
      orderBy: { paidAt: "desc" },
      take: 5,
    }),
    prisma.attendanceRecord.findMany({
      include: { student: true, batch: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  type Item = { type: string; text: string; time: string; tone: "success" | "warning" | "info" | "default"; at: Date };
  const items: Item[] = [];

  for (const p of payments) {
    items.push({
      type: "payment",
      text: `${p.student.name} paid ₹${p.amount.toLocaleString("en-IN")} via ${p.method}`,
      time: relativeTime(p.paidAt),
      tone: "success",
      at: p.paidAt,
    });
  }
  for (const a of attendance) {
    if (a.status === "absent") {
      items.push({
        type: "absent",
        text: `${a.student.name} marked absent${a.batch ? ` — ${a.batch.name}` : ""}`,
        time: relativeTime(a.createdAt),
        tone: "warning",
        at: a.createdAt,
      });
    } else {
      items.push({
        type: "attendance",
        text: `${a.student.name} marked ${a.status}${a.batch ? ` — ${a.batch.name}` : ""}`,
        time: relativeTime(a.createdAt),
        tone: "default",
        at: a.createdAt,
      });
    }
  }

  return items
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit)
    .map(({ type, text, time, tone }) => ({ type, text, time, tone }));
}

function relativeTime(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export async function todayAttendanceStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const records = await prisma.attendanceRecord.findMany({ where: { date: today } });
  const present = records.filter((r) => r.status === "present" || r.status === "late").length;
  return { marked: records.length, present, absent: records.filter((r) => r.status === "absent").length };
}

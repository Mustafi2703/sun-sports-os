import { attendancePercent, countsTowardWeeklyTotal, isWeekend } from "./academyDays.js";
import { prisma } from "./prisma.js";

const MARKABLE = new Set(["present", "absent", "no_session"]);
const HISTORICAL = new Set(["late", "leave"]);

export class AttendanceWriteError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Calendar date from a request body. Same parsing the attendance routes used before. */
export function parseSessionDate(raw: unknown): { date: Date; iso: string } {
  const iso = String(raw ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new AttendanceWriteError(400, "Date is not valid.");
  }
  const date = new Date(iso);
  date.setHours(0, 0, 0, 0);
  return { date, iso };
}

/**
 * Save present, absent, or no-session marks.
 * Does not create leave or late rows, and does not change a row that is already leave or late.
 * Refuses the whole save on Saturday or Sunday so weekend rows stay as they are.
 */
export async function writeAttendanceMarks(opts: {
  date: Date;
  iso: string;
  batchId: string | null;
  marks: { studentId: string; status: string; note?: string }[];
}) {
  if (isWeekend(opts.iso) || isWeekend(opts.date)) {
    throw new AttendanceWriteError(
      400,
      "No session on Saturday or Sunday. Attendance is not marked on weekends."
    );
  }
  if (!opts.marks.length) throw new AttendanceWriteError(400, "marks required");

  const existing = await prisma.attendanceRecord.findMany({
    where: {
      date: opts.date,
      studentId: { in: opts.marks.map((m) => m.studentId) },
    },
  });
  const byStudent = new Map(existing.map((r) => [r.studentId, r]));

  const toWrite: { studentId: string; status: string; note?: string }[] = [];
  let kept = 0;
  for (const m of opts.marks) {
    const prev = byStudent.get(m.studentId);
    if ((prev && HISTORICAL.has(prev.status)) || HISTORICAL.has(m.status)) {
      kept += 1;
      continue;
    }
    if (!MARKABLE.has(m.status)) {
      throw new AttendanceWriteError(400, "Status must be present, absent, or no session.");
    }
    toWrite.push(m);
  }

  if (!toWrite.length) {
    throw new AttendanceWriteError(
      400,
      kept
        ? "Leave and late are no longer attendance options. Saved leave and late marks stay as they are."
        : "marks required"
    );
  }

  await prisma.$transaction(
    toWrite.map((m) => {
      const note = m.note != null && String(m.note).trim() ? String(m.note).trim() : null;
      return prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: m.studentId, date: opts.date } },
        create: {
          studentId: m.studentId,
          batchId: opts.batchId,
          date: opts.date,
          status: m.status,
          note,
        },
        update: {
          status: m.status,
          batchId: opts.batchId,
          note,
        },
      });
    })
  );
  await recomputeAttendancePctMany(toWrite.map((m) => m.studentId));
  return { ok: true as const, count: toWrite.length, kept };
}

/**
 * Percent from saved rows, written onto the student. Does not change attendance rows.
 * Students with no rows are stored as 0, same as before.
 */
export async function recomputeAttendancePct(studentId: string) {
  const records = await prisma.attendanceRecord.findMany({ where: { studentId } });
  const pct = records.length ? attendancePercent(records) : 0;
  await prisma.student.update({ where: { id: studentId }, data: { attendancePct: pct } });
  return pct;
}

/**
 * Live percent for screens. Students with no attendance rows are omitted so a stored
 * default is left untouched. This does not write.
 */
export async function liveAttendancePctByStudent(studentIds: string[]) {
  const map = new Map<string, number>();
  if (!studentIds.length) return map;
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, status: true, date: true },
  });
  const grouped = new Map<string, { status: string; date: Date }[]>();
  for (const r of records) {
    const list = grouped.get(r.studentId);
    if (list) list.push(r);
    else grouped.set(r.studentId, [r]);
  }
  for (const [id, rows] of grouped) map.set(id, attendancePercent(rows));
  return map;
}

export async function recomputeAttendancePctMany(studentIds: string[]) {
  await Promise.all([...new Set(studentIds)].map((id) => recomputeAttendancePct(id)));
}

/** Last N calendar days for a student — real DB marks + academy closures. */
export async function attendanceGrid(studentId: string, days = 30) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { batchId: true },
  });

  const [records, closures] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId, date: { gte: start, lte: end } },
    }),
    prisma.academyClosure.findMany({
      where: {
        date: { gte: start, lte: end },
        OR: [
          { scope: "academy" },
          ...(student?.batchId
            ? [{ scope: "batch" as const, batchId: student.batchId }]
            : []),
        ],
      },
    }),
  ]);

  const byDay = new Map(
    records.map((r) => [
      r.date.toISOString().slice(0, 10),
      {
        status: r.status as "present" | "absent" | "late" | "leave" | "no_session",
        note: r.note || "",
      },
    ])
  );
  const closureByDay = new Map(
    closures.map((c) => [
      c.date.toISOString().slice(0, 10),
      { title: c.title, reason: c.reason || "", type: c.type },
    ])
  );

  const grid: {
    date: string;
    status: "present" | "absent" | "late" | "leave" | "no_session" | "none";
    note?: string;
    closureTitle?: string;
    closureReason?: string;
    offReason?: "weekend" | "closure";
  }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const mark = byDay.get(key);
    const closure = closureByDay.get(key);
    const weekend = isWeekend(key);
    if (closure && (!mark || mark.status === "no_session")) {
      grid.push({
        date: key,
        status: "no_session",
        note: mark?.note || "",
        closureTitle: closure.title,
        closureReason: closure.reason,
        offReason: weekend ? "weekend" : "closure",
      });
    } else if (mark) {
      grid.push({
        date: key,
        status: mark.status,
        note: mark.note,
        closureTitle: closure?.title,
        closureReason: closure?.reason,
        ...(weekend ? { offReason: "weekend" as const } : {}),
      });
    } else if (weekend) {
      grid.push({
        date: key,
        status: "no_session",
        note: "",
        closureTitle: "Weekend",
        closureReason: "No sessions on Saturday or Sunday",
        offReason: "weekend",
      });
    } else {
      grid.push({ date: key, status: "none" });
    }
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
      if (!countsTowardWeeklyTotal(r)) continue;
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
      where: { paidAt: { gte: d, lt: next }, reversedAt: null },
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
  const [payments, reversals, attendance] = await Promise.all([
    prisma.feePayment.findMany({
      where: { reversedAt: null },
      include: { student: true },
      orderBy: { paidAt: "desc" },
      take: 5,
    }),
    prisma.feePayment.findMany({
      where: { reversedAt: { not: null } },
      include: { student: true },
      orderBy: { reversedAt: "desc" },
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
  for (const p of reversals) {
    if (!p.reversedAt) continue;
    items.push({
      type: "payment-reversed",
      text: `${p.student.name} fee receipt reversed${p.month ? ` (${p.month})` : ""}`,
      time: relativeTime(p.reversedAt),
      tone: "warning",
      at: p.reversedAt,
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
  const iso = new Date().toISOString().slice(0, 10);
  if (isWeekend(iso)) {
    return { marked: 0, present: 0, absent: 0, offDay: true };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const records = await prisma.attendanceRecord.findMany({ where: { date: today } });
  const present = records.filter((r) => r.status === "present" || r.status === "late").length;
  return {
    marked: records.length,
    present,
    absent: records.filter((r) => r.status === "absent").length,
    offDay: false,
  };
}

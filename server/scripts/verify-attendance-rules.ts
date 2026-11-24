/**
 * Local check only. Creates sample rows, checks weekend and leave/late rules, then deletes those rows.
 * Refuses to run unless DATABASE_URL points at localhost.
 *
 * From server/:
 *   npx tsx scripts/verify-attendance-rules.ts
 */
import { prisma } from "../src/lib/prisma.js";
import { attendancePercent, isWeekend } from "../src/lib/academyDays.js";
import {
  AttendanceWriteError,
  attendanceByBatchWeeks,
  attendanceGrid,
  recomputeAttendancePct,
  writeAttendanceMarks,
} from "../src/lib/attendance.js";

const url = process.env.DATABASE_URL || "";
if (process.env.NODE_ENV === "production" || !/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to run. This check is for a local database only.");
  process.exit(1);
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("ok", msg);
}

function isoShift(days: number) {
  const [y, m, d] = new Date().toISOString().slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekday(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function findDay(target: number) {
  for (let i = 0; i < 14; i++) {
    const iso = isoShift(-i);
    if (weekday(iso) === target) return iso;
  }
  throw new Error(`No recent day ${target}`);
}

function asDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

type RowSnap = { id: string; status: string; note: string | null; updatedAt: string; date: string };

async function snap(studentId: string): Promise<RowSnap[]> {
  const rows = await prisma.attendanceRecord.findMany({ where: { studentId }, orderBy: { date: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    note: r.note,
    updatedAt: r.updatedAt.toISOString(),
    date: r.date.toISOString().slice(0, 10),
  }));
}

async function main() {
  assert(isWeekend("2026-11-21") && isWeekend("2026-11-22"), "21 and 22 Nov 2026 are weekend");
  assert(!isWeekend("2026-11-20") && !isWeekend("2026-11-23") && !isWeekend("2026-11-24"), "20, 23, 24 Nov 2026 are weekdays");
  assert(
    attendancePercent([
      { status: "present", date: "2026-11-20" },
      { status: "absent", date: "2026-11-21" },
      { status: "leave", date: "2026-11-22" },
      { status: "late", date: "2026-11-23" },
      { status: "absent", date: "2026-11-18" },
    ]) === 67,
    "percent ignores weekend absent and weekend leave, and still counts weekday late as attended"
  );

  const saturday = findDay(6);
  const sunday = findDay(0);
  const monday = findDay(1);
  const friday = findDay(5);
  const wednesday = findDay(3);
  const thursday = findDay(4);
  const olderSaturday = isoShift(-((weekday(isoShift(0)) + 1) % 7) - 7);
  assert(isWeekend(saturday) && isWeekend(sunday) && isWeekend(olderSaturday), "sample weekend dates");
  assert(!isWeekend(monday) && !isWeekend(friday) && !isWeekend(wednesday), "sample weekday dates");

  const tag = `verify-attendance-${Date.now()}`;
  const createdStudentIds: string[] = [];
  const createdBatchIds: string[] = [];
  let closureId = "";

  try {
    const batch = await prisma.batch.create({
      data: { name: `${tag} mixed`, schedule: "Sat and Sun extra", time: "5:00 PM", venue: "Ground" },
    });
    createdBatchIds.push(batch.id);
    const weekendBatch = await prisma.batch.create({
      data: { name: `${tag} weekend only`, schedule: "Saturday", time: "7:00 AM", venue: "Ground" },
    });
    createdBatchIds.push(weekendBatch.id);
    const weekdayBatch = await prisma.batch.create({
      data: { name: `${tag} weekday`, schedule: "Mon-Fri", time: "5:00 PM", venue: "Ground" },
    });
    createdBatchIds.push(weekdayBatch.id);

    const student = await prisma.student.create({
      data: { name: `${tag} player`, batchId: batch.id, attendancePct: 40, parentPhone: "9000000091" },
    });
    const other = await prisma.student.create({
      data: { name: `${tag} other`, batchId: batch.id, attendancePct: 40, parentPhone: "9000000092" },
    });
    const weekendPlayer = await prisma.student.create({
      data: { name: `${tag} weekend`, batchId: weekendBatch.id, attendancePct: 40 },
    });
    const weekdayPlayer = await prisma.student.create({
      data: { name: `${tag} weekday`, batchId: weekdayBatch.id, attendancePct: 40 },
    });
    createdStudentIds.push(student.id, other.id, weekendPlayer.id, weekdayPlayer.id);

    await prisma.attendanceRecord.createMany({
      data: [
        { studentId: student.id, batchId: batch.id, date: asDate(friday), status: "present", note: null },
        { studentId: student.id, batchId: batch.id, date: asDate(saturday), status: "absent", note: "old saturday" },
        { studentId: student.id, batchId: batch.id, date: asDate(sunday), status: "leave", note: "family function" },
        { studentId: student.id, batchId: batch.id, date: asDate(monday), status: "late", note: "arrived 10 min late" },
        { studentId: student.id, batchId: batch.id, date: asDate(wednesday), status: "absent", note: null },
        { studentId: weekendPlayer.id, batchId: weekendBatch.id, date: asDate(saturday), status: "absent", note: null },
        { studentId: weekdayPlayer.id, batchId: weekdayBatch.id, date: asDate(wednesday), status: "present", note: null },
      ],
    });

    const before = await snap(student.id);
    const closure = await prisma.academyClosure.create({
      data: {
        date: asDate(thursday),
        title: `${tag} rain`,
        reason: "Ground flooded",
        type: "rain",
        scope: "academy",
        batchId: "",
      },
    });
    closureId = closure.id;
    const weekendClosure = await prisma.academyClosure.create({
      data: {
        date: asDate(saturday),
        title: `${tag} saturday note`,
        reason: "Already off",
        type: "holiday",
        scope: "academy",
        batchId: "",
      },
    });

    const grid = await attendanceGrid(student.id, 30);
    const byDate = Object.fromEntries(grid.map((d) => [d.date, d]));
    assert(byDate[saturday]?.status === "absent" && byDate[saturday]?.offReason === "weekend", "saturday absent still rendered and marked as weekend");
    assert(byDate[saturday]?.note === "old saturday", "saturday note still rendered");
    assert(byDate[saturday]?.closureTitle === `${tag} saturday note`, "weekend closure title still shows");
    assert(byDate[sunday]?.status === "leave" && byDate[sunday]?.note === "family function", "sunday leave note still rendered");
    assert(byDate[sunday]?.offReason === "weekend", "sunday is an off day");
    assert(byDate[monday]?.status === "late" && !byDate[monday]?.offReason, "weekday late still rendered as a session");
    assert(byDate[wednesday]?.status === "absent" && !byDate[wednesday]?.offReason, "weekday absent still counts as a session day");
    assert(byDate[thursday]?.status === "no_session" && byDate[thursday]?.offReason === "closure", "published closure still shows as no session");
    assert(byDate[olderSaturday]?.status === "no_session" && byDate[olderSaturday]?.offReason === "weekend", "unmarked weekend looks like an off day");
    const olderRow = await prisma.attendanceRecord.findFirst({
      where: { studentId: student.id, date: asDate(olderSaturday) },
    });
    assert(!olderRow, "unmarked weekend did not create an attendance row");

    const pct = await recomputeAttendancePct(student.id);
    assert(pct === 67, `recomputed percent is 67, got ${pct}`);
    assert(JSON.stringify(await snap(student.id)) === JSON.stringify(before.map((r) => ({ ...r }))), "recompute did not change attendance rows");
    const afterPct = await snap(student.id);
    assert(afterPct.every((r, i) => r.updatedAt === before[i].updatedAt && r.status === before[i].status && r.note === before[i].note), "leave, late, and weekend rows are byte-for-byte the same after recompute");

    let weekendBlocked = false;
    try {
      await writeAttendanceMarks({
        date: asDate(saturday),
        iso: saturday,
        batchId: batch.id,
        marks: [{ studentId: student.id, status: "present" }],
      });
    } catch (e) {
      weekendBlocked = e instanceof AttendanceWriteError;
    }
    assert(weekendBlocked, "saving on Saturday is refused");
    assert(JSON.stringify(await snap(student.id)) === JSON.stringify(afterPct), "refused weekend save did not change rows");

    const mixed = await writeAttendanceMarks({
      date: asDate(monday),
      iso: monday,
      batchId: batch.id,
      marks: [
        { studentId: student.id, status: "present" },
        { studentId: other.id, status: "present", note: "on time" },
      ],
    });
    assert(mixed.count === 1 && mixed.kept === 1, "new present is saved and the old late row is kept");
    const late = await prisma.attendanceRecord.findFirst({ where: { studentId: student.id, date: asDate(monday) } });
    assert(late?.status === "late" && late.note === "arrived 10 min late", "late row status and note unchanged");
    assert(late?.updatedAt.toISOString() === before.find((r) => r.date === monday)?.updatedAt, "late row updatedAt unchanged");
    const otherMonday = await prisma.attendanceRecord.findFirst({ where: { studentId: other.id, date: asDate(monday) } });
    assert(otherMonday?.status === "present" && otherMonday.note === "on time", "other student can still be marked present");

    let leaveBlocked = false;
    try {
      await writeAttendanceMarks({
        date: asDate(thursday),
        iso: thursday,
        batchId: batch.id,
        marks: [{ studentId: other.id, status: "leave", note: "new leave" }],
      });
    } catch (e) {
      leaveBlocked = e instanceof AttendanceWriteError;
    }
    assert(leaveBlocked, "new leave status is refused");
    const newLeave = await prisma.attendanceRecord.findFirst({ where: { studentId: other.id, date: asDate(thursday) } });
    assert(!newLeave, "refused leave did not create a row");

    const weeks = await attendanceByBatchWeeks();
    const weekendOnly = weeks.find((w) => w.batchId === weekendBatch.id);
    const weekdayOnly = weeks.find((w) => w.batchId === weekdayBatch.id);
    assert(weekendOnly && weekendOnly.w1 === 0 && weekendOnly.w2 === 0 && weekendOnly.w3 === 0 && weekendOnly.w4 === 0, "a weekend-only absent does not lower the weekly percent");
    assert(weekdayOnly && [weekdayOnly.w1, weekdayOnly.w2, weekdayOnly.w3, weekdayOnly.w4].includes(100), "a weekday present still counts in the weekly percent");

    await prisma.academyClosure.delete({ where: { id: weekendClosure.id } });
    console.log("All attendance rule checks passed.");
  } finally {
    if (createdStudentIds.length) {
      await prisma.attendanceRecord.deleteMany({ where: { studentId: { in: createdStudentIds } } });
      await prisma.student.deleteMany({ where: { id: { in: createdStudentIds } } });
    }
    if (closureId) {
      await prisma.academyClosure.deleteMany({ where: { OR: [{ id: closureId }, { title: { startsWith: tag } }] } });
    }
    if (createdBatchIds.length) {
      await prisma.batch.deleteMany({ where: { id: { in: createdBatchIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});

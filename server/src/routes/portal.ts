import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { mapBatch, mapCoach, mapStudent } from "../lib/mappers.js";
import { attendanceByBatchWeeks, attendanceGrid, recomputeAttendancePctMany } from "../lib/attendance.js";
import { normalizePhone, requireAuth } from "../lib/auth.js";

export const portalRouter = Router();

function mapTournament(row: {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  format: string;
  venue: string | null;
  status: string;
  opponents: unknown;
  studentIds: unknown;
  matches: unknown;
}) {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    format: row.format,
    venue: row.venue || "",
    status: row.status,
    opponents: Array.isArray(row.opponents) ? row.opponents : [],
    studentIds: Array.isArray(row.studentIds) ? (row.studentIds as string[]) : [],
    matches: Array.isArray(row.matches) ? row.matches : [],
  };
}

/** Parent: children + fees + attendance + progress + tournaments for those kids only */
portalRouter.get("/parent", requireAuth("parent"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const phone = normalizePhone(req.user!.parentPhone || req.user!.phone);
  const students = await prisma.student.findMany({
    where: { parentPhone: { not: null } },
    orderBy: { name: "asc" },
  });
  const mine = students.filter((s) => normalizePhone(s.parentPhone) === phone);
  const myIds = new Set(mine.map((s) => s.id));
  const batches = await prisma.batch.findMany({
    include: { _count: { select: { students: true } }, coach: true },
  });
  const coaches = await prisma.coach.findMany();
  const batchMap = Object.fromEntries(batches.map((b) => [b.id, mapBatch(b)]));
  const coachMap = Object.fromEntries(coaches.map((c) => [c.id, mapCoach(c)]));

  const children = await Promise.all(
    mine.map(async (s) => {
      const mapped = mapStudent(s);
      const batch = s.batchId ? batchMap[s.batchId] : undefined;
      const coach = batch?.coachId ? coachMap[batch.coachId] : undefined;
      const [grid, payments, notes, installments] = await Promise.all([
        attendanceGrid(s.id, 30),
        prisma.feePayment.findMany({
          where: { studentId: s.id },
          orderBy: { paidAt: "desc" },
          take: 12,
        }),
        prisma.coachNote.findMany({
          where: { studentId: s.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.feeInstallment.findMany({
          where: {
            studentId: s.id,
            enrollment: { status: { in: ["active", "completed"] } },
          },
          orderBy: { dueDate: "asc" },
          take: 24,
        }),
      ]);
      return {
        ...mapped,
        batch: batch || null,
        coach: coach || null,
        attendanceGrid: grid,
        payments,
        feeSchedule: installments.map((i) => ({
          id: i.id,
          monthLabel: i.monthLabel,
          amount: i.amount,
          status: i.status,
          daysOverdue: i.daysOverdue,
          dueDate: i.dueDate.toISOString().slice(0, 10),
          paidAt: i.paidAt ? i.paidAt.toISOString() : null,
        })),
        notes: notes.map((n) => ({
          id: n.id,
          note: n.note,
          author: n.author,
          createdAt: n.createdAt.toISOString(),
        })),
      };
    })
  );

  const allTournaments = await prisma.tournament.findMany({ orderBy: { startDate: "desc" } });
  const tournaments = allTournaments
    .map(mapTournament)
    .filter((t) => t.studentIds.some((id) => myIds.has(id)))
    .slice(0, 10);

  const from = new Date();
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 60);
  to.setHours(0, 0, 0, 0);
  const { listClosures } = await import("../lib/closures.js");
  const closures = await listClosures({ from, to });

  res.json({
    parent: { name: req.user!.name, phone: req.user!.phone },
    children,
    tournaments,
    closures,
  });
});

/**
 * Coach: only assigned batches + those students (per requirements).
 * Also returns coaching team list and tournaments involving their players.
 */
portalRouter.get("/coach", requireAuth("coach"), async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const coachId = req.user!.coachId;
  const phone = normalizePhone(req.user!.phone);
  let coach = coachId
    ? await prisma.coach.findUnique({ where: { id: coachId } })
    : null;
  if (!coach) {
    const all = await prisma.coach.findMany({ where: { phone: { not: null } } });
    coach = all.find((c) => normalizePhone(c.phone) === phone) || null;
  }

  if (!coach) {
    return res.status(404).json({ error: "Coach profile not linked — contact academy admin" });
  }

  // Heal stale JWT coachId link
  if (coachId !== coach.id) {
    await prisma.user.updateMany({
      where: { phone, role: "coach" },
      data: { coachId: coach.id },
    });
  }

  const isHead = Boolean((coach as { isHeadCoach?: boolean }).isHeadCoach);

  // Head coach sees all batches; others only assigned batches
  const batches = await prisma.batch.findMany({
    where: isHead ? undefined : { coachId: coach.id },
    include: { _count: { select: { students: true } }, coach: true },
    orderBy: { name: "asc" },
  });
  const batchIds = batches.map((b) => b.id);
  const students = await prisma.student.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: { name: "asc" },
  });
  const studentIds = new Set(students.map((s) => s.id));
  const [coaches, attendanceByBatch, allTournaments, closures, feePackages] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    attendanceByBatchWeeks(),
    prisma.tournament.findMany({ orderBy: { startDate: "desc" } }),
    prisma.academyClosure.findMany({
      where: {
        date: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) },
      },
      orderBy: { date: "asc" },
      take: 60,
    }),
    isHead
      ? prisma.feePackage.findMany({ where: { active: true }, orderBy: { months: "asc" } })
      : Promise.resolve([]),
  ]);

  const tournaments = allTournaments
    .map(mapTournament)
    .filter((t) => t.studentIds.some((id) => studentIds.has(id)))
    .slice(0, 10);

  const notes = await prisma.coachNote.findMany({
    where: { studentId: { in: [...studentIds] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Strip fee amounts/status from non-head coaches
  const mappedStudents = students.map((s) => {
    const m = mapStudent(s);
    if (!isHead) {
      return {
        ...m,
        feeStatus: "paid" as const,
        feeAmount: 0,
        daysOverdue: 0,
      };
    }
    return m;
  });

  const { mapClosure } = await import("../lib/closures.js");

  res.json({
    coach: mapCoach(coach),
    isHeadCoach: isHead,
    canViewFees: isHead,
    batches: batches.map(mapBatch),
    students: mappedStudents,
    coaches: coaches.map(mapCoach),
    attendanceByBatch: attendanceByBatch.filter((r) => batchIds.includes(r.batchId)),
    myBatchIds: batchIds,
    tournaments,
    notes,
    closures: closures.map(mapClosure),
    feePackages: isHead
      ? feePackages.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          months: p.months,
          monthlyAmount: p.monthlyAmount,
          totalAmount: p.totalAmount,
          active: p.active,
        }))
      : [],
  });
});

async function resolveCoach(req: { user?: { coachId?: string | null; phone: string } }) {
  const coachId = req.user!.coachId;
  const phone = normalizePhone(req.user!.phone);
  let coach = coachId
    ? await prisma.coach.findUnique({ where: { id: coachId } })
    : null;
  if (!coach) {
    const all = await prisma.coach.findMany({ where: { phone: { not: null } } });
    coach = all.find((c) => normalizePhone(c.phone) === phone) || null;
  }
  return coach;
}

function coachBatchFilter(coach: { id: string; isHeadCoach?: boolean }) {
  return Boolean(coach.isHeadCoach) ? {} : { coachId: coach.id };
}

/** Coach loads attendance marks for a date (so logged marks can be edited) */
portalRouter.get("/coach/attendance", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach) return res.status(404).json({ error: "Coach profile not linked" });

  const myBatches = await prisma.batch.findMany({
    where: coachBatchFilter(coach),
    select: { id: true },
  });
  const myBatchIds = new Set(myBatches.map((b) => b.id));
  const date = new Date(String(req.query.date || new Date().toISOString().slice(0, 10)));
  date.setHours(0, 0, 0, 0);
  const batchId = req.query.batchId ? String(req.query.batchId) : undefined;
  if (batchId && !myBatchIds.has(batchId)) {
    return res.status(403).json({ error: "Not your batch" });
  }

  const rows = await prisma.attendanceRecord.findMany({
    where: {
      date,
      ...(batchId ? { batchId } : { batchId: { in: [...myBatchIds] } }),
    },
    orderBy: { studentId: "asc" },
  });
  const closure = await prisma.academyClosure.findFirst({
    where: {
      date,
      OR: [
        { scope: "academy" },
        ...(batchId ? [{ scope: "batch" as const, batchId }] : []),
      ],
    },
  });
  const { mapClosure } = await import("../lib/closures.js");
  res.json({
    marks: rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      batchId: r.batchId,
      date: r.date.toISOString().slice(0, 10),
      status: r.status,
      note: r.note || "",
    })),
    closure: closure ? mapClosure(closure) : null,
  });
});

/** Coach marks attendance for their batches only */
portalRouter.post("/coach/attendance", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach) return res.status(400).json({ error: "Coach profile not linked" });

  const myBatches = await prisma.batch.findMany({
    where: coachBatchFilter(coach),
    select: { id: true },
  });
  const myBatchIds = new Set(myBatches.map((b) => b.id));
  const date = new Date(req.body.date || new Date().toISOString().slice(0, 10));
  date.setHours(0, 0, 0, 0);
  const batchId = req.body.batchId || null;
  if (batchId && !myBatchIds.has(batchId)) {
    return res.status(403).json({ error: "Not your batch" });
  }

  const marks: { studentId: string; status: string; note?: string }[] = req.body.marks || [];
  if (!marks.length) return res.status(400).json({ error: "marks required" });
  const allowed = new Set(["present", "absent", "late", "leave", "no_session"]);

  const myStudents = await prisma.student.findMany({
    where: { batchId: { in: [...myBatchIds] } },
    select: { id: true },
  });
  const allowedStudents = new Set(myStudents.map((s) => s.id));
  for (const m of marks) {
    if (!allowedStudents.has(m.studentId)) {
      return res.status(403).json({ error: "Student not in your batches" });
    }
  }

  const results = await Promise.all(
    marks.map((m) => {
      const status = allowed.has(m.status) ? m.status : "present";
      const note = m.note != null ? String(m.note).trim() || null : null;
      return prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: m.studentId, date } },
        create: { studentId: m.studentId, batchId, date, status, note },
        update: { status, batchId, note },
      });
    })
  );
  await recomputeAttendancePctMany(marks.map((m) => m.studentId));
  res.json({ ok: true, count: results.length });
});

/** Head coach (or any coach for own awareness) — list closures */
portalRouter.get("/coach/closures", requireAuth("coach"), async (req, res) => {
  const { listClosures } = await import("../lib/closures.js");
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  res.json(await listClosures({ from, to }));
});

/** Head coach declares academy / batch no-session (holiday, closure, rain) */
portalRouter.post("/coach/closures", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach) return res.status(400).json({ error: "Coach profile not linked" });
  if (!coach.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can declare academy closures" });
  }

  const dateStr = String(req.body.date || "").slice(0, 10);
  const title = String(req.body.title || "").trim();
  if (!dateStr || !title) return res.status(400).json({ error: "date and title required" });
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const scope = req.body.scope === "batch" ? "batch" : "academy";
  const batchId = scope === "batch" ? String(req.body.batchId || "") : "";
  if (scope === "batch" && !batchId) return res.status(400).json({ error: "batchId required" });

  const row = await prisma.academyClosure.upsert({
    where: { date_scope_batchId: { date, scope, batchId } },
    create: {
      date,
      title,
      reason: req.body.reason ? String(req.body.reason) : null,
      type: String(req.body.type || "closure"),
      scope,
      batchId,
      createdById: coach.id,
    },
    update: {
      title,
      reason: req.body.reason ? String(req.body.reason) : null,
      type: String(req.body.type || "closure"),
      createdById: coach.id,
    },
  });
  const { mapClosure } = await import("../lib/closures.js");
  res.status(201).json(mapClosure(row));
});

portalRouter.delete("/coach/closures/:id", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can remove closures" });
  }
  try {
    await prisma.academyClosure.delete({ where: { id: String(req.params.id) } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

/** Head coach fee package structures */
portalRouter.get("/coach/fee-packages", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can view fee structures" });
  }
  const { ensureDefaultFeePackages } = await import("../lib/feeSync.js");
  await ensureDefaultFeePackages();
  const rows = await prisma.feePackage.findMany({
    where: { active: true },
    orderBy: { months: "asc" },
  });
  res.json(
    rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      months: p.months,
      monthlyAmount: p.monthlyAmount,
      totalAmount: p.totalAmount,
      active: p.active,
    }))
  );
});

/** Coach updates performance scores for own students */
portalRouter.put("/coach/students/:id/scores", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach) return res.status(400).json({ error: "Coach profile not linked" });

  const myBatchIds = (
    await prisma.batch.findMany({ where: coachBatchFilter(coach), select: { id: true } })
  ).map((b) => b.id);
  const studentId = String(req.params.id);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || !student.batchId || !myBatchIds.includes(student.batchId)) {
    return res.status(403).json({ error: "Student not in your batches" });
  }

  const scores = req.body.scores || req.body;
  const clamp = (v: unknown, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(5, Math.max(1, n));
  };
  const row = await prisma.student.update({
    where: { id: student.id },
    data: {
      batting: clamp(scores.batting, student.batting),
      bowling: clamp(scores.bowling, student.bowling),
      fielding: clamp(scores.fielding, student.fielding),
      fitness: clamp(scores.fitness, student.fitness),
      temperament: clamp(scores.temperament, student.temperament),
    },
  });
  res.setHeader("Cache-Control", "no-store");
  res.json(mapStudent(row));
});

/** Coach note on own student */
portalRouter.post("/coach/notes", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach) return res.status(400).json({ error: "Coach profile not linked" });

  const studentId = String(req.body.studentId || "");
  const note = String(req.body.note || "").trim();
  if (!studentId || !note) return res.status(400).json({ error: "studentId and note required" });

  const myBatchIds = (
    await prisma.batch.findMany({ where: coachBatchFilter(coach), select: { id: true } })
  ).map((b) => b.id);
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || !student.batchId || !myBatchIds.includes(student.batchId)) {
    return res.status(403).json({ error: "Student not in your batches" });
  }

  const row = await prisma.coachNote.create({
    data: { studentId, note, author: req.user!.name },
  });
  res.status(201).json(row);
});

/** Demo accounts for login screens */
portalRouter.get("/demo-accounts", async (_req, res) => {
  const [parents, coaches, admin] = await Promise.all([
    prisma.user.findMany({
      where: { role: "parent" },
      select: { phone: true, name: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: "coach" },
      select: { phone: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findFirst({
      where: { role: "admin" },
      select: { phone: true, name: true },
    }),
  ]);
  res.json({
    pin: process.env.DEFAULT_PIN || "1234",
    admin: admin || { phone: "9000000001", name: "Sun Sports Team" },
    coaches,
    parents,
  });
});

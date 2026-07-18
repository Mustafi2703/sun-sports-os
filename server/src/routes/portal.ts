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

/** Parent: children + fees + attendance + progress + relevant tournaments */
portalRouter.get("/parent", requireAuth("parent"), async (req, res) => {
  const phone = normalizePhone(req.user!.parentPhone || req.user!.phone);
  const students = await prisma.student.findMany({ orderBy: { name: "asc" } });
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
      const [grid, payments] = await Promise.all([
        attendanceGrid(s.id, 30),
        prisma.feePayment.findMany({
          where: { studentId: s.id },
          orderBy: { paidAt: "desc" },
          take: 12,
        }),
      ]);
      return {
        ...mapped,
        batch: batch || null,
        coach: coach || null,
        attendanceGrid: grid,
        payments,
      };
    })
  );

  const allTournaments = await prisma.tournament.findMany({ orderBy: { startDate: "desc" } });
  const tournaments = allTournaments
    .map(mapTournament)
    .filter((t) => t.studentIds.some((id) => myIds.has(id)) || t.status !== "completed")
    .slice(0, 10);

  res.json({
    parent: { name: req.user!.name, phone: req.user!.phone },
    children,
    tournaments,
  });
});

/**
 * Coach: only assigned batches + those students (per requirements).
 * Also returns coaching team list and tournaments involving their players.
 */
portalRouter.get("/coach", requireAuth("coach"), async (req, res) => {
  const coachId = req.user!.coachId;
  const coach = coachId
    ? await prisma.coach.findUnique({ where: { id: coachId } })
    : await prisma.coach.findFirst({ where: { phone: { contains: req.user!.phone.slice(-10) } } });

  if (!coach) {
    return res.status(404).json({ error: "Coach profile not linked — contact academy admin" });
  }

  const batches = await prisma.batch.findMany({
    where: { coachId: coach.id },
    include: { _count: { select: { students: true } }, coach: true },
    orderBy: { name: "asc" },
  });
  const batchIds = batches.map((b) => b.id);
  const students = await prisma.student.findMany({
    where: { batchId: { in: batchIds } },
    orderBy: { name: "asc" },
  });
  const studentIds = new Set(students.map((s) => s.id));
  const [coaches, attendanceByBatch, allTournaments] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    attendanceByBatchWeeks(),
    prisma.tournament.findMany({ orderBy: { startDate: "desc" } }),
  ]);

  const tournaments = allTournaments
    .map(mapTournament)
    .filter((t) => t.studentIds.some((id) => studentIds.has(id)) || t.status !== "completed")
    .slice(0, 10);

  // Notes for my students (latest)
  const notes = await prisma.coachNote.findMany({
    where: { studentId: { in: [...studentIds] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({
    coach: mapCoach(coach),
    batches: batches.map(mapBatch),
    students: students.map(mapStudent),
    coaches: coaches.map(mapCoach),
    attendanceByBatch: attendanceByBatch.filter((r) => batchIds.includes(r.batchId)),
    myBatchIds: batchIds,
    tournaments,
    notes,
  });
});

/** Coach marks attendance for their batches only */
portalRouter.post("/coach/attendance", requireAuth("coach"), async (req, res) => {
  const coachId = req.user!.coachId;
  if (!coachId) return res.status(400).json({ error: "Coach profile not linked" });

  const myBatchIds = new Set(
    (await prisma.batch.findMany({ where: { coachId }, select: { id: true } })).map((b) => b.id)
  );
  const date = new Date(req.body.date || new Date().toISOString().slice(0, 10));
  date.setHours(0, 0, 0, 0);
  const batchId = req.body.batchId || null;
  if (batchId && !myBatchIds.has(batchId)) {
    return res.status(403).json({ error: "Not your batch" });
  }

  const marks: { studentId: string; status: string }[] = req.body.marks || [];
  if (!marks.length) return res.status(400).json({ error: "marks required" });

  const myStudents = await prisma.student.findMany({
    where: { batchId: { in: [...myBatchIds] } },
    select: { id: true },
  });
  const allowed = new Set(myStudents.map((s) => s.id));
  for (const m of marks) {
    if (!allowed.has(m.studentId)) {
      return res.status(403).json({ error: "Student not in your batches" });
    }
  }

  const results = await Promise.all(
    marks.map((m) =>
      prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: m.studentId, date } },
        create: { studentId: m.studentId, batchId, date, status: m.status },
        update: { status: m.status, batchId },
      })
    )
  );
  await recomputeAttendancePctMany(marks.map((m) => m.studentId));
  res.json({ ok: true, count: results.length });
});

/** Coach updates performance scores for own students */
portalRouter.put("/coach/students/:id/scores", requireAuth("coach"), async (req, res) => {
  const coachId = req.user!.coachId;
  if (!coachId) return res.status(400).json({ error: "Coach profile not linked" });

  const myBatchIds = (
    await prisma.batch.findMany({ where: { coachId }, select: { id: true } })
  ).map((b) => b.id);
  const student = await prisma.student.findUnique({ where: { id: req.params.id } });
  if (!student || !student.batchId || !myBatchIds.includes(student.batchId)) {
    return res.status(403).json({ error: "Student not in your batches" });
  }

  const scores = req.body.scores || req.body;
  const row = await prisma.student.update({
    where: { id: student.id },
    data: {
      ...(scores.batting !== undefined ? { batting: Number(scores.batting) } : {}),
      ...(scores.bowling !== undefined ? { bowling: Number(scores.bowling) } : {}),
      ...(scores.fielding !== undefined ? { fielding: Number(scores.fielding) } : {}),
      ...(scores.fitness !== undefined ? { fitness: Number(scores.fitness) } : {}),
      ...(scores.temperament !== undefined ? { temperament: Number(scores.temperament) } : {}),
    },
  });
  res.json(mapStudent(row));
});

/** Coach note on own student */
portalRouter.post("/coach/notes", requireAuth("coach"), async (req, res) => {
  const coachId = req.user!.coachId;
  if (!coachId) return res.status(400).json({ error: "Coach profile not linked" });

  const studentId = String(req.body.studentId || "");
  const note = String(req.body.note || "").trim();
  if (!studentId || !note) return res.status(400).json({ error: "studentId and note required" });

  const myBatchIds = (
    await prisma.batch.findMany({ where: { coachId }, select: { id: true } })
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

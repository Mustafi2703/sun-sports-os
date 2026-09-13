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
    canManageStudents: isHead,
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

portalRouter.put("/coach/fee-packages/:id", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can edit fee structures" });
  }
  const id = String(req.params.id);
  const months = req.body.months != null ? Math.max(1, Number(req.body.months) || 1) : undefined;
  const monthlyAmount =
    req.body.monthlyAmount != null ? Math.max(0, Number(req.body.monthlyAmount) || 0) : undefined;
  try {
    const existing = await prisma.feePackage.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Package not found" });
    const nextMonths = months ?? existing.months;
    const nextMonthly = monthlyAmount ?? existing.monthlyAmount;
    const row = await prisma.feePackage.update({
      where: { id },
      data: {
        ...(req.body.name != null ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || "") } : {}),
        ...(months != null ? { months: nextMonths } : {}),
        ...(monthlyAmount != null ? { monthlyAmount: nextMonthly } : {}),
        totalAmount: nextMonthly * nextMonths,
        ...(req.body.active !== undefined ? { active: Boolean(req.body.active) } : {}),
      },
    });
    res.json({
      id: row.id,
      name: row.name,
      description: row.description || "",
      months: row.months,
      monthlyAmount: row.monthlyAmount,
      totalAmount: row.totalAmount,
      active: row.active,
    });
  } catch {
    res.status(404).json({ error: "Package not found" });
  }
});

portalRouter.post("/coach/fee-packages", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can create fee structures" });
  }
  const name = String(req.body.name || "").trim();
  const months = Math.max(1, Number(req.body.months) || 1);
  const monthlyAmount = Math.max(0, Number(req.body.monthlyAmount) || 0);
  if (!name || !monthlyAmount) return res.status(400).json({ error: "name and monthlyAmount required" });
  const row = await prisma.feePackage.create({
    data: {
      name,
      description: req.body.description ? String(req.body.description) : null,
      months,
      monthlyAmount,
      totalAmount: monthlyAmount * months,
      active: true,
    },
  });
  res.status(201).json({
    id: row.id,
    name: row.name,
    description: row.description || "",
    months: row.months,
    monthlyAmount: row.monthlyAmount,
    totalAmount: row.totalAmount,
    active: row.active,
  });
});

/** Head coach — add / edit / delete students (+ fee plan enrollment) */
portalRouter.post("/coach/students", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can add students" });
  }
  const { ageFromDob, mapStudent } = await import("../lib/mappers.js");
  const { syncParentAccess } = await import("../lib/ensureUser.js");
  const {
    enrollStudentOnFeePlan,
    feePlanInputFromBody,
    feeRatesFromBody,
    shouldEnrollFeeFromBody,
  } = await import("../lib/feeSync.js");

  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const parentPhone = normalizePhone(req.body.parentPhone);
  if (!parentPhone || parentPhone.length < 10) {
    return res.status(400).json({
      error: "Valid 10-digit parent WhatsApp required — this creates the parent portal login",
    });
  }
  const dob = req.body.dob ? new Date(req.body.dob) : null;
  const rates = feeRatesFromBody(req.body);
  const row = await prisma.student.create({
    data: {
      name,
      dob,
      age: ageFromDob(dob) ?? (Number(req.body.age) || 12),
      parentName: req.body.parentName || null,
      parentPhone,
      role: req.body.role || null,
      feeStatus: req.body.feeStatus || "paid",
      feeAmount: Number(req.body.feeAmount) || rates.feeRate1,
      feeRate1: rates.feeRate1,
      feeRate3: rates.feeRate3,
      feeRate6: rates.feeRate6,
      feeRate12: rates.feeRate12,
      daysOverdue: Number(req.body.daysOverdue) || 0,
      attendancePct: Number(req.body.attendancePct) || 90,
      batting: 3,
      bowling: 3,
      fielding: 3,
      fitness: 3,
      temperament: 3,
      joinDate: req.body.joinDate ? new Date(req.body.joinDate) : new Date(),
      medicalNotes: req.body.medicalNotes || null,
      batchId: req.body.batchId || null,
    },
  });
  try {
    await syncParentAccess({ oldPhone: null, newPhone: row.parentPhone, parentName: row.parentName });
  } catch (e) {
    console.warn("ensureParentUser:", e);
  }

  let activeEnrollment = null;
  if (shouldEnrollFeeFromBody(req.body)) {
    try {
      const enrollment = await enrollStudentOnFeePlan(row.id, feePlanInputFromBody(req.body));
      activeEnrollment = {
        id: enrollment.id,
        packageId: enrollment.packageId,
        packageName: enrollment.packageName,
        months: enrollment.months,
        monthlyAmount: enrollment.monthlyAmount,
        totalAmount: enrollment.totalAmount,
        startMonth: enrollment.startMonth,
        endMonth: enrollment.endMonth,
        status: enrollment.status,
      };
    } catch (e) {
      return res.status(400).json({
        error: e instanceof Error ? e.message : "Student created but fee plan failed",
        student: mapStudent(row),
      });
    }
  }

  const fresh = await prisma.student.findUnique({ where: { id: row.id } });
  res.status(201).json({ ...mapStudent(fresh || row), activeEnrollment });
});

portalRouter.put("/coach/students/:id", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can edit students" });
  }
  const { ageFromDob, mapStudent } = await import("../lib/mappers.js");
  const { syncParentAccess } = await import("../lib/ensureUser.js");
  const {
    enrollStudentOnFeePlan,
    feePlanInputFromBody,
    feeRatesFromBody,
    shouldEnrollFeeFromBody,
  } = await import("../lib/feeSync.js");

  const id = String(req.params.id);
  try {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Student not found" });

    let nextParentPhone: string | undefined;
    if (req.body.parentPhone !== undefined) {
      const phone = normalizePhone(req.body.parentPhone);
      if (!phone || phone.length < 10) {
        return res.status(400).json({ error: "Valid 10-digit parent WhatsApp required" });
      }
      nextParentPhone = phone;
    }

    const dob = req.body.dob !== undefined ? (req.body.dob ? new Date(req.body.dob) : null) : undefined;
    const row = await prisma.student.update({
      where: { id },
      data: {
        ...(req.body.name != null ? { name: String(req.body.name).trim() } : {}),
        ...(dob !== undefined ? { dob, age: ageFromDob(dob) } : {}),
        ...(req.body.parentName !== undefined ? { parentName: req.body.parentName } : {}),
        ...(nextParentPhone !== undefined ? { parentPhone: nextParentPhone } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.feeAmount !== undefined ? { feeAmount: Number(req.body.feeAmount) } : {}),
        ...(req.body.feeRate1 !== undefined ||
        req.body.feeRate3 !== undefined ||
        req.body.feeRate6 !== undefined ||
        req.body.feeRate12 !== undefined ||
        req.body.feeRates !== undefined
          ? feeRatesFromBody(req.body, {
              feeRate1: existing.feeRate1,
              feeRate3: existing.feeRate3,
              feeRate6: existing.feeRate6,
              feeRate12: existing.feeRate12,
            })
          : {}),
        ...(req.body.joinDate !== undefined
          ? { joinDate: req.body.joinDate ? new Date(req.body.joinDate) : null }
          : {}),
        ...(req.body.medicalNotes !== undefined ? { medicalNotes: req.body.medicalNotes } : {}),
        ...(req.body.batchId !== undefined ? { batchId: req.body.batchId || null } : {}),
      },
    });
    try {
      await syncParentAccess({
        oldPhone: existing.parentPhone,
        newPhone: row.parentPhone,
        parentName: row.parentName,
      });
    } catch (e) {
      console.warn("ensureParentUser:", e);
    }

    let activeEnrollment = null;
    if (shouldEnrollFeeFromBody(req.body)) {
      try {
        const enrollment = await enrollStudentOnFeePlan(row.id, feePlanInputFromBody(req.body));
        activeEnrollment = {
          id: enrollment.id,
          packageId: enrollment.packageId,
          packageName: enrollment.packageName,
          months: enrollment.months,
          monthlyAmount: enrollment.monthlyAmount,
          totalAmount: enrollment.totalAmount,
          startMonth: enrollment.startMonth,
          endMonth: enrollment.endMonth,
          status: enrollment.status,
        };
      } catch (e) {
        return res.status(400).json({
          error: e instanceof Error ? e.message : "Student updated but fee plan failed",
          student: mapStudent(row),
        });
      }
    }

    const fresh = await prisma.student.findUnique({ where: { id: row.id } });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ...mapStudent(fresh || row), activeEnrollment });
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});

portalRouter.delete("/coach/students/:id", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can delete students" });
  }
  const { syncParentAccess } = await import("../lib/ensureUser.js");
  const id = String(req.params.id);
  try {
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Student not found" });
    await prisma.student.delete({ where: { id } });
    try {
      await syncParentAccess({
        oldPhone: existing.parentPhone,
        newPhone: null,
        parentName: existing.parentName,
      });
    } catch (e) {
      console.warn("syncParentAccess:", e);
    }
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});

portalRouter.post("/coach/fee-enrollments", requireAuth("coach"), async (req, res) => {
  const coach = await resolveCoach(req);
  if (!coach?.isHeadCoach) {
    return res.status(403).json({ error: "Only head coach can enroll fee plans" });
  }
  const { enrollStudentOnFeePlan } = await import("../lib/feeSync.js");
  const studentId = String(req.body.studentId || "");
  if (!studentId) return res.status(400).json({ error: "studentId required" });
  try {
    const enrollment = await enrollStudentOnFeePlan(studentId, {
      packageId: req.body.packageId,
      packageName: req.body.packageName,
      months: req.body.months,
      monthlyAmount: req.body.monthlyAmount,
      startMonth: req.body.startMonth,
    });
    res.status(201).json({
      id: enrollment.id,
      studentId: enrollment.studentId,
      packageId: enrollment.packageId,
      packageName: enrollment.packageName,
      months: enrollment.months,
      monthlyAmount: enrollment.monthlyAmount,
      totalAmount: enrollment.totalAmount,
      startMonth: enrollment.startMonth,
      endMonth: enrollment.endMonth,
      status: enrollment.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Enrollment failed";
    res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
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

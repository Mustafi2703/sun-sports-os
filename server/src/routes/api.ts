import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ageFromDob, mapBatch, mapCoach, mapStudent } from "../lib/mappers.js";

export const api = Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true, service: "sun-sports-os-api", time: new Date().toISOString() });
});

// ─── Snapshot / Dashboard ───────────────────────────────────────────
api.get("/snapshot", async (_req, res) => {
  const [academy, coaches, batches, students] = await Promise.all([
    prisma.academy.findFirst(),
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.batch.findMany({ include: { _count: { select: { students: true } }, coach: true }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ orderBy: { name: "asc" } }),
  ]);

  const mappedStudents = students.map(mapStudent);
  const paid = mappedStudents.filter((s) => s.feeStatus === "paid");
  const overdue1 = mappedStudents.filter((s) => s.feeStatus === "overdue1");
  const overdue8 = mappedStudents.filter((s) => s.feeStatus === "overdue8");
  const monthlyRevenue = paid.reduce((a, s) => a + s.feeAmount, 0);
  const overdueAmount = [...overdue1, ...overdue8].reduce((a, s) => a + s.feeAmount, 0);

  res.json({
    academyName: academy?.name ?? "Sun Sports",
    academy,
    coaches: coaches.map(mapCoach),
    batches: batches.map(mapBatch),
    students: mappedStudents,
    aggregates: {
      totalStudents: mappedStudents.length,
      monthlyRevenue,
      overdueAmount,
      overdueCount: overdue1.length + overdue8.length,
      paidCount: paid.length,
      overdue1Count: overdue1.length,
      overdue8Count: overdue8.length,
      monthlyRevenueSeries: [
        { month: "Feb", revenue: Math.round(monthlyRevenue * 0.88) },
        { month: "Mar", revenue: Math.round(monthlyRevenue * 0.92) },
        { month: "Apr", revenue: Math.round(monthlyRevenue * 0.95) },
        { month: "May", revenue: Math.round(monthlyRevenue * 0.98) },
        { month: "Jun", revenue: Math.round(monthlyRevenue * 1.02) },
        { month: "Jul", revenue: monthlyRevenue },
      ],
    },
  });
});

// ─── Academy ────────────────────────────────────────────────────────
api.get("/academy", async (_req, res) => {
  const academy = await prisma.academy.findFirst();
  res.json(academy);
});

api.put("/academy", async (req, res) => {
  const existing = await prisma.academy.findFirst();
  const data = {
    name: req.body.name,
    phone: req.body.phone,
    address: req.body.address,
    program: req.body.program,
  };
  const academy = existing
    ? await prisma.academy.update({ where: { id: existing.id }, data })
    : await prisma.academy.create({ data: { ...data, name: data.name || "Sun Sports" } });
  res.json(academy);
});

// ─── Coaches ────────────────────────────────────────────────────────
api.get("/coaches", async (_req, res) => {
  const rows = await prisma.coach.findMany({ orderBy: { name: "asc" } });
  res.json(rows.map(mapCoach));
});

api.post("/coaches", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const initials = name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase();
  const row = await prisma.coach.create({
    data: {
      name,
      phone: req.body.phone || null,
      email: req.body.email || null,
      specialty: req.body.specialty || null,
      initials,
    },
  });
  res.status(201).json(mapCoach(row));
});

api.put("/coaches/:id", async (req, res) => {
  const name = req.body.name != null ? String(req.body.name).trim() : undefined;
  try {
    const row = await prisma.coach.update({
      where: { id: req.params.id },
      data: {
        ...(name != null ? { name, initials: name.split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase() } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
        ...(req.body.email !== undefined ? { email: req.body.email } : {}),
        ...(req.body.specialty !== undefined ? { specialty: req.body.specialty } : {}),
      },
    });
    res.json(mapCoach(row));
  } catch {
    res.status(404).json({ error: "Coach not found" });
  }
});

api.delete("/coaches/:id", async (req, res) => {
  try {
    await prisma.coach.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Coach not found" });
  }
});

// ─── Batches ────────────────────────────────────────────────────────
api.get("/batches", async (_req, res) => {
  const rows = await prisma.batch.findMany({
    include: { _count: { select: { students: true } }, coach: true },
    orderBy: { name: "asc" },
  });
  res.json(rows.map(mapBatch));
});

api.post("/batches", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const row = await prisma.batch.create({
    data: {
      name,
      ageGroup: req.body.ageGroup || "Open",
      schedule: req.body.schedule || null,
      time: req.body.time || null,
      venue: req.body.venue || "Sun Sports Ground",
      capacity: Number(req.body.capacity) || 20,
      monthlyFee: Number(req.body.monthlyFee) || 15000,
      coachId: req.body.coachId || null,
    },
    include: { _count: { select: { students: true } } },
  });
  res.status(201).json(mapBatch(row));
});

api.put("/batches/:id", async (req, res) => {
  try {
    const row = await prisma.batch.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name != null ? { name: String(req.body.name).trim() } : {}),
        ...(req.body.ageGroup !== undefined ? { ageGroup: req.body.ageGroup } : {}),
        ...(req.body.schedule !== undefined ? { schedule: req.body.schedule } : {}),
        ...(req.body.time !== undefined ? { time: req.body.time } : {}),
        ...(req.body.venue !== undefined ? { venue: req.body.venue } : {}),
        ...(req.body.capacity !== undefined ? { capacity: Number(req.body.capacity) } : {}),
        ...(req.body.monthlyFee !== undefined ? { monthlyFee: Number(req.body.monthlyFee) } : {}),
        ...(req.body.coachId !== undefined ? { coachId: req.body.coachId || null } : {}),
      },
      include: { _count: { select: { students: true } } },
    });
    res.json(mapBatch(row));
  } catch {
    res.status(404).json({ error: "Batch not found" });
  }
});

api.delete("/batches/:id", async (req, res) => {
  try {
    await prisma.student.updateMany({ where: { batchId: req.params.id }, data: { batchId: null } });
    await prisma.batch.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Batch not found" });
  }
});

// ─── Students ───────────────────────────────────────────────────────
api.get("/students", async (req, res) => {
  const where: Record<string, unknown> = {};
  if (req.query.batchId) where.batchId = String(req.query.batchId);
  if (req.query.feeStatus) where.feeStatus = String(req.query.feeStatus);
  if (req.query.q) {
    where.name = { contains: String(req.query.q), mode: "insensitive" };
  }
  const rows = await prisma.student.findMany({ where, orderBy: { name: "asc" } });
  res.json(rows.map(mapStudent));
});

api.get("/students/:id", async (req, res) => {
  const row = await prisma.student.findUnique({
    where: { id: req.params.id },
    include: { payments: { orderBy: { paidAt: "desc" }, take: 12 }, notes: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!row) return res.status(404).json({ error: "Student not found" });
  res.json({ ...mapStudent(row), payments: row.payments, notes: row.notes });
});

api.post("/students", async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "name required" });
  const dob = req.body.dob ? new Date(req.body.dob) : null;
  const row = await prisma.student.create({
    data: {
      name,
      dob,
      age: ageFromDob(dob) ?? (Number(req.body.age) || 12),
      parentName: req.body.parentName || null,
      parentPhone: req.body.parentPhone || null,
      role: req.body.role || null,
      feeStatus: req.body.feeStatus || "paid",
      feeAmount: Number(req.body.feeAmount) || 15000,
      daysOverdue: Number(req.body.daysOverdue) || 0,
      attendancePct: Number(req.body.attendancePct) || 90,
      batting: Number(req.body.scores?.batting ?? req.body.batting ?? 3) || 3,
      bowling: Number(req.body.scores?.bowling ?? req.body.bowling ?? 3) || 3,
      fielding: Number(req.body.scores?.fielding ?? req.body.fielding ?? 3) || 3,
      fitness: Number(req.body.scores?.fitness ?? req.body.fitness ?? 3) || 3,
      temperament: Number(req.body.scores?.temperament ?? req.body.temperament ?? 3) || 3,
      joinDate: req.body.joinDate ? new Date(req.body.joinDate) : new Date(),
      medicalNotes: req.body.medicalNotes || null,
      batchId: req.body.batchId || null,
      bowlingSpeeds: req.body.lastBowlingSpeed || undefined,
    },
  });
  res.status(201).json(mapStudent(row));
});

api.put("/students/:id", async (req, res) => {
  try {
    const dob = req.body.dob !== undefined ? (req.body.dob ? new Date(req.body.dob) : null) : undefined;
    const scores = req.body.scores || {};
    const row = await prisma.student.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.name != null ? { name: String(req.body.name).trim() } : {}),
        ...(dob !== undefined ? { dob, age: ageFromDob(dob) } : {}),
        ...(req.body.age !== undefined ? { age: Number(req.body.age) } : {}),
        ...(req.body.parentName !== undefined ? { parentName: req.body.parentName } : {}),
        ...(req.body.parentPhone !== undefined ? { parentPhone: req.body.parentPhone } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role } : {}),
        ...(req.body.feeStatus !== undefined ? { feeStatus: req.body.feeStatus } : {}),
        ...(req.body.feeAmount !== undefined ? { feeAmount: Number(req.body.feeAmount) } : {}),
        ...(req.body.daysOverdue !== undefined ? { daysOverdue: Number(req.body.daysOverdue) } : {}),
        ...(req.body.attendancePct !== undefined ? { attendancePct: Number(req.body.attendancePct) } : {}),
        ...(scores.batting !== undefined || req.body.batting !== undefined ? { batting: Number(scores.batting ?? req.body.batting) } : {}),
        ...(scores.bowling !== undefined || req.body.bowling !== undefined ? { bowling: Number(scores.bowling ?? req.body.bowling) } : {}),
        ...(scores.fielding !== undefined || req.body.fielding !== undefined ? { fielding: Number(scores.fielding ?? req.body.fielding) } : {}),
        ...(scores.fitness !== undefined || req.body.fitness !== undefined ? { fitness: Number(scores.fitness ?? req.body.fitness) } : {}),
        ...(scores.temperament !== undefined || req.body.temperament !== undefined ? { temperament: Number(scores.temperament ?? req.body.temperament) } : {}),
        ...(req.body.joinDate !== undefined ? { joinDate: req.body.joinDate ? new Date(req.body.joinDate) : null } : {}),
        ...(req.body.medicalNotes !== undefined ? { medicalNotes: req.body.medicalNotes } : {}),
        ...(req.body.batchId !== undefined ? { batchId: req.body.batchId || null } : {}),
      },
    });
    res.json(mapStudent(row));
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});

api.delete("/students/:id", async (req, res) => {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Student not found" });
  }
});

// ─── Fees / Payments ────────────────────────────────────────────────
api.get("/payments", async (req, res) => {
  const where: Record<string, unknown> = {};
  if (req.query.studentId) where.studentId = String(req.query.studentId);
  const rows = await prisma.feePayment.findMany({
    where,
    include: { student: true },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
  res.json(rows);
});

api.post("/payments", async (req, res) => {
  const studentId = String(req.body.studentId || "");
  const amount = Number(req.body.amount);
  if (!studentId || !amount) return res.status(400).json({ error: "studentId and amount required" });
  const payment = await prisma.feePayment.create({
    data: {
      studentId,
      amount,
      method: req.body.method || "cash",
      month: req.body.month || null,
      note: req.body.note || null,
      paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    },
  });
  if (req.body.markPaid !== false) {
    await prisma.student.update({
      where: { id: studentId },
      data: { feeStatus: "paid", daysOverdue: 0 },
    });
  }
  res.status(201).json(payment);
});

api.delete("/payments/:id", async (req, res) => {
  try {
    await prisma.feePayment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Payment not found" });
  }
});

// ─── Attendance ─────────────────────────────────────────────────────
api.get("/attendance", async (req, res) => {
  const date = req.query.date ? new Date(String(req.query.date)) : undefined;
  const batchId = req.query.batchId ? String(req.query.batchId) : undefined;
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      ...(date ? { date } : {}),
      ...(batchId ? { batchId } : {}),
    },
    orderBy: { date: "desc" },
    take: 500,
  });
  res.json(rows);
});

api.post("/attendance/bulk", async (req, res) => {
  const date = new Date(req.body.date || new Date().toISOString().slice(0, 10));
  const batchId = req.body.batchId || null;
  const marks: { studentId: string; status: string }[] = req.body.marks || [];
  if (!marks.length) return res.status(400).json({ error: "marks required" });

  const results = await Promise.all(
    marks.map((m) =>
      prisma.attendanceRecord.upsert({
        where: { studentId_date: { studentId: m.studentId, date } },
        create: { studentId: m.studentId, batchId, date, status: m.status },
        update: { status: m.status, batchId },
      })
    )
  );
  res.json({ ok: true, count: results.length });
});

api.delete("/attendance/:id", async (req, res) => {
  try {
    await prisma.attendanceRecord.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Record not found" });
  }
});

// ─── Notes ──────────────────────────────────────────────────────────
api.post("/notes", async (req, res) => {
  const studentId = String(req.body.studentId || "");
  const note = String(req.body.note || "").trim();
  if (!studentId || !note) return res.status(400).json({ error: "studentId and note required" });
  const row = await prisma.coachNote.create({
    data: { studentId, note, author: req.body.author || null },
  });
  res.status(201).json(row);
});

api.delete("/notes/:id", async (req, res) => {
  try {
    await prisma.coachNote.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Note not found" });
  }
});

// ─── Enquiries ──────────────────────────────────────────────────────
api.get("/enquiries", async (_req, res) => {
  res.json(await prisma.enquiry.findMany({ orderBy: { createdAt: "desc" } }));
});

api.post("/enquiries", async (req, res) => {
  const parentName = String(req.body.parentName || "").trim();
  const phone = String(req.body.phone || "").trim();
  if (!parentName || !phone) return res.status(400).json({ error: "parentName and phone required" });
  const row = await prisma.enquiry.create({
    data: {
      parentName,
      phone,
      childName: req.body.childName || null,
      childAge: req.body.childAge != null ? Number(req.body.childAge) : null,
      preferredBatch: req.body.preferredBatch || null,
      status: req.body.status || "new",
      notes: req.body.notes || null,
      trialDate: req.body.trialDate ? new Date(req.body.trialDate) : null,
    },
  });
  res.status(201).json(row);
});

api.put("/enquiries/:id", async (req, res) => {
  try {
    const row = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: {
        ...(req.body.parentName !== undefined ? { parentName: req.body.parentName } : {}),
        ...(req.body.phone !== undefined ? { phone: req.body.phone } : {}),
        ...(req.body.childName !== undefined ? { childName: req.body.childName } : {}),
        ...(req.body.childAge !== undefined ? { childAge: Number(req.body.childAge) } : {}),
        ...(req.body.preferredBatch !== undefined ? { preferredBatch: req.body.preferredBatch } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        ...(req.body.notes !== undefined ? { notes: req.body.notes } : {}),
        ...(req.body.trialDate !== undefined ? { trialDate: req.body.trialDate ? new Date(req.body.trialDate) : null } : {}),
      },
    });
    res.json(row);
  } catch {
    res.status(404).json({ error: "Enquiry not found" });
  }
});

api.delete("/enquiries/:id", async (req, res) => {
  try {
    await prisma.enquiry.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Enquiry not found" });
  }
});

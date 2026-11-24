import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma.js";
import { ageFromDob } from "./mappers.js";
import { bootstrapPortalUsers } from "./bootstrapUsers.js";

type Db = PrismaClient | Prisma.TransactionClient;

export const IMPORT_UPSERT_CONFIRM = "APPLY IMPORT";
export const IMPORT_REPLACE_CONFIRM = "REPLACE ROSTER";

export function excelReplaceAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_EXCEL_REPLACE === "true";
}

type SheetRow = Record<string, unknown>;

type ParsedBook = {
  coaches: { name: string; phone: string; specialty: string }[];
  batches: { name: string; coachName: string; fee: number; schedule: string; time: string; capacity: number }[];
  students: {
    name: string;
    dob: Date | null;
    parentName: string;
    parentPhone: string;
    role: string;
    joinDate: Date | null;
    medicalNotes: string;
  }[];
};

function pickSheet(wb: XLSX.WorkBook, hints: string[]): SheetRow[] {
  const name = wb.SheetNames.find((n) => hints.some((h) => n.toLowerCase().includes(h.toLowerCase())));
  return name ? XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[name], { defval: null }) : [];
}

function val(row: SheetRow, keys: string[]): unknown {
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.toLowerCase().includes(k.toLowerCase()));
    if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") return row[hit];
  }
  return undefined;
}

function asDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000));
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function parseWorkbook(buffer: Buffer): ParsedBook {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const coaches = pickSheet(wb, ["Coach"])
    .map((row) => ({
      name: String(val(row, ["Coach Name", "name"]) || "").trim(),
      phone: String(val(row, ["Phone"]) || ""),
      specialty: String(val(row, ["Specialization", "specialty"]) || "").trim(),
    }))
    .filter((row) => row.name);
  const batches = pickSheet(wb, ["Batch", "Bathch"])
    .map((row) => {
      const feeRaw = val(row, ["Monthly Fee", "fee"]);
      const feeNum = Number(feeRaw);
      const fee = feeRaw == null || feeRaw === "" || !Number.isFinite(feeNum) ? 15000 : Math.max(0, Math.round(feeNum));
      return {
        name: String(val(row, ["Batch Name", "name"]) || "").trim(),
        coachName: String(val(row, ["Assigned Coach", "coach"]) || ""),
        fee,
        schedule: String(val(row, ["Days"]) || ""),
        time: String(val(row, ["Timings", "time"]) || ""),
        capacity: parseInt(String(val(row, ["Capacity", "Max"]) || "20"), 10) || 20,
      };
    })
    .filter((row) => row.name);
  const students = pickSheet(wb, ["Student", "Data Entry"])
    .map((row) => ({
      name: String(val(row, ["Student Full Name", "Student Name", "name"]) || "").trim(),
      dob: asDate(val(row, ["Date of Birth", "DOB"])),
      parentName: String(val(row, ["Parent", "Guardian"]) || "").trim(),
      parentPhone: String(val(row, ["WhatsApp", "Phone"]) || "").trim(),
      role: String(val(row, ["Assigned Batch", "Batch", "role"]) || "").trim(),
      joinDate: asDate(val(row, ["Joining Date", "join"])),
      medicalNotes: String(val(row, ["Medical", "Allergies"]) || "").trim(),
    }))
    .filter((row) => row.name);
  return { coaches, batches, students };
}

export type ImportPreview = {
  replaceAllowed: boolean;
  upsertConfirm: string;
  replaceConfirm: string;
  coaches: { create: number; update: number };
  batches: { create: number; update: number };
  students: { create: number; update: number; unchanged: number };
  studentUpdates: { name: string; fields: string[] }[];
  replaceWouldDelete: {
    attendance: number;
    payments: number;
    notes: number;
    enrollments: number;
    installments: number;
    students: number;
    batches: number;
    coaches: number;
  };
};

async function studentChangeFields(
  existing: {
    dob: Date | null;
    parentName: string | null;
    parentPhone: string | null;
    role: string | null;
    joinDate: Date | null;
    medicalNotes: string | null;
  },
  row: ParsedBook["students"][number]
): Promise<string[]> {
  const fields: string[] = [];
  if (row.dob && existing.dob?.toISOString() !== row.dob.toISOString()) fields.push("dob");
  if (row.parentName && row.parentName !== (existing.parentName || "")) fields.push("parentName");
  if (row.parentPhone && row.parentPhone !== (existing.parentPhone || "")) fields.push("parentPhone");
  if (row.role && row.role !== (existing.role || "")) fields.push("role");
  if (row.joinDate && existing.joinDate?.toISOString() !== row.joinDate.toISOString()) fields.push("joinDate");
  if (row.medicalNotes && row.medicalNotes.toLowerCase() !== "none" && row.medicalNotes !== (existing.medicalNotes || "")) {
    fields.push("medicalNotes");
  }
  return fields;
}

export async function previewImport(buffer: Buffer): Promise<ImportPreview> {
  const book = parseWorkbook(buffer);
  const coaches = { create: 0, update: 0 };
  for (const row of book.coaches) {
    const existing = await prisma.coach.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    if (existing) coaches.update += 1;
    else coaches.create += 1;
  }
  const batches = { create: 0, update: 0 };
  for (const row of book.batches) {
    const existing = await prisma.batch.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    if (existing) batches.update += 1;
    else batches.create += 1;
  }
  const students = { create: 0, update: 0, unchanged: 0 };
  const studentUpdates: { name: string; fields: string[] }[] = [];
  for (const row of book.students) {
    const existing = await prisma.student.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    if (!existing) {
      students.create += 1;
      studentUpdates.push({ name: row.name, fields: ["create"] });
      continue;
    }
    const fields = await studentChangeFields(existing, row);
    if (fields.length === 0) students.unchanged += 1;
    else {
      students.update += 1;
      studentUpdates.push({ name: existing.name, fields });
    }
  }
  const [attendance, payments, notes, enrollments, installments, studentCount, batchCount, coachCount] = await Promise.all([
    prisma.attendanceRecord.count(),
    prisma.feePayment.count(),
    prisma.coachNote.count(),
    prisma.feeEnrollment.count(),
    prisma.feeInstallment.count(),
    prisma.student.count(),
    prisma.batch.count(),
    prisma.coach.count(),
  ]);
  return {
    replaceAllowed: excelReplaceAllowed(),
    upsertConfirm: IMPORT_UPSERT_CONFIRM,
    replaceConfirm: IMPORT_REPLACE_CONFIRM,
    coaches,
    batches,
    students,
    studentUpdates: studentUpdates.slice(0, 40),
    replaceWouldDelete: {
      attendance,
      payments,
      notes,
      enrollments,
      installments,
      students: studentCount,
      batches: batchCount,
      coaches: coachCount,
    },
  };
}

async function rosterBackup(db: Db) {
  const [attendance, payments, notes, enrollments, installments, students, batches, coaches] = await Promise.all([
    db.attendanceRecord.findMany(),
    db.feePayment.findMany(),
    db.coachNote.findMany(),
    db.feeEnrollment.findMany(),
    db.feeInstallment.findMany(),
    db.student.findMany(),
    db.batch.findMany(),
    db.coach.findMany(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    attendance,
    payments,
    notes,
    enrollments,
    installments,
    students,
    batches,
    coaches,
  };
}

async function wipeRoster(db: Db) {
  await db.attendanceRecord.deleteMany();
  await db.feePayment.deleteMany();
  await db.coachNote.deleteMany();
  await db.feeInstallment.deleteMany();
  await db.feeEnrollment.deleteMany();
  await db.student.deleteMany();
  await db.batch.deleteMany();
  await db.coach.deleteMany();
}

async function applyRows(db: Db, book: ParsedBook) {
  const coachMap = new Map<string, string>();
  for (const row of book.coaches) {
    const existing = await db.coach.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    if (existing) {
      const data: Prisma.CoachUpdateInput = {};
      if (row.phone && row.phone !== (existing.phone || "")) data.phone = row.phone;
      if (row.specialty && row.specialty !== (existing.specialty || "")) data.specialty = row.specialty;
      const coach = Object.keys(data).length
        ? await db.coach.update({ where: { id: existing.id }, data })
        : existing;
      coachMap.set(row.name.toLowerCase(), coach.id);
    } else {
      const coach = await db.coach.create({
        data: {
          name: row.name,
          phone: row.phone || null,
          specialty: row.specialty || "Coach",
          initials: initials(row.name),
        },
      });
      coachMap.set(row.name.toLowerCase(), coach.id);
    }
  }

  let defaultBatchId: string | null = null;
  for (const row of book.batches) {
    const coachId =
      [...coachMap.entries()].find(([n]) => row.coachName.toLowerCase().includes(n.split(" ")[0]))?.[1] ||
      [...coachMap.values()][0] ||
      null;
    const existing = await db.batch.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    const batch = existing
      ? await db.batch.update({
          where: { id: existing.id },
          data: {
            ...(row.schedule ? { schedule: row.schedule } : {}),
            ...(row.time ? { time: row.time } : {}),
            monthlyFee: row.fee,
            ...(coachId ? { coachId } : {}),
            capacity: row.capacity,
          },
        })
      : await db.batch.create({
          data: {
            name: row.name,
            ageGroup: "Open",
            schedule: row.schedule || "Mon-Fri",
            time: row.time || "5:00 - 7:30 PM",
            venue: "Demo Ground",
            monthlyFee: row.fee,
            coachId,
            capacity: row.capacity,
          },
        });
    if (!defaultBatchId) defaultBatchId = batch.id;
  }

  let imported = 0;
  for (const row of book.students) {
    const existing = await db.student.findFirst({ where: { name: { equals: row.name, mode: "insensitive" } } });
    if (existing) {
      const fields = await studentChangeFields(existing, row);
      if (fields.length) {
        await db.student.update({
          where: { id: existing.id },
          data: {
            ...(fields.includes("dob") ? { dob: row.dob, age: ageFromDob(row.dob) ?? existing.age } : {}),
            ...(fields.includes("parentName") ? { parentName: row.parentName } : {}),
            ...(fields.includes("parentPhone") ? { parentPhone: row.parentPhone } : {}),
            ...(fields.includes("role") ? { role: row.role } : {}),
            ...(fields.includes("joinDate") ? { joinDate: row.joinDate } : {}),
            ...(fields.includes("medicalNotes") ? { medicalNotes: row.medicalNotes } : {}),
          },
        });
      }
    } else {
      if (!defaultBatchId) {
        const any = await db.batch.findFirst();
        defaultBatchId = any?.id ?? null;
      }
      if (!defaultBatchId) {
        const firstCoach = await db.coach.findFirst();
        const created = await db.batch.create({
          data: {
            name: "High Performance",
            ageGroup: "Open (HP)",
            schedule: "Mon-Fri",
            time: "5:00 - 7:30 PM",
            venue: "Demo Ground",
            monthlyFee: 15000,
            capacity: 20,
            coachId: firstCoach?.id,
          },
        });
        defaultBatchId = created.id;
      }
      await db.student.create({
        data: {
          name: row.name,
          dob: row.dob,
          age: ageFromDob(row.dob) ?? 12,
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          role: row.role,
          joinDate: row.joinDate || new Date(),
          medicalNotes: row.medicalNotes || "None",
          batchId: defaultBatchId,
          feeAmount: 15000,
          feeStatus: "paid",
        },
      });
    }
    imported += 1;
  }

  const academy = await db.academy.findFirst();
  if (!academy) {
    await db.academy.create({
      data: { name: "Sun Sports", program: "High Performance Cricket", address: "Demo Ground" },
    });
  }
  return imported;
}

export async function applyImport(buffer: Buffer, mode: "upsert" | "replace") {
  const book = parseWorkbook(buffer);
  if (mode === "replace") {
    const result = await prisma.$transaction(
      async (tx) => {
        const backup = await rosterBackup(tx);
        await wipeRoster(tx);
        const imported = await applyRows(tx, book);
        return { backup, imported };
      },
      { timeout: 120000 }
    );
    try {
      await bootstrapPortalUsers();
    } catch (e) {
      console.warn("User bootstrap after import:", e);
    }
    return {
      ok: true as const,
      mode,
      imported: result.imported,
      backup: result.backup,
      coaches: await prisma.coach.count(),
      batches: await prisma.batch.count(),
      students: await prisma.student.count(),
    };
  }

  const imported = await prisma.$transaction(async (tx) => applyRows(tx, book), { timeout: 120000 });
  try {
    await bootstrapPortalUsers();
  } catch (e) {
    console.warn("User bootstrap after import:", e);
  }
  return {
    ok: true as const,
    mode,
    imported,
    coaches: await prisma.coach.count(),
    batches: await prisma.batch.count(),
    students: await prisma.student.count(),
  };
}

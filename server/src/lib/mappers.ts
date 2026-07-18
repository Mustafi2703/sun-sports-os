import type { Student, Batch, Coach } from "@prisma/client";

export function mapCoach(c: Coach) {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials || c.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
    phone: c.phone || "",
    specialty: c.specialty || "",
    email: c.email || "",
  };
}

export function mapBatch(b: Batch & { _count?: { students: number }; coach?: Coach | null }) {
  return {
    id: b.id,
    name: b.name,
    ageGroup: b.ageGroup || "Open",
    schedule: b.schedule || "",
    time: b.time || "",
    venue: b.venue || "",
    coachId: b.coachId || "",
    capacity: b.capacity,
    studentCount: b._count?.students ?? 0,
    monthlyFee: b.monthlyFee,
  };
}

export function mapStudent(s: Student) {
  const num = (v: number | null | undefined, fallback = 3) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    id: s.id,
    name: s.name,
    age: s.age ?? 12,
    dob: s.dob ? s.dob.toISOString().slice(0, 10) : undefined,
    parentName: s.parentName || "",
    parentPhone: s.parentPhone || "",
    batchId: s.batchId || "",
    role: s.role || undefined,
    feeStatus: (s.feeStatus as "paid" | "overdue1" | "overdue8") || "paid",
    feeAmount: s.feeAmount,
    daysOverdue: s.daysOverdue,
    attendancePct: s.attendancePct,
    scores: {
      batting: num(s.batting),
      bowling: num(s.bowling),
      fielding: num(s.fielding),
      fitness: num(s.fitness),
      temperament: num(s.temperament),
    },
    scoresUpdatedAt: s.updatedAt ? s.updatedAt.toISOString() : undefined,
    joinDate: s.joinDate ? s.joinDate.toISOString().slice(0, 10) : "",
    medicalNotes: s.medicalNotes || undefined,
    lastBowlingSpeed: Array.isArray(s.bowlingSpeeds) ? (s.bowlingSpeeds as number[]) : undefined,
  };
}

export function ageFromDob(dob?: Date | string | null): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return Math.max(5, age);
}

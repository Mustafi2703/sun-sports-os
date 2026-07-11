// Sun Sports — High Performance Academy data (seeded from Excel + localStorage)

export type FeeStatus = "paid" | "overdue1" | "overdue8";
export type AttendanceMark = "present" | "absent" | "late" | "none";

export interface Coach {
  id: string;
  name: string;
  initials: string;
  phone: string;
  specialty: string;
}

export interface Batch {
  id: string;
  name: string;
  ageGroup: string;
  schedule: string;
  time: string;
  venue: string;
  coachId: string;
  capacity: number;
  studentCount: number;
  monthlyFee: number;
}

export interface Student {
  id: string;
  name: string;
  age: number;
  dob?: string;
  parentName: string;
  parentPhone: string;
  batchId: string;
  role?: string;
  feeStatus: FeeStatus;
  feeAmount: number;
  daysOverdue: number;
  attendancePct: number;
  scores: { batting: number; bowling: number; fielding: number; fitness: number; temperament: number };
  joinDate: string;
  medicalNotes?: string;
  lastBowlingSpeed?: number[];
}

export interface AcademySnapshot {
  academyName: string;
  coaches: Coach[];
  batches: Batch[];
  students: Student[];
}

const STORAGE_KEY = "sunsports-academy-data-v1";

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function ageFromDob(dob?: string): number {
  if (!dob) return 12;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 12;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return Math.max(5, age);
}

function formatPhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  if (digits.length === 11 && digits.startsWith("9")) return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return raw ? `+${digits || raw}` : "";
}

function normalizeRole(raw?: string): string {
  if (!raw) return "All-rounder";
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^U-?\d+\s*/i, "")
    .replace(/\bwk\b/gi, "WK")
    .split(" ")
    .map((w) => (w === "WK" ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ") || "All-rounder";
}

function initialsOfName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function buildScores(seed: number, role: string) {
  const rand = seededRandom(seed);
  const base = {
    batting: +(2.8 + rand() * 2.0).toFixed(1),
    bowling: +(2.6 + rand() * 2.0).toFixed(1),
    fielding: +(3.0 + rand() * 1.8).toFixed(1),
    fitness: +(3.0 + rand() * 1.8).toFixed(1),
    temperament: +(2.9 + rand() * 1.9).toFixed(1),
  };
  const r = role.toLowerCase();
  if (r.includes("batt")) base.batting = Math.min(5, +(base.batting + 0.6).toFixed(1));
  if (r.includes("bowl")) base.bowling = Math.min(5, +(base.bowling + 0.6).toFixed(1));
  if (r.includes("field") || r.includes("wk")) base.fielding = Math.min(5, +(base.fielding + 0.5).toFixed(1));
  return base;
}

/** Seed from Sun Sports HP Excel (July 2026 import) */
export const SEED: AcademySnapshot = (() => {
  const coaches: Coach[] = [
    { id: "c1", name: "Harry Sir", initials: "HS", phone: formatPhone("9033002641"), specialty: "Head Coach" },
    { id: "c2", name: "Vikas Sir", initials: "VS", phone: formatPhone("8320901989"), specialty: "Batting Coach" },
    { id: "c3", name: "Zala Sir", initials: "ZS", phone: formatPhone("7573829550"), specialty: "Bowling Coach" },
    { id: "c4", name: "Akhil Sir", initials: "AS", phone: formatPhone("8160746822"), specialty: "Fielding Coach" },
    { id: "c5", name: "Siddhant Sir", initials: "SS", phone: formatPhone("9265752962"), specialty: "Batting Coach" },
    { id: "c6", name: "Utsav Sir", initials: "US", phone: formatPhone("7990591885"), specialty: "Fielding Coach" },
  ];

  const batches: Batch[] = [
    {
      id: "b1",
      name: "High Performance",
      ageGroup: "Open (HP)",
      schedule: "Mon–Fri",
      time: "5:00 – 7:30 PM",
      venue: "Sun Sports Ground",
      coachId: "c1",
      capacity: 20,
      studentCount: 12,
      monthlyFee: 15000,
    },
  ];

  const rawStudents: Array<{
    name: string;
    dob: string;
    parentName: string;
    parentPhone: string;
    role: string;
    joinDate: string;
    medicalNotes: string;
    feeStatus: FeeStatus;
    daysOverdue: number;
  }> = [
    { name: "Ayaan Patel", dob: "2017-07-18", parentName: "Ronak Patel", parentPhone: "9712939753", role: "Batting", joinDate: "2026-05-19", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Hayaan Kanzaria", dob: "2016-01-24", parentName: "Ami Kanzaria", parentPhone: "8490063521", role: "All Rounder", joinDate: "2026-04-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Rishit Patel", dob: "2016-01-04", parentName: "Rajesh Verma", parentPhone: "917654321098", role: "Bowling All Rounder", joinDate: "2026-04-10", medicalNotes: "None", feeStatus: "overdue1", daysOverdue: 5 },
    { name: "Riyaan Patel", dob: "2016-01-04", parentName: "Bhavesh Patel", parentPhone: "927654321098", role: "Batting All Rounder", joinDate: "2026-04-10", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Samar Desai", dob: "2016-05-20", parentName: "Aditya Desai", parentPhone: "9998060606", role: "Batsmen", joinDate: "2026-06-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Rajveer Desai", dob: "2013-12-04", parentName: "Chetna Desai", parentPhone: "9687471747", role: "Batting All Rounder", joinDate: "2026-01-01", medicalNotes: "None", feeStatus: "overdue8", daysOverdue: 12 },
    { name: "Satyaraj Vaghela", dob: "2013-08-21", parentName: "Hardevsinh Vaghela", parentPhone: "9727389727", role: "WK Batsmen", joinDate: "2025-11-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Pratham Patel", dob: "2014-08-28", parentName: "Jatin Patel", parentPhone: "9824717103", role: "Batsmen", joinDate: "2025-11-01", medicalNotes: "None", feeStatus: "overdue1", daysOverdue: 3 },
    { name: "Vishal Yadav", dob: "2012-03-13", parentName: "Sunil Yadav", parentPhone: "9664859001", role: "Bowling", joinDate: "2026-06-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Jash Rana", dob: "2013-04-04", parentName: "Mahipalsinh Rana", parentPhone: "9099937890", role: "Bowling All Rounder", joinDate: "2026-05-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Shwet Patel", dob: "2011-09-15", parentName: "Jigar Patel", parentPhone: "9825123397", role: "WK Batsmen", joinDate: "2026-06-01", medicalNotes: "None", feeStatus: "paid", daysOverdue: 0 },
    { name: "Aditya Zala", dob: "2010-09-26", parentName: "Jitendrasinh Zala", parentPhone: "7573829550", role: "Bowling", joinDate: "2026-04-01", medicalNotes: "None", feeStatus: "overdue1", daysOverdue: 7 },
  ];

  const students: Student[] = rawStudents.map((s, i) => {
    const role = normalizeRole(s.role);
    const seed = 100 + i * 17;
    const rand = seededRandom(seed);
    return {
      id: `s${i + 1}`,
      name: s.name,
      age: ageFromDob(s.dob),
      dob: s.dob,
      parentName: s.parentName,
      parentPhone: formatPhone(s.parentPhone),
      batchId: "b1",
      role,
      feeStatus: s.feeStatus,
      feeAmount: 15000,
      daysOverdue: s.daysOverdue,
      attendancePct: Math.max(68, Math.min(100, Math.round(88 + (rand() - 0.4) * 20))),
      scores: buildScores(seed, role),
      joinDate: s.joinDate,
      medicalNotes: s.medicalNotes,
      lastBowlingSpeed: role.toLowerCase().includes("bowl")
        ? [Math.round(105 + rand() * 20), Math.round(108 + rand() * 20), Math.round(110 + rand() * 22), Math.round(112 + rand() * 22)]
        : undefined,
    };
  });

  batches[0].studentCount = students.length;

  return {
    academyName: "Sun Sports",
    coaches,
    batches,
    students,
  };
})();

function loadSnapshot(): AcademySnapshot {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as AcademySnapshot;
    if (!parsed?.students?.length || !parsed?.batches?.length) return SEED;
    return parsed;
  } catch {
    return SEED;
  }
}

let snapshot: AcademySnapshot = loadSnapshot();

function syncExports() {
  coaches.length = 0;
  coaches.push(...snapshot.coaches);
  batches.length = 0;
  batches.push(...snapshot.batches);
  students.length = 0;
  students.push(...snapshot.students);
  academyName = snapshot.academyName;
  recomputeAggregates();
}

export let academyName = snapshot.academyName;
export const coaches: Coach[] = [...snapshot.coaches];
export const batches: Batch[] = [...snapshot.batches];
export const students: Student[] = [...snapshot.students];

export let totalStudents = 0;
export let monthlyRevenue = 0;
export let overdueAmount = 0;
export let overdueCount = 0;
export let paidCount = 0;
export let overdue1Count = 0;
export let overdue8Count = 0;
export let monthlyRevenueSeries: { month: string; revenue: number }[] = [];
export let todaysSessions: { batchId: string; time: string; venue: string }[] = [];
export let recentActivity: { type: string; text: string; time: string; tone: "success" | "warning" | "info" | "default" }[] = [];
export let attendanceByBatch: { batch: string; w1: number; w2: number; w3: number; w4: number }[] = [];

function recomputeAggregates() {
  totalStudents = students.length;
  monthlyRevenue = students.filter((s) => s.feeStatus === "paid").reduce((a, s) => a + s.feeAmount, 0);
  overdueAmount = students.filter((s) => s.feeStatus !== "paid").reduce((a, s) => a + s.feeAmount, 0);
  overdueCount = students.filter((s) => s.feeStatus !== "paid").length;
  paidCount = students.filter((s) => s.feeStatus === "paid").length;
  overdue1Count = students.filter((s) => s.feeStatus === "overdue1").length;
  overdue8Count = students.filter((s) => s.feeStatus === "overdue8").length;

  const base = Math.max(monthlyRevenue * 0.85, 120000);
  monthlyRevenueSeries = [
    { month: "Feb", revenue: Math.round(base * 0.88) },
    { month: "Mar", revenue: Math.round(base * 0.92) },
    { month: "Apr", revenue: Math.round(base * 0.95) },
    { month: "May", revenue: Math.round(base * 0.98) },
    { month: "Jun", revenue: Math.round(base * 1.02) },
    { month: "Jul", revenue: monthlyRevenue },
  ];

  todaysSessions = batches.slice(0, 3).map((b) => ({
    batchId: b.id,
    time: b.time.split("–")[0]?.trim() || b.time,
    venue: b.venue,
  }));

  const overdue = students.filter((s) => s.feeStatus !== "paid");
  recentActivity = [
    ...(students.filter((s) => s.feeStatus === "paid").slice(0, 2).map((s) => ({
      type: "payment",
      text: `${s.name} — fee recorded as paid (${inr(s.feeAmount)})`,
      time: "Today",
      tone: "success" as const,
    }))),
    ...(overdue.slice(0, 1).map((s) => ({
      type: "absent",
      text: `${s.name} has overdue fees — ${s.daysOverdue} day(s)`,
      time: "Today",
      tone: "warning" as const,
    }))),
    {
      type: "attendance",
      text: `${batches[0]?.name ?? "HP"} session — attendance ready to mark`,
      time: "Today",
      tone: "default" as const,
    },
    {
      type: "lead",
      text: "Data loaded from Sun Sports HP roster",
      time: "Just now",
      tone: "info" as const,
    },
  ].slice(0, 5);

  attendanceByBatch = batches.map((b) => {
    const pct = studentsInBatch(b.id);
    const avg = pct.length
      ? Math.round(pct.reduce((a, s) => a + s.attendancePct, 0) / pct.length)
      : 85;
    return {
      batch: b.name.replace(" Batch", ""),
      w1: Math.max(70, avg - 4),
      w2: Math.max(70, avg - 1),
      w3: Math.max(70, avg + 1),
      w4: Math.min(100, avg + 2),
    };
  });
}

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export const initialsOf = (name: string) => initialsOfName(name);

export const initialsColor = (name: string) => {
  const palette = [
    "bg-emerald-500/20 text-emerald-400",
    "bg-blue-500/20 text-blue-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-violet-500/20 text-violet-400",
    "bg-cyan-500/20 text-cyan-400",
  ];
  const idx = name.charCodeAt(0) % palette.length;
  return palette[idx];
};

syncExports();

export function getCoach(id: string) {
  return coaches.find((c) => c.id === id);
}
export function getBatch(id: string) {
  return batches.find((b) => b.id === id);
}
export function studentsInBatch(id: string) {
  return students.filter((s) => s.batchId === id);
}

export function attendanceGridFor(studentId: string): AttendanceMark[] {
  const seed = studentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const out: AttendanceMark[] = [];
  for (let i = 0; i < 30; i++) {
    const r = rand();
    if (r < 0.35) out.push("none");
    else if (r < 0.88) out.push("present");
    else if (r < 0.95) out.push("late");
    else out.push("absent");
  }
  return out;
}

export function saveSnapshot(next: AcademySnapshot) {
  snapshot = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  syncExports();
}

export function resetToSeed() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  snapshot = structuredClone(SEED);
  syncExports();
}

export function getSnapshot(): AcademySnapshot {
  return {
    academyName: academyName,
    coaches: [...coaches],
    batches: [...batches],
    students: [...students],
  };
}

/** Parse workbook rows (from xlsx) into AcademySnapshot */
export function snapshotFromExcelRows(sheets: {
  students?: Record<string, unknown>[];
  coaches?: Record<string, unknown>[];
  batches?: Record<string, unknown>[];
}): AcademySnapshot {
  const pick = (row: Record<string, unknown>, keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(row).find((rk) => rk.toLowerCase().includes(k.toLowerCase()));
      if (hit != null && row[hit] != null && String(row[hit]).trim() !== "") return row[hit];
    }
    return undefined;
  };

  const excelDate = (v: unknown): string | undefined => {
    if (v == null || v === "") return undefined;
    if (typeof v === "number") {
      // Excel serial date
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v).trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return undefined;
  };

  let nextCoaches: Coach[] =
    (sheets.coaches ?? [])
      .map((row, i) => {
        const name = String(pick(row, ["Coach Name", "name"]) ?? "").trim();
        if (!name) return null;
        const phone = String(pick(row, ["Phone", "phone"]) ?? "");
        const specialty = String(pick(row, ["Specialization", "specialty"]) ?? "Coach");
        return {
          id: `c${i + 1}`,
          name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
          initials: initialsOfName(name),
          phone: formatPhone(phone),
          specialty: specialty.trim() || "Coach",
        } as Coach;
      })
      .filter(Boolean) as Coach[];

  if (!nextCoaches.length) nextCoaches = structuredClone(SEED.coaches);

  let nextBatches: Batch[] =
    (sheets.batches ?? [])
      .map((row, i) => {
        const name = String(pick(row, ["Batch Name", "name"]) ?? "").trim();
        if (!name) return null;
        const coachName = String(pick(row, ["Assigned Coach", "coach"]) ?? "");
        const coach = nextCoaches.find((c) => c.name.toLowerCase().includes(coachName.toLowerCase().split(" ")[0] || "___")) ?? nextCoaches[0];
        const fee = Number(pick(row, ["Monthly Fee", "fee", "₹"]) ?? 15000) || 15000;
        const capRaw = String(pick(row, ["Capacity", "Max"]) ?? "20");
        const cap = parseInt(capRaw, 10) || 20;
        return {
          id: `b${i + 1}`,
          name: name.trim(),
          ageGroup: "Open",
          schedule: String(pick(row, ["Days", "Week"]) ?? "Mon–Fri"),
          time: String(pick(row, ["Timings", "time"]) ?? "5:00 – 7:30 PM"),
          venue: "Sun Sports Ground",
          coachId: coach.id,
          capacity: cap,
          studentCount: 0,
          monthlyFee: fee,
        } as Batch;
      })
      .filter(Boolean) as Batch[];

  if (!nextBatches.length) nextBatches = structuredClone(SEED.batches);

  const defaultBatch = nextBatches[0];
  const fee = defaultBatch.monthlyFee;

  const nextStudents: Student[] =
    (sheets.students ?? [])
      .map((row, i) => {
        const name = String(pick(row, ["Student Full Name", "Student Name", "name"]) ?? "").trim();
        if (!name) return null;
        const dob = excelDate(pick(row, ["Date of Birth", "DOB", "dob"]));
        const parentName = String(pick(row, ["Parent", "Guardian"]) ?? "").trim() || "Parent";
        const parentPhone = String(pick(row, ["WhatsApp", "Phone", "phone"]) ?? "");
        const role = normalizeRole(String(pick(row, ["Assigned Batch", "Batch", "role"]) ?? ""));
        const joinDate = excelDate(pick(row, ["Joining Date", "join"])) ?? new Date().toISOString().slice(0, 10);
        const medicalNotes = String(pick(row, ["Medical", "Allergies"]) ?? "None");
        const seed = 200 + i * 13;
        const rand = seededRandom(seed);
        const r = rand();
        let feeStatus: FeeStatus = "paid";
        let daysOverdue = 0;
        if (r > 0.85) {
          feeStatus = "overdue8";
          daysOverdue = 8 + Math.floor(rand() * 10);
        } else if (r > 0.7) {
          feeStatus = "overdue1";
          daysOverdue = 1 + Math.floor(rand() * 6);
        }
        return {
          id: `s${i + 1}`,
          name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
          age: ageFromDob(dob),
          dob,
          parentName: parentName.replace(/\b\w/g, (c) => c.toUpperCase()),
          parentPhone: formatPhone(parentPhone),
          batchId: defaultBatch.id,
          role,
          feeStatus,
          feeAmount: fee,
          daysOverdue,
          attendancePct: Math.max(65, Math.min(100, Math.round(85 + (rand() - 0.4) * 25))),
          scores: buildScores(seed, role),
          joinDate,
          medicalNotes,
          lastBowlingSpeed: role.toLowerCase().includes("bowl")
            ? [Math.round(100 + rand() * 25), Math.round(102 + rand() * 25), Math.round(105 + rand() * 25)]
            : undefined,
        } as Student;
      })
      .filter(Boolean) as Student[];

  nextBatches = nextBatches.map((b) => ({
    ...b,
    studentCount: nextStudents.filter((s) => s.batchId === b.id).length,
  }));

  return {
    academyName: "Sun Sports",
    coaches: nextCoaches,
    batches: nextBatches,
    students: nextStudents.length ? nextStudents : structuredClone(SEED.students),
  };
}

// Synthetic data for the SportsOS demo: Champions Cricket Academy

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
  parentName: string;
  parentPhone: string;
  batchId: string;
  feeStatus: FeeStatus;
  feeAmount: number;
  daysOverdue: number;
  attendancePct: number;
  scores: { batting: number; bowling: number; fielding: number; fitness: number; temperament: number };
  joinDate: string;
  lastBowlingSpeed?: number[]; // kph
}

export const coaches: Coach[] = [
  { id: "c1", name: "Ramesh Patel", initials: "RP", phone: "+91 98250 12345", specialty: "Batting & Junior Development" },
  { id: "c2", name: "Suresh Mehta", initials: "SM", phone: "+91 98250 23456", specialty: "Bowling & Fitness" },
  { id: "c3", name: "Vikram Shah", initials: "VS", phone: "+91 98250 34567", specialty: "Advanced Batting" },
];

export const batches: Batch[] = [
  { id: "b1", name: "U-12 Batch A", ageGroup: "Under 12", schedule: "Mon/Wed/Fri", time: "4:00 – 5:00 PM", venue: "Ground 1", coachId: "c1", capacity: 20, studentCount: 18, monthlyFee: 3000 },
  { id: "b2", name: "U-14 Batch B", ageGroup: "Under 14", schedule: "Tue/Thu/Sat", time: "5:00 – 6:00 PM", venue: "Ground 1", coachId: "c2", capacity: 20, studentCount: 20, monthlyFee: 3500 },
  { id: "b3", name: "U-16 Batch C", ageGroup: "Under 16", schedule: "Mon/Wed", time: "6:00 – 7:00 PM", venue: "Ground 2", coachId: "c1", capacity: 18, studentCount: 15, monthlyFee: 4000 },
  { id: "b4", name: "Advanced Batting", ageGroup: "Open", schedule: "Sat/Sun", time: "7:00 – 8:00 AM", venue: "Indoor Nets", coachId: "c3", capacity: 14, studentCount: 12, monthlyFee: 6000 },
  { id: "b5", name: "Bowling Specialists", ageGroup: "Open", schedule: "Tue/Thu", time: "4:00 – 5:00 PM", venue: "Nets Area", coachId: "c2", capacity: 22, studentCount: 20, monthlyFee: 5000 },
];

const FIRST_NAMES = ["Arjun","Rohan","Karan","Aditya","Vivaan","Reyansh","Aarav","Krish","Dev","Yash","Ishaan","Kabir","Ayaan","Aryan","Veer","Shaurya","Aniket","Parth","Harsh","Manav","Neel","Pranav","Rudra","Samar","Tanish","Uday","Viraj","Atharv","Dhruv","Ranveer"];
const LAST_NAMES = ["Patel","Shah","Mehta","Desai","Joshi","Trivedi","Bhatt","Modi","Rao","Iyer","Kapoor","Verma","Gupta","Sharma","Malhotra"];
const PARENT_FIRST = ["Rakesh","Sanjay","Hitesh","Amit","Nilesh","Paresh","Manish","Bhavesh","Jignesh","Ketan","Mukesh","Pravin"];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildStudents(): Student[] {
  const rand = seededRandom(42);
  const list: Student[] = [];
  let id = 1;

  batches.forEach((batch) => {
    for (let i = 0; i < batch.studentCount; i++) {
      const fname = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
      const lname = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      const pname = PARENT_FIRST[Math.floor(rand() * PARENT_FIRST.length)] + " " + lname;
      const ageBase = batch.ageGroup === "Under 12" ? 10 : batch.ageGroup === "Under 14" ? 13 : batch.ageGroup === "Under 16" ? 15 : 17;
      const age = ageBase + Math.floor(rand() * 2);

      // Distribute fee status: ~73% paid, ~16% overdue1-7, ~11% overdue8+
      const r = rand();
      let status: FeeStatus = "paid";
      let daysOverdue = 0;
      if (r > 0.89) { status = "overdue8"; daysOverdue = 8 + Math.floor(rand() * 12); }
      else if (r > 0.73) { status = "overdue1"; daysOverdue = 1 + Math.floor(rand() * 6); }

      const attendancePct = Math.max(55, Math.min(100, Math.round(85 + (rand() - 0.5) * 30)));

      list.push({
        id: `s${id++}`,
        name: `${fname} ${lname}`,
        age,
        parentName: pname,
        parentPhone: `+91 98${Math.floor(10000000 + rand() * 89999999)}`,
        batchId: batch.id,
        feeStatus: status,
        feeAmount: batch.monthlyFee,
        daysOverdue,
        attendancePct,
        scores: {
          batting: +(2.5 + rand() * 2.4).toFixed(1),
          bowling: +(2.5 + rand() * 2.4).toFixed(1),
          fielding: +(2.8 + rand() * 2.1).toFixed(1),
          fitness: +(2.7 + rand() * 2.2).toFixed(1),
          temperament: +(2.6 + rand() * 2.3).toFixed(1),
        },
        joinDate: "2025-08-15",
        lastBowlingSpeed: batch.id === "b5" || batch.id === "b2"
          ? [Math.round(95 + rand() * 25), Math.round(96 + rand() * 25), Math.round(98 + rand() * 25), Math.round(100 + rand() * 25)]
          : undefined,
      });
    }
  });

  return list;
}

export const students: Student[] = buildStudents();

// Aggregates
export const totalStudents = students.length;
export const monthlyRevenue = students.filter(s => s.feeStatus === "paid").reduce((a, s) => a + s.feeAmount, 0);
export const overdueAmount = students.filter(s => s.feeStatus !== "paid").reduce((a, s) => a + s.feeAmount, 0);
export const overdueCount = students.filter(s => s.feeStatus !== "paid").length;
export const paidCount = students.filter(s => s.feeStatus === "paid").length;
export const overdue1Count = students.filter(s => s.feeStatus === "overdue1").length;
export const overdue8Count = students.filter(s => s.feeStatus === "overdue8").length;

export const monthlyRevenueSeries = [
  { month: "Jan", revenue: 282000 },
  { month: "Feb", revenue: 295000 },
  { month: "Mar", revenue: 308000 },
  { month: "Apr", revenue: 316000 },
  { month: "May", revenue: 321000 },
  { month: "Jun", revenue: monthlyRevenue },
];

export const todaysSessions = [
  { batchId: "b1", time: "4:00 PM", venue: "Ground 1" },
  { batchId: "b5", time: "4:00 PM", venue: "Nets Area" },
  { batchId: "b2", time: "5:00 PM", venue: "Ground 1" },
];

export const recentActivity = [
  { type: "payment", text: "Arjun Patel paid ₹4,500 via UPI", time: "2 hours ago", tone: "success" as const },
  { type: "absent", text: "Rohan Shah marked absent — U-14 Batch B (3rd consecutive)", time: "4 hours ago", tone: "warning" as const },
  { type: "lead", text: "New enquiry: Karan's parent called for U-12 batch", time: "5 hours ago", tone: "info" as const },
  { type: "attendance", text: "Bowling Specialists attendance marked — 18/20 present", time: "6 hours ago", tone: "default" as const },
  { type: "payment", text: "Vivaan Mehta paid ₹3,500 via UPI", time: "8 hours ago", tone: "success" as const },
];

export const attendanceByBatch = batches.map(b => ({
  batch: b.name.replace(" Batch", ""),
  w1: 70 + Math.floor(Math.random() * 25),
  w2: 70 + Math.floor(Math.random() * 25),
  w3: 70 + Math.floor(Math.random() * 25),
  w4: 70 + Math.floor(Math.random() * 25),
}));

export function getCoach(id: string) { return coaches.find(c => c.id === id); }
export function getBatch(id: string) { return batches.find(b => b.id === id); }
export function studentsInBatch(id: string) { return students.filter(s => s.batchId === id); }

export const academyName = "Champions Cricket Academy";

// Last-30-day attendance grid (per student) — deterministic
export function attendanceGridFor(studentId: string): AttendanceMark[] {
  const seed = studentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const out: AttendanceMark[] = [];
  for (let i = 0; i < 30; i++) {
    const r = rand();
    if (r < 0.35) out.push("none"); // no session that day
    else if (r < 0.88) out.push("present");
    else if (r < 0.95) out.push("late");
    else out.push("absent");
  }
  return out;
}

export const initialsColor = (name: string) => {
  const palette = ["bg-emerald-500/20 text-emerald-400", "bg-blue-500/20 text-blue-400", "bg-amber-500/20 text-amber-400", "bg-rose-500/20 text-rose-400", "bg-violet-500/20 text-violet-400", "bg-cyan-500/20 text-cyan-400"];
  const idx = name.charCodeAt(0) % palette.length;
  return palette[idx];
};

export const initialsOf = (name: string) =>
  name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
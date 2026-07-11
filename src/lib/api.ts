export type FeeStatus = "paid" | "overdue1" | "overdue8";

export interface Coach {
  id: string;
  name: string;
  initials: string;
  phone: string;
  specialty: string;
  email?: string;
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
  aggregates?: {
    totalStudents: number;
    monthlyRevenue: number;
    overdueAmount: number;
    overdueCount: number;
    paidCount: number;
    overdue1Count: number;
    overdue8Count: number;
    monthlyRevenueSeries: { month: string; revenue: number }[];
  };
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE || "(same origin / relative)",
  health: () => request<{ ok: boolean }>("/api/health"),
  snapshot: () => request<AcademySnapshot>("/api/snapshot"),
  listStudents: (q?: Record<string, string>) => {
    const qs = q ? "?" + new URLSearchParams(q).toString() : "";
    return request<Student[]>(`/api/students${qs}`);
  },
  createStudent: (body: Partial<Student>) =>
    request<Student>("/api/students", { method: "POST", body: JSON.stringify(body) }),
  updateStudent: (id: string, body: Partial<Student>) =>
    request<Student>(`/api/students/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteStudent: (id: string) =>
    request<{ ok: boolean }>(`/api/students/${id}`, { method: "DELETE" }),
  createCoach: (body: Partial<Coach>) =>
    request<Coach>("/api/coaches", { method: "POST", body: JSON.stringify(body) }),
  updateCoach: (id: string, body: Partial<Coach>) =>
    request<Coach>(`/api/coaches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteCoach: (id: string) =>
    request<{ ok: boolean }>(`/api/coaches/${id}`, { method: "DELETE" }),
  createBatch: (body: Partial<Batch>) =>
    request<Batch>("/api/batches", { method: "POST", body: JSON.stringify(body) }),
  updateBatch: (id: string, body: Partial<Batch>) =>
    request<Batch>(`/api/batches/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBatch: (id: string) =>
    request<{ ok: boolean }>(`/api/batches/${id}`, { method: "DELETE" }),
  createPayment: (body: { studentId: string; amount: number; method?: string; month?: string; note?: string }) =>
    request("/api/payments", { method: "POST", body: JSON.stringify(body) }),
  deletePayment: (id: string) =>
    request<{ ok: boolean }>(`/api/payments/${id}`, { method: "DELETE" }),
  saveAttendance: (body: { date: string; batchId?: string; marks: { studentId: string; status: string }[] }) =>
    request("/api/attendance/bulk", { method: "POST", body: JSON.stringify(body) }),
  createEnquiry: (body: Record<string, unknown>) =>
    request("/api/enquiries", { method: "POST", body: JSON.stringify(body) }),
  updateEnquiry: (id: string, body: Record<string, unknown>) =>
    request(`/api/enquiries/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEnquiry: (id: string) =>
    request<{ ok: boolean }>(`/api/enquiries/${id}`, { method: "DELETE" }),
  listEnquiries: () => request<Record<string, unknown>[]>("/api/enquiries"),
  importExcel: async (file: File, mode: "upsert" | "replace" = "upsert") => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    const res = await fetch(`${API_BASE}/api/import/excel`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
  },
};

export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export type AttendanceMark = "present" | "absent" | "late" | "none";

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

export const initialsColor = (name: string) => {
  const palette = [
    "bg-emerald-500/20 text-emerald-400",
    "bg-blue-500/20 text-blue-400",
    "bg-amber-500/20 text-amber-400",
    "bg-rose-500/20 text-rose-400",
    "bg-violet-500/20 text-violet-400",
    "bg-cyan-500/20 text-cyan-400",
  ];
  return palette[name.charCodeAt(0) % palette.length];
};

export const initialsOf = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

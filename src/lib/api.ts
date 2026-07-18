export type FeeStatus = "paid" | "overdue1" | "overdue8";
export type AttendanceMark = "present" | "absent" | "late" | "none";
export type Portal = "parent" | "coach" | "admin";
export type UserRole = Portal;

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  name: string;
  coachId?: string | null;
  parentPhone?: string | null;
}

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
  scoresUpdatedAt?: string;
  joinDate: string;
  medicalNotes?: string;
  lastBowlingSpeed?: number[];
}

export interface AttendanceGridDay {
  date: string;
  status: AttendanceMark;
}

export interface FeePayment {
  id: string;
  studentId: string;
  amount: number;
  method: string;
  month?: string | null;
  note?: string | null;
  paidAt: string;
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
    todayAttendance?: { marked: number; present: number; absent: number };
    attendanceByBatch?: { batch: string; batchId: string; w1: number; w2: number; w3: number; w4: number }[];
    recentActivity?: { type: string; text: string; time: string; tone: "success" | "warning" | "info" | "default" }[];
  };
}

export interface ParentChild extends Student {
  batch: Batch | null;
  coach: Coach | null;
  attendanceGrid: AttendanceGridDay[];
  payments: FeePayment[];
  notes?: { id: string; note: string; author?: string | null; createdAt: string }[];
}

export interface ParentPortalData {
  parent: { name: string; phone: string };
  children: ParentChild[];
  tournaments?: TournamentSummary[];
}

export interface TournamentSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  format: string;
  venue: string;
  status: string;
  studentIds: string[];
  opponents: string[];
  matches: unknown[];
}

export interface CoachPortalData {
  coach: Coach;
  batches: Batch[];
  students: Student[];
  coaches?: Coach[];
  attendanceByBatch: { batch: string; batchId: string; w1: number; w2: number; w3: number; w4: number }[];
  myBatchIds?: string[];
  tournaments?: TournamentSummary[];
  notes?: { id: string; studentId: string; note: string; author?: string | null; createdAt: string }[];
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

let activeAuthToken: string | null = null;

/** Set by AuthContext when the active portal session changes */
export function setAuthToken(token: string | null) {
  activeAuthToken = token;
}

function authHeaders(): Record<string, string> {
  if (activeAuthToken) return { Authorization: `Bearer ${activeAuthToken}` };
  // Fallback if memory token was lost (e.g. HMR) — prefer path-matching role later via AuthContext
  try {
    for (const role of ["admin", "parent", "coach"] as const) {
      const t = localStorage.getItem(`sunsports_token_${role}`);
      if (t) return { Authorization: `Bearer ${t}` };
    }
  } catch {
    /* ignore */
  }
  return {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: API_BASE || "(same origin / relative)",
  health: () => request<{ ok: boolean }>("/api/health"),
  login: (body: { phone: string; pin: string; portal: Portal }) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  demoAccounts: () =>
    request<{
      pin: string;
      admin: { phone: string; name: string };
      coaches: { phone: string; name: string }[];
      parents: { phone: string; name: string }[];
    }>("/api/portal/demo-accounts"),
  authMe: (token?: string) =>
    request<AuthUser>("/api/auth/me", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
  parentPortal: () => request<ParentPortalData>("/api/portal/parent"),
  coachPortal: () => request<CoachPortalData>("/api/portal/coach"),
  coachSaveAttendance: (body: { date: string; batchId?: string; marks: { studentId: string; status: string }[] }) =>
    request("/api/portal/coach/attendance", { method: "POST", body: JSON.stringify(body) }),
  coachAddNote: (body: { studentId: string; note: string }) =>
    request("/api/portal/coach/notes", { method: "POST", body: JSON.stringify(body) }),
  coachUpdateScores: (studentId: string, scores: Student["scores"]) =>
    request<Student>(`/api/portal/coach/students/${studentId}/scores`, {
      method: "PUT",
      body: JSON.stringify({ scores }),
    }),
  listTournaments: () => request<TournamentSummary[]>("/api/tournaments"),
  createTournament: (body: Partial<TournamentSummary> & { name: string; startDate: string; endDate: string }) =>
    request<TournamentSummary>("/api/tournaments", { method: "POST", body: JSON.stringify(body) }),
  updateTournament: (id: string, body: Partial<TournamentSummary>) =>
    request<TournamentSummary>(`/api/tournaments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTournament: (id: string) =>
    request<{ ok: boolean }>(`/api/tournaments/${id}`, { method: "DELETE" }),
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
  listPayments: (studentId?: string) => {
    const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    return request<FeePayment[]>(`/api/payments${qs}`);
  },
  createPayment: (body: { studentId: string; amount: number; method?: string; month?: string; note?: string }) =>
    request("/api/payments", { method: "POST", body: JSON.stringify(body) }),
  deletePayment: (id: string) =>
    request<{ ok: boolean }>(`/api/payments/${id}`, { method: "DELETE" }),
  listAttendance: (q: { date?: string; batchId?: string; studentId?: string }) => {
    const qs = "?" + new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return request<{ id: string; studentId: string; status: string; date: string }[]>(`/api/attendance${qs}`);
  },
  attendanceGrid: (studentId: string, days = 30) =>
    request<{ studentId: string; days: number; grid: AttendanceGridDay[] }>(
      `/api/attendance/grid/${studentId}?days=${days}`
    ),
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
    const res = await fetch(`${API_BASE}/api/import/excel`, {
      method: "POST",
      body: fd,
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("Import failed");
    return res.json();
  },
};

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

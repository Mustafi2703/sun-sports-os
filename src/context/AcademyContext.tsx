import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
  attendanceGridFor,
  initialsColor,
  initialsOf,
  inr,
  type AcademySnapshot,
  type AttendanceMark,
  type Batch,
  type Coach,
  type Student,
} from "@/lib/api";

interface AcademyContextValue {
  loading: boolean;
  error: string | null;
  academyName: string;
  students: Student[];
  batches: Batch[];
  coaches: Coach[];
  totalStudents: number;
  monthlyRevenue: number;
  overdueAmount: number;
  overdueCount: number;
  paidCount: number;
  overdue1Count: number;
  overdue8Count: number;
  monthlyRevenueSeries: { month: string; revenue: number }[];
  todaysSessions: { batchId: string; time: string; venue: string }[];
  recentActivity: { type: string; text: string; time: string; tone: "success" | "warning" | "info" | "default" }[];
  attendanceByBatch: { batch: string; w1: number; w2: number; w3: number; w4: number }[];
  getCoach: (id: string) => Coach | undefined;
  getBatch: (id: string) => Batch | undefined;
  studentsInBatch: (id: string) => Student[];
  attendanceGridFor: (id: string) => AttendanceMark[];
  initialsOf: typeof initialsOf;
  initialsColor: typeof initialsColor;
  inr: typeof inr;
  refresh: () => Promise<void>;
  api: typeof api;
}

const AcademyContext = createContext<AcademyContextValue | null>(null);

function emptySnapshot(): AcademySnapshot {
  return { academyName: "Sun Sports", coaches: [], batches: [], students: [] };
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<AcademySnapshot>(emptySnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await api.snapshot();
      setSnap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load academy data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AcademyContextValue>(() => {
    const students = snap.students || [];
    const batches = snap.batches || [];
    const coaches = snap.coaches || [];
    const agg = snap.aggregates;

    const paidCount = agg?.paidCount ?? students.filter((s) => s.feeStatus === "paid").length;
    const overdue1Count = agg?.overdue1Count ?? students.filter((s) => s.feeStatus === "overdue1").length;
    const overdue8Count = agg?.overdue8Count ?? students.filter((s) => s.feeStatus === "overdue8").length;
    const monthlyRevenue = agg?.monthlyRevenue ?? students.filter((s) => s.feeStatus === "paid").reduce((a, s) => a + s.feeAmount, 0);
    const overdueAmount = agg?.overdueAmount ?? students.filter((s) => s.feeStatus !== "paid").reduce((a, s) => a + s.feeAmount, 0);

    return {
      loading,
      error,
      academyName: snap.academyName || "Sun Sports",
      students,
      batches,
      coaches,
      totalStudents: agg?.totalStudents ?? students.length,
      monthlyRevenue,
      overdueAmount,
      overdueCount: agg?.overdueCount ?? overdue1Count + overdue8Count,
      paidCount,
      overdue1Count,
      overdue8Count,
      monthlyRevenueSeries: agg?.monthlyRevenueSeries ?? [],
      todaysSessions: batches.slice(0, 3).map((b) => ({
        batchId: b.id,
        time: b.time.split("–")[0]?.trim() || b.time,
        venue: b.venue,
      })),
      recentActivity: [
        ...students.filter((s) => s.feeStatus === "paid").slice(0, 2).map((s) => ({
          type: "payment",
          text: `${s.name} — fee recorded as paid (${inr(s.feeAmount)})`,
          time: "Today",
          tone: "success" as const,
        })),
        ...students.filter((s) => s.feeStatus !== "paid").slice(0, 1).map((s) => ({
          type: "absent",
          text: `${s.name} has overdue fees — ${s.daysOverdue} day(s)`,
          time: "Today",
          tone: "warning" as const,
        })),
        {
          type: "info",
          text: "Connected to SportsOS API",
          time: "Just now",
          tone: "info" as const,
        },
      ].slice(0, 5),
      attendanceByBatch: batches.map((b) => {
        const list = students.filter((s) => s.batchId === b.id);
        const avg = list.length ? Math.round(list.reduce((a, s) => a + s.attendancePct, 0) / list.length) : 85;
        return { batch: b.name, w1: avg - 3, w2: avg - 1, w3: avg + 1, w4: Math.min(100, avg + 2) };
      }),
      getCoach: (id) => coaches.find((c) => c.id === id),
      getBatch: (id) => batches.find((b) => b.id === id),
      studentsInBatch: (id) => students.filter((s) => s.batchId === id),
      attendanceGridFor,
      initialsOf,
      initialsColor,
      inr,
      refresh,
      api,
    };
  }, [snap, loading, error, refresh]);

  return <AcademyContext.Provider value={value}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error("useAcademy must be used within AcademyProvider");
  return ctx;
}

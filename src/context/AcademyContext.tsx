import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  api,
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
  todayAttendance: { marked: number; present: number; absent: number };
  recentActivity: { type: string; text: string; time: string; tone: "success" | "warning" | "info" | "default" }[];
  attendanceByBatch: { batch: string; w1: number; w2: number; w3: number; w4: number }[];
  getCoach: (id: string) => Coach | undefined;
  getBatch: (id: string) => Batch | undefined;
  studentsInBatch: (id: string) => Student[];
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

    return {
      loading,
      error,
      academyName: snap.academyName || "Sun Sports",
      students,
      batches,
      coaches,
      totalStudents: agg?.totalStudents ?? students.length,
      monthlyRevenue: agg?.monthlyRevenue ?? 0,
      overdueAmount: agg?.overdueAmount ?? 0,
      overdueCount: agg?.overdueCount ?? 0,
      paidCount: agg?.paidCount ?? 0,
      overdue1Count: agg?.overdue1Count ?? 0,
      overdue8Count: agg?.overdue8Count ?? 0,
      monthlyRevenueSeries: agg?.monthlyRevenueSeries ?? [],
      todaysSessions: batches.map((b) => ({
        batchId: b.id,
        time: b.time.split("–")[0]?.trim() || b.time,
        venue: b.venue,
      })),
      todayAttendance: agg?.todayAttendance ?? { marked: 0, present: 0, absent: 0 },
      recentActivity: agg?.recentActivity?.length
        ? agg.recentActivity
        : [{ type: "info", text: "No recent activity yet — mark attendance or record a payment.", time: "—", tone: "info" as const }],
      attendanceByBatch: (agg?.attendanceByBatch ?? []).map((b) => ({
        batch: b.batch,
        w1: b.w1,
        w2: b.w2,
        w3: b.w3,
        w4: b.w4,
      })),
      getCoach: (id) => coaches.find((c) => c.id === id),
      getBatch: (id) => batches.find((b) => b.id === id),
      studentsInBatch: (id) => students.filter((s) => s.batchId === id),
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

export type { AttendanceMark };

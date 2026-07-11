import type { Student } from "@/lib/api";

export type TournamentStatus = "upcoming" | "ongoing" | "completed";
export type MatchFormat = "T20" | "50-over" | "Test" | "Box Cricket";
export type MatchResult = "won" | "lost" | "tied";

export interface MatchStat {
  studentId: string;
  runs: number;
  ballsFaced: number;
  wickets: number;
  oversBowled: number;
  catches: number;
  runOuts: number;
  potm: boolean;
}

export interface Match {
  id: string;
  number: number;
  date: string;
  time: string;
  opponent: string;
  venue: string;
  completed: boolean;
  teamRuns?: number;
  teamWickets?: number;
  oppRuns?: number;
  result?: MatchResult;
  stats?: MatchStat[];
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  format: MatchFormat;
  studentIds: string[];
  opponents: string[];
  venue: string;
  status: TournamentStatus;
  matches: Match[];
}

/** No mock tournaments — create from the UI */
export const tournaments: Tournament[] = [];

export function computeLeaderboard(t: Tournament, roster: Student[] = []) {
  const map = new Map<string, { studentId: string; name: string; runs: number; wickets: number; catches: number; matches: number; battingAvg: number }>();
  for (const m of t.matches) {
    if (!m.stats) continue;
    for (const s of m.stats) {
      const student = roster.find((r) => r.id === s.studentId);
      const cur = map.get(s.studentId) || {
        studentId: s.studentId,
        name: student?.name || s.studentId,
        runs: 0,
        wickets: 0,
        catches: 0,
        matches: 0,
        battingAvg: 0,
      };
      cur.runs += s.runs;
      cur.wickets += s.wickets;
      cur.catches += s.catches;
      cur.matches += 1;
      cur.battingAvg = cur.matches ? +(cur.runs / cur.matches).toFixed(1) : 0;
      if (student) cur.name = student.name;
      map.set(s.studentId, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.runs - a.runs || b.wickets - a.wickets);
}

export function studentRole(student: Student | undefined) {
  return student?.role || "Player";
}

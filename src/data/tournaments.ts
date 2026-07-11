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

const sampleStats = (ids: string[]): MatchStat[] =>
  ids.map((id, i) => ({
    studentId: id,
    runs: Math.floor(Math.random() * 60) + (i === 0 ? 40 : 0),
    ballsFaced: Math.floor(Math.random() * 40) + 10,
    wickets: Math.floor(Math.random() * 3),
    oversBowled: Math.floor(Math.random() * 4),
    catches: Math.random() > 0.7 ? 1 : 0,
    runOuts: Math.random() > 0.85 ? 1 : 0,
    potm: i === 0,
  }));

/** Placeholder IDs — Tournaments page remaps to live roster via useAcademy */
const ids1 = Array.from({ length: 12 }, (_, i) => `seed-s${i + 1}`);

export const tournaments: Tournament[] = [
  {
    id: "t1",
    name: "Sun Sports Cup 2026",
    startDate: "2026-04-15",
    endDate: "2026-04-20",
    format: "T20",
    studentIds: ids1,
    opponents: ["Royal CC", "Eagles XI", "Sunrisers Academy"],
    venue: "Sun Sports Ground",
    status: "ongoing",
    matches: [
      { id: "m1", number: 1, date: "2026-04-15", time: "9:00 AM", opponent: "Royal CC", venue: "Sun Sports Ground", completed: true, teamRuns: 168, teamWickets: 6, oppRuns: 142, result: "won", stats: sampleStats(ids1) },
      { id: "m2", number: 2, date: "2026-04-17", time: "2:00 PM", opponent: "Eagles XI", venue: "Sun Sports Ground", completed: true, teamRuns: 145, teamWickets: 8, oppRuns: 150, result: "lost", stats: sampleStats(ids1) },
      { id: "m3", number: 3, date: "2026-04-20", time: "9:00 AM", opponent: "Sunrisers Academy", venue: "Sun Sports Ground", completed: false },
    ],
  },
  {
    id: "t2",
    name: "HP Invitational",
    startDate: "2026-06-01",
    endDate: "2026-06-05",
    format: "T20",
    studentIds: ids1.slice(0, 10),
    opponents: ["City Stars", "Net Warriors"],
    venue: "Indoor Nets",
    status: "upcoming",
    matches: [],
  },
];

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

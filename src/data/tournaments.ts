import { students, Student } from "./academy";

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

const pickStudents = (n: number, offset = 0) => students.slice(offset, offset + n).map(s => s.id);

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

const ids1 = pickStudents(12, 0);
const ids2 = pickStudents(10, 20);
const ids3 = pickStudents(14, 35);

export const tournaments: Tournament[] = [
  {
    id: "t1",
    name: "Champions Cup 2026",
    startDate: "2026-04-15",
    endDate: "2026-04-20",
    format: "T20",
    studentIds: ids1,
    opponents: ["Royal CC", "Eagles XI", "Sunrisers Academy"],
    venue: "Sardar Patel Stadium",
    status: "ongoing",
    matches: [
      { id: "m1", number: 1, date: "2026-04-15", time: "9:00 AM", opponent: "Royal CC", venue: "Sardar Patel Stadium", completed: true, teamRuns: 168, teamWickets: 6, oppRuns: 142, result: "won", stats: sampleStats(ids1) },
      { id: "m2", number: 2, date: "2026-04-17", time: "2:00 PM", opponent: "Eagles XI", venue: "Sardar Patel Stadium", completed: true, teamRuns: 145, teamWickets: 8, oppRuns: 150, result: "lost", stats: sampleStats(ids1) },
      { id: "m3", number: 3, date: "2026-04-20", time: "9:00 AM", opponent: "Sunrisers Academy", venue: "Sardar Patel Stadium", completed: false },
    ],
  },
  {
    id: "t2",
    name: "Spring Knockout 2026",
    startDate: "2026-05-02",
    endDate: "2026-05-08",
    format: "50-over",
    studentIds: ids2,
    opponents: ["MCA Strikers", "Galaxy CC"],
    venue: "Motera Ground 2",
    status: "upcoming",
    matches: [
      { id: "m4", number: 1, date: "2026-05-02", time: "10:00 AM", opponent: "MCA Strikers", venue: "Motera Ground 2", completed: false },
      { id: "m5", number: 2, date: "2026-05-08", time: "10:00 AM", opponent: "Galaxy CC", venue: "Motera Ground 2", completed: false },
    ],
  },
  {
    id: "t3",
    name: "Winter League 2025",
    startDate: "2025-12-10",
    endDate: "2025-12-22",
    format: "T20",
    studentIds: ids3,
    opponents: ["Titans", "Warriors XI", "Rangers CC"],
    venue: "Indoor Nets Complex",
    status: "completed",
    matches: [
      { id: "m6", number: 1, date: "2025-12-10", time: "9:00 AM", opponent: "Titans", venue: "Indoor Nets Complex", completed: true, teamRuns: 178, teamWickets: 5, oppRuns: 160, result: "won", stats: sampleStats(ids3) },
      { id: "m7", number: 2, date: "2025-12-15", time: "9:00 AM", opponent: "Warriors XI", venue: "Indoor Nets Complex", completed: true, teamRuns: 155, teamWickets: 7, oppRuns: 140, result: "won", stats: sampleStats(ids3) },
      { id: "m8", number: 3, date: "2025-12-22", time: "9:00 AM", opponent: "Rangers CC", venue: "Indoor Nets Complex", completed: true, teamRuns: 190, teamWickets: 4, oppRuns: 165, result: "won", stats: sampleStats(ids3) },
    ],
  },
];

export function studentRole(s: Student): "Batsman" | "Bowler" | "All-rounder" {
  const { batting, bowling } = s.scores;
  if (Math.abs(batting - bowling) < 0.5) return "All-rounder";
  return batting > bowling ? "Batsman" : "Bowler";
}

export interface LeaderboardRow {
  studentId: string;
  name: string;
  matches: number;
  runs: number;
  ballsFaced: number;
  dismissals: number;
  battingAvg: number;
  strikeRate: number;
  wickets: number;
  potm: number;
}

export function computeLeaderboard(t: Tournament): LeaderboardRow[] {
  const map = new Map<string, LeaderboardRow>();
  t.studentIds.forEach(id => {
    const s = students.find(st => st.id === id);
    if (!s) return;
    map.set(id, { studentId: id, name: s.name, matches: 0, runs: 0, ballsFaced: 0, dismissals: 0, battingAvg: 0, strikeRate: 0, wickets: 0, potm: 0 });
  });
  t.matches.filter(m => m.completed && m.stats).forEach(m => {
    m.stats!.forEach(st => {
      const row = map.get(st.studentId);
      if (!row) return;
      row.matches += 1;
      row.runs += st.runs;
      row.ballsFaced += st.ballsFaced;
      row.wickets += st.wickets;
      if (st.potm) row.potm += 1;
      if (st.ballsFaced > 0 && st.runs < 50) row.dismissals += 1;
    });
  });
  map.forEach(row => {
    row.battingAvg = row.dismissals > 0 ? +(row.runs / row.dismissals).toFixed(2) : row.runs;
    row.strikeRate = row.ballsFaced > 0 ? +((row.runs / row.ballsFaced) * 100).toFixed(1) : 0;
  });
  return Array.from(map.values());
}

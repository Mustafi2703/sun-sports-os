import { useMemo, useState } from "react";
import { Trophy, Plus, Calendar, MapPin, Users, Share2, Eye, Pencil, Award, Medal, ArrowUpDown, X } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tournaments as initialTournaments, Tournament, Match, MatchFormat, MatchStat, computeLeaderboard, studentRole } from "@/data/tournaments";
import { useAcademy } from "@/context/AcademyContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_STYLES: Record<string, string> = {
  upcoming: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ongoing: "bg-primary/15 text-primary border-primary/30",
  completed: "bg-muted text-muted-foreground border-border",
};

const Tournaments = () => {
  const { students, initialsOf, initialsColor } = useAcademy();
  const [list, setList] = useState<Tournament[]>(initialTournaments);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [statsMatchId, setStatsMatchId] = useState<{ tId: string; mId: string } | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);

  const active = list.filter(t => t.status !== "completed");
  const past = list.filter(t => t.status === "completed");

  const detailsTournament = list.find(t => t.id === detailsId) ?? null;
  const statsCtx = statsMatchId ? {
    tournament: list.find(t => t.id === statsMatchId.tId)!,
    match: list.find(t => t.id === statsMatchId.tId)?.matches.find(m => m.id === statsMatchId.mId)!,
  } : null;

  const upsertTournament = (t: Tournament) => {
    setList(prev => {
      const exists = prev.find(p => p.id === t.id);
      return exists ? prev.map(p => p.id === t.id ? t : p) : [t, ...prev];
    });
  };

  const saveStats = (tId: string, mId: string, patch: Partial<Match>) => {
    setList(prev => prev.map(t => t.id !== tId ? t : {
      ...t,
      matches: t.matches.map(m => m.id !== mId ? m : { ...m, ...patch, completed: true }),
    }));
    toast.success("Match stats saved");
    setStatsMatchId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournament Management"
        description="Create tournaments, log match stats, and share results with parents."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Create New Tournament
          </Button>
        }
      />

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-5">
          <TournamentGrid items={active} onView={setDetailsId} onShare={setShareId} />
        </TabsContent>
        <TabsContent value="past" className="mt-5">
          <TournamentGrid items={past} onView={setDetailsId} onShare={setShareId} />
        </TabsContent>
      </Tabs>

      <CreateTournamentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={(t) => { upsertTournament(t); toast.success("Tournament created"); setCreateOpen(false); }}
      />

      <TournamentDetailsDialog
        tournament={detailsTournament}
        onOpenChange={(o) => !o && setDetailsId(null)}
        onLogStats={(mId) => detailsTournament && setStatsMatchId({ tId: detailsTournament.id, mId })}
        onShare={() => detailsTournament && setShareId(detailsTournament.id)}
      />

      {statsCtx && (
        <LogStatsDialog
          tournament={statsCtx.tournament}
          match={statsCtx.match}
          onClose={() => setStatsMatchId(null)}
          onSave={(patch) => saveStats(statsCtx.tournament.id, statsCtx.match.id, patch)}
        />
      )}

      <ShareDialog
        tournament={list.find(t => t.id === shareId) ?? null}
        onOpenChange={(o) => !o && setShareId(null)}
      />
    </div>
  );
};

const TournamentGrid = ({ items, onView, onShare }: {
  items: Tournament[]; onView: (id: string) => void; onShare: (id: string) => void;
}) => {
  if (items.length === 0) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Trophy className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No tournaments here yet.</p>
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map(t => <TournamentCard key={t.id} t={t} onView={() => onView(t.id)} onShare={() => onShare(t.id)} />)}
    </div>
  );
};

const TournamentCard = ({ t, onView, onShare }: { t: Tournament; onView: () => void; onShare: () => void; }) => {
  const completedMatches = t.matches.filter(m => m.completed).length;
  return (
    <Card className="p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-semibold truncate">{t.name}</h3>
            <p className="text-xs text-muted-foreground">{t.format} • {completedMatches}/{t.matches.length} matches</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("capitalize", STATUS_STYLES[t.status])}>{t.status}</Badge>
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> {fmtRange(t.startDate, t.endDate)}</div>
        <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {t.venue}</div>
        <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> {t.studentIds.length} students</div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onView}><Eye className="h-3.5 w-3.5" /> View</Button>
        <Button size="sm" variant="outline" onClick={() => toast.info("Edit form opens here")}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={onShare}><Share2 className="h-3.5 w-3.5" /></Button>
      </div>
    </Card>
  );
};

// ---------------- Create Tournament ----------------
const CreateTournamentDialog = ({ open, onOpenChange, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; onSave: (t: Tournament) => void;
}) => {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [format, setFormat] = useState<MatchFormat>("T20");
  const [venue, setVenue] = useState("");
  const [opponentsText, setOpponentsText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchRows, setMatchRows] = useState<{ date: string; time: string; opponent: string }[]>([{ date: "", time: "", opponent: "" }]);

  const reset = () => {
    setName(""); setStartDate(""); setEndDate(""); setFormat("T20"); setVenue("");
    setOpponentsText(""); setSelectedIds([]); setMatchRows([{ date: "", time: "", opponent: "" }]);
  };

  const submit = () => {
    if (!name || !startDate || !endDate) { toast.error("Name and date range required"); return; }
    const opponents = opponentsText.split(",").map(o => o.trim()).filter(Boolean);
    const matches: Match[] = matchRows.filter(r => r.date && r.opponent).map((r, i) => ({
      id: `m_${Date.now()}_${i}`, number: i + 1, date: r.date, time: r.time || "9:00 AM",
      opponent: r.opponent, venue, completed: false,
    }));
    const today = new Date().toISOString().slice(0, 10);
    const status: Tournament["status"] = endDate < today ? "completed" : startDate > today ? "upcoming" : "ongoing";
    onSave({
      id: `t_${Date.now()}`, name, startDate, endDate, format, venue,
      studentIds: selectedIds, opponents, status, matches,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">Create New Tournament</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Tournament Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Champions Cup 2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as MatchFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="T20">T20</SelectItem>
                  <SelectItem value="50-over">50-over</SelectItem>
                  <SelectItem value="Test">Test</SelectItem>
                  <SelectItem value="Box Cricket">Box Cricket</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ground / Venue</Label>
              <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder="Sardar Patel Stadium" />
            </div>
          </div>
          <div>
            <Label>Opposition Teams (comma-separated)</Label>
            <Input value={opponentsText} onChange={e => setOpponentsText(e.target.value)} placeholder="Royal CC, Eagles XI, Sunrisers" />
          </div>
          <div>
            <Label>Participating Students ({selectedIds.length} selected)</Label>
            <ScrollArea className="h-40 rounded-md border border-border p-2 mt-1">
              <div className="grid grid-cols-2 gap-1">
                {students.slice(0, 40).map(s => (
                  <label key={s.id} className="flex items-center gap-2 text-sm py-1 px-1.5 rounded hover:bg-muted/30 cursor-pointer">
                    <Checkbox
                      checked={selectedIds.includes(s.id)}
                      onCheckedChange={(c) => setSelectedIds(p => c ? [...p, s.id] : p.filter(i => i !== s.id))}
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Match Schedule</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setMatchRows(p => [...p, { date: "", time: "", opponent: "" }])}>
                <Plus className="h-3.5 w-3.5" /> Add Match
              </Button>
            </div>
            <div className="space-y-2">
              {matchRows.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr,1fr,1.5fr,auto] gap-2">
                  <Input type="date" value={row.date} onChange={e => setMatchRows(p => p.map((r, idx) => idx === i ? { ...r, date: e.target.value } : r))} />
                  <Input placeholder="9:00 AM" value={row.time} onChange={e => setMatchRows(p => p.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))} />
                  <Input placeholder="Opponent" value={row.opponent} onChange={e => setMatchRows(p => p.map((r, idx) => idx === i ? { ...r, opponent: e.target.value } : r))} />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setMatchRows(p => p.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-primary text-primary-foreground hover:bg-primary/90">Save Tournament</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------- Tournament Details ----------------
const TournamentDetailsDialog = ({ tournament, onOpenChange, onLogStats, onShare }: {
  tournament: Tournament | null; onOpenChange: (o: boolean) => void;
  onLogStats: (mId: string) => void; onShare: () => void;
}) => {
  const { students, initialsOf, initialsColor } = useAcademy();
  const [sortKey, setSortKey] = useState<"runs" | "wickets" | "battingAvg">("runs");
  const leaderboard = useMemo(() => {
    if (!tournament) return [];
    const rows = computeLeaderboard(tournament, students);
    return rows.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [tournament, sortKey, students]);
  if (!tournament) return null;

  return (
    <Dialog open={!!tournament} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-2xl flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> {tournament.name}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {fmtRange(tournament.startDate, tournament.endDate)} • {tournament.format} • {tournament.venue}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onShare}><Share2 className="h-3.5 w-3.5" /> Share Stats</Button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Participating students */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Participating Students ({tournament.studentIds.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {tournament.studentIds.map(id => {
                const s = students.find(st => st.id === id);
                if (!s) return null;
                const role = studentRole(s ?? undefined);
                return (
                  <div key={id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card/50">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0", initialsColor(s.name))}>
                      {initialsOf(s.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">{role}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Match schedule */}
          <section>
            <h3 className="text-sm font-semibold mb-3">Match Schedule</h3>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Opponent</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tournament.matches.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.number}</TableCell>
                      <TableCell>{fmtDate(m.date)} • {m.time}</TableCell>
                      <TableCell>{m.opponent}</TableCell>
                      <TableCell className="text-muted-foreground">{m.venue}</TableCell>
                      <TableCell>
                        {m.completed ? (
                          <Badge variant="outline" className={cn(
                            m.result === "won" ? "bg-primary/15 text-primary border-primary/30" :
                            m.result === "lost" ? "bg-destructive/15 text-destructive border-destructive/30" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {m.result === "won" ? `Won ${m.teamRuns}/${m.teamWickets} vs ${m.oppRuns}` :
                             m.result === "lost" ? `Lost ${m.teamRuns}/${m.teamWickets} vs ${m.oppRuns}` :
                             "Tied"}
                          </Badge>
                        ) : <Badge variant="outline">Upcoming</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => onLogStats(m.id)}>
                          {m.completed ? "Edit Stats" : "Log Match Stats"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          {/* Leaderboard */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Tournament Leaderboard</h3>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                <SelectTrigger className="w-44"><ArrowUpDown className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="runs">Sort by Runs</SelectItem>
                  <SelectItem value="wickets">Sort by Wickets</SelectItem>
                  <SelectItem value="battingAvg">Sort by Average</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">M</TableHead>
                    <TableHead className="text-right">Runs</TableHead>
                    <TableHead className="text-right">Avg</TableHead>
                    <TableHead className="text-right">SR</TableHead>
                    <TableHead className="text-right">Wkts</TableHead>
                    <TableHead className="text-right">PoTM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((row, i) => (
                    <TableRow key={row.studentId}>
                      <TableCell><RankBadge rank={i + 1} /></TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">{row.matches}</TableCell>
                      <TableCell className="text-right font-semibold">{row.runs}</TableCell>
                      <TableCell className="text-right">{row.battingAvg}</TableCell>
                      <TableCell className="text-right">{row.strikeRate}</TableCell>
                      <TableCell className="text-right">{row.wickets}</TableCell>
                      <TableCell className="text-right">{row.potm > 0 ? <Badge className="bg-primary/15 text-primary border-0">{row.potm}</Badge> : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank === 1) return <div className="h-7 w-7 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center"><Medal className="h-3.5 w-3.5" /></div>;
  if (rank === 2) return <div className="h-7 w-7 rounded-full bg-slate-300/20 text-slate-300 flex items-center justify-center"><Medal className="h-3.5 w-3.5" /></div>;
  if (rank === 3) return <div className="h-7 w-7 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center"><Medal className="h-3.5 w-3.5" /></div>;
  return <span className="text-sm text-muted-foreground pl-2">{rank}</span>;
};

// ---------------- Log Stats ----------------
const LogStatsDialog = ({ tournament, match, onClose, onSave }: {
  tournament: Tournament; match: Match; onClose: () => void;
  onSave: (patch: Partial<Match>) => void;
}) => {
  const initialStats: MatchStat[] = useMemo(() => {
    if (match.stats) return match.stats;
    return tournament.studentIds.map(id => ({
      studentId: id, runs: 0, ballsFaced: 0, wickets: 0, oversBowled: 0, catches: 0, runOuts: 0, potm: false,
    }));
  }, [match, tournament]);

  const [stats, setStats] = useState<MatchStat[]>(initialStats);
  const [teamRuns, setTeamRuns] = useState(match.teamRuns ?? 0);
  const [teamWickets, setTeamWickets] = useState(match.teamWickets ?? 0);
  const [oppRuns, setOppRuns] = useState(match.oppRuns ?? 0);
  const [result, setResult] = useState(match.result ?? "won");

  const updateStat = (idx: number, patch: Partial<MatchStat>) => {
    setStats(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Log Stats — Match {match.number} vs {match.opponent}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><Label>Team Runs</Label><Input type="number" value={teamRuns} onChange={e => setTeamRuns(+e.target.value)} /></div>
            <div><Label>Team Wickets</Label><Input type="number" value={teamWickets} onChange={e => setTeamWickets(+e.target.value)} /></div>
            <div><Label>Opponent Runs</Label><Input type="number" value={oppRuns} onChange={e => setOppRuns(+e.target.value)} /></div>
            <div>
              <Label>Result</Label>
              <Select value={result} onValueChange={(v) => setResult(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="tied">Tied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Player Stats</h4>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Student</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Balls</TableHead>
                    <TableHead>Wkts</TableHead>
                    <TableHead>Overs</TableHead>
                    <TableHead>Ct</TableHead>
                    <TableHead>RO</TableHead>
                    <TableHead>PoTM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.map((st, i) => {
                    const s = students.find(x => x.id === st.studentId);
                    return (
                      <TableRow key={st.studentId}>
                        <TableCell className="font-medium">{s?.name}</TableCell>
                        <TableCell><Input className="w-16 h-8" type="number" value={st.runs} onChange={e => updateStat(i, { runs: +e.target.value })} /></TableCell>
                        <TableCell><Input className="w-16 h-8" type="number" value={st.ballsFaced} onChange={e => updateStat(i, { ballsFaced: +e.target.value })} /></TableCell>
                        <TableCell><Input className="w-14 h-8" type="number" value={st.wickets} onChange={e => updateStat(i, { wickets: +e.target.value })} /></TableCell>
                        <TableCell><Input className="w-14 h-8" type="number" value={st.oversBowled} onChange={e => updateStat(i, { oversBowled: +e.target.value })} /></TableCell>
                        <TableCell><Input className="w-14 h-8" type="number" value={st.catches} onChange={e => updateStat(i, { catches: +e.target.value })} /></TableCell>
                        <TableCell><Input className="w-14 h-8" type="number" value={st.runOuts} onChange={e => updateStat(i, { runOuts: +e.target.value })} /></TableCell>
                        <TableCell><Checkbox checked={st.potm} onCheckedChange={(c) => updateStat(i, { potm: !!c })} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ stats, teamRuns, teamWickets, oppRuns, result })} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Save Match Stats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------- Share Dialog ----------------
const ShareDialog = ({ tournament, onOpenChange }: { tournament: Tournament | null; onOpenChange: (o: boolean) => void; }) => {
  const { students } = useAcademy();
  if (!tournament) return null;
  const lb = computeLeaderboard(tournament, students).sort((a, b) => b.runs - a.runs).slice(0, 3);
  const wins = tournament.matches.filter(m => m.result === "won").length;
  const completed = tournament.matches.filter(m => m.completed).length;

  return (
    <Dialog open={!!tournament} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display">Share Tournament Stats</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-gradient-to-br from-primary/20 via-card to-card border border-primary/30 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center"><Trophy className="h-6 w-6" /></div>
            <div>
              <h4 className="font-display font-bold">{tournament.name}</h4>
              <p className="text-xs text-muted-foreground">{fmtRange(tournament.startDate, tournament.endDate)}</p>
            </div>
          </div>
          <div className="aspect-video rounded-lg bg-muted/30 border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            Team Photo Placeholder
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-lg font-bold text-primary">{wins}</p>
              <p className="text-[10px] text-muted-foreground">Wins</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-lg font-bold">{completed}</p>
              <p className="text-[10px] text-muted-foreground">Played</p>
            </div>
            <div className="rounded-lg bg-background/50 p-2">
              <p className="text-lg font-bold">{tournament.studentIds.length}</p>
              <p className="text-[10px] text-muted-foreground">Players</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Top Performers</p>
            <div className="space-y-1.5">
              {lb.map((r, i) => (
                <div key={r.studentId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><RankBadge rank={i + 1} /><span>{r.name}</span></div>
                  <span className="font-semibold">{r.runs} runs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => { toast.success("Shared via WhatsApp"); onOpenChange(false); }} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Share2 className="h-4 w-4" /> Share via WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------- Helpers ----------------
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtRange = (a: string, b: string) => {
  const da = new Date(a), db = new Date(b);
  const sameMonth = da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear();
  if (sameMonth) return `${da.getDate()}–${db.getDate()} ${db.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
  return `${fmtDate(a)} – ${fmtDate(b)}, ${db.getFullYear()}`;
};

export default Tournaments;

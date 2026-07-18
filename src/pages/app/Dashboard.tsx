import { Link, useNavigate } from "react-router-dom";
import { Users, CreditCard, AlertTriangle, CalendarCheck, Bell, ArrowRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { StatCard } from "@/components/app/StatCard";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAcademy } from "@/context/AcademyContext";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--destructive))"];

const Dashboard = () => {
  const {
    totalStudents, monthlyRevenue, overdueAmount, overdueCount,
    paidCount, overdue1Count, overdue8Count, monthlyRevenueSeries,
    todaysSessions, getBatch, getCoach, recentActivity, inr, batches, academyName,
    todayAttendance, students,
  } = useAcademy();
  const todayExpected = todaysSessions.reduce((a, s) => a + (getBatch(s.batchId)?.studentCount ?? 0), 0);
  const present = todayAttendance.present;
  const marked = todayAttendance.marked;
  const atRisk = students.filter((s) => s.attendancePct > 0 && s.attendancePct < 70).length;
  const fullBatches = batches.filter((b) => b.studentCount >= b.capacity && b.capacity > 0);

  const pieData = [
    { name: "Paid", value: paidCount },
    { name: "Overdue 1-7d", value: overdue1Count },
    { name: "Overdue 8+d", value: overdue8Count },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back"
        description={`Here's what's happening at ${academyName} High Performance today.`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Students" value={String(totalStudents)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Collected this month" value={inr(monthlyRevenue)} icon={<CreditCard className="h-4 w-4" />} tone="success" />
        <StatCard label="Overdue Fees" value={inr(overdueAmount)} icon={<AlertTriangle className="h-4 w-4" />} hint={`${overdueCount} students`} tone="danger" />
        <StatCard
          label="Today's Attendance"
          value={marked ? `${present}/${marked}` : `0/${todayExpected}`}
          icon={<CalendarCheck className="h-4 w-4" />}
          hint={marked ? `${Math.round((present / marked) * 100)}% of marked` : "Not marked yet"}
          tone={marked ? "success" : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-5">
          <div className="mb-4">
            <h3 className="font-display font-semibold">Monthly Revenue</h3>
            <p className="text-xs text-muted-foreground">From recorded payments (last 6 months)</p>
          </div>
          <div className="h-64">
            {monthlyRevenueSeries.every((m) => m.revenue === 0) ? (
              <p className="h-full flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                No payments recorded yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenueSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => inr(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-2">Fee Status</h3>
          <p className="text-xs text-muted-foreground mb-3">Current roster</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData.length ? pieData : [{ name: "No data", value: 1 }]} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {(pieData.length ? pieData : [{ name: "No data", value: 1 }]).map((_, i) => (
                    <Cell key={i} fill={pieData.length ? PIE_COLORS[i % PIE_COLORS.length] : "hsl(var(--muted))"} />
                  ))}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <AlertCard
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          title={overdue8Count ? `${overdue8Count} students overdue 8+ days` : "No critical overdue fees"}
          desc={overdue8Count ? `${inr(students.filter((s) => s.feeStatus === "overdue8").reduce((a, s) => a + s.feeAmount, 0))} pending.` : "All clear on 8+ day overdue."}
          cta="Open Fees"
          to="/app/fees"
        />
        <AlertCard
          tone="warning"
          icon={<Bell className="h-4 w-4" />}
          title={atRisk ? `${atRisk} students below 70% attendance` : "No attendance risk alerts"}
          desc={atRisk ? "Based on recorded sessions." : "Mark attendance to unlock risk alerts."}
          cta="Attendance"
          to="/app/attendance"
        />
        <AlertCard
          tone="info"
          icon={<Users className="h-4 w-4" />}
          title={fullBatches.length ? `${fullBatches.length} batch(es) at capacity` : "Batch capacity OK"}
          desc={fullBatches.length ? fullBatches.map((b) => b.name).join(", ") : `${batches.length} active batch(es).`}
          cta="Batches"
          to="/app/batches"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">Today's Sessions</h3>
              <p className="text-xs text-muted-foreground">{batches.length} batches • {totalStudents} students</p>
            </div>
            <Link to="/app/attendance">
              <Button size="sm" variant="ghost" className="text-primary">Mark attendance <ArrowRight className="ml-1 h-3 w-3" /></Button>
            </Link>
          </div>
          <div className="divide-y divide-border">
            {todaysSessions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">No batches configured.</p>
            ) : (
              todaysSessions.map((s) => {
                const b = getBatch(s.batchId);
                const c = b ? getCoach(b.coachId) : undefined;
                if (!b) return null;
                return (
                  <div key={b.id} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                    <div className="h-11 min-w-[2.75rem] rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-semibold px-1 text-center leading-tight">
                      {s.time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.venue}{c ? ` • ${c.name}` : ""}</p>
                    </div>
                    <Badge variant="outline">{b.studentCount} students</Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-display font-semibold">Recent activity</h3>
            <p className="text-xs text-muted-foreground">From payments & attendance</p>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex gap-3">
                <div className={cn(
                  "mt-0.5 h-2 w-2 rounded-full shrink-0",
                  a.tone === "success" && "bg-primary",
                  a.tone === "warning" && "bg-amber-400",
                  a.tone === "info" && "bg-blue-400",
                  a.tone === "default" && "bg-muted-foreground"
                )} />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{a.text}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const AlertCard = ({
  tone, icon, title, desc, cta, to,
}: {
  tone: "danger" | "warning" | "info";
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  to?: string;
}) => {
  const navigate = useNavigate();
  const tones = {
    danger: "border-destructive/30 bg-destructive/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    info: "border-blue-500/30 bg-blue-500/5",
  };

  return (
    <div className={cn("rounded-2xl border p-5 h-full", tones[tone])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
          {cta && to && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-8 text-xs"
              onClick={() => navigate(to)}
            >
              {cta} <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

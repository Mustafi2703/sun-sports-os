import { Users, CreditCard, AlertTriangle, CalendarCheck, Bell, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { StatCard } from "@/components/app/StatCard";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  totalStudents, monthlyRevenue, overdueAmount, overdueCount,
  paidCount, overdue1Count, overdue8Count, monthlyRevenueSeries,
  todaysSessions, getBatch, getCoach, recentActivity, inr, batches
} from "@/data/academy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--warning))", "hsl(var(--destructive))"];

const Dashboard = () => {
  const todayExpected = todaysSessions.reduce((a, s) => a + (getBatch(s.batchId)?.studentCount ?? 0), 0);
  const present = Math.round(todayExpected * 0.93);

  const pieData = [
    { name: "Paid", value: paidCount },
    { name: "Overdue 1-7d", value: overdue1Count },
    { name: "Overdue 8+d", value: overdue8Count },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome back 👋"
        description="Here's what's happening at Champions Cricket Academy today."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Students" value={String(totalStudents)} icon={<Users className="h-4 w-4" />} trend={{ value: "+4 vs last month", up: true }} />
        <StatCard label="Monthly Revenue" value={inr(monthlyRevenue)} icon={<CreditCard className="h-4 w-4" />} trend={{ value: "+8.4%", up: true }} tone="success" />
        <StatCard label="Overdue Fees" value={inr(overdueAmount)} icon={<AlertTriangle className="h-4 w-4" />} hint={`${overdueCount} students`} tone="danger" />
        <StatCard label="Today's Attendance" value={`${present}/${todayExpected}`} icon={<CalendarCheck className="h-4 w-4" />} hint="93% present" tone="success" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold">Monthly Revenue</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <Badge className="bg-primary/15 text-primary border-0">YTD ↑ 14.6%</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenueSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => inr(v)} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display font-semibold mb-2">Fee Status</h3>
          <p className="text-xs text-muted-foreground mb-3">Current month</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <AlertCard
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          title={`${overdue8Count} students overdue 8+ days`}
          desc={`${inr(students8AmountFromCount(overdue8Count))} pending. Send reminders?`}
          cta="Send WhatsApp Reminders"
          onClick={() => toast.success("WhatsApp reminders sent to 9 parents")}
        />
        <AlertCard
          tone="warning"
          icon={<Bell className="h-4 w-4" />}
          title="3 students absent for 5+ sessions"
          desc="Churn risk detected. Review and reach out before they drop out."
          cta="View Students"
        />
        <AlertCard
          tone="info"
          icon={<Users className="h-4 w-4" />}
          title="U-14 Batch B at full capacity"
          desc="20/20 students enrolled. 3 students on waitlist."
          cta="Manage Waitlist"
        />
      </div>

      {/* Today's sessions + Activity */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">Today's Sessions</h3>
              <p className="text-xs text-muted-foreground">{batches.length} batches • {totalStudents} students</p>
            </div>
            <Button size="sm" variant="ghost" className="text-primary">View all <ArrowRight className="ml-1 h-3 w-3" /></Button>
          </div>
          <div className="divide-y divide-border">
            {todaysSessions.map((s, i) => {
              const b = getBatch(s.batchId)!;
              const c = getCoach(b.coachId)!;
              return (
                <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors">
                  <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex flex-col items-center justify-center text-xs font-semibold">
                    <span>{s.time.split(":")[0]}</span>
                    <span className="text-[9px]">PM</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{b.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.venue} • Coach {c.name}</p>
                  </div>
                  <Badge variant="outline" className="border-border">{b.studentCount} students</Badge>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-display font-semibold">Recent Activity</h3>
          </div>
          <div className="divide-y divide-border max-h-80 overflow-y-auto scrollbar-thin">
            {recentActivity.map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                  a.tone === "success" && "bg-primary/15 text-primary",
                  a.tone === "warning" && "bg-amber-500/15 text-amber-400",
                  a.tone === "info" && "bg-secondary/15 text-secondary",
                  a.tone === "default" && "bg-muted text-muted-foreground",
                )}>
                  {a.tone === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{a.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function students8AmountFromCount(count: number) { return count * 4500; }

const AlertCard = ({ tone, icon, title, desc, cta, onClick }: {
  tone: "danger" | "warning" | "info"; icon: React.ReactNode; title: string; desc: string; cta: string; onClick?: () => void;
}) => {
  const styles = {
    danger: "border-destructive/30 bg-destructive/10",
    warning: "border-amber-500/30 bg-amber-500/10",
    info: "border-secondary/30 bg-secondary/10",
  }[tone];
  const dot = {
    danger: "bg-destructive/20 text-destructive",
    warning: "bg-amber-500/20 text-amber-400",
    info: "bg-secondary/20 text-secondary",
  }[tone];
  const btn = {
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    warning: "bg-amber-500 text-background hover:bg-amber-500/90",
    info: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-5", styles)}>
      <div className="flex items-start gap-3">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", dot)}>{icon}</div>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
      <Button size="sm" onClick={onClick} className={cn("mt-4 w-full", btn)}>{cta}</Button>
    </div>
  );
};

export default Dashboard;
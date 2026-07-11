import { useState } from "react";
import { BarChart3, FileText, Download, Share2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { useAcademy } from "@/context/AcademyContext";

const REPORTS = [
  { id: "rev", title: "Monthly Revenue Report", desc: "Detailed revenue breakdown with month-on-month comparison." },
  { id: "att", title: "Attendance Summary Report", desc: "Per-batch and per-student attendance trends." },
  { id: "fee", title: "Fee Collection Report", desc: "Paid, overdue, and projected collections." },
  { id: "perf", title: "Student Performance Report", desc: "Skill scores and progression across all athletes." },
];

const Reports = () => {
  const { monthlyRevenueSeries, inr } = useAcademy();
  const [open, setOpen] = useState<string | null>(null);
  const r = REPORTS.find(x => x.id === open);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="One-click reports for your records, board, or accountant." />

      <div className="grid sm:grid-cols-2 gap-4">
        {REPORTS.map(r => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
              {r.id === "rev" || r.id === "fee" ? <BarChart3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <h3 className="font-display font-semibold">{r.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setOpen(r.id)}>Generate</Button>
          </div>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{r?.title}</DialogTitle></DialogHeader>
          <div className="rounded-xl bg-muted/20 border border-border p-5">
            <div className="grid grid-cols-3 gap-3 mb-5">
              <Stat label="Period" value="Jan – Jun 2026" />
              <Stat label="Total" value={inr(monthlyRevenueSeries.reduce((a, x) => a + x.revenue, 0))} />
              <Stat label="Avg / month" value={inr(Math.round(monthlyRevenueSeries.reduce((a, x) => a + x.revenue, 0) / 6))} />
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} formatter={(v: number) => inr(v)} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline"><Download className="h-4 w-4 mr-1.5" /> Download PDF</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90"><Share2 className="h-4 w-4 mr-1.5" /> Share via WhatsApp</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-display text-lg font-bold mt-0.5">{value}</p>
  </div>
);

export default Reports;
import { Calendar, CheckCircle2, CreditCard, TrendingUp, Users } from "lucide-react";

export const HeroMockup = () => {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Laptop card */}
      <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden animate-scale-in">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 text-xs text-muted-foreground">app.sportsos.in / dashboard</span>
        </div>
        <div className="p-5 grid grid-cols-3 gap-3">
          <Stat icon={<Users className="h-4 w-4"/>} label="Students" value="85" tone="text-primary" />
          <Stat icon={<CreditCard className="h-4 w-4"/>} label="Revenue" value="₹3.24L" tone="text-secondary" />
          <Stat icon={<TrendingUp className="h-4 w-4"/>} label="Attendance" value="93%" tone="text-primary" />

          <div className="col-span-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground mb-2">Monthly revenue</p>
            <div className="flex items-end gap-1.5 h-24">
              {[40,55,48,62,70,82,76,90].map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Today</p>
            {["U-12 4PM","Bowling 4PM","U-14 5PM"].map(t => (
              <div key={t} className="flex items-center gap-1.5 text-[10px] text-foreground"><CheckCircle2 className="h-3 w-3 text-primary" /> {t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Phone */}
      <div className="absolute -bottom-8 -right-2 sm:-right-8 w-32 sm:w-40 rounded-[1.6rem] border-4 border-card bg-card shadow-glow overflow-hidden animate-scale-in" style={{ animationDelay: '0.15s', animationFillMode: 'backwards' }}>
        <div className="bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-foreground">Attendance</span>
            <Calendar className="h-3 w-3 text-primary" />
          </div>
          {["Arjun P.", "Rohan S.", "Aditya M.", "Karan D.", "Veer J."].map((n, i) => (
            <div key={n} className="flex items-center justify-between rounded-md bg-muted/30 px-2 py-1.5">
              <span className="text-[10px] text-foreground">{n}</span>
              <span className={`h-2 w-2 rounded-full ${i === 1 ? 'bg-rose-500' : 'bg-primary'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) => (
  <div className="rounded-lg border border-border bg-muted/20 p-3">
    <div className={`flex items-center gap-1.5 text-xs text-muted-foreground`}>{icon}<span>{label}</span></div>
    <p className={`mt-1 text-xl font-display font-bold ${tone}`}>{value}</p>
  </div>
);
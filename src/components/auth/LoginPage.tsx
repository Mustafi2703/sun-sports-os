import { FormEvent, useEffect, useState, type ComponentType } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Award,
  BarChart3,
  CalendarCheck,
  CreditCard,
  Home,
  Layers,
  MessageCircle,
  Settings,
  StickyNote,
  TrendingUp,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, type Portal } from "@/lib/api";
import { cn } from "@/lib/utils";

type Module = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
};

type PortalTheme = {
  title: string;
  eyebrow: string;
  subtitle: string;
  home: string;
  hint: string;
  cta: string;
  accent: string;
  accentSoft: string;
  modules: Module[];
};

const THEMES: Record<Portal, PortalTheme> = {
  parent: {
    title: "Parent Portal",
    eyebrow: "For parents & guardians",
    subtitle: "Stay on top of fees, attendance, coach feedback, and your child’s progress — from your phone.",
    home: "/parent",
    hint: "Only the WhatsApp number already on your child’s Sun Sports profile can sign in.",
    cta: "Enter parent portal",
    accent: "from-emerald-500/25 via-sky-500/10 to-transparent",
    accentSoft: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    modules: [
      { icon: CreditCard, title: "Fee Management", desc: "Dues, reminders, and payment history" },
      { icon: CalendarCheck, title: "Attendance", desc: "Present, late, and absent calendar" },
      { icon: TrendingUp, title: "Performance", desc: "Batting, bowling, fielding & fitness" },
      { icon: StickyNote, title: "Coach notes", desc: "Feedback as soon as coaches post it" },
      { icon: User, title: "Profile", desc: "Batch, coach, and student details" },
    ],
  },
  coach: {
    title: "Coach Portal",
    eyebrow: "For coaches",
    subtitle: "Run your batches — mark attendance, check fee status, score players, and leave notes.",
    home: "/coach",
    hint: "Only coach mobiles added by the academy in Settings can sign in.",
    cta: "Enter coach portal",
    accent: "from-primary/30 via-emerald-600/10 to-transparent",
    accentSoft: "bg-primary/15 text-primary border-primary/25",
    modules: [
      { icon: Home, title: "Dashboard", desc: "Today’s batch overview at a glance" },
      { icon: Users, title: "Players", desc: "Students assigned to your batches" },
      { icon: CalendarCheck, title: "Attendance", desc: "Mark present, late, or absent" },
      { icon: CreditCard, title: "Fee Status", desc: "See who is paid or overdue" },
      { icon: Award, title: "Assessments", desc: "Scores and performance notes" },
    ],
  },
  admin: {
    title: "Internal Team",
    eyebrow: "Academy staff · SportsOS",
    subtitle: "Full academy console — students, batches, fees, attendance, tournaments, and reports.",
    home: "/app",
    hint: "Team login for Sun Sports academy staff.",
    cta: "Enter team console",
    accent: "from-blue-500/25 via-primary/10 to-transparent",
    accentSoft: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    modules: [
      { icon: Home, title: "Dashboard", desc: "Ops snapshot and alerts" },
      { icon: Users, title: "Students", desc: "Roster and profiles" },
      { icon: Layers, title: "Batches", desc: "Groups and coach assignments" },
      { icon: CreditCard, title: "Fees", desc: "Collections and overdue tracking" },
      { icon: CalendarCheck, title: "Attendance", desc: "Academy-wide session logs" },
      { icon: TrendingUp, title: "Performance", desc: "Scorecards across batches" },
      { icon: MessageCircle, title: "Communications", desc: "Parent outreach" },
      { icon: Trophy, title: "Tournaments", desc: "Events and registrations" },
      { icon: BarChart3, title: "Reports", desc: "Exports and summaries" },
      { icon: Settings, title: "Settings", desc: "Academy configuration" },
    ],
  },
};

const OTHER_PORTALS: { portal: Portal; label: string; path: string }[] = [
  { portal: "parent", label: "Parent", path: "/parent/login" },
  { portal: "coach", label: "Coach", path: "/coach/login" },
  { portal: "admin", label: "Team", path: "/app/login" },
];

function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function LoginPage({ portal }: { portal: Portal }) {
  const { login, loginWithOtp, user, loading } = useAuth();
  const navigate = useNavigate();
  const theme = THEMES[portal];
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"otp" | "pin">("otp");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [pinAllowed, setPinAllowed] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demos, setDemos] = useState<{ phone: string; name: string }[]>([]);
  const [demoPin, setDemoPin] = useState("1234");

  useEffect(() => {
    void api
      .authMethods()
      .then((m) => {
        setSmsConfigured(m.smsConfigured);
        setPinAllowed(m.pin);
        if (!m.otp && m.pin) setMode("pin");
      })
      .catch(() => undefined);

    void api
      .demoAccounts()
      .then((d) => {
        setDemoPin(d.pin || "1234");
        if (portal === "admin") setDemos(d.admin ? [d.admin] : []);
        else if (portal === "coach") setDemos(d.coaches || []);
        else setDemos((d.parents || []).slice(0, 8));
      })
      .catch(() => undefined);
  }, [portal]);

  if (!loading && user?.role === portal) {
    return <Navigate to={theme.home} replace />;
  }

  const sendOtp = async () => {
    setError("");
    setInfo("");
    setDevOtp(null);
    const normalized = normalizePhoneInput(phone);
    if (normalized.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.requestOtp({ phone: normalized, portal });
      setOtpSent(true);
      setInfo(res.message || "OTP sent");
      if (res.devOtp) {
        setDevOtp(res.devOtp);
        setOtp(res.devOtp);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const normalized = normalizePhoneInput(phone);
    if (normalized.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "otp") {
        if (!otpSent) {
          await sendOtp();
          return;
        }
        if (!otp.trim()) {
          setError("Enter the OTP from SMS");
          setSubmitting(false);
          return;
        }
        await loginWithOtp(portal, normalized, otp.trim());
      } else {
        if (!pin.trim()) {
          setError("PIN required");
          setSubmitting(false);
          return;
        }
        await login(portal, normalized, pin.trim());
      }
      navigate(theme.home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell min-h-screen min-h-[100dvh] overflow-x-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", theme.accent)} aria-hidden />
      <div className="absolute inset-0 gradient-hero opacity-70 pointer-events-none" aria-hidden />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col lg:flex-row lg:items-stretch">
        <section className="flex flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
          <Link to="/" className="mb-8 w-fit">
            <Logo />
          </Link>
          <p
            className={cn(
              "inline-flex w-fit text-[11px] uppercase tracking-wider rounded-full border px-3 py-1 mb-4",
              theme.accentSoft
            )}
          >
            {theme.eyebrow}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            {theme.title}
          </h1>
          <p className="mt-3 max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">
            {theme.subtitle}
          </p>

          <div
            className={cn(
              "mt-8 grid gap-3",
              portal === "admin" ? "sm:grid-cols-2" : "sm:grid-cols-1 max-w-md"
            )}
          >
            {theme.modules.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="surface-soft rounded-xl px-3.5 py-3 flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 shrink-0 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-4 pb-10 pt-2 sm:px-8 lg:px-10 lg:py-16 safe-pb">
          <div className="w-full max-w-md surface-elevated rounded-2xl sm:rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold">Sign in</h2>
              <p className="text-sm text-muted-foreground">{theme.hint}</p>
            </div>

            {pinAllowed && (
              <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/60">
                <button
                  type="button"
                  className={cn(
                    "flex-1 text-xs py-2 rounded-lg transition-colors",
                    mode === "otp" ? "bg-primary/20 text-foreground font-medium" : "text-muted-foreground"
                  )}
                  onClick={() => {
                    setMode("otp");
                    setError("");
                  }}
                >
                  Phone OTP
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 text-xs py-2 rounded-lg transition-colors",
                    mode === "pin" ? "bg-primary/20 text-foreground font-medium" : "text-muted-foreground"
                  )}
                  onClick={() => {
                    setMode("pin");
                    setError("");
                  }}
                >
                  PIN
                </button>
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Phone</label>
                <Input
                  className="h-11 bg-background/50 border-border/80"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setOtpSent(false);
                    setDevOtp(null);
                  }}
                  required
                />
              </div>

              {mode === "otp" ? (
                <>
                  {otpSent && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">OTP</label>
                      <Input
                        className="h-11 bg-background/50 border-border/80 tracking-[0.3em] text-center text-lg"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        maxLength={8}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        required
                      />
                    </div>
                  )}
                  {devOtp && (
                    <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
                      SMS not configured yet — use code <span className="font-mono font-semibold">{devOtp}</span>
                    </p>
                  )}
                  {info && !devOtp && <p className="text-xs text-muted-foreground">{info}</p>}
                  {!smsConfigured && !devOtp && (
                    <p className="text-[11px] text-muted-foreground">
                      Live SMS uses MSG91 or Twilio on the API. Until then, OTP appears on-screen after Send.
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">PIN</label>
                  <Input
                    className="h-11 bg-background/50 border-border/80"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    placeholder="4-digit PIN"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                {mode === "otp" && !otpSent ? (
                  <Button
                    type="button"
                    className="w-full h-11 bg-primary text-primary-foreground shadow-glow"
                    disabled={submitting}
                    onClick={() => void sendOtp()}
                  >
                    {submitting ? "Sending…" : "Send OTP"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-11 bg-primary text-primary-foreground shadow-glow"
                    disabled={submitting}
                  >
                    {submitting ? "Signing in…" : theme.cta}
                  </Button>
                )}
                {mode === "otp" && otpSent && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-9 text-xs"
                    disabled={submitting}
                    onClick={() => void sendOtp()}
                  >
                    Resend OTP
                  </Button>
                )}
              </div>
            </form>

            {mode === "pin" && (
              <p className="text-xs text-muted-foreground text-center">
                Backup PIN: <span className="text-foreground font-medium">{demoPin}</span>
              </p>
            )}

            {demos.length > 0 && (
              <div className="surface-soft rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-medium text-muted-foreground">Quick fill (demo)</p>
                <div className="flex flex-wrap gap-1.5">
                  {demos.map((d) => (
                    <button
                      key={d.phone}
                      type="button"
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border/80 bg-background/40 hover:bg-primary/10 hover:border-primary/30 text-left transition-colors"
                      onClick={() => {
                        setPhone(d.phone);
                        setPin(demoPin);
                        setOtpSent(false);
                        setDevOtp(null);
                        setError("");
                      }}
                    >
                      {d.name.split(" ")[0]} · {d.phone}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground text-center mb-2">Other portals</p>
              <div className="flex justify-center gap-2">
                {OTHER_PORTALS.filter((p) => p.portal !== portal).map((p) => (
                  <Link
                    key={p.path}
                    to={p.path}
                    className="text-xs px-3 py-1.5 rounded-lg border border-border/70 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

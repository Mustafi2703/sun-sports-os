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
    hint: "Sign in with the WhatsApp number already on your child’s Sun Sports profile.",
    cta: "Enter parent portal",
    accent: "from-emerald-500/25 via-sky-500/10 to-transparent",
    accentSoft: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    modules: [
      { icon: CreditCard, title: "Fee Management", desc: "Dues, reminders, and payment history" },
      { icon: CalendarCheck, title: "Attendance", desc: "Present, late, leave & holidays" },
      { icon: TrendingUp, title: "Performance", desc: "Batting, bowling, fielding & fitness" },
      { icon: StickyNote, title: "Coach notes", desc: "Feedback as soon as coaches post it" },
      { icon: User, title: "Profile", desc: "Batch, coach, and student details" },
    ],
  },
  coach: {
    title: "Coach Portal",
    eyebrow: "For coaches",
    subtitle: "Run your batches — mark attendance, score players, and leave notes.",
    home: "/coach",
    hint: "Sign in with the mobile number registered for your coach profile.",
    cta: "Enter coach portal",
    accent: "from-primary/30 via-emerald-600/10 to-transparent",
    accentSoft: "bg-primary/15 text-primary border-primary/25",
    modules: [
      { icon: Home, title: "Dashboard", desc: "Today’s batch overview at a glance" },
      { icon: Users, title: "Players", desc: "Students assigned to your batches" },
      { icon: CalendarCheck, title: "Attendance", desc: "Mark and edit session logs" },
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
      { icon: CreditCard, title: "Fees", desc: "Packages, dues, and collections" },
      { icon: CalendarCheck, title: "Attendance", desc: "Sessions and holidays" },
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
  /** PIN (mobile + password) is primary; OTP ready when SMS is connected */
  const [mode, setMode] = useState<"otp" | "pin">("pin");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [smsConfigured, setSmsConfigured] = useState(false);
  const [pinAllowed, setPinAllowed] = useState(true);
  const [otpAllowed, setOtpAllowed] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void api
      .authMethods()
      .then((m) => {
        setSmsConfigured(m.smsConfigured);
        setPinAllowed(m.pin);
        setOtpAllowed(m.otp);
        // Prefer PIN until live SMS is connected
        if (m.pin) setMode("pin");
        else if (m.otp) setMode("otp");
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
          setError("Enter your PIN");
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

  const showModeToggle = pinAllowed && otpAllowed;

  return (
    <div className="app-shell min-h-screen min-h-[100dvh] overflow-x-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", theme.accent)} aria-hidden />
      <div className="absolute inset-0 gradient-hero opacity-70 pointer-events-none" aria-hidden />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col lg:flex-row lg:items-stretch">
        {/* Brand column — compact on mobile so sign-in is visible first */}
        <section className="order-2 lg:order-1 flex flex-1 flex-col justify-center px-4 py-6 sm:px-8 lg:px-12 lg:py-16">
          <Link to="/" className="mb-4 lg:mb-8 w-fit hidden lg:block">
            <Logo />
          </Link>
          <p
            className={cn(
              "hidden lg:inline-flex w-fit text-[11px] uppercase tracking-wider rounded-full border px-3 py-1 mb-4",
              theme.accentSoft
            )}
          >
            {theme.eyebrow}
          </p>
          <h1 className="hidden lg:block font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
            {theme.title}
          </h1>
          <p className="hidden lg:block mt-3 max-w-md text-sm sm:text-base text-muted-foreground leading-relaxed">
            {theme.subtitle}
          </p>

          <div
            className={cn(
              "mt-4 lg:mt-8 grid gap-2.5 sm:gap-3",
              "hidden sm:grid",
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

        <section className="order-1 lg:order-2 flex flex-1 items-start sm:items-center justify-center px-4 pt-6 pb-4 sm:px-8 lg:px-10 lg:py-16 safe-pb">
          <div className="w-full max-w-md surface-elevated rounded-2xl sm:rounded-3xl p-5 sm:p-8 space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between gap-3 lg:block">
              <Link to="/" className="lg:hidden shrink-0">
                <Logo />
              </Link>
              <div className="space-y-1 min-w-0 text-right lg:text-left">
                <h2 className="font-display text-lg sm:text-xl font-bold">{theme.title}</h2>
                <p className="text-xs sm:text-sm text-muted-foreground text-pretty">{theme.hint}</p>
              </div>
            </div>

            {showModeToggle && (
              <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/60">
                <button
                  type="button"
                  className={cn(
                    "flex-1 text-xs py-2.5 rounded-lg transition-colors min-h-[44px]",
                    mode === "pin" ? "bg-primary/20 text-foreground font-medium" : "text-muted-foreground"
                  )}
                  onClick={() => {
                    setMode("pin");
                    setError("");
                  }}
                >
                  Mobile + PIN
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 text-xs py-2.5 rounded-lg transition-colors min-h-[44px]",
                    mode === "otp" ? "bg-primary/20 text-foreground font-medium" : "text-muted-foreground"
                  )}
                  onClick={() => {
                    setMode("otp");
                    setError("");
                  }}
                >
                  Phone OTP
                </button>
              </div>
            )}

            <form onSubmit={(e) => void onSubmit(e)} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Mobile number</label>
                <Input
                  className="h-12 text-base bg-background/50 border-border/80"
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
                        className="h-12 text-base bg-background/50 border-border/80 tracking-[0.3em] text-center"
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
                      SMS not live yet — use code <span className="font-mono font-semibold">{devOtp}</span>
                    </p>
                  )}
                  {info && !devOtp && <p className="text-xs text-muted-foreground">{info}</p>}
                  {!smsConfigured && !devOtp && (
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      OTP SMS will be connected later. Prefer <span className="text-foreground">Mobile + PIN</span> for now.
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">PIN</label>
                  <Input
                    className="h-12 text-base bg-background/50 border-border/80"
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

              <div className="flex flex-col gap-2 pt-1">
                {mode === "otp" && !otpSent ? (
                  <Button
                    type="button"
                    className="w-full h-12 text-base bg-primary text-primary-foreground shadow-glow"
                    disabled={submitting}
                    onClick={() => void sendOtp()}
                  >
                    {submitting ? "Sending…" : "Send OTP"}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full h-12 text-base bg-primary text-primary-foreground shadow-glow"
                    disabled={submitting}
                  >
                    {submitting ? "Signing in…" : theme.cta}
                  </Button>
                )}
                {mode === "otp" && otpSent && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full h-10 text-xs"
                    disabled={submitting}
                    onClick={() => void sendOtp()}
                  >
                    Resend OTP
                  </Button>
                )}
              </div>
            </form>

            <div className="pt-1 border-t border-border/60">
              <p className="text-[11px] text-muted-foreground text-center mb-2">Other portals</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {OTHER_PORTALS.filter((p) => p.portal !== portal).map((p) => (
                  <Link
                    key={p.path}
                    to={p.path}
                    className="text-xs px-3 py-2 min-h-[40px] inline-flex items-center rounded-lg border border-border/70 hover:border-primary/40 hover:bg-primary/5 transition-colors"
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

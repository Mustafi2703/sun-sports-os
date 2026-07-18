import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { api, type Portal } from "@/lib/api";
import { cn } from "@/lib/utils";

const COPY: Record<
  Portal,
  { title: string; subtitle: string; home: string; hint: string; accent: string }
> = {
  parent: {
    title: "Parent Portal",
    subtitle: "View your child’s fees, attendance, and progress.",
    home: "/parent",
    hint: "Use the 10-digit WhatsApp number registered with the academy.",
    accent: "from-emerald-600/20 to-background",
  },
  coach: {
    title: "Coach Portal",
    subtitle: "Full academy view — batches, students, and attendance.",
    home: "/coach",
    hint: "Use your coach mobile number.",
    accent: "from-sky-600/20 to-background",
  },
  admin: {
    title: "Internal Team",
    subtitle: "Sun Sports SportsOS academy console.",
    home: "/app",
    hint: "Team login for academy staff.",
    accent: "from-amber-600/20 to-background",
  },
};

function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function LoginPage({ portal }: { portal: Portal }) {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const copy = COPY[portal];
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("1234");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demos, setDemos] = useState<{ phone: string; name: string }[]>([]);
  const [demoPin, setDemoPin] = useState("1234");

  useEffect(() => {
    void api
      .demoAccounts()
      .then((d) => {
        setDemoPin(d.pin || "1234");
        setPin(d.pin || "1234");
        if (portal === "admin") setDemos(d.admin ? [d.admin] : []);
        else if (portal === "coach") setDemos(d.coaches || []);
        else setDemos((d.parents || []).slice(0, 8));
      })
      .catch(() => {
        /* offline hints below */
      });
  }, [portal]);

  if (!loading && user?.role === portal) {
    return <Navigate to={copy.home} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const normalized = normalizePhoneInput(phone);
    if (normalized.length < 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    if (!pin.trim()) {
      setError("PIN required");
      return;
    }
    setSubmitting(true);
    try {
      await login(portal, normalized, pin.trim());
      navigate(copy.home, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn("min-h-screen min-h-[100dvh] flex items-center justify-center p-3 sm:p-4 bg-background bg-gradient-to-b safe-pb safe-pt", copy.accent)}>
      <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-border bg-card p-5 sm:p-8 shadow-card space-y-5 sm:space-y-6">
        <div className="space-y-2 sm:space-y-3 text-center">
          <div className="flex justify-center"><Logo /></div>
          <h1 className="font-display text-xl sm:text-2xl font-bold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Phone</label>
            <Input
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">PIN</label>
            <Input
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center">{copy.hint} Demo PIN: {demoPin}</p>

        {demos.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">Quick fill (demo)</p>
            <div className="flex flex-wrap gap-1.5">
              {demos.map((d) => (
                <button
                  key={d.phone}
                  type="button"
                  className="text-[11px] px-2 py-1 rounded-md border border-border hover:bg-muted/50 text-left"
                  onClick={() => {
                    setPhone(d.phone);
                    setPin(demoPin);
                    setError("");
                  }}
                >
                  {d.name.split(" ")[0]} · {d.phone}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          <Link to="/" className="underline hover:text-foreground">Back to home</Link>
          {" · "}
          <Link to="/parent/login" className="underline hover:text-foreground">Parent</Link>
          {" · "}
          <Link to="/coach/login" className="underline hover:text-foreground">Coach</Link>
          {" · "}
          <Link to="/app/login" className="underline hover:text-foreground">Team</Link>
        </p>
      </div>
    </div>
  );
}

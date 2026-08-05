import { Link } from "react-router-dom";
import { ClipboardList, Shield, Users } from "lucide-react";
import { Logo } from "@/components/Logo";

const PORTALS = [
  {
    to: "/parent/login",
    icon: Users,
    title: "Parent",
    desc: "Fees, attendance, coach notes, and progress",
  },
  {
    to: "/coach/login",
    icon: ClipboardList,
    title: "Coach",
    desc: "Batches, attendance, assessments, and notes",
  },
  {
    to: "/app/login",
    icon: Shield,
    title: "Team",
    desc: "Full academy console — students, fees, tournaments",
  },
] as const;

/** Minimal chooser — no marketing landing. */
const PortalGate = () => {
  return (
    <div className="app-shell min-h-screen min-h-[100dvh] flex items-center justify-center p-5 sm:p-8">
      <div className="absolute inset-0 gradient-hero opacity-80 pointer-events-none" aria-hidden />
      <div className="relative w-full max-w-lg space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <Logo />
          </div>
          <p className="text-sm text-muted-foreground">Choose your portal to sign in</p>
        </div>

        <div className="space-y-3">
          {PORTALS.map(({ to, icon: Icon, title, desc }) => (
            <Link
              key={to}
              to={to}
              className="surface-elevated flex items-start gap-4 rounded-2xl p-4 sm:p-5 hover:border-primary/40 transition-colors group"
            >
              <div className="h-11 w-11 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="font-display font-semibold text-base">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PortalGate;

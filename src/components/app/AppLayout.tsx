import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Users, Layers, CreditCard, CalendarCheck, TrendingUp,
  MessageCircle, BarChart3, Settings, Bell, Menu, X, MoreHorizontal, HelpCircle, Trophy, LogOut
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAcademy } from "@/context/AcademyContext";
import { useAuth } from "@/context/AuthContext";
import { initialsOf } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Dashboard", icon: Home, end: true },
  { to: "/app/students", label: "Students", icon: Users },
  { to: "/app/batches", label: "Batches", icon: Layers },
  { to: "/app/fees", label: "Fee Management", icon: CreditCard },
  { to: "/app/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/app/performance", label: "Performance", icon: TrendingUp },
  { to: "/app/communications", label: "Communications", icon: MessageCircle },
  { to: "/app/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/students", label: "Students", icon: Users },
  { to: "/app/fees", label: "Fees", icon: CreditCard },
  { to: "/app/attendance", label: "Attend.", icon: CalendarCheck },
  { to: "/app/more", label: "More", icon: MoreHorizontal },
];

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { academyName } = useAcademy();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const signOut = () => {
    logout();
    navigate("/app/login", { replace: true });
  };

  const userInitials = user?.name ? initialsOf(user.name) : "SS";

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex sticky top-0 h-screen w-64 flex-col border-r border-border bg-card/50 px-3 py-5">
          <div className="px-2 mb-6"><Logo /></div>
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
            {NAV.map(item => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user?.name ?? academyName}</p>
                <p className="text-xs text-muted-foreground">Internal team</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
            <aside
              className="absolute left-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-card border-r border-border p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-fade-in flex flex-col safe-pb"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-muted/40"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="space-y-1 flex-1 overflow-y-auto overscroll-contain">
                {NAV.map(item => <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />)}
              </nav>
              <Button variant="outline" className="w-full mt-4 min-h-[44px]" onClick={() => { setMobileOpen(false); signOut(); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 pb-nav">
          <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border safe-pt">
            <div className="px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2 safe-px">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="lg:hidden h-11 w-11 -ml-1 flex items-center justify-center rounded-lg hover:bg-muted/40 shrink-0"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="font-display font-semibold text-base sm:text-lg truncate">
                    {NAV.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))?.label ?? "Dashboard"}
                  </h1>
                  <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{academyName}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  className="relative h-11 w-11 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 bg-primary text-primary-foreground text-[10px] border-0">3</Badge>
                </button>
                <Button variant="ghost" size="sm" className="hidden sm:flex h-9 text-xs" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
                </Button>
                <button
                  type="button"
                  className="h-11 w-11 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Account menu"
                >
                  {userInitials}
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-6 lg:p-8 animate-fade-in max-w-[100vw] overflow-x-hidden">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur safe-pb safe-px">
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map(item => {
            const Icon = item.icon;
            if (item.to === "/app/more") {
              return (
                <li key={item.to}>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    className="w-full flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-muted-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] leading-tight">{item.label}</span>
                  </button>
                </li>
              );
            }
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] leading-tight">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <a
        href="https://wa.me/919033002641"
        target="_blank"
        rel="noreferrer"
        className="hidden lg:flex fixed bottom-5 right-5 z-30 items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 shadow-glow hover:scale-105 transition-transform text-sm font-medium"
      >
        <HelpCircle className="h-4 w-4" /> Need help?
      </a>
    </div>
  );
};

const NavItem = ({ to, label, icon: Icon, end, onClick }: {
  to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors min-h-[44px]",
        isActive
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )
    }
  >
    <Icon className="h-4 w-4 shrink-0" />
    <span>{label}</span>
  </NavLink>
);

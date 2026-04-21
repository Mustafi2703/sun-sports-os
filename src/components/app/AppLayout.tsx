import { ReactNode, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Home, Users, Layers, CreditCard, CalendarCheck, TrendingUp, Heart, Award,
  MessageCircle, BarChart3, Settings, Bell, Menu, X, MoreHorizontal, ArrowRight, HelpCircle, Trophy
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { academyName } from "@/data/academy";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/app", label: "Dashboard", icon: Home, end: true },
  { to: "/app/students", label: "Students", icon: Users },
  { to: "/app/batches", label: "Batches", icon: Layers },
  { to: "/app/fees", label: "Fee Management", icon: CreditCard },
  { to: "/app/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/app/performance", label: "Performance", icon: TrendingUp },
  { to: "/app/parent-portal", label: "Parent Portal", icon: Heart },
  { to: "/app/coach", label: "Coach Dashboard", icon: Award },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Demo banner */}
      <div className="sticky top-0 z-40 bg-primary/15 border-b border-primary/30 backdrop-blur">
        <div className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <p className="text-foreground truncate">
            <span className="text-primary font-semibold">Demo Mode</span>
            <span className="hidden sm:inline text-muted-foreground"> — all data is sample data. Start your free trial to set up your real academy.</span>
          </p>
          <Link to="/" className="shrink-0">
            <Button size="sm" className="h-7 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
              Start Free Trial <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex sticky top-[37px] h-[calc(100vh-37px)] w-64 flex-col border-r border-border bg-card/50 px-3 py-5">
          <div className="px-2 mb-6"><Logo /></div>
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
            {NAV.map(item => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">CC</div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{academyName}</p>
              <p className="text-xs text-muted-foreground">Pro Plan</p>
            </div>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur" onClick={() => setMobileOpen(false)}>
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border p-4 animate-fade-in" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <Logo />
                <button onClick={() => setMobileOpen(false)} className="p-2"><X className="h-5 w-5" /></button>
              </div>
              <nav className="space-y-1">
                {NAV.map(item => <NavItem key={item.to} {...item} onClick={() => setMobileOpen(false)} />)}
              </nav>
            </aside>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          {/* Top bar */}
          <div className="sticky top-[37px] z-30 bg-background/80 backdrop-blur border-b border-border">
            <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button className="lg:hidden p-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="font-display font-semibold text-base sm:text-lg truncate">
                  {NAV.find(n => n.end ? location.pathname === n.to : location.pathname.startsWith(n.to))?.label ?? "Dashboard"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button className="relative h-9 w-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted/50 transition-colors">
                  <Bell className="h-4 w-4" />
                  <Badge className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 bg-primary text-primary-foreground text-[10px] border-0">3</Badge>
                </button>
                <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">A</div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur">
        <ul className="grid grid-cols-5">
          {MOBILE_NAV.map(item => {
            const Icon = item.icon;
            if (item.to === "/app/more") {
              return (
                <li key={item.to}>
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="w-full flex flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px]">{item.label}</span>
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
                    cn("flex flex-col items-center justify-center gap-1 py-2.5",
                      isActive ? "text-primary" : "text-muted-foreground")
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Help button */}
      <a
        href="https://wa.me/919999999999"
        target="_blank"
        rel="noreferrer"
        className="hidden sm:flex fixed bottom-5 right-5 z-30 items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2.5 shadow-glow hover:scale-105 transition-transform text-sm font-medium"
      >
        <HelpCircle className="h-4 w-4" /> Need help?
      </a>
    </div>
  );
};

const NavItem = ({ to, label, icon: Icon, end, onClick }: {
  to: string; label: string; icon: any; end?: boolean; onClick?: () => void;
}) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
        isActive
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
      )
    }
  >
    <Icon className="h-4 w-4" />
    <span>{label}</span>
  </NavLink>
);
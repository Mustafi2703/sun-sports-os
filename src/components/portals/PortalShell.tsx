import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { initialsOf } from "@/lib/api";
import { LogOut, Menu, X, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type PortalTab = {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: React.ReactNode;
};

export function PortalShell({
  title,
  subtitle,
  roleLabel,
  children,
  tabs,
  activeTab,
  onTabChange,
}: {
  title: string;
  subtitle?: string;
  roleLabel?: string;
  children: React.ReactNode;
  tabs?: PortalTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
}) {
  const { user, logout, activeRole } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when drawer is open
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
    const path =
      activeRole === "parent" ? "/parent/login" : activeRole === "coach" ? "/coach/login" : "/app/login";
    navigate(path, { replace: true });
  };

  const userInitials = user?.name ? initialsOf(user.name) : "SS";
  const role =
    roleLabel ||
    (activeRole === "parent" ? "Parent" : activeRole === "coach" ? "Coach" : "Portal");
  const activeLabel = tabs?.find((t) => t.id === activeTab)?.label ?? title;
  const mobileTabs = (tabs ?? []).slice(0, 5);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
      <div className="flex">
        {/* Sidebar (desktop) */}
        <aside className="hidden lg:flex sticky top-0 h-screen w-64 flex-col border-r border-border bg-card/50 px-3 py-5">
          <div className="px-2 mb-6">
            <Link to="/">
              <Logo />
            </Link>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
            {(tabs ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange?.(t.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                  activeTab === t.id
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                )}
              >
                <span className="h-4 w-4 flex items-center justify-center shrink-0">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{user?.name ?? title}</p>
                <p className="text-xs text-muted-foreground">{role}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full justify-start" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5 mr-2" /> Sign out
            </Button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          >
            <aside
              className="absolute left-0 top-0 bottom-0 w-[min(18rem,85vw)] bg-card border-r border-border p-4 pt-[max(1rem,env(safe-area-inset-top))] animate-fade-in flex flex-col safe-pb"
              onClick={(e) => e.stopPropagation()}
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
                {(tabs ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      onTabChange?.(t.id);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors text-left min-h-[44px]",
                      activeTab === t.id
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    <span className="h-5 w-5 flex items-center justify-center">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </nav>
              <Button
                variant="outline"
                className="w-full mt-4 min-h-[44px]"
                onClick={() => {
                  setMobileOpen(false);
                  signOut();
                }}
              >
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
                  <h1 className="font-display font-semibold text-base sm:text-lg truncate">{activeLabel}</h1>
                  <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                    {subtitle || user?.name || "Sun Sports"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" className="hidden sm:flex h-9 text-xs" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out
                </Button>
                <button
                  type="button"
                  className="lg:hidden h-11 w-11 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold"
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
      {mobileTabs.length > 0 && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur safe-pb safe-px">
          <ul
            className="grid"
            style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, 1fr)` }}
          >
            {mobileTabs.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onTabChange?.(t.id)}
                  className={cn(
                    "w-full flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 px-0.5",
                    activeTab === t.id ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <span className="h-5 w-5 flex items-center justify-center">{t.icon}</span>
                  <span className="text-[10px] leading-tight truncate max-w-full px-0.5">
                    {t.shortLabel || t.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

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
}

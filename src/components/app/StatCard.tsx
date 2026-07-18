import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: { value: string; up: boolean };
  tone?: "default" | "success" | "warning" | "danger";
  hint?: string;
}

const toneMap: Record<string, string> = {
  default: "text-foreground",
  success: "text-primary",
  warning: "text-amber-400",
  danger: "text-rose-400",
};

export const StatCard = ({ label, value, icon, trend, tone = "default", hint }: StatCardProps) => (
  <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-5 hover:border-primary/30 transition-colors min-w-0">
    <div className="flex items-start justify-between gap-2">
      <p className="text-[11px] sm:text-sm text-muted-foreground leading-snug">{label}</p>
      {icon && (
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
    </div>
    <p className={cn("mt-2 sm:mt-3 font-display text-lg sm:text-2xl lg:text-3xl font-bold truncate", toneMap[tone])}>
      {value}
    </p>
    {(trend || hint) && (
      <div className="mt-1.5 sm:mt-2 flex items-center gap-2 text-[10px] sm:text-xs min-w-0">
        {trend && (
          <span className={cn("inline-flex items-center gap-1 font-medium shrink-0", trend.up ? "text-primary" : "text-rose-400")}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground truncate">{hint}</span>}
      </div>
    )}
  </div>
);

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
  <div className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
    <div className="flex items-start justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      {icon && (
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      )}
    </div>
    <p className={cn("mt-3 font-display text-2xl sm:text-3xl font-bold", toneMap[tone])}>{value}</p>
    {(trend || hint) && (
      <div className="mt-2 flex items-center gap-2 text-xs">
        {trend && (
          <span className={cn("inline-flex items-center gap-1 font-medium", trend.up ? "text-primary" : "text-rose-400")}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    )}
  </div>
);
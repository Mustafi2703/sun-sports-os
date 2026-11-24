import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isHistoricalStatus, STATUS_LABEL, type MarkableStatus } from "@/lib/academyDays";

const OPTIONS: { value: MarkableStatus; label: string; title: string }[] = [
  { value: "present", label: "P", title: "Present" },
  { value: "absent", label: "A", title: "Absent" },
  { value: "no_session", label: "NS", title: "No session" },
];

export function AttendanceStatusPicker({
  value,
  onChange,
  variant = "letters",
  locked = false,
}: {
  value?: string;
  onChange: (status: MarkableStatus) => void;
  variant?: "letters" | "icons";
  /** Weekend, or any day where this student should not be marked. */
  locked?: boolean;
}) {
  if (locked || isHistoricalStatus(value)) {
    const label =
      !value || value === "none" ? "Off" : `${STATUS_LABEL[value] || value} saved`;
    return (
      <span
        className={cn(
          "inline-flex items-center h-9 px-2.5 rounded-lg text-[11px] font-semibold border",
          value === "late" && "border-amber-500/50 text-amber-700 dark:text-amber-300",
          value === "leave" && "border-blue-500/50 text-blue-700 dark:text-blue-300",
          value !== "late" && value !== "leave" && "border-border text-muted-foreground"
        )}
        title={
          isHistoricalStatus(value)
            ? "Saved earlier. This mark stays as it is."
            : "No session on this day."
        }
      >
        {label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Attendance status">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        const className = cn(
          "rounded-lg border font-semibold",
          variant === "icons" ? "h-11 w-11 sm:h-9 sm:w-9 flex items-center justify-center" : "h-9 min-w-9 px-1.5 text-[11px]",
          active
            ? opt.value === "absent"
              ? "bg-destructive text-destructive-foreground border-destructive"
              : opt.value === "no_session"
                ? "bg-slate-500 text-white border-slate-500"
                : "bg-primary text-primary-foreground border-primary"
            : "border-border text-muted-foreground hover:bg-muted/30"
        );
        return (
          <button key={opt.value} type="button" title={opt.title} aria-pressed={active} onClick={() => onChange(opt.value)} className={className}>
            {variant === "icons" && opt.value === "present" ? <Check className="h-4 w-4" /> : null}
            {variant === "icons" && opt.value === "absent" ? <X className="h-4 w-4" /> : null}
            {variant === "icons" && opt.value === "no_session" ? "NS" : null}
            {variant === "letters" ? opt.label : null}
          </button>
        );
      })}
    </div>
  );
}

export function WeekendOffNotice({
  date,
  weekday,
  closureTitle,
  closureReason,
}: {
  date: string;
  weekday: string;
  closureTitle?: string;
  closureReason?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <p className="font-medium">No session on {weekday} {date}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Saturday and Sunday are off for every batch. There is nothing to mark.
      </p>
      {closureTitle ? (
        <p className="text-xs mt-1">
          Also published: {closureTitle}
          {closureReason ? `. ${closureReason}` : ""}
        </p>
      ) : null}
    </div>
  );
}

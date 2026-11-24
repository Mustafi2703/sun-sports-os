import { cn } from "@/lib/utils";
import { attendanceCellTone, attendanceDayTitle, type AttendanceGridLike } from "@/lib/academyDays";

export function AttendanceDayGrid({ days }: { days: AttendanceGridLike[] }) {
  return (
    <div className="grid grid-cols-10 gap-1.5">
      {days.map((m) => (
        <div
          key={m.date}
          title={attendanceDayTitle(m)}
          className={cn("aspect-square rounded-md", attendanceCellTone(m))}
        />
      ))}
    </div>
  );
}

export function AttendanceLegend() {
  return (
    <div className="flex flex-wrap gap-3 mt-4 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/80" /> Present</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/80" /> Late, saved</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/80" /> Absent</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500/70" /> Leave, saved</span>
      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-400/50" /> Weekend / no session</span>
    </div>
  );
}

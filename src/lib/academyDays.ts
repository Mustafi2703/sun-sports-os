/**
 * Saturday and Sunday are off for every batch.
 * This is a code rule. It does not edit batch rows or attendance rows.
 * Keep this weekend check identical to server/src/lib/academyDays.ts.
 */

export type OffReason = "weekend" | "closure";

export type AttendanceGridLike = {
  date: string;
  status: string;
  note?: string;
  closureTitle?: string;
  closureReason?: string;
  offReason?: OffReason;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  leave: "Leave",
  no_session: "No session",
  none: "Not marked",
};

export const MARKABLE_STATUSES = ["present", "absent", "no_session"] as const;
export type MarkableStatus = (typeof MARKABLE_STATUSES)[number];

export function isWeekend(input: string): boolean {
  const iso = input.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return day === 0 || day === 6;
}

export function weekdayName(input: string): string {
  const iso = input.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "that day";
  return WEEKDAYS[new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()];
}

export function isHistoricalStatus(status: string | undefined): boolean {
  return status === "late" || status === "leave";
}

export function isMarkableStatus(status: string | undefined): status is MarkableStatus {
  return status === "present" || status === "absent" || status === "no_session";
}

/** 30-day calendar totals. Weekends are off days and are not missed sessions. */
export function summarizeGrid(days: AttendanceGridLike[]) {
  const counted = days.filter(
    (d) =>
      d.offReason !== "weekend" &&
      (d.status === "present" || d.status === "late" || d.status === "absent" || d.status === "leave")
  );
  const present = counted.filter((d) => d.status === "present" || d.status === "late").length;
  const absent = counted.filter((d) => d.status === "absent").length;
  const leave = counted.filter((d) => d.status === "leave").length;
  const off = days.filter((d) => d.offReason === "weekend" || d.offReason === "closure" || d.status === "no_session").length;
  const notes = days.filter((d) => (d.note || "").trim());
  const weekendMarks = days.filter(
    (d) => d.offReason === "weekend" && d.status !== "no_session" && d.status !== "none"
  );
  return { present, absent, leave, counted: counted.length, off, notes, weekendMarks };
}

export function attendanceCellTone(day: { status: string; offReason?: string }): string {
  if (day.offReason === "weekend" || day.status === "no_session") return "bg-slate-400/50";
  if (day.status === "present") return "bg-primary/80";
  if (day.status === "late") return "bg-amber-500/80";
  if (day.status === "absent") return "bg-destructive/80";
  if (day.status === "leave") return "bg-blue-500/70";
  return "bg-muted/40";
}

export function attendanceDayTitle(day: AttendanceGridLike): string {
  const bits = [day.date];
  if (day.offReason === "weekend") bits.push("Weekend off");
  else if (day.offReason === "closure") bits.push("No session");
  const skipStatus =
    (day.offReason === "weekend" || day.offReason === "closure") &&
    (day.status === "no_session" || day.status === "none" || !day.status);
  if (!skipStatus && day.status && day.status !== "none") {
    bits.push(STATUS_LABEL[day.status] || day.status);
  }
  if (day.closureTitle && day.closureTitle !== "Weekend") bits.push(day.closureTitle);
  if (day.note) bits.push(day.note);
  if (day.closureReason && day.closureReason !== "No sessions on Saturday or Sunday") bits.push(day.closureReason);
  return bits.join(". ");
}

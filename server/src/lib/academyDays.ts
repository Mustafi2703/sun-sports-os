/**
 * Saturday and Sunday are off for every batch.
 * This is a code rule. It does not edit batch rows or attendance rows.
 * Keep this weekend check identical to src/lib/academyDays.ts.
 */

const COUNTED_TOWARD_PERCENT = new Set(["present", "absent", "late", "leave"]);
const ATTENDED = new Set(["present", "late"]);

export function isoDateOnly(input: Date | string): string {
  if (typeof input === "string") return input.slice(0, 10);
  return input.toISOString().slice(0, 10);
}

/** True for Saturday and Sunday. Uses the calendar date, not the server's local timezone. */
export function isWeekend(input: Date | string): boolean {
  const iso = isoDateOnly(input);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Attendance percent from saved rows.
 * Weekends are not sessions, so they are left out of both sides of the ratio.
 * Late still counts as attended. Leave still counts as a session that was not attended.
 * No-session rows are left out, same as before.
 * Returns 0 when nothing countable remains.
 */
export function attendancePercent(records: { status: string; date: Date | string }[]): number {
  const counted = records.filter((r) => !isWeekend(r.date) && COUNTED_TOWARD_PERCENT.has(r.status));
  if (!counted.length) return 0;
  const attended = counted.filter((r) => ATTENDED.has(r.status)).length;
  return Math.round((attended / counted.length) * 100);
}

export function countsTowardWeeklyTotal(record: { status: string; date: Date | string }): boolean {
  return !isWeekend(record.date);
}

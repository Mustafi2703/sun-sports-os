import { describe, expect, it } from "vitest";
import { isWeekend, summarizeGrid } from "./academyDays";

describe("weekend off days", () => {
  it("treats Saturday and Sunday as weekends and weekdays as session days", () => {
    expect(isWeekend("2026-11-21")).toBe(true);
    expect(isWeekend("2026-11-22")).toBe(true);
    expect(isWeekend("2026-11-20")).toBe(false);
    expect(isWeekend("2026-11-23")).toBe(false);
    expect(isWeekend("2026-11-24")).toBe(false);
  });

  it("does not count weekends as missed sessions and still counts saved leave and late on weekdays", () => {
    const summary = summarizeGrid([
      { date: "2026-11-20", status: "present" },
      { date: "2026-11-21", status: "absent", offReason: "weekend", note: "old saturday" },
      { date: "2026-11-22", status: "leave", offReason: "weekend", note: "family function" },
      { date: "2026-11-23", status: "late" },
      { date: "2026-11-18", status: "absent" },
      { date: "2026-11-19", status: "leave", note: "doctor" },
      { date: "2026-11-17", status: "no_session", offReason: "closure" },
      { date: "2026-11-14", status: "no_session", offReason: "weekend" },
    ]);

    expect(summary.present).toBe(2);
    expect(summary.absent).toBe(1);
    expect(summary.leave).toBe(1);
    expect(summary.counted).toBe(4);
    expect(summary.off).toBe(4);
    expect(summary.notes.map((d) => d.note)).toEqual(["old saturday", "family function", "doctor"]);
    expect(summary.weekendMarks.map((d) => d.status)).toEqual(["absent", "leave"]);
  });
});

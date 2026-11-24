import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendanceStatusPicker } from "./AttendanceStatusPicker";

describe("attendance marking options", () => {
  it("offers present, absent, and no session only", () => {
    render(<AttendanceStatusPicker value="present" onChange={vi.fn()} />);
    expect(screen.getByTitle("Present")).toBeInTheDocument();
    expect(screen.getByTitle("Absent")).toBeInTheDocument();
    expect(screen.getByTitle("No session")).toBeInTheDocument();
    expect(screen.queryByTitle("Late")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Leave")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Leave (parent informed)")).not.toBeInTheDocument();
  });

  it("shows a saved leave mark without a button that can change it", () => {
    render(<AttendanceStatusPicker value="leave" onChange={vi.fn()} />);
    expect(screen.getByText("Leave saved")).toBeInTheDocument();
    expect(screen.queryByTitle("Present")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Absent")).not.toBeInTheDocument();
  });

  it("shows a saved late mark without a button that can change it", () => {
    render(<AttendanceStatusPicker value="late" onChange={vi.fn()} variant="icons" />);
    expect(screen.getByText("Late saved")).toBeInTheDocument();
    expect(screen.queryByTitle("Present")).not.toBeInTheDocument();
  });

  it("does not offer marks on a weekend", () => {
    render(<AttendanceStatusPicker locked onChange={vi.fn()} />);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.queryByTitle("Present")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Absent")).not.toBeInTheDocument();
    expect(screen.queryByTitle("No session")).not.toBeInTheDocument();
  });
});

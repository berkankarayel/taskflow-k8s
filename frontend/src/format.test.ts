import { describe, expect, it } from "vitest";
import { formatDate, isOverdue, isStatus, parseTimestamp, timeAgo, todayISO } from "./format";

describe("todayISO", () => {
  it("formats the local date with zero padding", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("isOverdue", () => {
  const today = "2026-11-01";

  it("is overdue when the due date is in the past and the task is open", () => {
    expect(isOverdue({ due_date: "2026-10-31", status: "todo" }, today)).toBe(true);
    expect(isOverdue({ due_date: "2026-10-31", status: "in_progress" }, today)).toBe(true);
  });

  it("is not overdue when done, due today or later, or without a due date", () => {
    expect(isOverdue({ due_date: "2026-10-31", status: "done" }, today)).toBe(false);
    expect(isOverdue({ due_date: today, status: "todo" }, today)).toBe(false);
    expect(isOverdue({ due_date: null, status: "todo" }, today)).toBe(false);
  });
});

describe("formatDate", () => {
  it("does not shift date-only values across time zones", () => {
    expect(formatDate("2026-12-31")).toBe("Dec 31, 2026");
  });
});

describe("parseTimestamp", () => {
  it("treats timestamps without an offset as UTC", () => {
    expect(parseTimestamp("2026-11-01 10:00:00").toISOString()).toBe("2026-11-01T10:00:00.000Z");
  });

  it("respects an explicit offset", () => {
    expect(parseTimestamp("2026-11-01T13:00:00+03:00").toISOString()).toBe(
      "2026-11-01T10:00:00.000Z",
    );
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-01T12:00:00Z");

  it.each([
    ["2026-11-01T11:59:40Z", "just now"],
    ["2026-11-01T11:55:00Z", "5 minutes ago"],
    ["2026-11-01T09:00:00Z", "3 hours ago"],
    ["2026-10-31T12:00:00Z", "yesterday"],
  ])("%s -> %s", (value, expected) => {
    expect(timeAgo(value, now)).toBe(expected);
  });
});

describe("isStatus", () => {
  it("accepts only known statuses", () => {
    expect(isStatus("in_progress")).toBe(true);
    expect(isStatus("blocked")).toBe(false);
    expect(isStatus(null)).toBe(false);
  });
});

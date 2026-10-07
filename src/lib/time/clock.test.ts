import { afterEach, describe, expect, it, vi } from "vitest";
import { localDateStamp, nowIso } from "./clock";

// Core folders may not construct Date objects (ESLint), so instants are given as epoch milliseconds.
const localDate = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

describe("clock", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current instant as ISO 8601 UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 9, 7, 9, 30, 0));
    expect(nowIso()).toBe("2026-10-07T09:30:00.000Z");
  });

  it("returns the local YYYY-MM-DD date", () => {
    vi.useFakeTimers();
    for (const ms of [Date.UTC(2026, 9, 7, 11, 0, 0), Date.UTC(2026, 0, 5, 0, 0, 1), Date.UTC(2025, 11, 31, 23, 59, 0)]) {
      vi.setSystemTime(ms);
      expect(localDateStamp()).toBe(localDate(ms));
      expect(localDateStamp()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

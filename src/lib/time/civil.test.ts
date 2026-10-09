import { describe, expect, it } from "vitest";
import {
  addMonths, civilFromDays, daysBetween, daysFromCivil, daysInMonth, fiscalYearOf, formatIsoDate, fyLabel, isLeapYear,
  monthYearLabel, parseIsoDate, quarterLabel, ttmLabel,
} from "./civil";

describe("parseIsoDate", () => {
  it("parses strict YYYY-MM-DD", () => {
    expect(parseIsoDate("2026-06-30")).toEqual({ y: 2026, m: 6, d: 30 });
    expect(parseIsoDate(" 2024-02-29 ")).toEqual({ y: 2024, m: 2, d: 29 });
  });

  it("rejects malformed and impossible dates", () => {
    for (const s of ["2026-6-30", "2026/06/30", "30-06-2026", "2026-13-01", "2026-00-10", "2026-02-29", "2026-04-31", "", "2026-06-30T00:00:00Z"]) {
      expect(parseIsoDate(s), s).toBeNull();
    }
  });
});

describe("daysFromCivil / civilFromDays", () => {
  it("anchors on the Unix epoch", () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(daysFromCivil(1969, 12, 31)).toBe(-1);
    expect(daysFromCivil(2000, 3, 1)).toBe(11017);
  });

  it("matches the platform calendar and round-trips over many years", () => {
    for (let d = -800_000; d <= 800_000; d += 997) {
      const c = civilFromDays(d);
      expect(daysFromCivil(c.y, c.m, c.d)).toBe(d);
    }
    // cross-check a few dates against Date.UTC (tests may read the platform calendar)
    for (const [y, m, d] of [[2026, 6, 30], [1900, 2, 28], [2400, 2, 29], [2024, 12, 31]] as const) {
      expect(daysFromCivil(y, m, d)).toBe(Date.UTC(y, m - 1, d) / 86_400_000);
    }
  });

  it("knows leap years and month lengths", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
  });

  it("computes day differences", () => {
    expect(daysBetween("2025-06-30", "2026-06-30")).toBe(365);
    expect(daysBetween("2026-06-30", "2026-03-31")).toBe(-91);
    expect(daysBetween("bad", "2026-03-31")).toBeNull();
  });
});

describe("addMonths", () => {
  it("keeps month ends at month ends", () => {
    expect(addMonths("2026-06-30", -3)).toBe("2026-03-31");
    expect(addMonths("2026-03-31", -3)).toBe("2025-12-31");
    expect(addMonths("2025-12-31", -3)).toBe("2025-09-30");
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("returns null for an invalid date", () => {
    expect(addMonths("2026-02-30", 1)).toBeNull();
  });
});

describe("labels", () => {
  it("formats fiscal years", () => {
    expect(fyLabel(2026)).toBe("FY26");
    expect(fyLabel(2005)).toBe("FY05");
    expect(fyLabel(2000)).toBe("FY00");
  });

  it("labels quarters for a March year end", () => {
    expect(quarterLabel("2026-06-30", 3)).toBe("Q1 FY27");
    expect(quarterLabel("2026-09-30", 3)).toBe("Q2 FY27");
    expect(quarterLabel("2026-12-31", 3)).toBe("Q3 FY27");
    expect(quarterLabel("2027-03-31", 3)).toBe("Q4 FY27");
  });

  it("labels quarters for other year ends", () => {
    expect(quarterLabel("2026-03-31", 12)).toBe("Q1 FY26");
    expect(quarterLabel("2026-12-31", 12)).toBe("Q4 FY26");
    expect(quarterLabel("2026-09-30", 6)).toBe("Q1 FY27");
    expect(quarterLabel("2026-06-30", 6)).toBe("Q4 FY26");
  });

  it("returns the input for an invalid date", () => {
    expect(quarterLabel("not a date", 3)).toBe("not a date");
  });

  it("formats month-year and TTM labels", () => {
    expect(monthYearLabel("2026-06-30")).toBe("Jun 2026");
    expect(ttmLabel("2026-06-30")).toBe("TTM to Jun 2026");
    expect(fiscalYearOf(2026, 4, 3)).toBe(2027);
    expect(fiscalYearOf(2026, 3, 3)).toBe(2026);
    expect(formatIsoDate({ y: 26, m: 1, d: 5 })).toBe("0026-01-05");
  });
});

import { describe, expect, it } from "vitest";
import { NULL_REASONS, VF, type MetricColumn, type NullReason } from "@/lib/contracts";
import {
  aggregateWindow, cagrColumn, emptyColumn, isPresent, nullColumn, reasonCode, reasonFromCode, setNull, setValue, valueAt,
} from "./windows";

/** Builds a column from literal entries: a number, or a reason for null. */
function col(id: string, entries: (number | NullReason)[], flags: number[] = []): MetricColumn {
  const c = emptyColumn(id, entries.length);
  entries.forEach((e, i) => (typeof e === "number" ? setValue(c, i, e, flags[i] ?? 0) : setNull(c, i, e)));
  return c;
}

describe("column helpers", () => {
  it("round-trips reason codes", () => {
    NULL_REASONS.forEach((r, i) => {
      if (r === "none") expect(reasonFromCode(i)).toBeNull();
      else {
        expect(reasonFromCode(i)).toBe(r);
        expect(reasonCode(r)).toBe(i);
      }
    });
    expect(reasonCode(null)).toBe(0);
    expect(reasonFromCode(99)).toBeNull();
  });

  it("never stores NaN or Infinity as a value", () => {
    const c = emptyColumn("x", 2);
    setValue(c, 0, Infinity);
    setValue(c, 1, 3, VF.Provided);
    expect(valueAt(c, 0)).toEqual({ v: null, reason: "non_positive_denominator", flags: 0 });
    expect(valueAt(c, 1)).toEqual({ v: 3, reason: null, flags: VF.Provided });
    expect(isPresent(c, 0)).toBe(false);
    expect(valueAt(nullColumn("y", 1, "no_price"), 0)).toEqual({ v: null, reason: "no_price", flags: 0 });
  });
});

describe("aggregateWindow", () => {
  const y0 = col("roce@0", [20, 10, 5, "not_applicable_financial", 8, "missing_input"]);
  const y1 = col("roce@1", [16, 14, "transition_period", "not_applicable_financial", "insufficient_history", 4]);
  const y2 = col("roce@2", [12, 12, 7, "not_applicable_financial", 9, 6]);

  it("computes avg, median, min, max, sum and population stdev when every input is present", () => {
    const cols = [y0, y1, y2];
    expect(valueAt(aggregateWindow("avg", cols, "a"), 0).v).toBeCloseTo(16, 12);
    expect(valueAt(aggregateWindow("median", cols, "a"), 0).v).toBe(16);
    expect(valueAt(aggregateWindow("min", cols, "a"), 0).v).toBe(12);
    expect(valueAt(aggregateWindow("max", cols, "a"), 0).v).toBe(20);
    expect(valueAt(aggregateWindow("sum", cols, "a"), 0).v).toBe(48);
    // population stdev of 20, 16, 12 = sqrt(32/3)
    expect(valueAt(aggregateWindow("stdev", cols, "a"), 0).v).toBeCloseTo(Math.sqrt(32 / 3), 12);
    expect(valueAt(aggregateWindow("median", [y0, y1], "a"), 1).v).toBe(12); // even count: mean of middle two
  });

  it("is null unless all N inputs are present, with the documented reason priority", () => {
    const out = aggregateWindow("avg", [y0, y1, y2], "roce_avg_3y");
    expect(out.id).toBe("roce_avg_3y");
    expect(valueAt(out, 2).reason).toBe("transition_period");
    expect(valueAt(out, 3).reason).toBe("not_applicable_financial");
    expect(valueAt(out, 4).reason).toBe("insufficient_history");
    expect(valueAt(out, 5).reason).toBe("insufficient_history"); // missing_input inside a window → IH
  });

  it("prefers not_applicable_financial over transition_period", () => {
    const a = col("a", ["transition_period"]);
    const b = col("b", ["not_applicable_financial"]);
    expect(valueAt(aggregateWindow("sum", [a, b], "s"), 0).reason).toBe("not_applicable_financial");
  });

  it("carries input flags such as Approximate and Provided", () => {
    const a = col("a", [1], [VF.Approximate]);
    const b = col("b", [3], [VF.Provided | VF.Turnaround]);
    const out = valueAt(aggregateWindow("avg", [a, b], "x"), 0);
    expect(out.v).toBe(2);
    expect(out.flags & VF.Approximate).toBeTruthy();
    expect(out.flags & VF.Provided).toBeTruthy();
    expect(out.flags & VF.Turnaround).toBe(0);
  });

  it("handles an empty window and rejects misaligned columns", () => {
    expect(aggregateWindow("avg", [], "x").values.length).toBe(0);
    expect(() => aggregateWindow("avg", [col("a", [1, 2]), col("b", [1])], "x")).toThrow(RangeError);
  });

  it("is deterministic: same inputs give identical typed arrays", () => {
    const a = aggregateWindow("stdev", [y0, y1, y2], "x");
    const b = aggregateWindow("stdev", [y0, y1, y2], "x");
    expect(Array.from(a.values)).toEqual(Array.from(b.values));
    expect(Array.from(a.reasons)).toEqual(Array.from(b.reasons));
  });
});

describe("cagrColumn", () => {
  it("computes ((end / start)^(1/years) − 1) × 100", () => {
    const out = cagrColumn(col("e", [161.051, 100]), col("s", [100, 100]), 5, "sales_cagr_5y");
    expect(out.id).toBe("sales_cagr_5y");
    expect(valueAt(out, 0).v).toBeCloseTo(10, 10);
    expect(valueAt(out, 1).v).toBeCloseTo(0, 12);
  });

  it("is non_positive_denominator unless both ends are positive, flagging a turnaround", () => {
    const out = cagrColumn(col("e", [50, -5, 0, -10]), col("s", [-20, 10, 10, -5]), 3, "x");
    expect(valueAt(out, 0)).toEqual({ v: null, reason: "non_positive_denominator", flags: VF.Turnaround });
    expect(valueAt(out, 1)).toMatchObject({ v: null, reason: "non_positive_denominator", flags: 0 });
    expect(valueAt(out, 2).reason).toBe("non_positive_denominator");
    expect(valueAt(out, 3).flags & VF.Turnaround).toBe(0);
  });

  it("carries the input's null reason when an end is missing", () => {
    const out = cagrColumn(
      col("e", ["not_applicable_financial", 10, "missing_input", 10]),
      col("s", [5, "insufficient_history", 5, "transition_period"]),
      3, "x",
    );
    expect(valueAt(out, 0).reason).toBe("not_applicable_financial");
    expect(valueAt(out, 1).reason).toBe("insufficient_history");
    expect(valueAt(out, 2).reason).toBe("missing_input");
    expect(valueAt(out, 3).reason).toBe("transition_period");
  });

  it("rejects a non-positive number of years", () => {
    expect(() => cagrColumn(col("e", [1]), col("s", [1]), 0, "x")).toThrow(RangeError);
  });
});

import { describe, it, expect } from "vitest";
import { calculateDCF, calculateWACC, monteCarloSimulation, reverseImpliedGrowth, seededRandom, summariseSimulation, type DCFInputs } from "./dcf";

const base: DCFInputs = {
  symbol: "TEST",
  fcf: 1000,
  growthRate: 10,
  stage2Growth: 5,
  terminalGrowth: 3,
  discountRate: 12,
  years: 5,
  stage2Years: 5,
  sharesOutstanding: 100,
  terminalMethod: "perpetuity",
  exitMultiple: 15,
  netDebt: 0,
};

describe("calculateDCF", () => {
  it("builds one projection row per year plus the current year", () => {
    const r = calculateDCF(base);
    expect(r.projections).toHaveLength(1 + base.years + base.stage2Years);
    expect(r.projections[0].phase).toBe("Current");
  });

  it("matches a hand-computed zero-growth perpetuity", () => {
    // FCF 100, no growth, 10% discount => EV ~ 100 / 0.10 = 1000 (terminal growth 0)
    const r = calculateDCF({ ...base, fcf: 100, growthRate: 0, stage2Growth: 0, terminalGrowth: 0, discountRate: 10, years: 3, stage2Years: 0, sharesOutstanding: 1 });
    expect(r.totalPV).toBeCloseTo(1000, 6);
    expect(r.perShare).toBeCloseTo(1000, 6);
  });

  it("subtracts net debt before dividing by shares", () => {
    const a = calculateDCF(base);
    const b = calculateDCF({ ...base, netDebt: 500 });
    expect(a.perShare - b.perShare).toBeCloseTo(500 / base.sharesOutstanding, 6);
  });

  it("supports the exit-multiple terminal method", () => {
    const r = calculateDCF({ ...base, terminalMethod: "exitMultiple", exitMultiple: 10 });
    expect(Number.isFinite(r.perShare)).toBe(true);
    expect(r.pvTerminal).toBeGreaterThan(0);
  });

  it("returns NaN instead of a bogus value when terminal growth >= discount rate", () => {
    expect(calculateDCF({ ...base, terminalGrowth: 12 }).perShare).toBeNaN();
    expect(calculateDCF({ ...base, terminalGrowth: 15 }).perShare).toBeNaN();
  });

  it("is monotonic: higher discount rate lowers value", () => {
    expect(calculateDCF({ ...base, discountRate: 14 }).perShare).toBeLessThan(calculateDCF(base).perShare);
  });
});

describe("calculateWACC", () => {
  it("equals cost of equity when there is no debt", () => {
    const w = calculateWACC({ riskFreeRate: 7, beta: 1, equityRiskPremium: 5, costOfDebt: 9, taxRate: 25, debtToEquity: 0 });
    expect(w).toBeCloseTo(12, 8);
  });

  it("blends after-tax cost of debt by weight", () => {
    // D/E = 1 => 50/50. Ke = 7 + 1*5 = 12, Kd(after tax) = 8 * 0.75 = 6 => 9
    const w = calculateWACC({ riskFreeRate: 7, beta: 1, equityRiskPremium: 5, costOfDebt: 8, taxRate: 25, debtToEquity: 1 });
    expect(w).toBeCloseTo(9, 8);
  });
});

describe("reverseImpliedGrowth", () => {
  it("recovers the growth rate that produces a given price", () => {
    const target = calculateDCF({ ...base, growthRate: 14 }).perShare;
    expect(reverseImpliedGrowth(base, target)).toBeCloseTo(14, 3);
  });
});

describe("monteCarloSimulation", () => {
  it("is reproducible with a seeded RNG and returns sorted, positive values", () => {
    const makeRng = () => {
      let s = 42;
      return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
    };
    const a = monteCarloSimulation(base, 500, makeRng());
    const b = monteCarloSimulation(base, 500, makeRng());
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((v, i) => v > 0 && (i === 0 || a[i - 1] <= v))).toBe(true);
  });
});

describe("seeded Monte Carlo", () => {
  it("gives the same result for the same symbol and different results for different symbols", () => {
    const a = monteCarloSimulation({ ...base, symbol: "AAA" }, 400);
    const b = monteCarloSimulation({ ...base, symbol: "AAA" }, 400);
    const c = monteCarloSimulation({ ...base, symbol: "BBB" }, 400);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("treats the symbol's case and spaces alike", () => {
    expect(seededRandom(" abc ")()).toBe(seededRandom("ABC")());
  });

  it("summarises sorted values and returns null for none", () => {
    expect(summariseSimulation([])).toBeNull();
    const s = summariseSimulation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(s).toMatchObject({ p10: 2, p50: 6, p90: 10, mean: 5.5, count: 10 });
  });
});

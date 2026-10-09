// src/lib/insights/sample.test.ts — the rules on the 150-company fictional sample (§E.4 acceptance):
// compounders pass most quality checks, red-flag archetypes trigger their flags, at least 70% of
// non-financial companies have at most one red flag, lenders get lender checks, and every message
// quotes its threshold and values.
import { describe, expect, it } from "vitest";
import type { CheckOutcome, MetricStore } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { compileQuery } from "@/lib/query";
import { type Archetype, generateSampleDataset, samplePlans } from "@/lib/sample";
import { runScreen, TEMPLATES } from "@/lib/screen";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";
import { CHECK_RULES, evaluateChecks, RED_FLAGS, summariseAreas } from "./index";

const DS = generateSampleDataset();
const STORE: MetricStore = createStore(DS);
const PLANS = samplePlans();
const ALL: CheckOutcome[][] = Array.from({ length: STORE.size }, (_, i) => evaluateChecks(STORE, i));

const indicesOf = (a: Archetype) => PLANS.flatMap((p, i) => (p.entry.archetype === a ? [i] : []));
const flagsOf = (i: number) => ALL[i].filter((o) => o.kind === "red_flag" && o.result === "met").map((o) => o.ruleId);
const resultOf = (i: number, id: string) => ALL[i].find((o) => o.ruleId === id)!.result;

/** Numbers written in a query, as they appear in messages (thresholds, multipliers, windows). */
function numbersIn(query: string): string[] {
  return [...query.matchAll(/(?<![a-z_])\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

describe("insight rules on the fictional sample", () => {
  it("the store lines up with the roster", () => {
    expect(STORE.size).toBe(150);
    PLANS.forEach((p, i) => expect(STORE.company(i).symbol).toBe(p.symbol));
  });

  it("compounders pass most quality checks (profitability, growth, balance sheet, cash conversion)", () => {
    const quality = new Set(["profitability", "growth", "balance_sheet", "cash_conversion"]);
    const compounders = indicesOf("compounder");
    expect(compounders).toHaveLength(14);
    for (const i of compounders) {
      const list = ALL[i].filter((o) => o.kind === "check" && quality.has(o.area) && o.result !== "not_applicable");
      expect(list).toHaveLength(16);
      const met = list.filter((o) => o.result === "met").length;
      expect(met, `${STORE.symbols[i]}: ${met} of 16`).toBeGreaterThanOrEqual(14);
      expect(resultOf(i, "PR-01"), STORE.symbols[i]).toBe("met");
      expect(resultOf(i, "GR-01"), STORE.symbols[i]).toBe("met");
      expect(resultOf(i, "BS-01"), STORE.symbols[i]).toBe("met");
      expect(flagsOf(i).length, STORE.symbols[i]).toBeLessThanOrEqual(1);
    }
  });

  it("red-flag archetypes trigger the flag they were built for", () => {
    const expected: [Archetype, string][] = [
      ["rf_receivables", "RF-02"], ["rf_pledge", "RF-03"], ["rf_cash", "RF-01"], ["negative_net_worth", "RF-07"],
    ];
    for (const [archetype, flag] of expected) {
      const idx = indicesOf(archetype);
      expect(idx.length, archetype).toBeGreaterThanOrEqual(2);
      for (const i of idx) expect(flagsOf(i), `${STORE.symbols[i]} (${archetype})`).toContain(flag);
    }
  });

  it("weak cash conversion also fails the matching checks", () => {
    for (const i of indicesOf("rf_cash")) {
      expect(resultOf(i, "CC-01")).toBe("not_met");
      expect(resultOf(i, "CC-02")).toBe("not_met");
    }
    for (const i of indicesOf("rf_receivables")) expect(resultOf(i, "CC-04")).toBe("not_met");
  });

  it("serial diluters show equity dilution in growth or red flags", () => {
    for (const i of indicesOf("serial_diluter")) {
      const diluted = flagsOf(i).includes("RF-11") || resultOf(i, "GR-04") === "not_met";
      expect(diluted, STORE.symbols[i]).toBe(true);
    }
  });

  it("cash-rich companies with no finance cost pass interest cover and do not trigger weak cover", () => {
    for (const i of indicesOf("cash_rich")) {
      expect(resultOf(i, "BS-02"), STORE.symbols[i]).toBe("met");
      expect(resultOf(i, "RF-06"), STORE.symbols[i]).toBe("not_met");
    }
  });

  it("at least 70% of non-financial companies have at most one red flag", () => {
    const nf = PLANS.flatMap((_, i) => (STORE.family(i) === "non_financial" ? [i] : []));
    expect(nf).toHaveLength(122);
    const healthy = nf.filter((i) => flagsOf(i).length <= 1).length;
    expect(healthy / nf.length).toBeGreaterThanOrEqual(0.7);
    // And the provider column agrees for every company with a value.
    const col = STORE.column("red_flag_count");
    for (let i = 0; i < STORE.size; i++) if (col.reasons[i] === 0) expect(col.values[i], STORE.symbols[i]).toBe(flagsOf(i).length);
  });

  it("lenders get the lender checks and not-applicable for the industrial ones", () => {
    let lenders = 0;
    for (let i = 0; i < STORE.size; i++) {
      const family = STORE.family(i);
      for (const o of ALL[i]) {
        const rule = CHECK_RULES.find((r) => r.id === o.ruleId)!;
        if (rule.appliesTo.includes(family)) expect(o.result, `${STORE.symbols[i]} ${o.ruleId}`).not.toBe("not_applicable");
        else expect(o.result, `${STORE.symbols[i]} ${o.ruleId}`).toBe("not_applicable");
      }
      if (family !== "lender") continue;
      lenders++;
      for (const id of ["LP-01", "LP-02", "AQ-01", "AQ-02", "AQ-03", "EF-01", "EF-02"]) {
        expect(["met", "not_met"], `${STORE.symbols[i]} ${id}`).toContain(resultOf(i, id));
      }
      for (const id of ["PR-01", "BS-01", "BS-03", "CC-01", "RF-01", "RF-06", "RF-09"]) expect(resultOf(i, id)).toBe("not_applicable");
      expect(summariseAreas(STORE, i).map((a) => a.area)).toEqual(["profitability", "shareholder_returns", "asset_quality", "efficiency"]);
    }
    expect(lenders).toBe(24);
  });

  it("good banks pass more asset-quality checks than stressed banks on average", () => {
    const aq = (i: number) => ALL[i].filter((o) => o.area === "asset_quality" && o.kind === "check" && o.result === "met").length;
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(avg(indicesOf("good_bank").map(aq))).toBeGreaterThanOrEqual(avg(indicesOf("stressed_bank").map(aq)));
  });

  it("insurers get only the rules for every family", () => {
    const insurers = PLANS.flatMap((_, i) => (STORE.family(i) === "insurance" ? [i] : []));
    expect(insurers).toHaveLength(4);
    for (const i of insurers) {
      const applicable = ALL[i].filter((o) => o.result !== "not_applicable").map((o) => o.ruleId);
      expect(applicable).toEqual(CHECK_RULES.filter((r) => r.appliesTo.includes("insurance")).map((r) => r.id));
    }
  });

  it("every evaluated message includes the rule's thresholds and the values compared", () => {
    for (let i = 0; i < STORE.size; i++) {
      for (const o of ALL[i]) {
        if (o.result !== "met" && o.result !== "not_met") continue;
        const where = `${STORE.symbols[i]} ${o.ruleId}: ${o.message}`;
        for (const n of numbersIn(o.query)) expect(o.message, where).toMatch(new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`));
        // At least one measured value besides the thresholds (period labels such as FY26 do not count),
        // or the "no interest cost" note that stands in for a value that cannot exist.
        const thresholds = new Set(numbersIn(o.query));
        const stripped = o.message.replace(/\bQ\d FY\d{2}\b/g, "").replace(/\bFY\d{2}\b/g, "").replace(/TTM to \w+ \d{4}/g, "")
          .replace(/\b\d+Y\b/g, "").replace(/\b\d+ companies\b/g, "");
        const values = [...stripped.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));
        // A value that rounds to the threshold ("1.5x; needs below 1.5x") still shows the measured value.
        const shownEvidence = o.evidence.some((e) => e.value.v !== null && o.message.includes(e.display));
        const hasValue = values.some((v) => !thresholds.has(v)) || shownEvidence || /no interest cost/.test(o.message);
        expect(hasValue, where).toBe(true);
      }
    }
  });

  it("the main measured value of a simple rule appears in its message", () => {
    for (let i = 0; i < STORE.size; i++) {
      for (const o of ALL[i]) {
        if (o.result !== "met" && o.result !== "not_met") continue;
        if (!/^[a-z_0-9]+ [<>=!]+ -?[\d.]+$/.test(o.query)) continue; // `metric op number` rules only
        const e = o.evidence[0];
        if (e.value.v === null) continue;
        const shown = e.display.replace(/ · debt-free$/, "");
        expect(o.message, `${STORE.symbols[i]} ${o.ruleId}`).toContain(shown);
      }
    }
  });

  it("no message, title or test uses a forbidden word", () => {
    for (let i = 0; i < STORE.size; i++) {
      for (const o of ALL[i]) expect(forbiddenWordHits(`${o.title} ${o.test} ${o.message}`), `${STORE.symbols[i]} ${o.ruleId}`).toEqual([]);
    }
  });

  it("the sample shows its teaching flags, and no flag fires for more than a fifth of the companies it applies to", () => {
    const fired = new Set(ALL.flatMap((_, i) => flagsOf(i)));
    for (const id of ["RF-01", "RF-02", "RF-03", "RF-05", "RF-06", "RF-07", "RF-09", "RF-11"]) expect(fired.has(id), id).toBe(true);
    for (const r of RED_FLAGS) {
      const applicable = ALL.filter((list) => list.find((o) => o.ruleId === r.id)!.result !== "not_applicable").length;
      const met = ALL.filter((list) => list.find((o) => o.ruleId === r.id)!.result === "met").length;
      expect(met / applicable, r.id).toBeLessThanOrEqual(0.2);
    }
  });
});

describe("engine wiring", () => {
  it("createStore exposes red_flag_count as a column with values for the sample", () => {
    const col = STORE.column("red_flag_count");
    expect(col.values).toHaveLength(150);
    let present = 0;
    for (let i = 0; i < STORE.size; i++) if (col.reasons[i] === 0) present++;
    expect(present).toBeGreaterThanOrEqual(140);
    expect(STORE.coverage("red_flag_count").nonNull).toBe(present);
  });

  it("the value template uses the real red_flag_count and still finds 3–25 companies", () => {
    const t = TEMPLATES.find((x) => x.id === "value")!;
    expect(t.query).toContain("red_flag_count = 0");
    const r = runScreen(STORE, { query: t.query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    expect(r.ok).toBe(true);
    expect(r.matched.length).toBeGreaterThanOrEqual(3);
    expect(r.matched.length).toBeLessThanOrEqual(25);
    for (const i of r.matched) expect(flagsOf(i)).toEqual([]);
  });

  it("FSQL can screen on red_flag_count", () => {
    const q = compileQuery("red_flag_count >= 2", STORE);
    expect(q.issues.filter((x) => x.level === "error")).toEqual([]);
    const r = runScreen(STORE, { query: "red_flag_count >= 2", columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] });
    const expected = ALL.flatMap((_, i) => (flagsOf(i).length >= 2 && STORE.column("red_flag_count").reasons[i] === 0 ? [i] : []));
    expect([...r.matched].sort((a, b) => a - b)).toEqual(expected);
  });
});

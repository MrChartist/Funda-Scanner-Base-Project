// src/lib/insights/run.test.ts — evaluateChecks, messages, evidence, summaries and the red_flag_count
// provider on the hand-checked tiny fixture and on crafted copies built to trigger one flag each.
import { describe, expect, it } from "vitest";
import type { CheckOutcome, MetricStore } from "@/lib/contracts";
import { NULL_REASONS } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { formatMetric } from "@/lib/format/metric-value";
import { createMetricStore } from "@/lib/metrics";
import { CRAFTED_CASES, craftedDataset } from "@/test/fixtures/insights/crafted";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import {
  CHECK_RULES, RED_FLAG_MAX_NOT_EVALUATED, RED_FLAGS, computeRedFlagCount, evaluateChecks, evidencePeriod,
  insightColumnProviders, outcomeFor, ruleMessage, ruleResult, summariseAreas, summariseOutcomes, summariseRedFlags,
} from "./index";
import { rulePlan } from "./run";

const STORE: MetricStore = createStore(craftedDataset());
const idx = (symbol: string) => {
  const i = STORE.indexOf(symbol);
  if (i < 0) throw new Error(`missing ${symbol}`);
  return i;
};
const outcomes = (symbol: string) => evaluateChecks(STORE, idx(symbol));
const outcome = (symbol: string, id: string) => {
  const o = outcomes(symbol).find((x) => x.ruleId === id);
  if (!o) throw new Error(`missing ${id}`);
  return o;
};
const triggered = (symbol: string) => outcomes(symbol).filter((o) => o.kind === "red_flag" && o.result === "met").map((o) => o.ruleId);

describe("evaluateChecks", () => {
  it("returns one outcome per rule, in rule order, with the rule's copy", () => {
    const list = outcomes("TINYMFG");
    expect(list.map((o) => o.ruleId)).toEqual(CHECK_RULES.map((r) => r.id));
    list.forEach((o, k) => {
      const r = CHECK_RULES[k];
      expect(o).toMatchObject({ kind: r.kind, area: r.area, title: r.title, test: r.test, query: r.query, section: r.section });
      expect(o.learn).toEqual(r.learn);
    });
  });

  it("returns an empty list for an index outside the store", () => {
    expect(evaluateChecks(STORE, -1)).toEqual([]);
    expect(evaluateChecks(STORE, STORE.size)).toEqual([]);
    expect(evaluateChecks(STORE, 1.5)).toEqual([]);
  });

  it("is deterministic and reuses the compiled rule for the store", () => {
    expect(evaluateChecks(STORE, idx("TINYMFG"))).toEqual(evaluateChecks(STORE, idx("TINYMFG")));
    const r = CHECK_RULES[0];
    expect(rulePlan(STORE, r)).toBe(rulePlan(STORE, r));
    const other = createStore(createTinyDataset());
    expect(rulePlan(other, r)).not.toBe(rulePlan(STORE, r));
    // Peer-free rules give the same outcome on another store holding the same company.
    const pick = (list: CheckOutcome[]) => list.filter((o) => !o.ruleId.startsWith("VA-"));
    expect(pick(evaluateChecks(other, other.indexOf("TINYMFG")))).toEqual(pick(evaluateChecks(STORE, idx("TINYMFG"))));
  });

  it("marks rules outside the company's family as not applicable, with no evidence and no reason", () => {
    const bank = outcomes("TINYBANK");
    for (const o of bank) {
      const rule = CHECK_RULES.find((r) => r.id === o.ruleId)!;
      if (rule.appliesTo.includes("lender")) expect(o.result, o.ruleId).not.toBe("not_applicable");
      else {
        expect(o.result, o.ruleId).toBe("not_applicable");
        expect(o.evidence, o.ruleId).toEqual([]);
        expect(o.reason, o.ruleId).toBeNull();
        expect(o.message, o.ruleId).toBe(`Not applicable: this ${o.kind === "check" ? "check" : "red flag"} is designed for non-financial companies, and this company is a lender.`);
      }
    }
    const mfg = outcomes("TINYMFG");
    for (const o of mfg.filter((x) => /^(LP|AQ|EF|LF)-/.test(x.ruleId))) {
      expect(o.result, o.ruleId).toBe("not_applicable");
      expect(o.message, o.ruleId).toContain("is designed for lenders (banks, NBFCs and housing finance companies), and this company is a non-financial company");
    }
  });

  it("gives every not-evaluated outcome a reason, and only those", () => {
    for (let i = 0; i < STORE.size; i++) {
      for (const o of evaluateChecks(STORE, i)) {
        if (o.result === "not_evaluated") expect(o.reason, `${STORE.symbols[i]} ${o.ruleId}`).not.toBeNull();
        else expect(o.reason, `${STORE.symbols[i]} ${o.ruleId}`).toBeNull();
      }
    }
  });

  it("a snapshot-only company cannot be evaluated on history-based rules", () => {
    const snap = outcomes("TINYSNAP");
    const pr01 = snap.find((o) => o.ruleId === "PR-01")!;
    expect(pr01).toMatchObject({ result: "not_evaluated", reason: "insufficient_history" });
    expect(pr01.message).toBe("ROCE · 5Y avg — (Not enough history); needs above 15%; not checked: Not enough history.");
    expect(snap.filter((o) => o.result === "met" || o.result === "not_met").length).toBeLessThan(5);
    // P/E and debt to equity come from the snapshot, so those two checks can still run.
    expect(snap.find((o) => o.ruleId === "BS-01")!.result).toBe("met");
  });

  it("TINYMFG, a steady manufacturer, passes its core checks and triggers no red flag", () => {
    expect(outcome("TINYMFG", "PR-01").result).toBe("met");
    expect(outcome("TINYMFG", "BS-01").result).toBe("met");
    expect(outcome("TINYMFG", "BS-02").result).toBe("met");
    expect(outcome("TINYMFG", "SR-01").result).toBe("met");
    expect(triggered("TINYMFG")).toEqual([]);
  });

  it("TINYLOSS shows its negative net worth, pledge and weak cover as red flags", () => {
    expect(triggered("TINYLOSS")).toEqual(expect.arrayContaining(["RF-03", "RF-04", "RF-06", "RF-07", "RF-09"]));
    const rf07 = outcome("TINYLOSS", "RF-07");
    expect(rf07.message).toMatch(/^Net worth -₹[\d,]+ Cr \(FY26\); needs below ₹0 Cr\.$/);
    expect(outcome("TINYLOSS", "BS-01")).toMatchObject({ result: "not_evaluated", reason: "negative_net_worth" });
    // A transition year inside the window makes 5-year figures not comparable.
    expect(outcome("TINYLOSS", "PR-01")).toMatchObject({ result: "not_evaluated", reason: "transition_period" });
  });

  it("a debt-free company passes the interest-cover check and does not trigger weak interest cover", () => {
    expect(STORE.get("interest_coverage", idx("TINYSOFT")).reason).toBe("no_interest_cost");
    const bs02 = outcome("TINYSOFT", "BS-02");
    expect(bs02.result).toBe("met");
    expect(bs02.message).toBe("Int. coverage: no interest cost, treated as passing; needs above 4x.");
    expect(outcome("TINYSOFT", "RF-06").result).toBe("not_met");
  });
});

describe("every red flag can be triggered (crafted fictional cases)", () => {
  for (const k of CRAFTED_CASES) {
    it(`${k.symbol} triggers ${k.flag}: ${k.note}`, () => {
      expect(triggered(k.symbol)).toContain(k.flag);
      // The base company does not trigger it, so the change is what fires the flag.
      expect(triggered(k.base)).not.toContain(k.flag);
    });
  }

  it("covers every red flag between the crafted cases, TINYLOSS and the sample", () => {
    const fired = new Set([...CRAFTED_CASES.map((k) => k.flag), ...triggered("TINYLOSS")]);
    for (const r of RED_FLAGS) if (!["RF-01"].includes(r.id)) expect(fired.has(r.id), r.id).toBe(true);
    // RF-01 (weak cash conversion) is triggered by the sample's rf_cash companies (sample.test.ts).
  });
});

describe("messages", () => {
  it("simple comparisons quote the value, its period and the threshold", () => {
    const i = idx("TINYMFG");
    const roce = formatMetric(STORE.def("roce_avg_5y")!, STORE.get("roce_avg_5y", i));
    expect(outcome("TINYMFG", "PR-01").message).toBe(`ROCE · 5Y avg ${roce} (FY22–FY26); needs above 15%.`);
    const de = formatMetric(STORE.def("debt_equity")!, STORE.get("debt_equity", i));
    expect(outcome("TINYMFG", "BS-01").message).toBe(`D/E ${de} (FY26); needs below 0.5x.`);
  });

  it("yearly rules list each year's value and the count of years met", () => {
    const m = outcome("FLAGTAX", "RF-08").message;
    expect(m).toBe(
      "Effective tax rate was below 10% in each of the last 3 financial years. Eff. tax rate by year: FY24 5.0%, FY25 5.0%, FY26 5.0%; met in 3 of 3 years.",
    );
    const exc = outcome("FLAGEXC", "RF-10").message;
    expect(exc).toContain("0.2 times");
    expect(exc).toContain("by year: FY24 ₹0 Cr against ₹33 Cr, FY25 ₹60 Cr against ₹42 Cr, FY26 ₹70 Cr against ₹47 Cr; met in 2 of 3 years.");
  });

  it("computed comparisons list the inputs they were built from", () => {
    const m = outcome("FLAGDIL", "RF-11").message;
    expect(m).toBe("Shares (YE) 11.00 Cr shares (FY26); needs above 1.05 * shares_outstanding_ye[prev]: 10.50 Cr shares. Based on Shares (YE) 10.00 Cr shares (FY25).");
    const lf = outcome("FLAGNPA", "LF-01").message;
    expect(lf).toMatch(/^GNPA \(latest FY\) minus GNPA \(previous financial year\) is above 1%; actual [\d.]+%\. Based on GNPA [\d.]+% \(FY26\) and GNPA [\d.]+% \(FY25\)\.$/);
  });

  it("OR rules explain each alternative with its own threshold", () => {
    const m = outcome("FLAGPLG", "RF-03").message;
    expect(m).toMatch(/^Either: Pledge 30\.00%; needs above 25%; or Pledge · change 1Y \+30\.00 pp; needs above \+5 pp\.$/);
  });

  it("AND rules explain every clause", () => {
    const m = outcome("FLAGREC", "RF-02").message;
    expect(m).toContain("Debtor days");
    expect(m).toContain("needs above 1.3 * debtor_days[fy-3]");
    expect(m).toContain("Based on Debtor days");
    expect(m).toContain("(FY23)");
    expect(m).toMatch(/Sales · 3Y CAGR [\d.]+% \(FY23–FY26\); needs below 10%\.$/);
  });

  it("peer comparisons name the peer group and its median", () => {
    const m = outcome("TINYMFG", "VA-01").message;
    expect(m).toMatch(/^P\/E [\d.]+x \(TTM\); needs below /);
  });

  it("ruleMessage matches the outcome message", () => {
    for (const r of CHECK_RULES) expect(ruleMessage(STORE, r, idx("FLAGTAX"))).toBe(outcome("FLAGTAX", r.id).message);
  });

  it("every message is one or more full sentences in plain text", () => {
    for (let i = 0; i < STORE.size; i++) {
      for (const o of evaluateChecks(STORE, i)) {
        expect(o.message, `${STORE.symbols[i]} ${o.ruleId}`).toMatch(/^[A-Z].*\.$/s);
        expect(o.message).not.toMatch(/NaN|undefined|null|Infinity|\[object/);
        expect(o.message).not.toMatch(/<[a-z]/i);
      }
    }
  });
});

describe("evidence", () => {
  it("lists the rule's evidence metrics with formatted values and periods", () => {
    const i = idx("TINYMFG");
    const pr01 = outcome("TINYMFG", "PR-01");
    expect(pr01.evidence.map((e) => e.metric)).toEqual(["roce_avg_5y", "roce"]);
    const [avg, latest] = pr01.evidence;
    expect(avg).toEqual({
      metric: "roce_avg_5y", label: "ROCE · 5Y avg", value: STORE.get("roce_avg_5y", i),
      display: formatMetric(STORE.def("roce_avg_5y")!, STORE.get("roce_avg_5y", i)), period: "FY22–FY26",
    });
    expect(latest.period).toBe("FY26");
    expect(outcome("TINYMFG", "GR-01").evidence[0].period).toBe("FY21–FY26"); // a 5-year CAGR spans 6 year-ends
    expect(outcome("TINYMFG", "VA-01").evidence[0].period).toBe("TTM to Jun 2026");
    expect(outcome("TINYMFG", "RF-04").evidence[0].period).toBe("1Y change to Q1 FY27");
    expect(outcome("TINYMFG", "RF-04").evidence[1].period).toBe("Q1 FY27");
    expect(outcome("TINYMFG", "SR-01").evidence[0].period).toBeNull(); // latest-only, no period
  });

  it("shows the reason in place of a missing value", () => {
    const e = outcome("TINYSNAP", "PR-01").evidence[0];
    expect(e.value).toEqual({ v: null, reason: "insufficient_history", flags: 0 });
    expect(e.display).toBe("Not enough history");
    const bank = outcome("TINYBANK", "RF-07").evidence[0];
    expect(bank.value.v).not.toBeNull();
  });

  it("evidencePeriod handles previous-year and quarterly metrics", () => {
    const i = idx("TINYMFG");
    expect(evidencePeriod(STORE.def("roce_prev")!, STORE, i)).toBe("FY25");
    expect(evidencePeriod(STORE.def("q_sales")!, STORE, i)).toBe("Q1 FY27");
    expect(evidencePeriod(STORE.def("cum_cfo_to_pat_5y")!, STORE, i)).toBe("FY22–FY26");
    expect(evidencePeriod(STORE.def("promoter_holding")!, STORE, idx("TINYSNAP"))).toBeNull();
  });
});

describe("ruleResult and outcomeFor", () => {
  it("agree with evaluateChecks", () => {
    const i = idx("FLAGOTH");
    for (const r of CHECK_RULES) {
      const o = outcomeFor(STORE, r, i);
      expect(o).toEqual(outcome("FLAGOTH", r.id));
      expect(ruleResult(STORE, r, i)).toEqual({ result: o.result, reason: o.reason });
    }
  });
});

describe("summaries", () => {
  it("groups applicable checks by area in display order, leaving red flags out", () => {
    const s = summariseAreas(STORE, idx("TINYMFG"));
    expect(s.map((a) => a.area)).toEqual(["profitability", "growth", "balance_sheet", "cash_conversion", "valuation", "shareholder_returns"]);
    for (const a of s) {
      expect(a.outcomes.every((o) => o.kind === "check" && o.area === a.area && o.result !== "not_applicable")).toBe(true);
      expect(a.total).toBe(a.outcomes.length);
      expect(a.met).toBe(a.outcomes.filter((o) => o.result === "met").length);
      expect(a.evaluated).toBe(a.outcomes.filter((o) => o.result !== "not_evaluated").length);
      expect(a.met).toBeLessThanOrEqual(a.evaluated);
    }
    expect(s[0].label).toBe("Profitability");
    expect(s.find((a) => a.area === "balance_sheet")!.label).toBe("Balance-sheet strength");
  });

  it("gives lenders their own areas", () => {
    const s = summariseAreas(STORE, idx("TINYBANK"));
    expect(s.map((a) => a.area)).toEqual(["profitability", "shareholder_returns", "asset_quality", "efficiency"]);
    expect(s.find((a) => a.area === "profitability")!.outcomes.map((o) => o.ruleId)).toEqual(["LP-01", "LP-02"]);
  });

  it("counts not-evaluated checks in the total but not in evaluated", () => {
    const s = summariseAreas(STORE, idx("TINYSNAP"));
    const prof = s.find((a) => a.area === "profitability")!;
    expect(prof).toMatchObject({ met: 0, evaluated: 0, total: 4 });
  });

  it("summariseOutcomes ignores an empty list", () => {
    expect(summariseOutcomes([])).toEqual([]);
  });

  it("summariseRedFlags lists triggered flags first and counts them", () => {
    const s = summariseRedFlags(STORE, idx("TINYLOSS"));
    expect(s.triggered).toBe(5);
    expect(s.total).toBe(RED_FLAGS.filter((r) => r.appliesTo.includes("non_financial")).length);
    expect(s.outcomes.slice(0, 5).every((o) => o.result === "met")).toBe(true);
    expect(s.outcomes.every((o) => o.kind === "red_flag")).toBe(true);
    const bank = summariseRedFlags(STORE, idx("FLAGBPLG"));
    expect(bank.triggered).toBe(2);
    expect(bank.total).toBe(10);
    expect(bank.evaluated).toBeLessThanOrEqual(bank.total);
  });
});

describe("red_flag_count provider", () => {
  it("is registered by the insights module and served by the engine's store", () => {
    expect(insightColumnProviders.map((p) => [...p.ids])).toEqual([["red_flag_count"]]);
    const col = STORE.column("red_flag_count");
    expect(col.id).toBe("red_flag_count");
    expect(STORE.get("red_flag_count", idx("TINYLOSS"))).toEqual({ v: 5, reason: null, flags: 0 });
    expect(STORE.get("red_flag_count", idx("FLAGBPLG")).v).toBe(2);
    expect(STORE.get("red_flag_count", idx("TINYMFG")).v).toBe(0);
  });

  it("equals the number of triggered red flags from evaluateChecks", () => {
    for (let i = 0; i < STORE.size; i++) {
      const list: CheckOutcome[] = evaluateChecks(STORE, i).filter((o) => o.kind === "red_flag");
      const met = list.filter((o) => o.result === "met").length;
      const notEvaluated = list.filter((o) => o.result === "not_evaluated").length;
      const v = STORE.get("red_flag_count", i);
      if (notEvaluated > RED_FLAG_MAX_NOT_EVALUATED) expect(v, STORE.symbols[i]).toEqual({ v: null, reason: "too_few_inputs", flags: 0 });
      else expect(v, STORE.symbols[i]).toEqual({ v: met, reason: null, flags: 0 });
    }
  });

  it("is null (too few inputs) for a snapshot-only company rather than a clean 0", () => {
    expect(RED_FLAG_MAX_NOT_EVALUATED).toBe(4);
    const v = STORE.get("red_flag_count", idx("TINYSNAP"));
    expect(v.v).toBeNull();
    expect(v.reason).toBe("too_few_inputs");
  });

  it("computeRedFlagCount gives the same column under any id, and works on a store built without the provider", () => {
    const plain = createMetricStore(craftedDataset(), { providers: [] });
    const col = computeRedFlagCount(plain, "x_flags");
    expect(col.id).toBe("x_flags");
    expect(Array.from(col.reasons)).toEqual(Array.from(STORE.column("red_flag_count").reasons));
    const tfi = NULL_REASONS.indexOf("too_few_inputs");
    for (let i = 0; i < plain.size; i++) {
      if (col.reasons[i] === tfi) expect(Number.isNaN(col.values[i])).toBe(true);
      else expect(col.values[i]).toBe(STORE.column("red_flag_count").values[i]);
    }
    expect(plain.get("red_flag_count", 0).reason).toBe("missing_input"); // no provider registered there
  });

  it("can be screened with FSQL through the engine", async () => {
    const { compileQuery, evaluateQuery } = await import("@/lib/query");
    const q = compileQuery("red_flag_count >= 1", STORE);
    expect(q.ok).toBe(true);
    const ev = evaluateQuery(q, STORE, Int32Array.from({ length: STORE.size }, (_, i) => i));
    const matched = STORE.symbols.filter((_, i) => ev.whereTri[i] === 1);
    expect(matched).toEqual(expect.arrayContaining(["TINYLOSS", ...CRAFTED_CASES.map((k) => k.symbol)]));
    expect(matched).not.toContain("TINYMFG");
    expect(matched).not.toContain("TINYSNAP");
  });
});

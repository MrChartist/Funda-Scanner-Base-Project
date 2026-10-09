// src/lib/insights/rules.test.ts — static properties of the §C.9 rule set: the exact queries, ids,
// families, catalogue references, sections and copy. Compilation runs on the real FSQL engine.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Area, CheckRule, MetricStore, TypeFamily } from "@/lib/contracts";
import { COMPANY_SECTION_IDS } from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { GLOSSARY } from "@/lib/learn";
import { allMetricDefs } from "@/lib/metrics";
import { compileQuery } from "@/lib/query";
import { generateSampleDataset } from "@/lib/sample";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { forbiddenWordHits } from "@/test/fixtures/sample/forbidden-words";
import {
  AREA_LABELS, AREA_ORDER, CHECK_RULES, INSIGHTS_FOOTER, LENDER_CHECKS, NONFIN_CHECKS, RED_FLAG_HEADING, RED_FLAGS,
} from "./index";

const NF: TypeFamily[] = ["non_financial"];
const ALL: TypeFamily[] = ["non_financial", "lender", "insurance"];
const L: TypeFamily[] = ["lender"];

/** The §C.9 tables, verbatim: id → [kind, area, appliesTo, title or null, query]. */
const SPEC: Readonly<Record<string, [CheckRule["kind"], Area, TypeFamily[], string | null, string]>> = {
  "PR-01": ["check", "profitability", NF, "Earns well on its capital", "roce_avg_5y > 15"],
  "PR-02": ["check", "profitability", NF, "Return held up every year", "every(roce > 12, 5y)"],
  "PR-03": ["check", "profitability", NF, "Margin is steady", "opm_stdev_5y < 4"],
  "PR-04": ["check", "profitability", NF, "Margin not falling", "opm >= opm_avg_5y - 1"],
  "GR-01": ["check", "growth", NF, "Sales compounding", "sales_cagr_5y > 10"],
  "GR-02": ["check", "growth", NF, "Profit compounding", "net_profit_cagr_5y > 10"],
  "GR-03": ["check", "growth", NF, "Grew in most years", "count(sales_growth > 0, 5y) >= 4"],
  "GR-04": ["check", "growth", NF, "Growth not diluted", "eps_cagr_5y >= net_profit_cagr_5y - 2"],
  "BS-01": ["check", "balance_sheet", NF, "Modest borrowing", "debt_equity < 0.5"],
  "BS-02": ["check", "balance_sheet", NF, "Interest well covered", "interest_coverage > 4"],
  "BS-03": ["check", "balance_sheet", NF, "Short-term bills covered", "current_ratio > 1.2"],
  "BS-04": ["check", "balance_sheet", NF, "Outside the distress zone", "altman_z > 2.6"],
  "CC-01": ["check", "cash_conversion", NF, "Profit backed by cash", "cum_cfo_to_pat_5y > 0.8"],
  "CC-02": ["check", "cash_conversion", NF, "Positive free cash in most years", "count(fcf > 0, 5y) >= 3"],
  "CC-03": ["check", "cash_conversion", NF, "Low accruals", "accruals_ratio < 5"],
  "CC-04": ["check", "cash_conversion", NF, "Collections not slowing", "debtor_days <= 1.2 * debtor_days[fy-3]"],
  "VA-01": ["check", "valuation", NF, "P/E below industry median", "pe < industry_median(pe)"],
  "VA-02": ["check", "valuation", NF, "Earnings yield above industry median", "earnings_yield > industry_median(earnings_yield)"],
  "VA-03": ["check", "valuation", NF, "Reasonable FCF yield", "fcf_yield_3y > 3"],
  "SR-01": ["check", "shareholder_returns", ALL, "Dividend paid 5 years in a row", "dividend_streak >= 5"],
  "SR-02": ["check", "shareholder_returns", ALL, "Shares part of profit", "dividend_payout_avg_3y >= 15"],
  "SR-03": ["check", "shareholder_returns", ALL, "Book value per share compounding", "bvps_cagr_5y > 10"],
  "LP-01": ["check", "profitability", L, null, "roa_avg_3y > 1"],
  "LP-02": ["check", "profitability", L, null, "roe_avg_3y > 12"],
  "AQ-01": ["check", "asset_quality", L, null, "gnpa_ratio < 4"],
  "AQ-02": ["check", "asset_quality", L, null, "nnpa_ratio < 1.5"],
  "AQ-03": ["check", "asset_quality", L, null, "provision_coverage > 60"],
  "EF-01": ["check", "efficiency", L, null, "cost_to_income < 50"],
  "EF-02": ["check", "efficiency", L, null, "credit_cost < 1.5"],
  "RF-01": ["red_flag", "cash_conversion", NF, "Profit not backed by cash", "cum_cfo_to_pat_5y < 0.7"],
  "RF-02": ["red_flag", "cash_conversion", NF, "Receivables rising faster than sales", "debtor_days > 1.3 * debtor_days[fy-3] AND sales_cagr_3y < 10"],
  "RF-03": ["red_flag", "shareholder_returns", ALL, "High or rising pledge", "pledged_pct > 25 OR pledged_pct_chg_1y > 5"],
  "RF-04": ["red_flag", "shareholder_returns", ALL, "Promoters cut stake sharply", "promoter_holding_chg_1y < -5"],
  "RF-05": ["red_flag", "profitability", NF, "Large other income", "other_income_to_pbt > 30"],
  "RF-06": ["red_flag", "balance_sheet", NF, "Weak interest cover", "interest_coverage < 1.5"],
  "RF-07": ["red_flag", "balance_sheet", ALL, "Negative net worth", "net_worth < 0"],
  "RF-08": ["red_flag", "profitability", ALL, "Persistently low tax", "every(effective_tax_rate < 10, 3y)"],
  "RF-09": ["red_flag", "balance_sheet", NF, "Distress zone", "altman_z < 1.1"],
  "RF-10": ["red_flag", "profitability", ALL, "Repeated exceptional items", "count(abs(exceptional_items) > 0.2 * abs(pbt), 3y) >= 2"],
  "RF-11": ["red_flag", "shareholder_returns", ALL, "Equity dilution", "shares_outstanding_ye > 1.05 * shares_outstanding_ye[prev]"],
  "RF-12": ["red_flag", "cash_conversion", NF, "Inventory building up", "inventory_days > 1.3 * inventory_days[fy-3] AND sales_cagr_3y < 10"],
  "LF-01": ["red_flag", "asset_quality", L, "Bad loans rising", "gnpa_ratio - gnpa_ratio[prev] > 1"],
  "LF-02": ["red_flag", "asset_quality", L, "Thin provisions", "provision_coverage < 50"],
  "LF-03": ["red_flag", "asset_quality", L, "High credit cost", "credit_cost > 2.5"],
  "LF-04": ["red_flag", "shareholder_returns", L, "High pledge (lenders)", "pledged_pct > 25"],
};

const CATALOGUE_IDS = new Set(allMetricDefs().map((d) => d.id));
const SAMPLE_STORE: MetricStore = createStore(generateSampleDataset());
const TINY_STORE: MetricStore = createStore(createTinyDataset());

/** Numbers written in a query: thresholds, multipliers, window lengths and selector offsets. */
function numbersIn(query: string): string[] {
  return [...query.matchAll(/(?<![a-z_])\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

describe("the §C.9 rule set", () => {
  it("has exactly the ids, kinds, areas, families, titles and queries of the specification", () => {
    expect(CHECK_RULES.map((r) => r.id)).toEqual(Object.keys(SPEC));
    for (const r of CHECK_RULES) {
      const [kind, area, appliesTo, title, query] = SPEC[r.id];
      expect({ kind: r.kind, area: r.area, appliesTo: [...r.appliesTo], query: r.query }, r.id).toEqual({ kind, area, appliesTo, query });
      if (title) expect(r.title, r.id).toBe(title);
    }
  });

  it("splits into 22 general checks, 7 lender checks and 16 red flags", () => {
    // §C.9 says "26 checks (19 non-financial and 7 lender)", but its table lists 19 non-financial,
    // 3 shareholder-return checks for every family and 7 lender checks; the table is implemented.
    expect(NONFIN_CHECKS).toHaveLength(22);
    expect(NONFIN_CHECKS.filter((r) => r.appliesTo.length === 1 && r.appliesTo[0] === "non_financial")).toHaveLength(19);
    expect(LENDER_CHECKS).toHaveLength(7);
    expect(RED_FLAGS).toHaveLength(16);
    expect(CHECK_RULES.filter((r) => r.kind === "check")).toHaveLength(29);
    expect(RED_FLAGS.every((r) => r.kind === "red_flag")).toBe(true);
    expect([...NONFIN_CHECKS, ...LENDER_CHECKS].every((r) => r.kind === "check")).toBe(true);
  });

  it("ids are unique and well-formed", () => {
    const ids = CHECK_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^(PR|GR|BS|CC|VA|SR|LP|AQ|EF|RF|LF)-\d{2}$/);
  });

  it("every rule compiles with no errors on the sample and on the tiny fixture", () => {
    for (const store of [SAMPLE_STORE, TINY_STORE]) {
      for (const r of CHECK_RULES) {
        const q = compileQuery(r.query, store);
        expect(q.issues.filter((x) => x.level === "error"), `${r.id}: ${r.query}`).toEqual([]);
        expect(q.ok, r.id).toBe(true);
        expect(q.sort, r.id).toEqual([]);
        expect(q.limit, r.id).toBeNull();
      }
    }
  });

  it("references only catalogue ids, never red_flag_count, and never uses coalesce", () => {
    for (const r of CHECK_RULES) {
      const q = compileQuery(r.query, SAMPLE_STORE);
      expect(q.metrics.length, r.id).toBeGreaterThan(0);
      for (const id of q.metrics) expect(CATALOGUE_IDS.has(id), `${r.id} uses ${id}`).toBe(true);
      expect(q.metrics, r.id).not.toContain("red_flag_count");
      expect(r.query, r.id).not.toMatch(/red_flag_count/);
      expect(r.query, r.id).not.toMatch(/coalesce/i);
      // The canonical form uses ids and explicit AND, so the visible query is already canonical.
      expect(q.canonical, r.id).toBe(r.query);
    }
  });

  it("evidence and learning links are catalogue ids; each rule links to at least one glossary entry", () => {
    for (const r of CHECK_RULES) {
      expect(r.evidence.length, r.id).toBeGreaterThan(0);
      for (const id of r.evidence) expect(CATALOGUE_IDS.has(id), `${r.id} evidence ${id}`).toBe(true);
      expect(r.evidence, r.id).not.toContain("red_flag_count");
      expect(r.learn.length, r.id).toBeGreaterThan(0);
      for (const id of r.learn) expect(CATALOGUE_IDS.has(id), `${r.id} learn ${id}`).toBe(true);
      expect(r.learn.some((id) => GLOSSARY[id] !== undefined), `${r.id} has no glossary link`).toBe(true);
    }
  });

  it("the first evidence metric is the one the rule tests", () => {
    for (const r of CHECK_RULES) {
      const q = compileQuery(r.query, SAMPLE_STORE);
      expect(q.metrics, r.id).toContain(r.evidence[0]);
    }
  });

  it("points at a company-page section that exists", () => {
    for (const r of CHECK_RULES) expect(COMPANY_SECTION_IDS, r.id).toContain(r.section);
  });

  it("applies lender rules only to lenders and never to insurers alone", () => {
    for (const r of CHECK_RULES) {
      expect(r.appliesTo.length, r.id).toBeGreaterThan(0);
      if (/^(LP|AQ|EF|LF)-/.test(r.id)) expect([...r.appliesTo], r.id).toEqual(["lender"]);
      if (/^(PR|GR|BS|CC|VA)-/.test(r.id)) expect([...r.appliesTo], r.id).toEqual(["non_financial"]);
    }
  });

  it("the plain-English test names every number in the query", () => {
    for (const r of CHECK_RULES) {
      for (const n of numbersIn(r.query)) {
        expect(r.test, `${r.id}: "${r.test}" does not mention ${n}`).toMatch(new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?![\\d])`));
      }
    }
  });

  it("titles and tests are short, formal and free of forbidden words", () => {
    for (const r of CHECK_RULES) {
      expect(r.title.length, r.id).toBeLessThanOrEqual(45);
      expect(r.title, r.id).toMatch(/^[A-Z]/);
      expect(r.test, r.id).toMatch(/^[A-Z]/);
      expect(r.test, r.id).not.toMatch(/\.$/);
      expect(forbiddenWordHits(`${r.title} ${r.test}`), r.id).toEqual([]);
      expect(r.title, r.id).not.toMatch(/!/);
    }
    for (const text of [INSIGHTS_FOOTER, RED_FLAG_HEADING, ...Object.values(AREA_LABELS)]) expect(forbiddenWordHits(text)).toEqual([]);
  });

  it("every area used by a rule has a label and a place in the display order", () => {
    const areas = new Set(CHECK_RULES.map((r) => r.area));
    for (const a of areas) {
      expect(AREA_ORDER, a).toContain(a);
      expect(AREA_LABELS[a], a).toBeTruthy();
    }
    expect(AREA_LABELS.balance_sheet).toBe("Balance-sheet strength");
    expect(new Set(AREA_ORDER).size).toBe(AREA_ORDER.length);
  });

  it("carries the footer and heading copy of §F.6 and §C.9", () => {
    expect(INSIGHTS_FOOTER).toBe("Rule-based observations on the data you loaded. Not a recommendation.");
    expect(RED_FLAG_HEADING).toBe("Worth checking");
  });

  it("rule objects are immutable data (no functions) so they can be shown and exported as text", () => {
    for (const r of CHECK_RULES) {
      expect(JSON.parse(JSON.stringify(r)), r.id).toEqual({ ...r, appliesTo: [...r.appliesTo], evidence: [...r.evidence], learn: [...r.learn] });
    }
  });

  it("docs/methodology.md lists every rule with its title and query", () => {
    const doc = readFileSync(resolve(process.cwd(), "docs/methodology.md"), "utf8");
    for (const r of CHECK_RULES) {
      const row = doc.split("\n").find((line) => line.includes(`| ${r.id} |`));
      expect(row, r.id).toBeDefined();
      expect(row, r.id).toContain(`| ${r.title} |`);
      expect(row, r.id).toContain(`\`${r.query}\``);
    }
    expect(doc).toContain(INSIGHTS_FOOTER.split(" Not a")[0]);
    expect(forbiddenWordHits(doc.slice(doc.indexOf("## 3. Checks and red flags")))).toEqual([]);
  });
});

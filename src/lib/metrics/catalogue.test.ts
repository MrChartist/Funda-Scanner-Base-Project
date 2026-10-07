import { describe, expect, it } from "vitest";
import {
  ANNUAL_FIELD_INFO, QUARTER_FIELD_INFO, SHAREHOLDING_FIELD_INFO, VARIANTS, type BaseMetricDef, type MetricDef,
} from "@/lib/contracts";
import { BASE_METRICS, CATALOGUE_VERSION, CURATED_METRIC_COUNT, CURATED_METRICS, LINE_ITEM_METRICS, baseMetric } from "./catalogue";
import {
  ALL_METRIC_DEFS, RESERVED_ALIAS_WORDS, VARIANT_RULES, basePhrases, buildMetricDefs, makeVariantDef, metricDef,
  normalisePhrase, variantAllowed, variantAliases,
} from "./variants";

const SNAKE = /^[a-z][a-z0-9_]*$/;

function curated(id: string): BaseMetricDef {
  const d = CURATED_METRICS.find((m) => m.id === id);
  if (!d) throw new Error(`missing ${id}`);
  return d;
}

describe("curated catalogue (§C.3)", () => {
  it("has exactly 92 curated base metrics with unique snake_case ids", () => {
    expect(CURATED_METRICS).toHaveLength(92);
    expect(CURATED_METRIC_COUNT).toBe(92);
    const ids = CURATED_METRICS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SNAKE);
  });

  it("has the documented number of metrics per category", () => {
    const count = (pred: (d: BaseMetricDef) => boolean) => CURATED_METRICS.filter(pred).length;
    expect(count((d) => d.category === "Size")).toBe(11);
    expect(count((d) => d.category === "Valuation")).toBe(10);
    expect(count((d) => d.category === "Profitability")).toBe(9);
    expect(count((d) => d.category === "Efficiency")).toBe(7);
    expect(count((d) => d.category === "Leverage & Liquidity")).toBe(9);
    expect(count((d) => d.category === "Growth")).toBe(7);
    expect(count((d) => d.category === "Line items")).toBe(4); // quarterly results
    expect(count((d) => d.category === "Cash Flow")).toBe(9);
    expect(count((d) => d.category === "Shareholding")).toBe(6);
    expect(count((d) => d.category === "Dividend" || d.category === "Per Share")).toBe(6);
    expect(count((d) => d.category === "Banking & NBFC")).toBe(9);
    expect(count((d) => d.category === "Scores & Checks" || d.category === "Data")).toBe(5);
  });

  it("transcribes representative rows exactly", () => {
    const roce = curated("roce");
    expect(roce).toMatchObject({
      label: "Return on capital employed", short: "ROCE", unit: "pct", decimals: 1, direction: "higher", level: "basic",
      appliesTo: ["non_financial"], history: "annual", ttm: false,
      variants: ["prev", "avg_3y", "avg_5y", "avg_10y", "min_5y"], rawField: null, periodTag: "FY",
    });
    expect(curated("pe")).toMatchObject({ unit: "x", decimals: 1, direction: "lower", appliesTo: ["non_financial", "lender", "insurance"], history: "latest_only", periodTag: "TTM" });
    expect(curated("sales")).toMatchObject({ unit: "inr_cr", decimals: 0, ttm: true, growthable: true, rawField: "revenue", variants: ["prev", "ttm", "cagr_3y", "cagr_5y", "cagr_10y"] });
    expect(curated("net_profit").variants).toEqual(["prev", "ttm", "cagr_3y", "cagr_5y", "cagr_10y", "cum_5y"]);
    expect(curated("peg").appliesTo).toEqual(["non_financial", "lender"]);
    expect(curated("nii").appliesTo).toEqual(["lender"]);
    expect(curated("promoter_holding")).toMatchObject({ history: "shareholding", rawField: "promoter_pct", variants: ["prev", "chg_1q", "chg_1y", "chg_3y"] });
    expect(curated("q_opm_change_yoy")).toMatchObject({ unit: "pp", history: "quarterly", appliesTo: ["non_financial"] });
    expect(curated("dividend_streak")).toMatchObject({ unit: "years", decimals: 0, history: "latest_only" });
    expect(curated("latest_fy")).toMatchObject({ unit: "fy_year", category: "Data" });
    expect(curated("piotroski_f")).toMatchObject({ unit: "score", isScore: true, category: "Scores & Checks" });
    expect(curated("altman_z")).toMatchObject({ decimals: 2, isScore: true });
    expect(curated("red_flag_count")).toMatchObject({ unit: "count", direction: "lower", isScore: false });
    expect(curated("cfo_to_ebitda")).toMatchObject({ unit: "pct", decimals: 0 });
    expect(curated("opm").variants).toContain("stdev_5y");
    expect(curated("cfo").variants).toEqual(["prev", "cum_3y", "cum_5y", "cum_10y"]);
  });

  it("keeps rawField on curated entries that replace generated line items", () => {
    expect(curated("sales").rawField).toBe("revenue");
    expect(curated("dps").rawField).toBe("dividend_per_share");
    expect(curated("cfo").rawField).toBe("cfo");
    expect(curated("capex").rawField).toBe("capex");
    expect(curated("q_sales").rawField).toBe("revenue");
    expect(curated("pledged_pct").rawField).toBe("promoter_pledged_pct");
    expect(curated("fii_holding").rawField).toBe("fii_pct");
    expect(curated("dii_holding").rawField).toBe("dii_pct");
  });

  it("has tooltips of at most 120 characters, formulas and null rules on every base metric", () => {
    for (const d of BASE_METRICS) {
      expect(d.tooltip.length, d.id).toBeGreaterThan(0);
      expect(d.tooltip.length, d.id).toBeLessThanOrEqual(120);
      expect(d.formula.length, d.id).toBeGreaterThan(0);
      expect(d.nullRules.length, d.id).toBeGreaterThan(0);
      expect(Number.isInteger(d.decimals) && d.decimals >= 0 && d.decimals <= 4, d.id).toBe(true);
    }
  });

  it("expands null codes into readable text and notes applicability", () => {
    expect(curated("pe").nullRules).toBe("Loss-making (≤ 0), Price not provided.");
    expect(curated("roce").nullRules).toBe("Not meaningful (avg CE ≤ 0). Not applicable to banks, NBFCs and insurers.");
    expect(curated("gnpa_ratio").nullRules).toContain("Applies only to banks and NBFCs.");
    for (const d of BASE_METRICS) expect(d.nullRules, d.id).not.toMatch(/\b(MI|NPD|NNW|LM|IH|EVN|NIC|TP|NP|TFI|TFP)\b/);
  });

  it("puts every basic-level metric in a named category with a short label", () => {
    const basic = CURATED_METRICS.filter((d) => d.level === "basic");
    expect(basic.length).toBe(25); // the glossary covers these 25 (§A.3)
    for (const d of basic) expect(d.short.length).toBeGreaterThan(0);
  });

  it("has a version string", () => {
    expect(CATALOGUE_VERSION).toMatch(/\S/);
  });
});

describe("generated line items (§C.4)", () => {
  const allInfo = [
    ...Object.entries(ANNUAL_FIELD_INFO).map(([f, i]) => ({ f, i, history: "annual" })),
    ...Object.entries(QUARTER_FIELD_INFO).map(([f, i]) => ({ f, i, history: "quarterly" })),
    ...Object.entries(SHAREHOLDING_FIELD_INFO).map(([f, i]) => ({ f, i, history: "shareholding" })),
  ];

  it("exposes every FieldInfo.metricId as a base metric", () => {
    for (const { i } of allInfo) expect(baseMetric(i.metricId), i.metricId).toBeDefined();
  });

  it("generates 37 line items (46 fields minus the 9 curated overlaps)", () => {
    expect(allInfo).toHaveLength(46);
    expect(LINE_ITEM_METRICS).toHaveLength(37);
    expect(BASE_METRICS).toHaveLength(129);
  });

  it("gives each generated line item the Line items category, advanced level, its history and prev", () => {
    for (const { f, i, history } of allInfo) {
      const d = baseMetric(i.metricId);
      if (!d || CURATED_METRICS.includes(d)) continue;
      expect(d.category).toBe("Line items");
      expect(d.level).toBe("advanced");
      expect(d.history).toBe(history);
      expect(d.variants).toEqual(["prev"]);
      expect(d.rawField).toBe(f);
      const expected = i.appliesTo === "all" ? ["non_financial", "lender", "insurance"] : i.appliesTo === "lender" ? ["lender"] : ["non_financial"];
      expect(d.appliesTo).toEqual(expected);
    }
  });

  it("maps field units and keeps ₹ crore at 0 decimals", () => {
    expect(baseMetric("total_assets")).toMatchObject({ unit: "inr_cr", decimals: 0, label: "Total assets", short: "Total assets" });
    expect(baseMetric("shares_outstanding_ye")).toMatchObject({ unit: "crore_shares" });
    expect(baseMetric("num_shareholders")).toMatchObject({ unit: "count", history: "shareholding" });
    expect(baseMetric("advances")).toMatchObject({ appliesTo: ["lender"] });
    expect(baseMetric("pat")).toMatchObject({ short: "PAT", rawField: "net_profit" });
  });

  it("notes the zero-default assumption on the five ZERO_DEFAULT_FIELDS", () => {
    expect(baseMetric("lease_liabilities")?.nullRules).toContain("treat it as 0");
    expect(baseMetric("total_assets")?.nullRules).not.toContain("treat it as 0");
  });
});

describe("variants (§C.5)", () => {
  it("generates `${base}_${variant}` ids that are unique, snake_case and resolvable", () => {
    const ids = ALL_METRIC_DEFS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(SNAKE);
    for (const id of ["roce_avg_5y", "sales_cagr_5y", "net_profit_cagr_5y", "cfo_cum_5y", "promoter_holding_chg_1y", "dividend_payout_avg_3y", "opm_stdev_5y", "eps_ttm", "roe_min_5y"]) {
      expect(metricDef(id), id).toBeDefined();
    }
  });

  it("never collides a variant id with a base id", () => {
    const baseIds = new Set(BASE_METRICS.map((d) => d.id));
    for (const d of ALL_METRIC_DEFS) if (d.variant) expect(baseIds.has(d.id), d.id).toBe(false);
  });

  it("covers every Variant in VARIANT_RULES", () => {
    expect(Object.keys(VARIANT_RULES).sort()).toEqual([...VARIANTS].sort());
  });

  it("allows each variant only where §C.5 says", () => {
    for (const base of BASE_METRICS) for (const v of base.variants) expect(variantAllowed(base, v), `${base.id}_${v}`).toBe(true);
    expect(variantAllowed(curated("roce"), "cagr_5y")).toBe(false); // ratios are not growthable
    expect(variantAllowed(curated("pe"), "prev")).toBe(false); // latest only
    expect(variantAllowed(curated("roce"), "ttm")).toBe(false);
    expect(variantAllowed(curated("roce"), "chg_1y")).toBe(false);
    expect(variantAllowed(curated("promoter_holding"), "chg_1y")).toBe(true);
    expect(() => buildMetricDefs([{ ...curated("roce"), variants: ["ttm"] }])).toThrow(/not allowed/);
  });

  it("derives label, unit, direction, history and expansion from the base", () => {
    const avg = metricDef("roce_avg_5y") as MetricDef;
    expect(avg).toMatchObject({
      base: "roce", variant: "avg_5y", label: "Return on capital employed · 5Y avg", short: "ROCE · 5Y avg",
      unit: "pct", direction: "higher", history: "annual", expandsTo: "avg(roce, 5y)", periodTag: "5Y",
    });
    expect(metricDef("opm_stdev_5y")).toMatchObject({ unit: "pp", direction: "lower", expandsTo: "stdev(opm, 5y)", label: "Operating profit margin · 5Y std dev" });
    expect(metricDef("sales_cagr_5y")).toMatchObject({ unit: "pct", direction: "higher", decimals: 1, expandsTo: "cagr(sales, 5y)", label: "Sales · 5Y CAGR" });
    expect(metricDef("cfo_cum_5y")).toMatchObject({ unit: "inr_cr", expandsTo: "sum(cfo, 5y)", label: "Cash from operations · 5Y total" });
    expect(metricDef("sales_ttm")).toMatchObject({ history: "latest_only", expandsTo: "sales[ttm]", label: "Sales · TTM", periodTag: "TTM" });
    expect(metricDef("sales_prev")).toMatchObject({ history: "annual", expandsTo: "sales[prev]", label: "Sales · prev FY" });
    expect(metricDef("q_sales_prev")).toMatchObject({ history: "quarterly", label: "Quarterly sales · prev qtr" });
    expect(metricDef("promoter_holding_chg_1y")).toMatchObject({ unit: "pp", history: "shareholding", expandsTo: "promoter_holding - promoter_holding[q-4]", label: "Promoter holding · change 1Y" });
    expect(metricDef("promoter_holding_chg_3y")?.expandsTo).toBe("promoter_holding - promoter_holding[q-12]");
    expect(metricDef("promoter_holding_chg_1q")?.expandsTo).toBe("promoter_holding - promoter_holding[q-1]");
    expect(metricDef("dps_cagr_5y")?.unit).toBe("pct");
    const base = metricDef("roce") as MetricDef;
    expect(base).toMatchObject({ base: "roce", variant: null, expandsTo: null });
  });

  it("generates the alias forms B F / F B and B W F / B F W / F B W", () => {
    const roce = curated("roce");
    const avg = variantAliases(roce, "avg_5y");
    expect(avg).toEqual(expect.arrayContaining(["roce 5y avg", "roce avg 5y", "avg roce 5y", "return on capital employed 5y avg"]));
    expect(variantAliases(roce, "prev")).toEqual(expect.arrayContaining(["roce prev", "prev roce", "roce prev year"]));
    expect(variantAliases(curated("q_sales"), "prev")).toEqual(expect.arrayContaining(["q sales prev quarter", "quarterly sales prev"]));
    expect(variantAliases(curated("sales"), "ttm")).toEqual(expect.arrayContaining(["sales ttm", "ttm sales"]));
    expect(variantAliases(curated("cfo"), "cum_5y")).toEqual(expect.arrayContaining(["cfo 5y total", "total cfo 5y", "cfo sum 5y"]));
    expect(variantAliases(curated("promoter_holding"), "chg_1y")).toEqual(expect.arrayContaining(["promoter holding 1y change", "promoter chg 1y"]));
  });

  it("generates no Screener-style idioms", () => {
    const all = ALL_METRIC_DEFS.flatMap((d) => d.aliases);
    for (const a of all) {
      expect(a, a).not.toMatch(/\bpreceding\b|\byears back\b|\blast year\b/);
    }
    expect(all).not.toContain("sales growth 5y");
  });

  it("normalises phrases the way the resolver does", () => {
    expect(normalisePhrase("Average ROCE 5 years")).toBe("avg roce 5y");
    expect(normalisePhrase("P/E")).toBe("pe");
    expect(normalisePhrase("Previous   Sales")).toBe("prev sales");
    expect(basePhrases(baseMetric("cash_and_bank") as BaseMetricDef)).toEqual(["cash"]); // label and id contain "and"
  });
});

describe("aliases: keywords and collisions (§D.4 step 8)", () => {
  it("no alias contains a reserved word", () => {
    for (const d of ALL_METRIC_DEFS) {
      for (const a of [...d.aliases, d.short]) {
        const words = normalisePhrase(a).split(" ");
        for (const w of RESERVED_ALIAS_WORDS) expect(words.includes(w), `${d.id}: "${a}"`).toBe(false);
      }
    }
  });

  it("no two definitions share a label, short, alias or id phrase after normalisation", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const d of ALL_METRIC_DEFS) {
      const phrases = new Set([d.label, d.short, ...d.aliases, d.id.replace(/_/g, " ")].map(normalisePhrase));
      for (const p of phrases) {
        if (!p) continue;
        const prev = owner.get(p);
        if (prev && prev !== d.id) clashes.push(`"${p}": ${prev} / ${d.id}`);
        else owner.set(p, d.id);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("variant definitions carry only generated aliases", () => {
    const def = makeVariantDef(curated("roe"), "avg_3y");
    expect(def.aliases.length).toBeGreaterThan(0);
    expect(def.aliases.every((a) => a.includes("3y"))).toBe(true);
  });
});

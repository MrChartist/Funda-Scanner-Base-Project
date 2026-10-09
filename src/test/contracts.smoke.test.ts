// P0 smoke test (§E.2 Acceptance): the frozen contracts, the catalogue, the fixtures and the
// stubs fit together. WS8's src/test/contracts.test.ts extends this later.
import { describe, expect, it } from "vitest";
import {
  ANNUAL_FIELD_INFO, ANNUAL_FIELDS, COMPANY_SECTION_IDS, LEGACY_KEY_TO_METRIC, NULL_REASONS, PEER_CLASS, QUARTER_FIELD_INFO,
  QUARTER_FIELDS, REQUIRED_ANNUAL_FIELDS, SHAREHOLDING_FIELD_INFO, SHAREHOLDING_FIELDS, STORAGE_KEYS, TYPE_FAMILY, VARIANTS,
  ZERO_DEFAULT_FIELDS, LENDER_ONLY_FIELDS, UnknownMetricError, type AnnualRow, type NullReason,
} from "@/lib/contracts";
import { createStore } from "@/lib/engine";
import { formatInrCrore } from "@/lib/format/indian";
import { formatMetric, NULL_REASON_TEXT } from "@/lib/format/metric-value";
import { allMetricDefs, CATALOGUE_VERSION, createMetricStore } from "@/lib/metrics";
import { BASE_METRICS } from "@/lib/metrics/catalogue";
import { RESERVED_ALIAS_WORDS, normalisePhrase } from "@/lib/metrics/variants";
import { quarterLabel } from "@/lib/time/civil";
import { createTinyDataset, TINY_DATASET, TINY_FACE_VALUE, TINY_SYMBOLS, type TinySymbol } from "./fixtures/tiny-dataset";

const SNAKE = /^[a-z][a-z0-9_]*$/;

describe("§E.2 acceptance", () => {
  const defs = allMetricDefs();

  it("ids are unique and snake_case", () => {
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id, id).toMatch(SNAKE);
  });

  it("variant ids are generated and do not collide", () => {
    const variants = defs.filter((d) => d.variant !== null);
    expect(variants.length).toBeGreaterThan(100);
    for (const v of variants) {
      expect(v.id).toBe(`${v.base}_${v.variant}`);
      expect(VARIANTS).toContain(v.variant);
      expect(v.expandsTo).toBeTruthy();
    }
    const baseIds = new Set(BASE_METRICS.map((d) => d.id));
    for (const v of variants) expect(baseIds.has(v.id), v.id).toBe(false);
    // every declared variant produced a definition
    const declared = BASE_METRICS.reduce((n, b) => n + b.variants.length, 0);
    expect(variants).toHaveLength(declared);
  });

  it("no alias contains a keyword", () => {
    for (const d of defs) {
      for (const alias of d.aliases) {
        const words = normalisePhrase(alias).split(" ");
        for (const kw of ["and", "or", "not", "between", ...RESERVED_ALIAS_WORDS]) {
          expect(words.includes(kw), `${d.id}: "${alias}"`).toBe(false);
        }
      }
    }
  });

  it("every FieldInfo.metricId exists in the catalogue", () => {
    const ids = new Set(defs.map((d) => d.id));
    for (const info of [...Object.values(ANNUAL_FIELD_INFO), ...Object.values(QUARTER_FIELD_INFO), ...Object.values(SHAREHOLDING_FIELD_INFO)]) {
      expect(ids.has(info.metricId), info.metricId).toBe(true);
    }
  });

  it('formatInrCrore(192000) === "₹1.92 lakh Cr"', () => {
    expect(formatInrCrore(192000)).toBe("₹1.92 lakh Cr");
    expect(formatInrCrore(52140)).toBe("₹52,140 Cr");
  });

  it('quarterLabel("2026-06-30", 3) === "Q1 FY27"', () => {
    expect(quarterLabel("2026-06-30", 3)).toBe("Q1 FY27");
  });
});

describe("contract constants", () => {
  it("field lists are exhaustive and consistent", () => {
    expect(ANNUAL_FIELDS).toHaveLength(36);
    expect(QUARTER_FIELDS).toHaveLength(5);
    expect(SHAREHOLDING_FIELDS).toHaveLength(5);
    expect(Object.keys(ANNUAL_FIELD_INFO).sort()).toEqual([...ANNUAL_FIELDS].sort());
    for (const f of [...REQUIRED_ANNUAL_FIELDS, ...ZERO_DEFAULT_FIELDS, ...LENDER_ONLY_FIELDS]) expect(ANNUAL_FIELDS).toContain(f);
    for (const f of LENDER_ONLY_FIELDS) expect(ANNUAL_FIELD_INFO[f].appliesTo).toBe("lender");
  });

  it("maps company types to families and peer classes", () => {
    expect(TYPE_FAMILY.other_financial).toBe("non_financial");
    expect(TYPE_FAMILY.nbfc).toBe("lender");
    expect(PEER_CLASS.other_financial).toBe("non_financial");
    expect(PEER_CLASS.bank).toBe("bank");
  });

  it("keeps NULL_REASONS append-only with none at index 0", () => {
    expect(NULL_REASONS[0]).toBe("none");
    expect(NULL_REASONS.length).toBe(13);
    for (const r of NULL_REASONS) if (r !== "none") expect(NULL_REASON_TEXT[r as NullReason]).toBeDefined();
  });

  it("maps every legacy StockRow key to a catalogue id", () => {
    const ids = new Set(allMetricDefs().map((d) => d.id));
    for (const id of Object.values(LEGACY_KEY_TO_METRIC)) expect(ids.has(id), id).toBe(true);
  });

  it("has unique storage keys and section ids", () => {
    const keys = Object.values(STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(COMPANY_SECTION_IDS).size).toBe(COMPANY_SECTION_IDS.length);
  });

  it("UnknownMetricError names the id", () => {
    const e = new UnknownMetricError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("UnknownMetricError");
    expect(e.metricId).toBe("nope");
  });

  it("every metric formats a value and every null reason", () => {
    for (const d of allMetricDefs()) {
      expect(formatMetric(d, { v: 1, reason: null, flags: 0 }), d.id).not.toBe("—");
      for (const r of NULL_REASONS) if (r !== "none") expect(formatMetric(d, { v: null, reason: r as NullReason, flags: 0 })).toBe("—");
    }
    expect(CATALOGUE_VERSION).toBeTruthy();
  });
});

describe("tiny dataset (fictional fixture)", () => {
  const bySymbol = new Map(TINY_DATASET.companies.map((c) => [c.symbol, c]));
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.011;

  it("has the six documented companies, all labelled synthetic and undated", () => {
    expect(TINY_DATASET.companies.map((c) => c.symbol)).toEqual([...TINY_SYMBOLS]);
    expect(TINY_DATASET.meta.isSynthetic).toBe(true);
    expect(TINY_DATASET.meta.asOf).toBeNull();
    for (const c of TINY_DATASET.companies) {
      expect(c.market.price_date).toBeNull();
      expect(c.isin).toBeNull();
      expect(c.sample_note).toBeTruthy();
    }
  });

  it("stores every annual key, never undefined or NaN, oldest first", () => {
    for (const c of TINY_DATASET.companies) {
      const years = c.annual.map((r) => r.fiscal_year);
      expect([...years].sort((a, b) => a - b)).toEqual(years);
      for (const row of c.annual) {
        for (const f of ANNUAL_FIELDS) {
          expect(f in row, `${c.symbol} ${row.fiscal_year} ${f}`).toBe(true);
          const v = row[f];
          expect(v === null || Number.isFinite(v), `${c.symbol} ${row.fiscal_year} ${f}`).toBe(true);
        }
      }
      const ends = c.quarterly.map((q) => q.period_end);
      expect([...ends].sort()).toEqual(ends);
    }
  });

  it("holds the accounting identities for every non-financial company-year", () => {
    for (const sym of ["TINYMFG", "TINYSOFT", "TINYLOSS", "TINYNEW"] as TinySymbol[]) {
      const c = bySymbol.get(sym);
      if (!c) throw new Error(sym);
      for (const r of c.annual) {
        const v = (f: keyof AnnualRow) => r[f] as number;
        const where = `${sym} FY${r.fiscal_year}`;
        expect(near(v("pbt") - v("tax_expense"), v("net_profit")), where).toBe(true);
        expect(near(v("revenue") - v("operating_expenses") + v("other_income") - v("depreciation") - v("finance_cost") + v("exceptional_items"), v("pbt")), where).toBe(true);
        expect(v("cash_and_bank") <= v("total_current_assets") && v("total_current_assets") <= v("total_assets"), where).toBe(true);
        expect(near(v("equity_share_capital"), v("shares_outstanding_ye") * (TINY_FACE_VALUE[sym] ?? NaN)), where).toBe(true);
        expect(v("total_current_liabilities") >= v("borrowings_current") + v("trade_payables") - 0.01, where).toBe(true);
        expect(v("revenue") >= 0 && v("trade_receivables") >= 0 && v("inventories") >= 0 && v("capex") >= 0, where).toBe(true);
      }
    }
  });

  it("has quarters that sum exactly to complete financial years", () => {
    const fyQuarters: [TinySymbol, number, string[]][] = [
      ["TINYMFG", 2025, ["2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31"]],
      ["TINYMFG", 2026, ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31"]],
      ["TINYSOFT", 2025, ["2024-06-30", "2024-09-30", "2024-12-31", "2025-03-31"]],
      ["TINYBANK", 2026, ["2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31"]],
    ];
    for (const [sym, fy, dates] of fyQuarters) {
      const c = bySymbol.get(sym);
      if (!c) throw new Error(sym);
      const row = c.annual.find((r) => r.fiscal_year === fy);
      if (!row) throw new Error(`${sym} ${fy}`);
      for (const f of ["revenue", "operating_expenses", "depreciation", "net_profit"] as const) {
        const sum = c.quarterly.filter((q) => dates.includes(q.period_end)).reduce((s, q) => s + (q[f] ?? NaN), 0);
        expect(near(sum, row[f] as number), `${sym} FY${fy} ${f}`).toBe(true);
      }
    }
  });

  it("keeps shareholding totals at or below 100", () => {
    for (const c of TINY_DATASET.companies) {
      for (const s of c.shareholding) {
        expect((s.promoter_pct ?? 0) + (s.fii_pct ?? 0) + (s.dii_pct ?? 0)).toBeLessThanOrEqual(100);
      }
    }
  });

  it("matches the §E.2 descriptions", () => {
    const soft = bySymbol.get("TINYSOFT");
    expect(soft?.annual.every((r) => r.cogs === null && r.inventories === 0 && r.finance_cost === 0)).toBe(true);
    expect(bySymbol.get("TINYBANK")?.company_type).toBeNull();
    const loss = bySymbol.get("TINYLOSS");
    expect(loss?.annual.find((r) => r.fiscal_year === 2024)?.flags).toEqual(["transition"]);
    expect(loss?.annual.every((r) => (r.net_profit ?? 0) < 0)).toBe(true);
    const lastLoss = loss?.annual[loss.annual.length - 1];
    expect((lastLoss?.equity_share_capital ?? 0) + (lastLoss?.other_equity ?? 0)).toBeLessThan(0);
    const snap = bySymbol.get("TINYSNAP");
    expect(snap?.annual).toEqual([]);
    expect(snap?.quarterly).toEqual([]);
    expect(Object.keys(snap?.snapshot ?? {}).length).toBeGreaterThan(5);
    expect(bySymbol.get("TINYNEW")?.annual.map((r) => r.fiscal_year)).toEqual([2023, 2025, 2026]);
    const mfg = bySymbol.get("TINYMFG");
    const nonLender = ANNUAL_FIELDS.filter((f) => !LENDER_ONLY_FIELDS.includes(f));
    expect(mfg?.annual.every((r) => nonLender.every((f) => r[f] !== null))).toBe(true);
  });

  it("returns a fresh deep copy on each call", () => {
    const a = createTinyDataset();
    const b = createTinyDataset();
    expect(a).toEqual(b);
    a.companies[0].annual[0].revenue = 1;
    expect(b.companies[0].annual[0].revenue).not.toBe(1);
    expect(JSON.parse(JSON.stringify(a.companies[1]))).toEqual(a.companies[1]); // JSON-safe: no NaN or undefined
  });
});

describe("stubs compile and serve the tiny dataset (§B.11)", () => {
  it("createMetricStore serves line items, snapshot values and NAF", () => {
    const store = createMetricStore(createTinyDataset(), { providers: [] });
    const mfg = store.indexOf("TINYMFG");
    const bank = store.indexOf("tinybank");
    const snap = store.indexOf("TINYSNAP");
    expect(store.get("total_assets", mfg).v).toBeGreaterThan(0);
    expect(store.get("roce", bank)).toEqual({ v: null, reason: "not_applicable_financial", flags: 0 });
    expect(store.get("pe", snap).v).toBe(22.4);
    expect(store.get("roce", mfg).v).toBeCloseTo(18.77, 2); // WS3: derived metrics are real now
    expect(() => store.column("not_a_metric")).toThrow(UnknownMetricError);
  });

  it("engine.createStore returns one store per dataset object", () => {
    const ds = createTinyDataset();
    expect(createStore(ds)).toBe(createStore(ds));
    expect(createStore(createTinyDataset())).not.toBe(createStore(ds));
  });
});

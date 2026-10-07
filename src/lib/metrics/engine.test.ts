// Catalogue bijection, scores, legacy rows and the public API (spec §E.5).
import { describe, expect, it } from "vitest";
import type { MetricStore } from "@/lib/contracts";
import { LEGACY_KEY_TO_METRIC, VF } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { goldenDataset } from "@/test/fixtures/metrics/golden-company";
import { BASE_METRICS } from "./catalogue";
import { CURATED_DERIVER_IDS, DERIVERS, PROVIDED_IDS, deriverKind, hasDeriver } from "./derive/index";
import * as metrics from "./index";
import { altmanZone } from "./scores/altman";
import { piotroskiBand } from "./scores/piotroski";
import { ALL_METRIC_DEFS } from "./variants";

const tinyStore = (): MetricStore => metrics.createMetricStore(createTinyDataset(), { providers: [] });

describe("catalogue bijection", () => {
  it("every base metric has a deriver of the right kind, or is served by a provider", () => {
    const expectedKind = { annual: "annual", quarterly: "quarterly", shareholding: "shareholding", latest_only: "latest" } as const;
    for (const d of BASE_METRICS) {
      if (PROVIDED_IDS.has(d.id)) {
        expect(hasDeriver(d.id), d.id).toBe(false);
        continue;
      }
      expect(deriverKind(d.id), d.id).toBe(expectedKind[d.history]);
    }
  });

  it("every deriver belongs to a catalogue metric (internal building blocks start with _)", () => {
    const ids = new Set(BASE_METRICS.map((d) => d.id));
    for (const id of Object.keys(DERIVERS)) expect(ids.has(id) || id.startsWith("_"), id).toBe(true);
    for (const id of CURATED_DERIVER_IDS) expect(ids.has(id) || id.startsWith("_"), id).toBe(true);
  });

  it("metrics with a TTM form have a TTM deriver, and no others do", () => {
    for (const d of BASE_METRICS) {
      const der = DERIVERS[d.id];
      if (!der || der.kind !== "annual") continue;
      expect(Boolean(der.ttm), d.id).toBe(d.ttm);
    }
  });

  it("every catalogue id (variants included) can be read from a store", () => {
    const s = tinyStore();
    for (const d of ALL_METRIC_DEFS) expect(() => s.column(d.id), d.id).not.toThrow();
  });
});

describe("public API", () => {
  it("exports the §B.10 surface", () => {
    expect(typeof metrics.createMetricStore).toBe("function");
    expect(metrics.CATALOGUE_VERSION).toBe("2026.1");
    expect(metrics.allMetricDefs()).toBe(ALL_METRIC_DEFS);
    expect(typeof metrics.aggregateWindow).toBe("function");
    expect(typeof metrics.cagrColumn).toBe("function");
    expect(typeof metrics.explainPiotroski).toBe("function");
    expect(typeof metrics.explainAltman).toBe("function");
    expect(typeof metrics.toStockRows).toBe("function");
  });
});

describe("scores", () => {
  it("bands the F-score without advice wording", () => {
    expect(piotroskiBand(9)).toEqual({ label: "Strong", tone: "good" });
    expect(piotroskiBand(8).label).toBe("Strong");
    expect(piotroskiBand(7).label).toBe("Moderate");
    expect(piotroskiBand(4).label).toBe("Moderate");
    expect(piotroskiBand(3)).toEqual({ label: "Weak", tone: "weak" });
  });

  it("zones Altman Z'' at 1.10 and 2.60", () => {
    expect(altmanZone(2.61).label).toBe("Safe zone");
    expect(altmanZone(2.6).label).toBe("Grey zone");
    expect(altmanZone(1.1).label).toBe("Grey zone");
    expect(altmanZone(1.09)).toEqual({ label: "Distress zone", tone: "weak" });
  });

  it("explains a lender as not applicable", () => {
    const s = tinyStore();
    const bank = s.indexOf("TINYBANK");
    const p = metrics.explainPiotroski(s, bank);
    expect(p).toMatchObject({ scoreId: "piotroski_f", evaluable: 0, total: 9, criteria: [], band: null });
    expect(p.value.reason).toBe("not_applicable_financial");
    expect(metrics.explainAltman(s, bank).value.reason).toBe("not_applicable_financial");
  });

  it("shows how many criteria are evaluable when the score cannot be given", () => {
    const s = tinyStore();
    const p = metrics.explainPiotroski(s, s.indexOf("TINYNEW"));
    expect(p.value).toMatchObject({ v: null, reason: "too_few_inputs" });
    expect(p.band).toBeNull();
    expect(p.evaluable).toBeLessThan(9);
    expect(p.criteria.filter((c) => c.result === "not_evaluated").length).toBe(9 - p.evaluable);
    expect(p.caveats.some((c) => c.includes(`${p.evaluable} of 9`))).toBe(true);
    const snap = metrics.explainPiotroski(s, s.indexOf("TINYSNAP"));
    expect(snap.evaluable).toBe(0);
  });

  it("uses OPM for the margin test when COGS is missing, flagged Proxy", () => {
    const s = tinyStore();
    const p = metrics.explainPiotroski(s, s.indexOf("TINYSOFT"));
    expect(p.value).toEqual({ v: 8, reason: null, flags: VF.Proxy });
    const f8 = p.criteria.find((c) => c.id === "F8");
    expect(f8?.text).toMatch(/Operating margin improved/);
    expect(f8?.inputs.map((e) => e.metric)).toEqual(["opm", "opm"]);
    expect(p.criteria.find((c) => c.id === "F6")?.result).toBe("not_met");
    expect(p.criteria.find((c) => c.id === "F5")?.detail).toMatch(/No long-term borrowings/);
    expect(p.caveats.some((c) => /operating margin/.test(c))).toBe(true);
  });

  it("counts F7 on share count when equity raised is not provided", () => {
    const ds = goldenDataset();
    ds.companies[0].annual[5].equity_issuance = null;
    ds.companies[0].annual[5].shares_outstanding_ye = 10.2; // +2% dilution in FY26
    const s = metrics.createMetricStore(ds, { providers: [] });
    const f7 = metrics.explainPiotroski(s, 0).criteria.find((c) => c.id === "F7");
    expect(f7?.result).toBe("not_met");
    expect(f7?.inputs.map((e) => e.metric)).toEqual(["shares_outstanding_ye", "shares_outstanding_ye"]);
    expect(s.get("piotroski_f", 0).v).toBe(7);
  });

  it("gives the Altman explanation's components and a distress zone for the loss-maker", () => {
    const s = tinyStore();
    const a = metrics.explainAltman(s, s.indexOf("TINYLOSS"));
    expect(a.band).toEqual({ label: "Distress zone", tone: "weak" });
    expect(a.criteria.find((c) => c.id === "X3")?.result).toBe("not_met");
    expect(a.evaluable).toBe(4);
    const snap = metrics.explainAltman(s, s.indexOf("TINYSNAP"));
    expect(snap.value.v).toBeNull();
    expect(snap.criteria.every((c) => c.result === "not_evaluated")).toBe(true);
  });

  it("never uses advice words in score text", () => {
    const s = tinyStore();
    const text = JSON.stringify([0, 1, 3, 5].flatMap((i) => [metrics.explainPiotroski(s, i), metrics.explainAltman(s, i)])).toLowerCase();
    for (const w of ["buy", "sell", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot", "will go bankrupt"]) {
      expect(new RegExp(`\\b${w}\\b`).test(text), w).toBe(false);
    }
  });
});

describe("toStockRows (legacy)", () => {
  it("builds v0 rows from the store, NaN for missing values", () => {
    const s = tinyStore();
    const rows = metrics.toStockRows(s);
    expect(rows).toHaveLength(6);
    const snap = rows.find((r) => r.symbol === "TINYSNAP");
    expect(snap).toMatchObject({ pe: 22.4, price_book: 3.1, market_cap: 5000, price: 250, roce: 17.8, industry: "Packaged foods" });
    expect(Number.isNaN(snap?.sales_growth ?? 0)).toBe(false);
    const mfg = rows.find((r) => r.symbol === "TINYMFG");
    expect(mfg?.market_cap).toBe(4200);
    expect(mfg?.pe).toBe(s.get("pe", 0).v);
    for (const key of Object.keys(LEGACY_KEY_TO_METRIC) as (keyof typeof LEGACY_KEY_TO_METRIC)[]) {
      const v = s.get(LEGACY_KEY_TO_METRIC[key], 0).v;
      expect(mfg?.[key]).toBe(v === null ? Number.NaN : v);
    }
    const bank = rows.find((r) => r.symbol === "TINYBANK");
    expect(Number.isNaN(bank?.roce)).toBe(true);
  });
});

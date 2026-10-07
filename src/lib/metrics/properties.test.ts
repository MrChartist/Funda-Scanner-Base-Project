// Property tests over many generated fictional companies (spec §E.5).
import { describe, expect, it } from "vitest";
import type { MetricDef, MetricStore, MetricValue } from "@/lib/contracts";
import { generateDataset, scaleMoney, shiftOneYear } from "@/test/fixtures/metrics/generate";
import { createMetricStore } from "./store";
import { ALL_METRIC_DEFS } from "./variants";

const COUNT = 300;
const dataset = generateDataset({ count: COUNT, seed: 20261007 });
const base = createMetricStore(dataset, { providers: [] });

/** Size metrics scale with money; everything else is a ratio, count, score or period. */
function moneyFactor(def: MetricDef, k: number): number {
  return def.unit === "inr_cr" || def.unit === "inr" ? k : 1;
}

function close(a: number, b: number, rel: number): boolean {
  return Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
}

function compareStores(a: MetricStore, b: MetricStore, factor: (def: MetricDef) => number, rel: number, skip: ReadonlySet<string> = new Set()) {
  const problems: string[] = [];
  for (const def of ALL_METRIC_DEFS) {
    if (skip.has(def.id)) continue;
    const ca = a.column(def.id);
    const cb = b.column(def.id);
    const k = factor(def);
    for (let i = 0; i < a.size; i++) {
      if (ca.reasons[i] !== cb.reasons[i] || ca.flags[i] !== cb.flags[i]) {
        problems.push(`${def.id} #${i}: reason ${ca.reasons[i]}/${cb.reasons[i]} flags ${ca.flags[i]}/${cb.flags[i]}`);
      } else if (ca.reasons[i] === 0 && !close(ca.values[i] * k, cb.values[i], rel)) {
        problems.push(`${def.id} #${i}: ${ca.values[i]} × ${k} vs ${cb.values[i]}`);
      }
    }
  }
  return problems;
}

describe(`property tests over ${COUNT} generated companies`, () => {
  it("generates a varied set: lenders, insurers, inferred types, holes, transitions and losses", () => {
    const families = new Set(Array.from({ length: base.size }, (_, i) => base.family(i)));
    expect(families).toEqual(new Set(["non_financial", "lender", "insurance"]));
    expect(Array.from({ length: base.size }, (_, i) => base.companyType(i).inferred).filter(Boolean).length).toBeGreaterThan(10);
    expect(dataset.companies.some((c) => c.annual.some((r) => r.flags.length > 0))).toBe(true);
    expect(base.column("net_profit").values.some((v) => v < 0)).toBe(true);
  });

  it("every value is finite, or null with a reason (and never both)", () => {
    const problems: string[] = [];
    for (const def of ALL_METRIC_DEFS) {
      for (let i = 0; i < base.size; i++) {
        const v: MetricValue = base.get(def.id, i);
        const okNull = v.v === null && v.reason !== null;
        const okValue = v.v !== null && Number.isFinite(v.v) && v.reason === null;
        if (!okNull && !okValue) problems.push(`${def.id} #${i}: ${JSON.stringify(v)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("is finite at past periods too (FY slots 0–11, quarter slots 0–13, TTM blocks 0–3)", () => {
    const sels = [
      ...Array.from({ length: 12 }, (_, k) => ({ freq: "fy" as const, offset: k })),
      ...Array.from({ length: 14 }, (_, k) => ({ freq: "q" as const, offset: k })),
      ...Array.from({ length: 4 }, (_, k) => ({ freq: "ttm" as const, offset: k })),
    ];
    const problems: string[] = [];
    for (const def of ALL_METRIC_DEFS) {
      for (const sel of sels) {
        const col = base.columnAt(def.id, sel);
        for (let i = 0; i < base.size; i++) {
          const good = col.reasons[i] === 0 ? Number.isFinite(col.values[i]) : Number.isNaN(col.values[i]);
          if (!good) problems.push(`${def.id} ${sel.freq}${sel.offset} #${i}`);
        }
      }
    }
    expect(problems).toEqual([]);
  }, 60_000);

  it("multiplying every money field by 10 leaves ratios unchanged and scales size metrics by 10", () => {
    const scaled = createMetricStore(scaleMoney(dataset, 10), { providers: [] });
    expect(compareStores(base, scaled, (d) => moneyFactor(d, 10), 1e-9)).toEqual([]);
  });

  it("shifting every period by one year leaves values unchanged", () => {
    const shifted = createMetricStore(shiftOneYear(dataset), { providers: [] });
    expect(compareStores(base, shifted, () => 1, 0, new Set(["latest_fy"]))).toEqual([]);
    for (let i = 0; i < base.size; i++) {
      const a = base.get("latest_fy", i);
      const b = shifted.get("latest_fy", i);
      expect(b.v).toBe(a.v === null ? null : a.v + 1);
    }
  });

  it("satisfies the DuPont identity ROE = NPM × asset turnover × equity multiplier (no NCI), within 2%", () => {
    let checked = 0;
    for (let i = 0; i < base.size; i++) {
      const c = base.company(i);
      const noNci = c.annual.every((r) => !r.non_controlling_interest && (r.net_profit_owners === null || r.net_profit_owners === r.net_profit));
      if (!noNci || base.family(i) !== "non_financial") continue;
      const roe = base.get("roe", i).v;
      const npm = base.get("npm", i).v;
      const at = base.get("asset_turnover", i).v;
      const em = base.get("equity_multiplier", i).v;
      if (roe === null || npm === null || at === null || em === null) continue;
      checked++;
      expect(Math.abs(npm * at * em - roe), `#${i}`).toBeLessThanOrEqual(0.02 * Math.max(Math.abs(roe), 1e-9));
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("keeps lender metrics to lenders and non-financial metrics away from them", () => {
    for (let i = 0; i < base.size; i++) {
      const fam = base.family(i);
      expect(base.get("roce", i).reason === "not_applicable_financial").toBe(fam !== "non_financial");
      expect(base.get("nii", i).reason === "not_applicable_financial").toBe(fam !== "lender");
      expect(base.get("roe", i).reason).not.toBe("not_applicable_financial");
    }
  });

  it("is deterministic across generations and stores", () => {
    const again = createMetricStore(generateDataset({ count: COUNT, seed: 20261007 }), { providers: [] });
    expect(compareStores(base, again, () => 1, 0)).toEqual([]);
    expect(again.key).toBe(base.key);
  });
});

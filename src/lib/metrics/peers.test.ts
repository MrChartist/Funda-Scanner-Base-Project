import { describe, expect, it } from "vitest";
import type { CompanyRecord, CompanyType, FundamentalsDataset } from "@/lib/contracts";
import { PEER_SCOPES } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";
import { generateDataset } from "@/test/fixtures/metrics/generate";
import { buildPeerGroups, medianColumn, percentileColumn } from "./peers";
import { createMetricStore } from "./store";

/** A dataset of bare companies with a sector, industry, type and a supplied market cap. */
function peerDataset(rows: readonly [string, string, string | null, CompanyType, number | null][]): FundamentalsDataset {
  const template = createTinyDataset().companies[4]; // snapshot-only shape
  const ds = createTinyDataset();
  ds.companies = rows.map(([symbol, sector, industry, type, mcap]): CompanyRecord => ({
    ...template,
    symbol, name: `${symbol} Ltd (fictional)`, sector, industry, company_type: type,
    market: { price: null, price_date: null, shares_outstanding: null, face_value: null, market_cap_supplied: mcap },
    snapshot: {},
  }));
  return ds;
}

describe("percentiles (§C.7)", () => {
  const keys = { cls: Array(7).fill("non_financial"), sector: Array(7).fill("S"), industry: Array(7).fill("I") } as const;
  const groups = buildPeerGroups({ cls: [...keys.cls], sector: [...keys.sector], industry: [...keys.industry] }, "industry");

  it("ranks ascending with ties averaged: 100 × (average rank − 1) / (n − 1)", () => {
    const values = Float64Array.from([10, 20, 20, 30, 40, NaN, 50]);
    const p = percentileColumn(values, groups, "p");
    // ranks: 10→1, 20,20→2.5, 30→4, 40→5, 50→6; n = 6
    expect(Array.from(p.values.slice(0, 5))).toEqual([0, 30, 30, 60, 80]);
    expect(p.values[6]).toBe(100);
    expect(p.reasons[5]).toBe(1); // missing_input for the company without a value
  });

  it("needs at least 5 values for a percentile and 3 for a median", () => {
    const four = Float64Array.from([1, 2, 3, 4, NaN, NaN, NaN]);
    expect(Array.from(percentileColumn(four, groups, "p").reasons.slice(0, 4))).toEqual([9, 9, 9, 9]); // too_few_peers
    expect(medianColumn(four, groups, "m").values[0]).toBe(2.5);
    const two = Float64Array.from([1, 2, NaN, NaN, NaN, NaN, NaN]);
    expect(medianColumn(two, groups, "m").reasons[6]).toBe(9);
    const five = Float64Array.from([5, 1, 4, 2, 3, NaN, NaN]);
    expect(Array.from(percentileColumn(five, groups, "p").values.slice(0, 5))).toEqual([100, 0, 75, 25, 50]);
  });
});

describe("peer groups and fallback (§C.7)", () => {
  const rows: [string, string, string | null, CompanyType, number | null][] = [
    // Cement: 5 companies in one industry → industry group
    ...Array.from({ length: 5 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`CEM${j}`, "Cement", "Cement", "non_financial", 100 * (j + 1)]),
    // Textiles: 3 in Garments + 3 in Mills → each industry too small, the sector (6) is used
    ...Array.from({ length: 3 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`GAR${j}`, "Textiles", "Garments", "non_financial", 10 + j]),
    ...Array.from({ length: 3 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`MIL${j}`, "Textiles", "Mills", "non_financial", 20 + j]),
    // Two lonely companies → whole non-financial class
    ["SOLO1", "Shipping", "Ports", "non_financial", 5],
    ["SOLO2", "Aviation", null, "non_financial", 6],
    // Banks share the sector word with nothing else; 5 banks → bank class groups
    ...Array.from({ length: 5 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`BNK${j}`, "Financials", "Banks", "bank", 1000 + j]),
    // NBFCs in the same sector as the banks, only 2 → no group (class below minimum)
    ["NBF0", "Financials", "Banks", "nbfc", 50],
    ["NBF1", "Financials", "Banks", "nbfc", 60],
    // 4 insurers: below the minimum on purpose
    ...Array.from({ length: 4 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`INS${j}`, "Insurance", "Life", "insurance", 70 + j]),
  ];
  const store = createMetricStore(peerDataset(rows), { providers: [] });
  const i = (s: string) => store.indexOf(s);

  it("uses the industry when it has at least 5 members", () => {
    const g = store.groups("industry");
    expect(PEER_SCOPES[g.effectiveScope[i("CEM0")]]).toBe("industry");
    expect(g.labels[g.groupOf[i("CEM0")]]).toBe("Cement · 5 companies in your data");
    expect(store.peerStat("market_cap", i("CEM2"), "industry")).toMatchObject({ n: 5, median: 300, scope: "industry", fellBackTo: null });
  });

  it("falls back industry → sector → class and records it", () => {
    const st = store.peerStat("market_cap", i("GAR0"), "industry");
    expect(st).toMatchObject({ n: 6, scope: "sector", fellBackTo: "sector", groupLabel: "Textiles · 6 companies in your data" });
    expect(st.median).toBe((12 + 20) / 2);
    const solo = store.peerStat("market_cap", i("SOLO1"), "industry");
    expect(solo.scope).toBe("class");
    expect(solo.fellBackTo).toBe("class");
    expect(solo.n).toBe(5 + 6 + 2);
    expect(solo.groupLabel).toBe("Non-financial companies · 13 companies in your data");
    expect(store.peerStat("market_cap", i("SOLO2"), "sector").fellBackTo).toBe("class");
    expect(store.peerStat("market_cap", i("CEM0"), "class")).toMatchObject({ scope: "class", fellBackTo: null, n: 13 });
  });

  it("never mixes peer classes, even within one sector and industry", () => {
    const g = store.groups("industry");
    expect(g.groupOf[i("BNK0")]).not.toBe(g.groupOf[i("NBF0")]);
    expect(g.groupOf[i("NBF0")]).toBe(-1); // two NBFCs: below the minimum, no group
    expect(store.peerStat("market_cap", i("BNK0"), "industry")).toMatchObject({ n: 5, median: 1002 });
    expect(store.percentile("market_cap", i("NBF0"), "industry").reason).toBe("too_few_peers");
    for (let a = 0; a < store.size; a++) {
      const ga = g.groupOf[a];
      if (ga < 0) continue;
      for (let b = 0; b < store.size; b++) if (g.groupOf[b] === ga) expect(store.peerClass(b)).toBe(store.peerClass(a));
    }
  });

  it("gives insurers below the minimum too_few_peers for every statistic", () => {
    const ins = i("INS0");
    expect(store.groups("class").groupOf[ins]).toBe(-1);
    expect(store.percentile("market_cap", ins, "class").reason).toBe("too_few_peers");
    expect(store.medianOf(store.column("market_cap").values, "class").reasons[ins]).toBe(9);
    expect(store.peerStat("market_cap", ins, "industry")).toMatchObject({ n: 4, median: null, scope: "class", fellBackTo: "class", groupLabel: "Insurers · 4 companies in your data" });
    expect(store.peers(ins, "industry")).toEqual([i("INS3"), i("INS2"), i("INS1")]);
  });

  it("computes percentiles within the effective group", () => {
    expect(store.percentile("market_cap", i("CEM4"), "industry").v).toBe(100);
    expect(store.percentile("market_cap", i("CEM0"), "industry").v).toBe(0);
    expect(store.percentile("market_cap", i("CEM2"), "industry").v).toBe(50);
    // GAR0 (10) is the lowest of the 6 textile companies
    expect(store.percentile("market_cap", i("GAR0"), "industry").v).toBe(0);
    expect(store.percentile("market_cap", i("MIL2"), "industry").v).toBe(100);
  });

  it("lists peers of the same group by market cap, excluding the company", () => {
    expect(store.peers(i("CEM0"), "industry")).toEqual([i("CEM4"), i("CEM3"), i("CEM2"), i("CEM1")]);
    expect(store.peers(i("CEM0"), "industry", 2)).toEqual([i("CEM4"), i("CEM3")]);
    expect(store.peers(i("GAR0"), "industry")).toEqual([i("MIL2"), i("MIL1"), i("MIL0"), i("GAR2"), i("GAR1")]);
  });

  it("keeps a sector-level group whole even when some members have their own industry group", () => {
    const ds = peerDataset([
      ...Array.from({ length: 5 }, (_, j): [string, string, string | null, CompanyType, number | null] => [`BIG${j}`, "Chemicals", "Specialty", "non_financial", 10 + j]),
      ["SMALL", "Chemicals", "Agro", "non_financial", 1],
    ]);
    const s = createMetricStore(ds, { providers: [] });
    const st = s.peerStat("market_cap", s.indexOf("SMALL"), "industry");
    expect(st).toMatchObject({ n: 6, scope: "sector", groupLabel: "Chemicals · 6 companies in your data" });
    expect(s.percentile("market_cap", s.indexOf("SMALL"), "industry").v).toBe(0);
    expect(s.percentile("market_cap", s.indexOf("BIG4"), "industry").v).toBe(100); // within its industry group of 5
  });

  it("calibrates on generated data: most non-financial companies get an industry or sector group", () => {
    const s = createMetricStore(generateDataset({ count: 300, seed: 11 }), { providers: [] });
    const g = s.groups("industry");
    let nonFin = 0;
    let narrow = 0;
    for (let k = 0; k < s.size; k++) {
      if (s.peerClass(k) !== "non_financial") continue;
      nonFin++;
      if (PEER_SCOPES[g.effectiveScope[k]] !== "class") narrow++;
    }
    expect(narrow / nonFin).toBeGreaterThan(0.9);
  });
});

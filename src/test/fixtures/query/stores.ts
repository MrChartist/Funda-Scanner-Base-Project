// src/test/fixtures/query/stores.ts — small fictional stores for FSQL and screen tests (WS4).
// Every company here is invented; the figures are round numbers chosen to exercise the rules.
import type { AnnualField, AnnualRow, MetricStore, PeriodFlag } from "@/lib/contracts";
import { ANNUAL_FIELDS } from "@/lib/contracts";
import { createFixtureStore, type FixtureCompany } from "@/test/fixtures/fixture-store";

/** Annual rows from series given OLDEST FIRST, ending in `lastFy`. Fields not given are null. */
export function annualRows(
  series: Partial<Record<AnnualField, readonly (number | null)[]>>,
  opts: { lastFy?: number; flags?: Readonly<Record<number, PeriodFlag[]>>; skip?: readonly number[] } = {},
): AnnualRow[] {
  const lastFy = opts.lastFy ?? 2026;
  const len = Math.max(0, ...Object.values(series).map((s) => (s ? s.length : 0)));
  const rows: AnnualRow[] = [];
  for (let k = 0; k < len; k++) {
    const fy = lastFy - (len - 1 - k);
    if (opts.skip?.includes(fy)) continue;
    const row = { fiscal_year: fy, period_end: `${fy}-03-31`, flags: opts.flags?.[fy] ?? [] } as AnnualRow;
    for (const f of ANNUAL_FIELDS) row[f] = series[f]?.[k] ?? null;
    rows.push(row);
  }
  return rows;
}

/** Five non-financial companies with yearly history plus one bank (for windows, folds and screens). */
export const HISTORY_COMPANIES: readonly FixtureCompany[] = [
  {
    symbol: "STEADY", name: "Steadyline Tools Ltd", sector: "Capital goods",
    values: { market_cap: 5000, roce: 22, pe: 18, debt_equity: 0.2, interest_coverage: 12 },
    annual: annualRows({ revenue: [100, 110, 121, 133, 146, 161], net_profit: [10, 11, 12, 13, 14, 15], dividend_per_share: [1, 1, 1, 1, 1, 1], total_assets: [200, 210, 220, 230, 240, 250] }),
  },
  {
    symbol: "DIPPER", name: "Dipwell Fabrics Ltd", sector: "Textiles",
    values: { market_cap: 3000, roce: 14.2, pe: 11, debt_equity: 0.4, interest_coverage: { v: null, reason: "no_interest_cost" } },
    annual: annualRows({ revenue: [100, 110, 105, 120, 130, 140], net_profit: [10, -2, 5, 6, 7, 8], dividend_per_share: [1, 1, 0, 1, 1, 1], total_assets: [150, 150, 150, 150, 150, 150] }),
  },
  {
    symbol: "SHORTY", name: "Shortwick Foods Ltd", sector: "FMCG",
    values: { market_cap: 1000, roce: 30, pe: 40, debt_equity: 0, interest_coverage: 20 },
    annual: annualRows({ revenue: [50, 60, 70], net_profit: [5, 6, 7], dividend_per_share: [1, 1, 1], total_assets: [80, 90, 100] }),
  },
  {
    symbol: "TRANSIT", name: "Transitry Chemicals Ltd", sector: "Specialty chemicals",
    values: { market_cap: 2000, roce: 16, pe: 25, debt_equity: 0.9, interest_coverage: 2 },
    annual: annualRows(
      { revenue: [80, 90, 100, 110, 120, 130], net_profit: [8, 9, 10, 11, 12, 13], dividend_per_share: [1, 1, 1, 1, 1, 1], total_assets: [100, 100, 100, 100, 100, 100] },
      { flags: { 2024: ["transition"] } },
    ),
  },
  {
    symbol: "GAPPY", name: "Gapford Metals Ltd", sector: "Metals",
    values: { market_cap: null, roce: null, pe: null, debt_equity: 1.5, interest_coverage: 1 },
    annual: annualRows({ revenue: [60, 65, 70, 75], net_profit: [3, 3, 3, 3], dividend_per_share: [0, 0, 0, 0], total_assets: [90, 90, 90, 90] }, { skip: [2024] }),
  },
  {
    symbol: "BANKX", name: "Bankwell Bank Ltd", sector: "Banks", type: "bank",
    values: { market_cap: 4000, pe: 9, roe: 14 },
    annual: annualRows({ revenue: [300, 320, 340, 360, 380, 400], net_profit: [30, 32, 34, 36, 38, 40], dividend_per_share: [2, 2, 2, 2, 2, 2], total_assets: [3000, 3100, 3200, 3300, 3400, 3500] }),
  },
];

export function historyStore(extra: readonly FixtureCompany[] = []): MetricStore {
  return createFixtureStore({ companies: [...HISTORY_COMPANIES, ...extra] });
}

/** Peer groups: 6 cement companies (a full sector group), 2 pharma (fall back to class), 1 bank. */
export function peerStore(): MetricStore {
  const cement = [8, 10, 12, 14, 16, 30].map((pe, k) => ({
    symbol: `CEM${k + 1}`, sector: "Cement", industry: "Cement", values: { pe, roce: 10 + k, market_cap: 1000 + 100 * k },
  }));
  return createFixtureStore({
    companies: [
      ...cement,
      { symbol: "PHA1", sector: "Pharma", industry: "Pharma", values: { pe: 20, roce: 25, market_cap: 900 } },
      { symbol: "PHA2", sector: "Pharma", industry: "Pharma", values: { pe: 22, roce: 18, market_cap: 800 } },
      { symbol: "LEND1", sector: "Banks", industry: "Banks", type: "bank", values: { pe: 9, market_cap: 5000 } },
    ],
  });
}

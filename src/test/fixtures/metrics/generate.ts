// src/test/fixtures/metrics/generate.ts — a small deterministic generator of FICTIONAL companies
// for the metrics property and performance tests (WS3). It is deliberately independent of
// src/lib/sample (the public sample generator): it aims for variety and awkward cases (holes,
// transition years, missing fields, losses, negative net worth, lenders, insurers, inferred
// types), not for realism. Names are "Test Company 0001 (fictional)".
import type {
  AnnualField, AnnualRow, CompanyRecord, CompanyType, FundamentalsDataset, QuarterRow, ShareholdingRow,
} from "@/lib/contracts";
import { ANNUAL_FIELDS, ANNUAL_FIELD_INFO, DATASET_SCHEMA, DATASET_VERSION, LENDER_ONLY_FIELDS, QUARTER_FIELDS } from "@/lib/contracts";
import { addMonths } from "@/lib/time/civil";

/** mulberry32 with explicit state. */
export function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SECTORS: readonly { sector: string; industries: readonly string[]; type: CompanyType }[] = [
  { sector: "Capital goods", industries: ["Industrial components", "Electrical equipment", "Heavy machinery"], type: "non_financial" },
  { sector: "IT services", industries: ["IT services", "Software products"], type: "non_financial" },
  { sector: "FMCG", industries: ["Packaged foods", "Personal care"], type: "non_financial" },
  { sector: "Cement", industries: ["Cement"], type: "non_financial" },
  { sector: "Textiles", industries: ["Textile mills", "Garments", "Technical textiles", "Home textiles"], type: "non_financial" },
  { sector: "Banks", industries: ["Private sector bank", "Public sector bank"], type: "bank" },
  { sector: "Finance", industries: ["Housing finance", "Consumer finance", "Microfinance"], type: "nbfc" },
  { sector: "Insurance", industries: ["Life insurance"], type: "insurance" },
  { sector: "Capital markets", industries: ["Brokers"], type: "other_financial" },
];

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length) % xs.length];
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export interface GenerateOptions {
  count: number;
  seed?: number;
  /** Probability that any optional field is left null. */
  nullRate?: number;
  /** Latest fiscal year (default 2026). */
  latestFy?: number;
}

function sectorFor(r: () => number): (typeof SECTORS)[number] {
  const x = r();
  if (x < 0.72) return pick(r, SECTORS.filter((s) => s.type === "non_financial"));
  if (x < 0.82) return SECTORS[5];
  if (x < 0.9) return SECTORS[6];
  if (x < 0.95) return SECTORS[7];
  return SECTORS[8];
}

function generateCompany(n: number, seed: number, nullRate: number, latestFy: number): CompanyRecord {
  const r = prng((seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
  const sec = sectorFor(r);
  const lender = sec.type === "bank" || sec.type === "nbfc";
  const insurer = sec.type === "insurance";
  const years = 1 + Math.floor(r() * 11); // 1 … 11
  const endFy = latestFy - (r() < 0.08 ? 1 : 0); // a few companies are a year behind
  const hole = years >= 4 && r() < 0.12 ? endFy - 1 - Math.floor(r() * (years - 2)) : null;
  const transition = years >= 3 && r() < 0.08 ? endFy - Math.floor(r() * years) : null;
  const lossMaker = r() < 0.1;
  const negativeNw = lossMaker && r() < 0.4;
  const hasNci = r() < 0.4;
  const noCogs = r() < 0.25;
  const debtFree = !lender && r() < 0.15;
  const shares = round2(1 + r() * 99);
  const faceValue = pick(r, [1, 2, 5, 10]);
  const growth = -0.05 + r() * 0.25;
  const margin = lossMaker ? -0.05 + r() * 0.07 : 0.05 + r() * 0.3;
  let revenue = 100 + r() * 20000;
  let otherEquity = negativeNw ? -(50 + r() * 200) : 200 + r() * 5000;
  const annual: AnnualRow[] = [];
  for (let y = endFy - years + 1; y <= endFy; y++) {
    revenue = Math.max(1, revenue * (1 + growth + (r() - 0.5) * 0.1));
    const opm = margin + (r() - 0.5) * 0.04;
    const ebitda = revenue * opm;
    const dep = revenue * (0.02 + r() * 0.04);
    const fin = debtFree ? 0 : revenue * r() * 0.04;
    const oi = revenue * r() * 0.03;
    const exc = r() < 0.1 ? (r() - 0.6) * revenue * 0.05 : 0;
    const pbt = ebitda + oi - dep - fin + exc;
    const tax = pbt > 0 ? pbt * (0.15 + r() * 0.2) : 0;
    const np = pbt - tax;
    const owners = hasNci ? np * (0.85 + r() * 0.1) : r() < 0.5 ? np : null;
    otherEquity += np * 0.7;
    const esc = round2(shares * faceValue);
    const nci = hasNci ? 10 + r() * 300 : r() < 0.5 ? 0 : null;
    const bnc = debtFree ? 0 : revenue * r() * 0.4;
    const bc = debtFree ? 0 : revenue * r() * 0.1;
    const lease = r() < 0.5 ? revenue * r() * 0.05 : null;
    const cash = revenue * (0.02 + r() * 0.2);
    const ci = r() < 0.5 ? revenue * r() * 0.1 : null;
    const inv = noCogs ? 0 : revenue * (0.05 + r() * 0.2);
    const rec = revenue * (0.05 + r() * 0.25);
    const tca = cash + (ci ?? 0) + inv + rec + revenue * r() * 0.05;
    const tcl = revenue * (0.1 + r() * 0.3) + bc;
    const nfa = revenue * (0.2 + r() * 0.8);
    const nw = esc + otherEquity;
    const ta = Math.max(tca + nfa, nw + (nci ?? 0) + bnc + bc + (lease ?? 0) + tcl - bc) + revenue * r() * 0.1;
    const values: Partial<Record<AnnualField, number | null>> = {
      revenue, operating_expenses: revenue - ebitda, cogs: noCogs ? null : (revenue - ebitda) * (0.5 + r() * 0.3),
      other_income: r() < 0.9 ? oi : null, depreciation: dep, finance_cost: fin, exceptional_items: exc, pbt, tax_expense: tax,
      net_profit: np, net_profit_owners: owners, dividend_per_share: np > 0 && r() < 0.7 ? round2((np * 0.3) / shares) : r() < 0.5 ? 0 : null,
      equity_share_capital: esc, other_equity: otherEquity, non_controlling_interest: nci, borrowings_non_current: bnc,
      borrowings_current: bc, lease_liabilities: lease, trade_payables: revenue * (0.03 + r() * 0.15),
      total_current_liabilities: tcl, total_assets: ta, net_fixed_assets: nfa, inventories: inv, trade_receivables: rec,
      cash_and_bank: cash, current_investments: ci, total_current_assets: tca,
      shares_outstanding_ye: r() < 0.9 ? shares : null, cfo: np + dep + (r() - 0.5) * revenue * 0.05, capex: revenue * r() * 0.1,
      equity_issuance: r() < 0.85 ? 0 : r() < 0.5 ? revenue * r() * 0.02 : null,
    };
    if (lender) {
      const advances = revenue * (6 + r() * 4);
      const gnpa = advances * r() * 0.06;
      Object.assign(values, {
        interest_expended: revenue * (0.5 + r() * 0.15), provisions_contingencies: advances * r() * 0.02,
        advances, gross_npa: gnpa, net_npa: gnpa * r() * 0.6, cogs: null, inventories: null, total_current_assets: null,
        total_current_liabilities: null, trade_payables: null, total_assets: advances * 1.3 + nw,
      });
    }
    if (insurer) Object.assign(values, { cogs: null, inventories: null, trade_receivables: null });
    if (y === hole) continue;
    const row = { fiscal_year: y, period_end: `${y}-03-31`, flags: y === transition ? ["transition"] : [] } as unknown as AnnualRow;
    for (const f of ANNUAL_FIELDS) {
      const v = values[f];
      const lenderOnly = LENDER_ONLY_FIELDS.includes(f);
      if (v === undefined || v === null || (lenderOnly && !lender)) row[f] = null;
      else if (r() < nullRate && f !== "revenue" && f !== "total_assets") row[f] = null;
      else row[f] = ANNUAL_FIELD_INFO[f].unit === "crore_shares" || ANNUAL_FIELD_INFO[f].unit === "inr" ? v : round2(v);
    }
    annual.push(row);
  }

  // Quarters: up to 13 ending Jun of the year after endFy, from the last annual revenue.
  const quarterly: QuarterRow[] = [];
  const nq = r() < 0.15 ? 0 : 1 + Math.floor(r() * 13);
  const qHole = nq > 6 && r() < 0.2 ? Math.floor(r() * nq) : -1;
  const qBase = (annual.length ? annual[annual.length - 1].revenue ?? 100 : 100) / 4;
  for (let k = nq - 1; k >= 0; k--) {
    if (k === qHole) continue;
    const end = addMonths(`${endFy + 1}-06-30`, -3 * k) ?? `${endFy}-06-30`;
    const rev = qBase * (0.8 + r() * 0.4);
    const opex = rev * (1 - margin - (r() - 0.5) * 0.04);
    const np = (rev - opex) * 0.6;
    const q: QuarterRow = { period_end: end, revenue: round2(rev), operating_expenses: round2(opex), depreciation: round2(rev * 0.03), net_profit: round2(np), net_profit_owners: hasNci ? round2(np * 0.9) : null };
    for (const f of QUARTER_FIELDS) if (f !== "revenue" && r() < nullRate / 2) q[f] = null;
    quarterly.push(q);
  }

  const shareholding: ShareholdingRow[] = [];
  const ns = r() < 0.15 ? 0 : 1 + Math.floor(r() * 13);
  let promoter = r() < 0.05 ? 0 : 20 + r() * 55;
  for (let k = ns - 1; k >= 0; k--) {
    promoter = Math.max(0, Math.min(90, promoter + (r() - 0.55) * 2));
    const fii = r() * (95 - promoter) * 0.5;
    const dii = r() * (95 - promoter - fii) * 0.5;
    shareholding.push({
      period_end: addMonths(`${endFy + 1}-06-30`, -3 * k) ?? `${endFy}-06-30`,
      promoter_pct: round2(promoter), promoter_pledged_pct: r() < 0.8 ? 0 : round2(r() * 60),
      fii_pct: round2(fii), dii_pct: round2(dii), num_shareholders: Math.round(1000 + r() * 500000),
    });
  }

  const id = String(n + 1).padStart(4, "0");
  const industry = pick(r, sec.industries);
  return {
    symbol: `TST${id}`,
    name: `Test Company ${id} (fictional)`,
    sector: sec.sector,
    industry: r() < 0.9 ? industry : null,
    isin: null,
    company_type: r() < 0.15 ? null : sec.type,
    statement_basis: r() < 0.8 ? "consolidated" : "standalone",
    fy_end_month: 3,
    market: {
      price: r() < 0.06 ? null : round2(5 + r() * 3000),
      price_date: null,
      shares_outstanding: r() < 0.05 ? null : shares,
      face_value: faceValue,
      market_cap_supplied: r() < 0.05 ? round2(100 + r() * 50000) : null,
    },
    annual,
    quarterly,
    shareholding,
    snapshot: {},
    sample_note: null,
    source_note: "Generated by the metrics test fixture; fictional.",
  };
}

export function generateCompanies(o: GenerateOptions): CompanyRecord[] {
  const seed = o.seed ?? 7919;
  const nullRate = o.nullRate ?? 0.03;
  const latestFy = o.latestFy ?? 2026;
  return Array.from({ length: o.count }, (_, n) => generateCompany(n, seed, nullRate, latestFy));
}

export function generateDataset(o: GenerateOptions): FundamentalsDataset {
  return {
    schema: DATASET_SCHEMA,
    version: DATASET_VERSION,
    meta: {
      name: `Generated test companies (${o.count}, fictional)`, source: "synthetic_sample", isSynthetic: true, asOf: null,
      importedAt: null, currency: "INR", moneyUnit: "crore", sharesUnit: "crore", files: [], generator: null,
      notes: ["Generated for tests. Every company is fictional."],
    },
    companies: generateCompanies(o),
  };
}

// ── transformations used by the invariance tests ─────────────────────────────
const MONEY_ANNUAL: readonly AnnualField[] = ANNUAL_FIELDS.filter((f) => ANNUAL_FIELD_INFO[f].unit === "inr_cr" || ANNUAL_FIELD_INFO[f].unit === "inr");

/** Multiplies every money amount (₹ crore and ₹ per share, including price) by k. Shares and percentages stay. */
export function scaleMoney(ds: FundamentalsDataset, k: number): FundamentalsDataset {
  const copy: FundamentalsDataset = JSON.parse(JSON.stringify(ds));
  for (const c of copy.companies) {
    for (const row of c.annual) for (const f of MONEY_ANNUAL) if (row[f] !== null) row[f] = (row[f] as number) * k;
    for (const q of c.quarterly) for (const f of QUARTER_FIELDS) if (q[f] !== null) q[f] = (q[f] as number) * k;
    if (c.market.price !== null) c.market.price *= k;
    if (c.market.market_cap_supplied !== null) c.market.market_cap_supplied *= k;
  }
  return copy;
}

/** Moves every period one year later (fiscal years, annual period ends, quarters and shareholding). */
export function shiftOneYear(ds: FundamentalsDataset): FundamentalsDataset {
  const copy: FundamentalsDataset = JSON.parse(JSON.stringify(ds));
  for (const c of copy.companies) {
    for (const row of c.annual) {
      row.fiscal_year += 1;
      if (row.period_end) row.period_end = addMonths(row.period_end, 12);
    }
    for (const q of c.quarterly) q.period_end = addMonths(q.period_end, 12) ?? q.period_end;
    for (const s of c.shareholding) s.period_end = addMonths(s.period_end, 12) ?? s.period_end;
  }
  return copy;
}

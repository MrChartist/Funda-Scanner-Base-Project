// src/test/fixtures/insights/crafted.ts — TEST-ONLY fictional companies built from the tiny fixture
// to trigger one red flag each (§C.9). Each case copies TINYMFG (or TINYBANK for lender flags),
// renames it and changes only the fields the flag looks at, so a test can show that every red flag
// can fire on the real engine. The figures are invented and describe no real business.
import type { AnnualRow, CompanyRecord, FundamentalsDataset } from "@/lib/contracts";
import { createTinyDataset } from "../tiny-dataset";

export interface CraftedCase {
  symbol: string;
  /** Tiny-fixture company the case starts from. */
  base: "TINYMFG" | "TINYBANK";
  /** Red flag the change is built to trigger. */
  flag: string;
  note: string;
  change(c: CompanyRecord): void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function year(c: CompanyRecord, fy: number): AnnualRow {
  const row = c.annual.find((r) => r.fiscal_year === fy);
  if (!row) throw new Error(`${c.symbol} has no FY${fy}`);
  return row;
}

function num(v: number | null): number {
  if (v === null) throw new Error("fixture field is null");
  return v;
}

export const CRAFTED_CASES: readonly CraftedCase[] = [
  {
    symbol: "FLAGTAX", base: "TINYMFG", flag: "RF-08", note: "Tax at 5% of PBT in each of the last 3 years",
    change(c) {
      for (const fy of [2024, 2025, 2026]) {
        const r = year(c, fy);
        const pbt = num(r.pbt);
        r.tax_expense = round2(pbt * 0.05);
        r.net_profit = round2(pbt - r.tax_expense);
        r.net_profit_owners = round2(r.net_profit * 0.96);
      }
    },
  },
  {
    symbol: "FLAGEXC", base: "TINYMFG", flag: "RF-10", note: "Exceptional gains above 20% of PBT in FY25 and FY26",
    change(c) {
      year(c, 2025).exceptional_items = 60;
      year(c, 2026).exceptional_items = 70;
    },
  },
  {
    symbol: "FLAGDIL", base: "TINYMFG", flag: "RF-11", note: "Shares rose from 10 crore to 11 crore in FY26",
    change(c) {
      const r = year(c, 2026);
      r.shares_outstanding_ye = 11;
      r.equity_share_capital = 110;
      r.equity_issuance = 40;
    },
  },
  {
    symbol: "FLAGPLG", base: "TINYMFG", flag: "RF-03", note: "30% of the promoters' holding pledged in the latest quarter",
    change(c) {
      c.shareholding[c.shareholding.length - 1].promoter_pledged_pct = 30;
    },
  },
  {
    symbol: "FLAGPROM", base: "TINYMFG", flag: "RF-04", note: "Promoter holding cut from 62.1% to 50% over a year",
    change(c) {
      c.shareholding[c.shareholding.length - 1].promoter_pct = 50;
    },
  },
  {
    symbol: "FLAGOTH", base: "TINYMFG", flag: "RF-05", note: "Other income about half of PBT in FY26",
    change(c) {
      year(c, 2026).other_income = 120;
    },
  },
  {
    symbol: "FLAGINV", base: "TINYMFG", flag: "RF-12", note: "Inventories more than doubled in FY26 while sales grew below 10% a year",
    change(c) {
      year(c, 2026).inventories = 520;
    },
  },
  {
    symbol: "FLAGREC", base: "TINYMFG", flag: "RF-02", note: "Receivables more than doubled in FY26 while sales grew below 10% a year",
    change(c) {
      year(c, 2026).trade_receivables = 700;
    },
  },
  {
    symbol: "FLAGNPA", base: "TINYBANK", flag: "LF-01", note: "Gross and net NPAs tripled in FY26",
    change(c) {
      const r = year(c, 2026);
      r.gross_npa = round2(num(r.gross_npa) * 3);
      r.net_npa = round2(num(r.net_npa) * 3);
    },
  },
  {
    symbol: "FLAGPCR", base: "TINYBANK", flag: "LF-02", note: "Net NPA at 60% of gross NPA in FY26 (coverage 40%)",
    change(c) {
      const r = year(c, 2026);
      r.net_npa = round2(num(r.gross_npa) * 0.6);
    },
  },
  {
    symbol: "FLAGCRC", base: "TINYBANK", flag: "LF-03", note: "Provisions at 4% of advances in FY26",
    change(c) {
      const r = year(c, 2026);
      r.provisions_contingencies = round2(num(r.advances) * 0.04);
    },
  },
  {
    symbol: "FLAGBPLG", base: "TINYBANK", flag: "LF-04", note: "30% of the promoters' holding pledged in the latest quarter",
    change(c) {
      c.shareholding[c.shareholding.length - 1].promoter_pledged_pct = 30;
    },
  },
];

/** The tiny fixture plus one crafted copy per case. Fresh on every call. */
export function craftedDataset(): FundamentalsDataset {
  const ds = createTinyDataset();
  const bySymbol = new Map(ds.companies.map((c) => [c.symbol, c]));
  for (const k of CRAFTED_CASES) {
    const base = bySymbol.get(k.base);
    if (!base) throw new Error(`Missing base company ${k.base}`);
    const copy = JSON.parse(JSON.stringify(base)) as CompanyRecord;
    copy.symbol = k.symbol;
    copy.name = `${k.symbol} Test Company (fictional)`;
    copy.sample_note = k.note;
    k.change(copy);
    ds.companies.push(copy);
  }
  return ds;
}

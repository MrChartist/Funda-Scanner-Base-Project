// src/lib/sample/gen-insurer.ts — minimal annual statements of one fictional insurer (§F.3).
// Only the fields an insurer's summary needs are filled: revenue (premium and investment income),
// operating expenses (claims, benefits and expenses), depreciation, profit lines, dividends,
// equity, total assets, cash and operating cash flow. Every other field stays null.
//
//   pbt = revenue − operating_expenses − depreciation;  net_profit = pbt − tax
//   other_equity rolls forward with profit and dividends;  total_assets = net worth × asset multiple
//   cfo = Δcash + dividends − equity issuance (cash identity with no borrowings)
import type { AnnualRow } from "@/lib/contracts";
import type { InsurerParams } from "./archetypes";
import { FIRST_FY, SIM_YEARS, emptyAnnualRow, round2 } from "./common";
import { type Rng, between, fromRange, noise, pick } from "./prng";

export interface InsurerDraw {
  revenue0: number;
  growth: number;
  margin: number;
  taxRate: number;
  payout: number;
  assetMultiple: number;
  cashRatio: number;
  faceValue: number;
  bookValuePerShare0: number;
}

export function drawInsurer(p: InsurerParams, faceValues: readonly number[], rng: Rng): InsurerDraw {
  return {
    revenue0: round2(fromRange(rng, p.revenue)),
    growth: fromRange(rng, p.growth),
    margin: fromRange(rng, p.margin),
    taxRate: fromRange(rng, p.taxRate),
    payout: fromRange(rng, p.payout),
    assetMultiple: fromRange(rng, p.assetMultiple),
    cashRatio: fromRange(rng, p.cashRatio),
    faceValue: pick(rng, faceValues),
    bookValuePerShare0: between(rng, 20, 80),
  };
}

/** Simulates FY2016 … FY2027 (12 rows, oldest first). */
export function simulateInsurer(d: InsurerDraw, rng: Rng): AnnualRow[] {
  const nw0 = d.revenue0 * 0.6;
  // Shares and share capital are constant for insurers in the sample.
  const shares = Math.max(1, round2(nw0 / d.bookValuePerShare0));
  const esc = round2(shares * d.faceValue);
  let oe = round2(nw0 - esc);
  let revenue = d.revenue0;
  let cash = round2(d.cashRatio * nw0 * d.assetMultiple);

  const rows: AnnualRow[] = [];
  for (let y = 0; y < SIM_YEARS; y++) {
    revenue = round2(revenue * (1 + d.growth + noise(rng, 0.03)));
    const margin = d.margin + noise(rng, 0.01);
    const depreciation = round2(0.004 * revenue);
    const pbt = round2(revenue * margin);
    const opex = round2(revenue - depreciation - pbt);
    const tax = round2(d.taxRate * Math.max(pbt, 0));
    const netProfit = round2(pbt - tax);
    const dps = netProfit > 0 ? round2((d.payout * netProfit) / shares) : 0;
    const dividends = round2(dps * shares);
    oe = round2(oe + netProfit - dividends);
    const netWorth = round2(esc + oe);
    const totalAssets = round2(netWorth * d.assetMultiple);
    const newCash = round2(d.cashRatio * totalAssets);
    const cfo = round2(newCash - cash + dividends);

    const row = emptyAnnualRow(FIRST_FY + y);
    row.revenue = revenue;
    row.operating_expenses = opex;
    row.depreciation = depreciation;
    row.pbt = pbt;
    row.tax_expense = tax;
    row.net_profit = netProfit;
    row.net_profit_owners = netProfit;
    row.dividend_per_share = dps;
    row.equity_share_capital = esc;
    row.other_equity = oe;
    row.total_assets = totalAssets;
    row.cash_and_bank = newCash;
    row.shares_outstanding_ye = shares;
    row.cfo = cfo;
    row.equity_issuance = 0;
    rows.push(row);
    cash = newCash;
  }
  return rows;
}

// src/lib/sample/gen-lender.ts — annual statements of one fictional bank, NBFC or housing
// finance company (§F.3, "Lenders"). Simulates FY2016 … FY2027.
//
// Model (all money rounded to 2 decimals):
//   gross advances grow each year; gross NPA = GNPA ratio × gross advances (a deterministic cycle);
//   net NPA = gross NPA × (1 − provision coverage); advances (net) = gross − (gross NPA − net NPA)
//   revenue (interest earned) = yield × average advances + yield × average investments
//   interest_expended = cost of funds × average (deposits + borrowings)
//   other_income = fee ratio × average advances;  operating_expenses = cost-to-income × (NII + other income)
//   provisions_contingencies = credit cost × average advances (a deterministic cycle)
//   pbt = revenue − interest_expended + other_income − operating_expenses − depreciation − provisions + exceptional
//   tax = rate × max(pbt, 0);  net_profit = pbt − tax (no minority interest)
//   equity rolls forward with profit, dividends and capital raised when net worth ÷ assets is thin;
//   total assets = advances + investments + cash + other assets; deposits and other liabilities
//   fill the liability side; cfo = Δcash + dividends − Δborrowings − equity issuance.
// Fields that do not apply to lenders (COGS, finance cost, current assets and liabilities, capex,
// fixed assets, inventories, receivables, payables, leases, current borrowings) stay null.
import type { AnnualRow } from "@/lib/contracts";
import type { Archetype, LenderParams } from "./archetypes";
import { FIRST_FY, SIM_YEARS, emptyAnnualRow, round2 } from "./common";
import { type Rng, between, fromRange, noise, pick } from "./prng";

/** GNPA multipliers by simulated year (FY2016 … FY2027). */
const GNPA_NORMAL: readonly number[] = [1, 1.05, 1.15, 1.2, 1.1, 1.15, 1.1, 1, 0.92, 0.88, 0.85, 0.85];
const GNPA_STRESSED: readonly number[] = [1.3, 1.8, 2.6, 2.9, 2.6, 2.2, 1.8, 1.4, 1.1, 0.9, 0.8, 0.8];
/** Credit-cost multipliers by simulated year. */
const CREDIT_NORMAL: readonly number[] = [1, 1.1, 1.2, 1.3, 1.2, 1.4, 1.1, 0.9, 0.85, 0.85, 0.9, 0.9];
const CREDIT_STRESSED: readonly number[] = [1.5, 2.6, 3.4, 3.2, 2.4, 1.8, 1.3, 1, 0.8, 0.7, 0.7, 0.7];

export interface LenderDraw {
  gross0: number;
  growth: number;
  yieldOnAdvances: number;
  investmentRatio: number;
  yieldOnInvestments: number;
  cashRatio: number;
  otherAssetRatio: number;
  borrowingRatio: number | null;
  costOfFunds: number;
  feeRatio: number;
  costToIncome: number;
  creditCost: number;
  gnpa: number;
  provisionCoverage: number;
  capitalRatio: number;
  depreciationShare: number;
  taxRate: number;
  payout: number;
  otherLiabilityRatio: number;
  faceValue: number;
  bookValuePerShare0: number;
  stressed: boolean;
}

export function drawLender(p: LenderParams, archetype: Archetype, faceValues: readonly number[], rng: Rng): LenderDraw {
  const d: LenderDraw = {
    gross0: round2(fromRange(rng, p.grossAdvances)),
    growth: fromRange(rng, p.growth),
    yieldOnAdvances: fromRange(rng, p.yieldOnAdvances),
    investmentRatio: fromRange(rng, p.investmentRatio),
    yieldOnInvestments: fromRange(rng, p.yieldOnInvestments),
    cashRatio: fromRange(rng, p.cashRatio),
    otherAssetRatio: fromRange(rng, p.otherAssetRatio),
    borrowingRatio: p.borrowingRatio ? fromRange(rng, p.borrowingRatio) : null,
    costOfFunds: fromRange(rng, p.costOfFunds),
    feeRatio: fromRange(rng, p.feeRatio),
    costToIncome: fromRange(rng, p.costToIncome),
    creditCost: fromRange(rng, p.creditCost),
    gnpa: fromRange(rng, p.gnpa),
    provisionCoverage: fromRange(rng, p.provisionCoverage),
    capitalRatio: fromRange(rng, p.capitalRatio),
    depreciationShare: fromRange(rng, p.depreciationShare),
    taxRate: fromRange(rng, p.taxRate),
    payout: fromRange(rng, p.payout),
    otherLiabilityRatio: fromRange(rng, p.otherLiabilityRatio),
    faceValue: pick(rng, faceValues),
    bookValuePerShare0: between(rng, 30, 150),
    stressed: archetype === "stressed_bank",
  };
  if (archetype === "good_bank") {
    d.creditCost *= 0.6;
    d.gnpa *= 0.6;
    d.costToIncome -= 0.03;
    d.growth += 0.02;
    d.provisionCoverage = Math.min(0.85, d.provisionCoverage + 0.05);
  }
  if (archetype === "stressed_bank") {
    d.creditCost *= 1.5;
    d.costToIncome += 0.02;
    d.provisionCoverage = Math.max(0.5, d.provisionCoverage - 0.05);
  }
  return d;
}

/** Simulates FY2016 … FY2027 (12 rows, oldest first). */
export function simulateLender(d: LenderDraw, rng: Rng): AnnualRow[] {
  const gnpaTable = d.stressed ? GNPA_STRESSED : GNPA_NORMAL;
  const creditTable = d.stressed ? CREDIT_STRESSED : CREDIT_NORMAL;

  // ── Opening balance sheet (FY2015, not published) ──
  const advances0 = round2(d.gross0 * (1 - d.gnpa * d.provisionCoverage));
  const investments0 = round2(d.investmentRatio * advances0);
  const cash0 = round2(d.cashRatio * advances0);
  const assets0 = advances0 + investments0 + cash0 + d.otherAssetRatio * advances0;
  const nw0 = (d.capitalRatio + 0.015) * assets0;
  const shares0 = Math.max(1, round2(nw0 / d.bookValuePerShare0));
  const esc0 = round2(shares0 * d.faceValue);
  const borrowings0 = d.borrowingRatio !== null
    ? round2(d.borrowingRatio * assets0)
    : round2(assets0 - nw0 - d.otherLiabilityRatio * assets0);
  const deposits0 = d.borrowingRatio !== null ? assets0 - nw0 - borrowings0 - d.otherLiabilityRatio * assets0 : 0;

  let gross = d.gross0;
  let advances = advances0;
  let investments = investments0;
  let cash = cash0;
  let funds = borrowings0 + deposits0;
  let borrowings = borrowings0;
  let esc = esc0;
  let oe = round2(nw0 - esc0);
  let shares = shares0;

  const rows: AnnualRow[] = [];
  for (let y = 0; y < SIM_YEARS; y++) {
    const fy = FIRST_FY + y;
    const prevNw = esc + oe;
    const stressSlowdown = d.stressed && y >= 1 && y <= 4 ? -0.05 : 0;
    const growth = Math.max(-0.05, d.growth + stressSlowdown + noise(rng, 0.02));
    const newGross = round2(gross * (1 + growth));
    const gnpaRatio = d.gnpa * gnpaTable[y] * (1 + noise(rng, 0.05));
    const grossNpa = round2(newGross * gnpaRatio);
    const netNpa = round2(grossNpa * (1 - d.provisionCoverage));
    const newAdvances = round2(newGross - (grossNpa - netNpa));
    const newInvestments = round2(d.investmentRatio * newAdvances);
    const newCashTarget = round2(d.cashRatio * newAdvances);
    const otherAssets = round2(d.otherAssetRatio * newAdvances);
    const totalAssets = round2(newAdvances + newInvestments + newCashTarget + otherAssets);

    const avgAdvances = (advances + newAdvances) / 2;
    const avgInvestments = (investments + newInvestments) / 2;
    const revenue = round2(d.yieldOnAdvances * avgAdvances + d.yieldOnInvestments * avgInvestments);
    const fundsEstimate = totalAssets - prevNw - d.otherLiabilityRatio * totalAssets;
    const interestExpended = round2(d.costOfFunds * ((funds + fundsEstimate) / 2));
    const otherIncome = round2(d.feeRatio * avgAdvances);
    const nii = revenue - interestExpended;
    const opex = round2(Math.max(0, d.costToIncome * (nii + otherIncome)));
    const depreciation = round2(d.depreciationShare * opex);
    const provisions = round2(d.creditCost * creditTable[y] * avgAdvances * (1 + noise(rng, 0.05)));
    const pbt = round2(revenue - interestExpended + otherIncome - opex - depreciation - provisions);
    const tax = round2(d.taxRate * Math.max(pbt, 0));
    const netProfit = round2(pbt - tax);

    // Capital: raise equity when net worth would fall below the minimum share of assets.
    const dpsDraft = netProfit > 0 ? round2((d.payout * netProfit) / shares) : 0;
    const retained = netProfit - dpsDraft * shares;
    const minNw = d.capitalRatio * totalAssets;
    let issuance = 0;
    if (prevNw + retained < minNw) issuance = round2(minNw - (prevNw + retained) + 0.01 * totalAssets);
    const issuePrice = Math.max(d.faceValue, prevNw > 0 ? (prevNw / shares) * (d.stressed ? 0.8 : 1.5) : d.faceValue);
    const newShares = issuance > 0 ? round2(issuance / issuePrice) : 0;
    const newSharesTotal = round2(shares + newShares);
    const newEsc = round2(newSharesTotal * d.faceValue);
    const premium = round2(issuance - (newEsc - esc));
    const dps = netProfit > 0 ? round2((d.payout * netProfit) / newSharesTotal) : 0;
    const dividends = round2(dps * newSharesTotal);
    const newOe = round2(oe + netProfit - dividends + premium);
    const netWorth = round2(newEsc + newOe);

    const otherLiabilities = round2(d.otherLiabilityRatio * totalAssets);
    const newBorrowings = d.borrowingRatio !== null
      ? round2(d.borrowingRatio * totalAssets)
      : round2(totalAssets - netWorth - otherLiabilities);
    const deposits = d.borrowingRatio !== null ? round2(totalAssets - netWorth - newBorrowings - otherLiabilities) : 0;
    const cfo = round2(newCashTarget - cash + dividends - (newBorrowings - borrowings) - issuance);

    const row = emptyAnnualRow(fy);
    row.revenue = revenue;
    row.operating_expenses = opex;
    row.other_income = otherIncome;
    row.depreciation = depreciation;
    row.exceptional_items = 0;
    row.pbt = pbt;
    row.tax_expense = tax;
    row.net_profit = netProfit;
    row.net_profit_owners = netProfit;
    row.dividend_per_share = dps;
    row.interest_expended = interestExpended;
    row.provisions_contingencies = provisions;
    row.equity_share_capital = newEsc;
    row.other_equity = newOe;
    row.non_controlling_interest = 0;
    row.borrowings_non_current = newBorrowings;
    row.total_assets = totalAssets;
    row.cash_and_bank = newCashTarget;
    row.shares_outstanding_ye = newSharesTotal;
    row.advances = newAdvances;
    row.gross_npa = grossNpa;
    row.net_npa = netNpa;
    row.cfo = cfo;
    row.equity_issuance = issuance;
    rows.push(row);

    gross = newGross;
    advances = newAdvances;
    investments = newInvestments;
    cash = newCashTarget;
    funds = newBorrowings + deposits;
    borrowings = newBorrowings;
    esc = newEsc;
    oe = newOe;
    shares = newSharesTotal;
  }
  return rows;
}

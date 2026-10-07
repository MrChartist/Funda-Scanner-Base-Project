// src/lib/sample/gen-nonfinancial.ts — annual statements of one fictional non-financial company
// (§F.3). Simulates FY2016 … FY2027 from an unpublished FY2015 opening balance sheet.
//
// Identities that hold for every simulated year (all money rounded to 2 decimals):
//   operating_expenses = revenue − ebitda;   cogs = operating_expenses × cogs share (null for services)
//   depreciation = rate × net_fixed_assets[t−1];   net_fixed_assets = nfa[t−1] + capex − depreciation
//   pbt = ebitda + other_income − depreciation − finance_cost + exceptional_items
//   tax_expense = rate × max(pbt, 0);   net_profit = pbt − tax_expense;   owners = net_profit × (1 − nci share)
//   cfo = net_profit + depreciation − Δ(trade_receivables + inventories − trade_payables)
//   cash = cash[t−1] + cfo − capex − dividends + Δborrowings + equity_issuance
//   other_equity = other_equity[t−1] + owners − dividends + issue premium
//   equity_share_capital = shares × face value;   NCI = NCI[t−1] + (net_profit − owners)
//   TCA and TCL are built from their parts; total_assets = max(asset side, liability side): the
//   difference is a plug in other non-current items that is never negative.
// Current investments are held constant, lease liabilities are matched by right-of-use assets
// (kept in other non-current assets), and other current assets equal other current liabilities,
// so none of them moves cash; the plug therefore stays at rounding size.
import type { AnnualRow, PeriodFlag } from "@/lib/contracts";
import type { Archetype, NonFinancialParams, Trait } from "./archetypes";
import {
  CAPEX_SPIKE, FIRST_FY, GROWTH_CYCLE, MARGIN_CYCLE, SIM_YEARS, TRANSITION_FY, NEW_LISTING_FIRST_FY,
  clamp, cycleAt, emptyAnnualRow, round2,
} from "./common";
import { type Rng, between, fromRange, intBetween, noise, pick } from "./prng";

/** Concrete parameters of one company, drawn from its sector profile and archetype. */
export interface NonFinancialDraw {
  revenue0: number;
  growth: number;
  opm: number;
  cogsShare: number | null;
  debtorDays: number;
  inventoryDays: number;
  payableDays: number;
  fixedAssetRatio: number;
  depreciationRate: number;
  capexIntensity: number;
  debtEquity: number;
  leaseRatio: number;
  cashRatio: number;
  currentInvestmentRatio: number;
  taxRate: number;
  payout: number;
  nciShare: number;
  otherIncomeYield: number;
  otherCurrentRatio: number;
  cycleAmp: number;
  marginCycle: number;
  noiseAmp: number;
  lumpyCapex: boolean;
  phase: number;
  interestRate: number;
  faceValue: number;
  bookValuePerShare0: number;
  /** Serial diluter: new equity each year ÷ opening net worth. */
  issueRate: number;
  /** Price-to-book at which new shares are issued. */
  issuePb: number;
}

/** Draws a company's parameters. Consumes the PRNG in a fixed order. */
export function drawNonFinancial(
  p: NonFinancialParams, archetype: Archetype, traits: readonly Trait[], faceValues: readonly number[], rng: Rng,
): NonFinancialDraw {
  const d: NonFinancialDraw = {
    revenue0: round2(fromRange(rng, p.revenue)),
    growth: fromRange(rng, p.growth),
    opm: fromRange(rng, p.opm),
    cogsShare: p.cogsShare ? fromRange(rng, p.cogsShare) : null,
    debtorDays: fromRange(rng, p.debtorDays),
    inventoryDays: fromRange(rng, p.inventoryDays),
    payableDays: fromRange(rng, p.payableDays),
    fixedAssetRatio: fromRange(rng, p.fixedAssetRatio),
    depreciationRate: fromRange(rng, p.depreciationRate),
    capexIntensity: fromRange(rng, p.capexIntensity),
    debtEquity: fromRange(rng, p.debtEquity),
    leaseRatio: fromRange(rng, p.leaseRatio),
    cashRatio: fromRange(rng, p.cashRatio),
    currentInvestmentRatio: fromRange(rng, p.currentInvestmentRatio),
    taxRate: fromRange(rng, p.taxRate),
    payout: fromRange(rng, p.payout),
    nciShare: fromRange(rng, p.nciShare),
    otherIncomeYield: fromRange(rng, p.otherIncomeYield),
    otherCurrentRatio: fromRange(rng, p.otherCurrentRatio),
    cycleAmp: p.cycleAmp,
    marginCycle: p.marginCycle,
    noiseAmp: p.noiseAmp,
    lumpyCapex: p.lumpyCapex,
    phase: intBetween(rng, 0, 11),
    interestRate: between(rng, 0.08, 0.105),
    faceValue: pick(rng, faceValues),
    bookValuePerShare0: between(rng, 10, 80),
    issueRate: between(rng, 0.09, 0.14),
    issuePb: between(rng, 1, 1.3),
  };
  applyArchetype(d, archetype, rng);
  if (traits.includes("standalone")) d.nciShare = 0;
  return d;
}

function applyArchetype(d: NonFinancialDraw, a: Archetype, rng: Rng): void {
  switch (a) {
    case "compounder":
      d.growth = between(rng, 0.14, 0.19);
      d.opm = Math.min(0.4, d.opm + 0.05);
      d.debtEquity = between(rng, 0, 0.15);
      d.payout = between(rng, 0.3, 0.45);
      d.fixedAssetRatio *= 0.7;
      d.capexIntensity *= 0.8;
      d.debtorDays *= 0.8;
      d.inventoryDays *= 0.8;
      d.leaseRatio *= 0.5;
      d.cycleAmp *= 0.5;
      d.noiseAmp *= 0.6;
      break;
    case "cyclical":
      d.cycleAmp = Math.max(0.1, d.cycleAmp * 2);
      d.marginCycle = Math.max(0.04, d.marginCycle * 2);
      d.debtEquity = between(rng, 0.5, 0.9);
      break;
    case "cash_rich":
      d.debtEquity = 0;
      d.leaseRatio = 0;
      d.cashRatio = between(rng, 0.3, 0.5);
      d.currentInvestmentRatio = between(rng, 0.1, 0.2);
      d.payout = between(rng, 0.4, 0.6);
      d.opm = Math.min(0.4, d.opm + 0.03);
      d.noiseAmp *= 0.7;
      break;
    case "leveraged_utility":
      d.debtEquity = between(rng, 1.5, 2);
      d.fixedAssetRatio = between(rng, 2.8, 3.4);
      d.growth = between(rng, 0.06, 0.09);
      d.opm = between(rng, 0.4, 0.48);
      d.payout = between(rng, 0.25, 0.35);
      d.capexIntensity = between(rng, 0.14, 0.2);
      d.interestRate = between(rng, 0.08, 0.09);
      break;
    case "value_trap":
      d.growth = between(rng, -0.04, -0.01);
      d.payout = between(rng, 0.3, 0.5);
      d.debtEquity = Math.min(d.debtEquity, 0.4);
      d.capexIntensity *= 0.5;
      d.cycleAmp *= 0.5;
      break;
    case "turnaround":
      // Borrowing was cut during the loss years, so the recovery is not swamped by interest.
      d.debtEquity = between(rng, 0.55, 0.85);
      d.payout = between(rng, 0.1, 0.2);
      break;
    case "expensive_grower":
      d.growth = between(rng, 0.25, 0.33);
      d.payout = between(rng, 0, 0.08);
      d.noiseAmp *= 0.8;
      break;
    case "dividend_payer":
      d.payout = between(rng, 0.62, 0.78);
      d.growth = between(rng, 0.03, 0.07);
      d.debtEquity = Math.min(d.debtEquity, 0.2);
      break;
    case "rf_receivables":
      d.growth = between(rng, 0.03, 0.06);
      d.cycleAmp *= 0.5;
      d.noiseAmp *= 0.5;
      break;
    case "rf_cash":
      d.growth = between(rng, 0.15, 0.22);
      d.payout = between(rng, 0, 0.1);
      break;
    case "serial_diluter":
      d.payout = 0;
      d.opm *= 0.8;
      break;
    case "loss_maker":
      d.opm = between(rng, -0.1, -0.03);
      d.growth = between(rng, 0.15, 0.3);
      d.debtEquity = between(rng, 0.4, 0.8);
      d.payout = 0;
      break;
    case "negative_net_worth":
      d.debtEquity = between(rng, 1.8, 2.2);
      d.payout = 0;
      d.growth = between(rng, 0, 0.04);
      break;
    case "typical":
      // A typical company grows a little slower, and earns a little less, than the sector's leaders.
      d.growth -= 0.025;
      d.opm *= 0.88;
      break;
    case "rf_pledge":
      // Promoters who pledge shares often run more leveraged businesses.
      d.debtEquity = Math.max(0.6, d.debtEquity * 1.5);
      break;
    case "good_bank":
    case "stressed_bank":
      break;
  }
}

/** Operating margin in simulated year y (0 = FY2016). */
function opmAt(d: NonFinancialDraw, a: Archetype, y: number, rng: Rng): number {
  const base = d.opm + d.marginCycle * cycleAt(MARGIN_CYCLE, y, d.phase) + noise(rng, 0.006);
  switch (a) {
    case "value_trap":
      return Math.max(d.opm * 0.65, base * (1 - 0.025 * y));
    case "turnaround":
      // Modest profits, then five loss years (FY2020–FY2024), then a recovery from FY2025.
      if (y <= 3) return base * 0.6;
      if (y <= 8) return -0.04 + 0.006 * (y - 4) + noise(rng, 0.004);
      if (y <= 10) return d.opm * (y === 9 ? 0.6 : 0.95);
      return base + 0.01;
    case "loss_maker":
      return d.opm + 0.003 * y;
    case "negative_net_worth":
      return 0.03 - 0.006 * y;
    default:
      return base;
  }
}

/** Revenue growth in simulated year y. */
function growthAt(d: NonFinancialDraw, y: number, rng: Rng): number {
  return clamp(d.growth + d.cycleAmp * cycleAt(GROWTH_CYCLE, y, d.phase) + noise(rng, d.noiseAmp), -0.3, 0.6);
}

/** Debtor, inventory and payable days in simulated year y. */
function daysAt(d: NonFinancialDraw, a: Archetype, y: number, rng: Rng): { debtor: number; inventory: number; payable: number } {
  let debtor = d.debtorDays * (1 + noise(rng, 0.04));
  let inventory = d.inventoryDays * (1 + noise(rng, 0.04));
  const payable = d.payableDays * (1 + noise(rng, 0.04));
  if (a === "rf_receivables" && y >= 7) debtor = d.debtorDays * (1 + 0.25 * (y - 6));
  if (a === "rf_cash" && y >= 5) {
    debtor *= 1 + 0.1 * (y - 4);
    inventory *= 1 + 0.12 * (y - 4);
  }
  return { debtor, inventory, payable };
}

interface State {
  revenue: number;
  nfa: number;
  rec: number;
  inv: number;
  pay: number;
  cash: number;
  bnc: number;
  bc: number;
  lease: number;
  nci: number;
  esc: number;
  oe: number;
  shares: number;
}

/**
 * Simulates FY2016 … FY2027 (12 rows, oldest first). The caller decides which rows to publish.
 * Consumes the PRNG in a fixed order.
 */
export function simulateNonFinancial(d: NonFinancialDraw, a: Archetype, traits: readonly Trait[], rng: Rng): AnnualRow[] {
  const isTransition = traits.includes("transition");
  const isNewListing = traits.includes("new_listing");
  const services = d.cogsShare === null;

  // ── Opening balance sheet (FY2015, not published) ──
  const r0 = d.revenue0;
  const opex0 = r0 * (1 - d.opm);
  const cogs0 = services ? null : opex0 * (d.cogsShare ?? 0);
  const rec0 = round2((d.debtorDays / 365) * r0);
  const inv0 = round2((d.inventoryDays / 365) * (cogs0 ?? r0));
  const pay0 = round2((d.payableDays / 365) * (cogs0 ?? opex0));
  const oc0 = round2(d.otherCurrentRatio * r0);
  const nfa0 = round2(d.fixedAssetRatio * r0);
  const cash0 = round2(d.cashRatio * r0);
  const ci = round2(d.currentInvestmentRatio * r0);
  const lease0 = round2(d.leaseRatio * r0);
  const oncaBase = round2(0.05 * r0);
  const onclBase = round2(0.03 * r0);
  const assets0 = inv0 + rec0 + cash0 + ci + oc0 + nfa0 + oncaBase + lease0;
  const nonDebt0 = pay0 + oc0 + lease0 + onclBase;
  const nciBs = d.nciShare * 3;
  const nw0 = (assets0 - nonDebt0) / (1 + d.debtEquity + nciBs);
  const debt0 = d.debtEquity * nw0;
  const shares0 = Math.max(0.5, round2(nw0 / d.bookValuePerShare0));
  const esc0 = round2(shares0 * d.faceValue);
  let s: State = {
    revenue: r0, nfa: nfa0, rec: rec0, inv: inv0, pay: pay0, cash: cash0,
    bnc: round2(debt0 * 0.75), bc: round2(debt0 - round2(debt0 * 0.75)), lease: lease0,
    nci: round2(nciBs * nw0), esc: esc0, oe: round2(nw0 - esc0), shares: shares0,
  };

  const rows: AnnualRow[] = [];
  for (let y = 0; y < SIM_YEARS; y++) {
    const fy = FIRST_FY + y;
    const flags: PeriodFlag[] = isTransition && fy === TRANSITION_FY ? ["transition"] : [];
    const prevNw = s.esc + s.oe;

    // ── Profit and loss ──
    let revenue = round2(s.revenue * (1 + growthAt(d, y, rng)));
    if (isTransition && fy === TRANSITION_FY) revenue = round2(revenue * 1.3);
    revenue = Math.max(1, revenue);
    const opm = clamp(opmAt(d, a, y, rng), -0.5, 0.9);
    const ebitda = round2(revenue * opm);
    const opex = round2(revenue - ebitda);
    const cogs = services ? null : round2(opex * (d.cogsShare ?? 0));
    const depreciation = round2(d.depreciationRate * s.nfa);
    const spike = d.lumpyCapex ? cycleAt(CAPEX_SPIKE, y, d.phase) : 1 + noise(rng, 0.15);
    const capex = round2(Math.max(0, d.capexIntensity * revenue * spike));
    const nfa = round2(s.nfa + capex - depreciation);
    const financeCost = round2(d.interestRate * (s.bnc + s.bc) + 0.09 * s.lease);
    const otherIncome = round2(d.otherIncomeYield * (s.cash + ci));
    let exceptional = 0;
    if (a === "turnaround" && y === 4) exceptional = round2(-0.04 * revenue);
    if (a === "value_trap" && y === 9) exceptional = round2(-0.03 * revenue);
    const pbt = round2(ebitda + otherIncome - depreciation - financeCost + exceptional);
    const tax = round2(d.taxRate * Math.max(pbt, 0));
    const netProfit = round2(pbt - tax);
    const owners = d.nciShare === 0 ? netProfit : round2(netProfit * (1 - d.nciShare));
    const nci = round2(s.nci + netProfit - owners);

    // ── Working capital and operating cash ──
    const days = daysAt(d, a, y, rng);
    const rec = round2((days.debtor / 365) * revenue);
    const inv = round2((days.inventory / 365) * (cogs ?? revenue));
    const pay = round2((days.payable / 365) * (cogs ?? opex));
    const oc = round2(d.otherCurrentRatio * revenue);
    const cfo = round2(netProfit + depreciation - (rec + inv - pay - (s.rec + s.inv - s.pay)));

    // ── Equity issuance ──
    let issuance = 0;
    let issuePb = d.issuePb;
    if (a === "serial_diluter" && y >= 1) issuance = round2(d.issueRate * Math.max(prevNw, 0.2 * s.revenue));
    if (isNewListing && fy === NEW_LISTING_FIRST_FY) {
      issuance = round2(0.25 * Math.max(prevNw, 0.2 * s.revenue));
      issuePb = 3;
    }
    if (a === "loss_maker" && prevNw < 0.4 * s.revenue) {
      issuance = round2(0.5 * s.revenue);
      issuePb = 1.5;
    }
    if (a === "turnaround" && y <= 9 && prevNw < 0.3 * s.revenue) {
      issuance = round2(0.3 * s.revenue);
      issuePb = 1;
    }
    const prevBvps = s.shares > 0 && prevNw > 0 ? prevNw / s.shares : d.faceValue * 2;
    const issuePrice = Math.max(d.faceValue, prevBvps * issuePb);
    const newShares = issuance > 0 ? round2(issuance / issuePrice) : 0;
    const shares = round2(s.shares + newShares);
    const esc = round2(shares * d.faceValue);
    const premium = round2(issuance - (esc - s.esc));

    // ── Dividends ──
    const paysDividend = owners > 0 && d.payout > 0 && !(a === "turnaround" && y < 10);
    const dps = paysDividend ? round2((d.payout * owners) / shares) : 0;
    const dividends = round2(dps * shares);

    // ── Borrowings and cash ──
    const prevDebt = s.bnc + s.bc;
    const target = d.debtEquity * Math.max(prevNw, 0);
    let planned = d.debtEquity === 0 ? 0 : prevNw > 0 ? prevDebt + 0.5 * (target - prevDebt) : prevDebt;
    planned = Math.max(0, planned);
    const bnc = round2(planned * 0.75);
    let bc = round2(planned - bnc);
    const lease = round2(d.leaseRatio * revenue);
    let cash = round2(s.cash + cfo - capex - dividends + (bnc + bc - prevDebt) + issuance);
    const floor = round2(Math.max(1, 0.02 * revenue));
    if (cash < floor) {
      const draw = round2(floor - cash);
      bc = round2(bc + draw);
      cash = round2(cash + draw);
    }

    // ── Balance sheet ──
    const oe = round2(s.oe + owners - dividends + premium);
    const netWorth = round2(esc + oe);
    const tca = round2(inv + rec + cash + ci + oc);
    const tcl = round2(pay + bc + oc);
    const assetSide = round2(tca + nfa + oncaBase + lease);
    const liabilitySide = round2(netWorth + nci + bnc + lease + tcl + onclBase);
    const totalAssets = Math.max(assetSide, liabilitySide);

    const row = emptyAnnualRow(fy, flags);
    row.revenue = revenue;
    row.operating_expenses = opex;
    row.cogs = cogs;
    row.other_income = otherIncome;
    row.depreciation = depreciation;
    row.finance_cost = financeCost;
    row.exceptional_items = exceptional;
    row.pbt = pbt;
    row.tax_expense = tax;
    row.net_profit = netProfit;
    row.net_profit_owners = owners;
    row.dividend_per_share = dps;
    row.equity_share_capital = esc;
    row.other_equity = oe;
    row.non_controlling_interest = nci;
    row.borrowings_non_current = bnc;
    row.borrowings_current = bc;
    row.lease_liabilities = lease;
    row.trade_payables = pay;
    row.total_current_liabilities = tcl;
    row.total_assets = totalAssets;
    row.net_fixed_assets = nfa;
    row.inventories = inv;
    row.trade_receivables = rec;
    row.cash_and_bank = cash;
    row.current_investments = ci;
    row.total_current_assets = tca;
    row.shares_outstanding_ye = shares;
    row.cfo = cfo;
    row.capex = capex;
    row.equity_issuance = issuance;
    rows.push(row);

    s = { revenue, nfa, rec, inv, pay, cash, bnc, bc, lease, nci, esc, oe, shares };
  }
  return rows;
}

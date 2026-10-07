// src/lib/sample/archetypes.ts — sector profiles, archetype overlays and the 150-company roster
// of the synthetic sample (§F.2). Pure data plus small lookup helpers. Every figure here is a
// generator parameter for FICTIONAL companies; none describes a real business.
import type { CompanyType } from "@/lib/contracts";
import type { NounSpec } from "./names";

/** A [low, high] range from which a per-company value is drawn. */
export type Range = readonly [number, number];

export type SectorKey =
  | "it" | "fmcg" | "pharma" | "auto" | "capgoods" | "chem" | "cement" | "metals" | "power" | "realty"
  | "oilgas" | "retail" | "textiles" | "telair" | "holding" | "capmkt"
  | "pvtbank" | "psubank" | "nbfc" | "hfc" | "insurer";

export type GeneratorFamily = "non_financial" | "lender" | "insurer";

/** Behaviour overlay: what the company teaches. Exactly one per company. */
export type Archetype =
  | "typical" | "compounder" | "cyclical" | "cash_rich" | "leveraged_utility" | "value_trap" | "turnaround"
  | "expensive_grower" | "dividend_payer" | "rf_receivables" | "rf_pledge" | "rf_cash" | "serial_diluter"
  | "loss_maker" | "negative_net_worth" | "good_bank" | "stressed_bank";

/** Structural overlay: what the record looks like. Any number per company. */
export type Trait = "new_listing" | "transition" | "standalone" | "no_quarterly" | "no_shareholding" | "type_omitted";

export type PromoterKind = "family" | "mnc" | "psu" | "professional";

/** Seasonal share of the year's revenue in Q1, Q2 and Q3 (Q4 takes the remainder). */
export type Seasonality = readonly [number, number, number];

export interface NonFinancialParams {
  /** Revenue of the unpublished opening year FY2015, ₹ crore. */
  revenue: Range;
  /** Trend growth per year (fraction). */
  growth: Range;
  /** Operating (EBITDA) margin (fraction). */
  opm: Range;
  /** Share of operating expenses that is cost of goods sold; null for service businesses (COGS not reported). */
  cogsShare: Range | null;
  debtorDays: Range;
  /** Days of COGS (or of sales when there is no COGS). 0 for businesses that hold no stock. */
  inventoryDays: Range;
  /** Days of COGS (or of operating expenses when there is no COGS). */
  payableDays: Range;
  /** Opening net fixed assets ÷ revenue. */
  fixedAssetRatio: Range;
  /** Depreciation ÷ opening net fixed assets. */
  depreciationRate: Range;
  /** Capex ÷ revenue. */
  capexIntensity: Range;
  /** Target borrowings ÷ net worth. */
  debtEquity: Range;
  /** Lease liabilities ÷ revenue. */
  leaseRatio: Range;
  /** Opening cash ÷ revenue. */
  cashRatio: Range;
  /** Current investments ÷ opening revenue (held constant). */
  currentInvestmentRatio: Range;
  taxRate: Range;
  /** Dividends ÷ owners' profit. */
  payout: Range;
  /** Minority (non-controlling) share of profit. */
  nciShare: Range;
  /** Other income ÷ opening cash and current investments. */
  otherIncomeYield: Range;
  /** Other current assets = other current liabilities = this × revenue. */
  otherCurrentRatio: Range;
  /** Amplitude applied to the integer cycle table (fraction of growth). */
  cycleAmp: number;
  /** Margin swing applied with the cycle table (fraction of revenue). */
  marginCycle: number;
  /** Amplitude of yearly growth noise. */
  noiseAmp: number;
  /** Capacity-expansion capex spikes (cement, metals, power). */
  lumpyCapex: boolean;
}

export interface LenderParams {
  /** Gross advances in the opening year, ₹ crore. */
  grossAdvances: Range;
  growth: Range;
  /** Interest yield on average advances. */
  yieldOnAdvances: Range;
  /** Investments ÷ advances. */
  investmentRatio: Range;
  yieldOnInvestments: Range;
  /** Cash and bank ÷ advances. */
  cashRatio: Range;
  /** Other assets ÷ advances. */
  otherAssetRatio: Range;
  /** Borrowings ÷ total assets (banks); null = borrowings fund everything not covered by equity (NBFCs, HFCs). */
  borrowingRatio: Range | null;
  /** Cost of deposits and borrowings. */
  costOfFunds: Range;
  /** Fee and other income ÷ average advances. */
  feeRatio: Range;
  costToIncome: Range;
  /** Provisions ÷ average advances in a normal year. */
  creditCost: Range;
  /** Gross NPA ÷ gross advances in a normal year. */
  gnpa: Range;
  provisionCoverage: Range;
  /** Minimum net worth ÷ total assets; below it the lender raises equity. */
  capitalRatio: Range;
  /** Depreciation ÷ operating expenses. */
  depreciationShare: Range;
  taxRate: Range;
  payout: Range;
  /** Other liabilities ÷ total assets. */
  otherLiabilityRatio: Range;
}

export interface InsurerParams {
  revenue: Range;
  growth: Range;
  /** Profit before tax ÷ revenue. */
  margin: Range;
  taxRate: Range;
  payout: Range;
  /** Total assets ÷ net worth (policyholder funds make insurers asset-heavy). */
  assetMultiple: Range;
  /** Cash and bank ÷ total assets. */
  cashRatio: Range;
}

export interface SectorSpec {
  key: SectorKey;
  family: GeneratorFamily;
  sector: string;
  industries: readonly string[];
  nouns: readonly NounSpec[];
  companyType: CompanyType;
  promoter: readonly PromoterKind[];
  seasonality: Seasonality;
  /** Price-to-earnings range used to set the reference price. */
  pe: Range;
  /** Price-to-sales range used when earnings are not positive. */
  ps: Range;
  faceValues: readonly number[];
  nf: NonFinancialParams | null;
  lender: LenderParams | null;
  insurer: InsurerParams | null;
}

// ── Non-financial parameter helper ──────────────────────────────────────────
function nf(p: Partial<NonFinancialParams> & Pick<NonFinancialParams, "revenue" | "growth" | "opm" | "cogsShare">): NonFinancialParams {
  return {
    debtorDays: [40, 70],
    inventoryDays: [40, 70],
    payableDays: [40, 70],
    fixedAssetRatio: [0.4, 0.6],
    depreciationRate: [0.07, 0.09],
    capexIntensity: [0.04, 0.06],
    debtEquity: [0.2, 0.5],
    leaseRatio: [0.003, 0.01],
    cashRatio: [0.04, 0.08],
    currentInvestmentRatio: [0.02, 0.05],
    taxRate: [0.25, 0.27],
    payout: [0.15, 0.3],
    nciShare: [0, 0.03],
    otherIncomeYield: [0.06, 0.07],
    otherCurrentRatio: [0.04, 0.07],
    cycleAmp: 0.03,
    marginCycle: 0.01,
    noiseAmp: 0.03,
    lumpyCapex: false,
    ...p,
  };
}

const n = (noun: string, code: string): NounSpec => ({ noun, code });

export const SECTORS: Readonly<Record<SectorKey, SectorSpec>> = {
  it: {
    key: "it", family: "non_financial", sector: "IT services", companyType: "non_financial",
    industries: ["IT services", "Software products", "Engineering services"],
    nouns: [n("Infotech", "INFO"), n("Software", "SOFT"), n("Digital Systems", "DIGI"), n("Technologies", "TECH")],
    promoter: ["professional", "family", "mnc"], seasonality: [0.245, 0.25, 0.252], pe: [22, 32], ps: [2, 4], faceValues: [1, 2, 5],
    nf: nf({
      revenue: [300, 12000], growth: [0.08, 0.14], opm: [0.18, 0.26], cogsShare: null,
      debtorDays: [55, 80], inventoryDays: [0, 0], payableDays: [15, 30], fixedAssetRatio: [0.12, 0.25],
      depreciationRate: [0.12, 0.16], capexIntensity: [0.025, 0.04], debtEquity: [0, 0.05], leaseRatio: [0.01, 0.03],
      cashRatio: [0.15, 0.3], currentInvestmentRatio: [0.05, 0.15], taxRate: [0.24, 0.27], payout: [0.35, 0.55],
      nciShare: [0, 0.01], otherIncomeYield: [0.06, 0.075], otherCurrentRatio: [0.06, 0.1], cycleAmp: 0.02, noiseAmp: 0.03,
    }),
    lender: null, insurer: null,
  },
  fmcg: {
    key: "fmcg", family: "non_financial", sector: "FMCG", companyType: "non_financial",
    industries: ["Packaged foods", "Personal care", "Beverages"],
    nouns: [n("Consumer Products", "CONS"), n("Foods", "FOOD"), n("Home Care", "HOME")],
    promoter: ["mnc", "family"], seasonality: [0.24, 0.25, 0.26], pe: [40, 60], ps: [3, 6], faceValues: [1, 2, 10],
    nf: nf({
      revenue: [400, 10000], growth: [0.07, 0.12], opm: [0.14, 0.22], cogsShare: [0.62, 0.72],
      debtorDays: [10, 25], inventoryDays: [30, 50], payableDays: [40, 60], fixedAssetRatio: [0.2, 0.35],
      depreciationRate: [0.08, 0.11], capexIntensity: [0.03, 0.05], debtEquity: [0, 0.1], leaseRatio: [0.005, 0.015],
      cashRatio: [0.06, 0.12], currentInvestmentRatio: [0.03, 0.08], taxRate: [0.25, 0.27], payout: [0.5, 0.75],
      nciShare: [0, 0.02], cycleAmp: 0.015, noiseAmp: 0.025,
    }),
    lender: null, insurer: null,
  },
  pharma: {
    key: "pharma", family: "non_financial", sector: "Pharmaceuticals", companyType: "non_financial",
    industries: ["Formulations", "Bulk drugs (APIs)", "Contract manufacturing"],
    nouns: [n("Pharmaceuticals", "PHAR"), n("Lifesciences", "LIFE"), n("Remedies", "REM")],
    promoter: ["family"], seasonality: [0.245, 0.255, 0.25], pe: [25, 38], ps: [2, 4], faceValues: [1, 2],
    nf: nf({
      revenue: [300, 8000], growth: [0.08, 0.13], opm: [0.17, 0.25], cogsShare: [0.45, 0.55],
      debtorDays: [70, 100], inventoryDays: [100, 140], payableDays: [60, 90], fixedAssetRatio: [0.4, 0.6],
      depreciationRate: [0.07, 0.09], capexIntensity: [0.05, 0.08], debtEquity: [0.1, 0.35],
      taxRate: [0.22, 0.26], payout: [0.15, 0.3], otherCurrentRatio: [0.05, 0.08], cycleAmp: 0.02,
    }),
    lender: null, insurer: null,
  },
  auto: {
    key: "auto", family: "non_financial", sector: "Automobiles and auto parts", companyType: "non_financial",
    industries: ["Two-wheelers", "Commercial vehicles", "Auto components", "Tyres"],
    nouns: [n("Motors", "MOTO"), n("Auto Components", "AUTO"), n("Drivetrain", "DRIV"), n("Wheels", "WHL")],
    promoter: ["family", "mnc"], seasonality: [0.23, 0.25, 0.27], pe: [18, 28], ps: [0.8, 1.6], faceValues: [2, 5, 10],
    nf: nf({
      revenue: [500, 20000], growth: [0.06, 0.11], opm: [0.1, 0.15], cogsShare: [0.72, 0.8],
      debtorDays: [25, 45], inventoryDays: [30, 50], payableDays: [55, 80], fixedAssetRatio: [0.4, 0.6],
      depreciationRate: [0.08, 0.1], capexIntensity: [0.05, 0.07], debtEquity: [0.2, 0.5], leaseRatio: [0.005, 0.01],
      payout: [0.2, 0.35], nciShare: [0, 0.04], cycleAmp: 0.05, marginCycle: 0.015, noiseAmp: 0.04,
    }),
    lender: null, insurer: null,
  },
  capgoods: {
    key: "capgoods", family: "non_financial", sector: "Capital goods", companyType: "non_financial",
    industries: ["Industrial machinery", "Electrical equipment", "Engineering and construction"],
    nouns: [n("Engineering", "ENGG"), n("Industries", "IND"), n("Machines", "MACH"), n("Electricals", "ELEC")],
    promoter: ["family", "mnc"], seasonality: [0.2, 0.23, 0.24], pe: [28, 40], ps: [1.5, 3], faceValues: [2, 10],
    nf: nf({
      revenue: [300, 8000], growth: [0.08, 0.13], opm: [0.1, 0.14], cogsShare: [0.65, 0.75],
      debtorDays: [80, 110], inventoryDays: [60, 90], payableDays: [80, 110], fixedAssetRatio: [0.25, 0.4],
      depreciationRate: [0.07, 0.09], capexIntensity: [0.03, 0.05], debtEquity: [0.2, 0.5], leaseRatio: [0.004, 0.01],
      cashRatio: [0.05, 0.1], payout: [0.2, 0.35], otherCurrentRatio: [0.06, 0.1], cycleAmp: 0.04, marginCycle: 0.01, noiseAmp: 0.04,
    }),
    lender: null, insurer: null,
  },
  chem: {
    key: "chem", family: "non_financial", sector: "Specialty chemicals", companyType: "non_financial",
    industries: ["Specialty chemicals", "Agrochemicals", "Pigments and dyes"],
    nouns: [n("Chemicals", "CHEM"), n("Polymers", "POLY"), n("Specialities", "SPEC")],
    promoter: ["family"], seasonality: [0.25, 0.25, 0.24], pe: [28, 40], ps: [2, 4], faceValues: [1, 2, 5],
    nf: nf({
      revenue: [200, 3000], growth: [0.1, 0.15], opm: [0.16, 0.23], cogsShare: [0.65, 0.75],
      debtorDays: [60, 85], inventoryDays: [70, 100], payableDays: [50, 75], fixedAssetRatio: [0.6, 0.9],
      depreciationRate: [0.06, 0.08], capexIntensity: [0.07, 0.1], debtEquity: [0.2, 0.5], leaseRatio: [0.003, 0.008],
      taxRate: [0.24, 0.26], payout: [0.15, 0.25], cycleAmp: 0.04, marginCycle: 0.015, noiseAmp: 0.04,
    }),
    lender: null, insurer: null,
  },
  cement: {
    key: "cement", family: "non_financial", sector: "Cement", companyType: "non_financial",
    industries: ["Cement"],
    nouns: [n("Cements", "CEM")],
    promoter: ["family", "mnc"], seasonality: [0.26, 0.21, 0.24], pe: [24, 36], ps: [1.5, 3], faceValues: [10],
    nf: nf({
      revenue: [500, 10000], growth: [0.06, 0.1], opm: [0.16, 0.22], cogsShare: [0.4, 0.5],
      debtorDays: [15, 25], inventoryDays: [40, 55], payableDays: [45, 60], fixedAssetRatio: [1, 1.4],
      depreciationRate: [0.045, 0.055], capexIntensity: [0.08, 0.12], debtEquity: [0.3, 0.7], leaseRatio: [0.001, 0.003],
      cashRatio: [0.04, 0.08], payout: [0.15, 0.25], nciShare: [0, 0.02], cycleAmp: 0.06, marginCycle: 0.02, noiseAmp: 0.04,
      lumpyCapex: true,
    }),
    lender: null, insurer: null,
  },
  metals: {
    key: "metals", family: "non_financial", sector: "Metals and mining", companyType: "non_financial",
    industries: ["Steel", "Aluminium", "Mining"],
    nouns: [n("Metals", "METL"), n("Alloys", "ALOY"), n("Minerals", "MIN")],
    promoter: ["family", "psu"], seasonality: [0.24, 0.24, 0.25], pe: [8, 14], ps: [0.5, 1.2], faceValues: [1, 10],
    nf: nf({
      revenue: [1000, 30000], growth: [0.05, 0.09], opm: [0.13, 0.2], cogsShare: [0.7, 0.78],
      debtorDays: [20, 35], inventoryDays: [60, 90], payableDays: [50, 80], fixedAssetRatio: [0.8, 1.2],
      depreciationRate: [0.05, 0.06], capexIntensity: [0.07, 0.1], debtEquity: [0.5, 1], leaseRatio: [0.002, 0.005],
      payout: [0.15, 0.3], nciShare: [0, 0.04], cycleAmp: 0.1, marginCycle: 0.03, noiseAmp: 0.05, lumpyCapex: true,
    }),
    lender: null, insurer: null,
  },
  power: {
    key: "power", family: "non_financial", sector: "Power utilities", companyType: "non_financial",
    industries: ["Power generation", "Power distribution", "Renewable energy"],
    nouns: [n("Power", "POWR"), n("Energy", "ENRG"), n("Utilities", "UTIL")],
    promoter: ["psu", "family"], seasonality: [0.27, 0.25, 0.23], pe: [12, 18], ps: [1, 2.5], faceValues: [10],
    nf: nf({
      revenue: [800, 15000], growth: [0.06, 0.09], opm: [0.3, 0.4], cogsShare: [0.55, 0.7],
      debtorDays: [50, 80], inventoryDays: [15, 30], payableDays: [40, 60], fixedAssetRatio: [2.2, 3],
      depreciationRate: [0.035, 0.045], capexIntensity: [0.12, 0.18], debtEquity: [1, 1.4], leaseRatio: [0.001, 0.003],
      cashRatio: [0.04, 0.07], currentInvestmentRatio: [0.01, 0.03], taxRate: [0.2, 0.25], payout: [0.25, 0.4],
      nciShare: [0, 0.05], cycleAmp: 0.02, noiseAmp: 0.03, lumpyCapex: true,
    }),
    lender: null, insurer: null,
  },
  realty: {
    key: "realty", family: "non_financial", sector: "Real estate", companyType: "non_financial",
    industries: ["Residential development", "Commercial leasing"],
    nouns: [n("Realty", "REAL"), n("Estates", "EST"), n("Developers", "DEV")],
    promoter: ["family"], seasonality: [0.2, 0.22, 0.25], pe: [25, 40], ps: [3, 6], faceValues: [2, 10],
    nf: nf({
      revenue: [200, 3000], growth: [0.06, 0.12], opm: [0.18, 0.26], cogsShare: [0.7, 0.8],
      debtorDays: [30, 60], inventoryDays: [250, 380], payableDays: [90, 150], fixedAssetRatio: [0.1, 0.25],
      depreciationRate: [0.05, 0.07], capexIntensity: [0.02, 0.04], debtEquity: [0.3, 0.7], leaseRatio: [0.001, 0.003],
      cashRatio: [0.05, 0.1], payout: [0.05, 0.15], nciShare: [0, 0.05], cycleAmp: 0.12, marginCycle: 0.02, noiseAmp: 0.08,
    }),
    lender: null, insurer: null,
  },
  oilgas: {
    key: "oilgas", family: "non_financial", sector: "Oil and gas", companyType: "non_financial",
    industries: ["Refining and marketing", "Gas distribution", "Exploration and production"],
    nouns: [n("Petroleum", "PETRO"), n("Gas", "GAS"), n("Hydrocarbons", "HYD")],
    promoter: ["psu", "family"], seasonality: [0.25, 0.24, 0.26], pe: [8, 13], ps: [0.3, 0.8], faceValues: [10],
    nf: nf({
      revenue: [3000, 50000], growth: [0.04, 0.08], opm: [0.1, 0.16], cogsShare: [0.85, 0.92],
      debtorDays: [10, 20], inventoryDays: [25, 40], payableDays: [25, 40], fixedAssetRatio: [0.4, 0.6],
      depreciationRate: [0.05, 0.06], capexIntensity: [0.05, 0.07], debtEquity: [0.4, 0.8], leaseRatio: [0.002, 0.005],
      cashRatio: [0.02, 0.05], payout: [0.3, 0.45], cycleAmp: 0.08, marginCycle: 0.015, noiseAmp: 0.05,
    }),
    lender: null, insurer: null,
  },
  retail: {
    key: "retail", family: "non_financial", sector: "Retail", companyType: "non_financial",
    industries: ["Apparel retail", "Grocery retail", "Consumer electronics retail"],
    nouns: [n("Retail", "RETL"), n("Stores", "STOR"), n("Lifestyle", "LIFE")],
    promoter: ["family"], seasonality: [0.23, 0.25, 0.29], pe: [50, 80], ps: [1, 3], faceValues: [1, 2, 10],
    nf: nf({
      revenue: [300, 5000], growth: [0.12, 0.18], opm: [0.09, 0.13], cogsShare: [0.75, 0.82],
      debtorDays: [2, 8], inventoryDays: [60, 90], payableDays: [40, 60], fixedAssetRatio: [0.25, 0.4],
      depreciationRate: [0.1, 0.13], capexIntensity: [0.05, 0.07], debtEquity: [0.1, 0.3], leaseRatio: [0.18, 0.3],
      cashRatio: [0.03, 0.06], currentInvestmentRatio: [0.01, 0.03], payout: [0, 0.1], nciShare: [0, 0],
      cycleAmp: 0.02, noiseAmp: 0.04,
    }),
    lender: null, insurer: null,
  },
  textiles: {
    key: "textiles", family: "non_financial", sector: "Textiles", companyType: "non_financial",
    industries: ["Yarn and fabrics", "Home textiles", "Garments"],
    nouns: [n("Textiles", "TEX"), n("Fabrics", "FAB"), n("Spinning Mills", "SPIN")],
    promoter: ["family"], seasonality: [0.24, 0.25, 0.26], pe: [12, 20], ps: [0.4, 1], faceValues: [2, 10],
    nf: nf({
      revenue: [200, 3000], growth: [0.04, 0.08], opm: [0.09, 0.14], cogsShare: [0.68, 0.76],
      debtorDays: [50, 75], inventoryDays: [80, 120], payableDays: [30, 50], fixedAssetRatio: [0.5, 0.8],
      depreciationRate: [0.06, 0.08], capexIntensity: [0.04, 0.06], debtEquity: [0.5, 0.9], leaseRatio: [0.002, 0.005],
      cashRatio: [0.02, 0.05], currentInvestmentRatio: [0.01, 0.03], payout: [0.1, 0.2], nciShare: [0, 0.02],
      cycleAmp: 0.05, marginCycle: 0.015, noiseAmp: 0.05,
    }),
    lender: null, insurer: null,
  },
  telair: {
    key: "telair", family: "non_financial", sector: "Telecom and aviation", companyType: "non_financial",
    industries: ["Telecom services", "Airlines"],
    nouns: [n("Telelink", "TELE"), n("Airways", "AIR")],
    promoter: ["family", "professional"], seasonality: [0.25, 0.24, 0.26], pe: [25, 40], ps: [1, 2.5], faceValues: [10],
    nf: nf({
      revenue: [1000, 15000], growth: [0.06, 0.12], opm: [0.18, 0.3], cogsShare: null,
      debtorDays: [15, 30], inventoryDays: [0, 0], payableDays: [60, 90], fixedAssetRatio: [1, 1.6],
      depreciationRate: [0.08, 0.1], capexIntensity: [0.1, 0.15], debtEquity: [1.2, 1.8], leaseRatio: [0.25, 0.4],
      cashRatio: [0.04, 0.07], currentInvestmentRatio: [0.01, 0.03], taxRate: [0.25, 0.26], payout: [0, 0.1],
      nciShare: [0, 0.02], cycleAmp: 0.04, noiseAmp: 0.05,
    }),
    lender: null, insurer: null,
  },
  holding: {
    key: "holding", family: "non_financial", sector: "Diversified holding companies", companyType: "non_financial",
    industries: ["Holding company"],
    nouns: [n("Holdings", "HOLD"), n("Investments", "INV")],
    promoter: ["family"], seasonality: [0.25, 0.25, 0.25], pe: [10, 16], ps: [5, 9], faceValues: [10],
    nf: nf({
      revenue: [40, 200], growth: [0.05, 0.1], opm: [0.75, 0.9], cogsShare: null,
      debtorDays: [0, 5], inventoryDays: [0, 0], payableDays: [5, 10], fixedAssetRatio: [0.05, 0.1],
      depreciationRate: [0.05, 0.05], capexIntensity: [0.005, 0.01], debtEquity: [0, 0.05], leaseRatio: [0, 0],
      cashRatio: [0.5, 1], currentInvestmentRatio: [8, 14], taxRate: [0.2, 0.25], payout: [0.3, 0.5],
      nciShare: [0, 0], otherIncomeYield: [0.01, 0.02], otherCurrentRatio: [0.02, 0.03], cycleAmp: 0.03, noiseAmp: 0.06,
    }),
    lender: null, insurer: null,
  },
  capmkt: {
    key: "capmkt", family: "non_financial", sector: "Capital markets", companyType: "other_financial",
    industries: ["Stockbroking", "Asset management"],
    nouns: [n("Securities", "SEC"), n("Asset Managers", "AMC")],
    promoter: ["family", "professional"], seasonality: [0.24, 0.25, 0.25], pe: [22, 35], ps: [5, 10], faceValues: [1, 2, 5],
    nf: nf({
      revenue: [80, 1500], growth: [0.12, 0.2], opm: [0.35, 0.5], cogsShare: null,
      debtorDays: [5, 20], inventoryDays: [0, 0], payableDays: [5, 20], fixedAssetRatio: [0.05, 0.15],
      depreciationRate: [0.1, 0.15], capexIntensity: [0.02, 0.04], debtEquity: [0, 0.2], leaseRatio: [0.02, 0.04],
      cashRatio: [0.4, 0.8], currentInvestmentRatio: [0.3, 0.6], payout: [0.3, 0.6], nciShare: [0, 0.01],
      otherCurrentRatio: [0.1, 0.2], cycleAmp: 0.08, noiseAmp: 0.06,
    }),
    lender: null, insurer: null,
  },
  pvtbank: {
    key: "pvtbank", family: "lender", sector: "Banks", companyType: "bank",
    industries: ["Private sector bank"],
    nouns: [n("Bank", "BANK")],
    promoter: ["professional", "family"], seasonality: [0.24, 0.25, 0.255], pe: [14, 22], ps: [2, 4], faceValues: [1, 2, 10],
    nf: null, insurer: null,
    lender: {
      grossAdvances: [10000, 150000], growth: [0.13, 0.19], yieldOnAdvances: [0.088, 0.098], investmentRatio: [0.3, 0.38],
      yieldOnInvestments: [0.065, 0.072], cashRatio: [0.06, 0.09], otherAssetRatio: [0.03, 0.05], borrowingRatio: [0.08, 0.14],
      costOfFunds: [0.048, 0.055], feeRatio: [0.011, 0.016], costToIncome: [0.42, 0.5], creditCost: [0.006, 0.012],
      gnpa: [0.015, 0.03], provisionCoverage: [0.65, 0.8], capitalRatio: [0.1, 0.12], depreciationShare: [0.05, 0.07],
      taxRate: [0.25, 0.26], payout: [0.1, 0.2], otherLiabilityRatio: [0.03, 0.05],
    },
  },
  psubank: {
    key: "psubank", family: "lender", sector: "Banks", companyType: "bank",
    industries: ["Public sector bank"],
    nouns: [n("Bank", "BANK")],
    promoter: ["psu"], seasonality: [0.245, 0.25, 0.25], pe: [6, 10], ps: [0.6, 1.2], faceValues: [10],
    nf: null, insurer: null,
    lender: {
      grossAdvances: [80000, 400000], growth: [0.05, 0.09], yieldOnAdvances: [0.08, 0.088], investmentRatio: [0.35, 0.42],
      yieldOnInvestments: [0.065, 0.07], cashRatio: [0.06, 0.08], otherAssetRatio: [0.04, 0.06], borrowingRatio: [0.05, 0.08],
      costOfFunds: [0.047, 0.052], feeRatio: [0.009, 0.012], costToIncome: [0.48, 0.54], creditCost: [0.01, 0.015],
      gnpa: [0.04, 0.06], provisionCoverage: [0.6, 0.75], capitalRatio: [0.06, 0.075], depreciationShare: [0.05, 0.07],
      taxRate: [0.25, 0.26], payout: [0.1, 0.2], otherLiabilityRatio: [0.03, 0.05],
    },
  },
  nbfc: {
    key: "nbfc", family: "lender", sector: "Finance", companyType: "nbfc",
    industries: ["Vehicle finance", "Gold loans", "Consumer finance", "Microfinance"],
    nouns: [n("Finance", "FIN"), n("Fincorp", "FINC"), n("Credit", "CRED")],
    promoter: ["family", "professional"], seasonality: [0.24, 0.25, 0.255], pe: [18, 30], ps: [3, 6], faceValues: [2, 10],
    nf: null, insurer: null,
    lender: {
      grossAdvances: [2000, 50000], growth: [0.16, 0.24], yieldOnAdvances: [0.13, 0.17], investmentRatio: [0.05, 0.1],
      yieldOnInvestments: [0.065, 0.07], cashRatio: [0.03, 0.05], otherAssetRatio: [0.02, 0.03], borrowingRatio: null,
      costOfFunds: [0.08, 0.09], feeRatio: [0.01, 0.02], costToIncome: [0.32, 0.42], creditCost: [0.015, 0.025],
      gnpa: [0.025, 0.045], provisionCoverage: [0.5, 0.65], capitalRatio: [0.14, 0.18], depreciationShare: [0.03, 0.05],
      taxRate: [0.25, 0.26], payout: [0.1, 0.2], otherLiabilityRatio: [0.02, 0.03],
    },
  },
  hfc: {
    key: "hfc", family: "lender", sector: "Finance", companyType: "nbfc",
    industries: ["Housing finance"],
    nouns: [n("Housing Finance", "HFL"), n("Home Finance", "HOME")],
    promoter: ["professional", "family"], seasonality: [0.245, 0.25, 0.25], pe: [10, 16], ps: [2, 4], faceValues: [2, 10],
    nf: null, insurer: null,
    lender: {
      grossAdvances: [5000, 60000], growth: [0.11, 0.15], yieldOnAdvances: [0.092, 0.1], investmentRatio: [0.04, 0.08],
      yieldOnInvestments: [0.065, 0.07], cashRatio: [0.02, 0.04], otherAssetRatio: [0.01, 0.02], borrowingRatio: null,
      costOfFunds: [0.074, 0.08], feeRatio: [0.003, 0.006], costToIncome: [0.15, 0.25], creditCost: [0.003, 0.006],
      gnpa: [0.015, 0.03], provisionCoverage: [0.4, 0.55], capitalRatio: [0.1, 0.13], depreciationShare: [0.04, 0.06],
      taxRate: [0.23, 0.25], payout: [0.15, 0.25], otherLiabilityRatio: [0.015, 0.025],
    },
  },
  insurer: {
    key: "insurer", family: "insurer", sector: "Insurance", companyType: "insurance",
    industries: ["Life insurance", "General insurance"],
    nouns: [n("Life Insurance", "LIFE"), n("General Insurance", "GIC")],
    promoter: ["mnc", "family"], seasonality: [0.21, 0.24, 0.25], pe: [40, 70], ps: [1, 3], faceValues: [10],
    nf: null, lender: null,
    insurer: {
      revenue: [1500, 20000], growth: [0.12, 0.18], margin: [0.03, 0.07], taxRate: [0.15, 0.25], payout: [0.15, 0.3],
      assetMultiple: [6, 12], cashRatio: [0.01, 0.02],
    },
  },
};

/** Order in which sectors appear in the roster (and so in the dataset). */
export const SECTOR_ORDER: readonly SectorKey[] = [
  "it", "fmcg", "pharma", "auto", "capgoods", "chem", "cement", "metals", "power", "realty", "oilgas", "retail",
  "textiles", "telair", "holding", "capmkt", "pvtbank", "psubank", "nbfc", "hfc", "insurer",
];

/**
 * Roster codes per sector: "archetype" or "archetype+trait+trait". The list length is the number
 * of companies in that sector (§F.2). Append only, so existing companies keep their slugs.
 */
export const ROSTER_CODES: Readonly<Record<SectorKey, readonly string[]>> = {
  it: ["compounder", "compounder", "compounder", "cash_rich", "cash_rich", "cash_rich", "expensive_grower", "dividend_payer",
    "typical", "typical+new_listing", "typical", "typical"],
  fmcg: ["compounder", "compounder", "compounder", "cash_rich", "expensive_grower", "dividend_payer", "typical",
    "typical+type_omitted", "typical", "typical"],
  pharma: ["compounder", "compounder", "cash_rich", "turnaround", "dividend_payer", "rf_receivables", "typical+standalone",
    "typical", "typical", "typical"],
  auto: ["compounder", "cyclical", "value_trap", "turnaround", "loss_maker", "typical+standalone", "typical", "typical",
    "typical", "typical"],
  capgoods: ["compounder", "value_trap", "turnaround", "expensive_grower", "rf_receivables", "serial_diluter",
    "typical+transition", "typical+no_shareholding", "typical", "typical"],
  chem: ["compounder", "compounder", "cyclical", "expensive_grower", "rf_cash", "typical+new_listing", "typical", "typical",
    "typical", "typical"],
  cement: ["cyclical", "cyclical", "cyclical", "dividend_payer", "typical+standalone", "typical+type_omitted", "typical", "typical"],
  metals: ["cyclical", "cyclical", "cyclical", "cyclical", "value_trap", "typical+no_quarterly", "typical", "typical"],
  power: ["leveraged_utility", "leveraged_utility", "leveraged_utility", "leveraged_utility", "leveraged_utility",
    "leveraged_utility", "typical", "typical"],
  realty: ["value_trap", "turnaround", "rf_pledge", "rf_cash", "serial_diluter", "negative_net_worth", "typical", "typical"],
  oilgas: ["cyclical", "value_trap", "dividend_payer", "dividend_payer", "typical", "typical"],
  retail: ["compounder", "expensive_grower", "expensive_grower+new_listing", "loss_maker", "typical", "typical"],
  textiles: ["value_trap", "turnaround", "rf_pledge", "loss_maker", "typical+standalone", "typical+no_quarterly"],
  telair: ["turnaround", "serial_diluter", "loss_maker", "negative_net_worth"],
  holding: ["typical+no_shareholding", "typical+no_quarterly"],
  capmkt: ["compounder", "cash_rich", "typical+new_listing", "typical"],
  pvtbank: ["good_bank", "good_bank", "good_bank", "good_bank", "good_bank", "stressed_bank", "typical+type_omitted", "typical"],
  psubank: ["good_bank", "stressed_bank", "stressed_bank", "stressed_bank"],
  nbfc: ["typical+type_omitted", "typical+no_quarterly", "typical", "typical", "typical", "typical", "typical", "typical"],
  hfc: ["typical+type_omitted", "typical+no_shareholding", "typical", "typical"],
  insurer: ["typical+type_omitted", "typical", "typical", "typical"],
};

const ARCHETYPES: readonly Archetype[] = [
  "typical", "compounder", "cyclical", "cash_rich", "leveraged_utility", "value_trap", "turnaround", "expensive_grower",
  "dividend_payer", "rf_receivables", "rf_pledge", "rf_cash", "serial_diluter", "loss_maker", "negative_net_worth",
  "good_bank", "stressed_bank",
];
const TRAITS: readonly Trait[] = ["new_listing", "transition", "standalone", "no_quarterly", "no_shareholding", "type_omitted"];

/** One company of the roster. */
export interface RosterEntry {
  /** Stable id used to seed the company's PRNG, e.g. "it-01". */
  slug: string;
  /** Position in the roster (0-based); picks the name stem. */
  index: number;
  sectorKey: SectorKey;
  /** Position within the sector (0-based); picks industry and noun. */
  sectorIndex: number;
  archetype: Archetype;
  traits: readonly Trait[];
}

function parseCode(code: string): { archetype: Archetype; traits: Trait[] } {
  const [head, ...rest] = code.split("+");
  const archetype = ARCHETYPES.find((a) => a === head);
  if (!archetype) throw new Error(`Unknown archetype "${head}" in roster`);
  const traits = rest.map((t) => {
    const trait = TRAITS.find((x) => x === t);
    if (!trait) throw new Error(`Unknown trait "${t}" in roster`);
    return trait;
  });
  return { archetype, traits };
}

/** The full 150-company roster, in dataset order. Pure; returns a fresh array. */
export function buildRoster(): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const key of SECTOR_ORDER) {
    ROSTER_CODES[key].forEach((code, sectorIndex) => {
      const { archetype, traits } = parseCode(code);
      out.push({
        slug: `${key}-${String(sectorIndex + 1).padStart(2, "0")}`,
        index: out.length,
        sectorKey: key,
        sectorIndex,
        archetype,
        traits,
      });
    });
  }
  return out;
}

/** Number of companies in the bundled sample (§F.1). */
export const SAMPLE_COUNT = 150;

// ── Teaching notes (sample_note) ─────────────────────────────────────────────
const ARCHETYPE_NOTE: Readonly<Record<Archetype, string>> = {
  typical: "A typical company for its sector with no special pattern. It is here so that its peer group has enough members for medians and percentiles.",
  compounder: "A steady compounder: sales and profit grow at a double-digit pace, returns on capital stay high and borrowing is low. Use it to see how a long record shows up in 5-year averages and CAGRs.",
  cyclical: "A cyclical business: sales and margins rise and fall with an industry cycle. Its P/E looks lowest when profits are at a peak, which is why one-year ratios can mislead for such companies.",
  cash_rich: "Cash-rich and debt-free: there are no borrowings and no finance cost, so interest coverage is not meaningful. Much of its other income is interest on surplus cash.",
  leveraged_utility: "A leveraged utility: heavy fixed assets funded largely with debt. Debt to equity is high and interest coverage is thin, which is common for power businesses but still worth understanding.",
  value_trap: "A possible value trap: the P/E is low, but sales are shrinking and margins are slipping. A low multiple on falling earnings can stay low.",
  turnaround: "A turnaround: several loss-making years followed by a return to profit. Growth rates across the change from loss to profit are not meaningful and are marked as turnarounds.",
  expensive_grower: "A fast grower with a rich valuation: sales grow quickly and the P/E is very high. Compare its growth with its valuation before drawing conclusions.",
  dividend_payer: "A steady dividend payer: most of the profit is paid out every year and growth is modest. Look at the payout ratio, the dividend yield and the years of dividend in a row.",
  rf_receivables: "A red-flag teaching case: debtor days have risen sharply in recent years while sales growth stayed slow, so more of the reported sales are still waiting to be collected.",
  rf_pledge: "A red-flag teaching case: a large and rising share of the promoters' holding is pledged as security for loans.",
  rf_cash: "A red-flag teaching case: reported profit has not turned into operating cash, because rising receivables and inventories keep absorbing it.",
  serial_diluter: "A serial diluter: it issues new shares almost every year, so profit per share grows more slowly than total profit and existing holders own a smaller slice.",
  loss_maker: "A loss-maker: operating losses every year, funded by fresh equity and borrowings. P/E is not meaningful, so its reference price is set on sales.",
  negative_net_worth: "Negative net worth: accumulated losses exceed the capital put in, so ROE, P/B and debt to equity are not meaningful.",
  good_bank: "A well-run lender: steady loan growth, few bad loans and healthy returns on assets. Lender metrics such as NIM, GNPA and credit cost apply; ROCE and debt to equity do not.",
  stressed_bank: "A stressed lender: bad loans rose sharply in the middle years, provisions caused losses and fresh capital was needed. Asset quality has improved since then.",
};

const TRAIT_NOTE: Readonly<Record<Trait, string>> = {
  new_listing: "Listed recently: only four financial years of statements are available, so 5-year and 10-year figures show 'not enough history'.",
  transition: "FY2021 is flagged as a transition year because a merger enlarged the business, so growth and averages that span it are not comparable.",
  standalone: "Its statements are on a standalone basis, so there is no minority interest.",
  no_quarterly: "No quarterly results are included, so TTM figures fall back to the latest financial year.",
  no_shareholding: "No shareholding pattern is included, so promoter and institutional holding figures are not available.",
  type_omitted: "Its company type is left blank on purpose, so the app infers it from the sector name.",
};

const TYPICAL_FAMILY_NOTE: Readonly<Record<GeneratorFamily, string>> = {
  non_financial: ARCHETYPE_NOTE.typical,
  lender: "A typical lender. Lender metrics such as net interest income, GNPA and credit cost apply; ROCE, debt to equity and the current ratio do not.",
  insurer: "An insurer with minimal fields only. There are just four insurers in the sample, fewer than the five needed for peer statistics, so percentiles show 'too few comparable companies'.",
};

const HOLDING_NOTE = "A holding company: most of its income is dividends and interest from its investments, and other income forms a large part of its profit.";

/** The teaching note for a roster entry ("why this fictional company is in the sample"). */
export function sampleNote(entry: Pick<RosterEntry, "sectorKey" | "archetype" | "traits">): string {
  const family = SECTORS[entry.sectorKey].family;
  let head: string;
  if (entry.archetype !== "typical") head = ARCHETYPE_NOTE[entry.archetype];
  else if (entry.sectorKey === "holding") head = HOLDING_NOTE;
  else head = TYPICAL_FAMILY_NOTE[family];
  return [head, ...entry.traits.map((t) => TRAIT_NOTE[t])].join(" ");
}

/** Human label of an archetype, used in stress-set notes. */
export function archetypeLabel(a: Archetype): string {
  return a.replace(/^rf_/, "red flag: ").replace(/_/g, " ");
}

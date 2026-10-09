// src/test/fixtures/metrics/tiny-expected.ts — expected metric values for the six fictional
// companies of src/test/fixtures/tiny-dataset.ts (WS3). Each value is written as arithmetic
// from the raw figures in that file, or as the null reason it must carry. Together they cover
// every null reason the statements can produce: LM, NNW, NIC, NAF, IH, TP, NPD (including a CAGR
// endpoint at or below 0), MI, NP-free provided values and TFI.
import type { MetricId, NullReason, PeriodSel } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import type { TinySymbol } from "../tiny-dataset";

export interface TinyExpectation {
  symbol: TinySymbol;
  id: MetricId;
  sel?: PeriodSel;
  arithmetic?: string;
  reason?: NullReason;
  /** Flags that must be set. */
  flags?: number;
  note?: string;
}

const fy = (offset: number): PeriodSel => ({ freq: "fy", offset });
const qq = (offset: number): PeriodSel => ({ freq: "q", offset });

export const TINY_EXPECTED: readonly TinyExpectation[] = [
  // ── TINYMFG: a manufacturer with every field ──
  { symbol: "TINYMFG", id: "market_cap", arithmetic: "420 * 10" },
  { symbol: "TINYMFG", id: "pe", arithmetic: "4200 / (44.17 + 45.17 + 44.32 + 41.76)", note: "TTM owners' profit, Sep 25 to Jun 26" },
  { symbol: "TINYMFG", id: "roce", arithmetic: "(1760 - 1439.68 + 17.6 - 67.65) / (((100 + 974.83 + 51.66 + 250 + 70 + 35) + (100 + 864.38 + 44.56 + 280 + 75 + 35)) / 2) * 100" },
  { symbol: "TINYMFG", id: "roe", arithmetic: "170.45 / (((100 + 974.83) + (100 + 864.38)) / 2) * 100" },
  { symbol: "TINYMFG", id: "debt_equity", arithmetic: "(250 + 70 + 35) / (100 + 974.83 + 51.66)" },
  { symbol: "TINYMFG", id: "interest_coverage", arithmetic: "(1760 - 1439.68 + 17.6 - 67.65) / 33.53" },
  { symbol: "TINYMFG", id: "sales_growth", arithmetic: "(1760 / 1600 - 1) * 100" },
  { symbol: "TINYMFG", id: "sales_cagr_5y", arithmetic: "((1760 / 1085) ^ (1 / 5) - 1) * 100" },
  { symbol: "TINYMFG", id: "opm_avg_3y", arithmetic: "((1760 - 1439.68) / 1760 + (1600 - 1312) / 1600 + (1450 - 1200.6) / 1450) / 3 * 100" },
  { symbol: "TINYMFG", id: "q_sales_yoy", arithmetic: "(448.8 / 404.8 - 1) * 100" },
  { symbol: "TINYMFG", id: "ttm_sales_growth", arithmetic: "((448.8 + 466.4 + 457.6 + 431.2) / (404.8 + 424 + 416 + 392) - 1) * 100" },
  { symbol: "TINYMFG", id: "promoter_holding_chg_1y", arithmetic: "61.9 - 62.1" },
  { symbol: "TINYMFG", id: "pledged_pct_chg_1y", arithmetic: "1.5 - 0" },
  { symbol: "TINYMFG", id: "dividend_streak", arithmetic: "7", flags: VF.LimitOfData },
  { symbol: "TINYMFG", id: "net_profit", arithmetic: "170.45", note: "owners' share, not PAT 177.55" },

  // ── TINYSOFT: no COGS, inventories 0, finance cost 0, owners' PAT not given, Sep 25 quarter missing ──
  { symbol: "TINYSOFT", id: "interest_coverage", reason: "no_interest_cost" },
  { symbol: "TINYSOFT", id: "gross_margin", reason: "missing_input", note: "COGS missing is never treated as 0" },
  { symbol: "TINYSOFT", id: "inventory_days", arithmetic: "0 / 1300 * 365", flags: VF.SalesBasis },
  { symbol: "TINYSOFT", id: "cash_conversion_cycle", arithmetic: "(256.44 + 0 - 71.23) / 1300 * 365", flags: VF.SalesBasis | VF.Approximate },
  { symbol: "TINYSOFT", id: "net_profit", arithmetic: "228.78", note: "owners' PAT not given, so PAT" },
  { symbol: "TINYSOFT", id: "pe", arithmetic: "138 * 50 / 228.78", flags: VF.FyFallback, note: "a quarter is missing, so the latest FY is used" },
  { symbol: "TINYSOFT", id: "debt_equity", arithmetic: "0" },
  { symbol: "TINYSOFT", id: "debt_ebitda", arithmetic: "0" },
  { symbol: "TINYSOFT", id: "net_debt", arithmetic: "0 - (240.61 + 120)", flags: VF.NetCash },
  { symbol: "TINYSOFT", id: "q_sales_yoy", arithmetic: "(338 / 312 - 1) * 100", note: "year-ago quarter matched by date despite the gap" },
  { symbol: "TINYSOFT", id: "q_sales", sel: qq(3), reason: "missing_input", note: "Sep 25 is a hole in the quarter grid" },
  { symbol: "TINYSOFT", id: "q_sales", sel: qq(4), arithmetic: "312" },
  { symbol: "TINYSOFT", id: "ttm_sales_growth", reason: "insufficient_history" },
  { symbol: "TINYSOFT", id: "piotroski_f", arithmetic: "8", flags: VF.Proxy, note: "F6 not met; F8 uses OPM" },
  { symbol: "TINYSOFT", id: "effective_tax_rate", arithmetic: "76.26 / 305.04 * 100" },

  // ── TINYBANK: a lender whose type is inferred from the sector ──
  { symbol: "TINYBANK", id: "roce", reason: "not_applicable_financial" },
  { symbol: "TINYBANK", id: "piotroski_f", reason: "not_applicable_financial" },
  { symbol: "TINYBANK", id: "nii", arithmetic: "1394.4 - 771.9", flags: VF.InferredType },
  { symbol: "TINYBANK", id: "gnpa_ratio", arithmetic: "263.8 / (13000 + 263.8 - 73.86) * 100" },
  { symbol: "TINYBANK", id: "provision_coverage", arithmetic: "(263.8 - 73.86) / 263.8 * 100" },
  { symbol: "TINYBANK", id: "credit_cost", arithmetic: "87.15 / ((13000 + 11900) / 2) * 100" },
  { symbol: "TINYBANK", id: "pe", arithmetic: "39.8 * 75 / (65.05 + 63.84 + 60.23 + 59.03)" },
  { symbol: "TINYBANK", id: "roe", arithmetic: "240.92 / (((150 + 1980.43) + (150 + 1799.51)) / 2) * 100" },

  // ── TINYLOSS: loss-making, negative net worth, FY2024 a transition year ──
  { symbol: "TINYLOSS", id: "pe", reason: "loss_making", flags: VF.FyFallback },
  { symbol: "TINYLOSS", id: "roe", reason: "negative_net_worth" },
  { symbol: "TINYLOSS", id: "pb", reason: "negative_net_worth" },
  { symbol: "TINYLOSS", id: "debt_equity", reason: "negative_net_worth" },
  { symbol: "TINYLOSS", id: "sales_growth", arithmetic: "(295 / 310 - 1) * 100" },
  { symbol: "TINYLOSS", id: "sales_growth", sel: fy(1), reason: "transition_period", note: "FY25 against the FY24 transition year" },
  { symbol: "TINYLOSS", id: "sales_growth", sel: fy(2), reason: "transition_period" },
  { symbol: "TINYLOSS", id: "sales", sel: fy(2), arithmetic: "330", note: "the year itself is still shown" },
  { symbol: "TINYLOSS", id: "roce_avg_3y", reason: "transition_period" },
  { symbol: "TINYLOSS", id: "sales_cagr_3y", reason: "transition_period" },
  { symbol: "TINYLOSS", id: "profit_growth", reason: "non_positive_denominator" },
  { symbol: "TINYLOSS", id: "cfo_to_pat", reason: "loss_making" },
  { symbol: "TINYLOSS", id: "effective_tax_rate", reason: "loss_making" },
  { symbol: "TINYLOSS", id: "dividend_payout", reason: "loss_making" },
  { symbol: "TINYLOSS", id: "dividend_streak", arithmetic: "0" },
  { symbol: "TINYLOSS", id: "pledged_pct", arithmetic: "45" },
  { symbol: "TINYLOSS", id: "promoter_holding_chg_1y", arithmetic: "41 - 48" },
  { symbol: "TINYLOSS", id: "promoter_holding_chg_3y", reason: "insufficient_history" },
  { symbol: "TINYLOSS", id: "ev_ebitda", arithmetic: "(12.5 * 5 + (510 + 292.27 + 0) + 0 - (8 + 0)) / (295 - 290.57)", flags: VF.FyFallback },

  // ── TINYSNAP: snapshot only ──
  { symbol: "TINYSNAP", id: "pe", arithmetic: "22.4", flags: VF.Provided },
  { symbol: "TINYSNAP", id: "roce", arithmetic: "17.8", flags: VF.Provided },
  { symbol: "TINYSNAP", id: "market_cap", arithmetic: "5000", flags: VF.Provided },
  { symbol: "TINYSNAP", id: "sales", reason: "insufficient_history" },
  { symbol: "TINYSNAP", id: "roce_avg_5y", reason: "insufficient_history" },
  { symbol: "TINYSNAP", id: "years_of_history", arithmetic: "0" },
  { symbol: "TINYSNAP", id: "latest_fy", reason: "insufficient_history" },
  { symbol: "TINYSNAP", id: "piotroski_f", reason: "too_few_inputs" },

  // ── TINYNEW: FY2023, FY2025 and FY2026 (FY2024 missing), standalone ──
  { symbol: "TINYNEW", id: "sales_growth", arithmetic: "(262 / 215 - 1) * 100" },
  { symbol: "TINYNEW", id: "sales_growth", sel: fy(1), reason: "insufficient_history", note: "FY24 is missing" },
  { symbol: "TINYNEW", id: "sales", sel: fy(2), reason: "missing_input", note: "a hole in the annual grid" },
  { symbol: "TINYNEW", id: "sales", sel: fy(4), reason: "insufficient_history" },
  { symbol: "TINYNEW", id: "sales_cagr_3y", arithmetic: "((262 / 140) ^ (1 / 3) - 1) * 100", note: "FY23 to FY26; the gap year is not needed" },
  { symbol: "TINYNEW", id: "dps_cagr_3y", reason: "non_positive_denominator", flags: VF.Turnaround, note: "FY23 dividend was 0" },
  { symbol: "TINYNEW", id: "roce_avg_3y", reason: "insufficient_history" },
  { symbol: "TINYNEW", id: "roe", sel: fy(1), arithmetic: "13.43 / (100 + 184.78) * 100", flags: VF.ClosingBasis },
  { symbol: "TINYNEW", id: "ttm_sales_growth", reason: "insufficient_history" },
  { symbol: "TINYNEW", id: "pe", arithmetic: "66 * 10 / 21.97", flags: VF.FyFallback },
  { symbol: "TINYNEW", id: "piotroski_f", reason: "too_few_inputs" },
  { symbol: "TINYNEW", id: "years_of_history", arithmetic: "3" },
  { symbol: "TINYNEW", id: "q_sales_yoy", reason: "insufficient_history" },
  { symbol: "TINYNEW", id: "dii_holding_chg_1q", arithmetic: "6.8 - 6.2" },
];

// src/lib/format/metric-value.ts — the single formatter for metric values (P0, handed to WS7).
// Every number on Screener, Company and Compare goes through formatMetric() (via <ValueCell>).
import type { MetricDef, MetricValue, NullReason, TypeFamily, Unit } from "@/lib/contracts";
import { VF } from "@/lib/contracts";
import { fyLabel } from "@/lib/time/civil";
import {
  DASH, formatInr, formatInrCrore, formatMultiple, formatNumberIN, formatPercent, formatPoints,
} from "./indian";

export { DASH };

/** UI text for each null reason (§C.2). Short text goes in cells and chips; long text in tooltips. */
export const NULL_REASON_TEXT: Readonly<Record<NullReason, { short: string; long: string }>> = {
  missing_input: {
    short: "Not provided",
    long: "An input needed for this figure is not in your data.",
  },
  non_positive_denominator: {
    short: "Not meaningful",
    long: "The figure it divides by is zero or negative.",
  },
  negative_net_worth: {
    short: "Negative net worth",
    long: "Shareholders' funds are negative, so this ratio is not meaningful.",
  },
  loss_making: {
    short: "Loss-making",
    long: "The company made a loss (or zero profit) in the period, so this ratio is not meaningful.",
  },
  not_applicable_financial: {
    short: "Not applicable",
    long: "This measure does not apply to this type of company.",
  },
  insufficient_history: {
    short: "Not enough history",
    long: "Your data does not hold enough periods to calculate this figure.",
  },
  ev_not_positive: {
    short: "EV not positive",
    long: "Enterprise value is zero or negative (spare cash exceeds market value plus debt), so this ratio is not meaningful.",
  },
  no_interest_cost: {
    short: "No interest cost",
    long: "The company reports no finance cost, so there is no interest to cover.",
  },
  too_few_peers: {
    short: "Too few comparable companies in your data",
    long: "Fewer comparable companies than the minimum needed have data for this figure.",
  },
  transition_period: {
    short: "Period not comparable (restated or transition year)",
    long: "A restated or transition year falls in the period, so comparisons across it are not meaningful.",
  },
  no_price: {
    short: "Price not provided",
    long: "Your data does not include a reference price for this company.",
  },
  too_few_inputs: {
    short: "Too few inputs to calculate",
    long: "Too few of the required inputs could be evaluated to calculate this figure.",
  },
};

const NAF_TEXT: Readonly<Record<TypeFamily, { short: string; long: string }>> = {
  lender: {
    short: "N/A for lenders",
    long: "This measure does not apply to banks and NBFCs, whose accounts are built differently.",
  },
  insurance: {
    short: "N/A for insurers",
    long: "This measure does not apply to insurers, whose accounts are built differently.",
  },
  non_financial: {
    short: "N/A for non-lenders",
    long: "This measure applies only to banks and NBFCs.",
  },
};

/** Reason text, choosing the not-applicable wording by company family when it is known. */
export function nullReasonText(reason: NullReason, family?: TypeFamily | null): { short: string; long: string } {
  if (reason === "not_applicable_financial" && family) return NAF_TEXT[family];
  return NULL_REASON_TEXT[reason];
}

/** Metric bases whose value 0 means "no borrowings" and gets the "debt-free" note. */
const DEBT_FREE_BASES: ReadonlySet<string> = new Set(["debt_equity", "debt_equity_ex_leases", "debt_ebitda"]);

function plural(n: string, one: string, many: string): string {
  return n === "1" ? `${n} ${one}` : `${n} ${many}`;
}

/** Formats a finite number in a unit (no null handling, no metric-specific notes). */
export function formatUnitValue(unit: Unit, decimals: number, v: number, flags = 0): string {
  if (!Number.isFinite(v)) return DASH;
  switch (unit) {
    case "inr_cr":
      return formatInrCrore(v, decimals);
    case "inr":
      return formatInr(v, decimals);
    case "pct":
      return formatPercent(v, decimals);
    case "pp":
      return formatPoints(v, decimals);
    case "x":
      return formatMultiple(v, decimals);
    case "days":
      return plural(formatNumberIN(v, decimals), "day", "days");
    case "years": {
      const text = plural(formatNumberIN(v, decimals), "year", "years");
      return (flags & VF.LimitOfData) !== 0 ? `at least ${text} (limit of data)` : text;
    }
    case "crore_shares":
      return `${formatNumberIN(v, decimals)} Cr shares`;
    case "fy_year":
      return fyLabel(Math.round(v));
    case "count":
    case "score":
      return formatNumberIN(v, decimals);
  }
}

/** "24.5x", "22.4%", "48 days", "₹1.92 lakh Cr", "0.00x · debt-free"; "—" when the value is null. */
export function formatMetric(def: MetricDef, value: MetricValue): string {
  const v = value.v;
  if (v === null || !Number.isFinite(v)) return DASH;
  const text = formatUnitValue(def.unit, def.decimals, v, value.flags);
  if (v === 0 && def.unit === "x" && DEBT_FREE_BASES.has(def.base)) return `${text} · debt-free`;
  return text;
}

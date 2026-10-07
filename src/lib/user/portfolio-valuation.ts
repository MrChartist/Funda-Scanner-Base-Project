// src/lib/user/portfolio-valuation.ts — values holdings at the reference price in the loaded data (WS7).
// Pure. A holding whose symbol is not in the data is reported, never rejected; a holding without a
// price is listed but left out of the totals; the return rate is null, never NaN, when it is undefined.
import type { MetricStore, PortfolioHolding } from "@/lib/contracts";
import { daysBetween } from "@/lib/time/civil";
import { xirr, type DatedFlow } from "./xirr";

export interface ValuedHolding {
  /** Position in the stored list (used to remove it). */
  holdingIndex: number;
  holding: PortfolioHolding;
  /** Store index; -1 is never returned here (those holdings are in `missing`). */
  index: number;
  price: number | null;
  priceDate: string | null;
  invested: number;
  value: number | null;
  gain: number | null;
  /** Percent of the amount invested. */
  gainPct: number | null;
}

export interface PortfolioValuation {
  rows: ValuedHolding[];
  /** Holdings whose symbol is not in the loaded data. */
  missing: { holdingIndex: number; holding: PortfolioHolding }[];
  /** Holdings in the data but without a reference price. */
  unpriced: ValuedHolding[];
  /** Totals over priced holdings only. */
  totals: { invested: number; value: number; gain: number; gainPct: number | null; pricedCount: number };
  /** Latest price date among priced holdings; null when none is supplied. */
  priceDate: string | null;
  /** More than one price date among priced holdings. */
  mixedPriceDates: boolean;
  /** Annual return as a fraction, or null. */
  xirr: number | null;
  /** Why xirr is null; null when it is available. */
  xirrNote: string | null;
}

const MIN_DAYS_FOR_XIRR = 365;

export function valuePortfolio(store: MetricStore, holdings: readonly PortfolioHolding[]): PortfolioValuation {
  const rows: ValuedHolding[] = [];
  const missing: PortfolioValuation["missing"] = [];
  holdings.forEach((holding, holdingIndex) => {
    const index = store.indexOf(holding.symbol);
    if (index < 0) {
      missing.push({ holdingIndex, holding });
      return;
    }
    const p = store.get("price", index).v;
    const price = p !== null && Number.isFinite(p) && p > 0 ? p : null;
    const invested = holding.qty * holding.avgCost;
    const value = price === null ? null : holding.qty * price;
    const gain = value === null ? null : value - invested;
    rows.push({
      holdingIndex,
      holding,
      index,
      price,
      priceDate: store.company(index).market.price_date,
      invested,
      value,
      gain,
      gainPct: gain !== null && invested > 0 ? (gain / invested) * 100 : null,
    });
  });

  const priced = rows.filter((r) => r.value !== null);
  const invested = priced.reduce((s, r) => s + r.invested, 0);
  const value = priced.reduce((s, r) => s + (r.value ?? 0), 0);
  const gain = value - invested;
  const totals = { invested, value, gain, gainPct: invested > 0 ? (gain / invested) * 100 : null, pricedCount: priced.length };

  const dates = [...new Set(priced.map((r) => r.priceDate).filter((d): d is string => !!d))].sort();
  const priceDate = dates.length > 0 ? dates[dates.length - 1] : null;

  let rate: number | null = null;
  let note: string | null = null;
  if (priced.length === 0) note = "No holding has a reference price in your data.";
  else if (priceDate === null) note = "The data does not give a price date, so the period cannot be measured.";
  else if (priced.some((r) => r.priceDate === null)) note = "Some prices have no price date, so the period cannot be measured.";
  else if (priced.some((r) => r.holding.buyDate > priceDate)) note = "A purchase date is later than the price date.";
  else {
    const first = priced.reduce((min, r) => (r.holding.buyDate < min ? r.holding.buyDate : min), priced[0].holding.buyDate);
    const span = daysBetween(first, priceDate);
    if (span === null || span < MIN_DAYS_FOR_XIRR) {
      note = "An annual rate needs at least one year between the first purchase and the price date.";
    } else {
      const flows: DatedFlow[] = priced.map((r) => ({ amount: -r.invested, date: r.holding.buyDate }));
      flows.push({ amount: value, date: priceDate });
      rate = xirr(flows);
      if (rate === null) note = "The annual rate cannot be worked out from these figures.";
    }
  }

  return {
    rows,
    missing,
    unpriced: rows.filter((r) => r.value === null),
    totals,
    priceDate,
    mixedPriceDates: dates.length > 1,
    xirr: rate,
    xirrNote: note,
  };
}

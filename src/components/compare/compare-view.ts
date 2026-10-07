// src/components/compare/compare-view.ts — view model for the Compare page (pure; no React).
import type { MetricDef, MetricId, MetricStore, MetricValue, PeriodSel } from "@/lib/contracts";
import { fyLabel } from "@/lib/time/civil";
import { NO_VALUE, PLAIN } from "@/lib/views/company-view";

export const MAX_COMPARE = 4;

export interface ParsedSymbols {
  /** Indices of companies found in the data, in the order given, at most MAX_COMPARE. */
  indices: number[];
  /** Symbols that are not in the data (shown as "Not in your data"). */
  unknown: string[];
  /** Valid symbols beyond the limit of four. */
  overflow: string[];
}

/** Reads a comma-separated symbol list: upper-cased, de-duplicated, split into known, unknown and overflow. */
export function parseSymbols(text: string | null, store: MetricStore): ParsedSymbols {
  const seen = new Set<string>();
  const out: ParsedSymbols = { indices: [], unknown: [], overflow: [] };
  for (const part of (text ?? "").split(",")) {
    const sym = part.trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    const i = store.indexOf(sym);
    if (i < 0) out.unknown.push(sym);
    else if (out.indices.length < MAX_COMPARE) out.indices.push(i);
    else out.overflow.push(sym);
  }
  return out;
}

const COMMON: readonly MetricId[] = [
  "market_cap", "pe", "pb", "roe", "roce", "opm", "npm", "sales_cagr_5y", "net_profit_cagr_5y", "debt_equity", "interest_coverage",
  "current_ratio", "cum_cfo_to_pat_5y", "dividend_yield", "piotroski_f", "altman_z", "red_flag_count",
];
const LENDER: readonly MetricId[] = ["roa", "nim_approx", "cost_to_income", "gnpa_ratio", "nnpa_ratio", "provision_coverage", "credit_cost"];

export interface CompareCell {
  value: MetricValue;
  /** True when this company has the better value in the row (by the usual reading of the figure). */
  leads: boolean;
}

export interface CompareRow {
  def: MetricDef;
  cells: CompareCell[];
  median: MetricValue;
}

export interface CompareModel {
  rows: CompareRow[];
  /** Rows on which each company leads, and the number of rows where a lead could be decided. */
  leads: number[];
  comparable: number;
  /** "IT services · 12 companies in your data", for the median column. */
  medianLabel: string | null;
}

/** Index of the single best value (higher or lower is better by `direction`), or -1 when it is a tie or cannot be decided. */
function leaderOf(values: readonly MetricValue[], direction: MetricDef["direction"]): number {
  if (direction === "neutral") return -1;
  const present = values.map((v, k) => ({ v: v.v, k })).filter((x): x is { v: number; k: number } => x.v !== null);
  if (present.length < 2) return -1;
  const best = direction === "higher" ? Math.max(...present.map((x) => x.v)) : Math.min(...present.map((x) => x.v));
  const winners = present.filter((x) => x.v === best);
  return winners.length === 1 ? winners[0].k : -1;
}

export function buildCompare(store: MetricStore, indices: readonly number[]): CompareModel {
  const anyLender = indices.some((i) => store.family(i) === "lender");
  const ids = anyLender ? [...COMMON.slice(0, 4), ...LENDER, ...COMMON.slice(4)] : COMMON;
  const anchor = indices[0];
  const groups = store.groups("industry");
  const g = anchor === undefined ? -1 : groups.groupOf[anchor];
  const leads = indices.map(() => 0);
  let comparable = 0;
  const rows: CompareRow[] = [];
  for (const id of ids) {
    const def = store.def(id);
    if (!def) continue;
    const values = indices.map((i) => store.get(id, i));
    if (values.every((v) => v.v === null && v.reason === "not_applicable_financial")) continue;
    const leader = leaderOf(values, def.direction);
    if (leader >= 0) {
      leads[leader] += 1;
      comparable += 1;
    }
    let median: MetricValue = NO_VALUE("too_few_peers");
    if (anchor !== undefined) {
      const anchorValue = values[0];
      if (anchorValue.reason === "not_applicable_financial") median = anchorValue;
      else {
        const stat = store.peerStat(id, anchor, "industry");
        median = stat.median === null ? NO_VALUE("too_few_peers") : PLAIN(stat.median);
      }
    }
    rows.push({ def, cells: values.map((value, k) => ({ value, leads: k === leader })), median });
  }
  return { rows, leads, comparable, medianLabel: g >= 0 ? groups.labels[g] : null };
}

// ── Indexed 10-year history ─────────────────────────────────────────────────
export interface IndexedSeries {
  index: number;
  /** Index values by year (first usable year = 100); null where the figure is missing, zero or negative. */
  values: (number | null)[];
}

export interface IndexedView {
  years: string[];
  sales: IndexedSeries[];
  profit: IndexedSeries[];
}

const fy = (offset: number): PeriodSel => ({ freq: "fy", offset });

function indexed(store: MetricStore, i: number, id: MetricId, years: number[]): IndexedSeries {
  const latest = store.get("latest_fy", i).v;
  const raw = years.map((year) => {
    if (latest === null) return null;
    const k = Math.round(latest) - year;
    if (k < 0 || k >= store.slots(i, "fy")) return null;
    const v = store.at(id, i, fy(k)).v;
    return v !== null && v > 0 ? v : null;
  });
  const base = raw.find((v): v is number => v !== null);
  return { index: i, values: raw.map((v) => (v === null || base === undefined ? null : (v / base) * 100)) };
}

/** Sales and net profit for the selected companies over up to ten years, as an index. Aligned by fiscal year, never by position. */
export function buildIndexed(store: MetricStore, indices: readonly number[], span = 10): IndexedView {
  const latestYears = indices.flatMap((i) => {
    const v = store.get("latest_fy", i).v;
    return v === null ? [] : [Math.round(v)];
  });
  if (latestYears.length === 0) return { years: [], sales: [], profit: [] };
  const last = Math.max(...latestYears);
  const years: number[] = [];
  for (let y = last - span + 1; y <= last; y++) years.push(y);
  return {
    years: years.map(fyLabel),
    sales: indices.map((i) => indexed(store, i, "sales", years)),
    profit: indices.map((i) => indexed(store, i, "net_profit", years)),
  };
}

export function hasIndexedData(view: IndexedView): boolean {
  return view.sales.some((s) => s.values.some((v) => v !== null)) || view.profit.some((s) => s.values.some((v) => v !== null));
}

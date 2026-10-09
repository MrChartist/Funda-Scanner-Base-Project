// src/components/screener/helpers.ts — small pure helpers shared by the Screener components.
import type {
  ClauseExplanation, CmpOp, DisplaySort, MetricCategory, MetricDef, MetricId, MetricStore, QueryEvaluation, ScreenRun, Tri, UniverseSpec, Unit, Variant,
} from "@/lib/contracts";

/** The suffix shown after a rule value, so the unit is always visible while typing. */
export const UNIT_SUFFIX: Readonly<Record<Unit, string>> = {
  inr_cr: "₹ Cr", inr: "₹", pct: "%", pp: "pp", x: "x", days: "days", years: "years", count: "", score: "", crore_shares: "Cr shares", fy_year: "",
};

export const VARIANT_LABEL: Readonly<Record<Variant, string>> = {
  prev: "Previous year", ttm: "Trailing 12 months", avg_3y: "3-year average", avg_5y: "5-year average", avg_10y: "10-year average",
  min_5y: "5-year minimum", stdev_5y: "5-year variability", cagr_3y: "3-year growth rate", cagr_5y: "5-year growth rate",
  cagr_10y: "10-year growth rate", cum_3y: "3-year total", cum_5y: "5-year total", cum_10y: "10-year total",
  chg_1q: "Change over 1 quarter", chg_1y: "Change over 1 year", chg_3y: "Change over 3 years",
};

export const CATEGORY_ORDER: readonly MetricCategory[] = [
  "Size", "Valuation", "Profitability", "Efficiency", "Leverage & Liquidity", "Growth", "Cash Flow", "Dividend", "Per Share",
  "Shareholding", "Banking & NBFC", "Scores & Checks", "Line items", "Data",
];

export interface MetricGroup {
  label: string;
  defs: MetricDef[];
}

/** Base metrics (no period variants), grouped for a picker. Beginner view lists basic metrics first. */
export function groupMetrics(store: MetricStore, beginner: boolean, filter?: (d: MetricDef) => boolean): MetricGroup[] {
  const bases = store.defs().filter((d) => d.variant === null && (!filter || filter(d)));
  const groups: MetricGroup[] = [];
  let rest = bases;
  if (beginner) {
    const basic = bases.filter((d) => d.level === "basic");
    if (basic.length > 0) groups.push({ label: "Basic metrics", defs: basic });
    rest = bases.filter((d) => d.level !== "basic");
  }
  for (const category of CATEGORY_ORDER) {
    const defs = rest.filter((d) => d.category === category);
    if (defs.length > 0) groups.push({ label: beginner ? `More: ${category}` : category, defs });
  }
  return groups;
}

export interface PeriodOption {
  id: MetricId;
  label: string;
}

/** The default period plus every variant that exists in the store for this base metric. */
export function periodOptions(store: MetricStore, metric: MetricId): PeriodOption[] {
  const def = store.def(metric);
  if (!def) return [];
  const base = store.def(def.base);
  if (!base) return [];
  const out: PeriodOption[] = [{ id: base.id, label: `Default (${base.periodTag})` }];
  for (const v of base.variants) {
    const id = `${base.id}_${v}`;
    if (store.def(id)) out.push({ id, label: VARIANT_LABEL[v] });
  }
  return out;
}

/** "all", "watchlist", "sector:Cement" … the same words as the URL. */
export function universeValue(u: UniverseSpec): string {
  switch (u.kind) {
    case "all": return "all";
    case "watchlist": return "watchlist";
    case "portfolio": return "portfolio";
    case "sector": return `sector:${u.sector}`;
    case "industry": return `industry:${u.industry}`;
    case "symbols": return "symbols";
  }
}

export function universeFromValue(value: string, current: UniverseSpec): UniverseSpec {
  if (value === "all") return { kind: "all" };
  if (value === "watchlist") return { kind: "watchlist" };
  if (value === "portfolio") return { kind: "portfolio" };
  if (value === "symbols") return current;
  if (value.startsWith("sector:")) return { kind: "sector", sector: value.slice(7) };
  if (value.startsWith("industry:")) return { kind: "industry", industry: value.slice(9) };
  return { kind: "all" };
}

/** Position of every universe row, for looking up clause results by store index. */
export function universePositions(run: ScreenRun): Map<number, number> {
  const m = new Map<number, number>();
  for (let r = 0; r < run.universe.length; r++) m.set(run.universe[r], r);
  return m;
}

/** Clause results for one company (aligned with run.compiled.clauses). */
export function clauseResults(run: ScreenRun, position: number | undefined): Tri[] {
  if (position === undefined) return [];
  return run.clauseTri.map((t) => t[position] as Tri);
}

/** The evaluation arrays that explainClause reads, rebuilt from a run. */
export function evaluationOf(run: ScreenRun): QueryEvaluation {
  return {
    rows: run.universe,
    clauseTri: run.clauseTri,
    clauseReason: run.clauseReason,
    clauseLhs: run.clauseLhs,
    clauseRhs: run.clauseRhs,
    whereTri: new Uint8Array(run.universe.length),
  };
}

export function passCount(results: readonly Tri[]): number {
  return results.filter((t) => t === 1).length;
}

export type Explain = ClauseExplanation;

/** Line and column (both 1-based) of a character offset. */
export function lineColumn(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) {
    if (source[i] === "\n") {
      line++;
      last = i;
    }
  }
  return { line, column: end - last };
}

export const MAX_COMPARE = 4;

export const optionId = (id: string, index: number) => `${id}-option-${index}`;

export function companyPath(symbol: string): string {
  return `/company/${encodeURIComponent(symbol)}`;
}

export function skippedTotal(run: ScreenRun): number {
  return run.skipped.reduce((sum, g) => sum + g.count, 0);
}

export function ariaSortOf(sort: DisplaySort | null, key: string): "ascending" | "descending" | "none" {
  if (!sort || sort.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}

/** Text columns start ascending, numeric columns descending; a second click reverses. */
export function nextSort(sort: DisplaySort | null, key: string, isText: boolean): DisplaySort {
  if (sort && sort.key === key) return { key, dir: sort.dir === "asc" ? "desc" : "asc" };
  return { key, dir: isText ? "asc" : "desc" };
}

export const OPERATOR_LABEL: Readonly<Record<CmpOp | "between", string>> = {
  ">": "is above", ">=": "is at least", "<": "is below", "<=": "is at most", "=": "equals", "!=": "is not", between: "is between",
};

/** The rule whose removal would bring back the most companies (largest drop-one count), if any. */
export function loosestRule(run: ScreenRun) {
  let best: ScreenRun["funnel"][number] | null = null;
  for (const step of run.funnel) if (step.dropOneMatches > 0 && (best === null || step.dropOneMatches > best.dropOneMatches)) best = step;
  return best;
}

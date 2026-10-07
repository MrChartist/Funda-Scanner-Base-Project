// src/lib/screen/run.ts — runScreen (§D.12). Pure and synchronous; inputs and outputs are serialisable.
import type {
  CompiledQuery, DisplaySort, MetricColumn, MetricStore, ResolvedColumn, RunScreen, ScreenContext, ScreenRun, ScreenWarning,
  UniverseSpec,
} from "@/lib/contracts";
import { PEER_CLASS, TRI_FALSE, TRI_TRUE, VF } from "@/lib/contracts";
import { cachedMetricColumn, compileQuery, evaluateQuery, evaluateSortKeys } from "@/lib/query";
import { fyLabel } from "@/lib/time/civil";
import { medianOver, resolveColumns } from "./columns";
import { buildFunnel, groupSkipped } from "./funnel";
import { findNearMisses } from "./near-miss";

// ── universe ────────────────────────────────────────────────────────────────
export function resolveUniverse(store: MetricStore, u: UniverseSpec, ctx: ScreenContext): { universe: Int32Array; unknown: number } {
  const out: number[] = [];
  const seen = new Set<number>();
  let unknown = 0;
  const fromSymbols = (symbols: readonly string[]) => {
    for (const s of symbols) {
      const i = store.indexOf(s);
      if (i < 0) unknown++;
      else if (!seen.has(i)) {
        seen.add(i);
        out.push(i);
      }
    }
  };
  switch (u.kind) {
    case "all":
      for (let i = 0; i < store.size; i++) out.push(i);
      break;
    case "watchlist":
      fromSymbols(ctx.watchlist);
      break;
    case "portfolio":
      fromSymbols(ctx.portfolio);
      break;
    case "symbols":
      fromSymbols(u.symbols);
      break;
    case "sector": {
      const want = u.sector.trim().toLowerCase();
      for (let i = 0; i < store.size; i++) if (store.sector(i).trim().toLowerCase() === want) out.push(i);
      break;
    }
    case "industry": {
      const want = u.industry.trim().toLowerCase();
      for (let i = 0; i < store.size; i++) if (store.industry(i).trim().toLowerCase() === want) out.push(i);
      break;
    }
  }
  out.sort((a, b) => a - b);
  return { universe: Int32Array.from(out), unknown };
}

// ── ordering ────────────────────────────────────────────────────────────────
function present(col: MetricColumn, i: number): boolean {
  return col.reasons[i] === 0 && Number.isFinite(col.values[i]);
}

function marketCap(store: MetricStore): MetricColumn | null {
  try {
    return cachedMetricColumn(store, "market_cap");
  } catch {
    return null;
  }
}

/** Market cap descending (nulls last), then symbol ascending. */
export function defaultComparator(store: MetricStore): (a: number, b: number) => number {
  const mc = marketCap(store);
  return (a, b) => {
    if (mc) {
      const pa = present(mc, a);
      const pb = present(mc, b);
      if (pa && pb && mc.values[a] !== mc.values[b]) return mc.values[b] - mc.values[a];
      if (pa !== pb) return pa ? -1 : 1;
    }
    const sa = store.symbols[a];
    const sb = store.symbols[b];
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  };
}

const TEXT_KEYS: readonly string[] = ["name", "symbol", "sector", "industry"];

function textKey(store: MetricStore, key: string, i: number): string | null {
  switch (key) {
    case "name": return store.company(i).name.toLowerCase();
    case "symbol": return store.symbols[i].toLowerCase();
    case "sector": return store.sector(i).toLowerCase();
    case "industry": return store.industry(i).toLowerCase();
    default: return null;
  }
}

/** Header-click sort over the (already limited) matches: nulls last whatever the direction. */
export function displayComparator(
  store: MetricStore, sort: DisplaySort, columns: readonly ResolvedColumn[], fallback: (a: number, b: number) => number,
): (a: number, b: number) => number {
  const dir = sort.dir === "asc" ? 1 : -1;
  if (TEXT_KEYS.includes(sort.key)) {
    return (a, b) => {
      const ta = textKey(store, sort.key, a) ?? "";
      const tb = textKey(store, sort.key, b) ?? "";
      return (ta < tb ? -1 : ta > tb ? 1 : 0) * dir || fallback(a, b);
    };
  }
  let col: MetricColumn | null = columns.find((c) => c.key === sort.key)?.column ?? null;
  if (!col && store.def(sort.key)) {
    try {
      col = cachedMetricColumn(store, sort.key);
    } catch {
      col = null;
    }
  }
  if (!col) return fallback;
  const c = col;
  return (a, b) => {
    const pa = present(c, a);
    const pb = present(c, b);
    if (pa && pb) return (c.values[a] - c.values[b]) * dir || fallback(a, b);
    if (pa !== pb) return pa ? -1 : 1;
    return fallback(a, b);
  };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function warningsFor(
  store: MetricStore, compiled: CompiledQuery, universe: Int32Array, matched: readonly number[], matchCount: number, unknown: number,
): ScreenWarning[] {
  const out: ScreenWarning[] = [];
  if (unknown > 0) {
    out.push({
      code: "W_UNKNOWN_SYMBOLS", count: unknown,
      message: `${plural(unknown, "symbol is", "symbols are")} not in the data you are viewing.`,
    });
  }
  if (!compiled.ok) return out;
  if (compiled.limit !== null && matchCount > compiled.limit) {
    const by = compiled.sort.length > 0 ? "by your SORT BY" : "by market cap";
    out.push({
      code: "W_LIMIT_APPLIED", count: matchCount - compiled.limit,
      message: `Showing the top ${compiled.limit} of ${matchCount} matches ${by}.`,
    });
  }
  if (compiled.sort.some((s) => s.usesRank)) {
    const classes = new Set(matched.map((i) => PEER_CLASS[store.companyType(i).type]));
    if (classes.size > 1) {
      out.push({
        code: "W_RANK_MIXED_CLASSES", count: classes.size,
        message: "The matches include companies of different kinds (for example lenders and non-financial companies); their ranks are compared directly.",
      });
    }
  }
  // TTM fallback among the latest-only metrics the query uses.
  const latestOnly = compiled.metrics.filter((id) => store.def(id)?.history === "latest_only");
  if (latestOnly.length > 0) {
    const cols = latestOnly.map((id) => {
      try {
        return cachedMetricColumn(store, id);
      } catch {
        return null;
      }
    }).filter((c): c is MetricColumn => c !== null);
    let n = 0;
    for (const i of universe) if (cols.some((c) => (c.flags[i] & VF.FyFallback) !== 0)) n++;
    if (n > 0) {
      out.push({
        code: "W_TTM_FALLBACK", count: n,
        message: `${plural(n, "company uses", "companies use")} the latest financial year in place of TTM because four recent quarters were not available.`,
      });
    }
  }
  const modal = store.modalLatestFy;
  let stale = 0;
  let snapshot = 0;
  for (const i of universe) {
    const annual = store.company(i).annual;
    if (annual.length === 0) {
      snapshot++;
      continue;
    }
    if (modal !== null) {
      let latest = -Infinity;
      for (const row of annual) if (row.fiscal_year > latest) latest = row.fiscal_year;
      if (latest < modal) stale++;
    }
  }
  if (stale > 0 && modal !== null) {
    out.push({
      code: "W_STALE_DATA", count: stale,
      message: `${plural(stale, "company has", "companies have")} figures that end before ${fyLabel(modal)}, the latest year for most companies in your data.`,
    });
  }
  if (snapshot > 0) {
    out.push({
      code: "W_SNAPSHOT_ONLY", count: snapshot,
      message: `${plural(snapshot, "company has", "companies have")} no yearly statements in your data, so rules that need history cannot be checked for ${snapshot === 1 ? "it" : "them"}.`,
    });
  }
  return out;
}

export const runScreen: RunScreen = (store, input, ctx, compiledArg) => {
  const compiled = compiledArg ?? compileQuery(input.query, store);
  const { universe, unknown } = resolveUniverse(store, input.universe, ctx);
  const evaluation = evaluateQuery(compiled, store, universe);
  const byDefault = defaultComparator(store);

  const matches: number[] = [];
  if (compiled.ok) for (let r = 0; r < universe.length; r++) if (evaluation.whereTri[r] === TRI_TRUE) matches.push(universe[r]);

  let keys: MetricColumn[] = [];
  if (compiled.ok && compiled.sort.length > 0) {
    keys = evaluateSortKeys(compiled, store, Int32Array.from(matches));
    const dirs = compiled.sort.map((s) => (s.dir === "asc" ? 1 : -1));
    matches.sort((a, b) => {
      for (let k = 0; k < keys.length; k++) {
        const col = keys[k];
        const pa = present(col, a);
        const pb = present(col, b);
        if (pa && pb) {
          const d = (col.values[a] - col.values[b]) * dirs[k];
          if (d !== 0) return d;
        } else if (pa !== pb) return pa ? -1 : 1;
      }
      return byDefault(a, b);
    });
  } else {
    matches.sort(byDefault);
  }
  const matchCount = matches.length;
  const limited = compiled.limit !== null ? matches.slice(0, compiled.limit) : matches.slice();

  const columns = resolveColumns(store, input.columns, compiled);
  const displaySort = input.sort;
  if (displaySort) limited.sort(displayComparator(store, displaySort, columns, byDefault));
  const matched = Int32Array.from(limited);
  const sortValues = keys.length > 0
    ? Float64Array.from(limited, (i) => (present(keys[0], i) ? keys[0].values[i] : Number.NaN))
    : null;

  const medians: Record<string, number | null> = {};
  for (const c of columns) medians[c.key] = medianOver(c.column, matched);

  const run: ScreenRun = {
    ok: compiled.ok,
    compiled,
    universe,
    matched,
    matchCount,
    sortValues,
    clauseTri: evaluation.clauseTri,
    clauseReason: evaluation.clauseReason,
    clauseLhs: evaluation.clauseLhs,
    clauseRhs: evaluation.clauseRhs,
    funnel: buildFunnel(compiled, evaluation),
    nearMisses: findNearMisses(compiled, evaluation, store, byDefault),
    skipped: groupSkipped(compiled, evaluation, store),
    warnings: warningsFor(store, compiled, universe, limited, matchCount, unknown),
    columns,
    medians,
    // Timing is measured by the caller: core code never reads the clock (§G.2).
    durationMs: 0,
  };
  return run;
};

// ── screens a company passes ────────────────────────────────────────────────
const compiledCache = new WeakMap<MetricStore, Map<string, CompiledQuery>>();

function compileCached(store: MetricStore, query: string): CompiledQuery {
  let m = compiledCache.get(store);
  if (!m) {
    m = new Map();
    compiledCache.set(store, m);
  }
  let c = m.get(query);
  if (!c) {
    c = compileQuery(query, store);
    if (m.size > 200) m.clear();
    m.set(query, c);
  }
  return c;
}

/**
 * For the company page: whether company `index` passes each screen. A screen with LIMIT passes
 * only when the company is within the limited result over the whole dataset. null = not
 * evaluated (missing data or a query error).
 */
export function screensPassedBy(
  store: MetricStore, index: number, screens: readonly { id: string; name: string; query: string }[],
): { id: string; name: string; passed: boolean | null }[] {
  return screens.map((s) => {
    const compiled = compileCached(store, s.query);
    if (!compiled.ok) return { id: s.id, name: s.name, passed: null };
    const tri = evaluateQuery(compiled, store, Int32Array.of(index)).whereTri[0];
    if (tri !== TRI_TRUE) return { id: s.id, name: s.name, passed: tri === TRI_FALSE ? false : null };
    if (compiled.limit === null) return { id: s.id, name: s.name, passed: true };
    const run = runScreen(store, { query: s.query, columns: null, sort: null, universe: { kind: "all" } }, { watchlist: [], portfolio: [] }, compiled);
    return { id: s.id, name: s.name, passed: run.matched.includes(index) };
  });
}

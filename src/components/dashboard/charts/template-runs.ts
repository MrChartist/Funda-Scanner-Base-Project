// Guided screens run once per dataset and watch/portfolio list; the cards and the scatter share the result.
import type { MetricStore, ScreenContext } from "@/lib/contracts";
import { runScreen, TEMPLATES } from "@/lib/screen";

export interface TemplateRun {
  id: string;
  ok: boolean;
  /** Matches before LIMIT. */
  matchCount: number;
  /** Companies the screen was run over. */
  universe: number;
  /** LIMIT from the query, or null. */
  limit: number | null;
  /** Store indices of the companies the screen returns (after LIMIT). */
  matched: ReadonlySet<number>;
}

const cache = new WeakMap<MetricStore, Map<string, TemplateRun[]>>();

export function runTemplates(store: MetricStore, ctx: ScreenContext): TemplateRun[] {
  const key = `${ctx.watchlist.join(",")}|${ctx.portfolio.join(",")}`;
  let perStore = cache.get(store);
  if (!perStore) {
    perStore = new Map();
    cache.set(store, perStore);
  }
  const hit = perStore.get(key);
  if (hit) return hit;
  const runs = TEMPLATES.map((t): TemplateRun => {
    const run = runScreen(store, { query: t.query, columns: null, sort: t.sort, universe: { kind: "all" } }, ctx);
    return {
      id: t.id,
      ok: run.ok,
      matchCount: run.ok ? run.matchCount : 0,
      universe: run.universe.length,
      limit: run.ok ? run.compiled.limit : null,
      matched: new Set(run.ok ? Array.from(run.matched) : []),
    };
  });
  perStore.set(key, runs);
  return runs;
}

/** "110 of 150 companies match", or for a ranked screen "top 20 of 110 ranked". */
export function describeRun(r: TemplateRun): string {
  if (r.limit !== null && r.matchCount > r.limit) return `top ${r.limit} of ${r.matchCount.toLocaleString("en-IN")} ranked`;
  return `${r.matchCount.toLocaleString("en-IN")} of ${r.universe.toLocaleString("en-IN")} companies match`;
}

// src/components/screener/use-template-counts.ts — live match count for each template, over the
// chosen universe. One template per timer tick, so the page stays responsive on large data.
import { useEffect, useState } from "react";
import type { MetricStore, ScreenContext, UniverseSpec } from "@/lib/contracts";
import { TRI_TRUE } from "@/lib/contracts";
import { compileQuery, evaluateQuery } from "@/lib/query";
import { TEMPLATES, resolveUniverse } from "@/lib/screen";

export type TemplateCounts = Readonly<Record<string, number>>;

export function useTemplateCounts(store: MetricStore | null, universe: UniverseSpec, ctx: ScreenContext): TemplateCounts {
  const [state, setState] = useState<{ store: MetricStore; universe: UniverseSpec; counts: TemplateCounts } | null>(null);
  useEffect(() => {
    if (!store) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const counts: Record<string, number> = {};
    const { universe: rows } = resolveUniverse(store, universe, ctx);
    const step = (k: number) => {
      if (cancelled || k >= TEMPLATES.length) return;
      const t = TEMPLATES[k];
      try {
        const compiled = compileQuery(t.query, store);
        if (compiled.ok) {
          const tri = evaluateQuery(compiled, store, rows).whereTri;
          let n = 0;
          for (let r = 0; r < rows.length; r++) if (tri[r] === TRI_TRUE) n++;
          counts[t.id] = n;
        }
      } catch {
        // A template that cannot be counted simply shows no number.
      }
      setState({ store, universe, counts: { ...counts } });
      timer = setTimeout(() => step(k + 1), 0);
    };
    timer = setTimeout(() => step(0), 0);
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [store, universe, ctx]);
  return state && state.store === store && state.universe === universe ? state.counts : {};
}

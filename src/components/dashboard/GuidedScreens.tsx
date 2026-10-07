import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { MetricStore, ScreenContext } from "@/lib/contracts";
import { runScreen, TEMPLATES } from "@/lib/screen";
import { formatNumberIN } from "@/lib/format/indian";
import { templateHref } from "@/components/common/search";
import { useLearnMode } from "@/hooks/use-learn-mode";
import { useWatchlist } from "@/hooks/use-watchlist";
import { usePortfolio } from "@/hooks/use-portfolio";
import { Switch } from "@/components/ui/switch";

export interface TemplateCount {
  id: string;
  /** Null when the query could not be run. */
  matches: number | null;
  universe: number;
}

/** Runs every guided screen over the loaded data. Pure; the caller memoises it. */
export function countTemplateMatches(store: MetricStore, ctx: ScreenContext): TemplateCount[] {
  return TEMPLATES.map((t) => {
    const run = runScreen(store, { query: t.query, columns: null, sort: t.sort, universe: { kind: "all" } }, ctx);
    return { id: t.id, matches: run.ok ? run.matchCount : null, universe: run.universe.length };
  });
}

export function GuidedScreens({ store }: { store: MetricStore }) {
  const { learnMode, setLearnMode } = useLearnMode();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();
  const symbolsKey = `${watchlist.symbols.join(",")}|${portfolio.holdings.map((h) => h.symbol).join(",")}`;

  const counts = useMemo(
    () => countTemplateMatches(store, { watchlist: watchlist.symbols, portfolio: portfolio.holdings.map((h) => h.symbol) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, symbolsKey],
  );

  return (
    <section aria-labelledby="guided-title" className="glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="guided-title" className="section-title">Guided screens</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ready-made rules for study. The counts are live: they are worked out on the data you have loaded.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground sm:min-h-0">
          <Switch checked={learnMode} onCheckedChange={setLearnMode} aria-label="Show explanations" />
          Show explanations
        </label>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const c = counts.find((x) => x.id === t.id);
          return (
            <li key={t.id} className="flex flex-col justify-between gap-3 rounded-lg border border-border/60 bg-card p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
                  <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">{t.level}</span>
                </div>
                {learnMode && <p className="text-xs leading-relaxed text-muted-foreground">{t.idea}</p>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-foreground" data-testid={`match-count-${t.id}`}>
                  {c && c.matches !== null ? (
                    <>
                      <strong className="tabular-nums">{formatNumberIN(c.matches, 0)}</strong>
                      <span className="text-muted-foreground"> of {formatNumberIN(c.universe, 0)} companies match</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Count not available</span>
                  )}
                </p>
                <Link
                  to={templateHref(t)}
                  aria-label={`Open ${t.title} in the Screener`}
                  className="flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline sm:min-h-0"
                >
                  Open <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

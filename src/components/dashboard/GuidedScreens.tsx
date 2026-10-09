import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { MetricStore, ScreenContext } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { runTemplates } from "./charts/template-runs";
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
  return runTemplates(store, ctx).map((r) => ({ id: r.id, matches: r.ok ? r.matchCount : null, universe: r.universe }));
}

export function GuidedScreens({ store }: { store: MetricStore }) {
  const { learnMode, setLearnMode } = useLearnMode();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();
  const symbolsKey = `${watchlist.symbols.join(",")}|${portfolio.holdings.map((h) => h.symbol).join(",")}`;

  const runs = useMemo(
    () => runTemplates(store, { watchlist: watchlist.symbols, portfolio: portfolio.holdings.map((h) => h.symbol) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, symbolsKey],
  );

  return (
    <section aria-labelledby="guided-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="guided-title" className="section-title">Guided screens</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ready-made rules for study. The counts are live: they are worked out on the data you have loaded.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground sm:min-h-9">
          <Switch checked={learnMode} onCheckedChange={setLearnMode} aria-label="Show explanations" />
          Show explanations
        </label>
      </div>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((t) => {
          const r = runs.find((x) => x.id === t.id);
          return (
            <li key={t.id} className="glass-card flex flex-col justify-between gap-2 p-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-snug text-foreground">{t.title}</h3>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t.level}</span>
                </div>
                {learnMode && <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground" title={t.idea}>{t.idea}</p>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground" data-testid={`match-count-${t.id}`}>
                  {r && r.ok ? (
                    r.limit !== null && r.matchCount > r.limit ? (
                      <>
                        top <strong className="num text-sm text-foreground">{formatNumberIN(r.limit, 0)}</strong> of {formatNumberIN(r.matchCount, 0)} ranked
                      </>
                    ) : (
                      <>
                        <strong className="num text-sm text-foreground">{formatNumberIN(r.matchCount, 0)}</strong> of {formatNumberIN(r.universe, 0)} companies match
                      </>
                    )
                  ) : (
                    "Count not available"
                  )}
                </p>
                <Link
                  to={templateHref(t)}
                  aria-label={`Open ${t.title} in the Screener`}
                  className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:min-h-9"
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

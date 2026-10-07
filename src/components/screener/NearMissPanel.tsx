import { Link } from "react-router-dom";
import type { MetricStore, ScreenRun } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { CompanyName } from "@/components/common/CompanyName";
import { Button } from "@/components/ui/button";
import { companyPath } from "./helpers";

export interface NearMissPanelProps {
  run: ScreenRun;
  store: MetricStore;
  onWhy: (storeIndex: number) => void;
}

/** Companies that fail exactly one rule, nearest first, with the gap in words. */
export function NearMissPanel({ run, store, onWhy }: NearMissPanelProps) {
  if (run.nearMisses.length === 0) {
    return (
      <EmptyState
        title="No near misses"
        description={run.compiled.clauses.length < 2 ? "Near misses need at least two rules: a company that passes all but one." : "No company fails exactly one rule while passing all the others."}
      />
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These companies pass every rule but one. Relaxing that one rule would add them to the matches. Showing the nearest {run.nearMisses.length}.
      </p>
      <ul className="space-y-2">
        {run.nearMisses.map((m) => {
          const clause = run.compiled.clauses[m.clause];
          const symbol = store.symbols[m.index];
          return (
            <li key={`${symbol}:${m.clause}`} className="rounded-lg border bg-card p-3 text-sm">
              <Link to={companyPath(symbol)} className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-2 hover:underline">
                <CompanyName name={store.company(m.index).name} isSynthetic={store.meta.isSynthetic} symbol={symbol} showSymbol />
              </Link>
              <p className="text-muted-foreground">Fails rule {m.clause + 1}{clause ? `: ${clause.english}` : ""}</p>
              <p className="mt-1">{m.gapText}</p>
              <Button type="button" variant="ghost" size="sm" className="min-h-11 px-0 text-primary" onClick={() => onWhy(m.index)} aria-label={`Rule results for ${store.company(m.index).name}`}>
                See every rule ▸
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

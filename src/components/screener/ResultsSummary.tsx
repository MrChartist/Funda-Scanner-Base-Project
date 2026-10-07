import type { ScreenRun } from "@/lib/contracts";
import { skippedTotal } from "./helpers";

export interface ResultsSummaryProps {
  run: ScreenRun;
  /** The query text has an error; the numbers are from the last valid query. */
  stale: boolean;
}

const STALE_NOTICE = "Your query has an error. Results below are from the last valid query.";

/** "{n} of {universe} match · {skipped} not evaluated", with warnings, announced politely. */
export function ResultsSummary({ run, stale }: ResultsSummaryProps) {
  const skipped = skippedTotal(run);
  return (
    <div className="space-y-2" data-testid="results-summary">
      <div className="space-y-2" aria-live="polite" aria-atomic="true">
      <p className="text-base font-semibold">
        {run.matchCount} of {run.universe.length} match · {skipped} not evaluated
      </p>
      {stale && <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm">{STALE_NOTICE}</p>}
      {run.warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {run.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
        </ul>
      )}
      </div>
      {run.skipped.length > 0 && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-medium">Why {skipped} {skipped === 1 ? "company was" : "companies were"} not evaluated</summary>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {run.skipped.map((g, i) => <li key={`${g.reason}:${i}`}>{g.message}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}

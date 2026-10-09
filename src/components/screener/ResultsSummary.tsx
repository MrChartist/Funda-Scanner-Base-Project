import type { ReactNode } from "react";
import { CircleAlert, StickyNote } from "lucide-react";
import type { ScreenRun } from "@/lib/contracts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { skippedTotal } from "./helpers";

export interface ResultsSummaryProps {
  run: ScreenRun;
  /** The query text has an error; the numbers are from the last valid query. */
  stale: boolean;
  /** The Matches / Near misses / Funnel switch, drawn at the right of the summary. */
  trailing?: ReactNode;
}

const STALE_NOTICE = "Your query has an error. Results below are from the last valid query.";

const LINK = "relative inline-flex items-center gap-1 rounded text-primary underline-offset-2 before:absolute before:-inset-x-1 before:-inset-y-3 before:content-[''] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** "{n} of {universe} match · {skipped} not evaluated", with the reasons one click away, announced politely. */
export function ResultsSummary({ run, stale, trailing }: ResultsSummaryProps) {
  const skipped = skippedTotal(run);
  return (
    <div className="space-y-2" data-testid="results-summary">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
        <div className="text-sm" aria-live="polite" aria-atomic="true">
          <p>
            <span className="num text-xl font-semibold tracking-tight">{run.matchCount}</span>
            <span className="text-muted-foreground"> of {run.universe.length} match</span>
            <span className="text-muted-foreground"> · {skipped} not evaluated</span>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {run.skipped.length > 0 && (
            <Popover>
              <PopoverTrigger className={LINK} aria-label={`Why not evaluated? ${skipped} ${skipped === 1 ? "company was" : "companies were"} not checked`}>
                <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Why not evaluated?
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] text-sm">
                <p className="font-medium">Why {skipped} {skipped === 1 ? "company was" : "companies were"} not evaluated</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {run.skipped.map((g, i) => <li key={`${g.reason}:${i}`}>{g.message}</li>)}
                </ul>
              </PopoverContent>
            </Popover>
          )}
          {run.warnings.length > 0 && (
            <Popover>
              <PopoverTrigger className={LINK} aria-label={`Data notes (${run.warnings.length})`}>
                <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
                Data notes ({run.warnings.length})
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] text-sm">
                <p className="font-medium">About this data</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {run.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
        </div>
        {trailing}
      </div>
      {stale && <p role="status" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-sm">{STALE_NOTICE}</p>}
    </div>
  );
}

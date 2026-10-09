import { SearchX } from "lucide-react";
import type { ScreenRun } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { loosestRule } from "./helpers";

export interface NoMatchesProps {
  run: ScreenRun;
  /** Remove one rule (0-based index into the rules). Omitted when the query text has an error. */
  onRemoveRule?: (clause: number) => void;
  onShowNearMisses: () => void;
  onShowFunnel: () => void;
}

/** Friendly empty state for valid rules that nothing passes, with the best rule to loosen. */
export function NoMatches({ run, onRemoveRule, onShowNearMisses, onShowFunnel }: NoMatchesProps) {
  const best = loosestRule(run);
  return (
    <EmptyState
      icon={<SearchX className="h-7 w-7" />}
      title="No companies match these rules"
      description={
        <div className="space-y-2">
          <p>No company passes every rule at once. Try relaxing one.</p>
          {best && (
            <p data-testid="loosen-suggestion" className="rounded-lg bg-muted/60 px-3 py-2 text-foreground">
              Loosen rule {best.clause + 1} first: without “{best.english}”, {best.dropOneMatches} {best.dropOneMatches === 1 ? "company would" : "companies would"} match.
            </p>
          )}
        </div>
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          {best && onRemoveRule && (
            <Button type="button" className="min-h-11" aria-label={`Remove rule ${best.clause + 1} and list more companies`} onClick={() => onRemoveRule(best.clause)}>Remove rule {best.clause + 1}</Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={onShowNearMisses}>Show near misses</Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={onShowFunnel}>Show the funnel</Button>
        </div>
      }
      className="py-10"
    />
  );
}

import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { NO_QUARTERLY_TEXT, quarterlyView } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";

export interface QuarterlyResultsProps {
  store: MetricStore;
  index: number;
}

/** Quarters laid out by date, oldest first, with changes on the previous quarter and on the same quarter a year before. */
export function QuarterlyResults({ store, index }: QuarterlyResultsProps) {
  const view = useMemo(() => quarterlyView(store, index), [store, index]);
  if (store.slots(index, "q") === 0 || view.rows.length === 0) {
    return <EmptyState title={NO_QUARTERLY_TEXT} description="Add a quarterly file to see recent quarters and trailing twelve month figures." />;
  }
  return (
    <div className="space-y-3">
      <PeriodTable caption="Quarterly results in rupees crore, oldest quarter first" periods={view.periods} rows={view.rows} family={store.family(index)} kind="quarterly" />
      {view.growth.length > 0 && (
        <PeriodTable caption="Quarterly changes, matched by date" periods={view.periods} rows={view.growth} family={store.family(index)} kind="quarterly" trend={false} />
      )}
      <p className="text-xs text-muted-foreground">
        Quarters are matched by their end date, so a missing quarter leaves a gap instead of shifting later figures. A change is not shown when the earlier figure is zero or negative.
      </p>
    </div>
  );
}

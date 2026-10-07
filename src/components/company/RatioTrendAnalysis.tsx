import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { NO_ANNUAL_TEXT, ratioView } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";

export interface RatioTrendAnalysisProps {
  store: MetricStore;
  index: number;
}

/** Ratios by year, each with the industry median for that year where at least three companies can be compared. */
export function RatioTrendAnalysis({ store, index }: RatioTrendAnalysisProps) {
  const view = useMemo(() => ratioView(store, index), [store, index]);
  if (store.slots(index, "fy") === 0) {
    return <EmptyState title={NO_ANNUAL_TEXT} description="Ratios over time are worked out from annual statements." />;
  }
  if (view.rows.length === 0) {
    return <EmptyState title="No ratio could be worked out from the data provided." />;
  }
  return (
    <div className="space-y-2">
      <PeriodTable caption="Ratios by year, oldest first, with the industry median" periods={view.periods} rows={view.rows} family={store.family(index)} />
      <p className="text-xs text-muted-foreground">
        {view.groupLabel ? `Industry median: ${view.groupLabel}. ` : ""}
        A median is shown only when at least three companies have a value for that year. Years are counted back from each company's own latest year.
      </p>
    </div>
  );
}

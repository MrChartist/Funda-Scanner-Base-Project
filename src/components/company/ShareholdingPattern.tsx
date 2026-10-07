import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { formatUnitValue } from "@/lib/format/metric-value";
import { NO_SHAREHOLDING_TEXT, shareholdingView } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";
import { TrendChart } from "./TrendChart";

export interface ShareholdingPatternProps {
  store: MetricStore;
  index: number;
}

/** Holding by quarter. Shown only when the file has it; yearly changes compare with four quarters back, matched by date. */
export function ShareholdingPattern({ store, index }: ShareholdingPatternProps) {
  const view = useMemo(() => shareholdingView(store, index), [store, index]);
  if (view.rows.length === 0) {
    return <EmptyState title={NO_SHAREHOLDING_TEXT} description="Add a shareholding file to see who owns the company and how that has changed." />;
  }
  const chartRows = view.rows.filter((r) => ["promoter_holding", "fii_holding", "dii_holding", "public_holding"].includes(r.id));
  const family = store.family(index);
  return (
    <div className="space-y-3">
      <TrendChart
        ariaLabel="Holding by group over time. The table below has the same figures."
        periods={view.periods.map((p) => p.label)}
        series={chartRows.map((r) => ({ key: r.id, label: r.def.short, values: r.values.map((v) => v.v) }))}
        format={(n) => formatUnitValue("pct", 1, n)}
        kind="line"
      />
      <PeriodTable caption="Shareholding by quarter, oldest first" periods={view.periods} rows={view.rows} family={family} />
      {view.changes.length > 0 && (
        <PeriodTable caption="Change in holding on four quarters back" periods={view.periods} rows={view.changes} family={family} />
      )}
      <p className="text-xs text-muted-foreground">Pledged shares are a percentage of the promoter holding, not of all shares. "Public and others" is an approximate balance.</p>
    </div>
  );
}

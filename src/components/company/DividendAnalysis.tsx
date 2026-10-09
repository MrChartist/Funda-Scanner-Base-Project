import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricInfo } from "@/components/common/MetricInfo";
import { ValueCell } from "@/components/common/ValueCell";
import { formatUnitValue } from "@/lib/format/metric-value";
import { dividendView, hasDividendData, NO_ANNUAL_TEXT } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";
import { TrendChart } from "./TrendChart";

export interface DividendAnalysisProps {
  store: MetricStore;
  index: number;
}

/** Dividend per share by year, payout and yield. Worked out from the dividend per share in the file; no dates or reinvestment projections. */
export function DividendAnalysis({ store, index }: DividendAnalysisProps) {
  const view = useMemo(() => dividendView(store, index), [store, index]);
  const family = store.family(index);
  if (store.slots(index, "fy") === 0) {
    return <EmptyState title={NO_ANNUAL_TEXT} description="Dividends are read from the dividend per share in the annual statements." />;
  }
  if (!hasDividendData(view)) {
    return <EmptyState title="Dividend per share was not provided in your file." description="Without it, the app cannot say whether a dividend was paid. A missing figure is never read as zero." />;
  }
  const dps = view.rows.find((r) => r.id === "dps");
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {view.summary.map((s) => (
          <div key={s.id} className="rounded-md border p-2">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{s.def.label}</span>
              <MetricInfo def={s.def} />
            </dt>
            <dd className="mt-1 text-base font-semibold"><ValueCell def={s.def} value={s.value} family={family} showPeriod /></dd>
          </div>
        ))}
      </dl>
      {dps && (
        <TrendChart
          ariaLabel="Dividend per share by year. The table below has the same figures."
          periods={view.periods.map((p) => p.label)}
          series={[{ key: "dps", label: "Dividend per share", values: dps.values.map((v) => v.v) }]}
          format={(n) => formatUnitValue("inr", 2, n)}
          height={200}
        />
      )}
      <PeriodTable caption="Dividend per share and payout by year, oldest first" periods={view.periods} rows={view.rows} family={family} />
    </div>
  );
}

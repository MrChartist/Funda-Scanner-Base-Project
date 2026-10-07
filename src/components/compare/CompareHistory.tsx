import { useMemo } from "react";
import type { MetricStore } from "@/lib/contracts";
import { TrendChart } from "@/components/company/TrendChart";
import { CompanyName } from "@/components/common/CompanyName";
import { formatUnitValue } from "@/lib/format/metric-value";
import { buildIndexed, hasIndexedData, type IndexedSeries } from "./compare-view";

export interface CompareHistoryProps {
  store: MetricStore;
  indices: readonly number[];
}

const fmt = (n: number) => formatUnitValue("score", 1, n);

function IndexedBlock({ title, store, indices, years, series, id }: {
  title: string; store: MetricStore; indices: readonly number[]; years: string[]; series: IndexedSeries[]; id: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <TrendChart
        ariaLabel={`${title}, one line per company. The table below has the same figures.`}
        periods={years}
        series={series.map((s) => ({ key: store.symbols[s.index], label: store.symbols[s.index], values: s.values }))}
        format={fmt}
        kind="line"
      />
      <details className="mt-2 rounded-md border" id={id}>
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">Show the same figures as a table</summary>
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${title}, table`}>
          <table className="w-full min-w-max border-collapse text-sm">
            <caption className="sr-only">{title}. The first usable year of each company is 100.</caption>
            <thead>
              <tr className="border-b bg-muted/40">
                <th scope="col" className="sticky left-0 bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground">Company</th>
                {years.map((y) => <th key={y} scope="col" className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.index} className="border-b last:border-0">
                  <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left text-sm font-normal">
                    <CompanyName name={store.company(s.index).name} isSynthetic={store.meta.isSynthetic} />
                  </th>
                  {s.values.map((v, k) => (
                    <td key={k} className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{v === null ? "—" : fmt(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Sales and net profit over up to ten years, each company indexed to 100 in its first usable year. No price overlay. */
export function CompareHistory({ store, indices }: CompareHistoryProps) {
  const view = useMemo(() => buildIndexed(store, indices), [store, indices]);
  if (!hasIndexedData(view)) {
    return <p className="text-sm text-muted-foreground">Annual statements were not provided for these companies, so there is no history to chart.</p>;
  }
  return (
    <div className="space-y-5">
      <IndexedBlock id="indexed-sales" title="Sales, indexed (first usable year = 100)" store={store} indices={indices} years={view.years} series={view.sales} />
      <IndexedBlock id="indexed-profit" title="Net profit, indexed (first usable year = 100)" store={store} indices={indices} years={view.years} series={view.profit} />
      <p className="text-xs text-muted-foreground">
        Years are matched by financial year. A year with a missing, zero or negative figure is left blank. Indexing shows how each company grew relative to itself, not how large it is.
      </p>
    </div>
  );
}

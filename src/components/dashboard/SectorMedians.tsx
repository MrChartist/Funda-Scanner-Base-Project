import { useId, useMemo, useState } from "react";
import type { MetricStore } from "@/lib/contracts";
import { PEER_MIN } from "@/lib/contracts";
import { formatMetric } from "@/lib/format/metric-value";
import { formatNumberIN } from "@/lib/format/indian";
import { PEER_CLASS_LABEL, sectorMedians } from "./stats";

const CHOICES = ["roce", "pe", "debt_equity", "pat_margin", "sales_cagr_5y"] as const;

export function SectorMedians({ store }: { store: MetricStore }) {
  const selectId = useId();
  const choices = useMemo(() => CHOICES.filter((id) => store.def(id)), [store]);
  const [metricId, setMetricId] = useState<string>(choices[0] ?? "");
  const def = store.def(metricId);

  const rows = useMemo(() => (def ? sectorMedians(store, metricId) : []), [store, metricId, def]);
  const classesBySector = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) m.set(r.sector, (m.get(r.sector) ?? new Set()).add(r.peerClass));
    return m;
  }, [rows]);

  if (!def) return null;

  return (
    <section aria-labelledby="sector-medians-title" className="glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="sector-medians-title" className="section-title">Sector medians</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The middle value of each sector in your data. n is the number of companies that have a value; a median needs at least {PEER_MIN.median}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">Metric</label>
          <select
            id={selectId}
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
            className="min-h-11 rounded-md border border-input bg-card px-2 text-sm text-foreground sm:min-h-9"
          >
            {choices.map((id) => (
              <option key={id} value={id}>{store.def(id)?.label ?? id}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="relative overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Median of {def.label} by sector, with the number of companies behind each median</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th scope="col" className="data-header">Sector</th>
              <th scope="col" className="data-header text-right">Companies</th>
              <th scope="col" className="data-header text-right">Median ({def.periodTag})</th>
              <th scope="col" className="data-header text-right">n</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const multi = (classesBySector.get(r.sector)?.size ?? 0) > 1;
              return (
                <tr key={r.key} className="border-b border-border/20 last:border-0">
                  <th scope="row" className="data-cell text-left font-sans font-medium text-foreground">
                    {r.sector}
                    {multi && <span className="ml-1 font-normal text-muted-foreground">({PEER_CLASS_LABEL[r.peerClass]})</span>}
                  </th>
                  <td className="data-cell text-right">{formatNumberIN(r.companies, 0)}</td>
                  <td className="data-cell text-right">
                    {r.median !== null ? formatMetric(def, { v: r.median, reason: null, flags: 0 }) : <span className="text-muted-foreground">{r.n === 0 ? "Not available" : "Too few"}</span>}
                  </td>
                  <td className="data-cell text-right">{formatNumberIN(r.n, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

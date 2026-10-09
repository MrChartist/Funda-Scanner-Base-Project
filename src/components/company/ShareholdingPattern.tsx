import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricStore } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { ValueCell } from "@/components/common/ValueCell";
import { formatUnitValue } from "@/lib/format/metric-value";
import { NO_SHAREHOLDING_TEXT, shareholdingView } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";
import { AXIS_TICK, CHART, canChart } from "./viz/chart-theme";
import { TooltipCard } from "./viz/TooltipCard";

export interface ShareholdingPatternProps {
  store: MetricStore;
  index: number;
}

/** Fixed order and colours: blue, amber, cyan are told apart under the common colour-vision deficiencies; "public" is neutral grey. Names are always shown. */
const SERIES = [
  { id: "promoter_holding", color: CHART.blue },
  { id: "fii_holding", color: CHART.amber },
  { id: "dii_holding", color: CHART.cyan },
  { id: "public_holding", color: "hsl(var(--muted-foreground) / 0.55)" },
] as const;

const pct1 = (n: number) => formatUnitValue("pct", 1, n);

/** Holding by quarter. Shown only when the file has it; yearly changes compare with four quarters back, matched by date. */
export function ShareholdingPattern({ store, index }: ShareholdingPatternProps) {
  const view = useMemo(() => shareholdingView(store, index), [store, index]);
  const [open, setOpen] = useState(false);
  if (view.rows.length === 0) {
    return <EmptyState title={NO_SHAREHOLDING_TEXT} description="Add a shareholding file to see who owns the company and how that has changed." />;
  }
  const family = store.family(index);
  const series = SERIES.flatMap((s) => {
    const row = view.rows.find((r) => r.id === s.id);
    return row ? [{ ...s, row, label: row.def.short }] : [];
  });
  const lastIdx = view.periods.length - 1;
  const zeroSeries = series.filter((s) => s.row.values.some((v) => v.v !== null) && s.row.values.every((v) => v.v === null || v.v === 0));
  const data = view.periods.map((p, k) => {
    const d: Record<string, string | number | undefined> = { period: p.label };
    for (const s of series) d[s.id] = s.row.values[k].v ?? undefined;
    return d;
  });
  const latestPeriod = view.periods[lastIdx]?.label;
  const latestTotal = series.reduce((sum, s) => sum + (s.row.values[lastIdx]?.v ?? 0), 0);

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Series">
        {series.map((s) => (
          <li key={s.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>

      {canChart() && (
        <div
          role="img"
          aria-label={`Holding by group at each quarter end, stacked to about 100 per cent. Latest quarter ${latestPeriod}. The latest split is listed below and a table has every figure.`}
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="period" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => formatUnitValue("pct", 0, v)} />
              <Tooltip
                cursor={{ stroke: CHART.muted, strokeDasharray: "3 3" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as Record<string, number | undefined>;
                  return (
                    <TooltipCard
                      title={String(label)}
                      rows={series.map((s) => ({ name: s.label, text: row[s.id] === undefined ? "Not provided" : pct1(row[s.id] as number), color: s.color }))}
                    />
                  );
                }}
              />
              {series.map((s) => (
                <Area
                  key={s.id}
                  type="linear"
                  dataKey={s.id}
                  stackId="holding"
                  stroke={CHART.surface}
                  strokeWidth={1.5}
                  fill={s.color}
                  fillOpacity={0.9}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold">Latest split{latestPeriod ? `, ${latestPeriod}` : ""}</h3>
        <div className="mt-1.5 flex h-6 w-full gap-0.5 overflow-hidden rounded-md" aria-hidden="true" data-testid="latest-split">
          {series.map((s) => {
            const v = s.row.values[lastIdx]?.v ?? 0;
            return v > 0 && latestTotal > 0 ? <div key={s.id} style={{ width: `${(v / latestTotal) * 100}%`, background: s.color }} /> : null;
          })}
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="ml-auto font-medium"><ValueCell def={s.row.def} value={s.row.values[lastIdx]} family={family} /></dd>
            </div>
          ))}
        </dl>
      </div>

      {zeroSeries.length > 0 && (
        <p className="rounded-md border border-dashed px-3 py-2 text-sm" role="note">
          {zeroSeries.map((s) => s.label).join(" and ")} {zeroSeries.length === 1 ? "is" : "are"} zero in every quarter in the data, so {zeroSeries.length === 1 ? "it does" : "they do"} not appear as a visible band. That is what the file says; it has not been filled in.
        </p>
      )}

      <details className="rounded-md border" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">View as table</summary>
        {open && (
          <div className="space-y-3 p-2">
            <PeriodTable caption="Shareholding by quarter, oldest first" periods={view.periods} rows={view.rows} family={family} kind="quarterly" />
            {view.changes.length > 0 && (
              <PeriodTable caption="Change in holding on four quarters back" periods={view.periods} rows={view.changes} family={family} kind="quarterly" trend={false} />
            )}
          </div>
        )}
      </details>
      <p className="text-xs text-muted-foreground">Pledged shares are a percentage of the promoter holding, not of all shares. "Public and others" is an approximate balance.</p>
    </div>
  );
}

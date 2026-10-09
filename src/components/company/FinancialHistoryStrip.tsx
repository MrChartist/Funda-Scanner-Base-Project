import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricDef, MetricId, MetricStore, MetricValue, TypeFamily } from "@/lib/contracts";
import { ValueCell } from "@/components/common/ValueCell";
import { formatMetric } from "@/lib/format/metric-value";
import { hasHistory, medianSeries, metricHistory, PLAIN, type GridRow } from "@/lib/views/company-view";
import { PeriodTable } from "./PeriodTable";
import { AXIS_TICK, CHART, canChart } from "./viz/chart-theme";
import { TooltipCard } from "./viz/TooltipCard";

export interface FinancialHistoryStripProps {
  store: MetricStore;
  index: number;
}

interface PanelSpec {
  id: MetricId;
  kind: "bar" | "line";
  color: string;
  median?: boolean;
}

const PANELS: Readonly<Record<TypeFamily, readonly PanelSpec[]>> = {
  non_financial: [
    { id: "sales", kind: "bar", color: CHART.blue },
    { id: "pat", kind: "bar", color: CHART.cyan },
    { id: "opm", kind: "line", color: CHART.amber },
    { id: "roce", kind: "line", color: CHART.blue, median: true },
  ],
  lender: [
    { id: "sales", kind: "bar", color: CHART.blue },
    { id: "pat", kind: "bar", color: CHART.cyan },
    { id: "roe", kind: "line", color: CHART.blue, median: true },
    { id: "cost_to_income", kind: "line", color: CHART.amber },
  ],
  insurance: [
    { id: "sales", kind: "bar", color: CHART.blue },
    { id: "pat", kind: "bar", color: CHART.cyan },
    { id: "roe", kind: "line", color: CHART.blue, median: true },
    { id: "npm", kind: "line", color: CHART.amber },
  ],
};

interface Panel {
  def: MetricDef;
  spec: PanelSpec;
  labels: string[];
  values: MetricValue[];
  medians: MetricValue[] | null;
  latest: MetricValue;
  min: number;
  max: number;
}

function buildPanels(store: MetricStore, index: number): Panel[] {
  const family = store.family(index);
  return PANELS[family].flatMap((spec): Panel[] => {
    const def = store.def(spec.id);
    if (!def) return [];
    const h = metricHistory(store, index, spec.id);
    if (!hasHistory(h, 2)) return [];
    const nums = h.values.flatMap((v) => (v.v === null ? [] : [v.v]));
    const latest = [...h.values].reverse().find((v) => v.v !== null) ?? h.values[h.values.length - 1];
    const medians = spec.median ? medianSeries(store, index, spec.id, h.offsets) : null;
    return [{ def, spec, labels: h.labels, values: h.values, medians, latest, min: Math.min(...nums), max: Math.max(...nums) }];
  });
}

function PanelChart({ panel }: { panel: Panel }) {
  const { def, spec, labels, values, medians } = panel;
  const data = labels.map((label, k) => ({ label, v: values[k].v ?? undefined, m: medians?.[k].v ?? undefined }));
  const fmt = (n: number) => formatMetric(def, PLAIN(n));
  const last = data.length - 1;
  const xAxis = (
    <XAxis
      dataKey="label"
      tick={AXIS_TICK}
      tickLine={false}
      axisLine={{ stroke: CHART.grid }}
      interval={0}
      tickFormatter={(l: string, k: number) => (k === 0 || k === last ? l : "")}
      padding={{ left: 4, right: 4 }}
    />
  );
  const tip = (
    <Tooltip
      cursor={{ fill: "hsl(var(--muted) / 0.6)", stroke: CHART.muted, strokeDasharray: "3 3" }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const row = payload[0].payload as { v?: number; m?: number };
        return (
          <TooltipCard
            title={String(label)}
            rows={[
              { name: def.short, text: row.v === undefined ? "Not provided" : fmt(row.v), color: spec.color },
              ...(row.m !== undefined ? [{ name: "Industry median", text: fmt(row.m), color: CHART.muted, dashed: true }] : []),
            ]}
          />
        );
      }}
    />
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {spec.kind === "bar" ? (
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis hide domain={[(lo: number) => Math.min(0, lo), "auto"]} />
          {xAxis}
          {tip}
          <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((_, k) => (
              <Cell key={k} fill={spec.color} fillOpacity={k === last ? 1 : 0.5} />
            ))}
          </Bar>
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 6, right: 14, bottom: 0, left: 14 }}>
          <YAxis hide domain={[(lo: number) => Math.min(0, lo), "auto"]} />
          {xAxis}
          {tip}
          {medians && <Line dataKey="m" stroke={CHART.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />}
          <Line
            dataKey="v"
            stroke={spec.color}
            strokeWidth={2.25}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === last && p.cx !== undefined && p.cy !== undefined ? (
                <circle key="last" cx={p.cx} cy={p.cy} r={4} fill={spec.color} stroke={CHART.surface} strokeWidth={2} />
              ) : (
                <g key={p.index} />
              )
            }
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

/** Four small multiples over ten years: sales, profit, a margin and a return. Each has its latest value, range and a table alternative. */
export function FinancialHistoryStrip({ store, index }: FinancialHistoryStripProps) {
  const panels = useMemo(() => buildPanels(store, index), [store, index]);
  const [open, setOpen] = useState(false);
  const family = store.family(index);
  if (panels.length === 0) return null;
  const rows: (GridRow & { medians: MetricValue[] | null })[] = panels.map((p) => ({
    id: p.def.id, label: p.def.label, def: p.def, values: p.values, derived: false, medians: p.medians,
  }));
  const periods = panels[0].labels.map((label, k) => ({ key: `h${k}`, label, note: null }));
  return (
    <div data-testid="financial-history">
      <h3 className="text-sm font-semibold">Financial history</h3>
      <p className="text-sm text-muted-foreground">Up to ten financial years, oldest on the left. The latest year is the solid bar or the dot.</p>
      <div className="mt-2 grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {panels.map((p) => (
          <figure key={p.def.id} className="rounded-lg border bg-card p-3">
            <figcaption className="text-xs text-muted-foreground">{p.def.label}</figcaption>
            <div className="mt-0.5 text-lg font-semibold leading-tight">
              <ValueCell def={p.def} value={p.latest} family={family} showPeriod />
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="block">{p.labels.length}-year range</span>
              <ValueCell def={p.def} value={PLAIN(p.min)} family={family} /> to <ValueCell def={p.def} value={PLAIN(p.max)} family={family} />
            </div>
            {canChart() && (
              <div
                role="img"
                aria-label={`${p.def.label} by year, ${p.labels[0]} to ${p.labels[p.labels.length - 1]}. Latest ${formatMetric(p.def, p.latest)}. The table below the charts has every figure.`}
                className="mt-2 h-24 w-full"
              >
                <PanelChart panel={p} />
              </div>
            )}
            {p.medians && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" /> Industry median
              </p>
            )}
          </figure>
        ))}
      </div>
      <details className="mt-2 rounded-md border" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm">View as table</summary>
        {open && (
          <div className="p-2">
            <PeriodTable caption="Financial history, oldest year first" periods={periods} rows={rows} family={family} trend={false} />
          </div>
        )}
      </details>
    </div>
  );
}

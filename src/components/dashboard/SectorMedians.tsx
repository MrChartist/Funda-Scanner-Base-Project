import { useId, useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricStore } from "@/lib/contracts";
import { PEER_MIN } from "@/lib/contracts";
import { formatMetric } from "@/lib/format/metric-value";
import { formatNumberIN } from "@/lib/format/indian";
import { EmptyState } from "@/components/common/EmptyState";
import { ChartCard, Segmented, TableDisclosure } from "./charts/ChartCard";
import { PEER_CLASS_LABEL, sectorMedians, type SectorRow } from "./stats";

const CHOICES = ["roce", "roe", "pe", "debt_equity", "sales_cagr_5y", "opm"] as const;
const MAX_BARS = 14;
const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

interface BarRow {
  key: string;
  label: string;
  n: number;
  value: number;
  few: boolean;
}

function Tick({ x, y, payload, bars }: { x?: number; y?: number; payload?: { value: string }; bars: Map<string, BarRow> }) {
  const b = payload ? bars.get(payload.value) : undefined;
  if (!b || x === undefined || y === undefined) return null;
  const name = b.label.length > 19 ? `${b.label.slice(0, 18)}…` : b.label;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{b.label}</title>
      <text x={-8} y={-2} textAnchor="end" fontSize={12} fill="hsl(var(--foreground))">{name}</text>
      <text x={-8} y={12} textAnchor="end" fontSize={10.5} fill={MUTED}>{b.few ? `n = ${b.n} · few companies` : `n = ${b.n}`}</text>
    </g>
  );
}

export function SectorMedians({ store }: { store: MetricStore }) {
  const hatchId = useId().replace(/:/g, "");
  const choices = useMemo(() => CHOICES.filter((id) => store.def(id)), [store]);
  const [metricId, setMetricId] = useState<string>(choices[0] ?? "");
  const def = store.def(metricId);

  const rows = useMemo(() => (def ? sectorMedians(store, metricId) : []), [store, metricId, def]);
  const labelled = useMemo(() => {
    const classes = new Map<string, Set<string>>();
    for (const r of rows) classes.set(r.sector, (classes.get(r.sector) ?? new Set()).add(r.peerClass));
    return rows.map((r: SectorRow) => ({ r, label: (classes.get(r.sector)?.size ?? 0) > 1 ? `${r.sector} (${PEER_CLASS_LABEL[r.peerClass]})` : r.sector }));
  }, [rows]);

  const { bars, hidden } = useMemo(() => {
    const all: BarRow[] = labelled
      .filter(({ r }) => r.rawMedian !== null && r.n > 0)
      .map(({ r, label }) => ({ key: r.key, label, n: r.n, value: r.rawMedian as number, few: r.n < PEER_MIN.median }))
      .sort((a, b) => b.value - a.value);
    // Keep the largest groups when there are many sectors; the table lists the rest.
    const top = all.length > MAX_BARS ? [...all].sort((a, b) => b.n - a.n).slice(0, MAX_BARS).sort((a, b) => b.value - a.value) : all;
    return { bars: top, hidden: all.length - top.length };
  }, [labelled]);

  if (!def) return null;
  const options = choices.map((id) => ({ value: id, label: store.def(id)?.short ?? id }));
  const fmt = (v: number) => formatMetric(def, { v, reason: null, flags: 0 });
  const solid = bars.filter((b) => !b.few);
  const few = bars.filter((b) => b.few).length;
  const byLabel = new Map(bars.map((b) => [b.label, b]));
  const top = solid[0];
  const bottom = solid[solid.length - 1];
  const takeaway =
    top && bottom && top !== bottom ? (
      <>
        Among sectors with at least {PEER_MIN.median} companies, median {def.short} runs from <strong className="num">{fmt(bottom.value)}</strong> ({bottom.label}) to{" "}
        <strong className="num">{fmt(top.value)}</strong> ({top.label}).
      </>
    ) : (
      <>Not enough sectors with {PEER_MIN.median} or more companies to compare medians.</>
    );
  const range = bars.map((b) => b.value);
  const hasNegative = range.some((v) => v < 0);
  const height = Math.max(160, bars.length * 40 + 40);

  return (
    <ChartCard
      title="Sector medians"
      takeaway={bars.length > 0 ? takeaway : undefined}
      skeletonHeight={320}
      className="min-w-0"
      controls={<Segmented label="Metric" value={metricId} options={options} onChange={setMetricId} />}
      footnote={
        <>
          <p>
            The middle value of each sector in your data. n is the number of companies with a value. A median needs at least {PEER_MIN.median}; hatched bars have fewer
            ({few > 0 ? few : "none here"}) and should be read with care.
          </p>
          {hidden > 0 && <p>Showing the {MAX_BARS} largest sectors; the table lists all {formatNumberIN(rows.length, 0)}.</p>}
        </>
      }
    >
      {bars.length === 0 ? (
        <EmptyState title={`No sector has ${def.label} in this data`} description={`Medians need at least one company with a value for ${def.label}. Try another metric.`} />
      ) : (
        <div role="img" aria-label={`Bar chart of median ${def.label} by sector, ${bars.length} sectors. The table below has the same figures.`} style={{ height }} className="w-full">
          {typeof ResizeObserver !== "undefined" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bars} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={8}>
                <defs>
                  <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="hsl(var(--card))" />
                    <rect width="2.5" height="6" fill={MUTED} fillOpacity={0.6} />
                  </pattern>
                </defs>
                <XAxis type="number" hide domain={[hasNegative ? "auto" : 0, "auto"]} />
                <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} interval={0} tick={(p) => <Tick {...p} bars={byLabel} />} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.5 }}
                  isAnimationActive={false}
                  content={({ active, payload }) => {
                    const b = payload?.[0]?.payload as BarRow | undefined;
                    if (!active || !b) return null;
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                        <p className="font-semibold">{b.label}</p>
                        <p className="num">Median {def.short}: <strong>{fmt(b.value)}</strong></p>
                        <p className="text-muted-foreground">{b.n} companies with a value{b.few ? ` (fewer than ${PEER_MIN.median}: read with care)` : ""}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18}>
                  {bars.map((b) => (
                    <Cell key={b.key} fill={b.few ? `url(#${hatchId})` : PRIMARY} stroke={b.few ? MUTED : "none"} strokeWidth={b.few ? 1 : 0} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v: number) => fmt(v)} fontSize={12} fill="hsl(var(--foreground))" className="num" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      <TableDisclosure summary={`View as table (${rows.length} sectors)`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[26rem] text-xs">
            <caption className="sr-only">Median of {def.label} by sector, with the number of companies behind each median</caption>
            <thead>
              <tr className="border-b border-border/60">
                <th scope="col" className="data-header text-left">Sector</th>
                <th scope="col" className="data-header text-right">Companies</th>
                <th scope="col" className="data-header text-right">Median ({def.periodTag})</th>
                <th scope="col" className="data-header text-right">n</th>
              </tr>
            </thead>
            <tbody>
              {labelled.map(({ r, label }) => (
                <tr key={r.key} className="border-b border-border/20 last:border-0">
                  <th scope="row" className="data-cell text-left font-sans font-medium text-foreground">{label}</th>
                  <td className="data-cell text-right">{formatNumberIN(r.companies, 0)}</td>
                  <td className="data-cell text-right">
                    {r.median !== null ? fmt(r.median) : <span className="text-muted-foreground">{r.n === 0 ? "Not available" : "Too few"}</span>}
                  </td>
                  <td className="data-cell text-right">{formatNumberIN(r.n, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableDisclosure>
    </ChartCard>
  );
}

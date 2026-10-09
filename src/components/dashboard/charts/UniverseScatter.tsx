import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricStore } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { formatMetric } from "@/lib/format/metric-value";
import { formatNumberIN } from "@/lib/format/indian";
import { CompanyName } from "@/components/common/CompanyName";
import { EmptyState } from "@/components/common/EmptyState";
import { useWatchlist } from "@/hooks/use-watchlist";
import { usePortfolio } from "@/hooks/use-portfolio";
import { buildUniverse, MAX_SCATTER_POINTS, MIN_PLOTTED, thin, type ScatterPoint, type UniverseData } from "./chart-data";
import { ChartCard, Segmented, TableDisclosure } from "./ChartCard";
import { describeRun, runTemplates } from "./template-runs";

const PRIMARY = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";
const SURFACE = "hsl(var(--card))";
const TABLE_ROWS = 300;

interface Datum extends ScatterPoint {
  name: string;
  symbol: string;
  sector: string;
  hit: boolean;
}

function pct(v: number): string {
  return `${Math.round(v)}%`;
}

type DotMode = "plain" | "context";

/** plain: every company alike. With a screen picked, matches become larger filled diamonds and the rest recede (colour is not the only cue). */
function Dot({ cx, cy, payload, mode }: { cx?: number; cy?: number; payload?: Datum; mode: DotMode }) {
  if (cx === undefined || cy === undefined) return null;
  const style = { cursor: "pointer" };
  if (payload?.hit)
    return <path d={`M${cx} ${cy - 7.5} L${cx + 7.5} ${cy} L${cx} ${cy + 7.5} L${cx - 7.5} ${cy} Z`} fill={PRIMARY} stroke={SURFACE} strokeWidth={1.5} style={style} />;
  if (mode === "context") return <circle cx={cx} cy={cy} r={2.5} fill={MUTED} fillOpacity={0.28} style={style} />;
  return <circle cx={cx} cy={cy} r={3.5} fill={PRIMARY} fillOpacity={0.55} stroke={SURFACE} strokeWidth={0.5} style={style} />;
}

function Tip({ active, payload, store, data, xDef, yDef }: {
  active?: boolean;
  payload?: { payload: Datum }[];
  store: MetricStore;
  data: UniverseData;
  xDef: ReturnType<MetricStore["def"]>;
  yDef: ReturnType<MetricStore["def"]>;
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d || !xDef || !yDef) return null;
  const fmt = (def: typeof xDef, v: number) => formatMetric(def, { v, reason: null, flags: 0 });
  return (
    <div className="max-w-[16rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="font-semibold"><CompanyName name={d.name} isSynthetic={store.meta.isSynthetic} /></p>
      <p className="text-muted-foreground">{d.sector}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_auto] justify-between gap-x-4 gap-y-0.5">
        <dt className="text-muted-foreground">{data.xLabel}</dt>
        <dd className="num font-medium">{fmt(xDef, d.x)}</dd>
        <dt className="text-muted-foreground">{data.yLabel}</dt>
        <dd className="num font-medium">{fmt(yDef, d.y)}</dd>
      </dl>
      <p className="mt-1.5 text-[11px] text-muted-foreground">Click to open the company page</p>
    </div>
  );
}

export function UniverseScatter({ store }: { store: MetricStore }) {
  const navigate = useNavigate();
  const watchlist = useWatchlist();
  const portfolio = usePortfolio();
  const [pick, setPick] = useState<string>("none");
  const data = useMemo(() => buildUniverse(store), [store]);
  const ctxKey = `${watchlist.symbols.join(",")}|${portfolio.holdings.map((h) => h.symbol).join(",")}`;
  const runs = useMemo(
    () => runTemplates(store, { watchlist: watchlist.symbols, portfolio: portfolio.holdings.map((h) => h.symbol) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, ctxKey],
  );
  const run = pick === "none" ? null : runs.find((r) => r.id === pick) ?? null;
  const template = run ? TEMPLATES.find((t) => t.id === run.id) : undefined;
  const highlighted = run?.matched ?? null;

  const { shown, thinned, hitPlotted } = useMemo(() => {
    if (!data) return { shown: [] as Datum[], thinned: false, hitPlotted: 0 };
    const t = thin(data.inRange, highlighted);
    const rows: Datum[] = t.shown.map((p) => ({
      ...p,
      name: store.company(p.i).name,
      symbol: store.symbols[p.i],
      sector: store.sector(p.i) || "Unclassified",
      hit: highlighted ? highlighted.has(p.i) : false,
    }));
    return { shown: rows, thinned: t.thinned, hitPlotted: highlighted ? data.inRange.filter((p) => highlighted.has(p.i)).length : 0 };
  }, [data, highlighted, store]);

  const table = useMemo(() => (data ? [...data.inRange].sort((a, b) => b.x - a.x) : []), [data]);
  const xDef = data ? store.def(data.xId) : undefined;
  const yDef = data ? store.def(data.yId) : undefined;

  if (!data || !xDef || !yDef) {
    return (
      <ChartCard title="The universe at a glance" className="lg:col-span-2" skeletonHeight={200}>
        <EmptyState
          title="This chart needs more than your data has"
          description={
            <>
              It plots non-financial companies by return on capital (ROCE) against earnings yield. It needs annual statements and a price for at least {MIN_PLOTTED} such companies. Import
              statements and prices for more companies, or open the Screener to explore what you have.
            </>
          }
        />
      </ChartCard>
    );
  }

  const strong = (n: number) => <strong className="num">{formatNumberIN(n, 0)}</strong>;
  const takeaway = (
    <>
      Across {strong(data.eligible)} companies the median {data.xLabel.replace(/ \(.*\)/, "")} is{" "}
      <strong className="num">{formatMetric(xDef, { v: data.medianX, reason: null, flags: 0 })}</strong> and the median earnings yield{" "}
      <strong className="num">{formatMetric(yDef, { v: data.medianY, reason: null, flags: 0 })}</strong>; {strong(data.topRight)} sit above both.
    </>
  );
  const ariaLabel = `Scatter chart of ${data.eligible} companies: ${data.xLabel} across, earnings yield up. Median ${data.xLabel} ${pct(data.medianX)}, median earnings yield ${pct(data.medianY)}. A table of the plotted companies follows the chart.`;
  const chipOptions = [
    { value: "none", label: "All companies" },
    ...TEMPLATES.map((t) => {
      const r = runs.find((x) => x.id === t.id);
      return { value: t.id, label: t.title, hint: r && r.ok ? formatNumberIN(r.matchCount, 0) : undefined };
    }),
  ];
  const plotted = shown.length;

  return (
    <ChartCard
      title="The universe at a glance"
      takeaway={takeaway}
      className="lg:col-span-2"
      skeletonHeight={380}
      controls={
        <div className="space-y-2">
          <p className="type-caption">Pick a guided screen to see where its companies sit.</p>
          <Segmented label="Highlight a guided screen" value={pick} options={chipOptions} onChange={setPick} />
          <p className="min-h-5 text-xs text-foreground" role="status" data-testid="scatter-highlight-status">
            {run && template ? (
              <>
                <strong className="num">{formatNumberIN(hitPlotted, 0)}</strong> highlighted on the chart. {template.title}: {describeRun(run)}
                {run.matched.size > hitPlotted ? `; ${formatNumberIN(run.matched.size - hitPlotted, 0)} not on this chart (lenders, outliers or missing data).` : "."}
              </>
            ) : null}
          </p>
        </div>
      }
      footnote={
        <>
          <p data-testid="scatter-coverage">
            {formatNumberIN(plotted, 0)} of {formatNumberIN(data.nonFinancial, 0)} non-financial companies plotted.
            {data.missing > 0 && ` ${formatNumberIN(data.missing, 0)} lack ROCE or earnings yield (loss-making, too little history or no price).`}
            {data.outliers > 0 && ` ${formatNumberIN(data.outliers, 0)} outliers are beyond the axes and not shown (the axes cover the 2nd to 98th percentile).`}
            {data.otherTypes > 0 && ` ${formatNumberIN(data.otherTypes, 0)} lenders and insurers are left out: ROCE and earnings yield do not apply to them.`}
          </p>
          {thinned && <p>Showing an even sample of {formatNumberIN(MAX_SCATTER_POINTS, 0)} points to keep the page quick; the table below lists them all.</p>}
          <p>Dashed lines mark the medians. Quadrant labels describe position only, not a recommendation.</p>
        </>
      }
    >
      <div className="relative" role="img" aria-label={ariaLabel}>
        <div className="h-[340px] w-full sm:h-[400px]" aria-hidden="true">
          {typeof ResizeObserver !== "undefined" && (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, bottom: 30, left: 4 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={data.xDomain}
                  ticks={data.xTicks}
                  tickFormatter={pct}
                  tick={{ fontSize: 11, fill: MUTED }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  label={{ value: data.xLabel, position: "insideBottom", offset: -18, fill: MUTED, fontSize: 11 }}
                  allowDataOverflow
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={data.yDomain}
                  ticks={data.yTicks}
                  tickFormatter={pct}
                  tick={{ fontSize: 11, fill: MUTED }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  label={{ value: data.yLabel, angle: -90, position: "insideLeft", offset: 6, fill: MUTED, fontSize: 11, style: { textAnchor: "middle" } }}
                  allowDataOverflow
                />
                <ReferenceLine x={data.medianX} stroke={MUTED} strokeDasharray="4 4" strokeOpacity={0.8} />
                <ReferenceLine y={data.medianY} stroke={MUTED} strokeDasharray="4 4" strokeOpacity={0.8} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: MUTED }}
                  isAnimationActive={false}
                  content={<Tip store={store} data={data} xDef={xDef} yDef={yDef} />}
                />
                <Scatter
                  data={shown.filter((d) => !d.hit)}
                  isAnimationActive={false}
                  shape={(p: { cx?: number; cy?: number; payload?: Datum }) => <Dot {...p} mode={highlighted ? "context" : "plain"} />}
                  onClick={(d: Datum) => navigate(`/company/${encodeURIComponent(d.symbol)}`)}
                />
                {highlighted && (
                  <Scatter
                    data={shown.filter((d) => d.hit)}
                    isAnimationActive={false}
                    shape={(p: { cx?: number; cy?: number; payload?: Datum }) => <Dot {...p} mode="plain" />}
                    onClick={(d: Datum) => navigate(`/company/${encodeURIComponent(d.symbol)}`)}
                  />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="pointer-events-none absolute inset-0 ml-14 mr-4 mt-2.5 mb-[58px] text-[11px] leading-tight text-muted-foreground" aria-hidden="true">
          <span className="absolute right-1 top-0 max-w-[42%] text-right">Higher return, higher yield</span>
          <span className="absolute left-1 top-0 max-w-[42%]">Lower return, higher yield</span>
          <span className="absolute bottom-1 right-1 max-w-[42%] text-right">Higher return, lower yield</span>
          <span className="absolute bottom-1 left-1 max-w-[42%]">Lower return, lower yield</span>
        </div>
      </div>
      <TableDisclosure summary={`View as table (${formatNumberIN(table.length, 0)} companies, highest ROCE first)`}>
        <table className="w-full text-xs">
          <caption className="sr-only">Companies on the chart with their {data.xLabel} and earnings yield</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th scope="col" className="data-header text-left">Company</th>
              <th scope="col" className="data-header text-left">Sector</th>
              <th scope="col" className="data-header text-right">{data.xLabel}</th>
              <th scope="col" className="data-header text-right">Earnings yield</th>
              {run && <th scope="col" className="data-header text-center">In screen</th>}
            </tr>
          </thead>
          <tbody>
            {table.slice(0, TABLE_ROWS).map((p) => (
              <tr key={p.i} className="border-b border-border/20 last:border-0">
                <th scope="row" className="data-cell text-left font-sans font-medium">
                  <Link to={`/company/${encodeURIComponent(store.symbols[p.i])}`} className="text-primary hover:underline">
                    <CompanyName name={store.company(p.i).name} isSynthetic={store.meta.isSynthetic} />
                  </Link>
                </th>
                <td className="data-cell text-left font-sans text-muted-foreground">{store.sector(p.i)}</td>
                <td className="data-cell text-right">{formatMetric(xDef, { v: p.x, reason: null, flags: 0 })}</td>
                <td className="data-cell text-right">{formatMetric(yDef, { v: p.y, reason: null, flags: 0 })}</td>
                {run && <td className="data-cell text-center">{run.matched.has(p.i) ? "Yes" : "No"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {table.length > TABLE_ROWS && <p className="p-3 text-xs text-muted-foreground">Showing the first {TABLE_ROWS} of {formatNumberIN(table.length, 0)}. The Screener lists every company.</p>}
      </TableDisclosure>
    </ChartCard>
  );
}

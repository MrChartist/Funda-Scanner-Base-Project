import { useMemo, useState } from "react";
import type { MetricStore } from "@/lib/contracts";
import { formatNumberIN } from "@/lib/format/indian";
import { EmptyState } from "@/components/common/EmptyState";
import { buildHistogram, MIN_PLOTTED, type HistBin } from "./chart-data";
import { ChartCard, TableDisclosure, useElementWidth } from "./ChartCard";

const H = 270;
const M = { l: 38, r: 12, t: 34, b: 32 };
const pct = (v: number, d = 0) => `${formatNumberIN(v, d)}%`;

function binLabel(b: HistBin): string {
  if (b.open === "low") return `below ${pct(b.hi)}`;
  if (b.open === "high") return `${pct(b.lo)} and above`;
  return `${pct(b.lo)} to ${pct(b.hi)}`;
}

export function RoceHistogram({ store }: { store: MetricStore }) {
  const data = useMemo(() => buildHistogram(store), [store]);
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);

  if (!data) {
    return (
      <ChartCard title="How returns are spread" skeletonHeight={200}>
        <EmptyState
          title="This chart needs annual statements"
          description={`It groups non-financial companies by return on capital (ROCE), so it needs ROCE for at least ${MIN_PLOTTED} of them. Import annual statements to see it.`}
        />
      </ChartCard>
    );
  }

  const w = Math.max(280, width);
  const iw = w - M.l - M.r;
  const ih = H - M.t - M.b;
  const maxC = Math.max(...data.bins.map((b) => b.count), 1);
  const yMax = Math.ceil(maxC / 5) * 5 || 5;
  const x = (v: number) => M.l + ((Math.min(Math.max(v, data.lo), data.hi) - data.lo) / (data.hi - data.lo)) * iw;
  const bw = iw / data.bins.length;
  const ticks = Array.from({ length: 5 }, (_, k) => data.lo + ((data.hi - data.lo) * k) / 4);
  const small = w < 420;
  const aria = `Histogram of ${data.label} for ${data.n} non-financial companies. Quartiles: ${pct(data.q1, 1)}, median ${pct(data.median, 1)}, ${pct(data.q3, 1)}. A table of the groups follows the chart.`;
  const hovered = hover !== null ? data.bins[hover] : null;

  return (
    <ChartCard
      title="How returns are spread"
      skeletonHeight={H}
      takeaway={
        <>
          Median {data.label.replace(/ \(.*\)/, "")} is <strong className="num">{pct(data.median, 1)}</strong>;{" "}
          <strong className="num">{formatNumberIN(data.above25, 0)}</strong> of <strong className="num">{formatNumberIN(data.n, 0)}</strong> companies are above 25%
          {data.negative > 0 && <>, and <strong className="num">{formatNumberIN(data.negative, 0)}</strong> are negative</>}.
        </>
      }
      footnote={
        <>
          <p>
            Each bar counts non-financial companies whose {data.label} falls in that range. The shaded band is the middle half (first to third quartile); the line is the median. The
            first and last bars also hold values below {pct(data.lo)} and above {pct(data.hi)}.
          </p>
          <p data-testid="histogram-coverage">
            {formatNumberIN(data.n, 0)} of {formatNumberIN(data.nonFinancial, 0)} non-financial companies counted
            {data.missing > 0 ? `; ${formatNumberIN(data.missing, 0)} lack ${data.label} (too little history or not enough data).` : "."} Lenders and insurers are not included.
          </p>
        </>
      }
    >
      <div ref={ref} className="relative w-full" role="img" aria-label={aria}>
        <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} className="block max-w-full overflow-visible" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => {
            const y = M.t + ih - f * ih;
            return (
              <g key={f}>
                <line x1={M.l} x2={w - M.r} y1={y} y2={y} stroke="hsl(var(--border))" strokeOpacity={0.7} />
                <text x={M.l - 6} y={y + 4} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))" className="num">{Math.round(f * yMax)}</text>
              </g>
            );
          })}
          <rect x={x(data.q1)} y={M.t} width={Math.max(1, x(data.q3) - x(data.q1))} height={ih} fill="hsl(var(--primary))" fillOpacity={0.08} />
          {data.bins.map((b, k) => {
            const h = (b.count / yMax) * ih;
            return (
              <rect
                key={k}
                x={M.l + k * bw + 1}
                y={M.t + ih - h}
                width={Math.max(1, bw - 2)}
                height={h}
                rx={Math.min(3, bw / 3)}
                fill="hsl(var(--primary))"
                fillOpacity={hover === null || hover === k ? 0.95 : 0.55}
                onMouseEnter={() => setHover(k)}
              >
                <title>{`${binLabel(b)}: ${b.count} companies`}</title>
              </rect>
            );
          })}
          <line x1={M.l} x2={w - M.r} y1={M.t + ih} y2={M.t + ih} stroke="hsl(var(--border))" />
          {[data.q1, data.q3].map((q, k) => (
            <line key={k} x1={x(q)} x2={x(q)} y1={M.t} y2={M.t + ih} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          ))}
          <line x1={x(data.median)} x2={x(data.median)} y1={M.t - 6} y2={M.t + ih} stroke="hsl(var(--foreground))" strokeWidth={2} />
          <text x={x(data.median)} y={M.t - 12} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="hsl(var(--foreground))" className="num">Median {pct(data.median, 1)}</text>
          <text x={x(data.q1) - 4} y={M.t + 11} textAnchor="end" fontSize={10.5} fill="hsl(var(--muted-foreground))">Q1</text>
          <text x={x(data.q3) + 4} y={M.t + 11} textAnchor="start" fontSize={10.5} fill="hsl(var(--muted-foreground))">Q3</text>
          {ticks.map((t, k) => (
            <text key={k} x={x(t)} y={H - 14} textAnchor={k === 0 ? "start" : k === ticks.length - 1 ? "end" : "middle"} fontSize={11} fill="hsl(var(--muted-foreground))" className="num">
              {pct(t)}
            </text>
          ))}
          {!small && <text x={M.l + iw / 2} y={H - 1} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">{data.label}</text>}
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg"
            style={{ left: Math.min(Math.max(M.l + (hover as number) * bw, 0), w - 150), top: 0 }}
          >
            <span className="num font-semibold">{hovered.count}</span> companies, {binLabel(hovered)}
          </div>
        )}
      </div>
      <TableDisclosure summary={`View as table (${data.bins.length} ranges)`}>
        <table className="w-full text-xs">
          <caption className="sr-only">Number of non-financial companies by {data.label} range</caption>
          <thead>
            <tr className="border-b border-border/60">
              <th scope="col" className="data-header text-left">{data.label}</th>
              <th scope="col" className="data-header text-right">Companies</th>
            </tr>
          </thead>
          <tbody>
            {data.bins.map((b, k) => (
              <tr key={k} className="border-b border-border/20 last:border-0">
                <th scope="row" className="data-cell text-left font-sans font-medium">{binLabel(b)}</th>
                <td className="data-cell text-right">{formatNumberIN(b.count, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableDisclosure>
    </ChartCard>
  );
}

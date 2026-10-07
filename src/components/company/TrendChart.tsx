import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendSeries {
  key: string;
  label: string;
  values: (number | null)[];
}

export interface TrendChartProps {
  /** Describes the chart for screen readers. A table with the same figures is always on the page. */
  ariaLabel: string;
  periods: readonly string[];
  series: readonly TrendSeries[];
  /** Turns a number into display text. Callers pass a formatter built on formatMetric / formatUnitValue. */
  format: (n: number) => string;
  kind?: "bar" | "line";
  height?: number;
}

const COLOURS = ["hsl(var(--primary))", "hsl(var(--chart-amber))", "hsl(var(--chart-green))", "hsl(var(--chart-cyan))"];

/** A small trend chart. It is decoration over a table, so it is hidden from assistive technology. */
export function TrendChart({ ariaLabel, periods, series, format, kind = "bar", height = 220 }: TrendChartProps) {
  // Charts need ResizeObserver; where it is missing the adjacent table carries the information.
  if (typeof ResizeObserver === "undefined") return null;
  const data = periods.map((p, k) => {
    const row: Record<string, string | number | undefined> = { period: p };
    for (const s of series) row[s.key] = s.values[k] ?? undefined;
    return row;
  });
  const tick = { fontSize: 12, fill: "hsl(var(--muted-foreground))" };
  const tooltip = (value: unknown) => (typeof value === "number" ? format(value) : "Not provided");
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey="period" tick={tick} />
      <YAxis tick={tick} tickFormatter={(v: number) => format(v)} width={72} />
      <Tooltip formatter={tooltip} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );
  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {kind === "bar" ? (
          <BarChart data={data}>
            {common}
            {series.map((s, k) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLOURS[k % COLOURS.length]} radius={[2, 2, 0, 0]} />)}
          </BarChart>
        ) : (
          <LineChart data={data}>
            {common}
            {series.map((s, k) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={COLOURS[k % COLOURS.length]} strokeWidth={2} dot={false} connectNulls={false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

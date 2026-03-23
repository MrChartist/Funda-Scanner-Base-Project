import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RatioRow {
  year: number; roce: number; roe: number; ebitda_margin: number; npm: number;
  debt_equity: number; interest_coverage: number; sales_growth: number; profit_growth: number;
}

const METRICS = [
  { key: "roce", label: "ROCE %", good: 15, bad: 10, invert: false, color: "hsl(var(--primary))" },
  { key: "roe", label: "ROE %", good: 15, bad: 10, invert: false, color: "hsl(var(--chart-green))" },
  { key: "ebitda_margin", label: "EBITDA %", good: 20, bad: 10, invert: false, color: "hsl(var(--chart-amber))" },
  { key: "npm", label: "NPM %", good: 12, bad: 5, invert: false, color: "hsl(var(--chart-cyan))" },
  { key: "debt_equity", label: "D/E", good: 0.5, bad: 1, invert: true, color: "hsl(var(--chart-red))" },
  { key: "interest_coverage", label: "Int. Cover", good: 5, bad: 2, invert: false, color: "hsl(220, 55%, 55%)" },
  { key: "sales_growth", label: "Sales Gr %", good: 10, bad: 0, invert: false, color: "hsl(280, 60%, 55%)" },
  { key: "profit_growth", label: "Profit Gr %", good: 10, bad: 0, invert: false, color: "hsl(340, 70%, 55%)" },
];

// Mock industry medians
const INDUSTRY_MEDIANS: Record<string, number> = {
  roce: 14.5, roe: 13.2, ebitda_margin: 18.5, npm: 10.8,
  debt_equity: 0.6, interest_coverage: 5.5, sales_growth: 8.2, profit_growth: 9.1,
};

// Mock peer percentiles
function getPeerPercentile(key: string, value: number): number {
  const median = INDUSTRY_MEDIANS[key] || 10;
  const pct = Math.min(99, Math.max(1, 50 + ((value - median) / median) * 40));
  return Math.round(pct);
}

function colorClass(val: number, good: number, bad: number, invert: boolean) {
  if (invert) return val <= good ? "text-positive" : val >= bad ? "text-negative" : "text-foreground";
  return val >= good ? "text-positive" : val <= bad ? "text-negative" : "text-foreground";
}

function PercentileBar({ percentile }: { percentile: number }) {
  const color = percentile >= 70 ? "bg-chart-green" : percentile >= 40 ? "bg-chart-amber" : "bg-chart-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 bg-border rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentile}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground">P{percentile}</span>
    </div>
  );
}

export function RatioTrendAnalysis({ rows }: { rows: RatioRow[] }) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["roce", "roe", "npm"]);
  const [view, setView] = useState<"chart" | "table">("chart");

  const latest = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const chartData = rows.map((r) => ({
    year: r.year,
    ...METRICS.reduce((acc, m) => ({ ...acc, [m.key]: (r as any)[m.key] }), {}),
  }));

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="section-title">
          <BarChart3 className="h-4 w-4 text-primary inline mr-2" />
          Ratio Trend Analysis (10Y)
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setView("chart")}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${view === "chart" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
            Chart
          </button>
          <button onClick={() => setView("table")}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${view === "table" ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
            Table
          </button>
        </div>
      </div>

      {/* Metric selector chips */}
      <div className="flex flex-wrap gap-1.5">
        {METRICS.map((m) => {
          const active = selectedMetrics.includes(m.key);
          return (
            <button key={m.key} onClick={() => toggleMetric(m.key)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${active ? "border-primary/50 bg-primary/10 text-primary font-medium" : "border-border/50 text-muted-foreground hover:border-border"}`}>
              <span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5" style={{ background: m.color }} />
              {m.label}
            </button>
          );
        })}
      </div>

      {view === "chart" ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
                <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2}
                  dot={{ r: 3 }} name={m.label} />
              ))}
              {/* Industry median reference lines */}
              {METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
                INDUSTRY_MEDIANS[m.key] !== undefined && (
                  <ReferenceLine key={`med-${m.key}`} y={INDUSTRY_MEDIANS[m.key]}
                    stroke={m.color} strokeDasharray="4 4" strokeOpacity={0.4} />
                )
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Table view with conditional formatting */
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="data-header">Year</th>
                {METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => (
                  <th key={m.key} className="data-header">{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-accent/20">
                  <td className="data-cell font-semibold text-foreground">{r.year}</td>
                  {METRICS.filter((m) => selectedMetrics.includes(m.key)).map((m) => {
                    const val = (r as any)[m.key];
                    return (
                      <td key={m.key} className={`data-cell font-mono ${colorClass(val, m.good, m.bad, m.invert)}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Peer Percentile Rankings */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Peer Percentile Rankings (vs Industry)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {METRICS.slice(0, 8).map((m) => {
            const val = latest ? (latest as any)[m.key] : 0;
            const prevVal = prev ? (prev as any)[m.key] : val;
            const pct = getPeerPercentile(m.key, val);
            const delta = val - prevVal;
            const isUp = m.invert ? delta < 0 : delta > 0;
            return (
              <motion.div key={m.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: METRICS.indexOf(m) * 0.03 }}
                className="rounded-lg border border-border/30 bg-muted/10 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">{m.label}</span>
                  {delta !== 0 && (
                    <span className={`text-[9px] font-mono ${isUp ? "text-positive" : "text-negative"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="text-lg font-mono font-bold text-foreground mb-1.5">{val}</div>
                <PercentileBar percentile={pct} />
                <div className="text-[9px] text-muted-foreground mt-1">
                  Ind. median: <span className="font-mono">{INDUSTRY_MEDIANS[m.key]}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

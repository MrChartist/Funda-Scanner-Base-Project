import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RatioRow {
  year: number; roce: number; roe: number; ebitda_margin: number; npm: number;
  debt_equity: number; interest_coverage: number; sales_growth: number; profit_growth: number;
}

function MicroTrend({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-4 w-12 inline-block align-middle ml-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function colorClass(val: number, goodThreshold: number, badThreshold: number, invert = false) {
  if (invert) {
    if (val <= goodThreshold) return "text-positive";
    if (val >= badThreshold) return "text-negative";
  } else {
    if (val >= goodThreshold) return "text-positive";
    if (val <= badThreshold) return "text-negative";
  }
  return "text-foreground";
}

function bgClass(val: number, goodThreshold: number, badThreshold: number, invert = false) {
  if (invert) {
    if (val <= goodThreshold) return "bg-chart-green/8";
    if (val >= badThreshold) return "bg-chart-red/8";
  } else {
    if (val >= goodThreshold) return "bg-chart-green/8";
    if (val <= badThreshold) return "bg-chart-red/8";
  }
  return "";
}

export function RatiosTable({ rows }: { rows: RatioRow[] }) {
  const cols = [
    { key: "year", label: "Year", good: 0, bad: 0, invert: false },
    { key: "roce", label: "ROCE %", good: 15, bad: 10, invert: false },
    { key: "roe", label: "ROE %", good: 15, bad: 10, invert: false },
    { key: "ebitda_margin", label: "EBITDA %", good: 20, bad: 10, invert: false },
    { key: "npm", label: "NPM %", good: 12, bad: 5, invert: false },
    { key: "debt_equity", label: "D/E", good: 0.5, bad: 1, invert: true },
    { key: "interest_coverage", label: "Int. Cover", good: 5, bad: 2, invert: false },
    { key: "sales_growth", label: "Sales Gr %", good: 10, bad: 0, invert: false },
    { key: "profit_growth", label: "Profit Gr %", good: 10, bad: 0, invert: false },
  ];

  // Compute trends for header
  const trendData: Record<string, number[]> = {};
  cols.forEach((c) => {
    if (c.key !== "year") {
      trendData[c.key] = rows.map((r) => (r as any)[c.key]);
    }
  });

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">Ratio Trends (10 Year)</h2>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              {cols.map((c) => {
                const trend = trendData[c.key];
                const trendColor = trend
                  ? trend[trend.length - 1] > trend[0] ? (c.invert ? "hsl(0,72%,51%)" : "hsl(152,69%,40%)") : (c.invert ? "hsl(152,69%,40%)" : "hsl(0,72%,51%)")
                  : "hsl(220,10%,46%)";
                return (
                  <th key={c.key} className="data-header">
                    <span className="flex items-center gap-0.5">
                      {c.label}
                      {trend && <MicroTrend data={trend} color={trendColor} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <motion.tr
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-border/20 last:border-0 hover:bg-accent/20 transition-colors"
              >
                {cols.map((c) => {
                  const val = (r as any)[c.key];
                  const isYear = c.key === "year";
                  return (
                    <td
                      key={c.key}
                      className={`data-cell ${isYear ? "font-semibold text-foreground" : `${colorClass(val, c.good, c.bad, c.invert)} ${bgClass(val, c.good, c.bad, c.invert)}`}`}
                    >
                      {val}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

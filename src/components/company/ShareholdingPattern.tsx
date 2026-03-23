import { useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ShareholdingData {
  quarter: string; promoter_pct: number; fii_pct: number; dii_pct: number; public_pct: number;
}

const CATEGORIES = [
  { key: "promoter_pct", name: "Promoters", color: "hsl(var(--primary))" },
  { key: "fii_pct", name: "FII", color: "hsl(var(--chart-green))" },
  { key: "dii_pct", name: "DII", color: "hsl(var(--chart-amber))" },
  { key: "public_pct", name: "Public", color: "hsl(var(--chart-cyan))" },
];

type ViewMode = "quarterly" | "yearly";

function CustomPieLabel({ cx, cy, midAngle, outerRadius, value }: any) {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (value < 8) return null;
  return (
    <text x={x} y={y} fill="hsl(var(--foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[11px] font-semibold">
      {value}%
    </text>
  );
}

function ChangeIndicator({ current, previous, label, color }: { current: number; previous: number; label: string; color: string }) {
  const change = +(current - previous).toFixed(2);
  const isUp = change > 0;
  const isFlat = change === 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
    >
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 rounded-sm" style={{ background: color }} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-bold text-foreground">{current}%</span>
        <div className={`flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
          isFlat ? "text-muted-foreground bg-muted/30" : isUp ? "text-positive bg-chart-green/10" : "text-negative bg-chart-red/10"
        }`}>
          {isFlat ? <Minus className="h-2.5 w-2.5" /> : isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          {isFlat ? "0.00" : `${isUp ? "+" : ""}${change.toFixed(2)}`}%
        </div>
      </div>
    </motion.div>
  );
}

export function ShareholdingPattern({ data }: { data: ShareholdingData[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("quarterly");
  const latest = data[0];
  const previous = data[1] || data[0];
  const oldest = data[data.length - 1];

  const pieData = CATEGORIES.map((c) => ({
    name: c.name,
    value: (latest as any)[c.key],
    color: c.color,
  }));

  // For yearly view, pick Q4 entries or deduplicate by FY
  const yearlyData = data.filter((d) => d.quarter.startsWith("Q4"));
  const displayData = viewMode === "quarterly" ? [...data].reverse() : [...yearlyData].reverse();

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="section-title">Shareholding Pattern</h2>
        {/* View toggle */}
        <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
          {(["quarterly", "yearly"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-md transition-all ${
                viewMode === mode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Donut + Change indicators */}
        <div>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {CATEGORIES.map((c, i) => (
                    <linearGradient key={i} id={`pie-${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={1} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0.7} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}
                  dataKey="value" label={CustomPieLabel} labelLine={false} stroke="hsl(var(--card))" strokeWidth={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={`url(#pie-${i})`} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                  formatter={(v: any) => `${v}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground block">{latest.quarter}</span>
              </div>
            </div>
          </div>

          {/* Change indicators: what's increasing/decreasing */}
          <div className="space-y-2 mt-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Changes vs {viewMode === "quarterly" ? "Previous Quarter" : "Previous Year"}
            </p>
            {CATEGORIES.map((c, i) => (
              <ChangeIndicator
                key={c.key}
                current={(latest as any)[c.key]}
                previous={(previous as any)[c.key]}
                label={c.name}
                color={c.color}
              />
            ))}
          </div>
        </div>

        {/* Right: Bar chart + Area trend */}
        <div className="space-y-6">
          {/* Stacked bar chart */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {viewMode === "quarterly" ? "Quarterly" : "Yearly"} Breakdown
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                    formatter={(v: any) => `${v}%`} />
                  {CATEGORIES.map((c) => (
                    <Bar key={c.key} dataKey={c.key} stackId="1" fill={c.color} name={c.name} radius={c.key === "public_pct" ? [2, 2, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Area trend */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trend Over Time</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    {CATEGORIES.map((c, i) => (
                      <linearGradient key={i} id={`area-sh-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.color} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={c.color} stopOpacity={0.05} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="quarter" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 11 }}
                    formatter={(v: any) => `${v}%`} />
                  {CATEGORIES.map((c, i) => (
                    <Area key={c.key} type="monotone" dataKey={c.key} stroke={c.color} fill={`url(#area-sh-${i})`}
                      strokeWidth={1.5} name={c.name} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall change summary */}
          <div className="flex gap-3 text-[10px] flex-wrap">
            {CATEGORIES.map((c) => {
              const change = ((latest as any)[c.key] - (oldest as any)[c.key]).toFixed(1);
              const isUp = Number(change) >= 0;
              return (
                <div key={c.key} className="flex items-center gap-1 bg-muted/20 rounded-md px-2 py-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className={`font-mono font-semibold ${isUp ? "text-positive" : "text-negative"}`}>
                    {isUp ? "+" : ""}{change}%
                  </span>
                  <span className="text-muted-foreground/60">overall</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

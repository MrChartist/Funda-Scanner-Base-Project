import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { motion } from "framer-motion";
import { Users } from "lucide-react";

interface ShareholdingData {
  quarter: string; promoter_pct: number; fii_pct: number; dii_pct: number; public_pct: number;
}

const CATEGORIES = [
  { key: "promoter_pct", name: "Promoters", color: "hsl(var(--primary))" },
  { key: "fii_pct", name: "FII", color: "hsl(var(--chart-green))" },
  { key: "dii_pct", name: "DII", color: "hsl(var(--chart-amber))" },
  { key: "public_pct", name: "Public", color: "hsl(var(--chart-cyan))" },
];

function CustomPieLabel({ cx, cy, midAngle, innerRadius, outerRadius, value, name }: any) {
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

export function ShareholdingPattern({ data }: { data: ShareholdingData[] }) {
  const latest = data[0];
  const pieData = CATEGORIES.map((c) => ({
    name: c.name,
    value: (latest as any)[c.key],
    color: c.color,
  }));
  const trendData = [...data].reverse();

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-5">Shareholding Pattern</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Donut */}
        <div>
          <div className="h-64 relative">
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
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={CustomPieLabel}
                  labelLine={false}
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={`url(#pie-${i})`} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                  formatter={(v: any) => `${v}%`}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground block">{latest.quarter}</span>
              </div>
            </div>
          </div>

          {/* Legend cards */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
              >
                <div className="h-3 w-3 rounded-sm" style={{ background: CATEGORIES[i].color }} />
                <div className="flex-1">
                  <span className="text-[11px] text-muted-foreground block leading-tight">{d.name}</span>
                  <span className="text-sm font-mono font-bold text-foreground">{d.value}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trend Chart */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quarterly Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <defs>
                  {CATEGORIES.map((c, i) => (
                    <linearGradient key={i} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.color} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={c.color} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                  formatter={(v: any) => `${v}%`}
                />
                {CATEGORIES.map((c, i) => (
                  <Area
                    key={c.key}
                    type="monotone"
                    dataKey={c.key}
                    stackId="1"
                    stroke={c.color}
                    fill={`url(#area-${i})`}
                    strokeWidth={1.5}
                    name={c.name}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Change indicator */}
          <div className="mt-3 flex gap-4 text-xs">
            {CATEGORIES.map((c) => {
              const change = ((latest as any)[c.key] - (data[data.length - 1] as any)[c.key]).toFixed(1);
              const isUp = Number(change) >= 0;
              return (
                <div key={c.key} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className={`font-mono font-semibold ${isUp ? "text-positive" : "text-negative"}`}>
                    {isUp ? "+" : ""}{change}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

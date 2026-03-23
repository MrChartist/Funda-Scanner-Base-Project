import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { motion } from "framer-motion";
import { Layers, Globe, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Segment {
  name: string; revenue: number; pct: number; growth: number; profit?: number; profitPct?: number;
}

interface GeoSegment {
  region: string; revenue: number; pct: number; growth: number;
}

const MOCK_SEGMENTS: Segment[] = [
  { name: "O2C (Oil to Chemicals)", revenue: 420000, pct: 42, growth: 8, profit: 28000, profitPct: 6.7 },
  { name: "Digital Services (Jio)", revenue: 250000, pct: 25, growth: 18, profit: 52000, profitPct: 20.8 },
  { name: "Retail", revenue: 180000, pct: 18, growth: 22, profit: 14400, profitPct: 8.0 },
  { name: "Oil & Gas E&P", revenue: 80000, pct: 8, growth: -3, profit: 12000, profitPct: 15.0 },
  { name: "Financial Services", revenue: 45000, pct: 4.5, growth: 35, profit: 6750, profitPct: 15.0 },
  { name: "Others", revenue: 25000, pct: 2.5, growth: 5, profit: 1250, profitPct: 5.0 },
];

const MOCK_GEO: GeoSegment[] = [
  { region: "India", revenue: 620000, pct: 62, growth: 14 },
  { region: "North America", revenue: 150000, pct: 15, growth: 8 },
  { region: "Europe", revenue: 100000, pct: 10, growth: 5 },
  { region: "Middle East & Africa", revenue: 80000, pct: 8, growth: 12 },
  { region: "Asia Pacific", revenue: 50000, pct: 5, growth: 20 },
];

const MOCK_YEARLY = [
  { year: "FY22", "O2C": 380000, "Jio": 185000, "Retail": 130000, "E&P": 75000, "FS": 28000 },
  { year: "FY23", "O2C": 395000, "Jio": 210000, "Retail": 148000, "E&P": 78000, "FS": 34000 },
  { year: "FY24", "O2C": 410000, "Jio": 235000, "Retail": 165000, "E&P": 82000, "FS": 40000 },
  { year: "FY25", "O2C": 420000, "Jio": 250000, "Retail": 180000, "E&P": 80000, "FS": 45000 },
];

const SEG_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-green))", "hsl(var(--chart-amber))",
  "hsl(var(--chart-cyan))", "hsl(220, 55%, 55%)", "hsl(var(--muted-foreground))",
];

const fmt = (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L Cr` : `₹${(v / 1000).toFixed(0)}K Cr`;

export function RevenueSegmentation() {
  const [tab, setTab] = useState<"business" | "geography" | "trend">("business");

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="section-title">
          <Layers className="h-4 w-4 text-primary inline mr-2" />
          Revenue Segmentation
        </h2>
        <div className="flex gap-1 rounded-lg border border-border/50 p-0.5">
          {(["business", "geography", "trend"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-1 text-[11px] rounded-md capitalize transition-colors ${tab === t ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
              {t === "business" ? "Business" : t === "geography" ? "Geography" : "Trend"}
            </button>
          ))}
        </div>
      </div>

      {tab === "business" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_SEGMENTS} cx="50%" cy="50%" outerRadius={85} innerRadius={45}
                  dataKey="pct" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                  {MOCK_SEGMENTS.map((_, i) => <Cell key={i} fill={SEG_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                  formatter={(v: any, name: any) => [`${v}%`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {MOCK_SEGMENTS.map((seg, i) => (
              <motion.div key={seg.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: SEG_COLORS[i] }} />
                  <div className="min-w-0">
                    <span className="text-xs text-foreground truncate block">{seg.name}</span>
                    {seg.profitPct !== undefined && (
                      <span className="text-[9px] text-muted-foreground">Margin: {seg.profitPct}%</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-mono font-semibold text-foreground">{seg.pct}%</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{fmt(seg.revenue)}</span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${seg.growth > 0 ? "text-positive border-chart-green/30" : "text-negative border-chart-red/30"}`}>
                    {seg.growth > 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                    {seg.growth > 0 ? "+" : ""}{seg.growth}%
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === "geography" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={MOCK_GEO} cx="50%" cy="50%" outerRadius={85} innerRadius={45}
                  dataKey="pct" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                  {MOCK_GEO.map((_, i) => <Cell key={i} fill={SEG_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {MOCK_GEO.map((geo, i) => (
              <motion.div key={geo.region} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: SEG_COLORS[i] }} />
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-foreground">{geo.region}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-semibold text-foreground">{geo.pct}%</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{fmt(geo.revenue)}</span>
                  <span className={`text-[10px] font-mono font-semibold ${geo.growth > 0 ? "text-positive" : "text-negative"}`}>
                    {geo.growth > 0 ? "+" : ""}{geo.growth}%
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === "trend" && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_YEARLY} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                formatter={(v: any) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="O2C" stackId="a" fill={SEG_COLORS[0]} />
              <Bar dataKey="Jio" stackId="a" fill={SEG_COLORS[1]} />
              <Bar dataKey="Retail" stackId="a" fill={SEG_COLORS[2]} />
              <Bar dataKey="E&P" stackId="a" fill={SEG_COLORS[3]} />
              <Bar dataKey="FS" stackId="a" fill={SEG_COLORS[4]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

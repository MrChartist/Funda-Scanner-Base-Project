import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";

interface Segment {
  name: string; revenue: number; pct: number; growth: number;
}

const MOCK_SEGMENTS: Segment[] = [
  { name: "O2C (Oil to Chemicals)", revenue: 420000, pct: 42, growth: 8 },
  { name: "Digital Services (Jio)", revenue: 250000, pct: 25, growth: 18 },
  { name: "Retail", revenue: 180000, pct: 18, growth: 22 },
  { name: "Oil & Gas E&P", revenue: 80000, pct: 8, growth: -3 },
  { name: "Financial Services", revenue: 45000, pct: 4.5, growth: 35 },
  { name: "Others", revenue: 25000, pct: 2.5, growth: 5 },
];

const SEG_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-green))", "hsl(var(--chart-amber))",
  "hsl(var(--chart-cyan))", "hsl(220, 55%, 55%)", "hsl(var(--muted-foreground))",
];

export function RevenueSegmentation() {
  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">
        <Layers className="h-4 w-4 text-primary inline mr-2" />
        Revenue Segmentation
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="h-56 relative">
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

        {/* Segment details */}
        <div className="space-y-2">
          {MOCK_SEGMENTS.map((seg, i) => (
            <motion.div key={seg.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: SEG_COLORS[i] }} />
                <span className="text-xs text-foreground truncate">{seg.name}</span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs font-mono font-semibold text-foreground">{seg.pct}%</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  ₹{seg.revenue >= 100000 ? `${(seg.revenue / 100000).toFixed(0)}L` : `${(seg.revenue / 1000).toFixed(0)}K`} Cr
                </span>
                <span className={`text-[10px] font-mono font-semibold ${seg.growth > 0 ? "text-positive" : "text-negative"}`}>
                  {seg.growth > 0 ? "+" : ""}{seg.growth}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

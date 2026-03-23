import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Building2, Users } from "lucide-react";

interface MFHolding {
  name: string; pct: number; change: number;
}

const MOCK_MF_HOLDINGS: MFHolding[] = [
  { name: "SBI Mutual Fund", pct: 4.2, change: 0.3 },
  { name: "HDFC Mutual Fund", pct: 3.8, change: -0.1 },
  { name: "ICICI Prudential MF", pct: 3.1, change: 0.2 },
  { name: "Axis Mutual Fund", pct: 2.7, change: 0.5 },
  { name: "Kotak Mutual Fund", pct: 2.4, change: -0.2 },
  { name: "Nippon India MF", pct: 1.9, change: 0.1 },
  { name: "UTI Mutual Fund", pct: 1.6, change: 0.0 },
  { name: "Others", pct: 3.4, change: -0.3 },
];

const MF_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-green))", "hsl(var(--chart-amber))", "hsl(var(--chart-cyan))",
  "hsl(220, 60%, 55%)", "hsl(280, 50%, 55%)", "hsl(340, 50%, 55%)", "hsl(var(--muted-foreground))",
];

export function MutualFundHoldings() {
  const total = MOCK_MF_HOLDINGS.reduce((s, h) => s + h.pct, 0);

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">
        <Building2 className="h-4 w-4 text-primary inline mr-2" />
        Mutual Fund Holdings
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-56 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={MOCK_MF_HOLDINGS} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                dataKey="pct" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                {MOCK_MF_HOLDINGS.map((_, i) => <Cell key={i} fill={MF_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                formatter={(v: any) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <span className="text-lg font-mono font-bold text-foreground">{total.toFixed(1)}%</span>
              <span className="text-[10px] text-muted-foreground block">Total MF</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          {MOCK_MF_HOLDINGS.map((h, i) => (
            <motion.div key={h.name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-1.5">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-sm" style={{ background: MF_COLORS[i] }} />
                <span className="text-xs text-foreground">{h.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-foreground">{h.pct}%</span>
                <span className={`text-[10px] font-mono ${h.change > 0 ? "text-positive" : h.change < 0 ? "text-negative" : "text-muted-foreground"}`}>
                  {h.change > 0 ? "+" : ""}{h.change.toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

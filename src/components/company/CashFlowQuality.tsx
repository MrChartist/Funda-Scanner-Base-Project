import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Banknote, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  ArrowRightLeft, Layers, BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, BarChart, Bar, Line, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────
interface FinRow {
  year: number; revenue: number; ebitda: number; depreciation: number;
  interest: number; pbt: number; tax: number; net_profit: number;
  total_assets: number; total_liabilities: number; equity: number;
  reserves: number; debt: number; ocf: number; icf: number;
}

interface Props {
  statementRows: FinRow[];
  marketCap: number;
  price: number;
}

// ─── Derived Data ────────────────────────────────────────────────
interface CFQuality {
  year: number;
  ocf: number;
  netProfit: number;
  accrualRatio: number;      // (NI - OCF) / Total Assets — lower is better
  fcf: number;               // OCF + ICF (ICF is negative)
  capex: number;             // abs(ICF)
  depreciation: number;
  capexToDepr: number;       // Capex / Depreciation
  fcfYield: number;          // FCF / Market Cap (approx using latest mcap)
  ocfToNI: number;           // OCF / Net Income — >1 is good
  workingCapital: number;    // Current Assets - Current Liabilities (approx)
  wcChange: number;          // YoY change
  fcfMargin: number;         // FCF / Revenue %
  cashConversion: number;    // OCF / EBITDA %
}

function computeCFQuality(rows: FinRow[], marketCap: number): CFQuality[] {
  return rows.map((r, i) => {
    const capex = Math.abs(r.icf);
    const fcf = r.ocf + r.icf; // icf is negative
    const wc = (r.total_assets - r.debt) - r.total_liabilities;
    const prevWC = i > 0 ? ((rows[i - 1].total_assets - rows[i - 1].debt) - rows[i - 1].total_liabilities) : wc;

    return {
      year: r.year,
      ocf: r.ocf,
      netProfit: r.net_profit,
      accrualRatio: r.total_assets > 0 ? +((r.net_profit - r.ocf) / r.total_assets * 100).toFixed(1) : 0,
      fcf,
      capex,
      depreciation: r.depreciation,
      capexToDepr: r.depreciation > 0 ? +(capex / r.depreciation).toFixed(2) : 0,
      fcfYield: marketCap > 0 ? +(fcf / marketCap * 100).toFixed(2) : 0,
      ocfToNI: r.net_profit > 0 ? +(r.ocf / r.net_profit).toFixed(2) : 0,
      workingCapital: wc,
      wcChange: wc - prevWC,
      fcfMargin: r.revenue > 0 ? +(fcf / r.revenue * 100).toFixed(1) : 0,
      cashConversion: r.ebitda > 0 ? +(r.ocf / r.ebitda * 100).toFixed(1) : 0,
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────
const fmt = (v: number) => {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toFixed(0)}`;
};

function QualityFlag({ label, value, good, unit, invert }: {
  label: string; value: number; good: number; unit: string; invert?: boolean;
}) {
  const isGood = invert ? value < good : value > good;
  return (
    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      className="p-2 rounded bg-muted/20 border border-border/30 text-center">
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-mono font-bold ${isGood ? "text-positive" : "text-negative"}`}>
        {value}{unit}
      </p>
      <div className="flex items-center justify-center gap-0.5 mt-0.5">
        {isGood ? <CheckCircle2 className="h-2.5 w-2.5 text-positive" /> : <AlertTriangle className="h-2.5 w-2.5 text-negative" />}
        <span className="text-[7px] text-muted-foreground">{isGood ? "Healthy" : "Watch"}</span>
      </div>
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-2.5 shadow-xl !bg-card text-[10px] min-w-[140px]">
      <p className="font-medium text-foreground mb-1.5 border-b border-border/50 pb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-3 py-0.5">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </span>
          <span className="font-mono font-medium text-foreground">
            {typeof p.value === "number" ? (Math.abs(p.value) >= 1000 ? fmt(p.value) : `${p.value}`) : p.value}
            {p.name.includes("%") || p.name.includes("Ratio") || p.name.includes("Yield") ? "%" : p.name.includes("x") ? "x" : " Cr"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export function CashFlowQuality({ statementRows, marketCap, price }: Props) {
  const data = useMemo(() => computeCFQuality(statementRows, marketCap), [statementRows, marketCap]);
  const latest = data[data.length - 1];
  const prev = data.length > 1 ? data[data.length - 2] : latest;

  if (!latest) return null;

  const chartData = data.map((d) => ({
    year: d.year.toString(),
    OCF: d.ocf,
    "Net Profit": d.netProfit,
    FCF: d.fcf,
    Capex: d.capex,
    Depreciation: d.depreciation,
    "FCF Yield %": d.fcfYield,
    "Capex/Depr": d.capexToDepr,
    "OCF/NI": d.ocfToNI,
    "Accrual %": d.accrualRatio,
    "WC": d.workingCapital,
    "WC Change": d.wcChange,
    "FCF Margin %": d.fcfMargin,
    "Cash Conv %": d.cashConversion,
  }));

  // Overall quality score
  const qualityChecks = [
    { pass: latest.ocfToNI >= 1, label: "OCF > Net Profit" },
    { pass: latest.accrualRatio < 5, label: "Low accruals" },
    { pass: latest.capexToDepr < 2, label: "Capex sustainable" },
    { pass: latest.fcfMargin > 5, label: "Positive FCF margin" },
    { pass: latest.cashConversion > 60, label: "Good cash conversion" },
    { pass: latest.fcf > 0, label: "Positive FCF" },
  ];
  const qualityScore = qualityChecks.filter((c) => c.pass).length;

  return (
    <div className="glass-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Banknote className="h-3.5 w-3.5 text-primary" />
          Cash Flow Quality
        </h2>
        <div className="flex items-center gap-2">
          <Badge className={`text-[10px] font-mono px-2 py-0.5 ${
            qualityScore >= 5 ? "bg-chart-green/15 text-positive border border-chart-green/30"
            : qualityScore >= 3 ? "bg-chart-amber/15 text-chart-amber border border-chart-amber/30"
            : "bg-chart-red/15 text-negative border border-chart-red/30"
          }`}>
            {qualityScore}/6 Quality
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-mono px-2 py-0.5 ${latest.ocfToNI >= 1 ? "text-positive" : "text-negative"}`}>
            OCF/NI: {latest.ocfToNI}x
          </Badge>
        </div>
      </div>

      {/* KPI Flags */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <QualityFlag label="OCF / Net Income" value={latest.ocfToNI} good={1} unit="x" />
        <QualityFlag label="Accrual Ratio" value={latest.accrualRatio} good={5} unit="%" invert />
        <QualityFlag label="Capex / Depr" value={latest.capexToDepr} good={2} unit="x" invert />
        <QualityFlag label="FCF Margin" value={latest.fcfMargin} good={5} unit="%" />
        <QualityFlag label="Cash Conversion" value={latest.cashConversion} good={60} unit="%" />
        <QualityFlag label="FCF Yield" value={latest.fcfYield} good={3} unit="%" />
      </div>

      <Tabs defaultValue="ocf-vs-ni">
        <TabsList className="h-7 mb-2">
          <TabsTrigger value="ocf-vs-ni" className="text-[10px] h-6 px-3 gap-1">
            <ArrowRightLeft className="h-3 w-3" /> OCF vs Profit
          </TabsTrigger>
          <TabsTrigger value="fcf" className="text-[10px] h-6 px-3 gap-1">
            <BarChart3 className="h-3 w-3" /> FCF & Yield
          </TabsTrigger>
          <TabsTrigger value="capex" className="text-[10px] h-6 px-3 gap-1">
            <Layers className="h-3 w-3" /> Capex vs Depreciation
          </TabsTrigger>
          <TabsTrigger value="wc" className="text-[10px] h-6 px-3 gap-1">
            <Banknote className="h-3 w-3" /> Working Capital
          </TabsTrigger>
        </TabsList>

        {/* ── OCF vs Net Profit ── */}
        <TabsContent value="ocf-vs-ni">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="ocfGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}x`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="OCF" fill="hsl(var(--chart-green))" opacity={0.6} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Net Profit" fill="hsl(var(--primary))" opacity={0.6} radius={[2, 2, 0, 0]} />
                <Line yAxisId="ratio" type="monotone" dataKey="OCF/NI" stroke="hsl(var(--chart-amber))" strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--chart-amber))" }} />
                <ReferenceLine yAxisId="ratio" y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                  label={{ value: "1.0x", fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "right" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>Reading:</strong> OCF/NI &gt; 1.0x indicates high earnings quality — the company converts reported profits into actual cash.
              Persistent OCF &lt; NI suggests aggressive accrual accounting or poor collections.
            </p>
          </div>
        </TabsContent>

        {/* ── FCF & Yield ── */}
        <TabsContent value="fcf">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="fcfGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="FCF" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={Number(entry.FCF) >= 0 ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} opacity={0.6} />
                  ))}
                </Bar>
                <Line yAxisId="pct" type="monotone" dataKey="FCF Yield %" stroke="hsl(var(--primary))" strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }} />
                <Line yAxisId="pct" type="monotone" dataKey="FCF Margin %" stroke="hsl(var(--chart-cyan))" strokeWidth={1.5}
                  strokeDasharray="4 2" dot={false} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>FCF Yield</strong> = Free Cash Flow / Market Cap. A yield &gt;5% often signals undervaluation.
              <strong> FCF Margin</strong> = FCF / Revenue — measures how much revenue converts to free cash.
            </p>
          </div>
        </TabsContent>

        {/* ── Capex vs Depreciation ── */}
        <TabsContent value="capex">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <YAxis yAxisId="ratio" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}x`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Capex" fill="hsl(var(--chart-red))" opacity={0.5} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Depreciation" fill="hsl(var(--chart-amber))" opacity={0.5} radius={[2, 2, 0, 0]} />
                <Line yAxisId="ratio" type="monotone" dataKey="Capex/Depr" stroke="hsl(var(--primary))" strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }} />
                <ReferenceLine yAxisId="ratio" y={1} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                  label={{ value: "1.0x", fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "right" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>Capex/Depreciation &gt; 1.5x</strong> = heavy investment phase (growth capex).
              <strong> ≈ 1.0x</strong> = maintenance capex only.
              <strong> &lt; 1.0x</strong> = under-investing — potential future asset deterioration.
            </p>
          </div>
        </TabsContent>

        {/* ── Working Capital ── */}
        <TabsContent value="wc">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="wcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-cyan))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--chart-cyan))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="WC" stroke="hsl(var(--chart-cyan))" fill="url(#wcGrad)" strokeWidth={2} />
                <Bar dataKey="WC Change" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={Number(entry["WC Change"]) >= 0 ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} opacity={0.5} />
                  ))}
                </Bar>
                <Line yAxisId="pct" type="monotone" dataKey="Cash Conv %" stroke="hsl(var(--chart-amber))" strokeWidth={1.5}
                  dot={{ r: 2.5, fill: "hsl(var(--chart-amber))" }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>Working Capital</strong> = (Assets - Debt) - Liabilities. Positive = company can cover short-term obligations.
              <strong> Cash Conversion</strong> = OCF / EBITDA — how much EBITDA turns into actual operating cash.
              &gt;60% is generally healthy.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quality Checklist */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
        {qualityChecks.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="flex items-center gap-1.5 text-[10px] py-1 px-2 rounded bg-muted/10">
            {c.pass ? <CheckCircle2 className="h-3 w-3 text-positive flex-shrink-0" /> : <AlertTriangle className="h-3 w-3 text-negative flex-shrink-0" />}
            <span className={c.pass ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

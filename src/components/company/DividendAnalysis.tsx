import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Coins, TrendingUp, TrendingDown, CalendarDays, Calculator,
  Award, BarChart3, Percent, CheckCircle2, XCircle, Info,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ─── Types & Mock Data ───────────────────────────────────────────
interface DividendYear {
  year: number;
  dps: number;          // Dividend per share (₹)
  eps: number;          // EPS
  payoutRatio: number;  // %
  yieldPct: number;     // Dividend yield %
  exDate: string;       // ISO date
  recordDate: string;
  paymentDate: string;
  type: "Interim" | "Final" | "Special";
  price: number;        // Share price at ex-date
}

interface Props {
  price: number;
  symbol: string;
}

function generateMockDividends(symbol: string, price: number): DividendYear[] {
  const seed = symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const rng = (i: number) => ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280;
  const baseDPS = 5 + rng(0) * 30;
  const rows: DividendYear[] = [];

  for (let i = 0; i < 10; i++) {
    const year = 2015 + i;
    const growth = 1 + (rng(i + 10) - 0.3) * 0.15;
    const dps = +(baseDPS * Math.pow(growth, i)).toFixed(1);
    const eps = +(dps / (0.2 + rng(i + 20) * 0.4)).toFixed(1);
    const priceAtEx = +(price * (0.6 + rng(i + 30) * 0.5)).toFixed(0);
    const yieldPct = +((dps / priceAtEx) * 100).toFixed(2);
    const payoutRatio = +((dps / eps) * 100).toFixed(1);
    const month = 6 + Math.floor(rng(i + 40) * 4); // Jun-Sep typically
    const day = 5 + Math.floor(rng(i + 50) * 20);

    rows.push({
      year,
      dps,
      eps,
      payoutRatio: Math.min(payoutRatio, 95),
      yieldPct,
      exDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      recordDate: `${year}-${String(month).padStart(2, "0")}-${String(Math.min(28, day + 2)).padStart(2, "0")}`,
      paymentDate: `${year}-${String(month).padStart(2, "0")}-${String(Math.min(28, day + 15)).padStart(2, "0")}`,
      type: rng(i + 60) > 0.85 ? "Special" : rng(i + 60) > 0.4 ? "Final" : "Interim",
      price: priceAtEx,
    });
  }
  return rows;
}

// ─── Calculations ────────────────────────────────────────────────
function computeCAGR(first: number, last: number, years: number): number {
  if (first <= 0 || years <= 0) return 0;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function computeConsistencyScore(dividends: DividendYear[]): { score: number; maxScore: number; details: { label: string; pass: boolean; desc: string }[] } {
  const years = dividends.length;
  const paidEveryYear = dividends.every((d) => d.dps > 0);
  const growingCount = dividends.filter((d, i) => i === 0 || d.dps >= dividends[i - 1].dps).length;
  const neverCut = dividends.every((d, i) => i === 0 || d.dps >= dividends[i - 1].dps * 0.9);
  const avgPayout = dividends.reduce((s, d) => s + d.payoutRatio, 0) / years;
  const sustainablePayout = avgPayout > 15 && avgPayout < 80;
  const avgYield = dividends.reduce((s, d) => s + d.yieldPct, 0) / years;
  const decentYield = avgYield > 1.0;

  const details = [
    { label: "Paid every year", pass: paidEveryYear, desc: `${years}/${years} years` },
    { label: "Never cut (10%+ decline)", pass: neverCut, desc: neverCut ? "No major cuts" : "Had dividend cuts" },
    { label: "Growing trend", pass: growingCount >= years * 0.7, desc: `${growingCount - 1}/${years - 1} years grew` },
    { label: "Sustainable payout", pass: sustainablePayout, desc: `Avg payout: ${avgPayout.toFixed(0)}%` },
    { label: "Meaningful yield", pass: decentYield, desc: `Avg yield: ${avgYield.toFixed(2)}%` },
  ];

  const score = details.filter((d) => d.pass).length;
  return { score, maxScore: 5, details };
}

// ─── DRIP Calculator ─────────────────────────────────────────────
function DRIPCalculator({ currentDPS, currentPrice, yieldPct }: { currentDPS: number; currentPrice: number; yieldPct: number }) {
  const [shares, setShares] = useState(100);
  const [years, setYears] = useState(10);
  const [divGrowth, setDivGrowth] = useState(8);
  const [priceGrowth, setPriceGrowth] = useState(10);

  const projection = useMemo(() => {
    const data: { year: number; shares: number; dividend: number; value: number; totalDiv: number }[] = [];
    let s = shares;
    let dps = currentDPS;
    let price = currentPrice;
    let totalDiv = 0;

    for (let y = 0; y <= years; y++) {
      const dividend = s * dps;
      totalDiv += y > 0 ? dividend : 0;
      data.push({
        year: y,
        shares: Math.round(s * 100) / 100,
        dividend: Math.round(dividend),
        value: Math.round(s * price),
        totalDiv: Math.round(totalDiv),
      });
      if (y < years) {
        // Reinvest dividends to buy more shares
        const newShares = dividend / price;
        s += newShares;
        dps *= 1 + divGrowth / 100;
        price *= 1 + priceGrowth / 100;
      }
    }
    return data;
  }, [shares, years, divGrowth, priceGrowth, currentDPS, currentPrice]);

  const finalData = projection[projection.length - 1];
  const initialValue = shares * currentPrice;
  const totalReturn = ((finalData.value - initialValue) / initialValue * 100);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <SliderInput label="Shares" value={shares} onChange={setShares} min={1} max={10000} step={10} unit="qty" />
        <SliderInput label="Years" value={years} onChange={setYears} min={1} max={30} step={1} unit="yr" />
        <SliderInput label="Div Growth" value={divGrowth} onChange={setDivGrowth} min={0} max={25} step={0.5} unit="%" />
        <SliderInput label="Price Growth" value={priceGrowth} onChange={setPriceGrowth} min={0} max={25} step={0.5} unit="%" />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Initial Investment", value: `₹${initialValue.toLocaleString()}`, color: "text-foreground" },
          { label: `Portfolio Value (Y${years})`, value: `₹${finalData.value.toLocaleString()}`, color: "text-positive" },
          { label: "Total Dividends", value: `₹${finalData.totalDiv.toLocaleString()}`, color: "text-primary" },
          { label: "Total Return", value: `${totalReturn.toFixed(0)}%`, color: totalReturn > 0 ? "text-positive" : "text-negative" },
        ].map((k) => (
          <div key={k.label} className="p-2 rounded bg-muted/20 border border-border/30 text-center">
            <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className={`text-sm font-mono font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* DRIP Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={projection} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="dripVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.2} />
                <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
              tickFormatter={(v) => `Y${v}`} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
              tickFormatter={(v) => v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }}
              formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString()}`, name]} />
            <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-green))" fill="url(#dripVal)" strokeWidth={2} name="Portfolio Value" />
            <Bar dataKey="dividend" fill="hsl(var(--primary))" opacity={0.5} radius={[2, 2, 0, 0]} name="Annual Dividend" />
            <Line type="monotone" dataKey="totalDiv" stroke="hsl(var(--chart-amber))" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Cum. Dividends" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
        <span>Shares grow from {shares} → {finalData.shares.toFixed(1)} via DRIP</span>
        <span>Yield on cost: {(finalData.dividend / initialValue * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-0.5">
          <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
            className="w-14 text-right text-[10px] font-mono bg-muted/30 border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            step={step} min={min} max={max} />
          <span className="text-[9px] text-muted-foreground w-4">{unit}</span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer accent-primary" />
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export function DividendAnalysis({ price, symbol }: Props) {
  const dividends = useMemo(() => generateMockDividends(symbol, price), [symbol, price]);
  const latest = dividends[dividends.length - 1];
  const first = dividends[0];

  const cagr = computeCAGR(first.dps, latest.dps, dividends.length - 1);
  const consistency = computeConsistencyScore(dividends);
  const avgYield = dividends.reduce((s, d) => s + d.yieldPct, 0) / dividends.length;
  const currentYield = (latest.dps / price * 100);
  const totalPaid = dividends.reduce((s, d) => s + d.dps, 0);

  // Ex-dates for calendar highlighting
  const exDates = dividends.map((d) => new Date(d.exDate));

  // Chart data
  const chartData = dividends.map((d) => ({
    year: d.year.toString(),
    dps: d.dps,
    eps: d.eps,
    payoutRatio: d.payoutRatio,
    yieldPct: d.yieldPct,
  }));

  return (
    <div className="glass-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-primary" />
          Dividend Analysis
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-primary">
            Yield: {currentYield.toFixed(2)}%
          </Badge>
          <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 text-positive">
            CAGR: {cagr.toFixed(1)}%
          </Badge>
          <Badge className={`text-[10px] font-mono px-2 py-0.5 ${
            consistency.score >= 4 ? "bg-chart-green/15 text-positive border border-chart-green/30"
            : consistency.score >= 3 ? "bg-chart-amber/15 text-chart-amber border border-chart-amber/30"
            : "bg-chart-red/15 text-negative border border-chart-red/30"
          }`}>
            <Award className="h-3 w-3 mr-1" />
            {consistency.score}/{consistency.maxScore} Consistency
          </Badge>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: "Current DPS", value: `₹${latest.dps}`, sub: `FY${latest.year}` },
          { label: "Div Yield", value: `${currentYield.toFixed(2)}%`, sub: `Avg: ${avgYield.toFixed(2)}%` },
          { label: "Payout Ratio", value: `${latest.payoutRatio.toFixed(0)}%`, sub: `EPS: ₹${latest.eps}` },
          { label: "10Y CAGR", value: `${cagr.toFixed(1)}%`, sub: `₹${first.dps} → ₹${latest.dps}` },
          { label: "Total Paid (10Y)", value: `₹${totalPaid.toFixed(0)}`, sub: `Per share` },
        ].map((k) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="p-2 rounded bg-muted/20 border border-border/30 text-center">
            <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{k.label}</p>
            <p className="text-sm font-mono font-bold text-foreground">{k.value}</p>
            <p className="text-[8px] text-muted-foreground">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="history">
        <TabsList className="h-7 mb-2">
          <TabsTrigger value="history" className="text-[10px] h-6 px-3 gap-1">
            <BarChart3 className="h-3 w-3" /> Yield & DPS History
          </TabsTrigger>
          <TabsTrigger value="payout" className="text-[10px] h-6 px-3 gap-1">
            <Percent className="h-3 w-3" /> Payout Trends
          </TabsTrigger>
          <TabsTrigger value="consistency" className="text-[10px] h-6 px-3 gap-1">
            <Award className="h-3 w-3" /> Consistency
          </TabsTrigger>
          <TabsTrigger value="calendar" className="text-[10px] h-6 px-3 gap-1">
            <CalendarDays className="h-3 w-3" /> Ex-Date Calendar
          </TabsTrigger>
          <TabsTrigger value="drip" className="text-[10px] h-6 px-3 gap-1">
            <Calculator className="h-3 w-3" /> DRIP Calculator
          </TabsTrigger>
        </TabsList>

        {/* ── Yield & DPS History ── */}
        <TabsContent value="history">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis yAxisId="dps" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `₹${v}`} />
                <YAxis yAxisId="yield" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }} />
                <Bar yAxisId="dps" dataKey="dps" fill="hsl(var(--primary))" opacity={0.7} radius={[2, 2, 0, 0]} name="DPS (₹)">
                  {chartData.map((_, i) => {
                    const isGrowing = i === 0 || chartData[i].dps >= chartData[i - 1].dps;
                    return <Cell key={i} fill={isGrowing ? "hsl(var(--primary))" : "hsl(var(--chart-red))"} opacity={0.7} />;
                  })}
                </Bar>
                <Line yAxisId="yield" type="monotone" dataKey="yieldPct" stroke="hsl(var(--chart-green))" strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--chart-green))" }} name="Yield %" />
                <ReferenceLine yAxisId="yield" y={avgYield} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                  label={{ value: `Avg ${avgYield.toFixed(1)}%`, fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "right" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* History table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-border/60">
                  {["Year", "Type", "DPS", "EPS", "Payout", "Yield", "Ex-Date"].map((h) => (
                    <th key={h} className="data-header text-[9px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...dividends].reverse().map((d, i) => {
                  const prev = i < dividends.length - 1 ? [...dividends].reverse()[i + 1] : null;
                  const dpsGrowing = !prev || d.dps >= prev.dps;
                  return (
                    <tr key={d.year} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="data-cell font-medium text-foreground">{d.year}</td>
                      <td className="data-cell">
                        <Badge variant="outline" className={`text-[8px] px-1 py-0 ${
                          d.type === "Special" ? "text-chart-amber border-chart-amber/30" : "text-muted-foreground"
                        }`}>{d.type}</Badge>
                      </td>
                      <td className="data-cell">
                        <span className={dpsGrowing ? "text-positive" : "text-negative"}>₹{d.dps}</span>
                        {prev && (
                          <span className="text-[8px] ml-1">
                            {dpsGrowing ? <TrendingUp className="h-2.5 w-2.5 inline text-positive" /> : <TrendingDown className="h-2.5 w-2.5 inline text-negative" />}
                          </span>
                        )}
                      </td>
                      <td className="data-cell">₹{d.eps}</td>
                      <td className={`data-cell ${d.payoutRatio > 70 ? "text-chart-amber" : ""}`}>{d.payoutRatio}%</td>
                      <td className="data-cell">{d.yieldPct}%</td>
                      <td className="data-cell text-muted-foreground">{d.exDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Payout Trends ── */}
        <TabsContent value="payout">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                <defs>
                  <linearGradient id="payoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-amber))" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(var(--chart-amber))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `₹${v}`} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }} />
                <Bar dataKey="dps" fill="hsl(var(--primary))" opacity={0.5} radius={[2, 2, 0, 0]} name="DPS (₹)" />
                <Bar dataKey="eps" fill="hsl(var(--chart-cyan))" opacity={0.3} radius={[2, 2, 0, 0]} name="EPS (₹)" />
                <Area yAxisId="pct" type="monotone" dataKey="payoutRatio" stroke="hsl(var(--chart-amber))" fill="url(#payoutGrad)"
                  strokeWidth={2} name="Payout Ratio %" />
                <ReferenceLine yAxisId="pct" y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3"
                  label={{ value: "50% Payout", fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "right" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>Reading:</strong> A sustainable payout ratio is typically 20–60%. Below 20% may indicate room for increases.
              Above 70% may be unsustainable long-term unless the company has very stable cash flows (e.g., utilities, REITs).
            </p>
          </div>
        </TabsContent>

        {/* ── Consistency Score ── */}
        <TabsContent value="consistency">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div key={i} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.06 }}
                      className={`w-7 h-8 rounded-sm ${i < consistency.score ? "bg-chart-green" : "bg-muted/40"}`} />
                  ))}
                </div>
                <div>
                  <span className="text-lg font-display font-bold text-foreground">{consistency.score}/{consistency.maxScore}</span>
                  <span className={`text-[10px] ml-1.5 font-semibold ${
                    consistency.score >= 4 ? "text-positive" : consistency.score >= 3 ? "text-chart-amber" : "text-negative"
                  }`}>
                    {consistency.score >= 4 ? "Dividend Champion" : consistency.score >= 3 ? "Reliable" : "Inconsistent"}
                  </span>
                </div>
              </div>

              {consistency.details.map((d, i) => (
                <motion.div key={d.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                  <div className="flex items-center gap-2">
                    {d.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-positive" /> : <XCircle className="h-3.5 w-3.5 text-negative" />}
                    <span className="text-[11px] font-medium text-foreground">{d.label}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${d.pass ? "text-positive" : "text-negative"}`}>{d.desc}</span>
                </motion.div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">10-Year DPS Growth</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis dataKey="year" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }} />
                    <Bar dataKey="dps" name="DPS" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => {
                        const isGrowing = i === 0 || chartData[i].dps >= chartData[i - 1].dps;
                        return <Cell key={i} fill={isGrowing ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                <span>10Y CAGR: <span className="text-primary font-bold">{cagr.toFixed(1)}%</span></span>
                <span>₹{first.dps} → ₹{latest.dps}</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Ex-Date Calendar ── */}
        <TabsContent value="calendar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={exDates}
                className={cn("p-3 pointer-events-auto")}
                modifiersClassNames={{
                  selected: "bg-primary text-primary-foreground",
                }}
                fromYear={2015}
                toYear={2025}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dividend History</p>
              {[...dividends].reverse().map((d) => (
                <motion.div key={d.year} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/10 border border-border/20 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-3 w-3 text-primary" />
                    <div>
                      <span className="text-[10px] font-medium text-foreground">{d.exDate}</span>
                      <span className="text-[8px] text-muted-foreground ml-1.5">{d.type}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-foreground">₹{d.dps}</span>
                    <span className="text-[9px] text-muted-foreground ml-1">({d.yieldPct}%)</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── DRIP Calculator ── */}
        <TabsContent value="drip">
          <DRIPCalculator currentDPS={latest.dps} currentPrice={price} yieldPct={currentYield} />
          <div className="p-2 rounded bg-muted/20 border border-border/30 mt-2">
            <p className="text-[9px] text-muted-foreground">
              <strong>DRIP:</strong> Dividend Reinvestment Plan — automatically reinvests dividends to buy more shares,
              compounding returns over time. "Yield on Cost" shows your effective yield based on original investment.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

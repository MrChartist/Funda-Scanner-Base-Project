import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calculator, TrendingUp, AlertTriangle, Info, BarChart3, Target,
  Shuffle, PieChart, Layers, ChevronDown, ChevronUp, Download, Share2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, PieChart as RPieChart, Pie, Legend,
  ComposedChart, Line, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageTransition } from "@/components/PageTransition";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";

// ─── Types ───────────────────────────────────────────────────────
interface DCFInputs {
  symbol: string;
  fcf: number;
  growthRate: number;         // Stage 1
  stage2Growth: number;       // Stage 2 (fade)
  terminalGrowth: number;
  discountRate: number;
  years: number;
  stage2Years: number;
  sharesOutstanding: number;
  terminalMethod: "perpetuity" | "exitMultiple";
  exitMultiple: number;
  netDebt: number;
}

interface WACCInputs {
  riskFreeRate: number;
  beta: number;
  equityRiskPremium: number;
  costOfDebt: number;
  taxRate: number;
  debtToEquity: number;
}

interface Scenario {
  label: string;
  color: string;
  growthRate: number;
  stage2Growth: number;
  terminalGrowth: number;
  discountRate: number;
}

// ─── Calculations ────────────────────────────────────────────────
function calculateWACC(w: WACCInputs): number {
  const costOfEquity = w.riskFreeRate + w.beta * w.equityRiskPremium;
  const afterTaxDebt = w.costOfDebt * (1 - w.taxRate / 100);
  const equityWeight = 1 / (1 + w.debtToEquity);
  const debtWeight = w.debtToEquity / (1 + w.debtToEquity);
  return costOfEquity * equityWeight + afterTaxDebt * debtWeight;
}

function calculateDCF(inputs: DCFInputs): { perShare: number; totalPV: number; pvFCFs: number; pvTerminal: number; projections: { year: number; fcf: number; pv: number; phase: string }[] } {
  let totalPVFCFs = 0;
  let fcf = inputs.fcf;
  const projections: { year: number; fcf: number; pv: number; phase: string }[] = [
    { year: 0, fcf: inputs.fcf, pv: inputs.fcf, phase: "Current" },
  ];

  // Stage 1: high growth
  for (let y = 1; y <= inputs.years; y++) {
    fcf *= 1 + inputs.growthRate / 100;
    const pv = fcf / Math.pow(1 + inputs.discountRate / 100, y);
    totalPVFCFs += pv;
    projections.push({ year: y, fcf: Math.round(fcf), pv: Math.round(pv), phase: "High Growth" });
  }

  // Stage 2: fade to terminal
  for (let y = 1; y <= inputs.stage2Years; y++) {
    const fadeRate = inputs.growthRate - ((inputs.growthRate - inputs.stage2Growth) * y) / inputs.stage2Years;
    fcf *= 1 + fadeRate / 100;
    const totalYear = inputs.years + y;
    const pv = fcf / Math.pow(1 + inputs.discountRate / 100, totalYear);
    totalPVFCFs += pv;
    projections.push({ year: totalYear, fcf: Math.round(fcf), pv: Math.round(pv), phase: "Fade" });
  }

  const totalProjectionYears = inputs.years + inputs.stage2Years;

  // Terminal value
  let terminalValue: number;
  if (inputs.terminalMethod === "exitMultiple") {
    terminalValue = fcf * inputs.exitMultiple;
  } else {
    terminalValue = (fcf * (1 + inputs.terminalGrowth / 100)) / (inputs.discountRate / 100 - inputs.terminalGrowth / 100);
  }
  const pvTerminal = terminalValue / Math.pow(1 + inputs.discountRate / 100, totalProjectionYears);

  const enterpriseValue = totalPVFCFs + pvTerminal;
  const equityValue = enterpriseValue - inputs.netDebt;
  const perShare = equityValue / inputs.sharesOutstanding;

  return { perShare, totalPV: enterpriseValue, pvFCFs: totalPVFCFs, pvTerminal, projections };
}

function reverseImpliedGrowth(inputs: DCFInputs, targetPrice: number): number {
  let lo = -10, hi = 50;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const result = calculateDCF({ ...inputs, growthRate: mid });
    if (result.perShare > targetPrice) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

function monteCarloSimulation(inputs: DCFInputs, iterations: number = 5000): number[] {
  const results: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const randGrowth = inputs.growthRate + (Math.random() - 0.5) * 10;
    const randDiscount = inputs.discountRate + (Math.random() - 0.5) * 4;
    const randTerminal = inputs.terminalGrowth + (Math.random() - 0.5) * 2;
    const { perShare } = calculateDCF({
      ...inputs,
      growthRate: Math.max(0, randGrowth),
      discountRate: Math.max(5, randDiscount),
      terminalGrowth: Math.max(0, Math.min(randDiscount - 1, randTerminal)),
    });
    if (isFinite(perShare) && perShare > 0) results.push(perShare);
  }
  return results.sort((a, b) => a - b);
}

// ─── Sub-components ──────────────────────────────────────────────
function InputSlider({ label, value, onChange, min, max, step, unit, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string; tooltip?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 uppercase tracking-wider">
          {label}
          {tooltip && (
            <span title={tooltip}><Info className="h-2.5 w-2.5 text-muted-foreground/50" /></span>
          )}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number" value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-16 text-right text-[11px] font-mono bg-muted/30 border border-border rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            step={step}
          />
          <span className="text-[10px] text-muted-foreground w-4">{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-border rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function SensitivityTable({ inputs }: { inputs: DCFInputs }) {
  const growthRates = [-2, -1, 0, 1, 2].map((d) => +(inputs.growthRate + d).toFixed(1));
  const discountRates = [-2, -1, 0, 1, 2].map((d) => +(inputs.discountRate + d).toFixed(1));
  const baseVal = calculateDCF(inputs).perShare;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[10px] font-mono">
        <thead>
          <tr className="border-b border-border/60">
            <th className="data-header text-[9px]">Growth↓ / WACC→</th>
            {discountRates.map((dr) => (
              <th key={dr} className={`data-header text-[9px] ${dr === inputs.discountRate ? "text-primary" : ""}`}>{dr}%</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {growthRates.map((gr) => (
            <tr key={gr} className="border-b border-border/20 hover:bg-muted/20">
              <td className={`data-cell font-medium ${gr === inputs.growthRate ? "text-primary" : "text-muted-foreground"}`}>{gr}%</td>
              {discountRates.map((dr) => {
                const val = calculateDCF({ ...inputs, growthRate: gr, discountRate: dr }).perShare;
                const isCenter = gr === inputs.growthRate && dr === inputs.discountRate;
                return (
                  <td key={dr} className={`data-cell ${isCenter ? "bg-primary/10 font-bold text-primary" : val > baseVal ? "text-positive" : "text-negative"}`}>
                    ₹{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WACCCalculator({ onApply }: { onApply: (wacc: number) => void }) {
  const [w, setW] = useState<WACCInputs>({
    riskFreeRate: 7.0, beta: 1.0, equityRiskPremium: 6.0,
    costOfDebt: 8.0, taxRate: 25, debtToEquity: 0.3,
  });
  const [expanded, setExpanded] = useState(false);
  const wacc = calculateWACC(w);
  const costOfEquity = w.riskFreeRate + w.beta * w.equityRiskPremium;

  return (
    <div className="glass-card p-3 space-y-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Calculator className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">WACC Calculator</span>
          <Badge variant="outline" className="text-[10px] font-mono px-1.5">
            {wacc.toFixed(2)}%
          </Badge>
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2">
            <div className="grid grid-cols-2 gap-2 pt-2">
              <InputSlider label="Risk-Free Rate" value={w.riskFreeRate} onChange={(v) => setW(p => ({ ...p, riskFreeRate: v }))} min={0} max={12} step={0.1} unit="%" tooltip="10Y Govt Bond Yield" />
              <InputSlider label="Beta" value={w.beta} onChange={(v) => setW(p => ({ ...p, beta: v }))} min={0.1} max={3} step={0.05} unit="β" tooltip="Stock volatility vs market" />
              <InputSlider label="Equity Risk Premium" value={w.equityRiskPremium} onChange={(v) => setW(p => ({ ...p, equityRiskPremium: v }))} min={3} max={12} step={0.5} unit="%" />
              <InputSlider label="Cost of Debt" value={w.costOfDebt} onChange={(v) => setW(p => ({ ...p, costOfDebt: v }))} min={4} max={18} step={0.5} unit="%" />
              <InputSlider label="Tax Rate" value={w.taxRate} onChange={(v) => setW(p => ({ ...p, taxRate: v }))} min={0} max={40} step={1} unit="%" />
              <InputSlider label="Debt/Equity" value={w.debtToEquity} onChange={(v) => setW(p => ({ ...p, debtToEquity: v }))} min={0} max={3} step={0.05} unit="x" />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <div className="text-[10px] text-muted-foreground font-mono">
                Ke={costOfEquity.toFixed(1)}% · Kd(1-t)={(w.costOfDebt * (1 - w.taxRate / 100)).toFixed(1)}% · WACC=<span className="text-primary font-bold">{wacc.toFixed(2)}%</span>
              </div>
              <Button size="sm" onClick={() => onApply(wacc)} className="h-6 text-[10px] px-3">Apply WACC</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MonteCarloChart({ inputs }: { inputs: DCFInputs }) {
  const simResults = useMemo(() => monteCarloSimulation(inputs, 3000), [inputs]);

  const histogram = useMemo(() => {
    if (simResults.length === 0) return [];
    const min = simResults[0];
    const max = simResults[simResults.length - 1];
    const bins = 30;
    const binWidth = (max - min) / bins;
    const buckets: { range: string; count: number; mid: number }[] = [];
    for (let i = 0; i < bins; i++) {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const count = simResults.filter(v => v >= lo && v < hi).length;
      buckets.push({ range: `₹${Math.round(lo)}`, count, mid: (lo + hi) / 2 });
    }
    return buckets;
  }, [simResults]);

  const p10 = simResults[Math.floor(simResults.length * 0.1)];
  const p50 = simResults[Math.floor(simResults.length * 0.5)];
  const p90 = simResults[Math.floor(simResults.length * 0.9)];
  const mean = simResults.reduce((a, b) => a + b, 0) / simResults.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "P10 (Bear)", value: p10, color: "text-negative" },
          { label: "P50 (Median)", value: p50, color: "text-foreground" },
          { label: "Mean", value: mean, color: "text-primary" },
          { label: "P90 (Bull)", value: p90, color: "text-positive" },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-sm font-mono font-bold ${color}`}>₹{Math.round(value).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histogram} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
            <XAxis dataKey="range" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} interval={4} axisLine={false} />
            <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }} />
            <Bar dataKey="count" name="Frequency" radius={[2, 2, 0, 0]}>
              {histogram.map((entry, i) => (
                <Cell key={i} fill={entry.mid < p10 ? "hsl(var(--chart-red))" : entry.mid > p90 ? "hsl(var(--chart-green))" : "hsl(var(--primary))"} opacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[9px] text-muted-foreground text-center">
        3,000 iterations · Growth ±5% · WACC ±2% · Terminal ±1%
      </p>
    </div>
  );
}

function ScenarioComparison({ inputs, currentPrice }: { inputs: DCFInputs; currentPrice: number }) {
  const scenarios: Scenario[] = [
    { label: "Bear", color: "hsl(var(--chart-red))", growthRate: Math.max(0, inputs.growthRate - 5), stage2Growth: Math.max(0, inputs.stage2Growth - 3), terminalGrowth: Math.max(0, inputs.terminalGrowth - 1), discountRate: inputs.discountRate + 2 },
    { label: "Base", color: "hsl(var(--primary))", growthRate: inputs.growthRate, stage2Growth: inputs.stage2Growth, terminalGrowth: inputs.terminalGrowth, discountRate: inputs.discountRate },
    { label: "Bull", color: "hsl(var(--chart-green))", growthRate: inputs.growthRate + 5, stage2Growth: inputs.stage2Growth + 3, terminalGrowth: Math.min(inputs.discountRate - 1, inputs.terminalGrowth + 1), discountRate: Math.max(6, inputs.discountRate - 1.5) },
  ];

  const results = scenarios.map(s => {
    const res = calculateDCF({ ...inputs, growthRate: s.growthRate, stage2Growth: s.stage2Growth, terminalGrowth: s.terminalGrowth, discountRate: s.discountRate });
    return { ...s, value: res.perShare, upside: ((res.perShare - currentPrice) / currentPrice * 100) };
  });

  const chartData = results.map(r => ({
    name: r.label,
    value: Math.round(r.value),
    color: r.color,
  }));

  return (
    <div className="space-y-3">
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 10 }} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
              tickFormatter={(v) => `₹${v.toLocaleString()}`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }} axisLine={false} width={40} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }}
              formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
            <ReferenceLine x={currentPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: `CMP ₹${currentPrice.toLocaleString()}`, fill: "hsl(var(--muted-foreground))", fontSize: 9, position: "top" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.8} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {results.map(r => (
          <div key={r.label} className="text-center p-2 rounded bg-muted/20 border border-border/30">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{r.label}</p>
            <p className="text-sm font-mono font-bold text-foreground">₹{Math.round(r.value).toLocaleString()}</p>
            <p className={`text-[10px] font-mono ${r.upside > 0 ? "text-positive" : "text-negative"}`}>
              {r.upside > 0 ? "+" : ""}{r.upside.toFixed(1)}%
            </p>
            <div className="mt-1 text-[8px] text-muted-foreground font-mono">
              G:{r.growthRate.toFixed(0)}% W:{r.discountRate.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function DCFCalculator() {
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE");
  const companyData = useMemo(() => getMockCompanyIntelligence(selectedSymbol), [selectedSymbol]);
  const lastFY = companyData.intelligence.statement_rows[companyData.intelligence.statement_rows.length - 1];

  const [inputs, setInputs] = useState<DCFInputs>({
    symbol: selectedSymbol,
    fcf: lastFY?.ocf ? lastFY.ocf + (lastFY.icf || 0) : 15000,
    growthRate: 12,
    stage2Growth: 6,
    terminalGrowth: 3,
    discountRate: 10,
    years: 5,
    stage2Years: 5,
    sharesOutstanding: Math.round(companyData.company.market_cap / companyData.company.price * 100) / 100,
    terminalMethod: "perpetuity",
    exitMultiple: 15,
    netDebt: Math.round((lastFY?.debt || 0) - (lastFY?.ocf || 0) * 0.3),
  });

  const update = useCallback((key: keyof DCFInputs, val: number | string) =>
    setInputs((p) => ({ ...p, [key]: val })), []);

  const result = useMemo(() => calculateDCF(inputs), [inputs]);
  const currentPrice = companyData.company.price;
  const marginOfSafety = ((result.perShare - currentPrice) / result.perShare) * 100;
  const isUndervalued = result.perShare > currentPrice;

  // Reverse DCF
  const impliedGrowth = useMemo(() => reverseImpliedGrowth(inputs, currentPrice), [inputs, currentPrice]);

  // Terminal value breakdown
  const tvBreakdown = useMemo(() => [
    { name: "PV of FCFs", value: Math.round(result.pvFCFs), fill: "hsl(var(--primary))" },
    { name: "PV of Terminal", value: Math.round(result.pvTerminal), fill: "hsl(var(--chart-green))" },
  ], [result]);

  const tvPct = (result.pvTerminal / result.totalPV * 100).toFixed(0);

  // Historical FCF
  const historicalFCFs = useMemo(() => {
    return companyData.intelligence.statement_rows.slice(-5).map((r, i) => ({
      year: r.year?.toString() || `FY${i}`,
      fcf: Math.round((r.ocf || 0) + (r.icf || 0)),
    }));
  }, [companyData]);

  const combinedProjection = useMemo(() => {
    const hist = historicalFCFs.map(h => ({ ...h, projected: undefined as number | undefined, pv: undefined as number | undefined, phase: "Historical" }));
    const proj = result.projections.slice(1).map(p => ({
      year: `Y${p.year}`,
      fcf: undefined as number | undefined,
      projected: p.fcf,
      pv: p.pv,
      phase: p.phase,
    }));
    return [...hist, ...proj];
  }, [historicalFCFs, result.projections]);

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    const d = getMockCompanyIntelligence(sym);
    const fy = d.intelligence.statement_rows[d.intelligence.statement_rows.length - 1];
    setInputs(prev => ({
      ...prev,
      symbol: sym,
      fcf: fy?.ocf ? fy.ocf + (fy.icf || 0) : 15000,
      sharesOutstanding: Math.round(d.company.market_cap / d.company.price * 100) / 100,
      netDebt: Math.round((fy?.debt || 0) - (fy?.ocf || 0) * 0.3),
    }));
  };

  return (
    <PageTransition>
      <div className="container max-w-7xl py-3 space-y-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-lg font-display font-bold text-foreground">DCF Valuation</h1>
              <p className="text-[10px] text-muted-foreground">Two-Stage Discounted Cash Flow · Intrinsic Value Estimator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedSymbol} onChange={(e) => handleSymbolChange(e.target.value)}
              className="bg-muted/30 border border-border rounded px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {MOCK_COMPANIES.map((c) => (
                <option key={c.symbol} value={c.symbol}>{c.symbol}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => {
              const url = `${window.location.origin}/dcf?symbol=${selectedSymbol}`;
              navigator.clipboard.writeText(url);
            }}>
              <Share2 className="h-3 w-3" /> Share
            </Button>
          </div>
        </motion.div>

        {/* Verdict */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
          className={`glass-card p-3 border-l-4 ${isUndervalued ? "border-l-chart-green" : "border-l-chart-red"}`}>
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Intrinsic Value</p>
              <p className="text-2xl font-display font-bold text-foreground">₹{result.perShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Market Price</p>
              <p className="text-2xl font-display font-bold text-foreground">₹{currentPrice.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Margin of Safety</p>
              <Badge className={`text-base font-mono px-2 py-0.5 ${isUndervalued ? "bg-chart-green/15 text-positive" : "bg-chart-red/15 text-negative"}`}>
                {marginOfSafety > 0 ? "+" : ""}{marginOfSafety.toFixed(1)}%
              </Badge>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Implied Growth</p>
              <p className="text-base font-mono font-bold text-primary">{impliedGrowth.toFixed(1)}%</p>
              <p className="text-[8px] text-muted-foreground">Reverse DCF</p>
            </div>
            <Badge variant="outline" className={`text-[11px] px-2 py-1 ${isUndervalued ? "text-positive border-chart-green/40" : "text-negative border-chart-red/40"}`}>
              {isUndervalued ? <TrendingUp className="h-3.5 w-3.5 mr-1" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
              {isUndervalued ? "Undervalued" : "Overvalued"}
            </Badge>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* Left: Inputs Panel */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="lg:col-span-4 space-y-3">
            {/* WACC Calculator */}
            <WACCCalculator onApply={(wacc) => update("discountRate", +wacc.toFixed(2))} />

            {/* Core Assumptions */}
            <div className="glass-card p-3 space-y-3">
              <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" /> Assumptions
              </h2>
              <InputSlider label="Base FCF" value={inputs.fcf} onChange={(v) => update("fcf", v)} min={100} max={200000} step={500} unit="Cr" tooltip="Latest year Free Cash Flow" />

              <div className="border-t border-border/30 pt-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Stage 1 — High Growth</p>
                <InputSlider label="Growth Rate" value={inputs.growthRate} onChange={(v) => update("growthRate", v)} min={0} max={40} step={0.5} unit="%" />
                <div className="mt-2">
                  <InputSlider label="Duration" value={inputs.years} onChange={(v) => update("years", v)} min={3} max={15} step={1} unit="yr" />
                </div>
              </div>

              <div className="border-t border-border/30 pt-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Stage 2 — Fade Period</p>
                <InputSlider label="Fade-to Rate" value={inputs.stage2Growth} onChange={(v) => update("stage2Growth", v)} min={0} max={20} step={0.5} unit="%" />
                <div className="mt-2">
                  <InputSlider label="Duration" value={inputs.stage2Years} onChange={(v) => update("stage2Years", v)} min={0} max={10} step={1} unit="yr" />
                </div>
              </div>

              <div className="border-t border-border/30 pt-2">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">Terminal Value</p>
                <div className="flex gap-1 mb-2">
                  <button onClick={() => update("terminalMethod", "perpetuity")}
                    className={`text-[9px] px-2 py-0.5 rounded ${inputs.terminalMethod === "perpetuity" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}>
                    Perpetuity Growth
                  </button>
                  <button onClick={() => update("terminalMethod", "exitMultiple")}
                    className={`text-[9px] px-2 py-0.5 rounded ${inputs.terminalMethod === "exitMultiple" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}>
                    Exit Multiple
                  </button>
                </div>
                {inputs.terminalMethod === "perpetuity" ? (
                  <InputSlider label="Terminal Growth" value={inputs.terminalGrowth} onChange={(v) => update("terminalGrowth", v)} min={0} max={6} step={0.25} unit="%" />
                ) : (
                  <InputSlider label="Exit EV/FCF Multiple" value={inputs.exitMultiple} onChange={(v) => update("exitMultiple", v)} min={5} max={40} step={1} unit="x" />
                )}
              </div>

              <div className="border-t border-border/30 pt-2">
                <InputSlider label="Discount Rate (WACC)" value={inputs.discountRate} onChange={(v) => update("discountRate", v)} min={5} max={20} step={0.25} unit="%" />
                <div className="mt-2">
                  <InputSlider label="Shares Outstanding" value={inputs.sharesOutstanding} onChange={(v) => update("sharesOutstanding", v)} min={1} max={10000} step={1} unit="Cr" />
                </div>
                <div className="mt-2">
                  <InputSlider label="Net Debt" value={inputs.netDebt} onChange={(v) => update("netDebt", v)} min={-50000} max={200000} step={500} unit="Cr" tooltip="Debt minus cash; negative = net cash" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right: Charts & Analysis */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}
            className="lg:col-span-8 space-y-3">
            {/* FCF Projection Chart */}
            <div className="glass-card p-3">
              <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <BarChart3 className="h-3.5 w-3.5 text-primary" /> FCF Projection — Historical + Forecast
              </h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinedProjection} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pvGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                    <XAxis dataKey="year" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }}
                      formatter={(v: any) => v !== undefined ? `₹${Number(v).toLocaleString()} Cr` : "—"} />
                    <Bar dataKey="fcf" fill="hsl(var(--muted-foreground))" opacity={0.5} radius={[2, 2, 0, 0]} name="Historical FCF" />
                    <Area type="monotone" dataKey="projected" stroke="hsl(var(--primary))" fill="url(#projGrad)" strokeWidth={2} name="Projected FCF" connectNulls />
                    <Area type="monotone" dataKey="pv" stroke="hsl(var(--chart-green))" fill="url(#pvGrad2)" strokeWidth={1.5} strokeDasharray="4 2" name="Present Value" connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Grid: TV Breakdown + Scenarios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Terminal Value Breakdown */}
              <div className="glass-card p-3">
                <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <PieChart className="h-3.5 w-3.5 text-primary" /> Value Breakdown
                </h2>
                <div className="flex items-center gap-3">
                  <div className="h-28 w-28 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie data={tvBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45}
                          paddingAngle={3} startAngle={90} endAngle={-270}>
                          {tvBreakdown.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: 10 }}
                          formatter={(v: any) => `₹${Number(v).toLocaleString()} Cr`} />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">PV of FCFs</p>
                      <p className="text-sm font-mono font-bold text-foreground">₹{Math.round(result.pvFCFs).toLocaleString()} Cr</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">PV of Terminal</p>
                      <p className="text-sm font-mono font-bold text-foreground">₹{Math.round(result.pvTerminal).toLocaleString()} Cr</p>
                    </div>
                    <div className="pt-1 border-t border-border/30">
                      <p className="text-[9px] text-muted-foreground uppercase">TV as % of EV</p>
                      <p className={`text-sm font-mono font-bold ${Number(tvPct) > 75 ? "text-negative" : "text-foreground"}`}>
                        {tvPct}% {Number(tvPct) > 75 && <span className="text-[8px] text-negative">⚠ High</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scenario Analysis */}
              <div className="glass-card p-3">
                <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Target className="h-3.5 w-3.5 text-primary" /> Scenario Analysis
                </h2>
                <ScenarioComparison inputs={inputs} currentPrice={currentPrice} />
              </div>
            </div>

            {/* Tabs: Sensitivity + Monte Carlo */}
            <div className="glass-card p-3">
              <Tabs defaultValue="sensitivity">
                <TabsList className="mb-2 h-7">
                  <TabsTrigger value="sensitivity" className="text-[10px] h-6 px-3">Sensitivity Table</TabsTrigger>
                  <TabsTrigger value="montecarlo" className="text-[10px] h-6 px-3">Monte Carlo</TabsTrigger>
                </TabsList>
                <TabsContent value="sensitivity">
                  <SensitivityTable inputs={inputs} />
                </TabsContent>
                <TabsContent value="montecarlo">
                  <MonteCarloChart inputs={inputs} />
                </TabsContent>
              </Tabs>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}

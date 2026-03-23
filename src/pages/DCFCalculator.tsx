import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/PageTransition";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";

interface DCFInputs {
  symbol: string;
  fcf: number;
  growthRate: number;
  terminalGrowth: number;
  discountRate: number;
  years: number;
  sharesOutstanding: number;
}

function SensitivityTable({ inputs, intrinsicValue }: { inputs: DCFInputs; intrinsicValue: number }) {
  const growthRates = [-2, -1, 0, 1, 2].map((d) => inputs.growthRate + d);
  const discountRates = [-2, -1, 0, 1, 2].map((d) => inputs.discountRate + d);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/60">
            <th className="data-header text-[10px]">Growth ↓ / WACC →</th>
            {discountRates.map((dr) => (
              <th key={dr} className={`data-header text-[10px] ${dr === inputs.discountRate ? "text-primary" : ""}`}>
                {dr.toFixed(0)}%
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {growthRates.map((gr) => (
            <tr key={gr} className="border-b border-border/20">
              <td className={`data-cell font-medium ${gr === inputs.growthRate ? "text-primary" : "text-muted-foreground"}`}>
                {gr.toFixed(0)}%
              </td>
              {discountRates.map((dr) => {
                const val = calculateDCF({ ...inputs, growthRate: gr, discountRate: dr });
                const isCenter = gr === inputs.growthRate && dr === inputs.discountRate;
                const pctDiff = ((val - inputs.fcf) / inputs.fcf) * 100;
                return (
                  <td key={dr} className={`data-cell font-mono ${isCenter ? "bg-primary/10 font-bold text-primary" : val > intrinsicValue ? "text-positive" : "text-negative"}`}>
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

function calculateDCF(inputs: DCFInputs): number {
  let totalPV = 0;
  let fcf = inputs.fcf;
  for (let y = 1; y <= inputs.years; y++) {
    fcf *= 1 + inputs.growthRate / 100;
    totalPV += fcf / Math.pow(1 + inputs.discountRate / 100, y);
  }
  const terminalValue = (fcf * (1 + inputs.terminalGrowth / 100)) / (inputs.discountRate / 100 - inputs.terminalGrowth / 100);
  totalPV += terminalValue / Math.pow(1 + inputs.discountRate / 100, inputs.years);
  return totalPV / inputs.sharesOutstanding;
}

function InputSlider({ label, value, onChange, min, max, step, unit, tooltip }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string; tooltip?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          {label}
          {tooltip && <Info className="h-3 w-3 text-muted-foreground/50" />}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-20 text-right text-sm font-mono bg-muted/30 border border-border rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            step={step}
          />
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

export default function DCFCalculator() {
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE");
  const companyData = useMemo(() => getMockCompanyIntelligence(selectedSymbol), [selectedSymbol]);
  const lastFY = companyData.intelligence.statement_rows[companyData.intelligence.statement_rows.length - 1];

  const [inputs, setInputs] = useState<DCFInputs>({
    symbol: selectedSymbol,
    fcf: lastFY?.ocf ? lastFY.ocf + (lastFY.icf || 0) : 15000,
    growthRate: 12,
    terminalGrowth: 3,
    discountRate: 10,
    years: 10,
    sharesOutstanding: Math.round(companyData.company.market_cap / companyData.company.price * 100) / 100,
  });

  const update = (key: keyof DCFInputs, val: number) => setInputs((p) => ({ ...p, [key]: val }));

  const intrinsicValue = useMemo(() => calculateDCF(inputs), [inputs]);
  const currentPrice = companyData.company.price;
  const marginOfSafety = ((intrinsicValue - currentPrice) / intrinsicValue) * 100;
  const isUndervalued = intrinsicValue > currentPrice;

  // FCF projection chart
  const projectionData = useMemo(() => {
    const data = [];
    let fcf = inputs.fcf;
    for (let y = 0; y <= inputs.years; y++) {
      if (y > 0) fcf *= 1 + inputs.growthRate / 100;
      const pv = fcf / Math.pow(1 + inputs.discountRate / 100, y);
      data.push({ year: `Y${y}`, fcf: Math.round(fcf), pv: Math.round(pv) });
    }
    return data;
  }, [inputs]);

  return (
    <PageTransition>
      <div className="container max-w-7xl py-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Calculator className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">DCF Calculator</h1>
                <p className="text-sm text-muted-foreground">Discounted Cash Flow intrinsic value estimator</p>
              </div>
            </div>
            <select
              value={selectedSymbol}
              onChange={(e) => {
                setSelectedSymbol(e.target.value);
                const d = getMockCompanyIntelligence(e.target.value);
                const fy = d.intelligence.statement_rows[d.intelligence.statement_rows.length - 1];
                update("fcf", fy?.ocf ? fy.ocf + (fy.icf || 0) : 15000);
                update("sharesOutstanding", Math.round(d.company.market_cap / d.company.price * 100) / 100);
              }}
              className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {MOCK_COMPANIES.map((c) => (
                <option key={c.symbol} value={c.symbol}>{c.symbol} - {c.name.split(" ").slice(0, 2).join(" ")}</option>
              ))}
            </select>
          </div>
        </motion.div>

        {/* Verdict Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`glass-card p-5 border-l-4 ${isUndervalued ? "border-l-chart-green" : "border-l-chart-red"}`}>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Intrinsic Value</p>
              <p className="text-3xl font-display font-bold text-foreground">₹{intrinsicValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Current Price</p>
              <p className="text-3xl font-display font-bold text-foreground">₹{currentPrice.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Margin of Safety</p>
              <Badge className={`text-lg font-mono px-3 py-1 ${isUndervalued ? "bg-chart-green/15 text-positive" : "bg-chart-red/15 text-negative"}`}>
                {marginOfSafety > 0 ? "+" : ""}{marginOfSafety.toFixed(1)}%
              </Badge>
            </div>
            <Badge variant="outline" className={`text-sm px-3 py-1.5 ${isUndervalued ? "text-positive border-chart-green/40" : "text-negative border-chart-red/40"}`}>
              {isUndervalued ? <TrendingUp className="h-4 w-4 mr-1" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
              {isUndervalued ? "Potentially Undervalued" : "Potentially Overvalued"}
            </Badge>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Inputs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass-card p-5 space-y-5">
            <h2 className="section-title">Assumptions</h2>
            <InputSlider label="Base FCF (₹ Cr)" value={inputs.fcf} onChange={(v) => update("fcf", v)} min={100} max={200000} step={500} unit="Cr" />
            <InputSlider label="FCF Growth Rate" value={inputs.growthRate} onChange={(v) => update("growthRate", v)} min={0} max={30} step={0.5} unit="%" />
            <InputSlider label="Terminal Growth" value={inputs.terminalGrowth} onChange={(v) => update("terminalGrowth", v)} min={0} max={6} step={0.5} unit="%" />
            <InputSlider label="Discount Rate (WACC)" value={inputs.discountRate} onChange={(v) => update("discountRate", v)} min={5} max={20} step={0.5} unit="%" />
            <InputSlider label="Projection Years" value={inputs.years} onChange={(v) => update("years", v)} min={5} max={20} step={1} unit="yrs" />
            <InputSlider label="Shares Outstanding" value={inputs.sharesOutstanding} onChange={(v) => update("sharesOutstanding", v)} min={1} max={10000} step={1} unit="Cr" />
          </motion.div>

          {/* FCF Projection Chart */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="glass-card p-5 lg:col-span-2">
            <h2 className="section-title mb-4">FCF Projection & Present Value</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="fcfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                    formatter={(v: any) => `₹${Number(v).toLocaleString()} Cr`} />
                  <Area type="monotone" dataKey="fcf" stroke="hsl(var(--primary))" fill="url(#fcfGrad)" strokeWidth={2} name="FCF" />
                  <Area type="monotone" dataKey="pv" stroke="hsl(var(--chart-green))" fill="url(#pvGrad)" strokeWidth={2} name="Present Value" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Sensitivity Analysis */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass-card p-5">
          <h2 className="section-title mb-4">Sensitivity Analysis (Growth vs WACC)</h2>
          <SensitivityTable inputs={inputs} intrinsicValue={intrinsicValue} />
        </motion.div>
      </div>
    </PageTransition>
  );
}

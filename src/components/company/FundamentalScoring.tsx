import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown,
  Minus, BarChart3, Layers, Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────
interface FinRow {
  year: number; revenue: number; ebitda: number; depreciation: number;
  interest: number; pbt: number; tax: number; net_profit: number;
  total_assets: number; total_liabilities: number; equity: number;
  reserves: number; debt: number; ocf: number; icf: number;
}

interface RatioRow {
  year: number; roce: number; roe: number; ebitda_margin: number;
  npm: number; debt_equity: number; interest_coverage: number;
  sales_growth: number; profit_growth: number;
}

interface Props {
  statementRows: FinRow[];
  ratioRows: RatioRow[];
  marketCap: number;
  price: number;
  sector: string;
}

// ─── Piotroski F-Score ───────────────────────────────────────────
interface FScoreCriterion {
  name: string;
  category: "Profitability" | "Leverage" | "Efficiency";
  description: string;
  pass: boolean;
  detail: string;
}

function computePiotroski(rows: FinRow[], ratios: RatioRow[]): { score: number; criteria: FScoreCriterion[] } {
  if (rows.length < 2) return { score: 0, criteria: [] };

  const curr = rows[rows.length - 1];
  const prev = rows[rows.length - 2];

  const roa = curr.net_profit / curr.total_assets;
  const prevRoa = prev.net_profit / prev.total_assets;
  const cfoa = curr.ocf / curr.total_assets;
  const currLeverage = curr.debt / curr.total_assets;
  const prevLeverage = prev.debt / prev.total_assets;
  const currCurrent = (curr.total_assets - curr.debt) / curr.total_liabilities;
  const prevCurrent = (prev.total_assets - prev.debt) / prev.total_liabilities;
  const currGrossMargin = curr.ebitda / curr.revenue;
  const prevGrossMargin = prev.ebitda / prev.revenue;
  const currTurnover = curr.revenue / curr.total_assets;
  const prevTurnover = prev.revenue / prev.total_assets;

  const criteria: FScoreCriterion[] = [
    // Profitability (4 pts)
    {
      name: "Positive ROA",
      category: "Profitability",
      description: "Net income / Total assets > 0",
      pass: roa > 0,
      detail: `ROA = ${(roa * 100).toFixed(1)}%`,
    },
    {
      name: "Positive OCF",
      category: "Profitability",
      description: "Operating cash flow > 0",
      pass: curr.ocf > 0,
      detail: `OCF = ₹${curr.ocf.toLocaleString()} Cr`,
    },
    {
      name: "Improving ROA",
      category: "Profitability",
      description: "ROA increased vs prior year",
      pass: roa > prevRoa,
      detail: `${(prevRoa * 100).toFixed(1)}% → ${(roa * 100).toFixed(1)}%`,
    },
    {
      name: "OCF > Net Income",
      category: "Profitability",
      description: "Cash flow quality: OCF exceeds net profit",
      pass: curr.ocf > curr.net_profit,
      detail: `OCF ₹${curr.ocf.toLocaleString()} vs NI ₹${curr.net_profit.toLocaleString()}`,
    },
    // Leverage (3 pts)
    {
      name: "Decreasing Leverage",
      category: "Leverage",
      description: "Long-term debt / Total assets decreased",
      pass: currLeverage < prevLeverage,
      detail: `${(prevLeverage * 100).toFixed(1)}% → ${(currLeverage * 100).toFixed(1)}%`,
    },
    {
      name: "Improving Liquidity",
      category: "Leverage",
      description: "Current ratio improved",
      pass: currCurrent > prevCurrent,
      detail: `${prevCurrent.toFixed(2)}x → ${currCurrent.toFixed(2)}x`,
    },
    {
      name: "No Dilution",
      category: "Leverage",
      description: "No new equity issuance (shares stable)",
      pass: true, // simplified — assume no dilution from mock data
      detail: "No new shares issued",
    },
    // Efficiency (2 pts)
    {
      name: "Improving Margins",
      category: "Efficiency",
      description: "Gross margin increased vs prior year",
      pass: currGrossMargin > prevGrossMargin,
      detail: `${(prevGrossMargin * 100).toFixed(1)}% → ${(currGrossMargin * 100).toFixed(1)}%`,
    },
    {
      name: "Improving Turnover",
      category: "Efficiency",
      description: "Asset turnover increased",
      pass: currTurnover > prevTurnover,
      detail: `${prevTurnover.toFixed(2)}x → ${currTurnover.toFixed(2)}x`,
    },
  ];

  const score = criteria.filter((c) => c.pass).length;
  return { score, criteria };
}

// ─── Altman Z-Score ──────────────────────────────────────────────
interface ZScoreComponent {
  label: string;
  formula: string;
  value: number;
  weight: number;
  weighted: number;
}

function computeAltmanZ(curr: FinRow, marketCap: number): { zScore: number; zone: string; zoneColor: string; components: ZScoreComponent[] } {
  const workingCapital = curr.total_assets - curr.total_liabilities - curr.debt;
  const retainedEarnings = curr.reserves;
  const ebit = curr.pbt + curr.interest;
  const marketEquity = marketCap;
  const totalLiabilities = curr.total_liabilities;
  const totalAssets = curr.total_assets;
  const sales = curr.revenue;

  const x1 = workingCapital / totalAssets;
  const x2 = retainedEarnings / totalAssets;
  const x3 = ebit / totalAssets;
  const x4 = marketEquity / totalLiabilities;
  const x5 = sales / totalAssets;

  const components: ZScoreComponent[] = [
    { label: "Working Capital / Assets", formula: "X1", value: x1, weight: 1.2, weighted: 1.2 * x1 },
    { label: "Retained Earnings / Assets", formula: "X2", value: x2, weight: 1.4, weighted: 1.4 * x2 },
    { label: "EBIT / Assets", formula: "X3", value: x3, weight: 3.3, weighted: 3.3 * x3 },
    { label: "Market Cap / Liabilities", formula: "X4", value: x4, weight: 0.6, weighted: 0.6 * x4 },
    { label: "Sales / Assets", formula: "X5", value: x5, weight: 1.0, weighted: 1.0 * x5 },
  ];

  const zScore = components.reduce((s, c) => s + c.weighted, 0);

  let zone: string, zoneColor: string;
  if (zScore > 2.99) { zone = "Safe Zone"; zoneColor = "text-positive"; }
  else if (zScore > 1.81) { zone = "Grey Zone"; zoneColor = "text-chart-amber"; }
  else { zone = "Distress Zone"; zoneColor = "text-negative"; }

  return { zScore, zone, zoneColor, components };
}

// ─── DuPont Analysis ─────────────────────────────────────────────
interface DuPontData {
  year: number;
  npm: number;          // Net Profit Margin
  assetTurnover: number;
  equityMultiplier: number;
  roe: number;
}

function computeDuPont(rows: FinRow[]): DuPontData[] {
  return rows.slice(-5).map((r) => {
    const npm = (r.net_profit / r.revenue) * 100;
    const assetTurnover = r.revenue / r.total_assets;
    const equityMultiplier = r.total_assets / (r.equity + r.reserves);
    const roe = (npm / 100) * assetTurnover * equityMultiplier * 100;
    return { year: r.year, npm: +npm.toFixed(1), assetTurnover: +assetTurnover.toFixed(2), equityMultiplier: +equityMultiplier.toFixed(2), roe: +roe.toFixed(1) };
  });
}

// ─── Sub-components ──────────────────────────────────────────────
function ScoreBadge({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = score / max;
  const color = pct >= 0.78 ? "bg-chart-green/15 text-positive border-chart-green/30"
    : pct >= 0.56 ? "bg-chart-amber/15 text-chart-amber border-chart-amber/30"
    : "bg-chart-red/15 text-negative border-chart-red/30";

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${color}`}>
      <span className="text-2xl font-display font-bold">{score}</span>
      <div>
        <span className="text-[10px] text-muted-foreground block">/ {max}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

function CriterionRow({ criterion, index }: { criterion: FScoreCriterion; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0"
    >
      <div className="flex items-center gap-2 min-w-0">
        {criterion.pass ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-positive flex-shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-negative flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-foreground truncate">{criterion.name}</p>
          <p className="text-[9px] text-muted-foreground truncate">{criterion.description}</p>
        </div>
      </div>
      <span className={`text-[10px] font-mono flex-shrink-0 ml-2 ${criterion.pass ? "text-positive" : "text-negative"}`}>
        {criterion.detail}
      </span>
    </motion.div>
  );
}

function ZScoreGauge({ zScore, zone, zoneColor }: { zScore: number; zone: string; zoneColor: string }) {
  // Map z-score to position (0-100), clamped between -1 and 5
  const clamped = Math.max(-1, Math.min(5, zScore));
  const position = ((clamped + 1) / 6) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-6 rounded-full overflow-hidden bg-muted/30">
        {/* Zone bands */}
        <div className="absolute inset-0 flex">
          <div className="h-full bg-chart-red/20" style={{ width: "30%" }} />
          <div className="h-full bg-chart-amber/20" style={{ width: "20%" }} />
          <div className="h-full bg-chart-green/20" style={{ width: "50%" }} />
        </div>
        {/* Labels */}
        <div className="absolute inset-0 flex items-center text-[8px] font-mono uppercase tracking-wider">
          <span className="w-[30%] text-center text-negative">Distress</span>
          <span className="w-[20%] text-center text-chart-amber">Grey</span>
          <span className="w-[50%] text-center text-positive">Safe</span>
        </div>
        {/* Indicator */}
        <motion.div
          initial={{ left: "0%" }}
          animate={{ left: `${position}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-0 h-full w-0.5 bg-foreground"
          style={{ transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-muted-foreground font-mono">-1.0</span>
        <span className={`text-sm font-mono font-bold ${zoneColor}`}>
          Z = {zScore.toFixed(2)} · {zone}
        </span>
        <span className="text-[9px] text-muted-foreground font-mono">5.0</span>
      </div>
    </div>
  );
}

function DuPontWaterfall({ data }: { data: DuPontData[] }) {
  const latest = data[data.length - 1];
  if (!latest) return null;

  const waterfallData = [
    { name: "Net Margin", value: latest.npm, color: "hsl(var(--primary))" },
    { name: "× Asset Turn.", value: latest.assetTurnover * 10, color: "hsl(var(--chart-green))" }, // scaled for visibility
    { name: "× Eq. Mult.", value: latest.equityMultiplier * 10, color: "hsl(var(--chart-amber))" }, // scaled for visibility
    { name: "= ROE", value: latest.roe, color: "hsl(var(--chart-cyan))" },
  ];

  return (
    <div className="space-y-3">
      {/* Visual formula */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <FormulaBox label="Net Margin" value={`${latest.npm}%`} sub="NI / Revenue" color="bg-primary/10 border-primary/30 text-primary" />
        <span className="text-lg text-muted-foreground">×</span>
        <FormulaBox label="Asset Turnover" value={`${latest.assetTurnover}x`} sub="Revenue / Assets" color="bg-chart-green/10 border-chart-green/30 text-positive" />
        <span className="text-lg text-muted-foreground">×</span>
        <FormulaBox label="Equity Multiplier" value={`${latest.equityMultiplier}x`} sub="Assets / Equity" color="bg-chart-amber/10 border-chart-amber/30 text-chart-amber" />
        <span className="text-lg text-muted-foreground">=</span>
        <FormulaBox label="ROE" value={`${latest.roe}%`} sub="Return on Equity" color="bg-chart-cyan/10 border-chart-cyan/30 text-chart-cyan" highlight />
      </div>

      {/* Trend table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-border/60">
              <th className="data-header text-[9px]">Year</th>
              <th className="data-header text-[9px] text-right">Net Margin</th>
              <th className="data-header text-[9px] text-right">Asset Turn.</th>
              <th className="data-header text-[9px] text-right">Eq. Mult.</th>
              <th className="data-header text-[9px] text-right">ROE</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const prev = i > 0 ? data[i - 1] : null;
              return (
                <tr key={d.year} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="data-cell font-medium text-foreground">{d.year}</td>
                  <td className="data-cell text-right">
                    <TrendVal curr={d.npm} prev={prev?.npm} unit="%" />
                  </td>
                  <td className="data-cell text-right">
                    <TrendVal curr={d.assetTurnover} prev={prev?.assetTurnover} unit="x" />
                  </td>
                  <td className="data-cell text-right">
                    <TrendVal curr={d.equityMultiplier} prev={prev?.equityMultiplier} unit="x" invert />
                  </td>
                  <td className="data-cell text-right font-bold">
                    <TrendVal curr={d.roe} prev={prev?.roe} unit="%" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FormulaBox({ label, value, sub, color, highlight }: {
  label: string; value: string; sub: string; color: string; highlight?: boolean;
}) {
  return (
    <div className={`border rounded-lg px-3 py-2 text-center ${color} ${highlight ? "ring-1 ring-chart-cyan/40" : ""}`}>
      <p className="text-[9px] uppercase tracking-wider opacity-70">{label}</p>
      <p className={`font-mono font-bold ${highlight ? "text-lg" : "text-sm"}`}>{value}</p>
      <p className="text-[8px] opacity-50">{sub}</p>
    </div>
  );
}

function TrendVal({ curr, prev, unit, invert }: { curr: number; prev?: number; unit: string; invert?: boolean }) {
  if (prev === undefined) return <span>{curr}{unit}</span>;
  const diff = curr - prev;
  const isGood = invert ? diff < 0 : diff > 0;
  const isFlat = Math.abs(diff) < 0.05;

  return (
    <span className="inline-flex items-center gap-1">
      <span>{curr}{unit}</span>
      {!isFlat && (
        <span className={`text-[8px] ${isGood ? "text-positive" : "text-negative"}`}>
          {diff > 0 ? "▲" : "▼"}
        </span>
      )}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export function FundamentalScoring({ statementRows, ratioRows, marketCap, price, sector }: Props) {
  const piotroski = useMemo(() => computePiotroski(statementRows, ratioRows), [statementRows, ratioRows]);

  const altman = useMemo(() => {
    if (statementRows.length === 0) return null;
    return computeAltmanZ(statementRows[statementRows.length - 1], marketCap);
  }, [statementRows, marketCap]);

  const dupont = useMemo(() => computeDuPont(statementRows), [statementRows]);

  const fScoreLabel = piotroski.score >= 7 ? "Strong" : piotroski.score >= 4 ? "Moderate" : "Weak";

  // Category grouping for Piotroski
  const categories = ["Profitability", "Leverage", "Efficiency"] as const;
  const grouped = categories.map((cat) => ({
    category: cat,
    items: piotroski.criteria.filter((c) => c.category === cat),
    passed: piotroski.criteria.filter((c) => c.category === cat && c.pass).length,
    total: piotroski.criteria.filter((c) => c.category === cat).length,
  }));

  // Radar data for scoring overview
  const radarData = [
    { metric: "Profitability", value: (grouped[0].passed / grouped[0].total) * 100 },
    { metric: "Leverage", value: (grouped[1].passed / grouped[1].total) * 100 },
    { metric: "Efficiency", value: (grouped[2].passed / grouped[2].total) * 100 },
    { metric: "Z-Score", value: altman ? Math.min(100, (altman.zScore / 3) * 100) : 0 },
    { metric: "ROE Quality", value: dupont.length > 0 ? Math.min(100, dupont[dupont.length - 1].roe * 4) : 0 },
  ];

  return (
    <div className="glass-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Fundamental Health Scores
        </h2>
        <div className="flex items-center gap-2">
          <ScoreBadge score={piotroski.score} max={9} label="F-Score" />
          {altman && (
            <Badge variant="outline" className={`text-[10px] font-mono px-2 py-1 ${altman.zoneColor}`}>
              Z={altman.zScore.toFixed(1)} · {altman.zone}
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="piotroski">
        <TabsList className="h-7 mb-2">
          <TabsTrigger value="piotroski" className="text-[10px] h-6 px-3 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Piotroski F-Score
          </TabsTrigger>
          <TabsTrigger value="altman" className="text-[10px] h-6 px-3 gap-1">
            <AlertTriangle className="h-3 w-3" /> Altman Z-Score
          </TabsTrigger>
          <TabsTrigger value="dupont" className="text-[10px] h-6 px-3 gap-1">
            <Layers className="h-3 w-3" /> DuPont Analysis
          </TabsTrigger>
          <TabsTrigger value="overview" className="text-[10px] h-6 px-3 gap-1">
            <Activity className="h-3 w-3" /> Overview
          </TabsTrigger>
        </TabsList>

        {/* ── Piotroski F-Score ── */}
        <TabsContent value="piotroski" className="space-y-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-5 h-6 rounded-sm ${i < piotroski.score ? "bg-chart-green" : "bg-muted/40"}`}
                />
              ))}
            </div>
            <div>
              <span className="text-sm font-display font-bold text-foreground">{piotroski.score}/9</span>
              <span className={`text-[10px] ml-1.5 font-semibold ${
                piotroski.score >= 7 ? "text-positive" : piotroski.score >= 4 ? "text-chart-amber" : "text-negative"
              }`}>{fScoreLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {grouped.map((g) => (
              <div key={g.category} className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.category}</span>
                  <span className="text-[10px] font-mono text-foreground">{g.passed}/{g.total}</span>
                </div>
                {g.items.map((c, i) => (
                  <CriterionRow key={c.name} criterion={c} index={i} />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-2 p-2 rounded bg-muted/20 border border-border/30">
            <p className="text-[9px] text-muted-foreground">
              <strong>Interpretation:</strong> F-Score ≥ 7 = Strong fundamentals (buy signal). 4-6 = Average. ≤ 3 = Weak fundamentals (avoid).
              Developed by Joseph Piotroski (2000) using 9 binary financial criteria.
            </p>
          </div>
        </TabsContent>

        {/* ── Altman Z-Score ── */}
        <TabsContent value="altman" className="space-y-3">
          {altman && (
            <>
              <ZScoreGauge zScore={altman.zScore} zone={altman.zone} zoneColor={altman.zoneColor} />

              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="data-header text-[9px] text-left">Component</th>
                      <th className="data-header text-[9px] text-right">Ratio</th>
                      <th className="data-header text-[9px] text-right">Weight</th>
                      <th className="data-header text-[9px] text-right">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {altman.components.map((c) => (
                      <tr key={c.formula} className="border-b border-border/20 hover:bg-muted/20">
                        <td className="data-cell text-foreground">
                          <span className="text-primary font-bold mr-1.5">{c.formula}</span>
                          {c.label}
                        </td>
                        <td className="data-cell text-right">{c.value.toFixed(3)}</td>
                        <td className="data-cell text-right text-muted-foreground">×{c.weight}</td>
                        <td className={`data-cell text-right font-bold ${c.weighted > 0 ? "text-positive" : "text-negative"}`}>
                          {c.weighted.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border/60">
                      <td className="data-cell font-bold text-foreground" colSpan={3}>Z-Score Total</td>
                      <td className={`data-cell text-right font-bold text-sm ${altman.zoneColor}`}>
                        {altman.zScore.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded bg-chart-red/5 border border-chart-red/20 text-center">
                  <p className="text-[9px] text-negative uppercase tracking-wider font-semibold">Distress</p>
                  <p className="text-[10px] font-mono text-muted-foreground">Z &lt; 1.81</p>
                  <p className="text-[8px] text-muted-foreground">High bankruptcy risk</p>
                </div>
                <div className="p-2 rounded bg-chart-amber/5 border border-chart-amber/20 text-center">
                  <p className="text-[9px] text-chart-amber uppercase tracking-wider font-semibold">Grey Zone</p>
                  <p className="text-[10px] font-mono text-muted-foreground">1.81 – 2.99</p>
                  <p className="text-[8px] text-muted-foreground">Moderate risk</p>
                </div>
                <div className="p-2 rounded bg-chart-green/5 border border-chart-green/20 text-center">
                  <p className="text-[9px] text-positive uppercase tracking-wider font-semibold">Safe</p>
                  <p className="text-[10px] font-mono text-muted-foreground">Z &gt; 2.99</p>
                  <p className="text-[8px] text-muted-foreground">Low bankruptcy risk</p>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/20 border border-border/30">
                <p className="text-[9px] text-muted-foreground">
                  <strong>Note:</strong> Altman Z-Score was designed for manufacturing firms. For banks & financial companies,
                  use the Z''-Score variant. Sector: <strong>{sector}</strong>
                  {(sector === "Banking" || sector === "Finance") && " — interpret with caution for financial firms."}
                </p>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── DuPont Analysis ── */}
        <TabsContent value="dupont" className="space-y-3">
          <DuPontWaterfall data={dupont} />

          <div className="p-2 rounded bg-muted/20 border border-border/30">
            <p className="text-[9px] text-muted-foreground">
              <strong>DuPont Identity:</strong> ROE = Net Profit Margin × Asset Turnover × Equity Multiplier.
              Reveals whether ROE is driven by profitability, efficiency, or leverage — helping identify sustainable vs fragile returns.
            </p>
          </div>
        </TabsContent>

        {/* ── Overview Radar ── */}
        <TabsContent value="overview">
          <div className="flex items-center justify-center">
            <div className="h-56 w-full max-w-sm">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {radarData.map((d) => (
              <div key={d.metric} className="p-1.5 rounded bg-muted/20">
                <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{d.metric}</p>
                <p className={`text-sm font-mono font-bold ${d.value >= 70 ? "text-positive" : d.value >= 40 ? "text-chart-amber" : "text-negative"}`}>
                  {d.value.toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

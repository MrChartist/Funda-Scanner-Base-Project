import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Plus, Trash2, AlertTriangle, CheckCircle2, TrendingUp,
  TrendingDown, PieChart, Activity, ArrowUpRight, ArrowDownRight,
  Shield, Edit2, X, Save,
} from "lucide-react";
import {
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageTransition } from "@/components/PageTransition";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";

// ─── Types ───────────────────────────────────────────────────────
interface Holding {
  symbol: string;
  qty: number;
  avgCost: number;
  buyDate: string; // ISO
}

interface HoldingWithFundamentals extends Holding {
  name: string;
  sector: string;
  cmp: number;
  changePct: number;
  roce: number;
  roe: number;
  de: number;
  npm: number;
  pe: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  healthScore: number;
  alerts: string[];
}

// ─── XIRR Calculation ────────────────────────────────────────────
function xirr(cashflows: { amount: number; date: Date }[], guess = 0.1): number {
  const maxIter = 100;
  const tol = 1e-7;
  let rate = guess;
  const d0 = cashflows[0].date.getTime();

  for (let i = 0; i < maxIter; i++) {
    let f = 0, df = 0;
    for (const cf of cashflows) {
      const years = (cf.date.getTime() - d0) / (365.25 * 86400000);
      const pv = cf.amount / Math.pow(1 + rate, years);
      f += pv;
      df -= years * cf.amount / Math.pow(1 + rate, years + 1);
    }
    if (Math.abs(df) < 1e-14) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
  }
  return rate;
}

// ─── Health scoring ──────────────────────────────────────────────
function computeHealth(h: Omit<HoldingWithFundamentals, "healthScore" | "alerts">): { score: number; alerts: string[] } {
  const alerts: string[] = [];
  let score = 0;
  if (h.roce >= 15) score += 2; else if (h.roce >= 10) score += 1; else alerts.push("ROCE below 10%");
  if (h.roe >= 15) score += 2; else if (h.roe >= 10) score += 1; else alerts.push("ROE below 10%");
  if (h.de <= 0.5) score += 2; else if (h.de <= 1) score += 1; else alerts.push("High Debt/Equity");
  if (h.npm >= 12) score += 2; else if (h.npm >= 5) score += 1; else alerts.push("Low net margin");
  if (h.pe <= 25) score += 1; else if (h.pe > 40) alerts.push("High PE valuation");
  if (h.pnlPct < -15) alerts.push("Significant loss (>15%)");
  return { score: Math.min(score, 9), alerts };
}

const STORAGE_KEY = "funda-portfolio";

function loadHoldings(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveHoldings(h: Holding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

const SECTOR_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-green))", "hsl(var(--chart-amber))",
  "hsl(var(--chart-red))", "hsl(var(--chart-cyan))", "hsl(var(--chart-blue))",
  "hsl(142, 50%, 60%)", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)",
  "hsl(200, 70%, 50%)", "hsl(350, 65%, 55%)",
];

// ─── Component ───────────────────────────────────────────────────
export default function Portfolio() {
  const [holdings, setHoldings] = useState<Holding[]>(loadHoldings);
  const [showAdd, setShowAdd] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  // Add form state
  const [addSymbol, setAddSymbol] = useState("");
  const [addQty, setAddQty] = useState("");
  const [addCost, setAddCost] = useState("");
  const [addDate, setAddDate] = useState(new Date().toISOString().split("T")[0]);

  const persist = useCallback((h: Holding[]) => {
    setHoldings(h);
    saveHoldings(h);
  }, []);

  const addHolding = useCallback(() => {
    if (!addSymbol || !addQty || !addCost) return;
    const sym = addSymbol.toUpperCase();
    if (!MOCK_COMPANIES.find((c) => c.symbol === sym)) return;
    persist([...holdings, { symbol: sym, qty: Number(addQty), avgCost: Number(addCost), buyDate: addDate }]);
    setAddSymbol(""); setAddQty(""); setAddCost(""); setShowAdd(false);
  }, [addSymbol, addQty, addCost, addDate, holdings, persist]);

  const removeHolding = useCallback((idx: number) => {
    persist(holdings.filter((_, i) => i !== idx));
  }, [holdings, persist]);

  // Enrich holdings with fundamentals
  const enriched = useMemo<HoldingWithFundamentals[]>(() => {
    return holdings.map((h) => {
      const data = getMockCompanyIntelligence(h.symbol);
      const c = data.company;
      const investedValue = h.qty * h.avgCost;
      const currentValue = h.qty * c.price;
      const pnl = currentValue - investedValue;
      const pnlPct = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
      const partial = {
        ...h,
        name: c.name,
        sector: c.sector,
        cmp: c.price,
        changePct: c.change_pct,
        roce: Number(c.roce),
        roe: Number(c.roe),
        de: Number(c.de),
        npm: Number(c.npm),
        pe: Number(c.pe),
        investedValue,
        currentValue,
        pnl,
        pnlPct,
        healthScore: 0,
        alerts: [] as string[],
      };
      const { score, alerts } = computeHealth(partial);
      return { ...partial, healthScore: score, alerts };
    });
  }, [holdings]);

  // Portfolio totals
  const totals = useMemo(() => {
    const invested = enriched.reduce((s, h) => s + h.investedValue, 0);
    const current = enriched.reduce((s, h) => s + h.currentValue, 0);
    const pnl = current - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    // XIRR
    let xirrVal = 0;
    if (enriched.length > 0) {
      try {
        const cfs = enriched.map((h) => ({ amount: -(h.qty * h.avgCost), date: new Date(h.buyDate) }));
        cfs.push({ amount: current, date: new Date() });
        xirrVal = xirr(cfs) * 100;
      } catch { xirrVal = 0; }
    }

    // Sector allocation
    const sectorMap = new Map<string, number>();
    enriched.forEach((h) => sectorMap.set(h.sector, (sectorMap.get(h.sector) || 0) + h.currentValue));
    const sectors = Array.from(sectorMap.entries()).map(([name, value]) => ({
      name, value, pct: current > 0 ? +(value / current * 100).toFixed(1) : 0,
    })).sort((a, b) => b.value - a.value);

    // Avg health
    const avgHealth = enriched.length > 0 ? +(enriched.reduce((s, h) => s + h.healthScore, 0) / enriched.length).toFixed(1) : 0;
    const alertCount = enriched.reduce((s, h) => s + h.alerts.length, 0);

    return { invested, current, pnl, pnlPct, xirrVal, sectors, avgHealth, alertCount };
  }, [enriched]);

  const isPositive = totals.pnl >= 0;
  const fmt = (v: number) => `₹${(v / 100000).toFixed(2)}L`;

  // Radar data for portfolio health
  const radarData = useMemo(() => {
    if (enriched.length === 0) return [];
    const avg = (key: keyof HoldingWithFundamentals) => +(enriched.reduce((s, h) => s + Number(h[key]), 0) / enriched.length).toFixed(1);
    return [
      { metric: "ROCE", value: Math.min(avg("roce"), 30), max: 30 },
      { metric: "ROE", value: Math.min(avg("roe"), 25), max: 25 },
      { metric: "NPM", value: Math.min(avg("npm"), 25), max: 25 },
      { metric: "Low D/E", value: Math.max(10 - avg("de") * 10, 0), max: 10 },
      { metric: "Health", value: totals.avgHealth, max: 9 },
    ];
  }, [enriched, totals.avgHealth]);

  // ─── Empty state ───────────────────────────────────────────────
  if (holdings.length === 0 && !showAdd) {
    return (
      <PageTransition>
        <div className="container max-w-4xl py-16 text-center">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-2">Portfolio Tracker</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Track your holdings and monitor fundamental health of your portfolio companies.
            </p>
            <Button onClick={() => setShowAdd(true)} size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add First Holding
            </Button>
            {/* Pre-populate demo */}
            <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => {
              const demo: Holding[] = [
                { symbol: "RELIANCE", qty: 10, avgCost: 2500, buyDate: "2024-01-15" },
                { symbol: "TCS", qty: 5, avgCost: 3800, buyDate: "2024-03-10" },
                { symbol: "HDFCBANK", qty: 20, avgCost: 1600, buyDate: "2023-11-20" },
                { symbol: "INFY", qty: 15, avgCost: 1700, buyDate: "2024-06-05" },
                { symbol: "ITC", qty: 50, avgCost: 420, buyDate: "2023-08-12" },
                { symbol: "SUNPHARMA", qty: 8, avgCost: 1400, buyDate: "2024-02-28" },
              ];
              persist(demo);
            }}>
              Load Demo Portfolio
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="container max-w-7xl py-4 space-y-4">
        {/* ─── Header KPIs ───────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-primary" />
            Portfolio Tracker
          </h1>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: "Invested", value: fmt(totals.invested), icon: Briefcase },
            { label: "Current", value: fmt(totals.current), icon: Activity },
            { label: "P&L", value: `${isPositive ? "+" : ""}${fmt(totals.pnl)} (${totals.pnlPct.toFixed(1)}%)`, icon: isPositive ? TrendingUp : TrendingDown, color: isPositive ? "text-positive" : "text-negative" },
            { label: "XIRR", value: `${totals.xirrVal.toFixed(1)}%`, icon: ArrowUpRight, color: totals.xirrVal >= 0 ? "text-positive" : "text-negative" },
            { label: "Health", value: `${totals.avgHealth}/9`, icon: Shield, color: totals.avgHealth >= 6 ? "text-positive" : totals.avgHealth >= 4 ? "text-chart-amber" : "text-negative" },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card p-3 text-center">
              <kpi.icon className={`h-3.5 w-3.5 mx-auto mb-1 ${kpi.color || "text-muted-foreground"}`} />
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-sm font-mono font-bold ${kpi.color || "text-foreground"}`}>{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Alerts Banner */}
        {totals.alertCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-2.5 rounded border border-chart-amber/30 bg-chart-amber/5 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-chart-amber flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-foreground">{totals.alertCount} fundamental alert{totals.alertCount > 1 ? "s" : ""} detected</p>
              <p className="text-[10px] text-muted-foreground">
                {enriched.filter((h) => h.alerts.length > 0).map((h) => h.symbol).join(", ")} need attention
              </p>
            </div>
          </motion.div>
        )}

        {/* Add Holding Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="glass-card p-3 overflow-hidden">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-muted-foreground uppercase">Symbol</label>
                  <Select value={addSymbol} onValueChange={setAddSymbol}>
                    <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {MOCK_COMPANIES.map((c) => (
                        <SelectItem key={c.symbol} value={c.symbol} className="text-xs">{c.symbol} — {c.name.split(" ").slice(0, 2).join(" ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-muted-foreground uppercase">Qty</label>
                  <Input value={addQty} onChange={(e) => setAddQty(e.target.value)} type="number" className="h-8 w-20 text-xs" placeholder="10" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-muted-foreground uppercase">Avg Cost (₹)</label>
                  <Input value={addCost} onChange={(e) => setAddCost(e.target.value)} type="number" className="h-8 w-24 text-xs" placeholder="1500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-muted-foreground uppercase">Buy Date</label>
                  <Input value={addDate} onChange={(e) => setAddDate(e.target.value)} type="date" className="h-8 w-36 text-xs" />
                </div>
                <Button size="sm" className="h-8 text-xs gap-1" onClick={addHolding}>
                  <Save className="h-3 w-3" /> Add
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAdd(false)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs defaultValue="holdings">
          <TabsList className="h-7 mb-2">
            <TabsTrigger value="holdings" className="text-[10px] h-6 px-3 gap-1">
              <Activity className="h-3 w-3" /> Holdings
            </TabsTrigger>
            <TabsTrigger value="health" className="text-[10px] h-6 px-3 gap-1">
              <Shield className="h-3 w-3" /> Health Monitor
            </TabsTrigger>
            <TabsTrigger value="allocation" className="text-[10px] h-6 px-3 gap-1">
              <PieChart className="h-3 w-3" /> Allocation
            </TabsTrigger>
          </TabsList>

          {/* ── Holdings Table ── */}
          <TabsContent value="holdings">
            <div className="glass-card overflow-x-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Company", "Qty", "Avg Cost", "CMP", "Invested", "Current", "P&L", "P&L%", "ROCE", "ROE", "D/E", "Health", ""].map((h) => (
                      <th key={h} className="data-header text-[9px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((h, i) => (
                    <motion.tr key={`${h.symbol}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-border/20 hover:bg-accent/20 transition-colors">
                      <td className="data-cell">
                        <Link to={`/company/${h.symbol}`} className="text-primary hover:underline font-medium">{h.symbol}</Link>
                        <span className="block text-[8px] text-muted-foreground">{h.sector}</span>
                      </td>
                      <td className="data-cell font-mono">{h.qty}</td>
                      <td className="data-cell font-mono">₹{h.avgCost.toFixed(0)}</td>
                      <td className="data-cell font-mono">₹{h.cmp.toFixed(0)}</td>
                      <td className="data-cell font-mono">{fmt(h.investedValue)}</td>
                      <td className="data-cell font-mono">{fmt(h.currentValue)}</td>
                      <td className={`data-cell font-mono ${h.pnl >= 0 ? "text-positive" : "text-negative"}`}>
                        {h.pnl >= 0 ? "+" : ""}{fmt(h.pnl)}
                      </td>
                      <td className={`data-cell font-mono ${h.pnlPct >= 0 ? "text-positive" : "text-negative"}`}>
                        {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%
                      </td>
                      <td className={`data-cell font-mono ${h.roce >= 15 ? "text-positive" : h.roce < 10 ? "text-negative" : ""}`}>{h.roce}%</td>
                      <td className={`data-cell font-mono ${h.roe >= 15 ? "text-positive" : h.roe < 10 ? "text-negative" : ""}`}>{h.roe}%</td>
                      <td className={`data-cell font-mono ${h.de <= 0.5 ? "text-positive" : h.de > 1 ? "text-negative" : ""}`}>{h.de}</td>
                      <td className="data-cell">
                        <Badge className={`text-[9px] px-1.5 py-0 font-mono ${
                          h.healthScore >= 7 ? "bg-chart-green/15 text-positive border-chart-green/30"
                          : h.healthScore >= 4 ? "bg-chart-amber/15 text-chart-amber border-chart-amber/30"
                          : "bg-chart-red/15 text-negative border-chart-red/30"
                        }`}>{h.healthScore}/9</Badge>
                      </td>
                      <td className="data-cell">
                        <button onClick={() => removeHolding(i)} className="text-muted-foreground hover:text-negative transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── Health Monitor ── */}
          <TabsContent value="health">
            <div className="grid md:grid-cols-2 gap-3">
              {/* Radar */}
              <div className="glass-card p-4">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary" /> Portfolio Health Radar
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Alerts list */}
              <div className="glass-card p-4">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-chart-amber" /> Fundamental Alerts
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
                  {enriched.filter((h) => h.alerts.length > 0).length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircle2 className="h-6 w-6 text-positive mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">All holdings are fundamentally healthy!</p>
                    </div>
                  ) : (
                    enriched.filter((h) => h.alerts.length > 0).map((h) => (
                      <div key={h.symbol} className="p-2 rounded border border-border/30 bg-muted/10">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Link to={`/company/${h.symbol}`} className="text-xs font-medium text-primary hover:underline">{h.symbol}</Link>
                          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${
                            h.healthScore >= 4 ? "text-chart-amber" : "text-negative"
                          }`}>{h.healthScore}/9</Badge>
                        </div>
                        {h.alerts.map((a) => (
                          <div key={a} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <AlertTriangle className="h-2.5 w-2.5 text-chart-amber flex-shrink-0" />
                            {a}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Bar chart: ROCE comparison */}
              <div className="glass-card p-4 md:col-span-2">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">
                  ROCE / ROE / NPM Comparison
                </h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enriched.map((h) => ({ name: h.symbol, ROCE: h.roce, ROE: h.roe, NPM: h.npm }))}
                      margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} />
                      <Bar dataKey="ROCE" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} opacity={0.8} />
                      <Bar dataKey="ROE" fill="hsl(var(--chart-green))" radius={[2, 2, 0, 0]} opacity={0.8} />
                      <Bar dataKey="NPM" fill="hsl(var(--chart-cyan))" radius={[2, 2, 0, 0]} opacity={0.8} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Sector Allocation ── */}
          <TabsContent value="allocation">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="glass-card p-4">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <PieChart className="h-3 w-3 text-primary" /> Sector Allocation
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <RPieChart>
                      <Pie data={totals.sectors} dataKey="value" nameKey="name" cx="50%" cy="50%"
                        innerRadius={50} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                        {totals.sectors.map((_, i) => (
                          <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 10, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                        formatter={(v: number) => fmt(v)} />
                    </RPieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-card p-4">
                <h3 className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">
                  Allocation Breakdown
                </h3>
                <div className="space-y-2">
                  {totals.sectors.map((s, i) => (
                    <motion.div key={s.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm flex-shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      <span className="text-xs text-foreground flex-1">{s.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{fmt(s.value)}</span>
                      <span className="text-xs font-mono font-medium text-foreground w-12 text-right">{s.pct}%</span>
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ delay: i * 0.05 + 0.2 }}
                          className="h-full rounded-full" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Concentration warning */}
                {totals.sectors.length > 0 && totals.sectors[0].pct > 40 && (
                  <div className="mt-3 p-2 rounded border border-chart-amber/30 bg-chart-amber/5 flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-chart-amber flex-shrink-0" />
                    <p className="text-[9px] text-muted-foreground">
                      <strong className="text-foreground">{totals.sectors[0].name}</strong> is {totals.sectors[0].pct}% — consider diversifying.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
}

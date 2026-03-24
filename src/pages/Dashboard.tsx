import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ArrowUpRight, Clock, Zap, BarChart3,
  Newspaper, Calendar, Settings2, Search, Activity, ChevronRight,
  Shield, Target, Award, AlertTriangle, ArrowDownRight, Sparkles,
  BookOpen, Briefcase,
} from "lucide-react";
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, AreaChart, Area, RadarChart, PolarGrid,
  PolarAngleAxis, Radar, Cell,
} from "recharts";
import { MOCK_COMPANIES, SECTOR_DATA, getMockCompanyIntelligence } from "@/lib/mock-data";
import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardLayout, DashboardLayoutEditor } from "@/components/DashboardLayout";
import { useLivePrices } from "@/hooks/use-live-prices";

// ─── Helpers ─────────────────────────────────────────────────────
function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  return `₹${(val / 1000).toFixed(0)}K Cr`;
}

function qualityColor(val: number, good: number, bad: number, invert = false) {
  if (invert) return val <= good ? "text-positive" : val >= bad ? "text-negative" : "text-foreground";
  return val >= good ? "text-positive" : val <= bad ? "text-negative" : "text-foreground";
}

// ─── Market Ticker ───────────────────────────────────────────────
function MarketTicker() {
  const indices = [
    { name: "NIFTY 50", value: 24580.25, change: 142.30, changePct: 0.58, trend: [24200, 24350, 24180, 24420, 24580] },
    { name: "SENSEX", value: 80945.60, change: 468.75, changePct: 0.58, trend: [80100, 80400, 80200, 80650, 80945] },
    { name: "NIFTY BANK", value: 52340.10, change: -185.40, changePct: -0.35, trend: [52600, 52450, 52520, 52380, 52340] },
    { name: "NIFTY IT", value: 38920.45, change: -210.30, changePct: -0.54, trend: [39200, 39100, 39050, 38980, 38920] },
    { name: "NIFTY PHARMA", value: 18450.80, change: 95.20, changePct: 0.52, trend: [18300, 18320, 18380, 18420, 18450] },
    { name: "INDIA VIX", value: 13.25, change: -0.45, changePct: -3.28, trend: [13.8, 13.6, 13.5, 13.4, 13.25] },
  ];

  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center gap-6 px-4 py-1.5 overflow-x-auto scrollbar-thin">
        {indices.map((idx) => {
          const isUp = idx.change >= 0;
          return (
            <div key={idx.name} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <div>
                <span className="text-muted-foreground block leading-none mb-0.5" style={{ fontSize: '9px', fontWeight: 500 }}>{idx.name}</span>
                <span className="font-mono font-bold text-foreground" style={{ fontSize: '11px' }}>{idx.value.toLocaleString()}</span>
              </div>
              <div className="w-10 h-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={idx.trend.map((v, i) => ({ v, i }))}>
                    <defs>
                      <linearGradient id={`tick-${idx.name}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} strokeWidth={1}
                      fill={`url(#tick-${idx.name})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <span className={`font-mono font-semibold flex items-center gap-0.5 ${isUp ? "text-positive" : "text-negative"}`} style={{ fontSize: '10px' }}>
                {isUp ? "+" : ""}{idx.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Market Overview Hero ────────────────────────────────────────
function MarketOverviewHero() {
  const navigate = useNavigate();
  const totalMarketCap = MOCK_COMPANIES.reduce((s, c) => s + c.market_cap, 0);
  const advancers = MOCK_COMPANIES.filter(c => c.change_pct > 0).length;
  const decliners = MOCK_COMPANIES.filter(c => c.change_pct < 0).length;

  // Compute avg fundamental metrics across universe
  const fundamentalStats = useMemo(() => {
    let totalROCE = 0, totalROE = 0, totalDE = 0;
    MOCK_COMPANIES.forEach((c) => {
      const data = getMockCompanyIntelligence(c.symbol);
      totalROCE += Number(data.company.roce);
      totalROE += Number(data.company.roe);
      totalDE += Number(data.company.de);
    });
    const n = MOCK_COMPANIES.length;
    return {
      avgROCE: +(totalROCE / n).toFixed(1),
      avgROE: +(totalROE / n).toFixed(1),
      avgDE: +(totalDE / n).toFixed(2),
    };
  }, []);

  const stats = [
    { label: "MARKET CAP", value: formatMarketCap(totalMarketCap), sub: `${MOCK_COMPANIES.length} companies`, icon: Activity },
    { label: "BREADTH", value: `${advancers}A : ${decliners}D`, sub: advancers > decliners ? "Bullish" : "Bearish", positive: advancers > decliners, icon: BarChart3 },
    { label: "AVG ROCE", value: `${fundamentalStats.avgROCE}%`, sub: "Universe avg", positive: fundamentalStats.avgROCE > 15, icon: Target },
    { label: "AVG ROE", value: `${fundamentalStats.avgROE}%`, sub: "Universe avg", positive: fundamentalStats.avgROE > 15, icon: Award },
    { label: "AVG D/E", value: `${fundamentalStats.avgDE}`, sub: fundamentalStats.avgDE < 0.5 ? "Low leverage" : "Moderate", positive: fundamentalStats.avgDE < 0.5, icon: Shield },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <BookOpen className="h-3 w-3 text-primary" />
            <span className="text-muted-foreground uppercase tracking-widest font-semibold" style={{ fontSize: '9px' }}>Fundamental Dashboard</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </h1>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[280px]">
          <SearchBar variant="hero" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="glass-card p-3">
            <div className="flex items-center gap-1 mb-1">
              <stat.icon className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground uppercase tracking-wider font-semibold" style={{ fontSize: '8px' }}>{stat.label}</span>
            </div>
            <span className={`text-base font-mono font-bold block leading-tight ${stat.positive !== undefined ? (stat.positive ? "text-positive" : "text-negative") : "text-foreground"}`}>
              {stat.value}
            </span>
            <span className="text-muted-foreground" style={{ fontSize: '9px' }}>{stat.sub}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { label: "Screener", to: "/screener", icon: BarChart3 },
          { label: "Compare", to: "/compare", icon: ChevronRight },
          { label: "DCF Calc", to: "/dcf", icon: TrendingUp },
          { label: "Portfolio", to: "/portfolio", icon: Briefcase },
        ].map((action) => (
          <button key={action.label} onClick={() => navigate(action.to)}
            className="flex items-center gap-1 rounded border border-border bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all" style={{ fontSize: '10px', fontWeight: 500 }}>
            <action.icon className="h-2.5 w-2.5" />
            {action.label}
          </button>
        ))}
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex items-center gap-1 rounded border border-border bg-secondary px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-all" style={{ fontSize: '10px', fontWeight: 500 }}>
          <Search className="h-2.5 w-2.5" />
          Search
          <span className="kbd ml-0.5">⌘K</span>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Fundamental Movers ──────────────────────────────────────────
function FundamentalMovers() {
  const navigate = useNavigate();

  const movers = useMemo(() => {
    return MOCK_COMPANIES.map((c) => {
      const data = getMockCompanyIntelligence(c.symbol);
      const ratios = data.intelligence.ratio_rows;
      const latest = ratios[ratios.length - 1];
      const prev = ratios.length > 1 ? ratios[ratios.length - 2] : latest;
      return {
        symbol: c.symbol,
        name: c.name.split(" ").slice(0, 2).join(" "),
        sector: c.sector,
        price: data.company.price,
        changePct: c.change_pct,
        roce: latest.roce,
        roceChange: +(latest.roce - prev.roce).toFixed(1),
        roe: latest.roe,
        roeChange: +(latest.roe - prev.roe).toFixed(1),
        npm: latest.npm,
        npmChange: +(latest.npm - prev.npm).toFixed(1),
        de: Number(data.company.de),
        pe: Number(data.company.pe),
      };
    }).sort((a, b) => Math.abs(b.roceChange) - Math.abs(a.roceChange));
  }, []);

  const improvers = movers.filter((m) => m.roceChange > 0).slice(0, 5);
  const deteriorators = movers.filter((m) => m.roceChange < 0).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Fundamental Movers
          </h2>
          <span className="text-muted-foreground font-mono" style={{ fontSize: '9px' }}>YoY ROCE change</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Improving */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-4 w-4 rounded bg-chart-green/10 flex items-center justify-center">
                <ArrowUpRight className="h-2.5 w-2.5 text-positive" />
              </div>
              <span className="text-foreground font-semibold uppercase tracking-wider" style={{ fontSize: '10px' }}>Improving Fundamentals</span>
            </div>
            <div className="space-y-0.5">
              {improvers.map((m, i) => (
                <motion.button key={m.symbol} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/company/${m.symbol}`)}
                  className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-accent/50 transition-all group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontSize: '11px' }}>{m.symbol}</span>
                    <span className="text-muted-foreground truncate hidden lg:inline" style={{ fontSize: '10px' }}>{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`font-mono font-bold ${qualityColor(m.roce, 15, 10)}`} style={{ fontSize: '11px' }}>{m.roce}%</span>
                      <span className="text-muted-foreground block" style={{ fontSize: '8px' }}>ROCE</span>
                    </div>
                    <Badge className="bg-chart-green/10 text-positive border-chart-green/20 text-[9px] font-mono px-1.5">
                      +{m.roceChange}%
                    </Badge>
                    <div className="text-right hidden sm:block">
                      <span className={`font-mono ${qualityColor(m.de, 0.5, 1, true)}`} style={{ fontSize: '10px' }}>{m.de}</span>
                      <span className="text-muted-foreground block" style={{ fontSize: '8px' }}>D/E</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Deteriorating */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-4 w-4 rounded bg-chart-red/10 flex items-center justify-center">
                <ArrowDownRight className="h-2.5 w-2.5 text-negative" />
              </div>
              <span className="text-foreground font-semibold uppercase tracking-wider" style={{ fontSize: '10px' }}>Deteriorating Fundamentals</span>
            </div>
            <div className="space-y-0.5">
              {deteriorators.map((m, i) => (
                <motion.button key={m.symbol} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/company/${m.symbol}`)}
                  className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-accent/50 transition-all group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontSize: '11px' }}>{m.symbol}</span>
                    <span className="text-muted-foreground truncate hidden lg:inline" style={{ fontSize: '10px' }}>{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`font-mono font-bold ${qualityColor(m.roce, 15, 10)}`} style={{ fontSize: '11px' }}>{m.roce}%</span>
                      <span className="text-muted-foreground block" style={{ fontSize: '8px' }}>ROCE</span>
                    </div>
                    <Badge className="bg-chart-red/10 text-negative border-chart-red/20 text-[9px] font-mono px-1.5">
                      {m.roceChange}%
                    </Badge>
                    <div className="text-right hidden sm:block">
                      <span className={`font-mono ${qualityColor(m.de, 0.5, 1, true)}`} style={{ fontSize: '10px' }}>{m.de}</span>
                      <span className="text-muted-foreground block" style={{ fontSize: '8px' }}>D/E</span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Value & Quality Picks ───────────────────────────────────────
function ValueQualityPicks() {
  const navigate = useNavigate();

  const picks = useMemo(() => {
    return MOCK_COMPANIES.map((c) => {
      const data = getMockCompanyIntelligence(c.symbol);
      return {
        symbol: c.symbol,
        name: c.name.split(" ").slice(0, 2).join(" "),
        sector: c.sector,
        price: data.company.price,
        pe: Number(data.company.pe),
        pb: Number(data.company.pb),
        roce: Number(data.company.roce),
        roe: Number(data.company.roe),
        de: Number(data.company.de),
        npm: Number(data.company.npm),
        divYield: Number(data.company.dividend_yield),
      };
    });
  }, []);

  // Quality: High ROCE, high ROE, low D/E
  const quality = [...picks]
    .filter((p) => p.roce > 15 && p.roe > 12 && p.de < 0.5)
    .sort((a, b) => b.roce - a.roce)
    .slice(0, 5);

  // Value: Low PE, decent ROCE
  const value = [...picks]
    .filter((p) => p.pe < 25 && p.roce > 10)
    .sort((a, b) => a.pe - b.pe)
    .slice(0, 5);

  const renderList = (items: typeof picks, highlight: "quality" | "value") => (
    <div className="space-y-0.5">
      {items.map((p, i) => (
        <motion.button key={p.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: i * 0.04 }}
          onClick={() => navigate(`/company/${p.symbol}`)}
          className="flex w-full items-center justify-between rounded px-2 py-2 hover:bg-accent/50 transition-all group">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontSize: '11px' }}>{p.symbol}</span>
            <Badge variant="outline" className="text-[8px] px-1 py-0 text-muted-foreground">{p.sector}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {highlight === "quality" ? (
              <>
                <span className={`font-mono ${qualityColor(p.roce, 15, 10)}`} style={{ fontSize: '10px' }}>ROCE {p.roce}%</span>
                <span className={`font-mono ${qualityColor(p.de, 0.5, 1, true)}`} style={{ fontSize: '10px' }}>D/E {p.de}</span>
              </>
            ) : (
              <>
                <span className="font-mono text-foreground" style={{ fontSize: '10px' }}>PE {p.pe.toFixed(1)}</span>
                <span className={`font-mono ${qualityColor(p.roce, 15, 10)}`} style={{ fontSize: '10px' }}>ROCE {p.roce}%</span>
              </>
            )}
          </div>
        </motion.button>
      ))}
      {items.length === 0 && (
        <p className="text-center text-muted-foreground py-4" style={{ fontSize: '10px' }}>No matches in current universe</p>
      )}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
      className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="glass-card p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
            <Award className="h-2.5 w-2.5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground uppercase tracking-wider" style={{ fontSize: '10px' }}>Quality Compounders</h3>
          <span className="text-muted-foreground ml-auto" style={{ fontSize: '8px' }}>ROCE&gt;15 · ROE&gt;12 · D/E&lt;0.5</span>
        </div>
        {renderList(quality, "quality")}
      </div>
      <div className="glass-card p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="h-4 w-4 rounded bg-chart-green/10 flex items-center justify-center">
            <Target className="h-2.5 w-2.5 text-positive" />
          </div>
          <h3 className="font-semibold text-foreground uppercase tracking-wider" style={{ fontSize: '10px' }}>Value Picks</h3>
          <span className="text-muted-foreground ml-auto" style={{ fontSize: '8px' }}>PE&lt;25 · ROCE&gt;10</span>
        </div>
        {renderList(value, "value")}
      </div>
    </motion.div>
  );
}

// ─── Sector Heatmap (Fundamental) ────────────────────────────────
function SectorHeatmap() {
  const navigate = useNavigate();
  const total = SECTOR_DATA.reduce((s, d) => s + d.marketCap, 0);
  const sorted = [...SECTOR_DATA].sort((a, b) => b.marketCap - a.marketCap);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 min-h-[180px]">
      {sorted.map((sector, idx) => {
        const pct = (sector.marketCap / total) * 100;
        const isPositive = sector.change >= 0;
        const size = pct > 20 ? "col-span-2 row-span-2" : pct > 10 ? "col-span-2" : "";
        return (
          <motion.div key={sector.name} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.02 }}
            className={`relative flex flex-col items-center justify-center rounded p-2 cursor-pointer 
              transition-all duration-150 hover:brightness-95 dark:hover:brightness-110 ${size} ${
              isPositive ? "bg-chart-green/8 border border-chart-green/15" : "bg-chart-red/8 border border-chart-red/15"
            }`}
            onClick={() => navigate(`/screener?sector=${sector.name}`)}>
            <span className="font-semibold text-foreground" style={{ fontSize: '10px' }}>{sector.name}</span>
            <span className={`font-mono font-bold ${isPositive ? "text-positive" : "text-negative"}`} style={{ fontSize: '13px' }}>
              {isPositive ? "+" : ""}{sector.change.toFixed(2)}%
            </span>
            <span className="text-muted-foreground font-mono" style={{ fontSize: '9px' }}>{formatMarketCap(sector.marketCap)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── FII/DII ─────────────────────────────────────────────────────
function FIIDIITracker() {
  const flows = [
    { date: "Mar 20", fii: -1250, dii: 1480 },
    { date: "Mar 19", fii: -890, dii: 1120 },
    { date: "Mar 18", fii: 450, dii: 680 },
    { date: "Mar 17", fii: -2100, dii: 1950 },
    { date: "Mar 14", fii: -1800, dii: 2100 },
    { date: "Mar 13", fii: 320, dii: 890 },
    { date: "Mar 12", fii: -950, dii: 1340 },
  ];

  return (
    <div className="glass-card p-3">
      <h3 className="section-title mb-2">FII/DII Flows (₹ Cr)</h3>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={35} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "4px", fontSize: 10, padding: "4px 8px" }}
              formatter={(v: any) => `₹${v} Cr`} />
            <Bar dataKey="fii" name="FII" fill="hsl(var(--chart-cyan))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="dii" name="DII" fill="hsl(var(--chart-amber))" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1.5" style={{ fontSize: '9px' }}>
        <span className="flex items-center gap-1 text-muted-foreground"><div className="h-1.5 w-1.5 rounded-sm bg-chart-cyan" /> FII</span>
        <span className="flex items-center gap-1 text-muted-foreground"><div className="h-1.5 w-1.5 rounded-sm bg-chart-amber" /> DII</span>
      </div>
    </div>
  );
}

// ─── News Feed ───────────────────────────────────────────────────
function NewsFeed() {
  const news = [
    { title: "RBI holds repo rate at 6.5%, maintains stance", time: "2h ago", sentiment: "neutral" },
    { title: "Reliance Jio reports 15% YoY growth in Q3 subscribers", time: "4h ago", sentiment: "positive" },
    { title: "IT sector faces headwinds as global tech spending slows", time: "6h ago", sentiment: "negative" },
    { title: "SEBI introduces new framework for ESG disclosures", time: "8h ago", sentiment: "neutral" },
    { title: "Auto sector sales surge 12% in February", time: "12h ago", sentiment: "positive" },
  ];

  return (
    <div className="glass-card p-3">
      <h3 className="section-title mb-2">Market News</h3>
      <div className="space-y-1.5">
        {news.map((n, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-start gap-2 group cursor-pointer py-1 border-b border-border/30 last:border-0">
            <span className={`mt-0.5 flex-shrink-0 ${
              n.sentiment === "positive" ? "text-positive" :
              n.sentiment === "negative" ? "text-negative" : "text-muted-foreground"
            }`} style={{ fontSize: '8px' }}>
              {n.sentiment === "positive" ? "▲" : n.sentiment === "negative" ? "▼" : "●"}
            </span>
            <div className="min-w-0">
              <p className="text-foreground group-hover:text-primary transition-colors leading-tight truncate" style={{ fontSize: '11px' }}>{n.title}</p>
              <span className="text-muted-foreground" style={{ fontSize: '9px' }}>{n.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── IPO Calendar ────────────────────────────────────────────────
function IPOCalendar() {
  const ipos = [
    { name: "Hexaware Technologies", date: "Mar 24-26", size: "₹8,750 Cr", status: "Open" },
    { name: "Ather Energy", date: "Mar 28-30", size: "₹3,200 Cr", status: "Upcoming" },
    { name: "Niva Bupa Health", date: "Apr 2-4", size: "₹2,800 Cr", status: "Upcoming" },
    { name: "Tata Capital", date: "Apr 10-12", size: "₹15,000 Cr", status: "Upcoming" },
  ];

  return (
    <div className="glass-card p-3">
      <h3 className="section-title mb-2">IPO Calendar</h3>
      <div className="space-y-1.5">
        {ipos.map((ipo, i) => (
          <motion.div key={ipo.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
            className="flex items-center justify-between rounded border border-border/40 bg-secondary/40 px-2.5 py-1.5">
            <div>
              <p className="font-medium text-foreground" style={{ fontSize: '11px' }}>{ipo.name}</p>
              <p className="text-muted-foreground" style={{ fontSize: '9px' }}>{ipo.date} · {ipo.size}</p>
            </div>
            <span className={`font-mono font-semibold px-1.5 py-0.5 rounded ${
              ipo.status === "Open" ? "bg-chart-green/15 text-positive" : "text-muted-foreground bg-secondary"
            }`} style={{ fontSize: '9px' }}>
              {ipo.status}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Market Pulse Cards ──────────────────────────────────────────
function MarketPulseCard({ title, companies, type, icon }: {
  title: string; companies: typeof MOCK_COMPANIES; type: "gainers" | "losers" | "active"; icon: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { getPrice } = useLivePrices();

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-semibold text-foreground uppercase tracking-wider" style={{ fontSize: '10px' }}>{title}</h3>
      </div>
      <div className="space-y-0.5">
        {companies.slice(0, 5).map((c, i) => {
          const live = getPrice(c.symbol);
          const price = live?.price ?? c.price;
          const changePct = live?.changePct ?? c.change_pct;
          return (
            <motion.button key={c.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/company/${c.symbol}`)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-accent/50 transition-all duration-150 group">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors" style={{ fontSize: '11px' }}>{c.symbol}</span>
                <span className="text-muted-foreground hidden lg:inline" style={{ fontSize: '10px' }}>{c.name.split(" ").slice(0, 2).join(" ")}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-foreground" style={{ fontSize: '11px' }}>₹{price.toLocaleString()}</span>
                <span className={`metric-badge ${changePct >= 0 ? "bg-chart-green/10 text-positive" : "bg-chart-red/10 text-negative"}`}>
                  {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recently Viewed ─────────────────────────────────────────────
function RecentlyViewed() {
  const navigate = useNavigate();
  const recent = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("funda-recent") || "[]") as string[]; } catch { return []; }
  }, []);
  const companies = recent.map((s: string) => MOCK_COMPANIES.find((c) => c.symbol === s)).filter(Boolean).slice(0, 6);
  if (companies.length === 0) return null;

  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <h3 className="font-semibold text-foreground uppercase tracking-wider" style={{ fontSize: '10px' }}>Recently Viewed</h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {companies.map((c: any) => (
          <button key={c.symbol} onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex items-center gap-1.5 rounded border border-border bg-secondary px-2.5 py-1 hover:bg-accent transition-all duration-150" style={{ fontSize: '11px' }}>
            <span className="font-mono font-bold text-foreground">{c.symbol}</span>
            <span className={`font-mono ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`} style={{ fontSize: '10px' }}>
              {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────
export default function Dashboard() {
  const gainers = [...MOCK_COMPANIES].sort((a, b) => b.change_pct - a.change_pct);
  const losers = [...MOCK_COMPANIES].sort((a, b) => a.change_pct - b.change_pct);
  const active = [...MOCK_COMPANIES].sort((a, b) => b.market_cap - a.market_cap);
  const { widgets, setWidgets, isEditing, setIsEditing, toggleVisibility, resetLayout, orderedIds } = useDashboardLayout();

  const widgetMap: Record<string, React.ReactNode> = {
    hero: <MarketOverviewHero />,
    recent: <RecentlyViewed />,
    fundamentalMovers: <FundamentalMovers />,
    heatmap: (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Sector Performance</h2>
            <span className="text-muted-foreground font-mono" style={{ fontSize: '9px' }}>{SECTOR_DATA.length} sectors</span>
          </div>
          <SectorHeatmap />
        </div>
      </motion.div>
    ),
    valuePicks: <ValueQualityPicks />,
    feeds: (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FIIDIITracker />
        <NewsFeed />
        <IPOCalendar />
      </motion.div>
    ),
    pulse: (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MarketPulseCard title="Top Gainers" companies={gainers} type="gainers"
          icon={<div className="h-5 w-5 rounded bg-chart-green/10 flex items-center justify-center"><TrendingUp className="h-3 w-3 text-positive" /></div>} />
        <MarketPulseCard title="Top Losers" companies={losers} type="losers"
          icon={<div className="h-5 w-5 rounded bg-chart-red/10 flex items-center justify-center"><TrendingDown className="h-3 w-3 text-negative" /></div>} />
        <MarketPulseCard title="Most Active" companies={active} type="active"
          icon={<div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center"><Zap className="h-3 w-3 text-primary" /></div>} />
      </motion.div>
    ),
  };

  return (
    <div>
      <MarketTicker />
      <div className="container max-w-7xl py-4 space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="gap-1 text-muted-foreground h-7 px-2" style={{ fontSize: '10px' }}>
            <Settings2 className="h-3 w-3" /> Customize
          </Button>
        </div>

        <AnimatePresence>
          {isEditing && (
            <DashboardLayoutEditor
              widgets={widgets}
              setWidgets={setWidgets}
              toggleVisibility={toggleVisibility}
              resetLayout={resetLayout}
              onClose={() => setIsEditing(false)}
            />
          )}
        </AnimatePresence>

        {orderedIds.map((id) => (
          <div key={id}>{widgetMap[id]}</div>
        ))}
      </div>
    </div>
  );
}

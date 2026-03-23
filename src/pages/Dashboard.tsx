import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Zap, BarChart3, Newspaper, Calendar, ArrowUp, ArrowDown, Settings2, Search, Activity, ChevronRight } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { MOCK_COMPANIES, SECTOR_DATA } from "@/lib/mock-data";
import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDashboardLayout, DashboardLayoutEditor } from "@/components/DashboardLayout";
import { useLivePrices } from "@/hooks/use-live-prices";

function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  return `₹${(val / 1000).toFixed(0)}K Cr`;
}

// Market Indices Ticker with mini sparklines
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
    <div className="overflow-hidden border-b border-border/30 bg-secondary/30">
      <div className="flex items-center gap-8 px-4 py-2.5 overflow-x-auto scrollbar-thin">
        {indices.map((idx) => {
          const isUp = idx.change >= 0;
          return (
            <div key={idx.name} className="flex items-center gap-3 whitespace-nowrap flex-shrink-0 group cursor-default">
              <div>
                <span className="text-[10px] font-medium text-muted-foreground block leading-none mb-0.5">{idx.name}</span>
                <span className="text-xs font-mono font-bold text-foreground">{idx.value.toLocaleString()}</span>
              </div>
              {/* Mini sparkline */}
              <div className="w-12 h-5">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={idx.trend.map((v, i) => ({ v, i }))}>
                    <defs>
                      <linearGradient id={`tick-${idx.name}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} strokeWidth={1.5}
                      fill={`url(#tick-${idx.name})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <span className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 ${isUp ? "text-positive" : "text-negative"}`}>
                {isUp ? "+" : ""}{idx.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Data-forward hero replacing generic AI text
function MarketOverviewHero() {
  const navigate = useNavigate();
  const totalMarketCap = MOCK_COMPANIES.reduce((s, c) => s + c.market_cap, 0);
  const advancers = MOCK_COMPANIES.filter(c => c.change_pct > 0).length;
  const decliners = MOCK_COMPANIES.filter(c => c.change_pct < 0).length;
  const avgChange = (MOCK_COMPANIES.reduce((s, c) => s + c.change_pct, 0) / MOCK_COMPANIES.length);

  const stats = [
    { label: "Total Market Cap", value: formatMarketCap(totalMarketCap), sub: `${MOCK_COMPANIES.length} companies` },
    { label: "Market Breadth", value: `${advancers}:${decliners}`, sub: advancers > decliners ? "Bullish" : "Bearish", positive: advancers > decliners },
    { label: "Avg Change", value: `${avgChange >= 0 ? "+" : ""}${avgChange.toFixed(2)}%`, sub: "Today", positive: avgChange >= 0 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="space-y-5">
      {/* Search-first approach */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Overview</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}
          </h1>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[320px]">
          <SearchBar variant="hero" />
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-4">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">{stat.label}</span>
            <span className={`text-xl md:text-2xl font-mono font-bold block ${stat.positive !== undefined ? (stat.positive ? "text-positive" : "text-negative") : "text-foreground"}`}>
              {stat.value}
            </span>
            <span className="text-[11px] text-muted-foreground">{stat.sub}</span>
          </motion.div>
        ))}
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Stock Screener", to: "/screener", icon: BarChart3 },
          { label: "Compare Stocks", to: "/compare", icon: ChevronRight },
          { label: "DCF Calculator", to: "/dcf", icon: TrendingUp },
        ].map((action) => (
          <button key={action.label} onClick={() => navigate(action.to)}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all">
            <action.icon className="h-3 w-3" />
            {action.label}
          </button>
        ))}
        <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all">
          <Search className="h-3 w-3" />
          Quick Search
          <span className="kbd ml-1">⌘K</span>
        </button>
      </div>
    </motion.div>
  );
}

// FII/DII Flow Tracker
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
    <div className="glass-card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />FII/DII Daily Flows (₹ Cr)
      </h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={flows} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 11 }}
              formatter={(v: any) => `₹${v} Cr`} />
            <Bar dataKey="fii" name="FII" fill="hsl(var(--chart-cyan))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="dii" name="DII" fill="hsl(var(--chart-amber))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px]">
        <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-chart-cyan" /> FII (Foreign)</span>
        <span className="flex items-center gap-1"><div className="h-2 w-2 rounded bg-chart-amber" /> DII (Domestic)</span>
      </div>
    </div>
  );
}

// News Feed
function NewsFeed() {
  const news = [
    { title: "RBI holds repo rate at 6.5%, maintains stance", time: "2h ago", sentiment: "neutral" },
    { title: "Reliance Jio reports 15% YoY growth in Q3 subscribers", time: "4h ago", sentiment: "positive" },
    { title: "IT sector faces headwinds as global tech spending slows", time: "6h ago", sentiment: "negative" },
    { title: "SEBI introduces new framework for ESG disclosures", time: "8h ago", sentiment: "neutral" },
    { title: "Auto sector sales surge 12% in February amid festive demand", time: "12h ago", sentiment: "positive" },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-primary" />Market News
      </h3>
      <div className="space-y-2.5">
        {news.map((n, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-start gap-2.5 group cursor-pointer">
            <Badge variant="outline" className={`text-[8px] px-1.5 py-0 mt-0.5 flex-shrink-0 ${
              n.sentiment === "positive" ? "text-positive border-chart-green/30" :
              n.sentiment === "negative" ? "text-negative border-chart-red/30" : "text-muted-foreground"
            }`}>
              {n.sentiment === "positive" ? "▲" : n.sentiment === "negative" ? "▼" : "●"}
            </Badge>
            <div>
              <p className="text-xs text-foreground group-hover:text-primary transition-colors leading-tight">{n.title}</p>
              <span className="text-[10px] text-muted-foreground">{n.time}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// IPO Calendar
function IPOCalendar() {
  const ipos = [
    { name: "Hexaware Technologies", date: "Mar 24-26", size: "₹8,750 Cr", status: "Open" },
    { name: "Ather Energy", date: "Mar 28-30", size: "₹3,200 Cr", status: "Upcoming" },
    { name: "Niva Bupa Health", date: "Apr 2-4", size: "₹2,800 Cr", status: "Upcoming" },
    { name: "Tata Capital", date: "Apr 10-12", size: "₹15,000 Cr", status: "Upcoming" },
  ];

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />IPO Calendar
      </h3>
      <div className="space-y-2">
        {ipos.map((ipo, i) => (
          <motion.div key={ipo.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/30 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-foreground">{ipo.name}</p>
              <p className="text-[10px] text-muted-foreground">{ipo.date} · {ipo.size}</p>
            </div>
            <Badge variant={ipo.status === "Open" ? "default" : "outline"}
              className={`text-[9px] ${ipo.status === "Open" ? "bg-chart-green/20 text-positive border-chart-green/30" : ""}`}>
              {ipo.status}
            </Badge>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SectorHeatmap() {
  const navigate = useNavigate();
  const total = SECTOR_DATA.reduce((s, d) => s + d.marketCap, 0);
  const sorted = [...SECTOR_DATA].sort((a, b) => b.marketCap - a.marketCap);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 min-h-[200px]">
      {sorted.map((sector, idx) => {
        const pct = (sector.marketCap / total) * 100;
        const isPositive = sector.change >= 0;
        const size = pct > 20 ? "col-span-2 row-span-2" : pct > 10 ? "col-span-2" : "";
        return (
          <motion.div key={sector.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            className={`relative flex flex-col items-center justify-center rounded-xl p-3 cursor-pointer 
              transition-all duration-200 hover:shadow-md group overflow-hidden ${size} ${
              isPositive ? "bg-chart-green/8 hover:bg-chart-green/12" : "bg-chart-red/8 hover:bg-chart-red/12"
            }`}
            onClick={() => navigate(`/screener?sector=${sector.name}`)}>
            <span className="text-xs font-semibold text-foreground relative z-10">{sector.name}</span>
            <span className={`text-base font-mono font-bold relative z-10 ${isPositive ? "text-positive" : "text-negative"}`}>
              {isPositive ? "+" : ""}{sector.change.toFixed(2)}%
            </span>
            <span className="text-[10px] text-muted-foreground font-mono relative z-10">{formatMarketCap(sector.marketCap)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function MarketPulseCard({ title, companies, type, icon }: {
  title: string; companies: typeof MOCK_COMPANIES; type: "gainers" | "losers" | "active"; icon: React.ReactNode;
}) {
  const navigate = useNavigate();
  const { getPrice } = useLivePrices();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="space-y-1">
        {companies.slice(0, 5).map((c, i) => {
          const live = getPrice(c.symbol);
          const price = live?.price ?? c.price;
          const changePct = live?.changePct ?? c.change_pct;
          return (
            <motion.button key={c.symbol} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/company/${c.symbol}`)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50 transition-all duration-200 group">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">{c.symbol}</span>
                <span className="text-muted-foreground text-xs hidden lg:inline">{c.name.split(" ").slice(0, 2).join(" ")}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-foreground">₹{price.toLocaleString()}</span>
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

function RecentlyViewed() {
  const navigate = useNavigate();
  const recent = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("funda-recent") || "[]") as string[]; } catch { return []; }
  }, []);
  const companies = recent.map((s: string) => MOCK_COMPANIES.find((c) => c.symbol === s)).filter(Boolean).slice(0, 6);
  if (companies.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Recently Viewed</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {companies.map((c: any) => (
          <button key={c.symbol} onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex items-center gap-2 rounded-full border border-border/50 bg-secondary/50 px-3.5 py-2 text-sm hover:bg-secondary hover:border-border transition-all duration-200">
            <span className="font-mono font-bold text-foreground">{c.symbol}</span>
            <span className={`font-mono text-xs ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
              {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const gainers = [...MOCK_COMPANIES].sort((a, b) => b.change_pct - a.change_pct);
  const losers = [...MOCK_COMPANIES].sort((a, b) => a.change_pct - b.change_pct);
  const active = [...MOCK_COMPANIES].sort((a, b) => b.market_cap - a.market_cap);
  const { widgets, setWidgets, isEditing, setIsEditing, toggleVisibility, resetLayout, isVisible, orderedIds } = useDashboardLayout();

  const widgetMap: Record<string, React.ReactNode> = {
    hero: <MarketOverviewHero />,
    recent: <RecentlyViewed />,
    heatmap: (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Sector Performance</h2>
            <span className="text-xs text-muted-foreground font-mono">{SECTOR_DATA.length} sectors</span>
          </div>
          <SectorHeatmap />
        </div>
      </motion.div>
    ),
    feeds: (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FIIDIITracker />
        <NewsFeed />
        <IPOCalendar />
      </motion.div>
    ),
    pulse: (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MarketPulseCard title="Top Gainers" companies={gainers} type="gainers"
          icon={<div className="h-7 w-7 rounded-lg bg-chart-green/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-positive" /></div>} />
        <MarketPulseCard title="Top Losers" companies={losers} type="losers"
          icon={<div className="h-7 w-7 rounded-lg bg-chart-red/10 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-negative" /></div>} />
        <MarketPulseCard title="Most Active" companies={active} type="active"
          icon={<div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-4 w-4 text-primary" /></div>} />
      </motion.div>
    ),
  };

  return (
    <div>
      <MarketTicker />
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Dashboard customize button */}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)} className="gap-1.5 text-xs text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Customize
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

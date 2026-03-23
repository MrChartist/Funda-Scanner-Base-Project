import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Zap, BarChart3, Newspaper, Calendar, ArrowUp, ArrowDown, Settings2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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

// Market Indices Ticker
function MarketTicker() {
  const indices = [
    { name: "NIFTY 50", value: 24580.25, change: 142.30, changePct: 0.58 },
    { name: "SENSEX", value: 80945.60, change: 468.75, changePct: 0.58 },
    { name: "NIFTY BANK", value: 52340.10, change: -185.40, changePct: -0.35 },
    { name: "NIFTY IT", value: 38920.45, change: -210.30, changePct: -0.54 },
    { name: "NIFTY PHARMA", value: 18450.80, change: 95.20, changePct: 0.52 },
    { name: "INDIA VIX", value: 13.25, change: -0.45, changePct: -3.28 },
  ];

  return (
    <div className="overflow-hidden border-b border-border/30 bg-muted/20">
      <div className="flex items-center gap-6 px-4 py-2 overflow-x-auto scrollbar-thin">
        {indices.map((idx) => {
          const isUp = idx.change >= 0;
          return (
            <div key={idx.name} className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <span className="text-[11px] font-medium text-muted-foreground">{idx.name}</span>
              <span className="text-[11px] font-mono font-bold text-foreground">{idx.value.toLocaleString()}</span>
              <span className={`text-[10px] font-mono font-semibold flex items-center gap-0.5 ${isUp ? "text-positive" : "text-negative"}`}>
                {isUp ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                {isUp ? "+" : ""}{idx.changePct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
            className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
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
          <motion.div key={sector.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            className={`relative flex flex-col items-center justify-center rounded-lg p-3 cursor-pointer 
              transition-all duration-200 hover:ring-2 hover:ring-primary/40 hover:shadow-lg group overflow-hidden ${size} ${
              isPositive ? "bg-chart-green/8 hover:bg-chart-green/15" : "bg-chart-red/8 hover:bg-chart-red/15"
            }`}
            onClick={() => navigate(`/screener?sector=${sector.name}`)}>
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
              isPositive ? "bg-gradient-to-br from-chart-green/10 to-transparent" : "bg-gradient-to-br from-chart-red/10 to-transparent"
            }`} />
            <span className="text-xs font-bold text-foreground relative z-10">{sector.name}</span>
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
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2 text-sm hover:bg-accent/50 hover:border-border transition-all duration-200">
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
    hero: (
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-5 py-10">
        <div className="relative">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Institutional-Grade{" "}<span className="gradient-text">Financial Data</span>
          </h1>
          <div className="absolute -inset-x-10 -inset-y-4 bg-primary/5 rounded-3xl blur-3xl pointer-events-none" />
        </div>
        <p className="text-muted-foreground text-center max-w-lg text-base">
          Deep fundamentals for <span className="font-semibold text-foreground">2,229</span> NSE companies. Data first, no noise.
        </p>
        <SearchBar variant="hero" />
      </motion.div>
    ),
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
      <div className="container max-w-7xl py-8 space-y-8">
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

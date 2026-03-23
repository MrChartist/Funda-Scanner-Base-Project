import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Zap, BarChart3 } from "lucide-react";
import { MOCK_COMPANIES, SECTOR_DATA } from "@/lib/mock-data";
import { SearchBar } from "@/components/SearchBar";

function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  return `₹${(val / 1000).toFixed(0)}K Cr`;
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
          <motion.div
            key={sector.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.03 }}
            className={`relative flex flex-col items-center justify-center rounded-lg p-3 cursor-pointer 
              transition-all duration-200 hover:ring-2 hover:ring-primary/40 hover:shadow-lg group overflow-hidden ${size} ${
              isPositive ? "bg-chart-green/8 hover:bg-chart-green/15" : "bg-chart-red/8 hover:bg-chart-red/15"
            }`}
            onClick={() => navigate(`/screener?sector=${sector.name}`)}
          >
            {/* Background glow */}
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

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2.5 mb-4">
        {icon}
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="space-y-1">
        {companies.slice(0, 5).map((c, i) => (
          <motion.button
            key={c.symbol}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent/50 transition-all duration-200 group"
          >
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">{c.symbol}</span>
              <span className="text-muted-foreground text-xs hidden lg:inline">{c.name.split(" ").slice(0, 2).join(" ")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-foreground">₹{c.price.toLocaleString()}</span>
              <span className={`metric-badge ${c.change_pct >= 0 ? "bg-chart-green/10 text-positive" : "bg-chart-red/10 text-negative"}`}>
                {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function RecentlyViewed() {
  const navigate = useNavigate();
  const recent = useMemo(() => {
    try {
      const stored = localStorage.getItem("funda-recent");
      return stored ? JSON.parse(stored) as string[] : [];
    } catch { return []; }
  }, []);

  const companies = recent
    .map((s: string) => MOCK_COMPANIES.find((c) => c.symbol === s))
    .filter(Boolean)
    .slice(0, 6);

  if (companies.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Recently Viewed</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {companies.map((c: any) => (
          <button
            key={c.symbol}
            onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3.5 py-2 text-sm hover:bg-accent/50 hover:border-border transition-all duration-200"
          >
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

  return (
    <div className="container max-w-7xl py-8 space-y-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-5 py-10"
      >
        <div className="relative">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Institutional-Grade{" "}
            <span className="gradient-text">Financial Data</span>
          </h1>
          <div className="absolute -inset-x-10 -inset-y-4 bg-primary/5 rounded-3xl blur-3xl pointer-events-none" />
        </div>
        <p className="text-muted-foreground text-center max-w-lg text-base">
          Deep fundamentals for <span className="font-semibold text-foreground">2,229</span> NSE companies. Data first, no noise.
        </p>
        <SearchBar variant="hero" />
      </motion.div>

      <RecentlyViewed />

      {/* Sector Heatmap */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Sector Performance</h2>
            <span className="text-xs text-muted-foreground font-mono">{SECTOR_DATA.length} sectors</span>
          </div>
          <SectorHeatmap />
        </div>
      </motion.div>

      {/* Market Pulse */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <MarketPulseCard
          title="Top Gainers"
          companies={gainers}
          type="gainers"
          icon={<div className="h-7 w-7 rounded-lg bg-chart-green/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-positive" /></div>}
        />
        <MarketPulseCard
          title="Top Losers"
          companies={losers}
          type="losers"
          icon={<div className="h-7 w-7 rounded-lg bg-chart-red/10 flex items-center justify-center"><TrendingDown className="h-4 w-4 text-negative" /></div>}
        />
        <MarketPulseCard
          title="Most Active"
          companies={active}
          type="active"
          icon={<div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-4 w-4 text-primary" /></div>}
        />
      </motion.div>
    </div>
  );
}

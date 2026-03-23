import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, Clock, Search } from "lucide-react";
import { MOCK_COMPANIES, SECTOR_DATA, searchCompanies } from "@/lib/mock-data";
import { SearchBar } from "@/components/SearchBar";

function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  return `₹${(val / 1000).toFixed(0)}K Cr`;
}

function SectorHeatmap() {
  const navigate = useNavigate();
  const total = SECTOR_DATA.reduce((s, d) => s + d.marketCap, 0);

  return (
    <div className="grid grid-cols-4 md:grid-cols-6 gap-1 h-64">
      {SECTOR_DATA.sort((a, b) => b.marketCap - a.marketCap).map((sector) => {
        const pct = (sector.marketCap / total) * 100;
        const isPositive = sector.change >= 0;
        return (
          <motion.div
            key={sector.name}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`relative flex flex-col items-center justify-center rounded-md p-2 cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
              isPositive ? "bg-chart-green/15 hover:bg-chart-green/25" : "bg-chart-red/15 hover:bg-chart-red/25"
            }`}
            style={{ gridColumn: pct > 20 ? "span 2" : undefined, gridRow: pct > 20 ? "span 2" : undefined }}
            onClick={() => navigate(`/screener?sector=${sector.name}`)}
          >
            <span className="text-xs font-semibold text-foreground">{sector.name}</span>
            <span className={`text-sm font-mono font-bold ${isPositive ? "text-positive" : "text-negative"}`}>
              {isPositive ? "+" : ""}{sector.change.toFixed(2)}%
            </span>
            <span className="text-[10px] text-muted-foreground">{formatMarketCap(sector.marketCap)}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function MarketPulseCard({ title, companies, type }: { title: string; companies: typeof MOCK_COMPANIES; type: "gainers" | "losers" | "active" }) {
  const navigate = useNavigate();
  const icon = type === "gainers" ? <TrendingUp className="h-4 w-4 text-positive" /> : type === "losers" ? <TrendingDown className="h-4 w-4 text-negative" /> : <ArrowUpRight className="h-4 w-4 text-primary" />;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">
        {companies.slice(0, 5).map((c) => (
          <button
            key={c.symbol}
            onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground">{c.symbol}</span>
              <span className="text-muted-foreground text-xs hidden lg:inline">{c.name.split(" ").slice(0, 2).join(" ")}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-foreground">₹{c.price.toLocaleString()}</span>
              <span className={`font-mono text-xs font-medium ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
                {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
              </span>
            </div>
          </button>
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Recently Viewed</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {companies.map((c: any) => (
          <button
            key={c.symbol}
            onClick={() => navigate(`/company/${c.symbol}`)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <span className="font-mono font-semibold text-foreground">{c.symbol}</span>
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
    <div className="container py-8 space-y-8">
      {/* Hero Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 py-8"
      >
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight text-center">
          Institutional-Grade <span className="text-primary">Financial Data</span>
        </h1>
        <p className="text-muted-foreground text-center max-w-lg">
          Deep fundamentals for 2,229 NSE companies. Data first, no noise.
        </p>
        <SearchBar variant="hero" />
      </motion.div>

      {/* Recently Viewed */}
      <RecentlyViewed />

      {/* Sector Heatmap */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Sector Performance</h2>
          <SectorHeatmap />
        </div>
      </motion.div>

      {/* Market Pulse */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <MarketPulseCard title="Top Gainers" companies={gainers} type="gainers" />
        <MarketPulseCard title="Top Losers" companies={losers} type="losers" />
        <MarketPulseCard title="Most Active" companies={active} type="active" />
      </motion.div>
    </div>
  );
}

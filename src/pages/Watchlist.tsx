import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { Bookmark, X, Bell, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`wl-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#wl-${color})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Watchlist() {
  const navigate = useNavigate();
  const [followed, setFollowed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("funda-followed") || "[]"); } catch { return []; }
  });

  const [alerts, setAlerts] = useState<Record<string, { above?: number; below?: number }>>({});
  const [editingAlert, setEditingAlert] = useState<string | null>(null);

  const watchlistData = useMemo(() => {
    return followed.map((symbol) => {
      const company = MOCK_COMPANIES.find((c) => c.symbol === symbol);
      if (!company) return null;
      const intel = getMockCompanyIntelligence(symbol);
      const prices = intel.intelligence.price_history.slice(-30).map((p) => p.close);
      return { ...company, prices, pe: intel.company.pe, roce: intel.company.roce, npm: intel.company.npm };
    }).filter(Boolean) as any[];
  }, [followed]);

  const removeFromWatchlist = (symbol: string) => {
    const updated = followed.filter((s) => s !== symbol);
    setFollowed(updated);
    localStorage.setItem("funda-followed", JSON.stringify(updated));
  };

  const setAlert = (symbol: string, above?: number, below?: number) => {
    setAlerts((prev) => ({ ...prev, [symbol]: { above, below } }));
    setEditingAlert(null);
  };

  if (followed.length === 0) {
    return (
      <div className="container max-w-7xl py-20 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Bookmark className="h-16 w-16 text-muted-foreground/30 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-foreground">Your Watchlist is Empty</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Follow companies from their detail page to track them here with sparklines, alerts, and key metrics.
          </p>
          <button onClick={() => navigate("/")} className="text-primary font-medium hover:underline">
            Browse Companies →
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Watchlist</h1>
              <p className="text-sm text-muted-foreground">{followed.length} companies tracked</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="data-header">Company</th>
                <th className="data-header">Price</th>
                <th className="data-header">Change</th>
                <th className="data-header">30D Trend</th>
                <th className="data-header">P/E</th>
                <th className="data-header">ROCE</th>
                <th className="data-header">NPM</th>
                <th className="data-header">Market Cap</th>
                <th className="data-header">Alert</th>
                <th className="data-header w-10"></th>
              </tr>
            </thead>
            <tbody>
              {watchlistData.map((c, idx) => {
                const isPositive = c.change_pct >= 0;
                const sparkColor = isPositive ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))";
                const alert = alerts[c.symbol];
                return (
                  <motion.tr key={c.symbol} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border-b border-border/20 last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="data-cell">
                      <button onClick={() => navigate(`/company/${c.symbol}`)} className="text-left group">
                        <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">{c.symbol}</span>
                        <span className="block text-[10px] text-muted-foreground">{c.name.split(" ").slice(0, 3).join(" ")}</span>
                      </button>
                    </td>
                    <td className="data-cell font-mono text-foreground">₹{c.price.toLocaleString()}</td>
                    <td className="data-cell">
                      <span className={`inline-flex items-center gap-1 font-mono font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositive ? "+" : ""}{c.change_pct.toFixed(2)}%
                      </span>
                    </td>
                    <td className="data-cell"><MiniSparkline data={c.prices} color={sparkColor} /></td>
                    <td className="data-cell font-mono text-foreground">{c.pe}</td>
                    <td className="data-cell font-mono text-positive">{c.roce}%</td>
                    <td className="data-cell font-mono text-foreground">{c.npm}%</td>
                    <td className="data-cell font-mono text-foreground">
                      {c.market_cap >= 100000 ? `₹${(c.market_cap / 100000).toFixed(1)}L Cr` : `₹${(c.market_cap / 1000).toFixed(0)}K Cr`}
                    </td>
                    <td className="data-cell">
                      {editingAlert === c.symbol ? (
                        <div className="flex gap-1 items-center">
                          <input type="number" placeholder="Above" className="w-16 px-1 py-0.5 text-xs bg-muted rounded border border-border"
                            onKeyDown={(e) => { if (e.key === "Enter") setAlert(c.symbol, Number((e.target as any).value)); }} />
                        </div>
                      ) : (
                        <button onClick={() => setEditingAlert(c.symbol)}
                          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                          <Bell className="h-3 w-3" />
                          {alert?.above ? `>₹${alert.above}` : "Set"}
                        </button>
                      )}
                    </td>
                    <td className="data-cell">
                      <button onClick={() => removeFromWatchlist(c.symbol)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

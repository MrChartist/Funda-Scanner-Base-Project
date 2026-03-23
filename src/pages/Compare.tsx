import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from "recharts";
import { Plus, X, GitCompare, TrendingUp, TrendingDown, Share2, Download } from "lucide-react";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";
import { SearchBar } from "@/components/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { Badge } from "@/components/ui/badge";

const COMPARE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-green))",
  "hsl(var(--chart-amber))",
  "hsl(var(--chart-cyan))",
];

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbols = searchParams.get("symbols")?.split(",").filter(Boolean) || [];
  const [symbols, setSymbols] = useState<string[]>(initialSymbols.length > 0 ? initialSymbols : ["RELIANCE", "TCS"]);
  const [showSearch, setShowSearch] = useState(false);

  // Sync URL with selected symbols
  useEffect(() => {
    setSearchParams({ symbols: symbols.join(",") }, { replace: true });
  }, [symbols, setSearchParams]);

  const companyData = useMemo(() => {
    return symbols.map((s) => ({
      symbol: s,
      ...getMockCompanyIntelligence(s),
    }));
  }, [symbols]);

  const addCompany = (symbol: string) => {
    if (symbols.length < 4 && !symbols.includes(symbol)) {
      setSymbols([...symbols, symbol]);
    }
    setShowSearch(false);
  };

  const removeCompany = (symbol: string) => {
    if (symbols.length > 1) setSymbols(symbols.filter((s) => s !== symbol));
  };

  // Normalize price data for overlay chart
  const priceOverlay = useMemo(() => {
    if (companyData.length === 0) return [];
    const maxLen = Math.min(...companyData.map((d) => d.intelligence.price_history.length));
    const days = companyData[0].intelligence.price_history.slice(-maxLen);
    return days.map((d, i) => {
      const point: any = { date: d.date };
      companyData.forEach((cd) => {
        const history = cd.intelligence.price_history;
        const basePrice = history[history.length - maxLen].close;
        const currentPrice = history[history.length - maxLen + i]?.close || basePrice;
        point[cd.symbol] = +((currentPrice / basePrice - 1) * 100).toFixed(2);
      });
      return point;
    });
  }, [companyData]);

  // Radar data for comparing key metrics
  const radarData = useMemo(() => {
    const metrics = [
      { key: "pe", label: "P/E", invert: true },
      { key: "roce", label: "ROCE" },
      { key: "roe", label: "ROE" },
      { key: "npm", label: "NPM" },
      { key: "de", label: "D/E", invert: true },
    ];
    return metrics.map((m) => {
      const point: any = { metric: m.label };
      const values = companyData.map((cd) => Number((cd.company as any)[m.key]) || 0);
      const max = Math.max(...values, 1);
      companyData.forEach((cd, i) => {
        let val = Number((cd.company as any)[m.key]) || 0;
        if (m.invert) val = max - val + 1;
        point[cd.symbol] = +((val / max) * 100).toFixed(1);
      });
      return point;
    });
  }, [companyData]);

  const metricRows = [
    { label: "Price", key: "price", fmt: (v: number) => `₹${v.toLocaleString()}` },
    { label: "Market Cap", key: "market_cap", fmt: (v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L Cr` : `₹${(v / 1000).toFixed(0)}K Cr` },
    { label: "P/E", key: "pe", fmt: (v: number) => v.toFixed(1) },
    { label: "P/B", key: "pb", fmt: (v: number) => v?.toFixed(1) || "N/A" },
    { label: "ROCE %", key: "roce", fmt: (v: number) => `${v}%`, highlight: "high" },
    { label: "ROE %", key: "roe", fmt: (v: number) => `${v}%`, highlight: "high" },
    { label: "NPM %", key: "npm", fmt: (v: number) => `${v}%`, highlight: "high" },
    { label: "D/E", key: "de", fmt: (v: number) => String(v), highlight: "low" },
    { label: "EPS", key: "eps", fmt: (v: number) => `₹${v}` },
    { label: "Div. Yield", key: "dividend_yield", fmt: (v: number) => `${v}%` },
    { label: "Book Value", key: "book_value", fmt: (v: number) => `₹${v}` },
  ];

  const shareUrl = () => {
    const url = `${window.location.origin}/compare?symbols=${symbols.join(",")}`;
    navigator.clipboard.writeText(url);
    alert("Compare URL copied to clipboard!");
  };

  const exportCSV = () => {
    const headers = ["Metric", ...symbols];
    const rows = metricRows.map((row) => [row.label, ...companyData.map((cd) => row.fmt(Number((cd.company as any)[row.key])))]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `compare_${symbols.join("_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
    <div className="container max-w-7xl py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <GitCompare className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Stock Comparison</h1>
              <p className="text-sm text-muted-foreground">Compare up to 4 stocks side-by-side</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={shareUrl}><Share2 className="h-4 w-4 mr-1" />Share</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
          </div>
        </div>
      </motion.div>

      {/* Selected companies */}
      <div className="flex items-center gap-2 flex-wrap">
        {symbols.map((s, i) => (
          <Badge key={s} variant="outline" className="gap-2 px-3 py-1.5 text-sm font-mono" style={{ borderColor: COMPARE_COLORS[i] }}>
            <div className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} />
            {s}
            {symbols.length > 1 && (
              <button onClick={() => removeCompany(s)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            )}
          </Badge>
        ))}
        {symbols.length < 4 && (
          <div className="relative">
            <button onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all">
              <Plus className="h-3.5 w-3.5" /> Add Stock
            </button>
            {showSearch && (
              <div className="absolute top-full mt-2 left-0 z-50 w-64 bg-card border border-border rounded-lg shadow-xl p-2">
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {MOCK_COMPANIES.filter((c) => !symbols.includes(c.symbol)).map((c) => (
                    <button key={c.symbol} onClick={() => addCompany(c.symbol)}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors">
                      <span className="font-mono font-semibold">{c.symbol}</span>
                      <span className="text-xs text-muted-foreground">{c.name.split(" ").slice(0, 2).join(" ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Price Performance Overlay */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4">Price Performance (% Change)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceOverlay} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                {symbols.map((s, i) => (
                  <linearGradient key={s} id={`compare-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COMPARE_COLORS[i]} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={COMPARE_COLORS[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { month: "short" })} interval={30} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                formatter={(v: any) => `${v}%`} />
              {symbols.map((s, i) => (
                <Area key={s} type="monotone" dataKey={s} stroke={COMPARE_COLORS[i]} fill={`url(#compare-${i})`}
                  strokeWidth={2} name={s} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Radar Chart */}
        <div className="glass-card p-5">
          <h2 className="section-title mb-4">Fundamental Radar</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <PolarRadiusAxis tick={false} domain={[0, 100]} axisLine={false} />
                {symbols.map((s, i) => (
                  <Radar key={s} name={s} dataKey={s} stroke={COMPARE_COLORS[i]}
                    fill={COMPARE_COLORS[i]} fillOpacity={0.15} strokeWidth={2} />
                ))}
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Comparison Bar Chart */}
        <div className="glass-card p-5">
          <h2 className="section-title mb-4">Revenue Comparison (Last 5 Years)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                const years = companyData[0]?.intelligence.statement_rows.slice(-5) || [];
                return years.map((yr) => {
                  const point: any = { year: yr.year };
                  companyData.forEach((cd, i) => {
                    const row = cd.intelligence.statement_rows.find((r) => r.year === yr.year);
                    point[cd.symbol] = row?.revenue || 0;
                  });
                  return point;
                });
              })()} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }} />
                {symbols.map((s, i) => (
                  <Bar key={s} dataKey={s} fill={COMPARE_COLORS[i]} name={s} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Metrics Table */}
      <div className="glass-card p-5">
        <h2 className="section-title mb-4">Key Metrics Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="data-header">Metric</th>
                {companyData.map((cd, i) => (
                  <th key={cd.symbol} className="data-header">
                    <span className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} />
                      {cd.symbol}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => {
                const values = companyData.map((cd) => Number((cd.company as any)[row.key]) || 0);
                const best = row.highlight === "low" ? Math.min(...values) : Math.max(...values);
                return (
                  <tr key={row.key} className="border-b border-border/20 last:border-0">
                    <td className="data-cell text-muted-foreground font-medium">{row.label}</td>
                    {companyData.map((cd, i) => {
                      const v = (cd.company as any)[row.key];
                      const isBest = row.highlight && Number(v) === best;
                      return (
                        <td key={cd.symbol} className={`data-cell font-mono ${isBest ? "text-positive font-bold" : "text-foreground"}`}>
                          {row.fmt(Number(v))}
                          {isBest && <span className="ml-1 text-[9px] text-positive">★</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </PageTransition>
  );
}

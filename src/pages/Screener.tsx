import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, X, Filter, Save, RotateCcw, ChevronDown, Download, AreaChart as AreaChartIcon, Loader2, RefreshCw } from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/mock-data";
import { fetchScreenedStocks, type TVStockData } from "@/lib/tradingview";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { LiveMarketIndicator } from "@/hooks/use-live-prices";

// Metrics available for filtering — mapped to TradingView field names
const METRICS = [
  { key: "market_cap_basic", label: "Market Cap", tvField: "market_cap_basic", type: "number", category: "Valuation" },
  { key: "close", label: "Price", tvField: "close", type: "number", category: "Price" },
  { key: "change", label: "Change %", tvField: "change", type: "number", category: "Price" },
  { key: "price_earnings_ttm", label: "P/E Ratio", tvField: "price_earnings_ttm", type: "number", category: "Valuation" },
  { key: "earnings_per_share_basic_ttm", label: "EPS", tvField: "earnings_per_share_basic_ttm", type: "number", category: "Valuation" },
  { key: "volume", label: "Volume", tvField: "volume", type: "number", category: "Price" },
  { key: "relative_volume_10d_calc", label: "Relative Volume", tvField: "relative_volume_10d_calc", type: "number", category: "Price" },
  // Fundamental metrics
  { key: "return_on_invested_capital", label: "ROCE (ROIC)", tvField: "return_on_invested_capital", type: "number", category: "Fundamental" },
  { key: "return_on_equity", label: "ROE", tvField: "return_on_equity", type: "number", category: "Fundamental" },
  { key: "debt_to_equity", label: "Debt/Equity", tvField: "debt_to_equity", type: "number", category: "Fundamental" },
  { key: "dividend_yield_recent", label: "Dividend Yield %", tvField: "dividend_yield_recent", type: "number", category: "Fundamental" },
  { key: "revenue_growth_quarterly", label: "Sales Growth (QoQ)", tvField: "revenue_growth_quarterly", type: "number", category: "Growth" },
  { key: "earnings_growth_quarterly", label: "Profit Growth (QoQ)", tvField: "earnings_growth_quarterly", type: "number", category: "Growth" },
  { key: "price_book_fq", label: "Price/Book", tvField: "price_book_fq", type: "number", category: "Valuation" },
  { key: "total_debt_to_ebitda", label: "Debt/EBITDA", tvField: "total_debt_to_ebitda", type: "number", category: "Fundamental" },
  { key: "free_cash_flow_yield_ttm", label: "FCF Yield %", tvField: "free_cash_flow_yield_ttm", type: "number", category: "Fundamental" },
];

const OPERATORS = [
  { key: "greater", label: ">" },
  { key: "less", label: "<" },
  { key: "in_range", label: "Between" },
  { key: "equal", label: "=" },
];

const PRESETS = [
  { name: "Large Cap (>₹50K Cr)", filters: [{ left: "market_cap_basic", operation: "greater", right: 500000000000 }] },
  { name: "High P/E (>30)", filters: [{ left: "price_earnings_ttm", operation: "greater", right: 30 }] },
  { name: "Low P/E (<15)", filters: [{ left: "price_earnings_ttm", operation: "less", right: 15 }, { left: "price_earnings_ttm", operation: "greater", right: 0 }] },
  { name: "Top Gainers (>2%)", filters: [{ left: "change", operation: "greater", right: 2 }] },
  { name: "Top Losers (<-2%)", filters: [{ left: "change", operation: "less", right: -2 }] },
  { name: "High Volume", filters: [{ left: "relative_volume_10d_calc", operation: "greater", right: 2 }] },
  { name: "Penny Stocks (<₹50)", filters: [{ left: "close", operation: "less", right: 50 }] },
  // Fundamental presets
  { name: "High ROCE (>20%)", filters: [{ left: "return_on_invested_capital", operation: "greater", right: 20 }] },
  { name: "Low Debt (D/E<0.5)", filters: [{ left: "debt_to_equity", operation: "less", right: 0.5 }, { left: "debt_to_equity", operation: "greater", right: 0 }] },
  { name: "Dividend Stars (>3%)", filters: [{ left: "dividend_yield_recent", operation: "greater", right: 3 }] },
  { name: "High ROE (>15%)", filters: [{ left: "return_on_equity", operation: "greater", right: 15 }] },
  { name: "Growth Stocks", filters: [{ left: "revenue_growth_quarterly", operation: "greater", right: 15 }, { left: "earnings_growth_quarterly", operation: "greater", right: 15 }] },
  { name: "Value Picks (P/B<2)", filters: [{ left: "price_book_fq", operation: "less", right: 2 }, { left: "price_book_fq", operation: "greater", right: 0 }] },
];

interface FilterCondition {
  id: string;
  metric: string;
  operator: string;
  value: string;
  value2?: string; // for "between" operator
}

function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K Cr`;
  return `₹${val.toFixed(0)} Cr`;
}

export default function Screener() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectorParam = searchParams.get("sector");

  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sortKey, setSortKey] = useState<string>("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [results, setResults] = useState<TVStockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Build TradingView filters from user conditions
  const buildTVFilters = () => {
    const tvFilters: Array<{ left: string; operation: string; right: any }> = [];

    filters.forEach((f) => {
      if (!f.value) return;
      const metric = METRICS.find((m) => m.key === f.metric);
      if (!metric) return;

      let right: any = Number(f.value);
      // Market cap needs conversion from Cr to raw INR
      if (f.metric === "market_cap_basic") {
        right = right * 10000000; // Cr to INR
      }

      if (f.operator === "in_range" && f.value2) {
        let right2 = Number(f.value2);
        if (f.metric === "market_cap_basic") right2 = right2 * 10000000;
        tvFilters.push({ left: f.metric, operation: "in_range", right: [right, right2] });
      } else {
        tvFilters.push({ left: f.metric, operation: f.operator, right });
      }
    });

    return tvFilters;
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const tvFilters = buildTVFilters();

      // Map sort key to TradingView field
      const sortMap: Record<string, string> = {
        market_cap: "market_cap_basic", price: "close", change_pct: "change",
        pe: "price_earnings_ttm", volume: "volume", symbol: "name",
      };

      const data = await fetchScreenedStocks({
        filters: tvFilters,
        sortBy: sortMap[sortKey] || "market_cap_basic",
        sortOrder: sortDir,
        count: 100,
      });
      setResults(data);
      setLastFetched(new Date());
    } catch (err: any) {
      console.error("Screener fetch failed:", err);
      setError("Failed to fetch data. Using fallback.");
      // Fallback to mock data
      setResults(MOCK_COMPANIES.map((c) => ({
        symbol: c.symbol, name: c.name, industry: c.sector,
        sector: c.sector, market_cap: c.market_cap, currency: "INR",
        eps: 0, pe: 0, price: c.price, change_pct: c.change_pct,
        volume: 0, relative_volume: 0, avg_volume_10d: 0,
        high_52w: 0, low_52w: 0, sma10: 0, sma20: 0, sma50: 0,
      })));
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters/sort change
  useEffect(() => {
    fetchData();
  }, [filters, sortKey, sortDir]);

  // Apply sector param from URL
  useEffect(() => {
    if (sectorParam) {
      // For sector filtering, we'd need TradingView's sector values
      // For now just fetch all and note the sector
    }
  }, [sectorParam]);

  const addFilter = () => setFilters((f) => [...f, { id: crypto.randomUUID(), metric: "market_cap_basic", operator: "greater", value: "" }]);
  const updateFilter = (id: string, field: keyof FilterCondition, value: string) =>
    setFilters((f) => f.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  const removeFilter = (id: string) => setFilters((f) => f.filter((x) => x.id !== id));
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setFilters(preset.filters.map((f) => ({
      id: crypto.randomUUID(),
      metric: f.left,
      operator: f.operation,
      value: f.left === "market_cap_basic" ? String(f.right / 10000000) : String(f.right),
    })));
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const headers = ["Symbol", "Company", "Sector", "Industry", "Price", "Change %", "P/E", "EPS", "Market Cap (Cr)", "Volume", "52W High", "52W Low"];
    const rows = results.map((c) => [c.symbol, c.name, c.sector, c.industry, c.price, c.change_pct, c.pe, c.eps, c.market_cap, c.volume, c.high_52w, c.low_52w]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `screener_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveScreen = () => {
    const name = prompt("Name this screen:");
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem("funda-screens") || "[]");
    saved.push({ name, filters });
    localStorage.setItem("funda-screens", JSON.stringify(saved));
  };

  return (
    <div className="container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-foreground">Stock Screener</h1>
              <LiveMarketIndicator />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time NSE data · {results.length} results
              {lastFetched && <span className="ml-2 text-[10px] font-mono">Updated {lastFetched.toLocaleTimeString()}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
            <Button variant="outline" size="sm" onClick={saveScreen}><Save className="h-4 w-4 mr-1" />Save</Button>
            <Button variant="outline" size="sm" onClick={() => setFilters([])}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
          </div>
        </div>
      </motion.div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-chart-amber/30 bg-chart-amber/5 px-4 py-2.5 text-sm text-foreground flex items-center gap-2">
          <span className="text-chart-amber">⚠</span> {error}
        </div>
      )}

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.name} onClick={() => applyPreset(p)}
            className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground hover:bg-accent transition-colors">
            {p.name}
          </button>
        ))}
      </div>

      {/* Filter Builder */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Filter className="h-4 w-4" />Filter Conditions
          <span className="text-[10px] font-normal text-muted-foreground ml-2">(Powered by TradingView Scanner)</span>
        </div>
        {filters.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2 flex-wrap">
            {i > 0 && <Badge variant="outline" className="text-xs">AND</Badge>}
            <Select value={f.metric} onValueChange={(v) => updateFilter(f.id, "metric", v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.operator} onValueChange={(v) => updateFilter(f.id, "operator", v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={f.value} onChange={(e) => updateFilter(f.id, "value", e.target.value)}
              placeholder={f.metric === "market_cap_basic" ? "Value (Cr)" : "Value"} className="w-32" type="number" />
            {f.operator === "in_range" && (
              <Input value={f.value2 || ""} onChange={(e) => updateFilter(f.id, "value2", e.target.value)}
                placeholder="Max" className="w-32" type="number" />
            )}
            <button onClick={() => removeFilter(f.id)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addFilter}><Plus className="h-4 w-4 mr-1" /> Add Filter</Button>
      </div>

      {/* Results Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching...</span> : `${results.length} companies found`}
          </span>
          {results.length >= 2 && (
            <button onClick={() => navigate(`/compare?symbols=${results.slice(0, 2).map((r) => r.symbol).join(",")}`)}
              className="text-xs text-primary hover:underline font-medium">Compare Top 2 →</button>
          )}
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  { key: "symbol", label: "Symbol" },
                  { key: "name", label: "Company" },
                  { key: "sector", label: "Sector" },
                  { key: "price", label: "Price" },
                  { key: "change_pct", label: "Change %" },
                  { key: "pe", label: "P/E" },
                  { key: "eps", label: "EPS" },
                  { key: "volume", label: "Volume" },
                  { key: "market_cap", label: "Market Cap" },
                  { key: "high_52w", label: "52W High" },
                  { key: "low_52w", label: "52W Low" },
                ].map((col) => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="data-header cursor-pointer hover:text-foreground group">
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && <ChevronDown className={`h-3 w-3 text-primary transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} />}
                      {sortKey !== col.key && <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((c) => (
                <tr key={c.symbol} onClick={() => navigate(`/company/${c.symbol}`)}
                  className="border-b border-border/30 last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                  <td className="data-cell font-bold text-primary">{c.symbol}</td>
                  <td className="data-cell text-foreground whitespace-nowrap max-w-[200px] truncate">{c.name}</td>
                  <td className="data-cell text-muted-foreground whitespace-nowrap">{c.sector}</td>
                  <td className="data-cell font-mono text-foreground">₹{c.price.toLocaleString()}</td>
                  <td className={`data-cell font-mono font-semibold ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
                    {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
                  </td>
                  <td className="data-cell font-mono text-foreground">{c.pe > 0 ? c.pe.toFixed(1) : "—"}</td>
                  <td className="data-cell font-mono text-foreground">{c.eps > 0 ? `₹${c.eps.toFixed(1)}` : "—"}</td>
                  <td className="data-cell font-mono text-muted-foreground">
                    {c.volume > 1000000 ? `${(c.volume / 1000000).toFixed(1)}M` : c.volume > 1000 ? `${(c.volume / 1000).toFixed(0)}K` : c.volume}
                  </td>
                  <td className="data-cell font-mono text-foreground">{formatMarketCap(c.market_cap)}</td>
                  <td className="data-cell font-mono text-muted-foreground">₹{c.high_52w.toLocaleString()}</td>
                  <td className="data-cell font-mono text-muted-foreground">₹{c.low_52w.toLocaleString()}</td>
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">No stocks match your criteria. Try adjusting filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

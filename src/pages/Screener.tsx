import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, X, Filter, Save, RotateCcw, ChevronDown, Download, AreaChart as AreaChartIcon } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { MOCK_COMPANIES, getMockCompanyIntelligence } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const METRICS = [
  { key: "market_cap", label: "Market Cap (Cr)", type: "number", min: 0, max: 2000000, step: 10000 },
  { key: "price", label: "Price", type: "number", min: 0, max: 20000, step: 100 },
  { key: "change_pct", label: "Change %", type: "number", min: -10, max: 10, step: 0.1 },
  { key: "sector", label: "Sector", type: "text" },
];

const OPERATORS = [
  { key: ">", label: ">" }, { key: "<", label: "<" },
  { key: ">=", label: ">=" }, { key: "<=", label: "<=" }, { key: "=", label: "=" },
];

const PRESETS = [
  { name: "Large Cap Leaders", filters: [{ metric: "market_cap", operator: ">", value: "500000" }] },
  { name: "Top Gainers Today", filters: [{ metric: "change_pct", operator: ">", value: "1" }] },
  { name: "Affordable Stocks", filters: [{ metric: "price", operator: "<", value: "1000" }] },
  { name: "IT Sector", filters: [{ metric: "sector", operator: "=", value: "IT" }] },
];

interface FilterCondition { id: string; metric: string; operator: string; value: string; }

function applyFilters(companies: typeof MOCK_COMPANIES, filters: FilterCondition[]) {
  return companies.filter((c) => filters.every((f) => {
    const val = (c as any)[f.metric];
    if (f.metric === "sector") return val?.toLowerCase() === f.value.toLowerCase();
    const numVal = Number(val); const target = Number(f.value);
    if (isNaN(numVal) || isNaN(target)) return true;
    switch (f.operator) {
      case ">": return numVal > target; case "<": return numVal < target;
      case ">=": return numVal >= target; case "<=": return numVal <= target;
      case "=": return numVal === target; default: return true;
    }
  }));
}

function MiniSparkline({ symbol }: { symbol: string }) {
  const data = useMemo(() => {
    const intel = getMockCompanyIntelligence(symbol);
    return intel.intelligence.price_history.slice(-30).map((p, i) => ({ v: p.close, i }));
  }, [symbol]);
  const trend = data.length > 1 ? data[data.length - 1].v >= data[0].v : true;
  const color = trend ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))";
  return (
    <div className="h-7 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill="transparent" strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Screener() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectorParam = searchParams.get("sector");
  const [filters, setFilters] = useState<FilterCondition[]>(
    sectorParam ? [{ id: "init", metric: "sector", operator: "=", value: sectorParam }] : []
  );
  const [sortKey, setSortKey] = useState<string>("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [quickFilter, setQuickFilter] = useState<{ mcap: number[]; pe: number[] }>({
    mcap: [0, 2000000], pe: [0, 100],
  });
  const [showSliders, setShowSliders] = useState(false);

  const addFilter = () => setFilters((f) => [...f, { id: crypto.randomUUID(), metric: "market_cap", operator: ">", value: "" }]);
  const updateFilter = (id: string, field: keyof FilterCondition, value: string) =>
    setFilters((f) => f.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  const removeFilter = (id: string) => setFilters((f) => f.filter((x) => x.id !== id));
  const applyPreset = (preset: typeof PRESETS[0]) =>
    setFilters(preset.filters.map((f) => ({ ...f, id: crypto.randomUUID() })));

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const results = useMemo(() => {
    let filtered = applyFilters(MOCK_COMPANIES, filters);
    // Apply slider filters
    if (showSliders) {
      filtered = filtered.filter((c) => c.market_cap >= quickFilter.mcap[0] && c.market_cap <= quickFilter.mcap[1]);
    }
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? 0; const bv = (b as any)[sortKey] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [filters, sortKey, sortDir, quickFilter, showSliders]);

  const exportCSV = () => {
    const headers = ["Symbol", "Company", "Sector", "Price", "Change %", "Market Cap"];
    const rows = results.map((c) => [c.symbol, c.name, c.sector, c.price, c.change_pct, c.market_cap]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "screener_results.csv"; a.click();
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Stock Screener</h1>
            <p className="text-sm text-muted-foreground mt-1">Build custom queries to find stocks matching your criteria</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSliders(!showSliders)}>
              <AreaChartIcon className="h-4 w-4 mr-1" />Sliders
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
            <Button variant="outline" size="sm" onClick={saveScreen}><Save className="h-4 w-4 mr-1" />Save</Button>
            <Button variant="outline" size="sm" onClick={() => setFilters([])}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
          </div>
        </div>
      </motion.div>

      {/* Slider Filters */}
      {showSliders && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Quick Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Market Cap</span>
                <span className="text-xs font-mono text-foreground">
                  ₹{(quickFilter.mcap[0] / 1000).toFixed(0)}K — ₹{(quickFilter.mcap[1] / 1000).toFixed(0)}K Cr
                </span>
              </div>
              <Slider min={0} max={2000000} step={10000} value={quickFilter.mcap}
                onValueChange={(v) => setQuickFilter((f) => ({ ...f, mcap: v }))} className="w-full" />
            </div>
          </div>
        </motion.div>
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
        </div>
        {filters.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2 flex-wrap">
            {i > 0 && <Badge variant="outline" className="text-xs">AND</Badge>}
            <Select value={f.metric} onValueChange={(v) => updateFilter(f.id, "metric", v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.operator} onValueChange={(v) => updateFilter(f.id, "operator", v)}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={f.value} onChange={(e) => updateFilter(f.id, "value", e.target.value)} placeholder="Value" className="w-32" />
            <button onClick={() => removeFilter(f.id)} className="text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={addFilter}><Plus className="h-4 w-4 mr-1" /> Add Filter</Button>
      </div>

      {/* Results */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{results.length} companies found</span>
          <button onClick={() => navigate(`/compare?symbols=${results.slice(0, 2).map((r) => r.symbol).join(",")}`)}
            className="text-xs text-primary hover:underline font-medium">Compare Top 2 →</button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  { key: "symbol", label: "Symbol" }, { key: "name", label: "Company" },
                  { key: "sector", label: "Sector" }, { key: "sparkline", label: "30D" },
                  { key: "price", label: "Price" }, { key: "change_pct", label: "Change %" },
                  { key: "market_cap", label: "Market Cap" },
                ].map((col) => (
                  <th key={col.key} onClick={() => col.key !== "sparkline" && toggleSort(col.key)}
                    className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && <ChevronDown className={`h-3 w-3 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((c) => (
                <tr key={c.symbol} onClick={() => navigate(`/company/${c.symbol}`)}
                  className="border-b border-border last:border-0 hover:bg-accent/50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{c.symbol}</td>
                  <td className="px-4 py-3 text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.sector}</td>
                  <td className="px-4 py-2"><MiniSparkline symbol={c.symbol} /></td>
                  <td className="px-4 py-3 font-mono text-foreground">₹{c.price.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
                    {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">{formatMarketCap(c.market_cap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatMarketCap(val: number) {
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  return `₹${(val / 1000).toFixed(0)}K Cr`;
}

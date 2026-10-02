import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, X, Filter, Save, RotateCcw, ChevronDown, Download, Upload, Loader2 } from "lucide-react";
import {
  METRICS, runScreen,
  type FilterCondition, type MetricKey, type Operator, type SortKey, type StockRow,
} from "@/lib/data-provider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { ImportDataDialog } from "@/components/ImportDataDialog";
import { useDataProvider } from "@/hooks/use-data-provider";

const OPERATORS: { key: Operator; label: string }[] = [
  { key: "gt", label: ">" },
  { key: "lt", label: "<" },
  { key: "between", label: "Between" },
  { key: "eq", label: "=" },
];

const CATEGORIES = ["Valuation", "Profitability", "Leverage", "Growth"] as const;

type Preset = { name: string; filters: FilterCondition[] };

const PRESETS: Preset[] = [
  { name: "Large Cap (>₹50K Cr)", filters: [{ metric: "market_cap", operator: "gt", value: 50000 }] },
  { name: "High ROCE (>20%)", filters: [{ metric: "roce", operator: "gt", value: 20 }] },
  { name: "High ROE (>15%)", filters: [{ metric: "roe", operator: "gt", value: 15 }] },
  { name: "Low Debt (D/E<0.5)", filters: [{ metric: "debt_equity", operator: "lt", value: 0.5 }] },
  { name: "Low P/E (<20)", filters: [{ metric: "pe", operator: "lt", value: 20 }, { metric: "pe", operator: "gt", value: 0 }] },
  { name: "High P/E (>30)", filters: [{ metric: "pe", operator: "gt", value: 30 }] },
  { name: "Value (P/B<2)", filters: [{ metric: "price_book", operator: "lt", value: 2 }, { metric: "price_book", operator: "gt", value: 0 }] },
  { name: "Dividend Stars (>3%)", filters: [{ metric: "dividend_yield", operator: "gt", value: 3 }] },
  { name: "Growth (Sales & Profit >10%)", filters: [{ metric: "sales_growth", operator: "gt", value: 10 }, { metric: "profit_growth", operator: "gt", value: 10 }] },
  { name: "Quality Compounders", filters: [{ metric: "roce", operator: "gt", value: 15 }, { metric: "roe", operator: "gt", value: 12 }, { metric: "debt_equity", operator: "lt", value: 0.5 }] },
];

// Form state keeps raw strings so inputs can be edited freely; converted on query.
interface FilterRow {
  id: string;
  metric: MetricKey;
  operator: Operator;
  value: string;
  value2: string;
}

const ok = (n: number) => Number.isFinite(n);

function formatMarketCap(val: number) {
  if (!ok(val)) return "—";
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K Cr`;
  return `₹${val.toFixed(0)} Cr`;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function Screener() {
  const navigate = useNavigate();
  const provider = useDataProvider();
  const [importOpen, setImportOpen] = useState(false);

  const [universe, setUniverse] = useState<StockRow[]>([]);
  const [rows, setRows] = useState<FilterRow[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("market_cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUniverse(await provider.getUniverse());
    } catch (err) {
      console.error("Screener data load failed:", err);
      setError("Could not load company data from the active data provider.");
      setUniverse([]);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => { load(); }, [load]);

  const conditions = useMemo<FilterCondition[]>(
    () =>
      rows.flatMap((r) => {
        if (r.value.trim() === "" || !Number.isFinite(Number(r.value))) return [];
        const c: FilterCondition = { metric: r.metric, operator: r.operator, value: Number(r.value) };
        if (r.operator === "between") {
          if (r.value2.trim() === "" || !Number.isFinite(Number(r.value2))) return [];
          c.value2 = Number(r.value2);
        }
        return [c];
      }),
    [rows],
  );

  const results = useMemo(
    () => runScreen(universe, { filters: conditions, sortKey, sortDir }),
    [universe, conditions, sortKey, sortDir],
  );

  const addFilter = () => setRows((f) => [...f, { id: crypto.randomUUID(), metric: "roce", operator: "gt", value: "", value2: "" }]);
  const updateFilter = (id: string, field: keyof FilterRow, value: string) =>
    setRows((f) => f.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  const removeFilter = (id: string) => setRows((f) => f.filter((x) => x.id !== id));
  const applyPreset = (preset: Preset) => {
    setRows(preset.filters.map((f) => ({
      id: crypto.randomUUID(),
      metric: f.metric,
      operator: f.operator,
      value: String(f.value),
      value2: f.value2 === undefined ? "" : String(f.value2),
    })));
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportCSV = () => {
    const cols: { label: string; get: (r: StockRow) => string | number }[] = [
      { label: "Symbol", get: (r) => r.symbol },
      { label: "Company", get: (r) => r.name },
      { label: "Sector", get: (r) => r.sector },
      { label: "Industry", get: (r) => r.industry },
      ...METRICS.map((m) => ({ label: `${m.label} (${m.unit})`, get: (r: StockRow) => r[m.key] })),
    ];
    const csv = [cols.map((c) => csvCell(c.label)), ...results.map((r) => cols.map((c) => csvCell(c.get(r))))]
      .map((line) => line.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `screener_${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveScreen = () => {
    const name = prompt("Name this screen:");
    if (!name) return;
    try {
      const saved = JSON.parse(localStorage.getItem("funda-screens") || "[]");
      saved.push({ name, filters: conditions });
      localStorage.setItem("funda-screens", JSON.stringify(saved));
    } catch {
      // localStorage unavailable — nothing to persist to
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-foreground">Stock Screener</h1>
              <DataSourceBadge />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Fundamentals screener · {results.length} of {universe.length} companies match
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Import data</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export</Button>
            <Button variant="outline" size="sm" onClick={saveScreen}><Save className="h-4 w-4 mr-1" />Save</Button>
            <Button variant="outline" size="sm" onClick={() => setRows([])}><RotateCcw className="h-4 w-4 mr-1" />Reset</Button>
          </div>
        </div>
      </motion.div>

      <ImportDataDialog open={importOpen} onOpenChange={setImportOpen} />

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
        </div>
        {rows.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2 flex-wrap">
            {i > 0 && <Badge variant="outline" className="text-xs">AND</Badge>}
            <Select value={f.metric} onValueChange={(v) => updateFilter(f.id, "metric", v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => {
                  const items = METRICS.filter((m) => m.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                      {items.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={f.operator} onValueChange={(v) => updateFilter(f.id, "operator", v)}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{OPERATORS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={f.value} onChange={(e) => updateFilter(f.id, "value", e.target.value)}
              placeholder={`Value (${METRICS.find((m) => m.key === f.metric)?.unit ?? ""})`} className="w-32" type="number" />
            {f.operator === "between" && (
              <Input value={f.value2} onChange={(e) => updateFilter(f.id, "value2", e.target.value)}
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
            {loading ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</span> : `${results.length} companies found`}
          </span>
          {provider.isDemo && results.length >= 2 && (
            <button onClick={() => navigate(`/compare?symbols=${results.slice(0, 2).map((r) => r.symbol).join(",")}`)}
              className="text-xs text-primary hover:underline font-medium">Compare Top 2 →</button>
          )}
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {([
                  { key: "symbol", label: "Symbol" },
                  { key: "name", label: "Company" },
                  { key: "sector", label: "Sector" },
                  { key: "price", label: "Price" },
                  { key: "pe", label: "P/E" },
                  { key: "roce", label: "ROCE" },
                  { key: "roe", label: "ROE" },
                  { key: "debt_equity", label: "D/E" },
                  { key: "dividend_yield", label: "Div%" },
                  { key: "price_book", label: "P/B" },
                  { key: "fcf_yield", label: "FCF%" },
                  { key: "sales_growth", label: "Sales G" },
                  { key: "profit_growth", label: "Profit G" },
                  { key: "market_cap", label: "MCap" },
                ] as { key: SortKey; label: string }[]).map((col) => (
                  <th key={col.key} onClick={() => toggleSort(col.key)}
                    className="data-header cursor-pointer hover:text-foreground group whitespace-nowrap">
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
                <tr key={c.symbol} onClick={provider.isDemo ? () => navigate(`/company/${c.symbol}`) : undefined}
                  className={`border-b border-border/30 last:border-0 hover:bg-accent/50 transition-colors ${provider.isDemo ? "cursor-pointer" : ""}`}>
                  <td className="data-cell font-bold text-primary">{c.symbol}</td>
                  <td className="data-cell text-foreground whitespace-nowrap max-w-[180px] truncate">{c.name}</td>
                  <td className="data-cell text-muted-foreground whitespace-nowrap">{c.sector}</td>
                  <td className="data-cell font-mono text-foreground">{ok(c.price) ? `₹${c.price.toLocaleString()}` : "—"}</td>
                  <td className="data-cell font-mono text-foreground">{c.pe > 0 ? c.pe.toFixed(1) : "—"}</td>
                  <td className={`data-cell font-mono ${c.roce > 15 ? "text-positive" : c.roce > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.roce > 0 ? `${c.roce}%` : "—"}
                  </td>
                  <td className={`data-cell font-mono ${c.roe > 15 ? "text-positive" : c.roe > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.roe > 0 ? `${c.roe}%` : "—"}
                  </td>
                  <td className={`data-cell font-mono ${c.debt_equity > 1 ? "text-negative" : c.debt_equity > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.debt_equity > 0 ? c.debt_equity.toFixed(2) : "—"}
                  </td>
                  <td className={`data-cell font-mono ${c.dividend_yield > 2 ? "text-positive" : c.dividend_yield > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.dividend_yield > 0 ? `${c.dividend_yield}%` : "—"}
                  </td>
                  <td className="data-cell font-mono text-foreground">{c.price_book > 0 ? c.price_book.toFixed(1) : "—"}</td>
                  <td className={`data-cell font-mono ${c.fcf_yield > 5 ? "text-positive" : c.fcf_yield > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.fcf_yield > 0 ? `${c.fcf_yield}%` : "—"}
                  </td>
                  <td className={`data-cell font-mono ${c.sales_growth > 0 ? "text-positive" : c.sales_growth < 0 ? "text-negative" : "text-muted-foreground"}`}>
                    {ok(c.sales_growth) && c.sales_growth !== 0 ? `${c.sales_growth > 0 ? "+" : ""}${c.sales_growth}%` : "—"}
                  </td>
                  <td className={`data-cell font-mono ${c.profit_growth > 0 ? "text-positive" : c.profit_growth < 0 ? "text-negative" : "text-muted-foreground"}`}>
                    {ok(c.profit_growth) && c.profit_growth !== 0 ? `${c.profit_growth > 0 ? "+" : ""}${c.profit_growth}%` : "—"}
                  </td>
                  <td className="data-cell font-mono text-foreground">{formatMarketCap(c.market_cap)}</td>
                </tr>
              ))}
              {!loading && results.length === 0 && (
                <tr><td colSpan={14} className="px-4 py-12 text-center text-muted-foreground">No stocks match your criteria. Try adjusting filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

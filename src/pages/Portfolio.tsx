import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { Cell, Pie, PieChart as RPieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MetricStore, PortfolioHolding } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyName } from "@/components/common/CompanyName";
import { DatasetGate } from "@/components/common/DatasetGate";
import { EmptyState } from "@/components/common/EmptyState";
import { ValueCell } from "@/components/common/ValueCell";
import { PageTransition } from "@/components/PageTransition";
import { usePortfolio } from "@/hooks/use-portfolio";
import { formatInr, formatNumberIN, formatPercent } from "@/lib/format/indian";
import { localDateStamp } from "@/lib/time/clock";
import { parseIsoDate } from "@/lib/time/civil";
import { valuePortfolio } from "@/lib/user/portfolio-valuation";

const SECTOR_COLORS = [
  "hsl(var(--primary))", "hsl(var(--chart-green))", "hsl(var(--chart-amber))", "hsl(var(--chart-red))",
  "hsl(var(--chart-cyan))", "hsl(var(--chart-blue))", "hsl(280, 60%, 55%)", "hsl(30, 80%, 55%)",
];

const signed = (text: string, v: number) => (v > 0 ? `+${text}` : text);
const tone = (v: number | null) => (v === null ? "" : v > 0 ? "text-positive" : v < 0 ? "text-negative" : "");

function Kpi({ label, value, note, className }: { label: string; value: string; note?: string; className?: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-bold ${className ?? "text-foreground"}`}>{value}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function AddHolding({ store, onAdd, onClose }: { store: MetricStore; onAdd: (h: PortfolioHolding) => boolean; onClose: () => void }) {
  const listId = useId();
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(() => localDateStamp());
  const [message, setMessage] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = symbol.trim().toUpperCase();
    const q = Number(qty);
    const c = Number(cost);
    if (!sym) return setMessage("Enter a symbol.");
    if (!Number.isFinite(q) || q <= 0) return setMessage("Quantity must be a number above zero.");
    if (cost.trim() === "" || !Number.isFinite(c) || c < 0) return setMessage("Average cost must be zero or more.");
    if (!parseIsoDate(date)) return setMessage("Enter the purchase date.");
    if (!onAdd({ symbol: sym, qty: q, avgCost: c, buyDate: date })) return setMessage("The holding could not be saved.");
    setMessage(null);
    setSymbol("");
    setQty("");
    setCost("");
    onClose();
  };

  return (
    <form onSubmit={submit} className="glass-card space-y-3 p-3" aria-label="Add a holding">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          Symbol
          <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} list={listId} className="min-h-11 text-sm text-foreground sm:min-h-9" autoComplete="off" />
          <datalist id={listId}>
            {store.symbols.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Quantity
          <Input value={qty} onChange={(e) => setQty(e.target.value)} type="number" inputMode="decimal" min="0" step="any" className="min-h-11 text-sm text-foreground sm:min-h-9" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Average cost per share (₹)
          <Input value={cost} onChange={(e) => setCost(e.target.value)} type="number" inputMode="decimal" min="0" step="any" className="min-h-11 text-sm text-foreground sm:min-h-9" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Purchase date
          <Input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="min-h-11 text-sm text-foreground sm:min-h-9" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        A symbol that is not in your current data is still saved. It is listed separately and left out of the totals.
      </p>
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="min-h-11 gap-1 sm:min-h-9"><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add holding</Button>
        <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-9" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

function PortfolioView({ store }: { store: MetricStore }) {
  const { holdings, add, remove } = usePortfolio();
  const [showAdd, setShowAdd] = useState(false);
  const v = useMemo(() => valuePortfolio(store, holdings), [store, holdings]);
  const roce = store.def("roce");
  const pe = store.def("pe");

  const sectors = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of v.rows) if (r.value !== null) map.set(store.sector(r.index), (map.get(store.sector(r.index)) ?? 0) + r.value);
    return [...map.entries()]
      .map(([name, value]) => ({ name, value, pct: v.totals.value > 0 ? (value / v.totals.value) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [v, store]);

  const priceDateText = v.priceDate ?? "not provided";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Holdings are valued at the reference price in your data (price date: {priceDateText}
          {v.mixedPriceDates ? ", latest of several" : ""}). These are not live prices.
        </p>
        <Button type="button" size="sm" variant="outline" className="min-h-11 gap-1 sm:min-h-9" onClick={() => setShowAdd((s) => !s)} aria-expanded={showAdd}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add holding
        </Button>
      </div>

      {showAdd && <AddHolding store={store} onAdd={add} onClose={() => setShowAdd(false)} />}

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="No holdings yet"
          description="Add what you hold to see it valued from the loaded data. Everything you enter stays in this browser."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Kpi label="Invested" value={formatInr(v.totals.invested, 0)} note={v.totals.pricedCount < holdings.length ? `${v.totals.pricedCount} of ${holdings.length} holdings` : undefined} />
            <Kpi label="Value" value={formatInr(v.totals.value, 0)} />
            <Kpi
              label="Gain or loss"
              value={`${signed(formatInr(v.totals.gain, 0), v.totals.gain)}${v.totals.gainPct !== null ? ` (${signed(formatPercent(v.totals.gainPct, 1), v.totals.gainPct)})` : ""}`}
              className={tone(v.totals.gain) || "text-foreground"}
            />
            <Kpi
              label="Annual return (XIRR)"
              value={v.xirr === null ? "Not available" : formatPercent(v.xirr * 100, 1)}
              note={v.xirrNote ?? "Uses your purchase dates and the price date."}
              className={v.xirr === null ? "text-muted-foreground" : tone(v.xirr)}
            />
          </div>

          <Tabs defaultValue="holdings">
            <TabsList className="mb-2">
              <TabsTrigger value="holdings" className="min-h-9 px-3 text-xs">Holdings</TabsTrigger>
              <TabsTrigger value="allocation" className="min-h-9 px-3 text-xs">Sector split</TabsTrigger>
            </TabsList>

            <TabsContent value="holdings">
              <div className="glass-card relative overflow-x-auto scrollbar-thin">
                <table className="w-full text-xs">
                  <caption className="sr-only">Holdings valued at the reference price in your data</caption>
                  <thead>
                    <tr className="border-b border-border/60">
                      {["Company", "Qty", "Avg cost", "Reference price", "Invested", "Value", "Gain or loss", "Gain %"].map((h) => (
                        <th key={h} scope="col" className="data-header">{h}</th>
                      ))}
                      {roce && <th scope="col" className="data-header">{roce.short}</th>}
                      {pe && <th scope="col" className="data-header">{pe.short}</th>}
                      <th scope="col" className="data-header"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.rows.map((r, i) => (
                      <motion.tr key={`${r.holding.symbol}-${r.holdingIndex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 10) * 0.03 }} className="border-b border-border/20 hover:bg-accent/20">
                        <th scope="row" className="data-cell text-left font-sans">
                          <Link to={`/company/${encodeURIComponent(r.holding.symbol)}`} className="block min-h-11 font-medium text-primary hover:underline sm:min-h-0">
                            {r.holding.symbol}
                            <span className="block text-xs font-normal text-muted-foreground">
                              <CompanyName name={store.company(r.index).name} isSynthetic={store.meta.isSynthetic} />
                            </span>
                          </Link>
                        </th>
                        <td className="data-cell">{formatNumberIN(r.holding.qty, 0)}</td>
                        <td className="data-cell">{formatInr(r.holding.avgCost, 2)}</td>
                        <td className="data-cell">{r.price === null ? "No price" : formatInr(r.price, 2)}</td>
                        <td className="data-cell">{formatInr(r.invested, 0)}</td>
                        <td className="data-cell">{r.value === null ? "—" : formatInr(r.value, 0)}</td>
                        <td className={`data-cell ${tone(r.gain)}`}>{r.gain === null ? "—" : signed(formatInr(r.gain, 0), r.gain)}</td>
                        <td className={`data-cell ${tone(r.gainPct)}`}>{r.gainPct === null ? "—" : signed(formatPercent(r.gainPct, 1), r.gainPct)}</td>
                        {roce && <td className="data-cell"><ValueCell def={roce} value={store.get(roce.id, r.index)} family={store.family(r.index)} /></td>}
                        {pe && <td className="data-cell"><ValueCell def={pe} value={store.get(pe.id, r.index)} family={store.family(r.index)} /></td>}
                        <td className="data-cell">
                          <button type="button" onClick={() => remove(r.holdingIndex)} aria-label={`Remove ${r.holding.symbol} holding`} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-negative sm:h-8 sm:w-8">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="allocation">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="glass-card p-4">
                  <h2 className="section-title">Value by sector</h2>
                  <div className="mt-3 h-56" aria-hidden="true">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie data={sectors} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2} strokeWidth={0}>
                          {sectors.map((s, i) => <Cell key={s.name} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }} formatter={(x: number) => formatInr(x, 0)} />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="glass-card p-4">
                  <h2 className="section-title">Breakdown</h2>
                  {sectors.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No priced holdings to split.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {sectors.map((s, i) => (
                        <li key={s.name} className="flex items-center gap-2 text-sm">
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} aria-hidden="true" />
                          <span className="flex-1 text-foreground">{s.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{formatInr(s.value, 0)}</span>
                          <span className="w-14 text-right font-mono text-xs font-medium text-foreground">{formatPercent(s.pct, 1)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {v.missing.length > 0 && (
            <section aria-labelledby="pf-missing-title" className="space-y-2">
              <h2 id="pf-missing-title" className="section-title">Not in your current data ({v.missing.length})</h2>
              <p className="text-xs text-muted-foreground">
                These holdings are saved, but the loaded data has no company with that symbol, so they are not valued and are left out of the totals.
              </p>
              <ul className="glass-card divide-y divide-border/30">
                {v.missing.map(({ holding, holdingIndex }) => (
                  <li key={`${holding.symbol}-${holdingIndex}`} className="flex items-center justify-between gap-3 px-3 py-1 text-sm">
                    <span>
                      <span className="font-mono font-semibold text-foreground">{holding.symbol}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatNumberIN(holding.qty, 0)} shares at {formatInr(holding.avgCost, 2)}, bought {holding.buyDate}
                      </span>
                    </span>
                    <button type="button" onClick={() => remove(holdingIndex)} aria-label={`Remove ${holding.symbol} holding`} className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-negative sm:h-9 sm:w-9">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {v.unpriced.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {v.unpriced.map((r) => r.holding.symbol).join(", ")} {v.unpriced.length === 1 ? "has" : "have"} no reference price in your data, so {v.unpriced.length === 1 ? "it is" : "they are"} left out of the totals.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function Portfolio() {
  return (
    <PageTransition>
      <div className="container max-w-7xl space-y-4 py-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold text-foreground">Portfolio</h1>
        </div>
        <DatasetGate>{({ store }) => <PortfolioView store={store} />}</DatasetGate>
      </div>
    </PageTransition>
  );
}

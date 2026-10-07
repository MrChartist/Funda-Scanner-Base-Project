import { useCallback, useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, BarChart3, Calculator, Copy, Info, Layers, Target } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area,
} from "recharts";
import type { MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyName } from "@/components/common/CompanyName";
import { DatasetGate } from "@/components/common/DatasetGate";
import { PageTransition } from "@/components/PageTransition";
import { calculateDCF, calculateWACC, monteCarloSimulation, reverseImpliedGrowth, summariseSimulation, type DCFInputs, type WACCInputs } from "@/lib/dcf";
import { formatInr, formatInrCrore, formatNumberIN, formatPercent } from "@/lib/format/indian";
import { nullReasonText } from "@/lib/format/metric-value";

const MC_RUNS = 3000;
const TOOLTIP_STYLE = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };

// ─── Inputs read from the loaded data ────────────────────────────
export interface DcfDefaults {
  symbol: string;
  name: string;
  /** Average of the last three years' free cash flow (₹ crore); null with a reason when not available. */
  fcf: number | null;
  fcfNote: string | null;
  shares: number | null;
  netDebt: number | null;
  price: number | null;
  priceDate: string | null;
  history: { label: string; fcf: number }[];
}

export function dcfDefaults(store: MetricStore, index: number): DcfDefaults {
  const years = [0, 1, 2].map((offset) => store.at("fcf", index, { freq: "fy", offset }));
  const allThree = years.every((y) => y.v !== null);
  let fcf: number | null = null;
  let fcfNote: string | null = null;
  if (allThree) fcf = years.reduce((s, y) => s + (y.v ?? 0), 0) / 3;
  else {
    const missing = years.find((y) => y.v === null);
    fcfNote = missing?.reason ? nullReasonText(missing.reason, store.family(index)).long : "Free cash flow for the last three years is not available.";
  }
  const history: DcfDefaults["history"] = [];
  for (let offset = 4; offset >= 0; offset--) {
    const v = store.at("fcf", index, { freq: "fy", offset });
    const label = store.periodLabel(index, { freq: "fy", offset });
    if (v.v !== null && label) history.push({ label, fcf: v.v });
  }
  const company = store.company(index);
  return {
    symbol: store.symbols[index],
    name: company.name,
    fcf,
    fcfNote,
    shares: company.market.shares_outstanding,
    netDebt: store.get("net_debt", index).v,
    price: store.get("price", index).v,
    priceDate: company.market.price_date,
    history,
  };
}

// ─── Small pieces ────────────────────────────────────────────────
function NumberField({ label, value, onChange, unit, hint, step = "any", min }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; hint?: string; step?: string; min?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}{unit ? ` (${unit})` : ""}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-h-11 w-full rounded-md border border-input bg-card px-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 sm:min-h-9"
      />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="font-mono text-sm text-foreground">{formatNumberIN(value, step < 1 ? 2 : 0)} {unit}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-primary"
      />
    </div>
  );
}

function SensitivityTable({ inputs }: { inputs: DCFInputs }) {
  const growth = [-2, -1, 0, 1, 2].map((d) => inputs.growthRate + d);
  const discount = [-2, -1, 0, 1, 2].map((d) => inputs.discountRate + d);
  const base = calculateDCF(inputs).perShare;
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Model value per share for different growth and discount rates</caption>
        <thead>
          <tr className="border-b border-border/60">
            <th scope="col" className="data-header">Growth ↓ / Discount rate →</th>
            {discount.map((dr) => <th key={dr} scope="col" className="data-header text-right">{formatNumberIN(dr, 1)}%</th>)}
          </tr>
        </thead>
        <tbody>
          {growth.map((gr) => (
            <tr key={gr} className="border-b border-border/20">
              <th scope="row" className="data-cell text-left font-medium">{formatNumberIN(gr, 1)}%</th>
              {discount.map((dr) => {
                const v = calculateDCF({ ...inputs, growthRate: gr, discountRate: dr }).perShare;
                const centre = gr === inputs.growthRate && dr === inputs.discountRate;
                return (
                  <td key={dr} className={`data-cell text-right ${centre ? "bg-primary/10 font-bold text-primary" : Number.isFinite(v) && Number.isFinite(base) ? (v > base ? "text-positive" : "text-negative") : ""}`}>
                    {Number.isFinite(v) ? formatInr(v, 0) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiscountRateHelper({ onApply }: { onApply: (rate: number) => void }) {
  const [w, setW] = useState<{ [K in keyof WACCInputs]: string }>({
    riskFreeRate: "7", beta: "1", equityRiskPremium: "6", costOfDebt: "8", taxRate: "25", debtToEquity: "0.3",
  });
  const parsed: WACCInputs = {
    riskFreeRate: Number(w.riskFreeRate), beta: Number(w.beta), equityRiskPremium: Number(w.equityRiskPremium),
    costOfDebt: Number(w.costOfDebt), taxRate: Number(w.taxRate), debtToEquity: Number(w.debtToEquity),
  };
  const wacc = calculateWACC(parsed);
  const ok = Number.isFinite(wacc);
  const set = (k: keyof WACCInputs) => (v: string) => setW((p) => ({ ...p, [k]: v }));
  return (
    <details className="glass-card p-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-semibold text-foreground sm:min-h-0">
        <span className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" aria-hidden="true" /> Discount rate helper</span>
        <span className="font-mono text-xs text-muted-foreground">{ok ? formatPercent(wacc, 2) : "—"}</span>
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          The starting values are placeholders for you to change. They are not taken from your data or from the market.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Risk-free rate" unit="%" value={w.riskFreeRate} onChange={set("riskFreeRate")} />
          <NumberField label="Beta" value={w.beta} onChange={set("beta")} />
          <NumberField label="Equity risk premium" unit="%" value={w.equityRiskPremium} onChange={set("equityRiskPremium")} />
          <NumberField label="Cost of debt" unit="%" value={w.costOfDebt} onChange={set("costOfDebt")} />
          <NumberField label="Tax rate" unit="%" value={w.taxRate} onChange={set("taxRate")} />
          <NumberField label="Debt to equity" unit="x" value={w.debtToEquity} onChange={set("debtToEquity")} />
        </div>
        <Button type="button" size="sm" disabled={!ok} className="min-h-11 sm:min-h-9" onClick={() => onApply(Math.min(20, Math.max(5, Math.round(wacc * 4) / 4)))}>
          Use {ok ? formatPercent(wacc, 2) : "—"} as the discount rate
        </Button>
      </div>
    </details>
  );
}

// ─── The model for one company ───────────────────────────────────
function DcfModel({ defaults }: { defaults: DcfDefaults }) {
  const [fcfText, setFcfText] = useState(defaults.fcf === null ? "" : String(Math.round(defaults.fcf)));
  const [sharesText, setSharesText] = useState(defaults.shares === null ? "" : String(defaults.shares));
  const [netDebtText, setNetDebtText] = useState(defaults.netDebt === null ? "" : String(Math.round(defaults.netDebt)));
  const [a, setA] = useState({
    growthRate: 12, years: 5, stage2Growth: 6, stage2Years: 5, terminalGrowth: 3, discountRate: 10, exitMultiple: 15,
    terminalMethod: "perpetuity" as DCFInputs["terminalMethod"],
  });
  const patch = useCallback(<K extends keyof typeof a>(k: K, v: (typeof a)[K]) => setA((p) => ({ ...p, [k]: v })), []);

  const fcf = fcfText.trim() === "" ? null : Number(fcfText);
  const shares = sharesText.trim() === "" ? null : Number(sharesText);
  const netDebt = netDebtText.trim() === "" ? null : Number(netDebtText);
  const ready = fcf !== null && Number.isFinite(fcf) && fcf > 0 && shares !== null && Number.isFinite(shares) && shares > 0 && netDebt !== null && Number.isFinite(netDebt);

  const inputs = useMemo<DCFInputs | null>(
    () => (ready ? { symbol: defaults.symbol, fcf: fcf as number, sharesOutstanding: shares as number, netDebt: netDebt as number, ...a } : null),
    [ready, defaults.symbol, fcf, shares, netDebt, a],
  );

  const result = useMemo(() => (inputs ? calculateDCF(inputs) : null), [inputs]);
  const simulation = useMemo(() => (inputs ? monteCarloSimulation(inputs, MC_RUNS) : []), [inputs]);
  const summary = useMemo(() => summariseSimulation(simulation), [simulation]);
  const impliedGrowth = useMemo(
    () => (inputs && defaults.price !== null && defaults.price > 0 ? reverseImpliedGrowth(inputs, defaults.price) : null),
    [inputs, defaults.price],
  );

  const histogram = useMemo(() => {
    if (simulation.length === 0) return [];
    const min = simulation[0];
    const width = (simulation[simulation.length - 1] - min) / 30 || 1;
    const buckets = Array.from({ length: 30 }, (_, i) => ({ label: formatInr(min + i * width, 0), count: 0, mid: min + (i + 0.5) * width }));
    for (const v of simulation) buckets[Math.min(29, Math.floor((v - min) / width))].count += 1;
    return buckets;
  }, [simulation]);

  const projection = useMemo(() => {
    if (!result) return [];
    return [
      ...defaults.history.map((h) => ({ year: h.label, historical: Math.round(h.fcf) as number | undefined, projected: undefined as number | undefined })),
      ...result.projections.slice(1).map((p) => ({ year: `Year ${p.year}`, historical: undefined as number | undefined, projected: p.fcf as number | undefined })),
    ];
  }, [result, defaults.history]);

  const scenarios = useMemo(() => {
    if (!inputs) return [];
    const cases = [
      { label: "Lower case", growthRate: Math.max(0, a.growthRate - 5), stage2Growth: Math.max(0, a.stage2Growth - 3), terminalGrowth: Math.max(0, a.terminalGrowth - 1), discountRate: a.discountRate + 2 },
      { label: "Base case", growthRate: a.growthRate, stage2Growth: a.stage2Growth, terminalGrowth: a.terminalGrowth, discountRate: a.discountRate },
      { label: "Higher case", growthRate: a.growthRate + 5, stage2Growth: a.stage2Growth + 3, terminalGrowth: Math.min(a.discountRate - 1, a.terminalGrowth + 1), discountRate: Math.max(6, a.discountRate - 1.5) },
    ];
    return cases.map((c) => ({ ...c, value: calculateDCF({ ...inputs, ...c }).perShare }));
  }, [inputs, a]);

  const value = result && Number.isFinite(result.perShare) ? result.perShare : null;
  const diffPct = value !== null && defaults.price !== null && defaults.price > 0 ? ((value - defaults.price) / defaults.price) * 100 : null;
  const terminalShare = result && Number.isFinite(result.pvTerminal) && result.totalPV > 0 ? (result.pvTerminal / result.totalPV) * 100 : null;
  const perpetuityInvalid = a.terminalMethod === "perpetuity" && a.terminalGrowth >= a.discountRate;

  return (
    <div className="space-y-3">
      {defaults.fcfNote && (
        <p role="note" className="glass-card flex items-start gap-2 p-3 text-sm text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-chart-amber" aria-hidden="true" />
          <span>Base free cash flow could not be taken from your data: {defaults.fcfNote} You can enter a figure yourself below.</span>
        </p>
      )}
      {!ready && (
        <p role="status" className="glass-card p-3 text-sm text-muted-foreground">
          Enter a base free cash flow above zero, the shares outstanding and the net debt to see the model value. Nothing is filled in for you when your data has no figure.
        </p>
      )}
      {perpetuityInvalid && (
        <div role="alert" className="glass-card flex items-center gap-2 border-l-4 border-l-chart-amber p-3 text-sm text-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-chart-amber" aria-hidden="true" />
          Terminal growth must be lower than the discount rate for the perpetuity method. Change one of them to see a model value.
        </div>
      )}

      {ready && (
        <section aria-labelledby="dcf-result" className="glass-card space-y-2 p-3">
          <h2 id="dcf-result" className="sr-only">Result</h2>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Model value per share</p>
              <p className="text-2xl font-bold text-foreground" data-testid="dcf-value">{value === null ? "—" : formatInr(value, 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Reference price{defaults.priceDate ? ` (${defaults.priceDate})` : ""}</p>
              <p className="text-2xl font-bold text-foreground">{defaults.price === null ? "Not in your data" : formatInr(defaults.price, 2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Difference from reference price</p>
              <p className="font-mono text-lg font-bold text-foreground">{diffPct === null ? "—" : `${diffPct > 0 ? "+" : ""}${formatPercent(diffPct, 1)}`}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Growth that matches the reference price</p>
              <p className="font-mono text-lg font-bold text-primary">{impliedGrowth === null ? "—" : formatPercent(impliedGrowth, 1)}</p>
            </div>
          </div>
          {summary && (
            <p className="text-sm text-muted-foreground" data-testid="dcf-range">
              Across {formatNumberIN(MC_RUNS, 0)} runs with random changes to growth, discount rate and terminal growth, the 10th percentile is {formatInr(summary.p10, 0)},
              the median is {formatInr(summary.p50, 0)} and the 90th percentile is {formatInr(summary.p90, 0)}. The runs are repeatable for a given symbol.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            This is the output of your assumptions, not a forecast and not a recommendation. Small changes in the rates change it a lot.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-4">
          <DiscountRateHelper onApply={(r) => patch("discountRate", r)} />

          <section aria-labelledby="dcf-from-data" className="glass-card space-y-3 p-3">
            <h2 id="dcf-from-data" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> From your data
            </h2>
            <NumberField
              label="Base free cash flow" unit="₹ crore" value={fcfText} onChange={setFcfText}
              hint={defaults.fcf !== null ? "Average of the last three years in your data." : "Not available in your data. Enter a figure."}
            />
            <NumberField
              label="Shares outstanding" unit="crore" value={sharesText} onChange={setSharesText}
              hint={defaults.shares !== null ? "As supplied with your data." : "Not supplied with your data. Enter a figure."}
            />
            <NumberField
              label="Net debt" unit="₹ crore" value={netDebtText} onChange={setNetDebtText}
              hint={defaults.netDebt !== null ? "Debt less cash and investments; negative means net cash." : "Not available in your data. Enter a figure."}
            />
          </section>

          <section aria-labelledby="dcf-assumptions" className="glass-card space-y-3 p-3">
            <h2 id="dcf-assumptions" className="text-xs font-semibold uppercase tracking-wider text-foreground">Your assumptions</h2>
            <p className="text-xs text-muted-foreground">These rates are yours to choose. They are not taken from your data.</p>
            <Slider label="Stage 1 growth" value={a.growthRate} onChange={(v) => patch("growthRate", v)} min={0} max={40} step={0.5} unit="%" />
            <Slider label="Stage 1 length" value={a.years} onChange={(v) => patch("years", v)} min={3} max={15} step={1} unit="years" />
            <Slider label="Stage 2 growth (fades to)" value={a.stage2Growth} onChange={(v) => patch("stage2Growth", v)} min={0} max={20} step={0.5} unit="%" />
            <Slider label="Stage 2 length" value={a.stage2Years} onChange={(v) => patch("stage2Years", v)} min={0} max={10} step={1} unit="years" />
            <div role="group" aria-label="Terminal value method" className="flex gap-1">
              {(["perpetuity", "exitMultiple"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={a.terminalMethod === m}
                  onClick={() => patch("terminalMethod", m)}
                  className={`min-h-11 flex-1 rounded px-2 text-xs sm:min-h-9 ${a.terminalMethod === m ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}
                >
                  {m === "perpetuity" ? "Perpetuity growth" : "Exit multiple"}
                </button>
              ))}
            </div>
            {a.terminalMethod === "perpetuity" ? (
              <Slider label="Terminal growth" value={a.terminalGrowth} onChange={(v) => patch("terminalGrowth", v)} min={0} max={6} step={0.25} unit="%" />
            ) : (
              <Slider label="Exit multiple (value to free cash flow)" value={a.exitMultiple} onChange={(v) => patch("exitMultiple", v)} min={5} max={40} step={1} unit="x" />
            )}
            <Slider label="Discount rate" value={a.discountRate} onChange={(v) => patch("discountRate", v)} min={5} max={20} step={0.25} unit="%" />
          </section>
        </div>

        <div className="space-y-3 lg:col-span-8">
          {result && ready && (
            <>
              <section aria-labelledby="dcf-projection" className="glass-card p-3">
                <h2 id="dcf-projection" className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Free cash flow: past and projected (₹ crore)
                </h2>
                <div className="h-56" role="img" aria-label="Bar and area chart of past and projected free cash flow">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={projection} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickFormatter={(v: number) => formatNumberIN(v, 0)} width={64} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatInrCrore(v)} />
                      <Bar dataKey="historical" name="Past (your data)" fill="hsl(var(--muted-foreground))" opacity={0.6} radius={[2, 2, 0, 0]} />
                      <Area type="monotone" dataKey="projected" name="Projected (your assumptions)" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <section aria-labelledby="dcf-breakdown" className="glass-card p-3">
                  <h2 id="dcf-breakdown" className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">Where the value comes from</h2>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Present value of projected cash flows</dt><dd className="font-mono text-foreground">{formatInrCrore(result.pvFCFs)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Present value of terminal value</dt><dd className="font-mono text-foreground">{Number.isFinite(result.pvTerminal) ? formatInrCrore(result.pvTerminal) : "—"}</dd></div>
                    <div className="flex justify-between gap-2 border-t border-border/40 pt-2"><dt className="text-muted-foreground">Terminal value as a share of the total</dt><dd className="font-mono text-foreground">{terminalShare === null ? "—" : formatPercent(terminalShare, 0)}</dd></div>
                  </dl>
                  {terminalShare !== null && terminalShare > 75 && (
                    <p className="mt-2 text-xs text-muted-foreground">More than three-fourths of the value sits beyond the projection years, so the result depends heavily on the terminal assumptions.</p>
                  )}
                </section>

                <section aria-labelledby="dcf-scenarios" className="glass-card p-3">
                  <h2 id="dcf-scenarios" className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                    <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Three cases
                  </h2>
                  <ul className="space-y-1.5 text-sm">
                    {scenarios.map((s) => (
                      <li key={s.label} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">{s.label}</span>
                        <span className="text-xs text-muted-foreground">growth {formatNumberIN(s.growthRate, 0)}%, discount {formatNumberIN(s.discountRate, 1)}%</span>
                        <span className="font-mono font-semibold text-foreground">{Number.isFinite(s.value) ? formatInr(s.value, 0) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="glass-card p-3">
                <Tabs defaultValue="sensitivity">
                  <TabsList className="mb-2">
                    <TabsTrigger value="sensitivity" className="min-h-9 px-3 text-xs">Sensitivity table</TabsTrigger>
                    <TabsTrigger value="montecarlo" className="min-h-9 px-3 text-xs">Spread of outcomes</TabsTrigger>
                  </TabsList>
                  <TabsContent value="sensitivity">{inputs && <SensitivityTable inputs={inputs} />}</TabsContent>
                  <TabsContent value="montecarlo">
                    {summary ? (
                      <div className="space-y-2">
                        <div className="h-40" role="img" aria-label="Histogram of model values across the runs">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogram} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} interval={6} axisLine={false} />
                              <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} width={36} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              {defaults.price !== null && <ReferenceLine x={histogram.find((h) => h.mid >= (defaults.price ?? 0))?.label} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />}
                              <Bar dataKey="count" name="Runs" radius={[2, 2, 0, 0]}>
                                {histogram.map((h) => <Cell key={h.label} fill={h.mid < summary.p10 || h.mid > summary.p90 ? "hsl(var(--chart-amber))" : "hsl(var(--primary))"} opacity={0.75} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatNumberIN(MC_RUNS, 0)} runs. Growth varies by up to 5 points either way, the discount rate by 2 and terminal growth by 1. Runs with a value of zero or less are dropped; {formatNumberIN(summary.count, 0)} remain.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No run gave a usable value with these assumptions.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────
function DcfPage({ store }: { store: MetricStore }) {
  const [params, setParams] = useSearchParams();
  const requested = (params.get("symbol") ?? "").trim().toUpperCase();
  const requestedIndex = requested ? store.indexOf(requested) : -1;
  const index = requestedIndex >= 0 ? requestedIndex : store.size > 0 ? 0 : -1;
  const listId = useId();
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);

  if (index < 0) return <p className="text-sm text-muted-foreground">The loaded data has no companies.</p>;
  const defaults = dcfDefaults(store, index);

  const choose = (text: string) => {
    setTyped(text);
    const s = text.trim().toUpperCase();
    if (s && store.indexOf(s) >= 0) {
      setParams({ symbol: store.symbols[store.indexOf(s)] }, { replace: false });
      setTyped("");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dcf?symbol=${encodeURIComponent(defaults.symbol)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm text-foreground">
            <span className="font-mono font-semibold">{defaults.symbol}</span>{" "}
            <CompanyName name={defaults.name} isSynthetic={store.meta.isSynthetic} />
          </p>
          {requested && requestedIndex < 0 && (
            <p role="status" className="text-xs text-muted-foreground">{requested} is not in your current data, so {defaults.symbol} is shown.</p>
          )}
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <label htmlFor={`${listId}-in`} className="text-xs text-muted-foreground">Change company</label>
            <input
              id={`${listId}-in`}
              list={listId}
              value={typed}
              onChange={(e) => choose(e.target.value)}
              placeholder="Type a symbol"
              autoComplete="off"
              className="min-h-11 w-36 rounded-md border border-input bg-card px-2 font-mono text-sm text-foreground sm:min-h-9"
            />
            <datalist id={listId}>{store.symbols.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1 text-xs sm:min-h-9" onClick={copy}>
            <Copy className="h-3 w-3" aria-hidden="true" /> {copied ? "Link copied" : "Copy link"}
          </Button>
        </div>
      </div>
      <DcfModel key={defaults.symbol} defaults={defaults} />
    </div>
  );
}

export default function DCFCalculator() {
  return (
    <PageTransition>
      <div className="container max-w-7xl space-y-3 py-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h1 className="text-xl font-bold text-foreground">DCF calculator</h1>
            <p className="text-xs text-muted-foreground">
              A two-stage discounted cash flow model for study. Cash flow, shares and net debt come from your data; the rates are your assumptions.
            </p>
          </div>
        </div>
        <DatasetGate>{({ store }) => <DcfPage store={store} />}</DatasetGate>
      </div>
    </PageTransition>
  );
}

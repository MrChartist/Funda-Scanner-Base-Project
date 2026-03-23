import { useState } from "react";
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react";

interface QuarterlyRow {
  quarter: string; revenue: number; ebitda: number; depreciation: number;
  interest: number; pbt: number; tax: number; net_profit: number; opm_pct: number;
}

export function QuarterlyResults({ rows }: { rows: QuarterlyRow[] }) {
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = (a as any)[sortKey];
        const bv = (b as any)[sortKey];
        return sortDir === "asc" ? av - bv : bv - av;
      })
    : rows;

  const cols = [
    { key: "quarter", label: "Quarter", sticky: true },
    { key: "revenue", label: "Revenue" },
    { key: "ebitda", label: "EBITDA" },
    { key: "depreciation", label: "Depn" },
    { key: "interest", label: "Interest" },
    { key: "pbt", label: "PBT" },
    { key: "tax", label: "Tax" },
    { key: "net_profit", label: "Net Profit" },
    { key: "opm_pct", label: "OPM %" },
  ];

  const fmt = (v: number) => {
    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return v.toFixed(0);
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title">Quarterly Results</h2>
        {/* Mobile scroll hint */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground md:hidden">
          <ChevronLeft className="h-3 w-3" />
          <span>Scroll</span>
          <ChevronRight className="h-3 w-3" />
        </div>
      </div>
      <div className="relative">
        {/* Scroll fade indicators for mobile */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none md:hidden" />
        <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border/60">
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => c.key !== "quarter" && toggleSort(c.key)}
                    className={`data-header cursor-pointer hover:text-foreground transition-colors group ${
                      c.sticky ? "sticky left-0 bg-card z-10" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      {c.label}
                      {sortKey === c.key ? (
                        sortDir === "asc" ? <ChevronUp className="h-3 w-3 text-primary" /> : <ChevronDown className="h-3 w-3 text-primary" />
                      ) : c.key !== "quarter" ? (
                        <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-30 transition-opacity" />
                      ) : null}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const prevRow = sorted[i + 1];
                return (
                  <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="data-cell font-semibold text-foreground whitespace-nowrap sticky left-0 bg-card z-10">{r.quarter}</td>
                    <td className="data-cell text-foreground">
                      <span className="flex items-center gap-1">
                        {fmt(r.revenue)}
                        {prevRow && <GrowthArrow current={r.revenue} prev={prevRow.revenue} />}
                      </span>
                    </td>
                    <td className="data-cell text-foreground">{fmt(r.ebitda)}</td>
                    <td className="data-cell text-muted-foreground">{fmt(r.depreciation)}</td>
                    <td className="data-cell text-muted-foreground">{fmt(r.interest)}</td>
                    <td className="data-cell text-foreground">{fmt(r.pbt)}</td>
                    <td className="data-cell text-muted-foreground">{fmt(r.tax)}</td>
                    <td className={`data-cell font-semibold ${r.net_profit >= 0 ? "text-positive" : "text-negative"}`}>
                      {fmt(r.net_profit)}
                    </td>
                    <td className="data-cell">
                      <span className={`metric-badge ${
                        r.opm_pct >= 20 ? "bg-chart-green/10 text-positive" :
                        r.opm_pct < 10 ? "bg-chart-red/10 text-negative" :
                        "bg-muted text-foreground"
                      }`}>
                        {r.opm_pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GrowthArrow({ current, prev }: { current: number; prev: number }) {
  const growth = ((current - prev) / prev) * 100;
  if (Math.abs(growth) < 1) return null;
  return growth > 0
    ? <ArrowUpRight className="h-3 w-3 text-positive" />
    : <ArrowDownRight className="h-3 w-3 text-negative" />;
}

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    { key: "quarter", label: "Quarter" },
    { key: "revenue", label: "Revenue" },
    { key: "ebitda", label: "EBITDA" },
    { key: "depreciation", label: "Depn" },
    { key: "interest", label: "Interest" },
    { key: "pbt", label: "PBT" },
    { key: "tax", label: "Tax" },
    { key: "net_profit", label: "Net Profit" },
    { key: "opm_pct", label: "OPM %" },
  ];

  const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Quarterly Results</h2>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {cols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.key !== "quarter" && toggleSort(c.key)}
                  className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground"
                >
                  <span className="flex items-center gap-1">
                    {c.label}
                    {sortKey === c.key && (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r.quarter}</td>
                <td className="px-3 py-2 font-mono text-foreground">{fmt(r.revenue)}</td>
                <td className="px-3 py-2 font-mono text-foreground">{fmt(r.ebitda)}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{fmt(r.depreciation)}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{fmt(r.interest)}</td>
                <td className="px-3 py-2 font-mono text-foreground">{fmt(r.pbt)}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{fmt(r.tax)}</td>
                <td className={`px-3 py-2 font-mono font-semibold ${r.net_profit >= 0 ? "text-positive" : "text-negative"}`}>{fmt(r.net_profit)}</td>
                <td className={`px-3 py-2 font-mono font-semibold ${r.opm_pct >= 20 ? "text-positive" : r.opm_pct < 10 ? "text-negative" : "text-foreground"}`}>{r.opm_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

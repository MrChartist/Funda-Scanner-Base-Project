import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, Area } from "recharts";

interface FinRow {
  year: number; revenue: number; ebitda: number; depreciation: number;
  interest: number; pbt: number; tax: number; net_profit: number;
  total_assets: number; total_liabilities: number; equity: number;
  reserves: number; debt: number; ocf: number; icf: number;
}

function CustomFinTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 shadow-xl !bg-card/95 min-w-[160px]">
      <p className="text-xs text-muted-foreground font-semibold mb-2">FY {label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-4 py-0.5">
          <span className="text-xs flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="text-xs font-mono font-semibold text-foreground">{fmt(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

const fmt = (v: number) => {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

export function FinancialStatements({ rows }: { rows: FinRow[] }) {
  const chartData = rows.map((r) => ({
    year: r.year,
    Revenue: r.revenue,
    "Net Profit": r.net_profit,
    "Profit Margin": +(r.net_profit / r.revenue * 100).toFixed(1),
  }));

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">Financial Statements</h2>

      <div className="h-56 mb-5">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 30, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-green))" stopOpacity={0.9} />
                <stop offset="100%" stopColor="hsl(var(--chart-green))" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="year" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false} />
            <YAxis yAxisId="margin" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--chart-amber))" }} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} domain={[0, 'auto']} />
            <Tooltip content={<CustomFinTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Revenue" fill="url(#revGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Net Profit" fill="url(#profitGrad)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Line yAxisId="margin" type="monotone" dataKey="Profit Margin" stroke="hsl(var(--chart-amber))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-amber))" }} name="Margin %" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pnl" className="text-xs font-semibold">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs" className="text-xs font-semibold">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cf" className="text-xs font-semibold">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          <FinTable rows={rows} columns={[
            { key: "year", label: "Year" }, { key: "revenue", label: "Revenue" }, { key: "ebitda", label: "EBITDA" },
            { key: "depreciation", label: "Depn" }, { key: "interest", label: "Interest" },
            { key: "pbt", label: "PBT" }, { key: "tax", label: "Tax" }, { key: "net_profit", label: "Net Profit" },
          ]} highlight="net_profit" />
        </TabsContent>
        <TabsContent value="bs">
          <FinTable rows={rows} columns={[
            { key: "year", label: "Year" }, { key: "total_assets", label: "Total Assets" },
            { key: "total_liabilities", label: "Liabilities" }, { key: "equity", label: "Equity" },
            { key: "reserves", label: "Reserves" }, { key: "debt", label: "Debt" },
          ]} highlight="debt" highlightInverse />
        </TabsContent>
        <TabsContent value="cf">
          <FinTable rows={rows} columns={[
            { key: "year", label: "Year" }, { key: "ocf", label: "Operating CF" },
            { key: "icf", label: "Investing CF" }, { key: "net_profit", label: "Net Profit" },
          ]} highlight="ocf" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinTable({ rows, columns, highlight, highlightInverse }: {
  rows: any[]; columns: { key: string; label: string }[];
  highlight?: string; highlightInverse?: boolean;
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin mt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            {columns.map((c) => (
              <th key={c.key} className="data-header">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
              {columns.map((c) => {
                const val = r[c.key];
                const isHighlight = c.key === highlight;
                const isYear = c.key === "year";
                let colorClass = "text-foreground";
                if (isHighlight) {
                  if (highlightInverse) {
                    colorClass = val < rows[Math.max(0, i - 1)]?.[c.key] ? "text-positive font-semibold" : "text-foreground font-semibold";
                  } else {
                    colorClass = val > 0 ? "text-positive font-semibold" : "text-negative font-semibold";
                  }
                }
                return (
                  <td key={c.key} className={`data-cell ${isYear ? "font-semibold text-foreground" : colorClass}`}>
                    {isYear ? val : fmt(val)}
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

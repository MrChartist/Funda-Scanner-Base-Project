import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface FinRow {
  year: number; revenue: number; ebitda: number; depreciation: number;
  interest: number; pbt: number; tax: number; net_profit: number;
  total_assets: number; total_liabilities: number; equity: number;
  reserves: number; debt: number; ocf: number; icf: number;
}

export function FinancialStatements({ rows }: { rows: FinRow[] }) {
  const fmt = (v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0);

  const chartData = rows.map((r) => ({
    year: r.year,
    Revenue: r.revenue,
    "Net Profit": r.net_profit,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Financial Statements</h2>

      {/* Rev vs Profit Chart */}
      <div className="h-48 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmt(v)} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} formatter={(v: any) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Revenue" fill="hsl(var(--primary))" opacity={0.7} radius={[2, 2, 0, 0]} />
            <Bar dataKey="Net Profit" fill="hsl(var(--chart-green))" opacity={0.8} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Tabs defaultValue="pnl">
        <TabsList>
          <TabsTrigger value="pnl">P&L</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cf">Cash Flow</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl">
          <FinTable
            rows={rows}
            columns={[
              { key: "year", label: "Year" },
              { key: "revenue", label: "Revenue" },
              { key: "ebitda", label: "EBITDA" },
              { key: "depreciation", label: "Depn" },
              { key: "interest", label: "Interest" },
              { key: "pbt", label: "PBT" },
              { key: "tax", label: "Tax" },
              { key: "net_profit", label: "Net Profit" },
            ]}
            fmt={fmt}
          />
        </TabsContent>
        <TabsContent value="bs">
          <FinTable
            rows={rows}
            columns={[
              { key: "year", label: "Year" },
              { key: "total_assets", label: "Total Assets" },
              { key: "total_liabilities", label: "Total Liabilities" },
              { key: "equity", label: "Equity" },
              { key: "reserves", label: "Reserves" },
              { key: "debt", label: "Debt" },
            ]}
            fmt={fmt}
          />
        </TabsContent>
        <TabsContent value="cf">
          <FinTable
            rows={rows}
            columns={[
              { key: "year", label: "Year" },
              { key: "ocf", label: "Operating CF" },
              { key: "icf", label: "Investing CF" },
              { key: "net_profit", label: "Net Profit" },
            ]}
            fmt={fmt}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FinTable({ rows, columns, fmt }: { rows: any[]; columns: { key: string; label: string }[]; fmt: (v: number) => string }) {
  return (
    <div className="overflow-x-auto scrollbar-thin mt-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-accent/30">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 font-mono ${c.key === "year" ? "font-medium text-foreground" : "text-foreground"}`}>
                  {c.key === "year" ? r[c.key] : fmt(r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

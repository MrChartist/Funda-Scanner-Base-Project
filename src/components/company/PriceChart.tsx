import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, BarChart, CartesianGrid } from "recharts";
import { Button } from "@/components/ui/button";

interface PricePoint {
  date: string; open: number; high: number; low: number; close: number; volume: number;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "MAX", days: 9999 },
];

export function PriceChart({ priceHistory }: { priceHistory: PricePoint[] }) {
  const [range, setRange] = useState("1Y");
  const [showVolume, setShowVolume] = useState(true);

  const data = useMemo(() => {
    const r = RANGES.find((x) => x.label === range);
    const days = r?.days || 365;
    return priceHistory.slice(-days).map((p) => ({
      date: p.date,
      close: p.close,
      volume: p.volume,
      sma50: 0,
    }));
  }, [priceHistory, range]);

  // Calculate SMA
  useMemo(() => {
    for (let i = 0; i < data.length; i++) {
      if (i >= 49) {
        const sum = data.slice(i - 49, i + 1).reduce((s, d) => s + d.close, 0);
        data[i].sma50 = +(sum / 50).toFixed(2);
      }
    }
  }, [data]);

  const minPrice = Math.min(...data.map((d) => d.close)) * 0.98;
  const maxPrice = Math.max(...data.map((d) => d.close)) * 1.02;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-foreground">Price Chart</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  range === r.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              showVolume ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border"
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v.slice(5)} />
            <YAxis domain={[minPrice, maxPrice]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: any, name: string) => [`₹${Number(value).toFixed(2)}`, name === "close" ? "Price" : "SMA 50"]}
            />
            <Area type="monotone" dataKey="close" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} dot={false} />
            {data[data.length - 1]?.sma50 > 0 && (
              <Area type="monotone" dataKey="sma50" stroke="hsl(var(--chart-amber))" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {showVolume && (
        <div className="h-20 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <Bar dataKey="volume" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[1, 1, 0, 0]} />
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                formatter={(value: any) => [(Number(value) / 1000000).toFixed(2) + "M", "Volume"]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, ComposedChart, CartesianGrid, ReferenceLine } from "recharts";

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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const price = payload.find((p: any) => p.dataKey === "close");
  const sma = payload.find((p: any) => p.dataKey === "sma50");
  const vol = payload.find((p: any) => p.dataKey === "volume");

  return (
    <div className="glass-card p-3 shadow-xl !bg-card/95 min-w-[180px]">
      <p className="text-xs text-muted-foreground font-medium mb-2">{label}</p>
      {price && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Price</span>
          <span className="text-sm font-mono font-bold text-foreground">₹{Number(price.value).toFixed(2)}</span>
        </div>
      )}
      {sma && Number(sma.value) > 0 && (
        <div className="flex items-center justify-between gap-4 mt-1">
          <span className="text-xs text-chart-amber">SMA 50</span>
          <span className="text-sm font-mono font-semibold text-chart-amber">₹{Number(sma.value).toFixed(2)}</span>
        </div>
      )}
      {vol && (
        <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-border/50">
          <span className="text-xs text-muted-foreground">Volume</span>
          <span className="text-xs font-mono text-muted-foreground">{(Number(vol.value) / 1000000).toFixed(2)}M</span>
        </div>
      )}
    </div>
  );
}

export function PriceChart({ priceHistory }: { priceHistory: PricePoint[] }) {
  const [range, setRange] = useState("1Y");
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA, setShowSMA] = useState(true);

  const data = useMemo(() => {
    const r = RANGES.find((x) => x.label === range);
    const days = r?.days || 365;
    const sliced = priceHistory.slice(-days).map((p) => ({
      date: p.date,
      close: p.close,
      volume: p.volume,
      sma50: 0,
    }));
    // SMA calc
    for (let i = 0; i < sliced.length; i++) {
      if (i >= 49) {
        const sum = sliced.slice(i - 49, i + 1).reduce((s, d) => s + d.close, 0);
        sliced[i].sma50 = +(sum / 50).toFixed(2);
      }
    }
    return sliced;
  }, [priceHistory, range]);

  const minPrice = Math.min(...data.map((d) => d.close)) * 0.97;
  const maxPrice = Math.max(...data.map((d) => d.close)) * 1.03;
  const avgPrice = data.reduce((s, d) => s + d.close, 0) / data.length;
  const lastPrice = data[data.length - 1]?.close || 0;
  const firstPrice = data[0]?.close || 0;
  const periodChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
  const isUp = Number(periodChange) >= 0;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="section-title">Price Chart</h2>
          <span className={`metric-badge ${isUp ? "bg-chart-green/10 text-positive" : "bg-chart-red/10 text-negative"}`}>
            {isUp ? "+" : ""}{periodChange}% ({range})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/60 overflow-hidden bg-muted/30">
            {RANGES.map((r) => (
              <button
                key={r.label}
                onClick={() => setRange(r.label)}
                className={`px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  range === r.label
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowSMA(!showSMA)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
              showSMA ? "bg-chart-amber/10 text-chart-amber border-chart-amber/30" : "text-muted-foreground border-border/60"
            }`}
          >
            SMA
          </button>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-200 ${
              showVolume ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border/60"
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      <div className={showVolume ? "h-80" : "h-72"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0.2} />
                <stop offset="50%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0.05} />
                <stop offset="100%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => { const d = new Date(v); return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `₹${v.toFixed(0)}`}
              axisLine={false}
              tickLine={false}
              width={55}
            />
            {showVolume && (
              <YAxis
                yAxisId="volume"
                orientation="right"
                tick={false}
                axisLine={false}
                tickLine={false}
                domain={[0, (max: number) => max * 4]}
                width={0}
              />
            )}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 6" opacity={0.3} />
            {showVolume && (
              <Bar yAxisId="volume" dataKey="volume" fill="url(#volumeGradient)" radius={[2, 2, 0, 0]} maxBarSize={4} />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"}
              fill="url(#priceGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
            />
            {showSMA && data[data.length - 1]?.sma50 > 0 && (
              <Area
                type="monotone"
                dataKey="sma50"
                stroke="hsl(var(--chart-amber))"
                fill="none"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

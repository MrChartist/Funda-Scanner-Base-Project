import { useState, useMemo, useCallback, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, ComposedChart, CartesianGrid, ReferenceLine, Brush } from "recharts";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from "lucide-react";

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
  const open = payload.find((p: any) => p.dataKey === "open");
  const high = payload.find((p: any) => p.dataKey === "high");
  const low = payload.find((p: any) => p.dataKey === "low");

  return (
    <div className="glass-card p-3 shadow-xl !bg-card min-w-[200px] text-xs">
      <p className="font-medium text-foreground mb-2 border-b border-border/50 pb-1.5">
        {new Date(label).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      <div className="space-y-1">
        {open && <Row label="Open" value={`₹${Number(open.value).toFixed(2)}`} />}
        {high && <Row label="High" value={`₹${Number(high.value).toFixed(2)}`} color="text-positive" />}
        {low && <Row label="Low" value={`₹${Number(low.value).toFixed(2)}`} color="text-negative" />}
        {price && <Row label="Close" value={`₹${Number(price.value).toFixed(2)}`} bold />}
        {sma && Number(sma.value) > 0 && <Row label="SMA 50" value={`₹${Number(sma.value).toFixed(2)}`} color="text-chart-amber" />}
        {vol && (
          <div className="pt-1 mt-1 border-t border-border/30">
            <Row label="Volume" value={`${(Number(vol.value) / 1000000).toFixed(2)}M`} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-foreground" : "font-medium"} ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function PriceChart({ priceHistory }: { priceHistory: PricePoint[] }) {
  const [range, setRange] = useState("1Y");
  const [showVolume, setShowVolume] = useState(true);
  const [showSMA, setShowSMA] = useState(true);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [brushStart, setBrushStart] = useState<number | undefined>();
  const [brushEnd, setBrushEnd] = useState<number | undefined>();

  const data = useMemo(() => {
    const r = RANGES.find((x) => x.label === range);
    const days = r?.days || 365;
    const sliced = priceHistory.slice(-days).map((p) => ({
      date: p.date,
      close: p.close,
      open: p.open,
      high: p.high,
      low: p.low,
      volume: p.volume,
      sma50: 0,
    }));
    for (let i = 0; i < sliced.length; i++) {
      if (i >= 49) {
        const sum = sliced.slice(i - 49, i + 1).reduce((s, d) => s + d.close, 0);
        sliced[i].sma50 = +(sum / 50).toFixed(2);
      }
    }
    return sliced;
  }, [priceHistory, range]);

  const resetZoom = () => {
    setBrushStart(undefined);
    setBrushEnd(undefined);
  };

  const minPrice = Math.min(...data.map((d) => d.close)) * 0.97;
  const maxPrice = Math.max(...data.map((d) => d.close)) * 1.03;
  const avgPrice = data.reduce((s, d) => s + d.close, 0) / data.length;
  const lastPrice = data[data.length - 1]?.close || 0;
  const firstPrice = data[0]?.close || 0;
  const periodChange = ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
  const isUp = Number(periodChange) >= 0;

  // Price stats
  const highest = Math.max(...data.map(d => d.high));
  const lowest = Math.min(...data.map(d => d.low));
  const avgVol = data.reduce((s, d) => s + d.volume, 0) / data.length;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="section-title">Price Chart</h2>
          <span className={`metric-badge ${isUp ? "bg-chart-green/10 text-positive" : "bg-chart-red/10 text-negative"}`}>
            {isUp ? "+" : ""}{periodChange}% ({range})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-full border border-border/60 overflow-hidden bg-secondary/30">
            {RANGES.map((r) => (
              <button key={r.label} onClick={() => { setRange(r.label); resetZoom(); }}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                  range === r.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex gap-0.5 ml-1">
            <button onClick={() => setShowCrosshair(!showCrosshair)}
              className={`p-1.5 rounded-lg border text-xs transition-all ${showCrosshair ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border/60"}`}
              title="Crosshair">
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setShowSMA(!showSMA)}
              className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                showSMA ? "bg-chart-amber/10 text-chart-amber border-chart-amber/30" : "text-muted-foreground border-border/60"
              }`}>
              SMA
            </button>
            <button onClick={() => setShowVolume(!showVolume)}
              className={`px-2 py-1.5 text-[11px] font-semibold rounded-lg border transition-all ${
                showVolume ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border/60"
              }`}>
              Vol
            </button>
            <button onClick={resetZoom}
              className="p-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground transition-all"
              title="Reset zoom">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Price stats bar */}
      <div className="flex items-center gap-6 mb-3 text-[11px] text-muted-foreground overflow-x-auto scrollbar-thin pb-1">
        <span>High: <span className="font-mono font-medium text-foreground">₹{highest.toFixed(2)}</span></span>
        <span>Low: <span className="font-mono font-medium text-foreground">₹{lowest.toFixed(2)}</span></span>
        <span>Avg: <span className="font-mono font-medium text-foreground">₹{avgPrice.toFixed(2)}</span></span>
        <span>Avg Vol: <span className="font-mono font-medium text-foreground">{(avgVol / 1000000).toFixed(2)}M</span></span>
      </div>

      <div className={showVolume ? "h-80" : "h-72"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0.15} />
                <stop offset="100%" stopColor={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => { const d = new Date(v); return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(v) => `₹${v.toFixed(0)}`}
              axisLine={false} tickLine={false} width={55}
            />
            {showVolume && (
              <YAxis yAxisId="volume" orientation="right" tick={false} axisLine={false} tickLine={false}
                domain={[0, (max: number) => max * 4]} width={0}
              />
            )}
            <Tooltip
              content={<CustomTooltip />}
              cursor={showCrosshair ? {
                stroke: "hsl(var(--muted-foreground))",
                strokeWidth: 1,
                strokeDasharray: "4 4",
                strokeOpacity: 0.5,
              } : false}
            />
            <ReferenceLine y={avgPrice} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 6" opacity={0.2} />
            {/* Last price reference */}
            <ReferenceLine y={lastPrice} stroke={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"} strokeDasharray="3 3" opacity={0.4} />
            {showVolume && (
              <Bar yAxisId="volume" dataKey="volume" fill="url(#volumeGradient)" radius={[2, 2, 0, 0]} maxBarSize={4} />
            )}
            <Area type="monotone" dataKey="close"
              stroke={isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))"}
              fill="url(#priceGradient)" strokeWidth={2} dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "hsl(var(--card))", fill: isUp ? "hsl(var(--chart-green))" : "hsl(var(--chart-red))" }}
            />
            {showSMA && data[data.length - 1]?.sma50 > 0 && (
              <Area type="monotone" dataKey="sma50" stroke="hsl(var(--chart-amber))"
                fill="none" strokeWidth={1.5} strokeDasharray="6 3" dot={false}
              />
            )}
            {/* Brush for zoom/pan */}
            <Brush dataKey="date" height={24} stroke="hsl(var(--border))"
              fill="hsl(var(--secondary))"
              tickFormatter={(v) => { const d = new Date(v); return d.toLocaleDateString('en-IN', { month: 'short' }); }}
              startIndex={brushStart} endIndex={brushEnd}
              onChange={(e: any) => { setBrushStart(e.startIndex); setBrushEnd(e.endIndex); }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

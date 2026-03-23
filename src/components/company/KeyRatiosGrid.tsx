import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface Props {
  company: {
    market_cap: number; price: number; pe: number; pb?: number;
    roce: number; roe: number; eps: number; de: string | number;
    dividend_yield: string | number; book_value: string | number;
    face_value: number; npm: number; high_52w: string | number; low_52w: string | number;
  };
  ratios: any[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-6 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeyRatiosGrid({ company, ratios }: Props) {
  const metrics = useMemo(() => {
    const roceValues = ratios.map((r) => r.roce);
    const roeValues = ratios.map((r) => r.roe);
    const npmValues = ratios.map((r) => r.npm);

    return [
      { label: "Market Cap", value: `₹${(company.market_cap / 100).toFixed(0)}K Cr`, quality: "neutral" },
      { label: "Current Price", value: `₹${company.price.toLocaleString()}`, quality: "neutral" },
      { label: "52W High/Low", value: `₹${Number(company.high_52w).toFixed(0)} / ₹${Number(company.low_52w).toFixed(0)}`, quality: "neutral" },
      { label: "P/E Ratio", value: company.pe.toFixed(1), quality: company.pe < 20 ? "good" : company.pe > 40 ? "bad" : "neutral" },
      { label: "Book Value", value: `₹${Number(company.book_value).toFixed(1)}`, quality: "neutral" },
      { label: "Div. Yield", value: `${Number(company.dividend_yield).toFixed(2)}%`, quality: Number(company.dividend_yield) > 2 ? "good" : "neutral" },
      { label: "ROCE", value: `${company.roce}%`, quality: company.roce > 15 ? "good" : company.roce < 10 ? "bad" : "neutral", sparkline: roceValues },
      { label: "ROE", value: `${company.roe}%`, quality: company.roe > 15 ? "good" : company.roe < 10 ? "bad" : "neutral", sparkline: roeValues },
      { label: "Face Value", value: `₹${company.face_value}`, quality: "neutral" },
      { label: "EPS", value: `₹${company.eps}`, quality: "neutral" },
      { label: "Debt/Equity", value: String(company.de), quality: Number(company.de) < 0.5 ? "good" : Number(company.de) > 1 ? "bad" : "neutral" },
      { label: "Net Profit Margin", value: `${company.npm}%`, quality: company.npm > 15 ? "good" : company.npm < 5 ? "bad" : "neutral", sparkline: npmValues },
    ];
  }, [company, ratios]);

  const qualityColor = (q: string) => {
    if (q === "good") return "border-l-chart-green";
    if (q === "bad") return "border-l-chart-red";
    return "border-l-border";
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-3">Key Ratios</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-md border border-border bg-muted/30 p-3 border-l-4 ${qualityColor(m.quality)}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{m.label}</span>
              {m.sparkline && (
                <MiniSparkline data={m.sparkline} color={m.quality === "good" ? "hsl(152, 69%, 40%)" : m.quality === "bad" ? "hsl(0, 72%, 51%)" : "hsl(220, 70%, 50%)"} />
              )}
            </div>
            <span className="text-lg font-mono font-bold text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

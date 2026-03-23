import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { BarChart2, DollarSign, TrendingUp, Shield, Percent, Target, BookOpen, Layers, CircleDot, Activity, Scale, PieChart } from "lucide-react";

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
          <defs>
            <linearGradient id={`spark-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color.replace(/[^a-z]/gi, '')})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const ICONS = [BarChart2, DollarSign, Target, Percent, BookOpen, PieChart, TrendingUp, Activity, Layers, CircleDot, Scale, Shield];

export function KeyRatiosGrid({ company, ratios }: Props) {
  const metrics = useMemo(() => {
    const roceValues = ratios.map((r) => r.roce);
    const roeValues = ratios.map((r) => r.roe);
    const npmValues = ratios.map((r) => r.npm);

    return [
      { label: "Market Cap", value: `₹${(company.market_cap / 100).toFixed(0)}K Cr`, quality: "neutral" },
      { label: "Current Price", value: `₹${company.price.toLocaleString()}`, quality: "neutral" },
      { label: "52W Range", value: `${Number(company.low_52w).toFixed(0)} — ${Number(company.high_52w).toFixed(0)}`, quality: "neutral" },
      { label: "P/E Ratio", value: company.pe.toFixed(1), quality: company.pe < 20 ? "good" : company.pe > 40 ? "bad" : "neutral" },
      { label: "Book Value", value: `₹${Number(company.book_value).toFixed(1)}`, quality: "neutral" },
      { label: "Div. Yield", value: `${Number(company.dividend_yield).toFixed(2)}%`, quality: Number(company.dividend_yield) > 2 ? "good" : "neutral" },
      { label: "ROCE", value: `${company.roce}%`, quality: company.roce > 15 ? "good" : company.roce < 10 ? "bad" : "neutral", sparkline: roceValues },
      { label: "ROE", value: `${company.roe}%`, quality: company.roe > 15 ? "good" : company.roe < 10 ? "bad" : "neutral", sparkline: roeValues },
      { label: "Face Value", value: `₹${company.face_value}`, quality: "neutral" },
      { label: "EPS", value: `₹${company.eps}`, quality: "neutral" },
      { label: "Debt/Equity", value: String(company.de), quality: Number(company.de) < 0.5 ? "good" : Number(company.de) > 1 ? "bad" : "neutral" },
      { label: "NPM", value: `${company.npm}%`, quality: company.npm > 15 ? "good" : company.npm < 5 ? "bad" : "neutral", sparkline: npmValues },
    ];
  }, [company, ratios]);

  const qualityStyles = (q: string) => {
    if (q === "good") return "border-l-chart-green bg-chart-green/5";
    if (q === "bad") return "border-l-chart-red bg-chart-red/5";
    return "border-l-border bg-muted/15";
  };

  return (
    <div className="glass-card p-3">
      <h2 className="section-title mb-3">Key Ratios</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        {metrics.map((m, idx) => {
          const Icon = ICONS[idx];
          return (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`rounded border border-border/60 p-2.5 border-l-2 hover:border-border transition-all duration-150 group ${qualityStyles(m.quality)}`}
            >
              <div className="flex items-center gap-1 mb-1">
                <Icon className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-muted-foreground uppercase tracking-wider font-medium" style={{ fontSize: '9px' }}>{m.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="font-mono font-bold text-foreground tracking-tight" style={{ fontSize: '14px' }}>{m.value}</span>
                {m.sparkline && (
                  <MiniSparkline
                    data={m.sparkline}
                    color={m.quality === "good" ? "hsl(152, 69%, 40%)" : m.quality === "bad" ? "hsl(0, 72%, 51%)" : "hsl(220, 70%, 50%)"}
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

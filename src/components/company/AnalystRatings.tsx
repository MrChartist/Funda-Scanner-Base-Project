import { motion } from "framer-motion";
import { Target, TrendingUp } from "lucide-react";

interface Props {
  ratings: { buy_count: number; hold_count: number; sell_count: number; target_price: number };
  currentPrice: number;
}

export function AnalystRatings({ ratings, currentPrice }: Props) {
  const total = ratings.buy_count + ratings.hold_count + ratings.sell_count;
  const upside = ((ratings.target_price - currentPrice) / currentPrice * 100).toFixed(1);
  const isPositive = Number(upside) >= 0;

  const buyPct = ratings.buy_count / total * 100;
  const holdPct = ratings.hold_count / total * 100;
  const sellPct = ratings.sell_count / total * 100;

  const consensus = buyPct > 60 ? "Strong Buy" : buyPct > 40 ? "Buy" : holdPct > 40 ? "Hold" : "Sell";
  const consensusColor = buyPct > 60 ? "text-positive" : buyPct > 40 ? "text-positive" : holdPct > 40 ? "text-chart-amber" : "text-negative";

  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-5">Analyst Ratings</h2>
      <div className="flex flex-col md:flex-row gap-8 items-center">
        {/* Consensus + Bars */}
        <div className="flex-1 w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className={`text-2xl font-bold ${consensusColor}`} style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {consensus}
            </div>
            <span className="text-sm text-muted-foreground">from {total} analysts</span>
          </div>

          {/* Individual bars */}
          <div className="space-y-3">
            {[
              { label: "Buy", count: ratings.buy_count, pct: buyPct, color: "bg-chart-green", textColor: "text-positive" },
              { label: "Hold", count: ratings.hold_count, pct: holdPct, color: "bg-chart-amber", textColor: "text-chart-amber" },
              { label: "Sell", count: ratings.sell_count, pct: sellPct, color: "bg-chart-red", textColor: "text-negative" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className={`text-xs font-semibold w-8 ${item.textColor}`}>{item.label}</span>
                <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${item.color}`}
                    style={{ opacity: 0.8 }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold text-foreground w-8 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Target Price Card */}
        <div className="glass-card p-5 min-w-[180px] text-center glow-primary">
          <Target className="h-5 w-5 text-primary mx-auto mb-2" />
          <span className="text-xs text-muted-foreground block mb-1">Target Price</span>
          <span className="text-3xl font-mono font-bold text-foreground block tracking-tight">
            ₹{ratings.target_price.toLocaleString()}
          </span>
          <div className={`mt-2 metric-badge mx-auto ${isPositive ? "bg-chart-green/10 text-positive" : "bg-chart-red/10 text-negative"}`}>
            <TrendingUp className="h-3 w-3" />
            {isPositive ? "+" : ""}{upside}% upside
          </div>
        </div>
      </div>
    </div>
  );
}

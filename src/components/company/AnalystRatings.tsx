interface Props {
  ratings: { buy_count: number; hold_count: number; sell_count: number; target_price: number };
  currentPrice: number;
}

export function AnalystRatings({ ratings, currentPrice }: Props) {
  const total = ratings.buy_count + ratings.hold_count + ratings.sell_count;
  const upside = ((ratings.target_price - currentPrice) / currentPrice * 100).toFixed(1);
  const isPositive = Number(upside) >= 0;

  const buyPct = (ratings.buy_count / total * 100).toFixed(0);
  const holdPct = (ratings.hold_count / total * 100).toFixed(0);
  const sellPct = (ratings.sell_count / total * 100).toFixed(0);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4">Analyst Ratings</h2>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Stacked Bar */}
        <div className="flex-1">
          <div className="flex h-8 rounded-md overflow-hidden">
            <div className="bg-chart-green flex items-center justify-center text-xs font-semibold text-white" style={{ width: `${buyPct}%` }}>
              {Number(buyPct) > 10 && `Buy ${buyPct}%`}
            </div>
            <div className="bg-chart-amber flex items-center justify-center text-xs font-semibold text-white" style={{ width: `${holdPct}%` }}>
              {Number(holdPct) > 10 && `Hold ${holdPct}%`}
            </div>
            <div className="bg-chart-red flex items-center justify-center text-xs font-semibold text-white" style={{ width: `${sellPct}%` }}>
              {Number(sellPct) > 10 && `Sell ${sellPct}%`}
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{ratings.buy_count} Buy</span>
            <span>{ratings.hold_count} Hold</span>
            <span>{ratings.sell_count} Sell</span>
          </div>
        </div>

        {/* Target Price */}
        <div className="flex flex-col items-center gap-1 min-w-[140px]">
          <span className="text-xs text-muted-foreground">Target Price</span>
          <span className="text-2xl font-mono font-bold text-foreground">₹{ratings.target_price.toLocaleString()}</span>
          <span className={`text-sm font-mono font-semibold ${isPositive ? "text-positive" : "text-negative"}`}>
            {isPositive ? "+" : ""}{upside}% upside
          </span>
        </div>
      </div>
    </div>
  );
}

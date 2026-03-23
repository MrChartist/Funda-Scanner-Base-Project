import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

interface CompanyHeaderProps {
  company: {
    name: string; symbol: string; sector: string; industry: string;
    price: number; change_pct: number; market_cap: number;
    high_52w: string | number; low_52w: string | number; about: string;
    pe: number; eps: number;
  };
}

export function CompanyHeader({ company }: CompanyHeaderProps) {
  const [showSummary, setShowSummary] = useState(false);
  const isPositive = company.change_pct >= 0;
  const h52 = Number(company.high_52w);
  const l52 = Number(company.low_52w);
  const rangePct = h52 !== l52 ? ((company.price - l52) / (h52 - l52)) * 100 : 50;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold text-foreground">{company.name}</h1>
            <Badge variant="outline" className="font-mono">{company.symbol}</Badge>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant="secondary">{company.sector}</Badge>
            {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-3xl font-mono font-bold text-foreground">₹{company.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-mono font-semibold ${isPositive ? "bg-chart-green/15 text-positive" : "bg-chart-red/15 text-negative"}`}>
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {isPositive ? "+" : ""}{company.change_pct.toFixed(2)}%
            </div>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            MCap: ₹{(company.market_cap / 100).toFixed(0)}K Cr · P/E: {company.pe} · EPS: ₹{company.eps}
          </div>
        </div>
      </div>

      {/* 52W Range */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>52W Low: ₹{l52.toLocaleString()}</span>
          <span>52W High: ₹{h52.toLocaleString()}</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-chart-red via-chart-amber to-chart-green opacity-30" />
          <div
            className="absolute top-0 h-full w-1 bg-primary rounded-full shadow-md"
            style={{ left: `${Math.min(Math.max(rangePct, 0), 100)}%`, transform: "translateX(-50%)" }}
          />
        </div>
      </div>

      {/* Business Summary */}
      <button onClick={() => setShowSummary(!showSummary)} className="flex items-center gap-1 mt-4 text-sm text-primary hover:underline">
        {showSummary ? "Hide" : "Show"} Business Summary
        {showSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showSummary && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{company.about}</p>
      )}
    </div>
  );
}

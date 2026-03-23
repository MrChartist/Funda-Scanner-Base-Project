import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Building2, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    <div className="glass-card-elevated p-6 md:p-8 relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {company.name}
            </h1>
            <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/20 text-primary">
              {company.symbol}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="gap-1.5 font-medium">
              <Building2 className="h-3 w-3" />
              {company.sector}
            </Badge>
            {company.industry && (
              <Badge variant="secondary" className="font-medium">{company.industry}</Badge>
            )}
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className="flex items-center gap-3 justify-end">
            <span className="text-3xl md:text-4xl font-mono font-bold text-foreground tracking-tight">
              ₹{company.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-mono font-bold transition-all ${
              isPositive
                ? "bg-chart-green/10 text-positive glow-green"
                : "bg-chart-red/10 text-negative glow-red"
            }`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? "+" : ""}{company.change_pct.toFixed(2)}%
            </div>
          </div>
          <div className="flex items-center gap-4 justify-end text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              MCap: <span className="font-mono font-medium text-foreground">₹{(company.market_cap / 100).toFixed(0)}K Cr</span>
            </span>
            <span>P/E: <span className="font-mono font-medium text-foreground">{company.pe}</span></span>
            <span>EPS: <span className="font-mono font-medium text-foreground">₹{company.eps}</span></span>
          </div>
        </div>
      </div>

      {/* 52W Range — Premium Slider */}
      <div className="relative mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="font-mono">₹{l52.toLocaleString()} <span className="text-negative text-[10px]">52W Low</span></span>
          <span className="font-mono"><span className="text-positive text-[10px]">52W High</span> ₹{h52.toLocaleString()}</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-muted/60 overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-chart-red/40 via-chart-amber/30 to-chart-green/40" />
          <motion.div
            initial={{ left: "0%" }}
            animate={{ left: `${Math.min(Math.max(rangePct, 2), 98)}%` }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
          >
            <div className="relative">
              <div className="h-5 w-5 rounded-full bg-primary border-2 border-card shadow-lg" />
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-0.5 text-[10px] font-mono font-bold text-foreground shadow-sm whitespace-nowrap">
                ₹{company.price.toFixed(0)}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Business Summary */}
      <button
        onClick={() => setShowSummary(!showSummary)}
        className="flex items-center gap-1.5 mt-4 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
      >
        {showSummary ? "Hide" : "Show"} Business Summary
        <motion.div animate={{ rotate: showSummary ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>
      <AnimatePresence>
        {showSummary && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 text-sm text-muted-foreground leading-relaxed overflow-hidden"
          >
            {company.about}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Landmark, Calendar, Shield, AlertTriangle, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

interface Deal {
  date: string; type: "Buy" | "Sell"; entity: string; category: "Promoter" | "FII" | "DII" | "Management";
  quantity: number; price: number; value: number;
}

interface PledgeData {
  quarter: string; pledgedPct: number; totalShares: number;
}

const MOCK_DEALS: Deal[] = [
  { date: "2026-03-15", type: "Buy", entity: "Mukesh Ambani (Promoter)", category: "Promoter", quantity: 150000, price: 2840, value: 42.6 },
  { date: "2026-03-08", type: "Sell", entity: "Nita Ambani (KMP)", category: "Management", quantity: 25000, price: 2820, value: 7.05 },
  { date: "2026-02-20", type: "Buy", entity: "SBI Mutual Fund", category: "DII", quantity: 500000, price: 2780, value: 139 },
  { date: "2026-02-10", type: "Sell", entity: "Goldman Sachs FII", category: "FII", quantity: 200000, price: 2810, value: 56.2 },
  { date: "2026-01-28", type: "Buy", entity: "LIC of India", category: "DII", quantity: 800000, price: 2750, value: 220 },
  { date: "2026-01-15", type: "Buy", entity: "Promoter Group Entity", category: "Promoter", quantity: 100000, price: 2720, value: 27.2 },
  { date: "2025-12-20", type: "Sell", entity: "Morgan Stanley FII", category: "FII", quantity: 350000, price: 2690, value: 94.15 },
  { date: "2025-12-05", type: "Buy", entity: "HDFC AMC", category: "DII", quantity: 420000, price: 2710, value: 113.82 },
];

const MOCK_PLEDGES: PledgeData[] = [
  { quarter: "Q4 FY24", pledgedPct: 0.0, totalShares: 4500000000 },
  { quarter: "Q3 FY24", pledgedPct: 0.0, totalShares: 4500000000 },
  { quarter: "Q2 FY24", pledgedPct: 0.2, totalShares: 4500000000 },
  { quarter: "Q1 FY24", pledgedPct: 0.5, totalShares: 4500000000 },
  { quarter: "Q4 FY23", pledgedPct: 0.8, totalShares: 4480000000 },
  { quarter: "Q3 FY23", pledgedPct: 1.2, totalShares: 4480000000 },
];

const MOCK_SAST = [
  { date: "2026-02-15", acquirer: "Promoter Group", pctBefore: 50.1, pctAfter: 50.3, type: "Acquisition" },
  { date: "2025-11-20", acquirer: "Promoter Group", pctBefore: 49.9, pctAfter: 50.1, type: "Acquisition" },
  { date: "2025-08-10", acquirer: "Promoter Group", pctBefore: 50.0, pctAfter: 49.9, type: "Disposal" },
];

const CATEGORY_COLORS: Record<string, string> = {
  Promoter: "bg-primary/10 text-primary border-primary/30",
  FII: "bg-chart-cyan/10 text-chart-cyan border-chart-cyan/30",
  DII: "bg-chart-amber/10 text-chart-amber border-chart-amber/30",
  Management: "bg-chart-green/10 text-positive border-chart-green/30",
};

export function InsiderDeals() {
  const [filter, setFilter] = useState<string>("All");
  const [tab, setTab] = useState<"deals" | "pledge" | "sast">("deals");

  const filteredDeals = filter === "All" ? MOCK_DEALS : MOCK_DEALS.filter((d) => d.category === filter);

  // Compute deal patterns
  const totalBuyValue = MOCK_DEALS.filter((d) => d.type === "Buy").reduce((s, d) => s + d.value, 0);
  const totalSellValue = MOCK_DEALS.filter((d) => d.type === "Sell").reduce((s, d) => s + d.value, 0);
  const netFlow = totalBuyValue - totalSellValue;
  const promoterBuys = MOCK_DEALS.filter((d) => d.category === "Promoter" && d.type === "Buy").length;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="section-title">
          <Landmark className="h-4 w-4 text-primary inline mr-2" />
          Insider & Promoter Activity
        </h2>
        <div className="flex gap-1 rounded-lg border border-border/50 p-0.5">
          {(["deals", "pledge", "sast"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-1 text-[11px] rounded-md capitalize transition-colors ${tab === t ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-accent"}`}>
              {t === "deals" ? "Deals" : t === "pledge" ? "Pledge" : "SAST"}
            </button>
          ))}
        </div>
      </div>

      {/* Pattern analysis summary */}
      {tab === "deals" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
              <span className="text-[10px] text-muted-foreground block">Net Insider Flow</span>
              <span className={`text-lg font-mono font-bold ${netFlow >= 0 ? "text-positive" : "text-negative"}`}>
                {netFlow >= 0 ? "+" : ""}₹{netFlow.toFixed(0)} Cr
              </span>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
              <span className="text-[10px] text-muted-foreground block">Promoter Buys</span>
              <span className="text-lg font-mono font-bold text-positive">{promoterBuys}</span>
              <span className="text-[9px] text-muted-foreground ml-1">last 90d</span>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
              <span className="text-[10px] text-muted-foreground block">Total Buys</span>
              <span className="text-lg font-mono font-bold text-foreground">₹{totalBuyValue.toFixed(0)} Cr</span>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
              <span className="text-[10px] text-muted-foreground block">Total Sells</span>
              <span className="text-lg font-mono font-bold text-foreground">₹{totalSellValue.toFixed(0)} Cr</span>
            </div>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            {["All", "Promoter", "FII", "DII", "Management"].map((cat) => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${filter === cat ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent"}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
            {filteredDeals.map((deal, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${deal.type === "Buy" ? "bg-chart-green/10" : "bg-chart-red/10"}`}>
                    {deal.type === "Buy" ? <ArrowUpRight className="h-4 w-4 text-positive" /> : <ArrowDownRight className="h-4 w-4 text-negative" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{deal.entity}</span>
                      <Badge variant="outline" className={`text-[8px] px-1.5 py-0 ${CATEGORY_COLORS[deal.category]}`}>
                        {deal.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(deal.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-semibold text-foreground">{deal.quantity.toLocaleString()} shares</span>
                  <div className="text-[10px] text-muted-foreground">
                    @ ₹{deal.price.toLocaleString()} · ₹{deal.value} Cr
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {tab === "pledge" && (
        <div className="space-y-4">
          <div className={`rounded-lg border p-4 ${MOCK_PLEDGES[0].pledgedPct === 0 ? "border-chart-green/30 bg-chart-green/5" : "border-chart-red/30 bg-chart-red/5"}`}>
            <div className="flex items-center gap-2 mb-1">
              {MOCK_PLEDGES[0].pledgedPct === 0 ? <Shield className="h-4 w-4 text-positive" /> : <AlertTriangle className="h-4 w-4 text-negative" />}
              <span className="text-sm font-semibold text-foreground">
                {MOCK_PLEDGES[0].pledgedPct === 0 ? "No Shares Pledged ✓" : `${MOCK_PLEDGES[0].pledgedPct}% Shares Pledged ⚠`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {MOCK_PLEDGES[0].pledgedPct === 0
                ? "Promoter shares are pledge-free — a positive governance signal."
                : "Pledged shares indicate potential risk if stock price falls."}
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...MOCK_PLEDGES].reverse()} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="quarter" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: 12 }}
                  formatter={(v: any) => `${v}%`} />
                <Bar dataKey="pledgedPct" fill="hsl(var(--chart-red))" radius={[4, 4, 0, 0]} name="Pledged %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "sast" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">SAST (Substantial Acquisition of Shares) disclosures under SEBI regulations</p>
          {MOCK_SAST.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{s.acquirer}</span>
                  <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${s.type === "Acquisition" ? "text-positive border-chart-green/30" : "text-negative border-chart-red/30"}`}>
                    {s.type}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(s.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm font-mono">
                  <span className="text-muted-foreground">{s.pctBefore}%</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={`font-bold ${s.pctAfter > s.pctBefore ? "text-positive" : "text-negative"}`}>{s.pctAfter}%</span>
                </div>
                <span className={`text-[10px] font-mono ${s.pctAfter > s.pctBefore ? "text-positive" : "text-negative"}`}>
                  {s.pctAfter > s.pctBefore ? "+" : ""}{(s.pctAfter - s.pctBefore).toFixed(1)}%
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

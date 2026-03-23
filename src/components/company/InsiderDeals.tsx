import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Landmark, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Deal {
  date: string; type: "Buy" | "Sell"; entity: string; quantity: number; price: number; value: number;
}

const MOCK_INSIDER_DEALS: Deal[] = [
  { date: "2026-03-15", type: "Buy", entity: "Promoter Group", quantity: 150000, price: 2840, value: 42.6 },
  { date: "2026-03-08", type: "Sell", entity: "Key Management", quantity: 25000, price: 2820, value: 7.05 },
  { date: "2026-02-20", type: "Buy", entity: "Mutual Fund - SBI", quantity: 500000, price: 2780, value: 139 },
  { date: "2026-02-10", type: "Sell", entity: "FII - Goldman Sachs", quantity: 200000, price: 2810, value: 56.2 },
  { date: "2026-01-28", type: "Buy", entity: "DII - LIC", quantity: 800000, price: 2750, value: 220 },
  { date: "2026-01-15", type: "Buy", entity: "Promoter Group", quantity: 100000, price: 2720, value: 27.2 },
];

export function InsiderDeals() {
  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-4">
        <Landmark className="h-4 w-4 text-primary inline mr-2" />
        Insider & Bulk Deals
      </h2>
      <div className="space-y-2">
        {MOCK_INSIDER_DEALS.map((deal, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                deal.type === "Buy" ? "bg-chart-green/10" : "bg-chart-red/10"
              }`}>
                {deal.type === "Buy" ? <ArrowUpRight className="h-4 w-4 text-positive" /> : <ArrowDownRight className="h-4 w-4 text-negative" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{deal.entity}</span>
                  <Badge variant={deal.type === "Buy" ? "default" : "destructive"} className="text-[9px] px-1.5 py-0">
                    {deal.type}
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
    </div>
  );
}

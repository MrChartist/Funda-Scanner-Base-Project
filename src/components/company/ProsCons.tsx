import { CheckCircle2, XCircle, ThumbsUp, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export function ProsConsSection({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="glass-card p-5 border-l-[3px] border-l-chart-green">
        <h3 className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-full bg-chart-green/10 flex items-center justify-center">
            <ThumbsUp className="h-3.5 w-3.5 text-positive" />
          </div>
          <span className="text-sm font-bold text-foreground">Strengths</span>
          <span className="text-xs text-muted-foreground ml-auto">{pros.length} points</span>
        </h3>
        <ul className="space-y-3">
          {pros.map((p, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 text-sm text-foreground group"
            >
              <CheckCircle2 className="h-4 w-4 text-positive shrink-0 mt-0.5" />
              <span className="leading-relaxed">{p}</span>
            </motion.li>
          ))}
        </ul>
      </div>
      <div className="glass-card p-5 border-l-[3px] border-l-chart-red">
        <h3 className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-full bg-chart-red/10 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-negative" />
          </div>
          <span className="text-sm font-bold text-foreground">Weaknesses</span>
          <span className="text-xs text-muted-foreground ml-auto">{cons.length} points</span>
        </h3>
        <ul className="space-y-3">
          {cons.map((c, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 text-sm text-foreground"
            >
              <XCircle className="h-4 w-4 text-negative shrink-0 mt-0.5" />
              <span className="leading-relaxed">{c}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}

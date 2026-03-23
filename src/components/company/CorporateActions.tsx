import { Gift, Scissors, Award, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface Action {
  type: string; date: string; details: string; ratio: string;
}

const CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  DIVIDEND: { icon: Gift, color: "text-chart-green", bg: "bg-chart-green/10" },
  SPLIT: { icon: Scissors, color: "text-chart-amber", bg: "bg-chart-amber/10" },
  BONUS: { icon: Award, color: "text-primary", bg: "bg-primary/10" },
};

export function CorporateActions({ actions }: { actions: Action[] }) {
  return (
    <div className="glass-card p-5">
      <h2 className="section-title mb-5">Corporate Actions</h2>
      <div className="relative ml-5">
        {/* Timeline line */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />

        <div className="space-y-4">
          {actions.map((a, i) => {
            const config = CONFIG[a.type] || CONFIG.DIVIDEND;
            const Icon = config.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative pl-8 group"
              >
                {/* Timeline dot */}
                <div className={`absolute -left-[7px] top-2 h-3.5 w-3.5 rounded-full border-2 border-card ${config.bg} flex items-center justify-center shadow-sm`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${config.bg.replace('/10', '')}`} style={{ background: `hsl(var(--${a.type === 'DIVIDEND' ? 'chart-green' : a.type === 'SPLIT' ? 'chart-amber' : 'primary'}))` }} />
                </div>

                <div className="glass-card p-3.5 hover:border-primary/20 transition-all duration-200 group-hover:shadow-md">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">{a.details}</span>
                        <span className={`ml-2 text-[10px] uppercase font-bold tracking-wider ${config.color}`}>{a.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

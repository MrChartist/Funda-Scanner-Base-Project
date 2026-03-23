import { Gift, Scissors, Award } from "lucide-react";

interface Action {
  type: string; date: string; details: string; ratio: string;
}

const ICONS: Record<string, any> = {
  DIVIDEND: Gift,
  SPLIT: Scissors,
  BONUS: Award,
};

export function CorporateActions({ actions }: { actions: Action[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground mb-4">Corporate Actions</h2>
      <div className="relative border-l-2 border-border ml-4 space-y-4">
        {actions.map((a, i) => {
          const Icon = ICONS[a.type] || Gift;
          return (
            <div key={i} className="relative pl-6">
              <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-border bg-card flex items-center justify-center">
                <Icon className="h-2.5 w-2.5 text-primary" />
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-medium text-foreground">{a.details}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{a.type}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{a.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

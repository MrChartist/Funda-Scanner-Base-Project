import { CheckCircle2, XCircle } from "lucide-react";

export function ProsConsSection({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-positive flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4" /> Strengths
        </h3>
        <ul className="space-y-2">
          {pros.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-chart-green shrink-0" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-negative flex items-center gap-2 mb-3">
          <XCircle className="h-4 w-4" /> Weaknesses
        </h3>
        <ul className="space-y-2">
          {cons.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-chart-red shrink-0" />
              {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

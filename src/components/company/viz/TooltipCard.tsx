import type { ReactNode } from "react";

export interface TipRow {
  name: string;
  text: string;
  color?: string;
  dashed?: boolean;
}

/** Themed tooltip card: heading and one line per series, in text ink with a small mark for identity. */
export function TooltipCard({ title, rows }: { title: ReactNode; rows: TipRow[] }) {
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1 font-medium">{title}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2">
            {r.color && (
              <span
                aria-hidden="true"
                className="inline-block h-0 w-3 border-t-2"
                style={{ borderColor: r.color, borderStyle: r.dashed ? "dashed" : "solid" }}
              />
            )}
            <span className="text-muted-foreground">{r.name}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

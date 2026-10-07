// src/components/DataSourceBadge.tsx — a small pill naming where the numbers come from (WS1).
// Rendered once, in the Header. It reads only the active provider, so it needs no data loading.
import { useActiveProvider } from "@/hooks/use-dataset";
import { cn } from "@/lib/utils";

export interface DataSourceBadgeProps {
  className?: string;
}

export function DataSourceBadge({ className }: DataSourceBadgeProps) {
  const provider = useActiveProvider();
  const label = provider.isDemo ? "Sample data" : provider.name || "Your data";
  const title = provider.isDemo
    ? "Fictional sample companies with generated figures. Use Import your data to load your own files."
    : `Data source: ${provider.name}. You are responsible for its accuracy and licence.`;
  return (
    <span
      title={title}
      aria-label={`Data source: ${provider.isDemo ? "sample data, fictional companies" : label}`}
      className={cn(
        "inline-flex max-w-[10rem] items-center truncate rounded-full border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider",
        provider.isDemo ? "border-chart-amber/40 text-chart-amber" : "border-border text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}

import { getDataProvider } from "@/lib/data-provider";

/** Small pill telling the user where the numbers come from. */
export function DataSourceBadge() {
  const provider = getDataProvider();
  return (
    <span
      title={provider.isDemo ? "Synthetic demo data — connect your own data provider (see README)" : `Data source: ${provider.name}`}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${
        provider.isDemo ? "border-chart-amber/40 text-chart-amber" : "border-border text-muted-foreground"
      }`}
    >
      {provider.isDemo ? "Demo data" : provider.name}
    </span>
  );
}

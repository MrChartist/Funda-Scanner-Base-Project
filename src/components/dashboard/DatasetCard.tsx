import { Link } from "react-router-dom";
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { formatNumberIN } from "@/lib/format/indian";
import { StatTile } from "@/components/layout";
import { fyLabel } from "@/lib/time/civil";

export function DatasetCard({ store, dataset }: { store: MetricStore; dataset: FundamentalsDataset }) {
  const meta = dataset.meta;
  const sectors = new Set<string>();
  for (let i = 0; i < store.size; i++) sectors.add(store.sector(i));
  const latestFy = store.modalLatestFy;
  const priceDates = new Set<string>();
  for (const c of dataset.companies) if (c.market.price_date) priceDates.add(c.market.price_date);
  const priceDate = priceDates.size === 0 ? "not provided" : priceDates.size === 1 ? [...priceDates][0] : `${[...priceDates].sort()[0]} to ${[...priceDates].sort().pop()}`;

  return (
    <section aria-labelledby="dataset-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id="dataset-title" className="section-title">About your data</h2>
          <p className="mt-1 text-sm text-foreground">
            {meta.isSynthetic ? "Fictional sample companies with generated figures." : meta.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 text-sm">
          <Link to="/screener" className="flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-9">Open the Screener</Link>
          <Link to="/learn" className="flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-9">Learn the metrics</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Companies" value={formatNumberIN(store.size, 0)} hint={meta.isSynthetic ? "fictional" : undefined} />
        <StatTile label="Sectors" value={formatNumberIN(sectors.size, 0)} />
        <StatTile
          label="Latest common year"
          value={latestFy === null ? "Not available" : fyLabel(latestFy)}
          hint={latestFy !== null && meta.isSynthetic ? "illustrative" : undefined}
        />
        <StatTile label="Reference price date" value={<span className="text-xl">{priceDate}</span>} hint="not a live quote" />
      </div>
      <p className="text-xs text-muted-foreground">
        Data as of: {meta.asOf ?? "not provided"}. Prices are reference prices supplied with the data, not live quotes.
      </p>
    </section>
  );
}

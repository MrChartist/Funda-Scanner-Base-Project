import { Link } from "react-router-dom";
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { formatNumberIN } from "@/lib/format/indian";
import { fyLabel } from "@/lib/time/civil";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export function DatasetCard({ store, dataset }: { store: MetricStore; dataset: FundamentalsDataset }) {
  const meta = dataset.meta;
  const sectors = new Set<string>();
  for (let i = 0; i < store.size; i++) sectors.add(store.sector(i));
  const latestFy = store.modalLatestFy;
  const priceDates = new Set<string>();
  for (const c of dataset.companies) if (c.market.price_date) priceDates.add(c.market.price_date);
  const priceDate = priceDates.size === 0 ? "not provided" : priceDates.size === 1 ? [...priceDates][0] : `${[...priceDates].sort()[0]} to ${[...priceDates].sort().pop()}`;

  return (
    <section aria-labelledby="dataset-title" className="glass-card space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="dataset-title" className="section-title">About your data</h2>
          <p className="mt-1 text-sm text-foreground">
            {meta.isSynthetic ? "Fictional sample companies with generated figures." : meta.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link to="/screener" className="flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-0">Open the Screener</Link>
          <Link to="/learn" className="flex min-h-11 items-center font-medium text-primary hover:underline sm:min-h-0">Learn the metrics</Link>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Companies">{formatNumberIN(store.size, 0)}</Fact>
        <Fact label="Sectors">{formatNumberIN(sectors.size, 0)}</Fact>
        <Fact label="Latest common year">{latestFy === null ? "Not available" : meta.isSynthetic ? `${fyLabel(latestFy)} (illustrative)` : fyLabel(latestFy)}</Fact>
        <Fact label="Reference price date">{priceDate}</Fact>
      </dl>
      <p className="text-xs text-muted-foreground">
        Data as of: {meta.asOf ?? "not provided"}. Prices are reference prices supplied with the data, not live quotes.
      </p>
    </section>
  );
}

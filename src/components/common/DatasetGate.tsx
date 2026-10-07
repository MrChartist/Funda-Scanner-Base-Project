import type { ReactNode } from "react";
import type { FundamentalsDataset, MetricStore } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { useDataset } from "@/hooks/use-dataset";

export interface DatasetGateProps {
  children: (ctx: { store: MetricStore; dataset: FundamentalsDataset }) => ReactNode;
}

/** Shows a loading or error message until the dataset is ready, then renders its children with it. */
export function DatasetGate({ children }: DatasetGateProps) {
  const state = useDataset();
  if (state.status === "loading") {
    return (
      <div role="status" aria-live="polite" className="container py-16 text-center text-sm text-muted-foreground">
        Loading the data…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="container max-w-xl space-y-3 py-16 text-center">
        <p className="text-sm text-foreground">The data could not be loaded: {state.message}</p>
        <Button type="button" variant="outline" size="sm" onClick={state.retry}>Try again</Button>
      </div>
    );
  }
  return <>{children({ store: state.store, dataset: state.dataset })}</>;
}

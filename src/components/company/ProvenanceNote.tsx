import type { MetricStore } from "@/lib/contracts";

export interface ProvenanceNoteProps {
  store: MetricStore;
  index: number;
}

/** Replaces the old "updated 15 minutes ago" label: where the figures come from, with no invented dates. */
export function ProvenanceNote({ store, index }: ProvenanceNoteProps) {
  const company = store.company(index);
  const fy = store.periodLabel(index, { freq: "fy", offset: 0 });
  const basis = company.statement_basis === "standalone" ? "standalone" : "consolidated";
  const hasStatements = store.slots(index, "fy") > 0;
  const ttm = store.slots(index, "q") > 0 ? store.periodLabel(index, { freq: "ttm", offset: 0 }) : null;
  const parts = [fy ?? "Year not provided", basis, hasStatements ? "derived from your statements" : "values supplied in your file"];
  const meta = store.meta;
  return (
    <p className="text-xs text-muted-foreground" data-testid="provenance-note">
      <span>{parts.join(" · ")}</span>
      {ttm && <span> · {ttm}</span>}
      <span> · {meta.asOf ? `Data as of ${meta.asOf}.` : "Data as-of date not provided."}</span>
      {meta.isSynthetic && <span> Generated sample data; it describes no real company.</span>}
    </p>
  );
}

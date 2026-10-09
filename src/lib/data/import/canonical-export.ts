// src/lib/data/import/canonical-export.ts — write the canonical dataset JSON (WS1). Separate from the reader
// so exporting never loads the import validation code.
import type { FundamentalsDataset } from "@/lib/contracts";

/** Serialises a dataset as canonical JSON. Small datasets are indented for readability. */
export function exportDatasetJson(ds: FundamentalsDataset, o: { pretty?: boolean } = {}): string {
  const pretty = o.pretty ?? ds.companies.length <= 50;
  return JSON.stringify(ds, null, pretty ? 2 : undefined);
}

/** File name for an exported dataset; synthetic data carries the SAMPLE- prefix (§F.6). */
export function exportFileName(ds: FundamentalsDataset, dateStamp: string): string {
  const base = ds.meta.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "dataset";
  return `${ds.meta.isSynthetic ? "SAMPLE-" : ""}funda-${base}-${dateStamp}.json`;
}

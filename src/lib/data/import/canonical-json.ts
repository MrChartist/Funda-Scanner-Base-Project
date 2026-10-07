// src/lib/data/import/canonical-json.ts — read and write the canonical dataset JSON (WS1).
// Export → import round-trips to a deep-equal dataset.
import type { FundamentalsDataset } from "@/lib/contracts";
import { DATASET_VERSION } from "@/lib/contracts";
import { makeIssue, normalizeDataset, type IssueSink } from "../normalize";
import { datasetInputSchema, hasUnknownVersion, shapeProblems } from "../schema";

/**
 * Validates the structure of a parsed canonical JSON value and normalises it. Returns null (with
 * an error in `sink`) when the version is unknown or the structure is wrong.
 */
export function readCanonicalDataset(value: unknown, sink: IssueSink, fallbackName: string): FundamentalsDataset | null {
  if (hasUnknownVersion(value)) {
    const v = (value as { version?: unknown }).version;
    sink.issues.push(makeIssue("error", "E003_SCHEMA_VERSION",
      `"${sink.file ?? "The file"}" uses dataset version ${String(v)}. This version of Funda Scanner reads version ${DATASET_VERSION} only.`,
      { file: sink.file, field: "version" }));
    return null;
  }
  const parsed = datasetInputSchema.safeParse(value);
  if (!parsed.success) {
    for (const p of shapeProblems(parsed.error)) {
      sink.issues.push(makeIssue("error", "E005_BAD_SHAPE", `"${sink.file ?? "The file"}" is not a valid dataset: ${p.path}: ${p.message}.`, {
        file: sink.file, field: p.path,
      }));
    }
    return null;
  }
  return normalizeDataset(parsed.data, sink, fallbackName);
}

/** Parses canonical JSON text. */
export function parseCanonicalJson(text: string, sink: IssueSink, fallbackName: string): FundamentalsDataset | null {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    sink.issues.push(makeIssue("error", "E006_BAD_JSON", `"${sink.file ?? "The file"}" is not valid JSON (${(e as Error).message}).`, { file: sink.file }));
    return null;
  }
  return readCanonicalDataset(value, sink, fallbackName);
}

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

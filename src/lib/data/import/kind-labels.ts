// src/lib/data/import/kind-labels.ts — display names for import file kinds. Kept dependency-free so the
// app shell can show them without loading the importer.
import type { ImportFileKind } from "@/lib/contracts";

export const FILE_KIND_LABEL: Readonly<Record<ImportFileKind | "unknown", string>> = {
  canonical_json: "Funda Scanner dataset (JSON)",
  snapshot: "Snapshot (one row per company)",
  companies: "Company list",
  annual: "Annual statements",
  quarterly: "Quarterly results",
  shareholding: "Shareholding pattern",
  unknown: "Not recognised",
};

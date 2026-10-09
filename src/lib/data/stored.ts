// src/lib/data/stored.ts — the stored-dataset envelope check, hand-written so restoring a saved
// import at start-up never loads zod (the importer's validation schemas live in schema.ts and are
// fetched only when a file is imported). It accepts exactly what storedEnvelopeSchema accepts.
import { DATASET_SCHEMA } from "@/lib/contracts";
import type { DatasetInput } from "./schema";

/** Envelope used for every stored dataset (IndexedDB, localStorage). */
export const STORED_DATASET_VERSION = 1;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRowList(v: unknown): boolean {
  return Array.isArray(v) && v.every(isRecord);
}

/** Optional, nullable value (undefined and null both pass). */
function optionalOf(v: unknown, check: (x: unknown) => boolean): boolean {
  return v === undefined || v === null || check(v);
}

function isCompanyInput(c: unknown): boolean {
  if (!isRecord(c)) return false;
  if (typeof c.symbol !== "string" && typeof c.symbol !== "number") return false;
  return optionalOf(c.market, isRecord)
    && optionalOf(c.annual, isRowList)
    && optionalOf(c.quarterly, isRowList)
    && optionalOf(c.shareholding, isRowList)
    && optionalOf(c.snapshot, isRecord);
}

/** True when `value` is a stored envelope `{ v: 1, data: <canonical dataset structure> }`. */
export function isStoredEnvelope(value: unknown): value is { v: typeof STORED_DATASET_VERSION; data: DatasetInput } {
  if (!isRecord(value) || value.v !== STORED_DATASET_VERSION) return false;
  const d = value.data;
  if (!isRecord(d)) return false;
  if (d.schema !== DATASET_SCHEMA || typeof d.version !== "number" || Number.isNaN(d.version)) return false;
  if (!optionalOf(d.meta, isRecord)) return false;
  return Array.isArray(d.companies) && d.companies.every(isCompanyInput);
}

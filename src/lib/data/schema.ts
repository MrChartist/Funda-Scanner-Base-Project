// src/lib/data/schema.ts — zod schemas for the structure of canonical JSON and stored datasets (WS1).
// The schemas check structure (objects, arrays, symbols, version). Individual cells are read
// leniently by normalize.ts, so one unreadable number becomes null with a warning instead of
// rejecting a whole file.
import { z } from "zod";
import { DATASET_SCHEMA, DATASET_VERSION } from "@/lib/contracts";

const looseObject = z.record(z.unknown());
const rowList = z.array(looseObject);

export const companyInputSchema = z
  .object({
    symbol: z.union([z.string(), z.number()]),
    name: z.unknown().optional(),
    sector: z.unknown().optional(),
    market: looseObject.nullable().optional(),
    annual: rowList.nullable().optional(),
    quarterly: rowList.nullable().optional(),
    shareholding: rowList.nullable().optional(),
    snapshot: looseObject.nullable().optional(),
  })
  .passthrough();

export const datasetInputSchema = z
  .object({
    schema: z.literal(DATASET_SCHEMA),
    version: z.number(),
    meta: looseObject.nullable().optional(),
    companies: z.array(companyInputSchema),
  })
  .passthrough();

export type DatasetInput = z.infer<typeof datasetInputSchema>;

/** Envelope used for every stored dataset (IndexedDB, localStorage). */
export const STORED_DATASET_VERSION = 1;

export const storedEnvelopeSchema = z.object({
  v: z.literal(STORED_DATASET_VERSION),
  data: datasetInputSchema,
});

/** "companies[3].annual[2].fiscal_year" from a zod path. */
export function formatZodPath(path: readonly (string | number)[]): string {
  let out = "";
  for (const p of path) out += typeof p === "number" ? `[${p}]` : out ? `.${p}` : p;
  return out || "(top level)";
}

export interface ShapeProblem {
  path: string;
  message: string;
}

/** Up to `max` readable structure problems from a failed parse. */
export function shapeProblems(error: z.ZodError, max = 5): ShapeProblem[] {
  return error.issues.slice(0, max).map((i) => ({ path: formatZodPath(i.path), message: i.message }));
}

/** True when a value declares the canonical schema but a different version (E003). */
export function hasUnknownVersion(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const o = value as { schema?: unknown; version?: unknown };
  return o.schema === DATASET_SCHEMA && o.version !== DATASET_VERSION;
}

import { describe, expect, it } from "vitest";
import { DATASET_SCHEMA, DATASET_VERSION } from "@/lib/contracts";
import { storedEnvelopeSchema } from "./schema";
import { isStoredEnvelope } from "./stored";

const ds = (over: Record<string, unknown> = {}) => ({
  schema: DATASET_SCHEMA, version: DATASET_VERSION, companies: [{ symbol: "AAA" }], ...over,
});
const env = (data: unknown, v: unknown = 1) => ({ v, data });

// The hand-written check must agree with the zod schema it replaces on the restore path.
const CASES: [string, unknown][] = [
  ["valid minimal", env(ds())],
  ["valid with meta and rows", env(ds({ meta: { name: "x" }, companies: [{ symbol: 5, name: 1, annual: [{ a: 1 }], quarterly: null, shareholding: [], snapshot: { b: 2 }, market: {}, extra: 1 }] }))],
  ["null meta", env(ds({ meta: null }))],
  ["no companies", env(ds({ companies: [] }))],
  ["null", null],
  ["array", []],
  ["wrong envelope version", env(ds(), 2)],
  ["data missing", { v: 1 }],
  ["data array", env([])],
  ["wrong schema", env(ds({ schema: "other" }))],
  ["version not a number", env(ds({ version: "1" }))],
  ["companies not an array", env(ds({ companies: {} }))],
  ["company without symbol", env(ds({ companies: [{ name: "x" }] }))],
  ["company symbol boolean", env(ds({ companies: [{ symbol: true }] }))],
  ["company not an object", env(ds({ companies: ["AAA"] }))],
  ["annual not rows", env(ds({ companies: [{ symbol: "A", annual: [1] }] }))],
  ["annual not an array", env(ds({ companies: [{ symbol: "A", annual: {} }] }))],
  ["snapshot array", env(ds({ companies: [{ symbol: "A", snapshot: [] }] }))],
  ["market string", env(ds({ companies: [{ symbol: "A", market: "x" }] }))],
  ["meta array", env(ds({ meta: [] }))],
];

describe("isStoredEnvelope", () => {
  it.each(CASES)("agrees with the zod schema: %s", (_name, value) => {
    expect(isStoredEnvelope(value)).toBe(storedEnvelopeSchema.safeParse(value).success);
  });
});

// src/lib/sample/index.ts — deterministic synthetic sample (WS2).
// P0 STUB: returns the six-company tiny fixture (fictional) regardless of options. WS2 replaces
// this with the seeded generator of §F (150 fictional companies; `count: 5000` for stress tests).
import type { FundamentalsDataset } from "@/lib/contracts";
import { createTinyDataset } from "@/test/fixtures/tiny-dataset";

/** Seed of the bundled sample (§F.1). */
export const SAMPLE_SEED = 24301;

export function generateSampleDataset(o: { seed?: number; count?: number } = {}): FundamentalsDataset {
  void o; // options are honoured by the real generator (WS2)
  return createTinyDataset();
}

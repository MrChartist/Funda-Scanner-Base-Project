// src/lib/sample/sample-provider.ts — the built-in sample data provider (WS2).
// The generator is loaded with a dynamic import so it can live in its own chunk.
import type { DataProvider } from "@/lib/contracts";

export const SAMPLE_PROVIDER_ID = "sample";

export function createSampleProvider(): DataProvider {
  return {
    id: SAMPLE_PROVIDER_ID,
    name: "Sample data (fictional companies)",
    isDemo: true,
    revision: 0,
    async getDataset() {
      const { generateSampleDataset } = await import("./index");
      return generateSampleDataset();
    },
  };
}

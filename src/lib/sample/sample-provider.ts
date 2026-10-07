// src/lib/sample/sample-provider.ts — the built-in sample data provider (WS2).
// The generator is loaded with a dynamic import so it lives in its own chunk and no large JSON
// ships in the main bundle (§F.1). Every call returns a freshly generated (deep-equal) dataset.
import type { DataProvider } from "@/lib/contracts";

export const SAMPLE_PROVIDER_ID = "sample";

export function createSampleProvider(): DataProvider {
  return {
    id: SAMPLE_PROVIDER_ID,
    name: "Sample data (150 fictional companies)",
    isDemo: true,
    revision: 0,
    async getDataset() {
      const { generateSampleDataset } = await import("./index");
      return generateSampleDataset();
    },
  };
}

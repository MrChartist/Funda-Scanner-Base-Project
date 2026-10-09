// src/lib/demo-provider.ts — kept for backward compatibility (§B.12).
// The built-in provider is now the deterministic sample of 150 fictional companies.
import type { DataProvider } from "@/lib/contracts";
import { createSampleProvider } from "@/lib/sample/sample-provider";

/** Built-in provider backed by the generated sample (fictional companies only). */
export const demoProvider: DataProvider = createSampleProvider();

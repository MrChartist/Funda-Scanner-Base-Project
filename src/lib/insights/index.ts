// src/lib/insights/index.ts — checks, red flags and area summaries (WS2).
// P0 STUB: no rules yet, so evaluateChecks and summariseAreas return empty lists and no
// column provider is registered (red_flag_count therefore reads as missing_input).
import type { CheckRule, ColumnProvider, EvaluateChecks, SummariseAreas } from "@/lib/contracts";

export const CHECK_RULES: readonly CheckRule[] = [];

export const evaluateChecks: EvaluateChecks = () => [];

export const summariseAreas: SummariseAreas = () => [];

/** Latest-only columns contributed to the metric store (WS2 adds "red_flag_count"). */
export const insightColumnProviders: readonly ColumnProvider[] = [];

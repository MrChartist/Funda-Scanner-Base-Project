// src/lib/data/import/detect.ts — decides what kind of file was dropped, from its headers or JSON shape (WS1).
import type { ImportFileKind } from "@/lib/contracts";
import { DATASET_SCHEMA } from "@/lib/contracts";
import { parseCsvTable } from "./csv";
import {
  FISCAL_YEAR_HEADER_KEYS, PERIOD_END_HEADER_KEYS, SYMBOL_HEADER_KEYS, headerIs, isCompanyOnlyHeader,
  isShareholdingHeader, isSnapshotRatioHeader, resolveHeader, COMPANY_ALIASES_TABLE,
} from "./aliases";

/** True when the text looks like JSON (by extension or first character). */
export function looksLikeJson(name: string, text: string): boolean {
  const body = text.replace(/^\uFEFF/, "").trimStart();
  return /\.json$/i.test(name) || body.startsWith("{") || body.startsWith("[");
}

/** Kind of a parsed JSON value: canonical dataset, legacy snapshot rows, or unknown. */
export function detectJsonKind(parsed: unknown): ImportFileKind | "unknown" {
  if (Array.isArray(parsed)) return "snapshot";
  if (typeof parsed === "object" && parsed !== null) {
    const o = parsed as { schema?: unknown; rows?: unknown; companies?: unknown };
    if (o.schema === DATASET_SCHEMA) return "canonical_json";
    if (Array.isArray(o.rows)) return "snapshot";
  }
  return "unknown";
}

/** First non-comment, non-blank header row of a CSV text. */
export function csvHeader(text: string): string[] {
  // Only the first few lines are needed; parsing a slice keeps detection cheap for large files.
  const head = text.length > 65536 ? text.slice(0, 65536) : text;
  const table = parseCsvTable(head, { comments: true });
  return table.rows[0]?.map((c) => c.trim()) ?? [];
}

/** Kind of a CSV file from its header row. */
export function detectCsvKind(header: readonly string[]): ImportFileKind | "unknown" {
  if (header.length === 0) return "unknown";
  if (!header.some((h) => headerIs(h, SYMBOL_HEADER_KEYS))) return "unknown";
  if (header.some((h) => headerIs(h, FISCAL_YEAR_HEADER_KEYS))) return "annual";
  if (header.some((h) => headerIs(h, PERIOD_END_HEADER_KEYS))) {
    return header.some(isShareholdingHeader) ? "shareholding" : "quarterly";
  }
  const ratio = header.some(isSnapshotRatioHeader);
  const companyOnly = header.some(isCompanyOnlyHeader);
  if (ratio && !companyOnly) return "snapshot";
  if (companyOnly || header.some((h) => resolveHeader(COMPANY_ALIASES_TABLE, h) !== null && !headerIs(h, SYMBOL_HEADER_KEYS))) {
    return "companies";
  }
  return "unknown";
}

export function detectFileKind(name: string, text: string): ImportFileKind | "unknown" {
  if (looksLikeJson(name, text)) {
    try {
      return detectJsonKind(JSON.parse(text.replace(/^\uFEFF/, "")) as unknown);
    } catch {
      return "unknown";
    }
  }
  return detectCsvKind(csvHeader(text));
}

// src/test/fixtures/data/wide-writer.ts — writes a dataset as the four wide CSV files (WS1 tests).
// Test-only: lets wide-csv tests prove that companies/annual/quarterly/shareholding CSVs join to
// the same companies as the canonical JSON.
import type { FundamentalsDataset, LegacyNumericKey } from "@/lib/contracts";
import { ANNUAL_FIELDS, LEGACY_KEY_TO_METRIC, QUARTER_FIELDS, SHAREHOLDING_FIELDS } from "@/lib/contracts";

export interface WideFiles {
  companies: string;
  annual: string;
  quarterly: string;
  shareholding: string;
}

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function line(cells: readonly (string | number | null | undefined)[]): string {
  return cells.map(cell).join(",");
}

/** Snapshot metric ids that a companies.csv can carry (legacy ratio columns). */
const SNAPSHOT_COLUMNS: readonly { key: LegacyNumericKey; id: string }[] = (Object.keys(LEGACY_KEY_TO_METRIC) as LegacyNumericKey[])
  .filter((k) => k !== "price" && k !== "market_cap")
  .map((k) => ({ key: k, id: LEGACY_KEY_TO_METRIC[k] }));

export function writeWideCsv(ds: FundamentalsDataset, o: { header?: string } = {}): WideFiles {
  const head = o.header ? `# ${o.header}\n` : "";
  const companies = [
    line([
      "symbol", "name", "sector", "industry", "isin", "company_type", "statement_basis", "fy_end_month", "price", "price_date",
      "shares_outstanding", "face_value", "market_cap", "source_note", "sample_note", ...SNAPSHOT_COLUMNS.map((c) => c.key),
    ]),
    ...ds.companies.map((c) => line([
      c.symbol, c.name, c.sector, c.industry, c.isin, c.company_type, c.statement_basis, c.fy_end_month, c.market.price,
      c.market.price_date, c.market.shares_outstanding, c.market.face_value, c.market.market_cap_supplied, c.source_note,
      c.sample_note, ...SNAPSHOT_COLUMNS.map((s) => c.snapshot[s.id]),
    ])),
  ];
  const annual = [
    line(["symbol", "fiscal_year", "period_end", "flags", ...ANNUAL_FIELDS]),
    ...ds.companies.flatMap((c) => c.annual.map((r) => line([c.symbol, r.fiscal_year, r.period_end, r.flags.join(";"), ...ANNUAL_FIELDS.map((f) => r[f])]))),
  ];
  const quarterly = [
    line(["symbol", "period_end", ...QUARTER_FIELDS]),
    ...ds.companies.flatMap((c) => c.quarterly.map((q) => line([c.symbol, q.period_end, ...QUARTER_FIELDS.map((f) => q[f])]))),
  ];
  const shareholding = [
    line(["symbol", "period_end", ...SHAREHOLDING_FIELDS]),
    ...ds.companies.flatMap((c) => c.shareholding.map((s) => line([c.symbol, s.period_end, ...SHAREHOLDING_FIELDS.map((f) => s[f])]))),
  ];
  return {
    companies: head + companies.join("\n") + "\n",
    annual: head + annual.join("\n") + "\n",
    quarterly: head + quarterly.join("\n") + "\n",
    shareholding: head + shareholding.join("\n") + "\n",
  };
}

/** The four files as importFiles input, in a deliberately shuffled order. */
export function wideFileInputs(files: WideFiles): { name: string; text: string }[] {
  return [
    { name: "shareholding.csv", text: files.shareholding },
    { name: "annual.csv", text: files.annual },
    { name: "companies.csv", text: files.companies },
    { name: "quarterly.csv", text: files.quarterly },
  ];
}

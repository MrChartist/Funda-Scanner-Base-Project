// src/lib/screen/export-csv.ts — CSV export with a provenance header and an injection guard (§E.6).
import type { MetricStore, ScreenRun, Unit } from "@/lib/contracts";
import { CATALOGUE_VERSION } from "@/lib/metrics";
import { printNumber } from "@/lib/query";
import { localDateStamp } from "@/lib/time/clock";

/** UTF-8 byte order mark, so spreadsheet programs read ₹ and other characters correctly. */
const BOM = String.fromCharCode(0xfeff);

/** Text that a spreadsheet could read as a formula. Numbers are never prefixed. */
const CSV_INJECTION = /^[=+\-@\t\r]/;

const UNIT_LABEL: Readonly<Record<Unit, string>> = {
  inr_cr: "₹ Cr", inr: "₹", pct: "%", pp: "pp", x: "x", days: "days", years: "years", count: "count", score: "score",
  crore_shares: "Cr shares", fy_year: "FY",
};

/** One CSV cell: null → empty; numbers as plain decimals; risky text gets a leading apostrophe. */
export function toCsvCell(v: string | number | null): string {
  if (v === null) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return printNumber(Math.abs(v) < 1e15 ? Math.round(v * 1e6) / 1e6 : v);
  }
  const text = CSV_INJECTION.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header comment text on one line, so names in the data cannot start a new CSV row. */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ");
}

/** `SAMPLE-` prefix for synthetic data; the local date of the export. */
export function screenCsvFilename(store: MetricStore, base = "funda-screen"): string {
  return `${store.meta.isSynthetic ? "SAMPLE-" : ""}${base}-${localDateStamp()}.csv`;
}

function displayName(store: MetricStore, i: number): string {
  const name = store.company(i).name;
  return store.meta.isSynthetic && !/\(fictional\)/i.test(name) ? `${name} (fictional)` : name;
}

export function screenToCsv(run: ScreenRun, store: MetricStore): string {
  const meta = store.meta;
  const header = [
    "# Funda Scanner screen export",
    `# Dataset: ${oneLine(meta.name)}`,
    `# Synthetic: ${meta.isSynthetic ? "yes (fictional companies)" : "no"}`,
    `# Imported at: ${oneLine(meta.importedAt ?? "not applicable")}`,
    `# As of: ${oneLine(meta.asOf ?? "not provided")}`,
    `# Query: ${oneLine(run.compiled.canonical)}`,
    `# In plain English: ${oneLine(run.compiled.english)}`,
    `# Catalogue version: ${CATALOGUE_VERSION}`,
    "# Blank cells mean missing or not applicable",
  ];
  const cols = run.columns;
  const titles = ["Symbol", "Name", "Sector", "Industry"];
  for (const c of cols) titles.push(`${c.label} (${c.unit ? UNIT_LABEL[c.unit] : "value"}; ${c.periodTag})`);
  const sortTitle = run.sortValues && run.compiled.sort[0] ? `Sort value (${run.compiled.sort[0].text})` : null;
  if (sortTitle) titles.push(sortTitle);
  titles.push("is_synthetic");
  const lines = [titles.map(toCsvCell).join(",")];
  run.matched.forEach((i, k) => {
    const c = store.company(i);
    const cells: (string | number | null)[] = [c.symbol, displayName(store, i), c.sector, store.industry(i)];
    for (const col of cols) {
      const v = col.column.values[i];
      cells.push(col.column.reasons[i] === 0 && Number.isFinite(v) ? v : null);
    }
    if (sortTitle && run.sortValues) {
      const v = run.sortValues[k];
      cells.push(Number.isFinite(v) ? v : null);
    }
    cells.push(meta.isSynthetic ? "true" : "false");
    lines.push(cells.map(toCsvCell).join(","));
  });
  return `${BOM}${[...header, ...lines].join("\r\n")}\r\n`;
}

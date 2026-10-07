// src/lib/export-utils.ts — company exports (WS6).
// CSV: labelled long format with a "#" provenance header, an is_synthetic column and the SAMPLE- file prefix.
// Print view: built with DOM methods and textContent only. No HTML strings are ever written into a page.
import type { MetricDef, MetricStore, MetricValue, Unit } from "@/lib/contracts";
import { evaluateChecks, INSIGHTS_FOOTER, RED_FLAG_HEADING } from "@/lib/insights";
import { DASH, formatMetric, nullReasonText } from "@/lib/format/metric-value";
import { CATALOGUE_VERSION } from "@/lib/metrics";
import { toCsvCell } from "@/lib/screen/export-csv";
import { localDateStamp } from "@/lib/time/clock";
import {
  keyMetricGroups, NOT_EVALUATED_HEADING, quarterlyView, ratioView, shareholdingView, statementView, TYPE_LABEL,
  type GridRow, type PeriodColumn,
} from "@/lib/views/company-view";

const BOM = String.fromCharCode(0xfeff);

const UNIT_LABEL: Readonly<Record<Unit, string>> = {
  inr_cr: "₹ Cr", inr: "₹", pct: "%", pp: "pp", x: "x", days: "days", years: "years", count: "count", score: "score",
  crore_shares: "Cr shares", fy_year: "FY",
};

const oneLine = (text: string): string => text.replace(/[\r\n]+/g, " ");

/** Name with the inline "(fictional)" label for generated data (spec F.6 rule 2). */
export function exportName(store: MetricStore, i: number): string {
  const name = store.company(i).name;
  return store.meta.isSynthetic && !/\(fictional\)/i.test(name) ? `${name} (fictional)` : name;
}

export function companyCsvFilename(store: MetricStore, i: number): string {
  return `${store.meta.isSynthetic ? "SAMPLE-" : ""}funda-company-${store.company(i).symbol.toLowerCase()}-${localDateStamp()}.csv`;
}

interface Section {
  title: string;
  periods: readonly PeriodColumn[];
  rows: readonly GridRow[];
}

/** Every table that appears on the company page, as plain sections. */
function sections(store: MetricStore, i: number): Section[] {
  const out: Section[] = [];
  const keyRows: GridRow[] = keyMetricGroups(store.family(i)).flatMap((g) =>
    g.ids.flatMap((id) => {
      const def = store.def(id);
      return def ? [{ id, label: def.label, def, values: [store.get(id, i)], derived: false } satisfies GridRow] : [];
    }),
  );
  out.push({ title: "Key metrics (latest)", periods: [{ key: "latest", label: "Latest", note: null }], rows: keyRows });
  for (const [title, statement] of [["Profit and loss", "pnl"], ["Balance sheet", "balance_sheet"], ["Cash flow", "cash_flow"]] as const) {
    const v = statementView(store, i, statement);
    if (v.rows.length > 0) out.push({ title, periods: v.periods, rows: v.rows });
  }
  const q = quarterlyView(store, i);
  if (q.rows.length > 0) out.push({ title: "Quarterly results", periods: q.periods, rows: [...q.rows, ...q.growth] });
  const r = ratioView(store, i);
  if (r.rows.length > 0) out.push({ title: "Ratios", periods: r.periods, rows: r.rows });
  const s = shareholdingView(store, i);
  if (s.rows.length > 0) out.push({ title: "Shareholding", periods: s.periods, rows: [...s.rows, ...s.changes] });
  return out;
}

function csvValue(v: MetricValue): number | null {
  return v.v !== null && Number.isFinite(v.v) ? v.v : null;
}

/** Long-format CSV: one row per figure and period. Blank cells mean missing or not applicable. */
export function companyToCsv(store: MetricStore, i: number): string {
  const meta = store.meta;
  const c = store.company(i);
  const type = store.companyType(i);
  const header = [
    "# Funda Scanner company export",
    `# Company: ${oneLine(exportName(store, i))} (${oneLine(c.symbol)})`,
    `# Dataset: ${oneLine(meta.name)}`,
    `# Synthetic: ${meta.isSynthetic ? "yes (fictional companies)" : "no"}`,
    `# Imported at: ${oneLine(meta.importedAt ?? "not applicable")}`,
    `# As of: ${oneLine(meta.asOf ?? "not provided")}`,
    `# Statement basis: ${c.statement_basis}`,
    `# Type: ${TYPE_LABEL[type.type]}${type.inferred ? " (inferred from sector)" : ""}`,
    `# Catalogue version: ${CATALOGUE_VERSION}`,
    "# Blank cells mean missing or not applicable",
  ];
  const lines = [["symbol", "name", "section", "figure", "metric_id", "period", "unit", "value", "is_synthetic"].map(toCsvCell).join(",")];
  for (const sec of sections(store, i)) {
    for (const row of sec.rows) {
      row.values.forEach((v, k) => {
        const cells: (string | number | null)[] = [
          c.symbol, exportName(store, i), sec.title, row.label, row.id, sec.periods[k]?.label ?? "", UNIT_LABEL[row.def.unit], csvValue(v),
          meta.isSynthetic ? "true" : "false",
        ];
        lines.push(cells.map(toCsvCell).join(","));
      });
    }
  }
  return `${BOM}${[...header, ...lines].join("\r\n")}\r\n`;
}

/** Downloads the CSV. Returns false where the browser cannot create a download. */
export function downloadCompanyCsv(store: MetricStore, i: number): boolean {
  try {
    const blob = new Blob([companyToCsv(store, i)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = companyCsvFilename(store, i);
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

// ── Print view ──────────────────────────────────────────────────────────────
function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const PRINT_CSS = [
  "body{font-family:system-ui,Arial,sans-serif;color:#111;margin:24px;max-width:960px;line-height:1.4}",
  "h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 6px;border-bottom:1px solid #999}",
  "p,li{font-size:13px}.note{color:#444;font-size:12px}",
  "table{border-collapse:collapse;width:100%;font-size:12px;margin:6px 0}",
  "th,td{border-bottom:1px solid #ccc;padding:3px 6px;text-align:right}th:first-child,td:first-child{text-align:left}",
].join("\n");

function cellText(def: MetricDef, v: MetricValue, family: ReturnType<MetricStore["family"]>): string {
  if (v.v === null) return v.reason === "not_applicable_financial" ? nullReasonText("not_applicable_financial", family).short : DASH;
  return formatMetric(def, v);
}

/** Fills `doc` with a printable summary of the company. Uses createElement and textContent only. */
export function buildPrintDocument(doc: Document, store: MetricStore, i: number): void {
  const c = store.company(i);
  const type = store.companyType(i);
  const family = store.family(i);
  const meta = store.meta;
  doc.title = `${exportName(store, i)} (${c.symbol})`;
  const style = el(doc, "style", PRINT_CSS);
  doc.head.appendChild(style);
  const body = doc.body;
  body.textContent = "";
  body.appendChild(el(doc, "h1", exportName(store, i)));
  body.appendChild(el(doc, "p", `${c.symbol} · ${c.sector} › ${store.industry(i)} · ${TYPE_LABEL[type.type]}${type.inferred ? " (inferred from sector)" : ""} · ${c.statement_basis} figures`));
  body.appendChild(
    el(doc, "p", `${meta.isSynthetic ? "Sample data: generated figures that describe no real company. " : ""}Dataset: ${meta.name}. As of: ${meta.asOf ?? "not provided"}. Reference price date: ${c.market.price_date ?? "not provided"}.`, "note"),
  );

  for (const sec of sections(store, i)) {
    body.appendChild(el(doc, "h2", sec.title));
    const table = el(doc, "table");
    const head = el(doc, "tr");
    head.appendChild(el(doc, "th", "Figure"));
    for (const p of sec.periods) head.appendChild(el(doc, "th", p.label));
    table.appendChild(head);
    for (const row of sec.rows) {
      const tr = el(doc, "tr");
      tr.appendChild(el(doc, "td", row.label));
      for (const v of row.values) tr.appendChild(el(doc, "td", cellText(row.def, v, family)));
      table.appendChild(tr);
    }
    body.appendChild(table);
  }

  const outcomes = evaluateChecks(store, i).filter((o) => o.result !== "not_applicable");
  const addList = (heading: string, items: readonly string[]) => {
    if (items.length === 0) return;
    body.appendChild(el(doc, "h2", heading));
    const ul = el(doc, "ul");
    for (const t of items) ul.appendChild(el(doc, "li", t));
    body.appendChild(ul);
  };
  addList("Checks passed", outcomes.filter((o) => o.kind === "check" && o.result === "met").map((o) => `${o.title}. ${o.message}`));
  addList("Checks not passed", outcomes.filter((o) => o.kind === "check" && o.result === "not_met").map((o) => `${o.title}. ${o.message}`));
  addList(RED_FLAG_HEADING, outcomes.filter((o) => o.kind === "red_flag" && o.result === "met").map((o) => `${o.title}. ${o.message}`));
  addList(NOT_EVALUATED_HEADING, outcomes.filter((o) => o.result === "not_evaluated").map((o) => `${o.title}: ${nullReasonText(o.reason ?? "missing_input").short}`));
  body.appendChild(el(doc, "p", INSIGHTS_FOOTER, "note"));
}

/** Opens the print view in a new window and starts printing. Returns false when the window is blocked. */
export function openPrintView(store: MetricStore, i: number): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  buildPrintDocument(w.document, store, i);
  w.focus();
  w.print();
  return true;
}

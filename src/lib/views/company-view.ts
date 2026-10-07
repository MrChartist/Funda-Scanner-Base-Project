// src/lib/views/company-view.ts — view models for the Company page (WS6).
// Pure functions over a MetricStore: no React, no clock, no randomness. Every figure stays a
// MetricValue so the UI renders it through <ValueCell> (spec P1); nothing is formatted here.
import type {
  AnnualRow, CompanySectionId, CompanyType, MetricDef, MetricId, MetricStore, MetricValue, NullReason, PeriodSel, ShareholdingRow,
  TypeFamily,
} from "@/lib/contracts";
import { ANNUAL_FIELD_INFO, ANNUAL_FIELDS, COMPANY_SECTION_IDS, VF } from "@/lib/contracts";
import type { AnnualField, FieldStatement } from "@/lib/contracts";
import { addMonths, daysBetween, fyLabel, monthYearLabel } from "@/lib/time/civil";

// ── Sections and deep links ─────────────────────────────────────────────────
export const SECTION_LABELS: Readonly<Record<CompanySectionId, string>> = {
  summary: "Summary",
  checks: "Checks",
  scores: "Scores",
  screens: "Screens",
  quarterly: "Quarterly",
  pnl: "Profit and loss",
  "balance-sheet": "Balance sheet",
  "cash-flow": "Cash flow",
  ratios: "Ratios",
  shareholding: "Shareholding",
  dividends: "Dividends",
  peers: "Peers",
  "data-health": "Data health",
};

export const SECTION_LIST: readonly { id: CompanySectionId; label: string }[] = COMPANY_SECTION_IDS.map((id) => ({
  id,
  label: SECTION_LABELS[id],
}));

/** Hashes used by the previous company page, mapped to the new section ids. */
const OLD_HASHES: Readonly<Record<string, CompanySectionId>> = {
  header: "summary",
  "ratios-grid": "summary",
  "fundamental-scores": "scores",
  "pros-cons": "checks",
  "price-chart": "summary",
  "analyst-ratings": "summary",
  financials: "pnl",
  "cashflow-quality": "cash-flow",
  "ratio-trends": "ratios",
  segments: "summary",
  holdings: "shareholding",
  "insider-deals": "shareholding",
  management: "summary",
  documents: "summary",
  "corporate-actions": "dividends",
};

/** The section id a hash points to ("#pros-cons" → "checks"); null when it names nothing known. */
export function remapHash(hash: string): CompanySectionId | null {
  const id = hash.replace(/^#/, "").trim();
  if (!id) return null;
  if ((COMPANY_SECTION_IDS as readonly string[]).includes(id)) return id as CompanySectionId;
  return OLD_HASHES[id] ?? null;
}

// ── Copy shared by several components ───────────────────────────────────────
export const TYPE_LABEL: Readonly<Record<CompanyType, string>> = {
  non_financial: "Non-financial company",
  other_financial: "Other financial company",
  bank: "Bank",
  nbfc: "NBFC",
  insurance: "Insurer",
};

export const NOT_EVALUATED_HEADING = "Not evaluated (data not provided)";
export const NO_ANNUAL_TEXT = "Annual statements were not provided in your file.";
export const NO_QUARTERLY_TEXT = "Quarterly results were not provided in your file.";
export const NO_SHAREHOLDING_TEXT = "Shareholding data was not provided in your file.";

/** "3 of 4 checks passed", with a note when some could not be evaluated. */
export function areaCountText(a: { met: number; evaluated: number; total: number }): string {
  if (a.evaluated === 0) return "No check could be evaluated with your data";
  const base = `${a.met} of ${a.evaluated} ${a.evaluated === 1 ? "check" : "checks"} passed`;
  return a.total > a.evaluated ? `${base} · ${a.total - a.evaluated} not evaluated` : base;
}

// ── Small value helpers ─────────────────────────────────────────────────────
export const NO_VALUE = (reason: NullReason): MetricValue => ({ v: null, reason, flags: 0 });
export const PLAIN = (v: number | null, reason: NullReason = "missing_input"): MetricValue =>
  v === null || !Number.isFinite(v) ? NO_VALUE(reason) : { v, reason: null, flags: 0 };

/** Year-on-year or quarter-on-quarter change in percent, with the usual null rules. */
export function percentChange(cur: MetricValue, prev: MetricValue): MetricValue {
  if (cur.v === null) return NO_VALUE(cur.reason ?? "missing_input");
  if (prev.v === null) return NO_VALUE(prev.reason ?? "insufficient_history");
  if (prev.v <= 0) return { v: null, reason: "non_positive_denominator", flags: cur.v > 0 ? VF.Turnaround : 0 };
  return { v: (cur.v / prev.v - 1) * 100, reason: null, flags: 0 };
}

const fySel = (offset: number): PeriodSel => ({ freq: "fy", offset });
const qSel = (offset: number): PeriodSel => ({ freq: "q", offset });

export interface PeriodColumn {
  key: string;
  label: string;
  /** Extra note for the column, e.g. "restated". */
  note: string | null;
}

export interface GridRow {
  id: string;
  label: string;
  def: MetricDef;
  values: MetricValue[];
  /** A derived figure rather than a line item from the statements. */
  derived: boolean;
}

export interface GridView {
  periods: PeriodColumn[];
  rows: GridRow[];
  /** Labels of rows left out because the file holds no value for them. */
  hidden: string[];
}

function latestFy(store: MetricStore, i: number): number | null {
  const v = store.get("latest_fy", i).v;
  return v === null ? null : Math.round(v);
}

/** Annual periods oldest first, as offsets from the latest year. Holes keep their column. */
export function annualPeriods(store: MetricStore, i: number, max = 10): { offset: number; col: PeriodColumn }[] {
  const slots = Math.min(store.slots(i, "fy"), max);
  const latest = latestFy(store, i);
  const rows = store.company(i).annual;
  const out: { offset: number; col: PeriodColumn }[] = [];
  for (let k = slots - 1; k >= 0; k--) {
    const label = store.periodLabel(i, fySel(k)) ?? (latest === null ? `FY −${k}` : fyLabel(latest - k));
    const year = latest === null ? null : latest - k;
    const row: AnnualRow | undefined = year === null ? undefined : rows.find((r) => r.fiscal_year === year);
    const note = row?.flags.includes("transition") ? "transition year" : row?.flags.includes("restated") ? "restated" : null;
    out.push({ offset: k, col: { key: `fy${k}`, label, note } });
  }
  return out;
}

function familyOk(def: MetricDef, family: TypeFamily): boolean {
  return def.appliesTo.includes(family);
}

function rowFor(store: MetricStore, i: number, id: MetricId, offsets: number[], label?: string, derived = true): GridRow | null {
  const def = store.def(id);
  if (!def) return null;
  return { id, label: label ?? def.label, def, values: offsets.map((k) => store.at(id, i, fySel(k))), derived };
}

const allNull = (row: GridRow): boolean => row.values.every((v) => v.v === null);

/** Derived rows shown under each statement, by company family. */
const DERIVED_ROWS: Readonly<Record<FieldStatement, Readonly<Record<TypeFamily, readonly MetricId[]>>>> = {
  pnl: {
    non_financial: ["ebitda", "opm", "npm", "eps", "sales_growth", "profit_growth"],
    lender: ["nii", "ppop", "cost_to_income", "eps", "sales_growth", "profit_growth"],
    insurance: ["npm", "eps", "sales_growth", "profit_growth"],
  },
  balance_sheet: {
    non_financial: ["net_worth", "total_debt", "net_debt", "bvps"],
    lender: ["net_worth", "bvps"],
    insurance: ["net_worth", "bvps"],
  },
  cash_flow: {
    non_financial: ["fcf", "cfo_to_pat", "capex_to_sales"],
    lender: [],
    insurance: [],
  },
  quarterly: { non_financial: [], lender: [], insurance: [] },
  shareholding: { non_financial: [], lender: [], insurance: [] },
};

function lineItemApplies(applies: "all" | "non_financial" | "lender", family: TypeFamily): boolean {
  if (applies === "all") return true;
  if (applies === "lender") return family === "lender";
  return family !== "lender";
}

/** Rows of one annual statement: line items from ANNUAL_FIELD_INFO, then derived rows. */
export function statementView(store: MetricStore, i: number, statement: "pnl" | "balance_sheet" | "cash_flow"): GridView {
  const family = store.family(i);
  const periods = annualPeriods(store, i);
  const offsets = periods.map((p) => p.offset);
  const rows: GridRow[] = [];
  const hidden: string[] = [];
  for (const field of ANNUAL_FIELDS as readonly AnnualField[]) {
    const info = ANNUAL_FIELD_INFO[field];
    if (info.statement !== statement || !lineItemApplies(info.appliesTo, family)) continue;
    const row = rowFor(store, i, info.metricId, offsets, info.label, false);
    if (!row) continue;
    if (allNull(row)) hidden.push(info.label);
    else rows.push(row);
  }
  for (const id of DERIVED_ROWS[statement][family]) {
    const def = store.def(id);
    if (!def || !familyOk(def, family)) continue;
    const row = rowFor(store, i, id, offsets);
    if (row && !allNull(row)) rows.push(row);
  }
  return { periods: periods.map((p) => p.col), rows, hidden };
}

// ── Ratios over time, with the industry median per year ─────────────────────
const RATIO_IDS: Readonly<Record<TypeFamily, readonly MetricId[]>> = {
  non_financial: [
    "roce", "roe", "opm", "npm", "debt_equity", "interest_coverage", "current_ratio", "asset_turnover", "debtor_days",
    "inventory_days", "cash_conversion_cycle",
  ],
  lender: ["roe", "roa", "nim_approx", "cost_to_income", "credit_cost", "gnpa_ratio", "nnpa_ratio", "provision_coverage"],
  insurance: ["roe", "npm"],
};

export interface RatioRow extends GridRow {
  /** Industry median per period; null when no period has at least three comparable values. */
  medians: MetricValue[] | null;
}

export interface RatioView {
  periods: PeriodColumn[];
  rows: RatioRow[];
  /** "IT services · 12 companies in your data" or null when the company has no peer group. */
  groupLabel: string | null;
}

export function ratioView(store: MetricStore, i: number): RatioView {
  const family = store.family(i);
  const periods = annualPeriods(store, i);
  const offsets = periods.map((p) => p.offset);
  const groups = store.groups("industry");
  const g = groups.groupOf[i];
  const rows: RatioRow[] = [];
  for (const id of RATIO_IDS[family]) {
    const def = store.def(id);
    if (!def || !familyOk(def, family)) continue;
    const row = rowFor(store, i, id, offsets);
    if (!row || allNull(row)) continue;
    let medians: MetricValue[] | null = null;
    if (g >= 0) {
      const list = offsets.map((k) => {
        const col = store.columnAt(id, fySel(k));
        const med = store.medianOf(col.values, "industry");
        const v = med.values[i];
        return Number.isFinite(v) && med.reasons[i] === 0 ? PLAIN(v) : NO_VALUE("too_few_peers");
      });
      if (list.some((m) => m.v !== null)) medians = list;
    }
    rows.push({ ...row, medians });
  }
  return { periods: periods.map((p) => p.col), rows, groupLabel: g >= 0 ? groups.labels[g] : null };
}

// ── Quarterly results: QoQ and YoY matched by date ──────────────────────────
export interface QuarterlyView {
  periods: PeriodColumn[];
  rows: GridRow[];
  growth: GridRow[];
}

const QUARTER_IDS: Readonly<Record<TypeFamily, readonly MetricId[]>> = {
  non_financial: ["q_sales", "q_operating_profit", "q_opm", "q_net_profit"],
  lender: ["q_sales", "q_net_profit"],
  insurance: ["q_sales", "q_net_profit"],
};

export function quarterlyView(store: MetricStore, i: number, max = 12): QuarterlyView {
  const family = store.family(i);
  const slots = Math.min(store.slots(i, "q"), max);
  const offsets: number[] = [];
  for (let k = slots - 1; k >= 0; k--) offsets.push(k);
  const periods: PeriodColumn[] = offsets.map((k) => ({ key: `q${k}`, label: store.periodLabel(i, qSel(k)) ?? "Not provided", note: null }));
  const rows: GridRow[] = [];
  for (const id of QUARTER_IDS[family]) {
    const def = store.def(id);
    if (!def || !familyOk(def, family)) continue;
    const row: GridRow = { id, label: def.label, def, values: offsets.map((k) => store.at(id, i, qSel(k))), derived: id === "q_opm" || id === "q_operating_profit" };
    if (!allNull(row)) rows.push(row);
  }
  // Quarter slots are three months apart by construction, so k+1 is the previous quarter and k+4 the same quarter a year before.
  const pctDef = store.def("q_sales_yoy");
  const growth: GridRow[] = [];
  if (pctDef) {
    for (const [id, name] of [["q_sales", "Sales"], ["q_net_profit", "Net profit"]] as const) {
      const base = store.def(id);
      if (!base) continue;
      const at = (k: number) => store.at(id, i, qSel(k));
      growth.push({ id: `${id}_qoq`, label: `${name}, change on previous quarter`, def: pctDef, values: offsets.map((k) => percentChange(at(k), at(k + 1))), derived: true });
      growth.push({ id: `${id}_yoy`, label: `${name}, change on same quarter last year`, def: pctDef, values: offsets.map((k) => percentChange(at(k), at(k + 4))), derived: true });
    }
  }
  return { periods, rows, growth: growth.filter((r) => !allNull(r)) };
}

// ── Shareholding: read straight from the rows, compared with four quarters back ──
export interface ShareholdingView {
  periods: PeriodColumn[];
  rows: GridRow[];
  /** Change over about a year (matched by date, not by position). */
  changes: GridRow[];
}

const HOLD_FIELDS = [
  ["promoter_pct", "promoter_holding"],
  ["promoter_pledged_pct", "pledged_pct"],
  ["fii_pct", "fii_holding"],
  ["dii_pct", "dii_holding"],
  ["num_shareholders", "num_shareholders"],
] as const satisfies readonly (readonly [keyof ShareholdingRow, MetricId])[];

function yearBack(rows: readonly ShareholdingRow[], index: number): ShareholdingRow | null {
  const target = addMonths(rows[index].period_end, -12);
  if (!target) return null;
  for (let j = index - 1; j >= 0; j--) {
    const d = daysBetween(rows[j].period_end, target);
    if (d !== null && Math.abs(d) <= 15) return rows[j];
  }
  return null;
}

export function shareholdingView(store: MetricStore, i: number, max = 13): ShareholdingView {
  const all = store.company(i).shareholding;
  const rows = all.slice(-max);
  const offset = all.length - rows.length;
  const periods: PeriodColumn[] = rows.map((r) => ({ key: r.period_end, label: monthYearLabel(r.period_end), note: null }));
  const out: GridRow[] = [];
  const changes: GridRow[] = [];
  const chgDef = store.def("promoter_holding_chg_1y");
  for (const [field, id] of HOLD_FIELDS) {
    const def = store.def(id);
    if (!def) continue;
    const row: GridRow = { id, label: def.label, def, values: rows.map((r) => PLAIN(r[field])), derived: false };
    if (!allNull(row)) out.push(row);
    if (chgDef && field !== "num_shareholders" && field !== "promoter_pledged_pct") {
      const diff: GridRow = {
        id: `${id}_yoy`,
        label: `${def.label}, change on four quarters back`,
        def: chgDef,
        values: rows.map((r, k) => {
          const back = yearBack(all, k + offset);
          const a = r[field];
          const b = back ? back[field] : null;
          if (a === null) return NO_VALUE("missing_input");
          if (b === null) return NO_VALUE("insufficient_history");
          return PLAIN(a - b);
        }),
        derived: true,
      };
      if (!allNull(diff)) changes.push(diff);
    }
  }
  const pubDef = store.def("public_holding");
  if (pubDef) {
    const row: GridRow = {
      id: "public_holding",
      label: pubDef.label,
      def: pubDef,
      values: rows.map((r) =>
        r.promoter_pct === null || r.fii_pct === null || r.dii_pct === null
          ? NO_VALUE("missing_input")
          : { v: Math.max(0, 100 - r.promoter_pct - r.fii_pct - r.dii_pct), reason: null, flags: VF.Approximate }),
      derived: true,
    };
    if (!allNull(row)) out.push(row);
  }
  return { periods, rows: out, changes };
}

// ── Dividends ───────────────────────────────────────────────────────────────
export interface DividendView {
  periods: PeriodColumn[];
  rows: GridRow[];
  /** Latest-value tiles. */
  summary: { id: MetricId; def: MetricDef; value: MetricValue }[];
}

export function dividendView(store: MetricStore, i: number): DividendView {
  const periods = annualPeriods(store, i);
  const offsets = periods.map((p) => p.offset);
  const rows: GridRow[] = [];
  for (const id of ["dps", "dividend_payout"] as const) {
    const row = rowFor(store, i, id, offsets, undefined, id !== "dps");
    if (row) rows.push(row);
  }
  const summary = (["dividend_yield", "dividend_streak", "dps_cagr_5y", "dividend_payout_avg_3y"] as const).flatMap((id) => {
    const def = store.def(id);
    return def ? [{ id, def, value: store.get(id, i) }] : [];
  });
  return { periods: periods.map((p) => p.col), rows, summary };
}

export function hasDividendData(view: DividendView): boolean {
  return view.rows.some((r) => r.id === "dps" && r.values.some((v) => v.v !== null));
}

// ── Key metrics ─────────────────────────────────────────────────────────────
export interface MetricGroup {
  title: string;
  note?: string;
  ids: readonly MetricId[];
}

/** Key metrics per family. Lenders also see the non-lender measures, shown as not applicable. */
export function keyMetricGroups(family: TypeFamily): MetricGroup[] {
  if (family === "lender") {
    return [
      { title: "Size and valuation", ids: ["market_cap", "price", "pe", "pb", "p_abv", "dividend_yield", "eps", "bvps"] },
      { title: "Returns and growth", ids: ["roe", "roa", "nim_approx", "cost_to_income", "sales_cagr_5y", "net_profit_cagr_5y"] },
      { title: "Asset quality", ids: ["gnpa_ratio", "nnpa_ratio", "provision_coverage", "credit_cost"] },
      {
        title: "Measures that do not apply to lenders",
        note: "Banks and NBFCs keep accounts differently, so these are shown as not applicable instead of as a misleading number.",
        ids: ["roce", "debt_equity", "interest_coverage", "current_ratio"],
      },
    ];
  }
  if (family === "insurance") {
    return [
      { title: "Size and valuation", ids: ["market_cap", "price", "pe", "pb", "dividend_yield", "eps", "bvps"] },
      { title: "Returns and growth", ids: ["roe", "npm", "sales_cagr_5y", "net_profit_cagr_5y"] },
      {
        title: "Measures that do not apply to insurers",
        note: "Insurers keep accounts differently, so these are shown as not applicable.",
        ids: ["roce", "debt_equity", "interest_coverage", "current_ratio"],
      },
    ];
  }
  return [
    { title: "Size and valuation", ids: ["market_cap", "price", "pe", "pb", "ev_ebitda", "dividend_yield", "eps", "bvps"] },
    { title: "Returns and margins", ids: ["roce", "roe", "roic", "opm", "npm"] },
    { title: "Growth", ids: ["sales_cagr_5y", "net_profit_cagr_5y", "sales_growth", "profit_growth"] },
    { title: "Balance sheet and cash", ids: ["debt_equity", "interest_coverage", "current_ratio", "cum_cfo_to_pat_5y", "fcf_yield"] },
  ];
}

// ── Peers ───────────────────────────────────────────────────────────────────
export const PEER_COLUMNS: Readonly<Record<TypeFamily, readonly MetricId[]>> = {
  non_financial: ["market_cap", "pe", "roce", "opm", "sales_cagr_5y", "debt_equity"],
  lender: ["market_cap", "pe", "pb", "roe", "roa", "gnpa_ratio"],
  insurance: ["market_cap", "pe", "pb", "roe"],
};

export interface PeerRow {
  index: number;
  symbol: string;
  name: string;
  isSelf: boolean;
  family: TypeFamily;
  values: MetricValue[];
}

export interface PeerView {
  columns: MetricDef[];
  rows: PeerRow[];
  median: MetricValue[];
  /** Number of comparable companies behind each median. */
  counts: number[];
  groupLabel: string | null;
  fellBackTo: string | null;
}

export function peerView(store: MetricStore, i: number, limit = 8): PeerView {
  const family = store.family(i);
  const columns = PEER_COLUMNS[family].flatMap((id) => {
    const def = store.def(id);
    return def ? [def] : [];
  });
  const peers = store.peers(i, "industry", limit);
  const rowFor = (j: number): PeerRow => ({
    index: j,
    symbol: store.symbols[j],
    name: store.company(j).name,
    isSelf: j === i,
    family: store.family(j),
    values: columns.map((c) => store.get(c.id, j)),
  });
  const stats = columns.map((c) => store.peerStat(c.id, i, "industry"));
  const groups = store.groups("industry");
  const g = groups.groupOf[i];
  const fell = stats.find((s) => s.fellBackTo !== null);
  return {
    columns,
    rows: [rowFor(i), ...peers.map(rowFor)],
    median: stats.map((s) => (s.median === null ? NO_VALUE("too_few_peers") : PLAIN(s.median))),
    counts: stats.map((s) => s.n),
    groupLabel: g >= 0 ? groups.labels[g] : null,
    fellBackTo: fell?.fellBackTo ?? null,
  };
}

// src/lib/data/import/csv.ts — RFC 4180 CSV reading and cell parsing (WS1).
// Cells are treated as data only: nothing is evaluated, and text is never interpreted as markup.

export interface CsvOptions {
  /** Skip records whose first character is "#" (outside quotes). Default false (legacy behaviour). */
  comments?: boolean;
}

export interface CsvTable {
  rows: string[][];
  /** Text of every skipped "#" comment line, without the leading "#". */
  comments: string[];
}

/**
 * Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF/LF, embedded newlines and a
 * leading byte-order mark. Blank lines are skipped. With `comments`, a line that starts with "#"
 * at the beginning of a record is skipped up to the end of the line (quotes inside it are ignored).
 */
export function parseCsvTable(text: string, o: CsvOptions = {}): CsvTable {
  const rows: string[][] = [];
  const comments: string[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let cellQuoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (o.comments && ch === "#" && row.length === 0 && cell.trim() === "" && !cellQuoted) {
      let end = i;
      while (end < src.length && src[end] !== "\n" && src[end] !== "\r") end++;
      comments.push(src.slice(i + 1, end).trim());
      if (src[end] === "\r" && src[end + 1] === "\n") end++;
      i = end;
      cell = "";
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      cellQuoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
      cellQuoted = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      cellQuoted = false;
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return { rows, comments };
}

/** Legacy entry point (unchanged behaviour): no comment handling. */
export function parseCSV(text: string): string[][] {
  return parseCsvTable(text).rows;
}

/** Number of data records (header excluded) without building them; used for the row limit. */
export function countCsvRecords(table: CsvTable): number {
  return Math.max(0, table.rows.length - 1);
}

// ── cells ───────────────────────────────────────────────────────────────────
/** Cell text that means "not provided". */
export const MISSING_TOKENS: ReadonlySet<string> = new Set(["", "-", "—", "–", "na", "n/a", "nan", "null", "none", "nil", "#n/a"]);

export function isMissingText(s: string): boolean {
  return MISSING_TOKENS.has(s.trim().toLowerCase());
}

/** Result of reading one numeric cell: a finite number, null (missing) or invalid text. */
export interface CellNumber {
  /** False when the cell holds text that is not a number. */
  ok: boolean;
  /** The number, or null when missing or invalid. */
  v: number | null;
  /** The original cell text (empty for non-text input). */
  text: string;
}

/**
 * Reads a numeric cell. Accepts "1,234.5", Indian grouping "1,20,000", "12%", "₹ 99", "Rs. 99",
 * a trailing "Cr", accounting negatives "(123.4)" and the Unicode minus sign. Blank, "-", "NA" and
 * similar become null. NaN and infinities become null. Anything else is invalid.
 */
export function readNumberCell(raw: unknown): CellNumber {
  if (raw === null || raw === undefined) return { ok: true, v: null, text: "" };
  if (typeof raw === "number") return { ok: true, v: Number.isFinite(raw) ? raw : null, text: "" };
  if (typeof raw === "boolean" || typeof raw === "object") return { ok: false, v: null, text: String(raw) };
  const text = String(raw);
  let s = text.trim();
  if (isMissingText(s)) return { ok: true, v: null, text };
  s = s.replace(/−/g, "-");
  let negative = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1];
  }
  s = s
    .replace(/^(?:rs\.?|inr)\s*/i, "")
    .replace(/\s*(?:crores?|cr)\.?$/i, "")
    .replace(/[,%₹\s]/g, "");
  if (s === "" || !/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(s)) return { ok: false, v: null, text };
  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, v: null, text };
  return { ok: true, v: negative ? -n : n, text };
}

/** Trimmed text, or null when blank or a missing token. */
export function readTextCell(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return null;
  const s = String(raw).trim();
  return s === "" || isMissingText(s) ? null : s;
}

/** UTF-8 byte length without allocating an encoder. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

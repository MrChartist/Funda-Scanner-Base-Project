// Legacy snapshot import (one row per company) into StockRow[]. Pure and UI-free.
// Implemented in src/lib/data/import/{csv,snapshot}.ts; this module keeps the original API.
// Format reference: docs/data-format.md

export { parseCSV } from "./data/import/csv";
export {
  MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseFundamentals, parseFundamentalsCSV, parseFundamentalsJSON,
  type ImportIssue, type ImportResult,
} from "./data/import/snapshot";

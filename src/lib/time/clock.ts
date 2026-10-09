// src/lib/time/clock.ts — the ONLY core file allowed to read the clock (ESLint enforces this).
// Used for real user actions only: import time (meta.importedAt), save times and export
// filenames. Never used to label data.

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Current instant as an ISO 8601 UTC string, e.g. "2026-10-07T09:30:00.000Z". */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Today's date in the user's local time zone, "YYYY-MM-DD". */
export function localDateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

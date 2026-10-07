// src/lib/format/indian.ts — en-IN number formatting (P0, handed to WS7).
// Implemented by hand (not Intl) so output is identical on every runtime and ICU build.
// Negatives use an ASCII minus ("-"). Non-finite input renders as "—".

export const DASH = "—";
/** 1 lakh crore = 1,00,000 crore. */
export const LAKH_CRORE = 100_000;

/** Groups an unsigned integer string the Indian way: 12345678 → "1,23,45,678". */
export function groupIndian(intDigits: string): string {
  if (intDigits.length <= 3) return intDigits;
  const last3 = intDigits.slice(-3);
  let rest = intDigits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest.length) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

/** Rounds half away from zero at `decimals` places and returns a plain decimal string. */
function fixed(abs: number, decimals: number): string {
  const d = Math.max(0, Math.min(10, Math.floor(decimals)));
  // toFixed has binary-representation surprises (1.005 → "1.00"); nudge by a relative epsilon.
  const nudged = abs + abs * Number.EPSILON * 4;
  return nudged.toFixed(d);
}

/** 1234567.891, 2 → "12,34,567.89"; -0.004, 2 → "0.00". */
export function formatNumberIN(v: number, decimals: number): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  const s = fixed(Math.abs(v), decimals);
  const [intPart, frac] = s.split(".");
  const isZero = /^[0.]*$/.test(s);
  const sign = v < 0 && !isZero ? "-" : "";
  return `${sign}${groupIndian(intPart)}${frac !== undefined ? `.${frac}` : ""}`;
}

/**
 * ₹ crore amounts: below 1,00,000 Cr "₹52,140 Cr"; from 1,00,000 Cr "₹1.92 lakh Cr".
 * `decimals` applies below one lakh crore (default 0); lakh crore always uses 2 decimals.
 */
export function formatInrCrore(v: number, decimals = 0): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const roundedCrore = Number(fixed(abs, decimals));
  if (roundedCrore >= LAKH_CRORE) {
    return `${sign}₹${formatNumberIN(abs / LAKH_CRORE, 2)} lakh Cr`;
  }
  const body = formatNumberIN(abs, decimals);
  return `${body === formatNumberIN(0, decimals) ? "" : sign}₹${body} Cr`;
}

/** Rupee amounts such as per-share values: 1210.5 → "₹1,210.50". */
export function formatInr(v: number, decimals = 2): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  const body = formatNumberIN(Math.abs(v), decimals);
  const sign = v < 0 && body !== formatNumberIN(0, decimals) ? "-" : "";
  return `${sign}₹${body}`;
}

/** 22.43, 1 → "22.4%". */
export function formatPercent(v: number, decimals = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  return `${formatNumberIN(v, decimals)}%`;
}

/** Percentage-point change with an explicit sign: 1.2 → "+1.2 pp", -0.5 → "-0.5 pp", 0 → "0.0 pp". */
export function formatPoints(v: number, decimals = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  const body = formatNumberIN(v, decimals);
  const isZero = body === formatNumberIN(0, decimals);
  return `${v > 0 && !isZero ? "+" : ""}${body} pp`;
}

/** Multiples: 24.53, 1 → "24.5x". */
export function formatMultiple(v: number, decimals = 1): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return DASH;
  return `${formatNumberIN(v, decimals)}x`;
}

// src/lib/sample/prng.ts — deterministic pseudo-random numbers for the synthetic sample (§F.3).
// Pure functions over an explicit state object: there is no module-level state, so two
// generators never interfere and adding a company never reshuffles the others.
// Only integer operations (Math.imul, shifts, xor) are used, so the output is bit-identical
// across JavaScript engines.

/** Explicit PRNG state. One per company. */
export interface Rng {
  s: number;
}

/** 32-bit FNV-1a hash of a string (UTF-16 code units folded to bytes ≤ 0xff per unit). */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    // Hash both bytes of a UTF-16 unit so non-ASCII text still spreads well.
    if (c > 0xff) {
      h ^= c >>> 8;
      h = Math.imul(h, 0x01000193);
    }
    h ^= c & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Creates a mulberry32 state from a 32-bit seed. */
export function mulberry32(seed: number): Rng {
  return { s: seed >>> 0 };
}

/** The per-company generator: mulberry32 seeded by fnv1a32(`${seed}:${slug}`). */
export function companyRng(seed: number, slug: string): Rng {
  return mulberry32(fnv1a32(`${seed}:${slug}`));
}

/** Next 32-bit unsigned integer (advances the state). */
export function nextUint32(rng: Rng): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

/** Uniform float in [0, 1). */
export function nextFloat(rng: Rng): number {
  return nextUint32(rng) / 4294967296;
}

/** Uniform float in [lo, hi). */
export function between(rng: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * nextFloat(rng);
}

/** Uniform float drawn from a [lo, hi] pair. */
export function fromRange(rng: Rng, range: readonly [number, number]): number {
  return between(rng, range[0], range[1]);
}

/** Uniform integer in [lo, hi] (inclusive). */
export function intBetween(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(nextFloat(rng) * (hi - lo + 1));
}

/** Symmetric noise in (−amp, amp), shaped like a bell (mean of three uniforms). */
export function noise(rng: Rng, amp: number): number {
  const u = (nextFloat(rng) + nextFloat(rng) + nextFloat(rng)) / 3;
  return (u * 2 - 1) * amp;
}

/** True with probability p. */
export function chance(rng: Rng, p: number): boolean {
  return nextFloat(rng) < p;
}

/** One element of a non-empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() needs a non-empty list");
  return items[Math.min(items.length - 1, Math.floor(nextFloat(rng) * items.length))];
}

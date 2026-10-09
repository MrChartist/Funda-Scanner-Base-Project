import { describe, expect, it } from "vitest";
import {
  between, chance, companyRng, fnv1a32, fromRange, intBetween, mulberry32, nextFloat, nextUint32, noise, pick,
} from "./prng";

describe("fnv1a32", () => {
  it("matches the published FNV-1a test vectors", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });

  it("returns unsigned 32-bit integers and separates similar keys", () => {
    const keys = ["24301:it-01", "24301:it-02", "24302:it-01", "24301:₹-01"];
    const hashes = keys.map(fnv1a32);
    expect(new Set(hashes).size).toBe(keys.length);
    for (const h of hashes) {
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe("mulberry32", () => {
  it("is deterministic and keeps its state in the object only", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => nextUint32(a));
    const seqB = Array.from({ length: 20 }, () => nextUint32(b));
    expect(seqA).toEqual(seqB);
    // Interleaving another generator does not disturb this one.
    const c = mulberry32(42);
    const other = mulberry32(7);
    const seqC = Array.from({ length: 20 }, () => {
      nextUint32(other);
      return nextUint32(c);
    });
    expect(seqC).toEqual(seqA);
  });

  it("produces floats in [0, 1) with a sensible spread", () => {
    const rng = mulberry32(24301);
    let sum = 0;
    let min = 1;
    let max = 0;
    for (let i = 0; i < 20000; i++) {
      const x = nextFloat(rng);
      expect(x >= 0 && x < 1).toBe(true);
      sum += x;
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
    expect(sum / 20000).toBeGreaterThan(0.48);
    expect(sum / 20000).toBeLessThan(0.52);
    expect(min).toBeLessThan(0.001);
    expect(max).toBeGreaterThan(0.999);
  });

  it("derives each company's stream from the seed and its slug", () => {
    expect(companyRng(24301, "it-01")).toEqual({ s: fnv1a32("24301:it-01") });
    expect(nextUint32(companyRng(24301, "it-01"))).not.toBe(nextUint32(companyRng(24301, "it-02")));
  });
});

describe("helpers", () => {
  it("draw within their bounds", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 2000; i++) {
      const b = between(rng, -2, 3);
      expect(b >= -2 && b < 3).toBe(true);
      const r = fromRange(rng, [10, 11]);
      expect(r >= 10 && r < 11).toBe(true);
      const k = intBetween(rng, 0, 11);
      expect(Number.isInteger(k) && k >= 0 && k <= 11).toBe(true);
      const z = noise(rng, 0.5);
      expect(Math.abs(z)).toBeLessThan(0.5);
      expect(["a", "b", "c"]).toContain(pick(rng, ["a", "b", "c"]));
    }
  });

  it("reaches every integer and honours probabilities", () => {
    const rng = mulberry32(9);
    const seen = new Set<number>();
    let hits = 0;
    for (let i = 0; i < 5000; i++) {
      seen.add(intBetween(rng, 1, 6));
      if (chance(rng, 0.25)) hits++;
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(hits / 5000).toBeGreaterThan(0.22);
    expect(hits / 5000).toBeLessThan(0.28);
    expect(chance(rng, 0)).toBe(false);
  });

  it("refuses to pick from an empty list", () => {
    expect(() => pick(mulberry32(1), [])).toThrow(/non-empty/);
  });
});

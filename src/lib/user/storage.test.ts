import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createId, readEnvelope, readRaw, removeKey, writeEnvelope, writeRaw } from "./storage";

describe("envelopes", () => {
  beforeEach(() => localStorage.clear());

  it("writes { v, data } and reads it back at the same version", () => {
    expect(writeEnvelope("k", 2, { symbols: ["ABC"] })).toBe(true);
    expect(JSON.parse(localStorage.getItem("k") ?? "null")).toEqual({ v: 2, data: { symbols: ["ABC"] } });
    const migrate = vi.fn(() => null);
    expect(readEnvelope("k", 2, migrate)).toEqual({ symbols: ["ABC"] });
    expect(migrate).not.toHaveBeenCalled();
  });

  it("returns null for an absent key without calling migrate", () => {
    const migrate = vi.fn(() => "x");
    expect(readEnvelope("missing", 1, migrate)).toBeNull();
    expect(migrate).not.toHaveBeenCalled();
  });

  it("migrates bare v0 values and older envelopes, without writing back", () => {
    localStorage.setItem("followed", JSON.stringify(["AAA", "BBB"]));
    const out = readEnvelope<{ symbols: string[] }>("followed", 2, (raw) => (Array.isArray(raw) ? { symbols: raw as string[] } : null));
    expect(out).toEqual({ symbols: ["AAA", "BBB"] });
    expect(localStorage.getItem("followed")).toBe(JSON.stringify(["AAA", "BBB"]));

    localStorage.setItem("old", JSON.stringify({ v: 1, data: "a" }));
    expect(readEnvelope("old", 2, (raw) => ((raw as { v: number }).v === 1 ? "migrated" : null))).toBe("migrated");
  });

  it("passes non-JSON text to migrate and survives a throwing migrate", () => {
    localStorage.setItem("source", "sample");
    expect(readEnvelope("source", 1, (raw) => (raw === "sample" ? "sample" : null))).toBe("sample");
    expect(readEnvelope("source", 1, () => {
      throw new Error("boom");
    })).toBeNull();
  });

  it("never throws when storage fails", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(writeEnvelope("k", 1, "x")).toBe(false);
    expect(writeRaw("k", "x")).toBe(false);
    spy.mockRestore();
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(writeEnvelope("k", 1, cyclic)).toBe(false);
  });

  it("reads and removes raw keys", () => {
    writeRaw("a", "1");
    expect(readRaw("a")).toBe("1");
    expect(removeKey("a")).toBe(true);
    expect(readRaw("a")).toBeNull();
  });
});

describe("createId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => createId()));
    expect(ids.size).toBe(200);
  });

  it("works without crypto.randomUUID", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.fill(7) });
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("works with no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);
    const a = createId();
    const b = createId();
    expect(a).toMatch(/^id-\d+-[0-9a-z]+$/);
    expect(a).not.toBe(b);
  });
});

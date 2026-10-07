import { describe, expect, it } from "vitest";
import { SAMPLE_PROVIDER_ID, createSampleProvider } from "./sample-provider";

describe("createSampleProvider", () => {
  it("is a v2 provider whose isDemo matches the synthetic flag", async () => {
    const p = createSampleProvider();
    expect(p.id).toBe(SAMPLE_PROVIDER_ID);
    expect(p.isDemo).toBe(true);
    expect(p.revision).toBe(0);
    expect(p.name).toMatch(/fictional/i);
    expect(p.getUniverse).toBeUndefined();
    const ds = await p.getDataset?.();
    expect(ds?.companies).toHaveLength(150);
    expect(ds?.meta.isSynthetic).toBe(p.isDemo);
    expect(ds?.meta.asOf).toBeNull();
  });

  it("returns a fresh, equal dataset on every call", async () => {
    const p = createSampleProvider();
    const a = await p.getDataset?.();
    const b = await p.getDataset?.();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

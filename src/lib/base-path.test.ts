import { describe, expect, it } from "vitest";
import { assetUrl, BASE_URL, ROUTER_BASENAME } from "./base-path";

describe("base path (tests run at the site root)", () => {
  it("has a trailing slash and no router basename at the root", () => {
    expect(BASE_URL.endsWith("/")).toBe(true);
    expect(ROUTER_BASENAME).toBeUndefined();
  });

  it("builds asset URLs without doubling slashes", () => {
    expect(assetUrl("sample-data/x.csv")).toBe(`${BASE_URL}sample-data/x.csv`);
    expect(assetUrl("/sample-data/x.csv")).toBe(`${BASE_URL}sample-data/x.csv`);
  });
});

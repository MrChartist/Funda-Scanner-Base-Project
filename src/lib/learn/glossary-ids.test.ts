import { describe, expect, it } from "vitest";
import { GLOSSARY } from "./glossary";
import { GLOSSARY_IDS, hasGlossaryEntry } from "./glossary-ids";

describe("glossary ids", () => {
  it("lists exactly the metrics that have a glossary entry", () => {
    expect([...GLOSSARY_IDS].sort()).toEqual(Object.keys(GLOSSARY).sort());
  });

  it("answers per metric", () => {
    expect(hasGlossaryEntry("roce")).toBe(true);
    expect(hasGlossaryEntry("not_a_metric")).toBe(false);
  });
});

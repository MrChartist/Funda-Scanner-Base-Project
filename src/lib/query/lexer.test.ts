import { describe, expect, it } from "vitest";
import { lex } from "./lexer";

const kinds = (src: string) => lex(src).tokens.map((t) => t.kind);
const texts = (src: string) => lex(src).tokens.filter((t) => t.kind !== "eof").map((t) => t.text);

describe("lexer", () => {
  it("gives character spans for every token", () => {
    const src = "roce >= 15 AND pe<20";
    const toks = lex(src).tokens;
    for (const t of toks) expect(src.slice(t.start, t.end)).toBe(t.text);
    expect(texts(src)).toEqual(["roce", ">=", "15", "AND", "pe", "<", "20"]);
  });

  it("reads numbers with underscores, decimals and suffixes, scaling k and lakh", () => {
    const toks = lex("1_00_000 .5 15% 15 % 0.5x 500cr 20k 1.5lakh 2 lakhs 3 crores").tokens;
    const nums = toks.filter((t) => t.kind === "num");
    expect(nums.map((t) => t.value)).toEqual([100000, 0.5, 15, 15, 0.5, 500, 20000, 150000, 200000, 3]);
    expect(nums.map((t) => t.suffix)).toEqual([null, null, "%", "%", "x", "cr", "k", "lakh", "lakh", "cr"]);
    expect(nums.find((t) => t.text === "1.5lakh")?.decimals).toBe(0);
    expect(lex("15.25").tokens[0].decimals).toBe(2);
  });

  it("consumes a suffix word after at most one space and only as a whole word", () => {
    expect(texts("roe > 15 x")).toEqual(["roe", ">", "15 x"]);
    expect(texts("roe > 15  x")).toEqual(["roe", ">", "15", "x"]);
    expect(texts("roe > 15 xyz")).toEqual(["roe", ">", "15", "xyz"]);
  });

  it("reads durations (integers only) in years and quarters", () => {
    const d = lex("5y 10 years 3 yrs 8q 4 quarters").tokens.filter((t) => t.kind === "dur");
    expect(d.map((t) => [t.value, t.durUnit])).toEqual([[5, "y"], [10, "y"], [3, "y"], [8, "q"], [4, "q"]]);
    const bad = lex("1.5y");
    expect(bad.issues.map((i) => i.code)).toEqual(["E_BAD_NUMBER"]);
  });

  it("drops comments, records new lines and reports that comments exist", () => {
    const res = lex("roce > 15 # strong and steady\npe < 20");
    expect(res.hasComments).toBe(true);
    const pe = res.tokens.find((t) => t.text === "pe");
    expect(pe?.nlBefore).toBe(true);
    expect(res.tokens.some((t) => t.text === "steady")).toBe(false);
    expect(lex("roce > 15").hasComments).toBe(false);
  });

  it("reads strings in both quote styles and backtick names", () => {
    const toks = lex(`"Cement" 'Metals & Mining' \`Cash and bank balances\``).tokens;
    expect(toks.slice(0, 3).map((t) => [t.kind, t.word])).toEqual([
      ["str", "Cement"], ["str", "Metals & Mining"], ["backtick", "Cash and bank balances"],
    ]);
  });

  it("reports an unterminated string with a fix", () => {
    const res = lex('sector = "cement');
    expect(res.issues[0]).toMatchObject({ code: "E_UNTERMINATED_STRING", span: { start: 9, end: 16 } });
    expect(res.issues[0].suggestions[0].replacement).toBe('"cement"');
  });

  it("rejects commas inside numbers (Indian and Western grouping)", () => {
    for (const src of ["market_cap > 1,00,000", "market_cap > 100,000", "x > 12,34,567.5"]) {
      const res = lex(src);
      expect(res.issues.map((i) => i.code)).toEqual(["E_COMMA_IN_NUMBER"]);
    }
    expect(lex("market_cap > 1,00,000").issues[0].suggestions[0].replacement).toBe("100000");
    // A comma between two arguments is not a number.
    expect(lex("max(roe, 15)").issues).toEqual([]);
  });

  it("reports unknown attached suffixes and stray characters", () => {
    expect(lex("roe > 15abc").issues.map((i) => i.code)).toEqual(["E_UNKNOWN_SUFFIX"]);
    expect(lex("roce @ 5").issues[0]).toMatchObject({ code: "E_UNEXPECTED_CHAR", span: { start: 5, end: 6 } });
    const amp = lex("roce > 1 && pe < 2").issues[0];
    expect(amp.code).toBe("E_UNEXPECTED_CHAR");
    expect(amp.suggestions[0].replacement).toBe("AND");
    expect(lex("a || b").issues[0].suggestions[0].replacement).toBe("OR");
    expect(lex("1.2.3").issues[0].code).toBe("E_BAD_NUMBER");
  });

  it("emits a bad token for each lexical error so the parser can stay silent", () => {
    expect(kinds("roce @ 5")).toEqual(["ident", "bad", "num", "eof"]);
  });

  it("merges ident/ident into one word only when the joined word is a known alias", () => {
    const known = (w: string) => ["pe", "evebitda", "de"].includes(w);
    expect(lex("p/e < 25", { isKnownWord: known }).tokens[0]).toMatchObject({ kind: "ident", text: "p/e", word: "pe" });
    expect(lex("ev/ebitda", { isKnownWord: known }).tokens[0].word).toBe("evebitda");
    expect(texts("market_cap/sales")).toEqual(["market_cap", "/", "sales"]);
    expect(lex("market_cap/sales", { isKnownWord: known }).tokens.map((t) => t.text)).toEqual(["market_cap", "/", "sales", ""]);
    expect(lex("p / e", { isKnownWord: known }).tokens.map((t) => t.text)).toEqual(["p", "/", "e", ""]);
  });

  it("reads two-character operators", () => {
    expect(texts("a >= b <= c != d <> e == f")).toEqual(["a", ">=", "b", "<=", "c", "!=", "d", "<>", "e", "==", "f"]);
  });
});

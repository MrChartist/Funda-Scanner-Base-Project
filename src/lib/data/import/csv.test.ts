import { describe, expect, it } from "vitest";
import { isMissingText, parseCSV, parseCsvTable, readNumberCell, readTextCell, utf8Length } from "./csv";

describe("parseCsvTable", () => {
  it("parses quoted fields, escaped quotes, CRLF and a BOM", () => {
    const t = '\uFEFFa,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",z\r\n';
    expect(parseCsvTable(t).rows).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["line1\nline2", "z"]]);
    expect(parseCSV(t)).toEqual(parseCsvTable(t).rows);
  });

  it("skips # comment lines only when asked, including ones with commas and quotes", () => {
    const t = '# note, with "a quote\nsymbol,pe\n  # indented note\nA,1\n';
    expect(parseCsvTable(t, { comments: true })).toEqual({ rows: [["symbol", "pe"], ["A", "1"]], comments: ['note, with "a quote', "indented note"] });
    expect(parseCSV("# x\nsymbol\n")).toEqual([["# x"], ["symbol"]]);
  });

  it("keeps a # that is inside a quoted cell or later in a row", () => {
    const t = 'symbol,name\n"#1",Hash Ltd\nB,"Name # 2"\n';
    expect(parseCsvTable(t, { comments: true }).rows).toEqual([["symbol", "name"], ["#1", "Hash Ltd"], ["B", "Name # 2"]]);
  });

  it("handles a last line without a newline and blank lines", () => {
    expect(parseCsvTable("a\n\n\nb").rows).toEqual([["a"], ["b"]]);
    expect(parseCsvTable("").rows).toEqual([]);
  });
});

describe("readNumberCell", () => {
  it.each([
    ["1,234.5", 1234.5],
    ["1,20,000", 120000],
    ["12%", 12],
    ["₹ 99", 99],
    ["Rs. 1,500", 1500],
    ["INR 7", 7],
    ["2,500 Cr", 2500],
    ["(123.4)", -123.4],
    ["−5", -5],
    ["-0.5", -0.5],
    ["1e3", 1000],
    [".5", 0.5],
  ])("reads %s", (text, v) => {
    expect(readNumberCell(text)).toEqual({ ok: true, v, text });
  });

  it.each(["", " ", "-", "—", "NA", "n/a", "NaN", "null", "none", "nil", "#N/A"])("treats %j as missing", (text) => {
    expect(readNumberCell(text).ok).toBe(true);
    expect(readNumberCell(text).v).toBeNull();
    expect(isMissingText(text)).toBe(true);
  });

  it("rejects junk without inventing a value", () => {
    for (const t of ["abc", "12abc", "0x10", "₹", "1.2.3", "Infinity", "(", "1,2,3x"]) {
      expect(readNumberCell(t)).toMatchObject({ ok: false, v: null });
    }
    expect(readNumberCell(true)).toMatchObject({ ok: false });
    expect(readNumberCell({})).toMatchObject({ ok: false });
  });

  it("passes numbers through and turns non-finite numbers into null", () => {
    expect(readNumberCell(0)).toEqual({ ok: true, v: 0, text: "" });
    expect(readNumberCell(Number.NaN).v).toBeNull();
    expect(readNumberCell(Number.POSITIVE_INFINITY).v).toBeNull();
    expect(readNumberCell(null).v).toBeNull();
    expect(readNumberCell(undefined).v).toBeNull();
  });
});

describe("text cells and sizes", () => {
  it("trims text and treats missing tokens as null", () => {
    expect(readTextCell("  Alpha  ")).toBe("Alpha");
    expect(readTextCell("NA")).toBeNull();
    expect(readTextCell("")).toBeNull();
    expect(readTextCell(42)).toBe("42");
    expect(readTextCell({})).toBeNull();
    expect(readTextCell("=HYPERLINK(1)")).toBe("=HYPERLINK(1)"); // data only, kept as text
  });

  it("counts UTF-8 bytes", () => {
    expect(utf8Length("abc")).toBe(3);
    expect(utf8Length("₹")).toBe(3);
    expect(utf8Length("é")).toBe(2);
    expect(utf8Length("😀")).toBe(4);
  });
});

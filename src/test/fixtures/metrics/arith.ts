// src/test/fixtures/metrics/arith.ts — a tiny arithmetic evaluator for hand-written expectations.
// The golden tables write each expected value as the arithmetic a reviewer checks by hand
// ("234 / ((1343.75 + 1246.25) / 2) * 100"); this evaluates that text (no eval()), so the number
// the test compares against is exactly the arithmetic shown in golden-company.md.
// Grammar: expr = term {(+|-) term}; term = power {(*|/) power}; power = unary [^ power];
// unary = - unary | primary; primary = number | ( expr ) | sqrt( expr ) | min( expr, … ) | max( … ).

export function evaluateArithmetic(text: string): number {
  let pos = 0;
  const src = text.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");

  const peek = (): string => {
    while (pos < src.length && src[pos] === " ") pos++;
    return src[pos] ?? "";
  };
  const expect = (ch: string): void => {
    if (peek() !== ch) throw new SyntaxError(`Expected "${ch}" at ${pos} in "${text}"`);
    pos++;
  };

  function primary(): number {
    const ch = peek();
    if (ch === "(") {
      pos++;
      const v = expr();
      expect(")");
      return v;
    }
    const fn = /^(sqrt|min|max)\(/.exec(src.slice(pos));
    if (fn) {
      pos += fn[1].length + 1;
      const args = [expr()];
      while (peek() === ",") {
        pos++;
        args.push(expr());
      }
      expect(")");
      if (fn[1] === "sqrt") return Math.sqrt(args[0]);
      return fn[1] === "min" ? Math.min(...args) : Math.max(...args);
    }
    const m = /^\d+(\.\d+)?/.exec(src.slice(pos));
    if (!m) throw new SyntaxError(`Unexpected "${ch}" at ${pos} in "${text}"`);
    pos += m[0].length;
    return Number(m[0]);
  }
  function unary(): number {
    if (peek() === "-") {
      pos++;
      return -unary();
    }
    return primary();
  }
  function power(): number {
    const base = unary();
    if (peek() === "^") {
      pos++;
      return Math.pow(base, power());
    }
    return base;
  }
  function term(): number {
    let v = power();
    for (;;) {
      const ch = peek();
      if (ch === "*") {
        pos++;
        v *= power();
      } else if (ch === "/") {
        pos++;
        v /= power();
      } else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      const ch = peek();
      if (ch === "+") {
        pos++;
        v += term();
      } else if (ch === "-") {
        pos++;
        v -= term();
      } else return v;
    }
  }
  const v = expr();
  if (peek() !== "") throw new SyntaxError(`Unexpected trailing text at ${pos} in "${text}"`);
  return v;
}

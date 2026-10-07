// src/lib/query/chips.ts — two-way sync between a query and simple rule chips (§D.10).
import type { Chip, ChipModel, FromChips, ToChips } from "@/lib/contracts";
import { printNumber, printSelector, printTail } from "./print";

const NUMBER = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

/** True when a chip can be turned into query text ("Incomplete. Not applied." otherwise). */
export function isChipComplete(chip: Chip): boolean {
  if (chip.kind !== "simple") return chip.kind === "type" || chip.text.trim() !== "";
  if (!chip.metric || !NUMBER.test(chip.value.trim())) return false;
  return chip.op !== "between" || NUMBER.test(chip.value2.trim());
}

/** The query text of one chip, or "" when it is incomplete. */
export function chipText(chip: Chip): string {
  if (!isChipComplete(chip)) return "";
  switch (chip.kind) {
    case "simple": {
      const ref = `${chip.metric}${printSelector(chip.selector)}`;
      const v = printNumber(Number(chip.value.trim()));
      if (chip.op === "between") return `${ref} BETWEEN ${v} AND ${printNumber(Number(chip.value2.trim()))}`;
      return `${ref} ${chip.op} ${v}`;
    }
    case "type": return `IS ${chip.negated ? "NOT " : ""}${chip.test}`;
    case "advanced": return chip.text.trim();
  }
}

export const toChips: ToChips = (query) => {
  const chips: Chip[] = query.clauses.map((c): Chip => {
    const id = `c${c.index}`;
    const s = c.simple;
    if (s) {
      return {
        kind: "simple", id, metric: s.metric, selector: s.selector, op: s.op, value: printNumber(s.value),
        value2: s.value2 === null ? "" : printNumber(s.value2),
      };
    }
    if (c.ast.k === "is") return { kind: "type", id, test: c.ast.test, negated: c.ast.negated };
    if (c.ast.k === "not" && c.ast.arg.k === "is") return { kind: "type", id, test: c.ast.arg.test, negated: !c.ast.arg.negated };
    return { kind: "advanced", id, text: c.text, english: c.english };
  });
  return { chips, tail: query.ast ? printTail(query.ast) : "" };
};

/** One clause per line, then the SORT BY / LIMIT tail. Incomplete chips are left out. */
export const fromChips: FromChips = (model: ChipModel) => {
  const lines = model.chips.map(chipText).filter((t) => t !== "");
  if (model.tail.trim()) lines.push(model.tail.trim());
  return lines.join("\n");
};

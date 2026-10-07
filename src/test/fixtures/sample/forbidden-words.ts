// src/test/fixtures/sample/forbidden-words.ts — TEST-ONLY list of words that must never appear in
// content or UI copy (§F.6 rule 5). Matching uses word boundaries and ignores case.
export const FORBIDDEN_WORDS: readonly string[] = [
  "buy", "sell", "strong buy", "avoid", "fraud", "multibagger", "target price", "guaranteed", "sure shot",
  "will go bankrupt",
];

const PATTERNS = FORBIDDEN_WORDS.map((w) => ({ w, re: new RegExp(`\\b${w.replace(/ /g, "\\s+")}\\b`, "i") }));

/** Forbidden words found in a piece of text. */
export function forbiddenWordHits(text: string): string[] {
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.w);
}

import type { CompiledQuery } from "@/lib/contracts";

export interface PlainEnglishPreviewProps {
  compiled: CompiledQuery | null;
  draft: string;
}

/** The query in plain English. Always visible, so no rule is a black box. */
export function PlainEnglishPreview({ compiled, draft }: PlainEnglishPreviewProps) {
  let text: string;
  if (!compiled) text = "Loading data…";
  else if (!compiled.ok) text = "The query has an error, so it cannot be put into plain English yet. See the issues for details.";
  else if (draft.trim() === "") text = "No rules yet. Every company in the universe is shown. Add a rule or start from a template.";
  else text = compiled.english;
  return (
    <section aria-labelledby="preview-heading" className="rounded-lg border bg-muted/40 p-3">
      <h3 id="preview-heading" className="text-sm font-semibold">In plain English</h3>
      <p className="mt-1 text-sm" data-testid="plain-english">{text}</p>
    </section>
  );
}

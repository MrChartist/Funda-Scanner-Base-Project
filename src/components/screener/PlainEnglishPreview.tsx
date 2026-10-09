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
    <section aria-labelledby="preview-heading" className="rounded-lg border-l-2 border-primary/50 bg-muted/50 px-3 py-2">
      <h3 id="preview-heading" className="type-label">In plain English</h3>
      <p className="mt-0.5 text-sm" data-testid="plain-english">{text}</p>
    </section>
  );
}

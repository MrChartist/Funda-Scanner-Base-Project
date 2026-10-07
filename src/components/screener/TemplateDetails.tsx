import type { ScreenTemplate } from "@/lib/contracts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface TemplateDetailsProps {
  template: ScreenTemplate | null;
  onClose: () => void;
  onUse: (t: ScreenTemplate) => void;
}

function List({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </section>
  );
}

/** What a template does, rule by rule, what it misses, and who it does not suit. */
export function TemplateDetails({ template, onClose, onUse }: TemplateDetailsProps) {
  const lines = template ? template.query.split("\n") : [];
  const clauseLines = lines.filter((l) => l.trim() && !/^(SORT BY|LIMIT)\b/i.test(l.trim()));
  return (
    <Dialog open={template !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>{template.title}</DialogTitle>
              <DialogDescription>{template.level} · {template.idea}</DialogDescription>
            </DialogHeader>
            <section>
              <h4 className="text-sm font-semibold">The rules</h4>
              <ol className="mt-1 space-y-2 text-sm">
                {clauseLines.map((line, i) => (
                  <li key={line}>
                    <code className="font-mono text-xs">{line}</code>
                    {template.clauseNotes[i] && <p className="text-muted-foreground">{template.clauseNotes[i]}</p>}
                  </li>
                ))}
              </ol>
            </section>
            <List title="What it will not find" items={template.misses} />
            <List title="Not suited to" items={template.notFor} />
            <p className="text-sm"><span className="font-semibold">Try changing: </span>{template.tryChanging}</p>
            {template.inspiredBy && <p className="text-xs text-muted-foreground">Idea from: {template.inspiredBy}</p>}
            <p className="text-xs text-muted-foreground">Rule-based observations on the data you loaded. Not a recommendation.</p>
            <Button type="button" className="min-h-11" onClick={() => onUse(template)}>Use this screen</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

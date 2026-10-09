import { useState } from "react";
import type { ScreenTemplate } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateDetails } from "./TemplateDetails";
import type { TemplateCounts } from "./use-template-counts";

export interface TemplateGalleryProps {
  open: boolean;
  activeId: string | null;
  counts?: TemplateCounts;
  /** Called when a template is chosen; the page decides whether to replace or add. */
  onUse: (t: ScreenTemplate) => void;
  /** Opens the details sheet for this template (used by the rules summary line too). */
  detailsId?: string | null;
  onDetailsChange?: (id: string | null) => void;
}

/** The collapsible panel behind "More about templates": each card says what the screen looks for, in plain words. */
export function TemplateGallery({ open, activeId, counts = {}, onUse, detailsId, onDetailsChange }: TemplateGalleryProps) {
  const [local, setLocal] = useState<string | null>(null);
  const shownId = detailsId !== undefined ? detailsId : local;
  const setShown = onDetailsChange ?? setLocal;
  const details = TEMPLATES.find((t) => t.id === shownId) ?? null;
  return (
    <>
      {open && (
        <section id="template-gallery" aria-labelledby="templates-heading" className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div>
            <h2 id="templates-heading" className="type-section-title">About the templates</h2>
            <p className="type-caption mt-0.5">Each template is a set of rules you can edit afterwards. Counts are for the companies you are screening.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-lg border bg-background p-4 data-[active]:border-primary data-[active]:bg-primary/5" data-active={activeId === t.id || undefined}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold">{t.title}</h3>
                  <Badge variant="outline" className="shrink-0 text-xs">{t.level}</Badge>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{t.idea}</p>
                {counts[t.id] !== undefined && <p className="num text-xs text-muted-foreground">{counts[t.id]} companies match today</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" className="min-h-11" aria-label={`Use ${t.title}`} onClick={() => onUse(t)}>
                    {activeId === t.id ? "In use" : "Use this screen"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`Details of ${t.title}`} onClick={() => setShown(t.id)}>
                    Details
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <TemplateDetails
        template={details}
        onClose={() => setShown(null)}
        onUse={(t) => {
          setShown(null);
          onUse(t);
        }}
      />
    </>
  );
}

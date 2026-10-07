import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ScreenTemplate } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TemplateDetails } from "./TemplateDetails";

export interface TemplateGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string | null;
  /** Called when a template is chosen; the page decides whether to replace or add. */
  onUse: (t: ScreenTemplate) => void;
}

/** Guided starting points. Each card says what the screen looks for, in plain words. */
export function TemplateGallery({ open, onOpenChange, activeId, onUse }: TemplateGalleryProps) {
  const [details, setDetails] = useState<ScreenTemplate | null>(null);
  return (
    <section aria-labelledby="templates-heading" className="space-y-3">
      <h2 id="templates-heading" className="text-lg font-semibold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="template-grid"
          onClick={() => onOpenChange(!open)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        >
          <span>Start from a template</span>
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </h2>
      {open && (
        <ul id="template-grid" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4" data-active={activeId === t.id || undefined}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{t.title}</h3>
                <Badge variant="outline" className="shrink-0 text-xs">{t.level}</Badge>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{t.idea}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="min-h-11" aria-label={`Use ${t.title}`} onClick={() => onUse(t)}>
                  {activeId === t.id ? "In use" : "Use this screen"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`Details of ${t.title}`} onClick={() => setDetails(t)}>
                  Details
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <TemplateDetails
        template={details}
        onClose={() => setDetails(null)}
        onUse={(t) => {
          setDetails(null);
          onUse(t);
        }}
      />
    </section>
  );
}

import { ChevronDown, LayoutGrid } from "lucide-react";
import type { ScreenTemplate } from "@/lib/contracts";
import { TEMPLATES } from "@/lib/screen";
import { cn } from "@/lib/utils";
import type { TemplateCounts } from "./use-template-counts";

export interface TemplateBarProps {
  counts: TemplateCounts;
  activeId: string | null;
  onUse: (t: ScreenTemplate) => void;
  galleryOpen: boolean;
  onToggleGallery: () => void;
}

/** One row of template chips (name and live match count), then a switch for the full descriptions. */
export function TemplateBar({ counts, activeId, onUse, galleryOpen, onToggleGallery }: TemplateBarProps) {
  return (
    <nav aria-label="Templates" className="flex items-center gap-2 lg:gap-3">
      <p className="type-label hidden shrink-0 sm:block">Templates</p>
      <ul className="scrollbar-thin flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-1">
        {TEMPLATES.map((t) => {
          const n = counts[t.id];
          const active = activeId === t.id;
          return (
            <li key={t.id} className="shrink-0 snap-start">
              <button
                type="button"
                aria-pressed={active}
                aria-label={n === undefined ? t.title : `${t.title}, ${n} ${n === 1 ? "match" : "matches"}`}
                title={t.idea}
                onClick={() => onUse(t)}
                data-template={t.id}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border bg-card px-3.5 text-sm font-medium shadow-sm transition-colors motion-reduce:transition-none lg:min-h-9",
                  "hover:border-primary/50 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active && "border-primary bg-primary/10 text-primary",
                )}
              >
                <span>{t.title}</span>
                <span
                  aria-hidden="true"
                  className={cn("num min-w-[1.75rem] rounded-full bg-muted px-1.5 py-0.5 text-center text-xs font-semibold text-muted-foreground", active && "bg-primary/15 text-primary")}
                >
                  {n === undefined ? "…" : n}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        aria-expanded={galleryOpen}
        aria-controls="template-gallery"
        aria-label="More about templates"
        title="More about templates"
        onClick={onToggleGallery}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1 rounded-md text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto sm:px-2 lg:h-9"
      >
        <LayoutGrid className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">More about templates</span>
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform motion-reduce:transition-none sm:block", galleryOpen && "rotate-180")} aria-hidden="true" />
      </button>
    </nav>
  );
}

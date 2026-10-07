import { useEffect, useState } from "react";
import type { CompanySectionId } from "@/lib/contracts";
import { SECTION_LIST } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";

/** Jump links to every section. One sticky, horizontally scrolling bar for all screen sizes. */
export function CompanyPageNav() {
  const [active, setActive] = useState<CompanySectionId>("summary");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id as CompanySectionId);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0.05 },
    );
    for (const s of SECTION_LIST) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const go = (id: CompanySectionId) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <nav aria-label="Sections of this page" className="sticky top-10 z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur md:top-11" data-no-print>
      <ul className="flex gap-1 overflow-x-auto py-1">
        {SECTION_LIST.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              onClick={go(s.id)}
              aria-current={active === s.id ? "location" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active === s.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

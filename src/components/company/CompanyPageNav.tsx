import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CompanySectionId } from "@/lib/contracts";
import { SECTION_LIST } from "@/lib/views/company-view";
import { cn } from "@/lib/utils";

export interface CompanyPageNavProps {
  /** Id of the header card. Once it has scrolled out of view the `mini` row appears above the section links. */
  headerId?: string;
  /** Compact name, reference price and Follow control. */
  mini?: ReactNode;
}

const prefersReducedMotion = (): boolean => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const GUTTER = "px-4 sm:px-6 lg:px-8";

/** Sticky bar: a mini header (after the header card scrolls away) and jump links that follow the section being read. */
export function CompanyPageNav({ headerId = "company-header", mini }: CompanyPageNavProps) {
  const [active, setActive] = useState<CompanySectionId>("summary");
  const [showMini, setShowMini] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  // Active section: the topmost section crossing a band just under the sticky bars.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const inView = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inView.add(e.target.id);
          else inView.delete(e.target.id);
        }
        const first = SECTION_LIST.find((s) => inView.has(s.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-150px 0px -60% 0px", threshold: 0 },
    );
    for (const s of SECTION_LIST) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Mini header: shown once the header card is above the viewport.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const el = document.getElementById(headerId);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMini(!entry.isIntersecting && entry.boundingClientRect.bottom < 100),
      { threshold: 0, rootMargin: "-48px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [headerId]);

  // Keep the active link visible in the horizontally scrolling bar (no page scroll involved).
  useEffect(() => {
    const ul = list.current;
    const a = ul?.querySelector<HTMLElement>('a[aria-current="location"]');
    if (!ul || !a || typeof ul.scrollTo !== "function") return;
    const left = a.offsetLeft - (ul.clientWidth - a.offsetWidth) / 2;
    ul.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const go = (id: CompanySectionId) => (e: React.MouseEvent) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    window.history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  return (
    <div className="sticky top-[49px] z-30 -mx-4 border-b bg-background/95 backdrop-blur sm:-mx-6 md:top-[57px] lg:-mx-8" data-no-print>
      {showMini && mini && (
        <div className={cn("flex min-h-12 items-center justify-between gap-3 border-b py-1", GUTTER)} data-testid="mini-header">
          {mini}
        </div>
      )}
      <nav aria-label="Sections of this page" className={GUTTER}>
        <ul ref={list} className="flex gap-1 overflow-x-auto py-1">
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
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { List, ChevronRight, Menu } from "lucide-react";

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: "header", label: "Overview" },
  { id: "ratios-grid", label: "Key Ratios" },
  { id: "pros-cons", label: "Pros & Cons" },
  { id: "price-chart", label: "Price Chart" },
  { id: "analyst-ratings", label: "Analyst Ratings" },
  { id: "quarterly", label: "Quarterly Results" },
  { id: "financials", label: "Financial Statements" },
  { id: "ratio-trends", label: "Ratio Trends" },
  { id: "shareholding", label: "Shareholding" },
  { id: "segments", label: "Revenue Segments" },
  { id: "insider-deals", label: "Insider Activity" },
  { id: "management", label: "Management" },
  { id: "documents", label: "Documents" },
  { id: "corporate-actions", label: "Corporate Actions" },
  { id: "peers", label: "Peer Comparison" },
];

export function CompanyPageNav() {
  const [activeSection, setActiveSection] = useState("header");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.1 }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Desktop: sticky sidebar TOC */}
      <aside className="hidden xl:block fixed left-[max(0px,calc(50%-650px))] top-24 w-44 z-30">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
          className="glass-card p-3 space-y-0.5 max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          <div className="flex items-center gap-1.5 px-2 pb-2 border-b border-border/30 mb-1">
            <List className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sections</span>
          </div>
          {SECTIONS.map((s) => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => scrollTo(s.id)}
                className={`flex items-center gap-1.5 w-full text-left px-2 py-1.5 rounded-md text-[11px] transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}>
                {isActive && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                <span className={isActive ? "" : "ml-[18px]"}>{s.label}</span>
              </button>
            );
          })}
        </motion.div>
      </aside>

      {/* Mobile: floating TOC button */}
      <div className="xl:hidden fixed bottom-20 right-4 z-50 md:bottom-4">
        <button onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
          <Menu className="h-5 w-5" />
        </button>

        <AnimatePresence>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-12 right-0 z-50 w-48 glass-card-elevated p-2 space-y-0.5 max-h-[60vh] overflow-y-auto scrollbar-thin"
              >
                {SECTIONS.map((s) => {
                  const isActive = activeSection === s.id;
                  return (
                    <button key={s.id} onClick={() => scrollTo(s.id)}
                      className={`flex items-center w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                        isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-accent/50"
                      }`}>
                      {s.label}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export { SECTIONS };

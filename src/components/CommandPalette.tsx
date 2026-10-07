import { useCallback, useEffect, useId, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, Briefcase, BarChart3, Calculator, Eye, GitCompare, LayoutDashboard, ListFilter, Moon, Search, Sun,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CompanyName } from "@/components/common/CompanyName";
import { buildSearchItems } from "@/components/common/search";
import { PALETTE_EVENT, type PaletteRequest } from "@/hooks/use-keyboard-nav";
import { useStore } from "@/hooks/use-dataset";
import { useTheme } from "@/hooks/use-theme";

interface Entry {
  key: string;
  label: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  run: () => void;
  /** Rendered as a company name with the "(fictional)" label. */
  companyName?: string;
}

/** Opens from Cmd/Ctrl+K and "/" (handled in use-keyboard-nav) or the Header button, never by its own key handling. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const store = useStore();
  const listId = useId();

  useEffect(() => {
    const onRequest = (e: Event) => {
      const mode: PaletteRequest = (e as CustomEvent<PaletteRequest>).detail ?? "open";
      setQuery("");
      setActive(0);
      setOpen((o) => (mode === "toggle" ? !o : true));
    };
    window.addEventListener(PALETTE_EVENT, onRequest);
    return () => window.removeEventListener(PALETTE_EVENT, onRequest);
  }, []);

  const go = useCallback((to: string) => () => navigate(to), [navigate]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    const pages: Entry[] = [
      { key: "go:dashboard", label: "Go to Dashboard", icon: LayoutDashboard, run: go("/") },
      { key: "go:screener", label: "Go to Screener", icon: BarChart3, run: go("/screener") },
      { key: "go:compare", label: "Go to Compare", icon: GitCompare, run: go("/compare") },
      { key: "go:watchlist", label: "Go to Watchlist", icon: Eye, run: go("/watchlist") },
      { key: "go:portfolio", label: "Go to Portfolio", icon: Briefcase, run: go("/portfolio") },
      { key: "go:dcf", label: "Go to DCF calculator", icon: Calculator, run: go("/dcf") },
      { key: "go:learn", label: "Go to Learn", icon: BookOpen, run: go("/learn") },
      { key: "theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", icon: theme === "dark" ? Sun : Moon, run: toggleTheme },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));

    const found: Entry[] = [];
    if (store && q) {
      const synthetic = store.meta.isSynthetic;
      for (const item of buildSearchItems(store, q, { companies: 8, metrics: 4, templates: 3 })) {
        found.push({
          key: item.key,
          label: item.kind === "company" ? `${item.detail} · ${item.label}` : item.label,
          hint: item.kind === "company" ? item.note : item.note,
          icon: item.kind === "company" ? ArrowRight : item.kind === "metric" ? BookOpen : ListFilter,
          run: go(item.href),
          companyName: item.kind === "company" ? (synthetic ? item.label : undefined) : undefined,
        });
      }
    }
    return [...found, ...pages];
  }, [query, store, theme, toggleTheme, go]);

  useEffect(() => setActive(0), [query]);

  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    setOpen(false);
    entry.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, entries.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(entries[active]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[15%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search companies, metrics and guided screens in the loaded data, or go to a page.
        </DialogDescription>
        <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-label="Search companies, metrics, guided screens and pages"
            aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search companies, metrics, screens or pages"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-72 overflow-y-auto p-1.5">
          {entries.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nothing matches in the loaded data.</li>}
          {entries.map((entry, i) => (
            <li
              key={entry.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={() => choose(entry)}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                i === active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/50"
              }`}
            >
              <entry.icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {entry.companyName ? (
                  <>
                    {entry.label.split(" · ")[0]} · <CompanyName name={entry.companyName} isSynthetic />
                  </>
                ) : (
                  entry.label
                )}
              </span>
              {entry.hint && <span className="shrink-0 text-xs text-muted-foreground">{entry.hint}</span>}
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
          <span><kbd className="kbd">↑↓</kbd> Move</span>
          <span><kbd className="kbd">↵</kbd> Open</span>
          <span><kbd className="kbd">Ctrl K</kbd> Toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

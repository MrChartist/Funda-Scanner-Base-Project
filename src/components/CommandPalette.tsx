import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, Moon, Sun, BarChart3, GitCompare, Eye, LayoutDashboard, Command } from "lucide-react";
import { MOCK_COMPANIES } from "@/lib/mock-data";
import { useTheme } from "@/hooks/use-theme";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const actions = [
    { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, action: () => navigate("/") },
    { id: "screener", label: "Go to Screener", icon: BarChart3, action: () => navigate("/screener") },
    { id: "compare", label: "Go to Compare", icon: GitCompare, action: () => navigate("/compare") },
    { id: "watchlist", label: "Go to Watchlist", icon: Eye, action: () => navigate("/watchlist") },
    { id: "theme", label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`, icon: theme === "dark" ? Sun : Moon, action: toggleTheme },
  ];

  const companies = query.length > 0
    ? MOCK_COMPANIES.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) || c.symbol.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const allItems = [
    ...companies.map((c) => ({ id: c.symbol, label: `${c.symbol} — ${c.name}`, icon: ArrowRight, action: () => navigate(`/company/${c.symbol}`) })),
    ...actions.filter((a) => !query || a.label.toLowerCase().includes(query.toLowerCase())),
  ];

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen((o) => !o); setQuery(""); }
    if (e.key === "/" && !open && !(e.target as HTMLElement)?.closest("input,textarea")) { e.preventDefault(); setOpen(true); setQuery(""); }
    if (e.key === "Escape") setOpen(false);
  }, [open]);

  useEffect(() => { window.addEventListener("keydown", handleKeyDown); return () => window.removeEventListener("keydown", handleKeyDown); }, [handleKeyDown]);

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allItems[selectedIndex]) { allItems[selectedIndex].action(); setOpen(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg">
            <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleItemKeyDown}
                  placeholder="Search companies, navigate, or run actions..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                <kbd className="text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5 font-mono">ESC</kbd>
              </div>
              <div className="max-h-72 overflow-y-auto p-1.5">
                {allItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
                )}
                {allItems.map((item, i) => (
                  <button key={item.id} onClick={() => { item.action(); setOpen(false); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      i === selectedIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent/50"
                    }`}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border/50 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><kbd className="bg-muted/50 rounded px-1 py-0.5 font-mono">↑↓</kbd> Navigate</span>
                <span className="flex items-center gap-1"><kbd className="bg-muted/50 rounded px-1 py-0.5 font-mono">↵</kbd> Select</span>
                <span className="flex items-center gap-1"><kbd className="bg-muted/50 rounded px-1 py-0.5 font-mono">⌘K</kbd> Toggle</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

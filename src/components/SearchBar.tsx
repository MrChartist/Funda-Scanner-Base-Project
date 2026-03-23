import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { searchCompanies } from "@/lib/mock-data";
import { motion, AnimatePresence } from "framer-motion";

export function SearchBar({ variant = "header" }: { variant?: "header" | "hero" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReturnType<typeof searchCompanies>>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length >= 1) {
      setResults(searchCompanies(query));
      setIsOpen(true);
      setSelectedIndex(0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  const handleSelect = (symbol: string) => {
    setQuery("");
    setIsOpen(false);
    navigate(`/company/${symbol}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex].symbol);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const isHero = variant === "hero";

  return (
    <div className="relative">
      <div className={`relative flex items-center ${isHero ? "w-full max-w-2xl" : "w-64 lg:w-80"}`}>
        <Search className={`absolute left-3 ${isHero ? "h-5 w-5" : "h-4 w-4"} text-muted-foreground`} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search company or symbol..."
          className={`w-full rounded-lg border border-input bg-card ${isHero ? "py-4 pl-12 pr-10 text-lg" : "py-2 pl-9 pr-8 text-sm"} text-foreground placeholder:text-muted-foreground outline-none ring-offset-background focus:ring-2 focus:ring-primary/30 transition-all`}
        />
        {query && (
          <button onClick={() => setQuery("")} className={`absolute right-3 text-muted-foreground hover:text-foreground`}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 mt-1 ${isHero ? "w-full" : "w-full min-w-[360px]"} rounded-lg border border-border bg-card shadow-lg overflow-hidden`}
          >
            {results.map((c, i) => (
              <button
                key={c.symbol}
                onMouseDown={() => handleSelect(c.symbol)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                  i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                }`}
              >
                <div>
                  <span className="font-mono text-sm font-semibold text-foreground">{c.symbol}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.sector}</span>
                  <span className={`text-xs font-mono ${c.change_pct >= 0 ? "text-positive" : "text-negative"}`}>
                    {c.change_pct >= 0 ? "+" : ""}{c.change_pct.toFixed(2)}%
                  </span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

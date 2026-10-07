import { useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { CompanyName } from "@/components/common/CompanyName";
import { buildSearchItems } from "@/components/common/search";
import { useStore } from "@/hooks/use-dataset";

export function SearchBar({ variant = "header" }: { variant?: "header" | "hero" }) {
  const store = useStore();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const listId = useId();

  const items = useMemo(() => (store && query.trim() ? buildSearchItems(store, query) : []), [store, query]);
  const showList = open && query.trim().length > 0;

  const choose = (href: string) => {
    setQuery("");
    setOpen(false);
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      choose(items[active].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const isHero = variant === "hero";
  const synthetic = store?.meta.isSynthetic ?? false;

  return (
    <div className="relative">
      <div className={`relative flex items-center ${isHero ? "w-full max-w-2xl" : "w-40 sm:w-60 md:w-44 lg:w-52 xl:w-64"}`}>
        <Search className={`absolute left-3 ${isHero ? "h-5 w-5" : "h-4 w-4"} text-muted-foreground`} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
          aria-label="Search companies, metrics and guided screens"
          data-global-search=""
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search company, symbol or metric"
          className={`w-full rounded-lg border border-input bg-card ${isHero ? "py-4 pl-12 pr-10 text-lg" : "py-2 pl-9 pr-8 text-sm"} text-foreground outline-none ring-offset-background transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden`}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-1 flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className={`absolute right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-border bg-card shadow-lg ${isHero ? "w-full" : "w-[min(92vw,26rem)]"}`}
        >
          {items.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No match in the loaded data.</li>}
          {items.map((item, i) => (
            <li
              key={item.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(item.href);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left ${i === active ? "bg-accent" : ""}`}
            >
              <span className="min-w-0">
                {item.kind === "company" ? (
                  <>
                    <span className="font-mono text-sm font-semibold text-foreground">{item.detail}</span>
                    <span className="ml-2 text-sm text-muted-foreground">
                      <CompanyName name={item.label} isSynthetic={synthetic} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{item.detail}</span>
                  </>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{item.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

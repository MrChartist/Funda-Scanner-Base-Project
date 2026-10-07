import { Link, useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, Briefcase, Calculator, Command, Eye, GitCompare, LayoutDashboard, Menu, Moon, Sun, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { openCommandPalette } from "@/hooks/use-keyboard-nav";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBar } from "./SearchBar";
import { AccentColorPicker } from "./AccentColorPicker";
import { DensityPicker } from "./DensityPicker";
import { DataSourceBadge } from "./DataSourceBadge";
import { motion } from "framer-motion";
import { useState } from "react";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Every page, shown in the desktop bar. */
const DESKTOP_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/screener", label: "Screener", icon: BarChart3 },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/dcf", label: "DCF", icon: Calculator },
  { to: "/learn", label: "Learn", icon: BookOpen },
];

/** The four pages kept on the mobile bar; the fifth item opens the rest. */
const MOBILE_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: LayoutDashboard },
  { to: "/screener", label: "Screener", icon: BarChart3 },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/watchlist", label: "Watchlist", icon: Eye },
];

const MORE_ITEMS: NavItem[] = [
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/dcf", label: "DCF calculator", icon: Calculator },
  { to: "/learn", label: "Learn", icon: BookOpen },
];

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = MORE_ITEMS.some((i) => location.pathname === i.to);

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-card md:block">
        <div className="container flex h-12 items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Link to="/" className="group flex items-center gap-1.5" aria-label="Funda Scanner, Dashboard">
              <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
                <TrendingUp className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
              </div>
              <span className="text-xs font-bold tracking-tight text-foreground">
                FUNDA<span className="text-primary">SCANNER</span>
              </span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <nav aria-label="Main" className="flex items-center gap-0.5">
              {DESKTOP_ITEMS.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-all duration-150 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <span className="hidden 2xl:inline-flex"><DataSourceBadge /></span>
            <SearchBar variant="header" />
            <button
              type="button"
              onClick={() => openCommandPalette("toggle")}
              aria-label="Open the command palette"
              className="flex items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              <Command className="h-3 w-3" aria-hidden="true" />
              <span className="font-mono">K</span>
            </button>
            <div className="hidden xl:block"><DensityPicker /></div>
            <AccentColorPicker />
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded p-1.5 text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground"
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <motion.div key={theme} initial={{ rotate: -15, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </motion.div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card md:hidden">
        <div className="flex h-12 items-center justify-between gap-2 px-3">
          <Link to="/" className="flex items-center gap-1.5" aria-label="Funda Scanner, Dashboard">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
              <TrendingUp className="h-2.5 w-2.5 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">
              FUNDA<span className="text-primary">SCANNER</span>
            </span>
          </Link>
          <SearchBar variant="header" />
        </div>
      </header>

      {/* Mobile bottom bar: four pages and a menu with the rest */}
      <nav aria-label="Main" className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium transition-colors ${
              moreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>More pages</SheetTitle>
            <SheetDescription>Other pages and the theme.</SheetDescription>
          </SheetHeader>
          <ul className="mt-3 space-y-1">
            {MORE_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-foreground hover:bg-accent"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setMoreOpen(false);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-foreground hover:bg-accent"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              </button>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

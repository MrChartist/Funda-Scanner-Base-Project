import { Link, useLocation } from "react-router-dom";
import {
  BarChart3, BookOpen, Briefcase, Calculator, Command, Eye, GitCompare, LayoutDashboard, Menu, Moon, SlidersHorizontal, Sun, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { openCommandPalette } from "@/hooks/use-keyboard-nav";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchBar } from "./SearchBar";
import { AccentColorPicker, useAccentColor } from "./AccentColorPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2 rounded-md" aria-label="Funda Scanner, Dashboard">
      <span className="brand-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ring-1 ring-inset ring-white/20 transition-transform group-hover:scale-105">
        <TrendingUp className="h-4 w-4 text-primary-foreground" aria-hidden="true" />
      </span>
      <span className={cn("text-[15px] font-bold tracking-tight text-foreground", compact && "text-sm")}>
        Funda<span className="text-primary">Scanner</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const accent = useAccentColor();
  const moreActive = MORE_ITEMS.some((i) => location.pathname === i.to);

  const iconButton =
    "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95";

  return (
    <>
      {/* Desktop header */}
      <header className="sticky top-0 z-40 hidden border-b border-border/80 bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 md:block">
        <div className="app-container flex h-14 items-center justify-between gap-4">
          <div className="flex shrink-0 items-center gap-3 xl:gap-5">
            <Logo />
            <nav aria-label="Main" className="flex items-center gap-0.5">
              {DESKTOP_ITEMS.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "flex h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/[0.12] text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.2)]"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden xl:inline">{item.label}</span>
                    <span className="sr-only xl:hidden">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden 2xl:inline-flex"><DataSourceBadge /></span>
            <SearchBar variant="header" className="w-44 xl:w-60" />
            <button
              type="button"
              onClick={() => openCommandPalette("toggle")}
              aria-label="Open the command palette"
              title="Command palette (Ctrl+K)"
              className="hidden h-9 items-center gap-0.5 rounded-lg border border-border bg-background/60 px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground 2xl:flex"
            >
              <Command className="h-3 w-3" aria-hidden="true" />
              <span className="font-mono">K</span>
            </button>
            <div className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className={iconButton} aria-label="Appearance" title="Appearance: density and accent colour">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-4 rounded-xl p-4 shadow-lg">
                <DensityPicker />
                <div className="h-px bg-border" />
                <AccentColorPicker accent={accent} />
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={toggleTheme}
              className={iconButton}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              <motion.div key={theme} initial={{ rotate: -15, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 md:hidden">
        <div className="flex h-12 items-center gap-3 px-4">
          <Logo compact />
          <SearchBar variant="header" className="min-w-0 flex-1" />
        </div>
      </header>

      {/* Mobile bottom bar: four pages and a menu with the rest */}
      <nav aria-label="Main" className="safe-area-bottom fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-card/90 backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {isActive && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden="true" />}
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-0.5 py-1 text-xs font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            {moreActive && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden="true" />}
            <Menu className="h-5 w-5" aria-hidden="true" />
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

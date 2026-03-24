import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, BarChart3, TrendingUp, LayoutDashboard, GitCompare, Eye, Command, Calculator, Briefcase } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { SearchBar } from "./SearchBar";
import { AccentColorPicker } from "./AccentColorPicker";
import { DensityPicker } from "./DensityPicker";
import { LiveMarketIndicator } from "@/hooks/use-live-prices";
import { motion } from "framer-motion";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/screener", label: "Screener", icon: BarChart3 },
    { to: "/compare", label: "Compare", icon: GitCompare },
    { to: "/watchlist", label: "Watchlist", icon: Eye },
    { to: "/dcf", label: "DCF", icon: Calculator },
  ];

  return (
    <>
      {/* Desktop header — Bloomberg-style dense bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card hidden md:block">
        <div className="container flex h-11 items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <Link to="/" className="flex items-center gap-1.5 group">
              <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
                <TrendingUp className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="text-xs font-bold tracking-tight text-foreground">
                FUNDA<span className="text-primary">SCANNER</span>
              </span>
            </Link>

            <div className="h-4 w-px bg-border" />

            <nav className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}
                    className={`flex items-center gap-1 px-2 py-1 text-[11px] font-medium transition-all duration-150 rounded ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}>
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <LiveMarketIndicator />
            <SearchBar variant="header" />
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center gap-0.5 rounded border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground hover:bg-accent transition-colors"
              style={{ fontSize: '9px' }}>
              <Command className="h-2.5 w-2.5" />
              <span className="font-mono">K</span>
            </button>
            <DensityPicker />
            <AccentColorPicker />
            <button onClick={toggleTheme}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-150"
              aria-label="Toggle theme">
              <motion.div key={theme} initial={{ rotate: -15, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.2 }}>
                {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </motion.div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card md:hidden safe-area-bottom">
        <div className="flex items-center justify-around py-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                <item.icon className="h-4 w-4" />
                <span style={{ fontSize: '9px' }} className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={toggleTheme} className="flex flex-col items-center gap-0.5 px-2 py-1 text-muted-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span style={{ fontSize: '9px' }} className="font-medium">Theme</span>
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card md:hidden">
        <div className="flex h-10 items-center justify-between px-3">
          <Link to="/" className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded bg-primary flex items-center justify-center">
              <TrendingUp className="h-2.5 w-2.5 text-primary-foreground" />
            </div>
            <span className="text-xs font-bold text-foreground">
              FUNDA<span className="text-primary">SCANNER</span>
            </span>
          </Link>
          <SearchBar variant="header" />
        </div>
      </header>
    </>
  );
}

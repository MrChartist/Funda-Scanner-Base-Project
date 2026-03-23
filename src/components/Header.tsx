import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, BarChart3, TrendingUp, LayoutDashboard, GitCompare, Eye, Command, Calculator, Keyboard } from "lucide-react";
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
      {/* Desktop header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl hidden md:block">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="relative h-7 w-7 rounded-xl bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                <TrendingUp className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="text-base font-semibold tracking-tight text-foreground">
                Funda<span className="text-primary">Scanner</span>
              </span>
            </Link>

            <nav className="flex items-center gap-0.5">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to}
                    className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}>
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            <LiveMarketIndicator />
            <SearchBar variant="header" />
            <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
              className="flex items-center gap-1 rounded-full border border-border/50 bg-secondary/50 px-2 py-1 text-[10px] text-muted-foreground hover:bg-secondary transition-colors">
              <Command className="h-2.5 w-2.5" />
              <span className="font-mono">K</span>
            </button>
            <DensityPicker />
            <AccentColorPicker />
            <button onClick={toggleTheme}
              className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200"
              aria-label="Toggle theme">
              <motion.div key={theme} initial={{ rotate: -20, opacity: 0, scale: 0.8 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </motion.div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/90 backdrop-blur-xl md:hidden safe-area-bottom">
        <div className="flex items-center justify-around py-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button onClick={toggleTheme} className="flex flex-col items-center gap-0.5 px-3 py-1 text-muted-foreground">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="text-[9px] font-medium">Theme</span>
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/90 backdrop-blur-xl md:hidden">
        <div className="flex h-12 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="h-3 w-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Funda<span className="text-primary">Scanner</span>
            </span>
          </Link>
          <SearchBar variant="header" />
        </div>
      </header>
    </>
  );
}

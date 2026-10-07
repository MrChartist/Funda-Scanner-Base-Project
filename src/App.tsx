import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { DensityProvider } from "@/hooks/use-density";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CommandPalette } from "@/components/CommandPalette";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { lazy, Suspense } from "react";
import { OnboardingTour } from "./components/OnboardingTour";
import { DatasetBanner } from "@/components/data/DatasetBanner";
import { LearnModeProvider } from "@/hooks/use-learn-mode";
import { useKeyboardNav, KeyboardShortcutsHelp } from "@/hooks/use-keyboard-nav";
const Learn = lazy(() => import("./pages/Learn"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Screener = lazy(() => import("./pages/Screener"));
const Compare = lazy(() => import("./pages/Compare"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const DCFCalculator = lazy(() => import("./pages/DCFCalculator"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex items-center justify-center py-24 text-sm text-muted-foreground" role="status" aria-live="polite">
    Loading…
  </div>
);

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/company/:symbol" element={<CompanyDetail />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/dcf" element={<DCFCalculator />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppShell() {
  useDocumentTitle();
  const { showHelp, setShowHelp } = useKeyboardNav();

  return (
    <div className="min-h-screen bg-background pb-14 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:shadow">
        Skip to the content
      </a>
      <Header />
      <DatasetBanner />
      <CommandPalette />
      <OnboardingTour />
      <KeyboardShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Suspense fallback={<RouteFallback />}>
          <AnimatedRoutes />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <DensityProvider>
        <MotionConfig reducedMotion="user">
          <LearnModeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppShell />
              </BrowserRouter>
            </TooltipProvider>
          </LearnModeProvider>
        </MotionConfig>
      </DensityProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

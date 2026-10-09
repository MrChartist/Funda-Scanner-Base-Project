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
import { MotionConfig } from "framer-motion";
import { lazy, Suspense } from "react";
import { OnboardingTour } from "./components/OnboardingTour";
import { LoadingState } from "@/components/layout";
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

const RouteFallback = () => <LoadingState className="py-24" />;

const queryClient = new QueryClient();

/** Each page animates itself in (PageShell, CSS only), so there is no exit animation to wait for. */
function AppRoutes() {
  const location = useLocation();
  return (
    <>
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
    </>
  );
}

function AppShell() {
  useDocumentTitle();
  const { showHelp, setShowHelp } = useKeyboardNav();

  return (
    <div className="min-h-screen bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:ring-2 focus:ring-primary">
        Skip to the content
      </a>
      <Header />
      <DatasetBanner />
      <CommandPalette />
      <OnboardingTour />
      <KeyboardShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />
      <main id="main" tabIndex={-1} className="outline-none">
        <Suspense fallback={<RouteFallback />}>
          <AppRoutes />
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

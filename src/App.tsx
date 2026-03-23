import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { Header } from "@/components/Header";
import { CommandPalette } from "@/components/CommandPalette";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { AnimatePresence } from "framer-motion";
import { OnboardingTour } from "./components/OnboardingTour";
import { useMarketNotifications } from "./components/NotificationSystem";
import Dashboard from "./pages/Dashboard";
import CompanyDetail from "./pages/CompanyDetail";
import Screener from "./pages/Screener";
import Compare from "./pages/Compare";
import Watchlist from "./pages/Watchlist";
import DCFCalculator from "./pages/DCFCalculator";
import NotFound from "./pages/NotFound";

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

function AppShell() {
  useMarketNotifications();
  useDocumentTitle();
  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Header />
      <CommandPalette />
      <OnboardingTour />
      <AnimatedRoutes />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

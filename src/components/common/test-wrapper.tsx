// Test-only helper: the providers a page needs (query client, theme, router, tooltips, motion).
import type { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { render } from "@testing-library/react";
import { ThemeProvider } from "@/hooks/use-theme";
import { DensityProvider } from "@/hooks/use-density";
import { TooltipProvider } from "@/components/ui/tooltip";

export function renderWithApp(ui: ReactElement, route = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <DensityProvider>
          <MotionConfig reducedMotion="always">
            <TooltipProvider>
              <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
            </TooltipProvider>
          </MotionConfig>
        </DensityProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

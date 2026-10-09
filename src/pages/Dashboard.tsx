import { AnimatePresence } from "framer-motion";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/layout";
import { DatasetGate } from "@/components/common/DatasetGate";
import { DashboardLayoutEditor, useDashboardLayout } from "@/components/DashboardLayout";
import { DatasetCard } from "@/components/dashboard/DatasetCard";
import { GuidedScreens } from "@/components/dashboard/GuidedScreens";
import { LearnOneMetric } from "@/components/dashboard/LearnOneMetric";
import { RecentlyViewed } from "@/components/dashboard/RecentlyViewed";
import { SectorMedians } from "@/components/dashboard/SectorMedians";

export default function Dashboard() {
  const layout = useDashboardLayout();

  return (
      <PageShell>
        <PageHeader
          title="Dashboard"
          description="Start with a guided screen, look at sector medians, or learn what a metric means."
          actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 text-xs sm:min-h-9"
            aria-expanded={layout.isEditing}
            onClick={() => layout.setIsEditing(!layout.isEditing)}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Customise
          </Button>
          }
        />

        <AnimatePresence>
          {layout.isEditing && (
            <DashboardLayoutEditor
              widgets={layout.widgets}
              setWidgets={layout.setWidgets}
              toggleVisibility={layout.toggleVisibility}
              resetLayout={layout.resetLayout}
              onClose={() => layout.setIsEditing(false)}
            />
          )}
        </AnimatePresence>

        <DatasetGate>
          {({ store, dataset }) => (
            <div className="space-y-4">
              {layout.orderedIds.map((id) => {
                switch (id) {
                  case "dataset":
                    return <DatasetCard key={id} store={store} dataset={dataset} />;
                  case "guided":
                    return <GuidedScreens key={id} store={store} />;
                  case "sectors":
                    return <SectorMedians key={id} store={store} />;
                  case "learn":
                    return <LearnOneMetric key={id} store={store} />;
                  case "recent":
                    return <RecentlyViewed key={id} store={store} />;
                  default:
                    return null;
                }
              })}
              {layout.orderedIds.length === 0 && (
                <p className="text-sm text-muted-foreground">Every section is hidden. Use Customise to show them again.</p>
              )}
            </div>
          )}
        </DatasetGate>
      </PageShell>
  );
}

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
import { UniverseScatter } from "@/components/dashboard/charts/UniverseScatter";
import { RoceHistogram } from "@/components/dashboard/charts/RoceHistogram";
import { SectorMedians } from "@/components/dashboard/SectorMedians";

export default function Dashboard() {
  const layout = useDashboardLayout();

  return (
      <PageShell>
        <PageHeader
          title="Dashboard"
          description="See where companies sit on returns and valuation, compare sectors, or start from a guided screen."
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {layout.orderedIds.map((id) => {
                switch (id) {
                  case "dataset":
                    return <div key={id} className="min-w-0 lg:col-span-2"><DatasetCard store={store} dataset={dataset} /></div>;
                  case "guided":
                    return <div key={id} className="min-w-0 lg:col-span-2"><GuidedScreens store={store} /></div>;
                  case "universe":
                    return <UniverseScatter key={id} store={store} />;
                  case "sectors":
                    return <div key={id} className="min-w-0"><SectorMedians store={store} /></div>;
                  case "spread":
                    return <div key={id} className="min-w-0"><RoceHistogram store={store} /></div>;
                  case "learn":
                    return <div key={id} className="min-w-0"><LearnOneMetric store={store} /></div>;
                  case "recent":
                    return <div key={id} className="min-w-0"><RecentlyViewed store={store} /></div>;
                  default:
                    return null;
                }
              })}
              {layout.orderedIds.length === 0 && (
                <p className="text-sm text-muted-foreground lg:col-span-2">Every section is hidden. Use Customise to show them again.</p>
              )}
            </div>
          )}
        </DatasetGate>
      </PageShell>
  );
}

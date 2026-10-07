import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { motion, Reorder } from "framer-motion";
import { Eye, EyeOff, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_WIDGETS, defaultLayout, layoutStore, type DashboardLayoutItem } from "@/lib/user/dashboard-layout";

export interface DashboardWidget extends DashboardLayoutItem {
  label: string;
}

const LABELS = new Map(DASHBOARD_WIDGETS.map((w) => [w.id, w.label]));

function withLabels(items: DashboardLayoutItem[]): DashboardWidget[] {
  return items.map((i) => ({ ...i, label: LABELS.get(i.id) ?? i.id }));
}

/** Widget order and visibility, stored in this browser. Stale widget ids are dropped when it is read. */
export function useDashboardLayout() {
  const raw = useSyncExternalStore(layoutStore.subscribe, layoutStore.snapshot, layoutStore.snapshot);
  const widgets = useMemo(() => withLabels(layoutStore.parse(raw)), [raw]);
  const [isEditing, setIsEditing] = useState(false);

  const setWidgets = useCallback((next: DashboardWidget[]) => {
    layoutStore.save(next.map(({ id, visible }) => ({ id, visible })));
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    layoutStore.save(layoutStore.load().map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }, []);

  const resetLayout = useCallback(() => {
    layoutStore.save(defaultLayout());
  }, []);

  const isVisible = useCallback((id: string) => widgets.find((w) => w.id === id)?.visible ?? true, [widgets]);
  const orderedIds = widgets.filter((w) => w.visible).map((w) => w.id);

  return { widgets, setWidgets, isEditing, setIsEditing, toggleVisibility, resetLayout, isVisible, orderedIds };
}

export function DashboardLayoutEditor({
  widgets,
  setWidgets,
  toggleVisibility,
  resetLayout,
  onClose,
}: {
  widgets: DashboardWidget[];
  setWidgets: (w: DashboardWidget[]) => void;
  toggleVisibility: (id: string) => void;
  resetLayout: () => void;
  onClose: () => void;
}) {
  return (
    <motion.section
      aria-label="Customise the Dashboard"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-card-elevated space-y-3 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Customise the Dashboard</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetLayout} className="min-h-11 gap-1 text-xs sm:min-h-9">
            <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
          </Button>
          <Button size="sm" onClick={onClose} className="min-h-11 text-xs sm:min-h-9">Done</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drag to reorder. Use the eye to show or hide a section.</p>
      <Reorder.Group axis="y" values={widgets} onReorder={setWidgets} className="space-y-1">
        {widgets.map((widget) => (
          <Reorder.Item
            key={widget.id}
            value={widget}
            className="flex cursor-grab items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={`flex-1 text-sm ${widget.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>{widget.label}</span>
            <button
              type="button"
              onClick={() => toggleVisibility(widget.id)}
              aria-label={`${widget.visible ? "Hide" : "Show"} ${widget.label}`}
              aria-pressed={widget.visible}
              className="flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </motion.section>
  );
}

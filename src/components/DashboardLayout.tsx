import { useState, useCallback, useEffect } from "react";
import { motion, Reorder } from "framer-motion";
import { GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardWidget {
  id: string;
  label: string;
  visible: boolean;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "hero", label: "Search & Overview", visible: true },
  { id: "recent", label: "Recently Viewed", visible: true },
  { id: "fundamentalMovers", label: "Fundamental Movers", visible: true },
  { id: "heatmap", label: "Sector Heatmap", visible: true },
  { id: "valuePicks", label: "Value & Quality Picks", visible: true },
  { id: "feeds", label: "FII/DII + News + IPO", visible: true },
  { id: "pulse", label: "Market Pulse", visible: true },
];

function loadWidgets(): DashboardWidget[] {
  try {
    const stored = localStorage.getItem("funda-dashboard-layout");
    if (stored) {
      const parsed: DashboardWidget[] = JSON.parse(stored);
      // Merge new widgets that may not exist in stored layout
      const ids = new Set(parsed.map((w) => w.id));
      const merged = [...parsed];
      for (const dw of DEFAULT_WIDGETS) {
        if (!ids.has(dw.id)) merged.push(dw);
      }
      return merged;
    }
  } catch {}
  return DEFAULT_WIDGETS;
}

function saveWidgets(widgets: DashboardWidget[]) {
  localStorage.setItem("funda-dashboard-layout", JSON.stringify(widgets));
}

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(loadWidgets);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    saveWidgets(widgets);
  }, [widgets]);

  const toggleVisibility = useCallback((id: string) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
  }, []);

  const isVisible = useCallback(
    (id: string) => widgets.find((w) => w.id === id)?.visible ?? true,
    [widgets]
  );

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
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="glass-card-elevated p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Customize Dashboard</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetLayout} className="text-xs gap-1">
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" onClick={onClose} className="text-xs">Done</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drag to reorder • Toggle visibility</p>
      <Reorder.Group
        axis="y"
        values={widgets}
        onReorder={setWidgets}
        className="space-y-1"
      >
        {widgets.map((widget) => (
          <Reorder.Item
            key={widget.id}
            value={widget}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className={`text-sm flex-1 ${widget.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>
              {widget.label}
            </span>
            <button onClick={() => toggleVisibility(widget.id)} className="text-muted-foreground hover:text-foreground transition-colors">
              {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </motion.div>
  );
}

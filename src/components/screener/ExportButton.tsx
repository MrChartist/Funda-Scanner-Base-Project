import { Download } from "lucide-react";
import type { MetricStore, ScreenRun } from "@/lib/contracts";
import { screenCsvFilename, screenToCsv } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export interface ExportButtonProps {
  run: ScreenRun | null;
  store: MetricStore | null;
}

/** Downloads the matches as CSV, with a provenance header and a SAMPLE- prefix for fictional data. */
export function ExportButton({ run, store }: ExportButtonProps) {
  const onClick = () => {
    if (!run || !store) return;
    try {
      const blob = new Blob([screenToCsv(run, store)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = screenCsvFilename(store);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "The file could not be created in this browser.", variant: "destructive" });
    }
  };
  return (
    <Button type="button" variant="outline" className="min-h-11" disabled={!run || !store} onClick={onClick}>
      <Download className="mr-1 h-4 w-4" aria-hidden="true" />
      Export CSV
    </Button>
  );
}

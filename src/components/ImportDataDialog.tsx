import { useRef, useState } from "react";
import { Upload, Download, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useDataProvider } from "@/hooks/use-data-provider";
import {
  clearImportedData, createStaticProvider, saveImportedData, setDataProvider,
} from "@/lib/data-provider";
import { MAX_IMPORT_BYTES, parseFundamentals, type ImportResult } from "@/lib/import-data";

export function ImportDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const provider = useDataProvider();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const analyse = (content: string, name: string) => {
    setNote(null);
    setResult(content.trim() ? parseFundamentals(content, name) : null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setResult({ rows: [], issues: [{ row: 0, level: "error", message: "File is larger than 5 MB." }] });
      return;
    }
    const content = await file.text();
    setFileName(file.name);
    setText(content);
    analyse(content, file.name);
  };

  const errors = result?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.level === "warning") ?? [];
  const canImport = !!result && result.rows.length > 0 && errors.length === 0;

  const doImport = () => {
    if (!result || !canImport) return;
    const name = fileName || "Imported data";
    setDataProvider(createStaticProvider("imported", name, result.rows));
    const persisted = saveImportedData(name, result.rows);
    setNote(persisted ? null : "Imported for this session only: browser storage is full or unavailable.");
    if (persisted) onOpenChange(false);
  };

  const reset = () => {
    clearImportedData();
    setText(""); setFileName(""); setResult(null); setNote(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import your own data</DialogTitle>
          <DialogDescription>
            Load fundamentals from a CSV or JSON file. Files are read in your browser and never uploaded.
            Current source: <strong>{provider.isDemo ? "Demo data" : provider.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,.json,text/csv,application/json" className="hidden"
              aria-label="Choose a CSV or JSON file" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />Choose file
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href="/sample-data/fundamentals-template.csv" download><Download className="h-4 w-4 mr-1" />Download template</a>
            </Button>
          </div>

          <Textarea value={text} rows={5} placeholder="…or paste CSV / JSON here"
            className="font-mono text-xs"
            onChange={(e) => { setText(e.target.value); setFileName(""); analyse(e.target.value, ""); }} />

          {result && (
            <div className="rounded-md border border-border p-3 space-y-2" role="status">
              <p className="font-medium text-foreground">
                {result.rows.length} {result.rows.length === 1 ? "company" : "companies"} found
                {errors.length > 0 && <span className="text-destructive"> · {errors.length} error{errors.length > 1 ? "s" : ""}</span>}
                {warnings.length > 0 && <span className="text-chart-amber"> · {warnings.length} warning{warnings.length > 1 ? "s" : ""}</span>}
              </p>
              {[...errors, ...warnings].length > 0 && (
                <ul className="max-h-32 overflow-y-auto space-y-1 text-xs text-muted-foreground">
                  {[...errors, ...warnings].slice(0, 10).map((i, n) => (
                    <li key={n} className={i.level === "error" ? "text-destructive" : ""}>
                      {i.row > 0 ? `Row ${i.row}: ` : ""}{i.message}
                    </li>
                  ))}
                  {errors.length + warnings.length > 10 && <li>…and {errors.length + warnings.length - 10} more.</li>}
                </ul>
              )}
            </div>
          )}

          {!provider.isDemo && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-chart-amber" />
              Company detail pages still show demo data. Imported data currently powers the Screener only.
            </p>
          )}
          {note && <p className="text-xs text-chart-amber">{note}</p>}
          <p className="text-xs text-muted-foreground">
            You are responsible for the accuracy and licence of the data you import. Column names and units:{" "}
            <a className="underline" href="https://github.com/MrChartist/Funda-Scanner-Base-Project/blob/main/docs/data-format.md" target="_blank" rel="noopener noreferrer">data format guide</a>.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={reset} disabled={provider.isDemo && !result}>
            <Trash2 className="h-4 w-4 mr-1" />Use demo data
          </Button>
          <Button size="sm" onClick={doImport} disabled={!canImport}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

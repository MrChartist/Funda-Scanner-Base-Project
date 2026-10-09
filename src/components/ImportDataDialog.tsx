// src/components/ImportDataDialog.tsx — import your own fundamentals (WS1).
// Multi-file drop or picker, a preview report, then confirm. Files are read in the browser and
// never uploaded. Also offers "Use sample data" and the CSV templates.
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Download, FileUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportReport } from "@/components/data/ImportReport";
import { useActiveProvider } from "@/hooks/use-dataset";
import type { ImportOutcome } from "@/lib/contracts";
import {
  activateImportedDataset, clearImportedData, importFiles, MONEY_SCALE_LABEL, MONEY_SCALES, type MoneyScale,
  type PersistKind,
} from "@/lib/data";
import { formatNumberIN } from "@/lib/format/indian";
import { parseIsoDate } from "@/lib/time/civil";
import { assetUrl } from "@/lib/base-path";
import { toast } from "sonner";

/** Files above this size are not read at all (the importer's own limits are lower). */
const MAX_READ_BYTES = 60 * 1024 * 1024;

const TEMPLATE_LINKS: readonly { href: string; label: string }[] = [
  { href: assetUrl("sample-data/templates/companies-template.csv"), label: "Company list" },
  { href: assetUrl("sample-data/templates/annual-template.csv"), label: "Annual statements" },
  { href: assetUrl("sample-data/templates/quarterly-template.csv"), label: "Quarterly results" },
  { href: assetUrl("sample-data/templates/shareholding-template.csv"), label: "Shareholding" },
  { href: assetUrl("sample-data/fundamentals-template.csv"), label: "One-row snapshot" },
];

const DOCS_URL = "https://github.com/MrChartist/Funda-Scanner-Base-Project/blob/main/docs/data-format.md";

interface PickedFile {
  name: string;
  text: string;
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsText(file);
  });
}

const PERSIST_NOTE: Record<PersistKind, string> = {
  indexeddb: "Saved in this browser. It will load again on your next visit.",
  localstorage: "Saved in this browser's local storage. It will load again on your next visit.",
  memory: "Kept for this session only: this browser did not allow the data to be saved. Export it as JSON from the banner to keep a copy.",
};

export interface ImportDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDataDialog({ open, onOpenChange }: ImportDataDialogProps) {
  const provider = useActiveProvider();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [pasted, setPasted] = useState("");
  const [scale, setScale] = useState<MoneyScale>("crore");
  const [asOf, setAsOf] = useState("");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Re-check whenever the inputs change; a newer check always replaces an older one.
  useEffect(() => {
    const inputs = [...files];
    if (pasted.trim()) inputs.push({ name: /^\s*[[{]/.test(pasted) ? "pasted.json" : "pasted.csv", text: pasted });
    if (inputs.length === 0) {
      setOutcome(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    importFiles(inputs, { moneyScale: scale }).then((o) => {
      if (cancelled) return;
      setOutcome(o);
      setChecking(false);
    }, (e: unknown) => {
      if (cancelled) return;
      setReadError(e instanceof Error ? e.message : "The files could not be checked.");
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [files, pasted, scale]);

  const addFiles = async (list: FileList | File[] | null | undefined) => {
    if (!list) return;
    setNote(null);
    setReadError(null);
    const picked: PickedFile[] = [];
    const skipped: string[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_READ_BYTES) {
        skipped.push(f.name);
        continue;
      }
      try {
        picked.push({ name: f.name, text: await readFileText(f) });
      } catch {
        skipped.push(f.name);
      }
    }
    if (skipped.length) setReadError(`These files could not be read or are too large: ${skipped.join(", ")}.`);
    if (picked.length) {
      setFiles((prev) => [...prev.filter((p) => !picked.some((n) => n.name === p.name)), ...picked]);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(e.dataTransfer?.files);
  };

  const asOfValid = asOf === "" || parseIsoDate(asOf) !== null;
  const canImport = !!outcome?.dataset && outcome.report.ok && !checking && !busy && asOfValid;

  const reset = () => {
    setFiles([]);
    setPasted("");
    setOutcome(null);
    setAsOf("");
    setReadError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const confirm = async () => {
    if (!outcome?.dataset || !canImport) return;
    setBusy(true);
    try {
      const dataset = asOf ? { ...outcome.dataset, meta: { ...outcome.dataset.meta, asOf } } : outcome.dataset;
      const { persisted } = await activateImportedDataset({ ...outcome, dataset });
      setNote(PERSIST_NOTE[persisted]);
      toast(`Imported ${formatNumberIN(dataset.companies.length, 0)} ${dataset.companies.length === 1 ? "company" : "companies"}.`, { description: PERSIST_NOTE[persisted] });
      reset();
      if (persisted !== "memory") onOpenChange(false);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "The data could not be activated.");
    } finally {
      setBusy(false);
    }
  };

  const chooseSample = async () => {
    setBusy(true);
    try {
      await clearImportedData();
      reset();
      setNote(null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import your data</DialogTitle>
          <DialogDescription>
            Load fundamentals from CSV or JSON files. Files are read in your browser and are never uploaded.
            Current source: <strong>{provider.isDemo ? "Sample data (fictional companies)" : provider.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            data-testid="import-drop-zone"
            className={`flex flex-col items-center gap-2 rounded-md border-2 border-dashed p-4 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <FileUp className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">
              Drop one or more files here: a company list, annual statements, quarterly results, shareholding, a one-row snapshot or a Funda Scanner JSON dataset.
            </p>
            <input
              ref={inputRef}
              id="import-files"
              type="file"
              multiple
              accept=".csv,.json,text/csv,application/json"
              className="sr-only"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => inputRef.current?.click()}>
              Choose files
            </Button>
          </div>

          {files.length > 0 && (
            <ul className="space-y-1" aria-label="Chosen files">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
                  <span className="break-all font-mono text-xs">{f.name}</span>
                  <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((p) => p.name !== f.name))}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-1">
            <Label htmlFor="import-paste">Or paste CSV or JSON</Label>
            <Textarea id="import-paste" value={pasted} rows={4} className="font-mono text-xs"
              placeholder="symbol,name,sector,…" onChange={(e) => setPasted(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="import-scale">Amounts in my CSV statements are in</Label>
              <Select value={scale} onValueChange={(v) => setScale(v as MoneyScale)}>
                <SelectTrigger id="import-scale" aria-label="Unit of amounts" className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEY_SCALES.map((s) => (
                    <SelectItem key={s} value={s}>{MONEY_SCALE_LABEL[s]}{s === "crore" ? " (default)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="import-asof">Data as of (optional)</Label>
              <Input id="import-asof" type="date" value={asOf} className="min-h-11"
                aria-invalid={!asOfValid} onChange={(e) => setAsOf(e.target.value)} />
              <p className="text-xs text-muted-foreground">Shown exactly as you enter it. Leave it blank if you are not sure.</p>
            </div>
          </div>

          {checking && <p role="status" className="text-xs text-muted-foreground">Checking the files…</p>}
          {readError && <p role="alert" className="text-xs text-destructive">{readError}</p>}
          {outcome && !checking && <ImportReport outcome={outcome} />}
          {note && <p role="status" className="text-xs text-chart-amber">{note}</p>}

          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">Templates</p>
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_LINKS.map((t) => (
                <Button key={t.href} variant="ghost" size="sm" asChild>
                  <a href={t.href} download><Download className="mr-1 h-4 w-4" aria-hidden="true" />{t.label}</a>
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            You are responsible for the accuracy and licence of the data you import. Column names, units and checks are described in the{" "}
            <a className="underline" href={DOCS_URL} target="_blank" rel="noopener noreferrer">data format guide</a>.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => void chooseSample()} disabled={busy}>
            <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />Use sample data
          </Button>
          <Button type="button" size="sm" className="min-h-11" onClick={() => void confirm()} disabled={!canImport}>
            {outcome?.dataset && outcome.report.ok
              ? `Import ${formatNumberIN(outcome.report.companies, 0)} ${outcome.report.companies === 1 ? "company" : "companies"}`
              : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { BookmarkCheck, Save } from "lucide-react";
import type { ScreenDefinition } from "@/lib/contracts";
import { deleteScreen, duplicateScreen, loadSavedScreens } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SaveScreenDialog, type ScreenDraft } from "./SaveScreenDialog";
import { ICON_BUTTON, ICON_LABEL } from "./toolbar";

export interface SavedScreensMenuProps {
  /** The current screen (for "Save"). */
  draft: ScreenDraft;
  onLoad: (def: ScreenDefinition) => void;
  onSaved?: (def: ScreenDefinition) => void;
  /** Which button to draw: "save" (primary), "list" (icon) or both. */
  part?: "save" | "list" | "both";
}

/** "Saved screens" list (load, copy, delete) and the "Save screen" dialog. */
export function SavedScreensMenu({ draft, onLoad, onSaved, part = "both" }: SavedScreensMenuProps) {
  const [listOpen, setListOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [screens, setScreens] = useState<ScreenDefinition[]>(() => loadSavedScreens());
  const refresh = () => setScreens(loadSavedScreens());

  return (
    <>
      {part !== "save" && (
      <Dialog open={listOpen} onOpenChange={(o) => { setListOpen(o); if (o) refresh(); }}>
        <DialogTrigger asChild>
          <Button type="button" variant="ghost" className={ICON_BUTTON} title="Saved screens">
            <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
            <span className={ICON_LABEL}>Saved screens</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved screens</DialogTitle>
            <DialogDescription>Kept in this browser only.</DialogDescription>
          </DialogHeader>
          {screens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing saved yet. Use “Save screen” to keep your current rules.</p>
          ) : (
            <ul className="divide-y">
              {screens.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {s.description && <p className="truncate text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                  <Button type="button" size="sm" className="min-h-11" aria-label={`Load ${s.name}`} onClick={() => { onLoad(s); setListOpen(false); }}>Load</Button>
                  <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`Copy ${s.name}`} onClick={() => { duplicateScreen(s.id); refresh(); }}>Copy</Button>
                  <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`Delete ${s.name}`} onClick={() => { deleteScreen(s.id); refresh(); }}>Delete</Button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
      )}
      {part !== "list" && (
        <>
          <Button type="button" className="min-h-11 lg:min-h-9" onClick={() => setSaveOpen(true)}>
            <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
            <span className="sm:hidden" aria-hidden="true">Save</span>
            <span className="sr-only sm:not-sr-only">Save screen</span>
          </Button>
          <SaveScreenDialog
            open={saveOpen}
            onOpenChange={setSaveOpen}
            draft={draft}
            onSaved={(d) => {
              refresh();
              onSaved?.(d);
            }}
          />
        </>
      )}
    </>
  );
}

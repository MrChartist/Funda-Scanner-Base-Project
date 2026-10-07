import { useState } from "react";
import { BookmarkCheck, Save } from "lucide-react";
import type { ScreenDefinition } from "@/lib/contracts";
import { deleteScreen, duplicateScreen, loadSavedScreens } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SaveScreenDialog, type ScreenDraft } from "./SaveScreenDialog";

export interface SavedScreensMenuProps {
  /** The current screen (for "Save"). */
  draft: ScreenDraft;
  onLoad: (def: ScreenDefinition) => void;
  onSaved?: (def: ScreenDefinition) => void;
}

/** "Saved screens" list (load, copy, delete) and the "Save screen" dialog. */
export function SavedScreensMenu({ draft, onLoad, onSaved }: SavedScreensMenuProps) {
  const [listOpen, setListOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [screens, setScreens] = useState<ScreenDefinition[]>(() => loadSavedScreens());
  const refresh = () => setScreens(loadSavedScreens());

  return (
    <>
      <Dialog open={listOpen} onOpenChange={(o) => { setListOpen(o); if (o) refresh(); }}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="min-h-11">
            <BookmarkCheck className="mr-1 h-4 w-4" aria-hidden="true" />
            Saved screens
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
      <Button type="button" variant="outline" className="min-h-11" onClick={() => setSaveOpen(true)}>
        <Save className="mr-1 h-4 w-4" aria-hidden="true" />
        Save screen
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
  );
}

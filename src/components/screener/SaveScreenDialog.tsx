import { useEffect, useState, type FormEvent } from "react";
import type { ScreenDefinition } from "@/lib/contracts";
import { ScreenNameError, saveScreen, validateScreenName } from "@/lib/screen";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ScreenDraft = Omit<ScreenDefinition, "v" | "id" | "createdAt" | "updatedAt" | "catalogueVersion" | "name" | "description">;

export interface SaveScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current screen, without a name. */
  draft: ScreenDraft;
  defaultName?: string;
  onSaved: (saved: ScreenDefinition) => void;
}

/** Asks for a name (replacing window.prompt) and saves in this browser. */
export function SaveScreenDialog({ open, onOpenChange, draft, defaultName = "", onSaved }: SaveScreenDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setDescription("");
      setError(null);
    }
  }, [open, defaultName]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const problem = validateScreenName(name);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const saved = saveScreen({ ...draft, name, description: description.trim() });
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ScreenNameError) setError(err.message);
      else setError("The screen could not be saved in this browser.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Save this screen</DialogTitle>
            <DialogDescription>Saved in this browser only. Your rules, columns and universe are stored.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="screen-name">Name</Label>
            <Input
              id="screen-name"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "screen-name-error" : undefined}
              className="min-h-11"
              autoComplete="off"
            />
            {error && <p id="screen-name-error" role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="screen-description">Note (optional)</Label>
            <Input id="screen-description" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-11" autoComplete="off" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="min-h-11">Save screen</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

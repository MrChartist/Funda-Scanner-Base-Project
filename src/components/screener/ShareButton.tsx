import { useEffect, useRef, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export interface ShareButtonProps {
  /** The link to the current screen. */
  getUrl: () => string;
}

/** Copies a link to this screen. When the clipboard is blocked, shows the link selected for manual copy. */
export function ShareButton({ getUrl }: ShareButtonProps) {
  const [fallback, setFallback] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fallback !== null) {
      const id = setTimeout(() => input.current?.select(), 0);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [fallback]);

  const share = async () => {
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Anyone with the link sees the same rules. Imported data is not shared." });
    } catch {
      setFallback(url);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={() => void share()}>
        <Share2 className="mr-1 h-4 w-4" aria-hidden="true" />
        Share
      </Button>
      <Dialog open={fallback !== null} onOpenChange={(o) => { if (!o) setFallback(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy this link</DialogTitle>
            <DialogDescription>Your browser did not allow copying. The link is selected: press Ctrl+C (Cmd+C on Mac).</DialogDescription>
          </DialogHeader>
          <Input ref={input} readOnly value={fallback ?? ""} aria-label="Link to this screen" className="min-h-11" onFocus={(e) => e.currentTarget.select()} />
        </DialogContent>
      </Dialog>
    </>
  );
}

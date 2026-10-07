import type { CompletionItem } from "@/lib/contracts";
import { cn } from "@/lib/utils";
import { optionId } from "./helpers";

export interface CompletionPopoverProps {
  id: string;
  items: readonly CompletionItem[];
  /** Index of the highlighted option, or -1 when none is highlighted yet. */
  active: number;
  onPick: (item: CompletionItem) => void;
}

/**
 * Suggestions under the editor. Listbox semantics as in cmdk: role="listbox" with role="option"
 * children and aria-selected; the textarea keeps focus and points at the active option through
 * aria-activedescendant.
 */
export function CompletionPopover({ id, items, active, onPick }: CompletionPopoverProps) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border bg-popover text-popover-foreground shadow-md">
      <p className="sr-only" role="status">{items.length} suggestions. Use the up and down arrow keys, then Enter or Tab.</p>
      <ul id={id} role="listbox" aria-label="Suggestions" className="max-h-56 overflow-auto p-1">
        {items.map((item, i) => (
          <li
            key={`${item.kind}:${item.insert}`}
            id={optionId(id, i)}
            role="option"
            aria-selected={i === active}
            // The textarea must keep focus, so the pointer press is not allowed to move it.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(item)}
            className={cn(
              "flex min-h-11 cursor-pointer flex-col justify-center rounded px-2 py-1 text-sm",
              i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-xs text-muted-foreground">
              <code className="font-mono">{item.insert}</code> · {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

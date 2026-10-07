import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import type { CompletionItem, CompletionList, MetricStore, QueryIssue } from "@/lib/contracts";
import { suggestAt } from "@/lib/query";
import { CompletionPopover } from "./CompletionPopover";
import { HighlightLayer } from "./HighlightLayer";
import { optionId } from "./helpers";
import { IssueList } from "./IssueList";

export interface QueryEditorProps {
  store: MetricStore;
  value: string;
  issues: readonly QueryIssue[];
  onChange: (text: string) => void;
  /** Ctrl or Cmd with Enter: run now, without waiting for the debounce. */
  onRunNow: () => void;
}

const LAYOUT = "whitespace-pre-wrap break-words p-3 font-mono text-base leading-6";

/** FSQL editor: a plain textarea over a coloured copy of its text, with squiggles, issues and suggestions. */
export function QueryEditor({ store, value, issues, onChange, onRunNow }: QueryEditorProps) {
  const uid = useId();
  const listId = `${uid}-suggestions`;
  const issuesId = `${uid}-issues`;
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const [completion, setCompletion] = useState<CompletionList | null>(null);
  const [active, setActive] = useState(-1);

  // Grow with the text, so the coloured copy behind never needs to scroll.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.max(ta.scrollHeight, 144)}px`;
    if (pendingCursor.current !== null) {
      ta.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [value]);

  useEffect(() => {
    // Suggestions describe the text they were made for; drop them if the text is replaced elsewhere.
    setCompletion(null);
    setActive(-1);
  }, [store]);

  const open = (text: string, cursor: number, force: boolean) => {
    const list = suggestAt(text, cursor, store);
    const hasPrefix = cursor > list.span.start;
    if (list.items.length > 0 && (force || hasPrefix)) {
      setCompletion(list);
      setActive(-1);
    } else setCompletion(null);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    open(e.target.value, e.target.selectionStart, false);
  };

  const pick = (item: CompletionItem) => {
    if (!completion) return;
    const { start, end } = completion.span;
    const next = value.slice(0, start) + item.insert + value.slice(end);
    pendingCursor.current = start + item.insert.length;
    setCompletion(null);
    setActive(-1);
    onChange(next);
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setCompletion(null);
      onRunNow();
      return;
    }
    if (e.key === " " && e.ctrlKey) {
      e.preventDefault();
      open(value, e.currentTarget.selectionStart, true);
      return;
    }
    const items = completion?.items ?? [];
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      pick(items[Math.max(active, 0)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCompletion(null);
    }
  };

  const fix = (issue: QueryIssue, replacement: string) => {
    onChange(value.slice(0, issue.span.start) + replacement + value.slice(issue.span.end));
  };

  const shown = issues.filter((i) => i.level !== "info");
  const isOpen = completion !== null && completion.items.length > 0;
  return (
    <div className="space-y-2">
      <div className="relative rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring">
        <HighlightLayer source={value} issues={issues} className={LAYOUT} />
        <textarea
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onBlur={() => setCompletion(null)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          rows={6}
          aria-label="Query"
          data-slash-focus
          aria-describedby={issuesId}
          aria-autocomplete="list"
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={isOpen && active >= 0 ? optionId(listId, active) : undefined}
          placeholder={"roce > 15\ndebt_equity < 0.5"}
          className={`${LAYOUT} relative block min-h-36 w-full resize-none overflow-hidden rounded-md bg-transparent text-transparent caret-foreground outline-none placeholder:text-muted-foreground selection:bg-primary/25`}
        />
      </div>
      <p className="text-sm text-muted-foreground">One rule per line. Press Ctrl+Enter (Cmd+Enter on Mac) to run now. Ctrl+Space shows suggestions.</p>
      {isOpen && completion && <CompletionPopover id={listId} items={completion.items} active={active} onPick={pick} />}
      <IssueList id={issuesId} source={value} issues={shown} onFix={fix} />
    </div>
  );
}

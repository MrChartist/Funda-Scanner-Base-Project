import type { ScreenRun } from "@/lib/contracts";
import { EmptyState } from "@/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";

export interface FunnelPanelProps {
  run: ScreenRun;
}

/** How many companies each rule removes, and what would match if one rule were dropped. */
export function FunnelPanel({ run }: FunnelPanelProps) {
  if (run.funnel.length === 0) {
    return <EmptyState title="No rules to show" description="Add a rule to see how many companies each one removes." />;
  }
  const total = run.universe.length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Rules are applied in the order written. “Without this rule” shows how many companies would match if only that rule were removed.
      </p>
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max border-collapse text-sm">
          <caption className="sr-only">Funnel of rules: companies passing, failing and not checked for each rule</caption>
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold">Rule</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Passes</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Fails</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Not checked</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Left after this rule</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Without this rule</th>
            </tr>
          </thead>
          <tbody>
            {run.funnel.map((s) => (
              <tr key={s.clause} className="border-t align-top">
                <th scope="row" className="max-w-sm px-3 py-2 text-left font-normal">
                  <span className="font-medium">Rule {s.clause + 1}: </span>
                  <code className="font-mono text-xs">{s.text}</code>
                  {s.strictest && <Badge variant="outline" className="ml-2 text-xs">Strictest</Badge>}
                  <span className="block text-muted-foreground">{s.english}</span>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{s.passed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.failed}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.unknown}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.remainingAfter} of {total}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.dropOneMatches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

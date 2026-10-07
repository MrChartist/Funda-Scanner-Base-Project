import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { MetricStore } from "@/lib/contracts";
import { SCREEN_URL_VERSION } from "@/lib/contracts";
import { screensPassedBy, TEMPLATES } from "@/lib/screen";
import { encodeScreenUrl } from "@/lib/screen/url";
import { loadSavedScreens } from "@/lib/screen/saved";
import { PassFailIcon } from "@/components/common/PassFailIcon";

export interface ScreensPassedProps {
  store: MetricStore;
  index: number;
}

interface Entry {
  id: string;
  name: string;
  passed: boolean | null;
  href: string;
}

function screenerHref(query: string, templateId: string | null): string {
  const params = encodeScreenUrl({
    v: SCREEN_URL_VERSION, query, columns: null, sort: null, universe: { kind: "all" }, templateId, page: 1, pageSize: 25,
  });
  return `/screener?${params.toString()}`;
}

const ORDER = { true: 0, null: 1, false: 2 } as const;

function List({ title, entries, empty }: { title: string; entries: Entry[]; empty: string }) {
  const passed = entries.filter((e) => e.passed === true).length;
  return (
    <section className="rounded-md border p-3" aria-label={title}>
      <h3 className="text-sm font-semibold">
        {title}
        {entries.length > 0 && <span className="font-normal text-muted-foreground"> · passes {passed} of {entries.length}</span>}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y">
          {[...entries]
            .sort((a, b) => ORDER[String(a.passed) as keyof typeof ORDER] - ORDER[String(b.passed) as keyof typeof ORDER])
            .map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <Link to={e.href} className="inline-flex min-h-11 items-center text-sm underline-offset-2 hover:underline">{e.name}</Link>
                <PassFailIcon status={e.passed === true ? "pass" : e.passed === false ? "fail" : "unknown"} label={e.passed === true ? "Passes" : e.passed === false ? "Does not pass" : "Not evaluated"} />
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/** Which guided templates and saved screens this company passes, with the same engine the Screener uses. */
export function ScreensPassed({ store, index }: ScreensPassedProps) {
  const { templates, saved } = useMemo(() => {
    type Source = { id: string; name: string; query: string };
    const tpl: Source[] = TEMPLATES.map((t) => ({ id: t.id, name: t.title, query: t.query }));
    const mine: Source[] = loadSavedScreens().map((s) => ({ id: s.id, name: s.name, query: s.query }));
    const hrefOf = new Map<string, string>([
      ...tpl.map((t) => [t.id, screenerHref(t.query, t.id)] as const),
      ...mine.map((s) => [s.id, screenerHref(s.query, null)] as const),
    ]);
    const toEntries = (list: Source[]) => screensPassedBy(store, index, list).map((r) => ({ ...r, href: hrefOf.get(r.id) ?? "/screener" }));
    return { templates: toEntries(tpl), saved: toEntries(mine) };
  }, [store, index]);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <List title="Guided templates" entries={templates} empty="No templates are available." />
      <List title="Your saved screens" entries={saved} empty="You have not saved any screens yet. Build one in the Screener and it will appear here." />
    </div>
  );
}

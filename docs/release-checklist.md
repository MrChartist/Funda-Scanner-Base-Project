# Release checklist

Automated tests cannot cover everything: real browsers, real screen readers and real devices behave
differently from jsdom. Go through this list before a release and note the date, the browser versions and
who checked. Mark anything you could not check as not checked rather than assuming it passes.

## 1. Automated gates (all must pass)

```bash
npm ci
npm run check            # typecheck, strict typecheck, lint (0 errors), tests, production build
PERF=1 npm run test:perf # strict performance budgets; run on a quiet machine and record the numbers
```

Run `npm test` twice. A test that passes once and fails once is a bug to fix, not to re-run.

Performance targets for 5,000 companies (spec G.5): store plus 30 columns under 400 ms, a cold
6-clause windowed query under 300 ms, a warm re-run under 30 ms, company-page selectors (warm) under
50 ms. Write down the measured values in the release notes.

## 2. Layout at 360 px and 1280 px

Check every page at **360 px wide** (a small phone) and **1280 px wide** (a laptop), in light and dark
themes, in Chrome and one other browser. Rotate a real phone if you have one.

- [ ] No horizontal scrolling of the page itself (tables may scroll inside their own box).
- [ ] Header, bottom navigation and the command palette are usable; nothing is hidden behind them.
- [ ] Text is at least 12 px; tap targets are at least 44 px; focus rings are visible.
- [ ] Dashboard, Screener, Company, Compare, Watchlist, Portfolio, DCF, Learn and the not-found page all render.
- [ ] Screener at 360 px shows result cards (not a table), the Why drawer opens as a sheet, and the rule chips wrap.
- [ ] Screener at 1280 px shows the table with a sticky company column and the median row.
- [ ] Company page: section navigation works, deep links such as `#scores` land on the right section, and the
      statements tables scroll inside their own box.
- [ ] Zoom to 200% and set the browser text size to large: nothing overlaps or is cut off.
- [ ] Pass and fail are never shown by colour alone (an icon and text are always present).
- [ ] With "reduce motion" on, animations are off.

## 3. Screen reader pass

Use at least one of NVDA (Windows, Firefox or Chrome), VoiceOver (macOS Safari, and iOS Safari) or
TalkBack (Android Chrome). Check the **Screener** and the **Company** pages in full.

Screener:
- [ ] Landmarks and headings give a sensible outline; the page title changes with the route.
- [ ] The query box has a name; errors and suggestions are announced; the plain-English preview is read.
- [ ] Rule chips: each chip can be edited and removed from the keyboard, and its result is announced.
- [ ] Results: the table has a caption and column headers; each row says whether every rule passed;
      sort buttons announce their state; the Why drawer traps focus and returns it on close.
- [ ] Near misses, the funnel and the "not evaluated" groups are readable as text, not only as graphics.
- [ ] Saving, sharing and exporting announce their result (a toast or a status message).

Company:
- [ ] The company name, type and "(fictional)" label are read in the page heading.
- [ ] Every figure reads as value, period and unit; a missing figure reads its reason (for example
      "Not provided"), never "dash" alone.
- [ ] The not-applicable chip for lenders reads in full.
- [ ] Checks and scores: pass, not met and not evaluated are all spoken; "Why this score?" opens a dialog with the nine tests.
- [ ] Statement tables have row and column headers.

## 4. Storage in real browsers

Imported data and user lists live in IndexedDB, with localStorage and in-memory fallbacks. jsdom cannot
test the real thing, so check each of these in Chrome, Firefox, desktop Safari and iOS Safari:

- [ ] Import the four public sample CSV files (`public/sample-data/funda-sample-*.csv`); reload the page; the
      data is still there and the banner says "Your data".
- [ ] Close the browser completely and reopen it; the data is still there.
- [ ] Import a large file (several MB); note whether it is saved in IndexedDB or only for the session.
- [ ] **Safari private mode** (and a private window in each other browser): import a file. The app must not
      crash; it must say the data is "kept for this session only" and offer a JSON export. Reload and
      confirm the sample data returns with an honest message.
- [ ] Block site data in the browser settings: the app still opens and shows the sample.
- [ ] Fill the storage quota (import a very large dataset on iOS Safari): the failure message is understandable
      and nothing already saved is lost.
- [ ] Upgrade path: in a browser that holds data from the previous release (the old `funda-imported-data`,
      `funda-screens` and `funda-followed` keys), open the new build. The import is migrated, saved
      screens load, and followed symbols that are not in the data sit under "Not in your current data".
- [ ] "Clear imported data" removes every stored copy and returns to the sample.
- [ ] Watchlist, portfolio, saved screens and dashboard layout survive a reload.

## 5. Bundle size

The sample generator is a separate chunk, so the initial JavaScript should not grow much. Spec H.2
suggests a budget of **40 KB gzip or less** of extra initial JavaScript compared with the previous release.

- [ ] `npm run build`; list `dist/assets/*.js` with gzip sizes (for example `gzip -c file | wc -c`).
- [ ] Record the initial (entry plus vendor) total and compare with the previous release.
- [ ] The sample-generator chunk and the glossary load on demand, not in the entry chunk.
- [ ] No chunk over 500 KB (uncompressed) without a reason written down.
- [ ] Lighthouse (mobile, throttled) on the Dashboard and the Screener: record performance and accessibility scores.

## 6. Regenerating sample files on Windows

`npm run sample:files` rewrites `public/sample-data/funda-sample-*.csv` and `.json` with
`toMatchFileSnapshot`. It is tested on Linux only. On Windows, in a clean checkout:

- [ ] Set `git config core.autocrlf false` (or check out with LF endings), run `npm ci` and `npm test`:
      the "match the committed files" test must pass **before** you regenerate anything.
- [ ] Run `npm run sample:files`, then `git status`: no file should change when the generator has not
      changed. If every file shows as changed, line endings are the cause; fix the setup, do not commit.
- [ ] Open a regenerated CSV in Excel and in a text editor: the first line is the `#` provenance comment,
      the rupee sign and other non-ASCII text are intact (UTF-8).
- [ ] Import the regenerated files in the app and confirm the import report has no errors.

## 7. Content and honesty review

- [ ] Search the built app for the words "buy", "sell", "avoid", "target price", "guaranteed": none in user-visible text.
- [ ] Every fictional company shows "(fictional)" wherever its name appears, including exports and the compare table.
- [ ] No page shows a date, a price or a "last updated" time that the data did not supply.
- [ ] Every score and check block carries "Rule-based observations on the data you loaded. Not a recommendation."
- [ ] The README feature list matches the app (no removed sections are still advertised).
- [ ] `CHANGELOG.md` describes this release, including anything that is breaking.
- [ ] Owner items from the spec (section H.2) that are still open are listed in the release notes.

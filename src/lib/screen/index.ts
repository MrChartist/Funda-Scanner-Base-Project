// src/lib/screen/index.ts — public API of the screen engine (WS4, spec §D.12, §D.13, §E.6).
export { runScreen, resolveUniverse, defaultComparator, displayComparator, screensPassedBy } from "./run";
export { buildFunnel, groupSkipped } from "./funnel";
export { findNearMisses, MAX_NEAR_MISSES } from "./near-miss";
export { DEFAULT_COLUMNS, MAX_QUERY_COLUMNS, resolveColumns, medianOver } from "./columns";
export { TEMPLATES, templateById } from "./templates";
export { encodeScreenUrl, decodeScreenUrl } from "./url";
export {
  loadSavedScreens, saveScreen, deleteScreen, renameScreen, duplicateScreen, validateScreenName, exportScreenLibrary,
  importScreenLibrary, v0FiltersToQuery, ScreenNameError, V0_BACKUP_KEY, MAX_NAME_LENGTH,
} from "./saved";
export { screenToCsv, toCsvCell, screenCsvFilename } from "./export-csv";

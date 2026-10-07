// src/lib/insights/checks/index.ts — the full rule set in display order: checks, then red flags.
import type { CheckRule } from "@/lib/contracts";
import { LENDER_CHECKS } from "./lender";
import { NONFIN_CHECKS } from "./nonfin";
import { RED_FLAGS } from "./red-flags";

export { LENDER_CHECKS } from "./lender";
export { NONFIN_CHECKS } from "./nonfin";
export { RED_FLAGS } from "./red-flags";

/** Every check and red flag (§C.9). Ids are unique and stable; they appear in URLs and docs. */
export const CHECK_RULES: readonly CheckRule[] = [...NONFIN_CHECKS, ...LENDER_CHECKS, ...RED_FLAGS];

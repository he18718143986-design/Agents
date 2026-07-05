import type { RequirementsData } from "../types";

/** Fallback items when the requirements doc has no explicit acceptance criteria. */
export const DEFAULT_ACCEPTANCE_ITEMS = [
  "核心功能是否可用",
  "页面是否看得懂",
  "你是否愿意把这个链接发给别人试用",
] as const;

/** Acceptance checklist shown at stage 3 — derived from the confirmed requirements. */
export function acceptanceItemsFor(requirements: RequirementsData): string[] {
  return requirements.acceptance.length > 0
    ? requirements.acceptance
    : [...DEFAULT_ACCEPTANCE_ITEMS];
}

/** Fresh all-unchecked state matching the current checklist length. */
export function emptyAcceptanceChecks(requirements: RequirementsData): boolean[] {
  return acceptanceItemsFor(requirements).map(() => false);
}

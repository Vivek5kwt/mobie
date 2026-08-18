// Remembers which Default Header multi-tab tab was last selected on each
// page, purely for the current app session (in-memory, not AsyncStorage).
// LayoutScreen.js / BottomNavScreen.js already reset the active tab to 0
// whenever the PAGE changes (intentional — a tab picked on one page must
// never leak into another) via a plain `useState(0)`. But that same
// `useState` also throws the selection away on every remount of the screen
// itself, so navigating away (e.g. opening a product) and back to the exact
// same page reset the tab too, when it should have stayed put. Keyed per
// page name, matching the granularity of the existing reset-on-page-change
// behavior these screens rely on — mirrors the variantSelectionStore.js /
// cartStore.js convention (plain module-level object) used elsewhere in
// this app for cross-remount UI state.
const lastActiveTabByPage = {};

export function getLastActiveTabIndex(pageKey) {
  if (!pageKey) return 0;
  const v = lastActiveTabByPage[pageKey];
  return Number.isFinite(v) ? v : 0;
}

export function setLastActiveTabIndex(pageKey, index) {
  if (!pageKey) return;
  lastActiveTabByPage[pageKey] = Number(index) || 0;
}

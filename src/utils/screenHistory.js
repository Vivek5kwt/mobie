// Tracks the logical screen-visit order across the whole app so header/DSL
// "Previous Screen" actions can reliably go back to wherever the user
// actually came from — even when that hop never grew the real navigator
// stack. LayoutScreen/BottomNavScreen render many different DSL "pages" by
// mutating params in place (via setParams, to avoid remounts on tab
// switches) instead of pushing a new stack entry, so React Navigation's own
// canGoBack()/goBack() only sees the *first* time that route was entered —
// every later page shown at that same depth is invisible to it.
//
// One entry is kept per real stack depth. A depth that gets revisited with
// different params (a tab switch) overwrites its slot instead of growing —
// intentionally: switching bottom-nav tabs is lateral, not a drill-down, so
// "back" from a tab should return to whatever was open *before* tab
// navigation started, not to a previously-viewed sibling tab.
const MAX_ENTRIES = 40;
let entries = [];

const pageKey = (name, params) =>
  `${name}::${params?.pageName ?? params?.handle ?? params?.orderId ?? params?.link ?? ""}`;

export function recordScreenVisit(navigationRef) {
  const state = navigationRef?.getRootState?.();
  const routes = state?.routes ?? [];
  const index = typeof state?.index === "number" ? state.index : routes.length - 1;
  const current = routes[index];
  if (!current?.name) return;

  // A real native pop (swipe gesture, hardware back, some other goBack()
  // call) can shrink the stack without going through goToPreviousScreen —
  // drop anything we'd recorded at or beyond the depth that just
  // disappeared so it isn't offered as a bogus "previous" page later.
  while (entries.length && entries[entries.length - 1].index >= index) {
    entries.pop();
  }

  entries.push({ name: current.name, params: current.params, index });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function goToPreviousScreen(navigation, fallbackRouteName = "LayoutScreen", fallbackParams) {
  if (entries.length > 0) entries.pop(); // the screen we're leaving
  const prev = entries[entries.length - 1];
  if (prev) {
    navigation.navigate(prev.name, prev.params);
    return;
  }
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation.navigate(fallbackRouteName, fallbackParams);
}

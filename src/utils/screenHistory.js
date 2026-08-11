// Tracks the logical screen-visit order across the whole app so header/DSL
// "Previous Screen" actions can reliably go back to wherever the user
// actually came from — even when that hop never grew the real navigator
// stack. LayoutScreen/BottomNavScreen render many different DSL "pages" by
// mutating params in place (via setParams, to avoid remounts) instead of
// pushing a new stack entry, so React Navigation's own canGoBack()/goBack()
// only sees the *first* time that route was entered — every later page
// shown at that same depth (tapping "Wishlist"/"Order History" from the
// "My Account" page, for example — all three are just different pageNames
// on the same BottomNavScreen route) is invisible to it, so it falls back
// to Home instead of the page you actually came from.
//
// Every distinct logical page visited is recorded in strict chronological
// order — "back" always means "whatever was on screen immediately before
// this," the same way a browser back button works, regardless of whether
// the hop was a real stack push or an in-place param swap.
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
  // drop anything recorded strictly deeper than where the stack now sits so
  // it isn't offered as a bogus "previous" page later. Entries recorded at
  // exactly this depth are kept: they're in-place param swaps (setParams),
  // and the deepest one IS what's actually on screen right now.
  while (entries.length && entries[entries.length - 1].index > index) {
    entries.pop();
  }

  const top = entries[entries.length - 1];
  const key = pageKey(current.name, current.params);
  if (top && top.index === index && pageKey(top.name, top.params) === key) {
    // Same logical page re-firing (param tweak, re-render) — refresh params only.
    entries[entries.length - 1] = { name: current.name, params: current.params, index };
    return;
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

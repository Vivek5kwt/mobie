// Mirrors appmobidrag/builder/src/utils/imageAspect.ts — canonical image
// Ratio/Scale math for every block whose Builder Inspector uses
// components/ImageFields.tsx for "Product Image" settings. React Native's
// `aspectRatio` style is a plain number (width / height), not a CSS
// "W / H" string, so this exposes the same named-ratio table as numbers.
//
// "Auto" has no single universal aspect ratio — pass the same `autoAspect`
// value the Builder-side block uses for it. Every *named* ratio
// (1:1 / 2:3 / 3:4 / 4:5) is fixed and must mean the same shape everywhere.
const NAMED_RATIO_NUMBER = {
  "1:1": 1,
  "2:3": 2 / 3,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
};

export function aspectRatioFor(ratio, autoAspect = 16 / 5) {
  const key = String(ratio ?? "").trim().toLowerCase();
  if (!key || key === "auto") return autoAspect;
  const named = NAMED_RATIO_NUMBER[key];
  if (named) return named;
  const parts = key.split(":");
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w / h;
  }
  return autoAspect;
}

export function resizeModeFor(scale) {
  const key = String(scale ?? "").trim().toLowerCase();
  return key === "fill" || key === "cover" ? "cover" : "contain";
}

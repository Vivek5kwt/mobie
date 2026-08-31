import { useEffect, useState } from "react";
import {
  getBrandColorsSync,
  getPageBgColorSync,
  subscribeBrandColors,
} from "../services/brandKitService";

/**
 * Live view of the merchant's Brand Kit colour palette (Builder > Brand Kit >
 * Colors). Re-renders the caller when the palette lands or changes — the DSL
 * fetch that populates it can finish after a screen has already mounted.
 *
 * @returns {object|null} the raw colours object ({ pageBg, toastBg, ... }) or null
 */
export function useBrandColors() {
  const [colors, setColors] = useState(getBrandColorsSync);
  useEffect(() => subscribeBrandColors(() => setColors(getBrandColorsSync())), []);
  return colors || null;
}

/**
 * The Brand Kit "Page Background" colour, or the supplied fallback when the
 * merchant never set one (so untouched apps look exactly as before).
 *
 * @param {string} fallback colour to use when pageBg is unset
 */
export function usePageBgColor(fallback = "#FFFFFF") {
  const [pageBg, setPageBg] = useState(() => getPageBgColorSync());
  useEffect(() => subscribeBrandColors(() => setPageBg(getPageBgColorSync())), []);
  return pageBg || fallback;
}

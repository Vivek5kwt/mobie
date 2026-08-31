import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import { resolveAppId } from "../utils/appId";

let _brandAssets = null;
let _brandAssetsAppId = null;
let _brandAssetsFromGenerated = false;
let _inflight = null;

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unwrapDeep = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value.map((item) => unwrapDeep(item));
  if (!isObject(value)) return value;
  if (value.value !== undefined) return unwrapDeep(value.value, fallback);
  if (value.const !== undefined) return unwrapDeep(value.const, fallback);
  if (value.properties !== undefined) return unwrapDeep(value.properties, fallback);

  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = unwrapDeep(next);
    return acc;
  }, {});
};

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return value;
  }
};

const cleanString = (value) => {
  const resolved = unwrapDeep(value, "");
  if (resolved === undefined || resolved === null) return "";
  return String(resolved).trim();
};

const normalizeBoolean = (value, fallback = undefined) => {
  const resolved = unwrapDeep(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof resolved === "number") return resolved !== 0;
  return fallback;
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const resolved = cleanString(value);
    if (resolved) return resolved;
  }
  return "";
};

const normalizeBrandAssets = (candidate) => {
  const source = unwrapDeep(candidate, {});
  if (!isObject(source)) return null;

  const assets = {
    logoUrl: firstNonEmpty(source.logoUrl, source.logo, source.appLogo, source.appIcon),
    faviconUrl: firstNonEmpty(source.faviconUrl, source.favicon, source.iconUrl),
    splashImageUrl: firstNonEmpty(source.splashImageUrl, source.splashImage, source.splashUrl),
    splashBgColor: firstNonEmpty(source.splashBgColor, source.backgroundColor, source.bgColor),
    splashGradStart: firstNonEmpty(source.splashGradStart, source.gradientStart),
    splashGradEnd: firstNonEmpty(source.splashGradEnd, source.gradientEnd),
    splashShowBrandIcon: normalizeBoolean(source.splashShowBrandIcon, undefined),
  };

  return Object.values(assets).some((value) => value !== "" && value !== undefined)
    ? assets
    : null;
};

const loadGeneratedBrandAssets = () => {
  try {
    const generated = require("../generated/brandAssets.json");
    const assets = normalizeBrandAssets(generated);
    if (!assets) return null;

    const appId = Number(cleanString(generated?.appId));
    return {
      assets,
      appId: Number.isFinite(appId) ? appId : null,
    };
  } catch (_) {
    return null;
  }
};

const generatedBrandAssets = loadGeneratedBrandAssets();
if (generatedBrandAssets?.assets) {
  _brandAssets = generatedBrandAssets.assets;
  _brandAssetsAppId = generatedBrandAssets.appId;
  _brandAssetsFromGenerated = true;
}

const mergeAssets = (base, next) => {
  if (!next) return base;
  const merged = { ...(base || {}) };
  Object.entries(next).forEach(([key, value]) => {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = value;
    }
  });
  return merged;
};

// `_brandKitAssets` is a stale build-time snapshot that sometimes gets echoed back
// inside the live DSL. It must never be treated as a source of truth for brand
// assets (e.g. it commonly carries an empty splashImageUrl) — only `brand_assets`
// / `brandAssets` (optionally nested under `brandKit`) are authoritative.
const SKIP_BRAND_KEYS = new Set(["_brandKitAssets"]);

const collectBrandCandidates = (node, candidates = [], depth = 0, seen = new Set()) => {
  if (!isObject(node) && !Array.isArray(node)) return candidates;
  if (seen.has(node) || depth > 10) return candidates;
  seen.add(node);

  if (isObject(node)) {
    if (node.brandKit?.brand_assets) candidates.push(node.brandKit.brand_assets);
    if (node.brandKit?.brandAssets) candidates.push(node.brandKit.brandAssets);
    if (node.brand_assets) candidates.push(node.brand_assets);
    if (node.brandAssets) candidates.push(node.brandAssets);
    if (node.logoUrl || node.faviconUrl || node.splashImageUrl) candidates.push(node);

    Object.entries(node).forEach(([key, value]) => {
      if (SKIP_BRAND_KEYS.has(key)) return;
      collectBrandCandidates(value, candidates, depth + 1, seen);
    });
    return candidates;
  }

  node.forEach((value) => collectBrandCandidates(value, candidates, depth + 1, seen));
  return candidates;
};

export const extractBrandKitAssets = (dsl) => {
  const root = unwrapDeep(parseMaybeJson(dsl), {});
  if (!isObject(root)) return null;

  const candidates = collectBrandCandidates(root);
  const assets = candidates.reduce(
    (acc, candidate) => mergeAssets(acc, normalizeBrandAssets(candidate)),
    null
  );

  if (!assets?.logoUrl && !assets?.faviconUrl && !assets?.splashImageUrl) {
    return null;
  }

  return assets;
};

export const setBrandKitAssetsFromDsl = (dsl, appId) => {
  const assets = extractBrandKitAssets(dsl);
  if (!assets) return _brandAssets;
  const sameApp =
    _brandAssetsAppId === null ||
    appId === undefined ||
    appId === null ||
    _brandAssetsAppId === appId;
  _brandAssets = sameApp ? mergeAssets(assets, _brandAssets) : assets;
  _brandAssetsAppId = appId ?? _brandAssetsAppId;
  _brandAssetsFromGenerated = false;
  return _brandAssets;
};

export const getBrandKitAssetsSync = () => _brandAssets;

export const getBrandLogoSync = () =>
  _brandAssets?.logoUrl || _brandAssets?.faviconUrl || null;

export const getSplashImageSync = () =>
  _brandAssets?.splashImageUrl || null;

export const getSplashBackgroundSync = () =>
  _brandAssets?.splashGradStart ||
  _brandAssets?.splashBgColor ||
  _brandAssets?.splashGradEnd ||
  "transparent";

// ── Brand Kit colour palette (page background, toast, header, …) ────────────
// The merchant's Builder > Brand Kit > Colors palette. Previously only the
// toast colours were read, and only when the DSL happened to carry
// `brandKit.colors` at its exact root — which is true for older apps (woweye)
// that embed brandKit inside every layout `dsl`, but NOT for apps whose
// brandKit only arrives via `layoutVersionPage`'s separate `brandKit` field
// or sits nested under a multi-page DSL root. That's why dynamic colours
// "only worked for woweye".
//
// This now:
//   • deep-searches for the colours object in whatever shape the DSL/brandKit
//     arrives (object or JSON string, `brandKit.colors`, top-level `colors`,
//     or a few levels down),
//   • is fed by every dslHandler fetch path,
//   • persists the last-known palette so the first paint doesn't flash white,
//   • emits a change event so already-mounted screens/toasts re-theme.
// An app that set nothing still resolves to null → callers keep their own
// defaults, so untouched apps look exactly as before.
const BRAND_COLORS_EVENT = "mobidrag:brandColorsChanged";
const BRAND_COLORS_STORAGE_KEY = "@mobidrag_brand_colors";
const BRAND_COLOR_HINT_KEYS = ["pageBg", "toastBg", "toastText", "headerBg", "bottomNavBg", "primaryBtn"];

let _brandColors = null;
let _brandColorsAppId = null;

const looksLikeBrandColors = (obj) =>
  isObject(obj) && BRAND_COLOR_HINT_KEYS.some((k) => cleanString(obj[k]));

const findColorsObject = (node, depth = 0, seen = new Set()) => {
  if ((!isObject(node) && !Array.isArray(node)) || depth > 12 || seen.has(node)) return null;
  seen.add(node);
  if (isObject(node)) {
    const candidates = [node.brandKit?.colors, node.brand_kit?.colors, node.colors, node];
    for (const candidate of candidates) {
      if (looksLikeBrandColors(candidate)) return candidate;
    }
  }
  const children = Array.isArray(node) ? node : Object.values(node);
  for (const child of children) {
    const found = findColorsObject(child, depth + 1, seen);
    if (found) return found;
  }
  return null;
};

const normalizeBrandColors = (colors) => {
  const src = unwrapDeep(colors, {});
  if (!isObject(src)) return null;
  const out = {};
  Object.entries(src).forEach(([key, value]) => {
    const v = cleanString(value);
    if (v) out[key] = v;
  });
  return Object.keys(out).length ? out : null;
};

export const extractBrandColors = (...sources) => {
  for (const source of sources) {
    if (source == null) continue;
    const root = unwrapDeep(parseMaybeJson(source), null);
    const colors = normalizeBrandColors(findColorsObject(root));
    if (colors) return colors;
  }
  return null;
};

export const setBrandColorsFromDsl = (dsl, appId, brandKitOverride) => {
  const next = extractBrandColors(brandKitOverride, dsl);
  if (!next) return _brandColors;
  const numericAppId = Number.isFinite(Number(appId)) ? Number(appId) : null;
  const sameApp =
    _brandColorsAppId == null || numericAppId == null || _brandColorsAppId === numericAppId;
  _brandColors = sameApp ? { ...(_brandColors || {}), ...next } : next;
  _brandColorsAppId = numericAppId ?? _brandColorsAppId;
  try {
    AsyncStorage.setItem(
      BRAND_COLORS_STORAGE_KEY,
      JSON.stringify({ appId: _brandColorsAppId, colors: _brandColors })
    );
  } catch (_) {}
  try {
    DeviceEventEmitter.emit(BRAND_COLORS_EVENT, _brandColors);
  } catch (_) {}
  return _brandColors;
};

export const getBrandColorsSync = () => _brandColors;
export const getPageBgColorSync = () => _brandColors?.pageBg || null;
export const subscribeBrandColors = (fn) => {
  const sub = DeviceEventEmitter.addListener(BRAND_COLORS_EVENT, fn);
  return () => sub.remove();
};

// Back-compat: Snackbar and dslHandler still call these.
export const setToastColorsFromDsl = (dsl) => {
  setBrandColorsFromDsl(dsl, _brandColorsAppId);
  return getToastColorsSync();
};

export const getToastColorsSync = () => {
  const bgColor = _brandColors?.toastBg || null;
  const textColor = _brandColors?.toastText || null;
  return bgColor || textColor ? { bgColor, textColor } : null;
};

// Hydrate the last-known palette so the very first paint already uses the
// right page/toast colours instead of flashing the hardcoded white default.
(async () => {
  try {
    const raw = await AsyncStorage.getItem(BRAND_COLORS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!_brandColors && isObject(parsed?.colors)) {
      _brandColors = parsed.colors;
      _brandColorsAppId = Number(parsed.appId) || null;
      try {
        DeviceEventEmitter.emit(BRAND_COLORS_EVENT, _brandColors);
      } catch (_) {}
    }
  } catch (_) {}
})();

export async function fetchBrandKitAssets(appId) {
  const resolvedAppId = resolveAppId(appId);
  const appIdInt = Number.isInteger(resolvedAppId)
    ? resolvedAppId
    : Math.floor(Number(resolvedAppId));

  if (_brandAssets && _brandAssetsAppId === appIdInt && !_brandAssetsFromGenerated) return _brandAssets;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const res = await client.query({
        query: LAYOUT_VERSION_QUERY,
        variables: { appId: appIdInt },
        fetchPolicy: "no-cache",
      });

      const versions = (res?.data?.layouts || [])
        .flatMap((layout) => layout?.layout_versions || [])
        .sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0));

      for (const version of versions) {
        const assets = extractBrandKitAssets(version?.dsl);
        if (assets) {
          _brandAssets = assets;
          _brandAssetsAppId = appIdInt;
          _brandAssetsFromGenerated = false;
          return _brandAssets;
        }
      }

      return _brandAssets;
    } catch (error) {
      console.warn("Unable to load brand kit assets from DSL:", error?.message || error);
      return _brandAssets;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

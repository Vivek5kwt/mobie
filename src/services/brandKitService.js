import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import { resolveAppId } from "../utils/appId";

let _brandAssets = null;
let _brandAssetsAppId = null;
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

const collectBrandCandidates = (node, candidates = [], depth = 0, seen = new Set()) => {
  if (!isObject(node) && !Array.isArray(node)) return candidates;
  if (seen.has(node) || depth > 10) return candidates;
  seen.add(node);

  if (isObject(node)) {
    if (node.brandKit?.brand_assets) candidates.push(node.brandKit.brand_assets);
    if (node.brandKit?.brandAssets) candidates.push(node.brandKit.brandAssets);
    if (node.brand_assets) candidates.push(node.brand_assets);
    if (node.brandAssets) candidates.push(node.brandAssets);
    if (node._brandKitAssets) candidates.push(node._brandKitAssets);
    if (node.logoUrl || node.faviconUrl || node.splashImageUrl) candidates.push(node);
  }

  const values = Array.isArray(node) ? node : Object.values(node);
  values.forEach((value) => collectBrandCandidates(value, candidates, depth + 1, seen));
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
  return _brandAssets;
};

export const getBrandKitAssetsSync = () => _brandAssets;

export const getBrandLogoSync = () =>
  _brandAssets?.logoUrl || _brandAssets?.faviconUrl || null;

export const getSplashImageSync = () =>
  _brandAssets?.splashImageUrl || null;

export async function fetchBrandKitAssets(appId) {
  const resolvedAppId = resolveAppId(appId);
  const appIdInt = Number.isInteger(resolvedAppId)
    ? resolvedAppId
    : Math.floor(Number(resolvedAppId));

  if (_brandAssets && _brandAssetsAppId === appIdInt) return _brandAssets;
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

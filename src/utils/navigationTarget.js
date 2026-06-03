import { Linking } from "react-native";

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const resolved = resolveTargetScalar(value);
    const text = String(resolved ?? "").trim();
    if (text) return text;
  }
  return "";
};

const resolveTargetScalar = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "object") return value;
  const candidates = [
    value.handle,
    value.slug,
    value.pageHandle,
    value.pageSlug,
    value.pageName,
    value.name,
    value.title,
    value.id,
    value.value,
    value.const,
  ];
  for (const candidate of candidates) {
    const resolved = resolveTargetScalar(candidate);
    if (String(resolved ?? "").trim()) return resolved;
  }
  return "";
};

export const normalizePageSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isHttpUrl = (value = "") => /^https?:\/\//i.test(String(value || "").trim());

export const normalizeExternalUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const stripQuery = (value = "") => String(value || "").split(/[?#]/)[0].trim();

const pathParts = (value = "") =>
  stripQuery(value)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

const pagePathPrefixes = new Set([
  "page",
  "pages",
  "screen",
  "screens",
  "custom-page",
  "custom-pages",
  "custompage",
  "custompages",
]);

const titleize = (value = "", fallback = "Page") => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) return fallback;
  return spaced.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const extractDslPageTarget = (value = "") => {
  const raw = stripQuery(value);
  if (!raw || isHttpUrl(raw)) return raw;

  const parts = pathParts(raw);
  if (parts.length > 1 && pagePathPrefixes.has(normalizePageSlug(parts[0]))) {
    return parts[parts.length - 1];
  }

  return raw.replace(/^\/+/, "");
};

const extractHandleFromPath = (value = "", expectedPrefix) => {
  const parts = pathParts(value);
  if (parts.length >= 2 && normalizePageSlug(parts[0]) === expectedPrefix) {
    return parts[1];
  }
  return "";
};

const nativeScreenMap = {
  layoutscreen: "LayoutScreen",
  layout: "LayoutScreen",
  home: "LayoutScreen",
  allproducts: "AllProducts",
  "all-products": "AllProducts",
  shop: "AllProducts",
  settings: "Settings",
  setting: "Settings",
};

const signinSlugs = new Set(["signin", "sign-in", "login", "log-in", "auth"]);
const profileSlugs = new Set(["profile", "account", "my-account", "myaccount"]);
const orderSlugs = new Set(["orders", "order", "my-orders", "myorders", "order-history", "orderhistory", "my-order"]);
const wishlistSlugs = new Set(["wishlist", "my-wishlist", "mywishlist", "saved", "favorites", "favourites", "favourite", "favorite"]);

export const resolveDslNavigationTarget = ({
  target,
  link,
  href,
  url,
  linkTo,
  navigateRef,
  navigateType,
  id,
  label,
  title,
  fallbackTitle = "Page",
} = {}) => {
  const navTypeSlug = normalizePageSlug(navigateType);
  const rawTarget = firstNonEmpty(navigateRef, target, linkTo, link, href, url, id, label, title);
  const displayTitle = firstNonEmpty(label, title, rawTarget, fallbackTitle);

  if (!rawTarget && navTypeSlug !== "allproducts" && navTypeSlug !== "all-products") {
    return null;
  }

  if (rawTarget === "__BACK__" || navTypeSlug === "previousscreen" || navTypeSlug === "back") {
    return { type: "back" };
  }

  const externalCandidate = firstNonEmpty(url, href, link, linkTo, navigateRef, target);
  if (navTypeSlug === "url" || isHttpUrl(rawTarget) || isHttpUrl(externalCandidate)) {
    return {
      type: "external",
      url: normalizeExternalUrl(navTypeSlug === "url" ? rawTarget : externalCandidate),
      title: displayTitle,
    };
  }

  const collectionHandle =
    extractHandleFromPath(rawTarget, "collections") ||
    extractHandleFromPath(externalCandidate, "collections");
  if (navTypeSlug === "collection" || navTypeSlug === "collections" || collectionHandle) {
    return collectionHandle || rawTarget
      ? {
          type: "stack",
          name: "CollectionProducts",
          params: { handle: collectionHandle || rawTarget },
        }
      : { type: "stack", name: "AllProducts", params: { title: displayTitle } };
  }

  const productHandle =
    extractHandleFromPath(rawTarget, "products") ||
    extractHandleFromPath(externalCandidate, "products");
  if (navTypeSlug === "product" || navTypeSlug === "products" || productHandle) {
    return productHandle || rawTarget
      ? {
          type: "stack",
          name: "ProductDetail",
          params: { handle: productHandle || rawTarget },
        }
      : { type: "stack", name: "AllProducts", params: { title: displayTitle } };
  }

  const rawPath = stripQuery(rawTarget).replace(/\\/g, "/").trim().toLowerCase();
  if (
    navTypeSlug === "allproducts" ||
    navTypeSlug === "all-products" ||
    navTypeSlug === "all-products-screen" ||
    rawPath === "/products" ||
    rawPath === "/collections"
  ) {
    return { type: "stack", name: "AllProducts", params: { title: displayTitle } };
  }

  const pageTarget = extractDslPageTarget(rawTarget);
  const pageSlug = normalizePageSlug(pageTarget);
  if (!pageSlug) return null;

  if (signinSlugs.has(pageSlug)) {
    return { type: "stack", name: "Auth", params: { initialMode: "login" } };
  }

  if (pageSlug === "home" || pageSlug === "index") {
    return { type: "stack", name: "LayoutScreen", params: { pageName: "home" } };
  }

  const nativeScreen = nativeScreenMap[pageSlug];
  if (nativeScreen && navTypeSlug === "native-screen") {
    return { type: "stack", name: nativeScreen, params: { title: displayTitle, pageName: pageSlug } };
  }

  if (nativeScreen === "Settings") {
    return { type: "stack", name: "Settings", params: { title: displayTitle || "Settings", pageName: "settings" } };
  }

  const resolvedPageName =
    profileSlugs.has(pageSlug) ? "my-account" :
    orderSlugs.has(pageSlug) ? "orders" :
    wishlistSlugs.has(pageSlug) ? "wishlist" :
    pageTarget;

  const resolvedTitle =
    profileSlugs.has(pageSlug) ? "My Account" :
    orderSlugs.has(pageSlug) ? (displayTitle || "Orders") :
    wishlistSlugs.has(pageSlug) ? (displayTitle || "Wishlist") :
    displayTitle || titleize(pageTarget, fallbackTitle);

  return {
    type: "stack",
    name: "BottomNavScreen",
    params: {
      title: resolvedTitle,
      pageName: resolvedPageName,
      link: resolvedPageName,
    },
  };
};

export const navigateToDslTarget = async (navigation, options = {}) => {
  const resolved = resolveDslNavigationTarget(options);
  if (!resolved || !navigation?.navigate) return false;

  if (resolved.type === "back") {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate("LayoutScreen", { pageName: "home" });
    return true;
  }

  if (resolved.type === "external") {
    const url = normalizeExternalUrl(resolved.url);
    if (!url) return false;
    try {
      navigation.navigate("CheckoutWebView", { url, title: resolved.title || options.fallbackTitle || "Page" });
      return true;
    } catch (_) {
      await Linking.openURL(url);
      return true;
    }
  }

  if (resolved.type !== "stack" || !resolved.name) return false;

  const params = {
    ...(resolved.params || {}),
    ...(options.extraParams || {}),
  };

  if (options.preferPush && typeof navigation.push === "function") {
    navigation.push(resolved.name, params);
  } else {
    navigation.navigate(resolved.name, params);
  }

  return true;
};

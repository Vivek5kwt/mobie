import { getFirebaseAnalytics } from "../utils/firebaseAnalytics";
import { resolveAppId } from "../utils/appId";
import { getStoreConfigSync } from "./storeService";

const MAX_EVENT_NAME_LENGTH = 40;
const MAX_PARAM_KEY_LENGTH = 40;
const MAX_STRING_PARAM_LENGTH = 100;

const toStringValue = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const toNumberValue = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEventName = (name = "") => {
  const normalized = toStringValue(name)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, MAX_EVENT_NAME_LENGTH);
  return /^[a-z]/.test(normalized) ? normalized : `event_${normalized || "activity"}`;
};

const normalizeParamKey = (key = "") => {
  const normalized = toStringValue(key)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, MAX_PARAM_KEY_LENGTH);
  return /^[a-z]/.test(normalized) ? normalized : `param_${normalized || "value"}`;
};

const normalizeParamValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  return text.slice(0, MAX_STRING_PARAM_LENGTH);
};

const sanitizeParams = (params = {}) =>
  Object.entries(params || {}).reduce((acc, [key, value]) => {
    if (key === "items" && Array.isArray(value)) {
      acc.items = value.map(normalizeAnalyticsItem).filter(Boolean).slice(0, 100);
      return acc;
    }
    const normalizedValue = normalizeParamValue(value);
    if (normalizedValue !== undefined) {
      acc[normalizeParamKey(key)] = normalizedValue;
    }
    return acc;
  }, {});

const getSessionUser = (session) => session?.user || session || {};

const getBaseParams = (session) => {
  const user = getSessionUser(session);
  const store = getStoreConfigSync?.() || {};
  const appId = resolveAppId(user?.appId ?? user?.app_id ?? store?.app_id);
  const storeId = user?.storeId ?? user?.store_id ?? store?.id ?? store?.store_id ?? "";

  return {
    app_id: appId || "",
    store_id: storeId || "",
    user_type: user?.userType || user?.user_type || "",
    shopify_domain: user?.shopifyDomain || user?.shopify_domain || store?.shopify_domain || "",
    store_currency: user?.currency || store?.currency || "",
  };
};

export const normalizeAnalyticsItem = (item = {}) => {
  if (!item || typeof item !== "object") return null;
  const itemId = toStringValue(
    item.item_id ||
      item.id ||
      item.variantId ||
      item.variant_id ||
      item.adminGraphqlApiId ||
      item.graphqlId ||
      item.handle ||
      item.productHandle
  );
  const itemName = toStringValue(item.item_name || item.title || item.name || item.titleText, "Product");

  return sanitizeParams({
    item_id: itemId || itemName,
    item_name: itemName,
    item_brand: item.vendor || item.vendorText || item.shop || "",
    item_variant: item.variant || item.variantTitle || "",
    item_category: item.collection || item.collectionTitle || "",
    price: toNumberValue(item.price ?? item.priceAmount ?? item.salePrice, 0),
    quantity: toNumberValue(item.quantity ?? item.qty, 1),
  });
};

export const resolveAnalyticsValue = (items = []) =>
  (Array.isArray(items) ? items : []).reduce(
    (total, item) =>
      total +
      toNumberValue(item?.price ?? item?.priceAmount ?? item?.salePrice, 0) *
        toNumberValue(item?.quantity ?? item?.qty, 1),
    0
  );

export const resolveAnalyticsCurrency = (items = [], fallback = "") => {
  const found = (Array.isArray(items) ? items : [])
    .map((item) => item?.currency || item?.priceCurrency || item?.currencyCode || item?.priceAmount?.currencyCode)
    .map((value) => toStringValue(value).toUpperCase())
    .find((value) => /^[A-Z]{3}$/.test(value));
  return found || toStringValue(fallback).toUpperCase();
};

export async function setAnalyticsUser(session) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) return false;

  try {
    const user = getSessionUser(session);
    const store = getStoreConfigSync?.() || {};
    const appId = resolveAppId(user?.appId ?? user?.app_id ?? store?.app_id);
    const userId = toStringValue(user?.id || user?.shopifyCustomerId || user?.email);

    if (analytics().setAnalyticsCollectionEnabled) {
      await analytics().setAnalyticsCollectionEnabled(true);
    }
    if (analytics().setUserId) {
      await analytics().setUserId(userId || null);
    }
    if (analytics().setUserProperties) {
      await analytics().setUserProperties(
        sanitizeParams({
          app_id: appId || "",
          store_id: user?.storeId ?? user?.store_id ?? store?.id ?? "",
          user_type: user?.userType || user?.user_type || "",
          shopify_domain: user?.shopifyDomain || user?.shopify_domain || store?.shopify_domain || "",
        })
      );
    }
    return true;
  } catch (error) {
    console.log("Analytics user setup failed:", error?.message || String(error));
    return false;
  }
}

export async function trackAnalyticsEvent(name, params = {}, options = {}) {
  const analytics = getFirebaseAnalytics();
  if (!analytics) return false;

  try {
    const eventName = normalizeEventName(name);
    const eventParams = sanitizeParams({
      ...getBaseParams(options?.session),
      ...params,
    });
    await analytics().logEvent(eventName, eventParams);
    return true;
  } catch (error) {
    console.log("Analytics event failed:", error?.message || String(error), name);
    return false;
  }
}

export const trackAppOpen = (session) => trackAnalyticsEvent("app_open", {}, { session });

export const trackScreenView = async (screenName, params = {}, options = {}) => {
  const analytics = getFirebaseAnalytics();
  const name = toStringValue(screenName, "unknown");

  try {
    if (analytics?.()?.logScreenView) {
      if (analytics().setDefaultEventParameters) {
        await analytics().setDefaultEventParameters(
          sanitizeParams({
            ...getBaseParams(options?.session),
            ...params,
          })
        );
      }
      await analytics().logScreenView({
        screen_name: name,
        screen_class: name,
      });
      return true;
    }
  } catch (error) {
    console.log("Analytics screen view failed:", error?.message || String(error));
  }

  return trackAnalyticsEvent("screen_view", {
    screen_name: name,
    screen_class: name,
    ...params,
  }, options);
};

export const trackViewItem = (product = {}, options = {}) =>
  trackAnalyticsEvent("view_item", {
    currency: resolveAnalyticsCurrency([product], product?.currency),
    value: toNumberValue(product?.price ?? product?.priceAmount ?? product?.salePrice, 0),
    items: [product],
  }, options);

export const trackAddToCart = (item = {}, options = {}) =>
  trackAnalyticsEvent("add_to_cart", {
    currency: resolveAnalyticsCurrency([item], item?.currency),
    value: resolveAnalyticsValue([item]),
    items: [item],
  }, options);

export const trackRemoveFromCart = (item = {}, options = {}) =>
  trackAnalyticsEvent("remove_from_cart", {
    currency: resolveAnalyticsCurrency([item], item?.currency),
    value: resolveAnalyticsValue([item]),
    items: [item],
  }, options);

export const trackWishlistChange = (item = {}, added = true, options = {}) =>
  trackAnalyticsEvent(added ? "add_to_wishlist" : "remove_from_wishlist", {
    currency: resolveAnalyticsCurrency([item], item?.currency),
    value: resolveAnalyticsValue([item]),
    items: [item],
  }, options);

export const trackBeginCheckout = (items = [], params = {}, options = {}) =>
  trackAnalyticsEvent("begin_checkout", {
    currency: resolveAnalyticsCurrency(items, params?.currency),
    value: resolveAnalyticsValue(items),
    items,
    ...params,
  }, options);

export const trackPurchase = (order = {}, items = [], options = {}) =>
  trackAnalyticsEvent("purchase", {
    transaction_id: order?.orderNumber || order?.name || order?.id || "",
    currency: order?.currencyCode || resolveAnalyticsCurrency(items, order?.currencySymbol),
    value: toNumberValue(order?.total ?? order?.subtotal ?? resolveAnalyticsValue(items), 0),
    tax: toNumberValue(order?.tax, 0),
    shipping: toNumberValue(order?.delivery ?? order?.shipping, 0),
    items: items?.length ? items : order?.lineItems || [],
  }, options);

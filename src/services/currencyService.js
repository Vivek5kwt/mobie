import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../apollo/client";
import GET_SHOPIFY_CURRENCIES from "../graphql/queries/getShopifyCurrenciesQuery";
import { fetchStoreConfig } from "./storeService";

const SELECTED_CURRENCY_PREFIX = "@mobidrag_selected_currency";

const stripShopDomain = (value = "") =>
  String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .trim()
    .toLowerCase();

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const parseMaybeJson = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("[") && !trimmed.startsWith("{"))) return value;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return value;
  }
};

export const normalizeCurrencyCode = (value = "") =>
  String(value || "").trim().toUpperCase();

export const normalizeCurrencyEntry = (entry) => {
  const parsed = parseMaybeJson(entry);
  if (typeof parsed === "string") {
    const code = normalizeCurrencyCode(parsed);
    return code ? { currency: code, code, label: code } : null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const code = normalizeCurrencyCode(
    parsed.currency || parsed.code || parsed.currencyCode || parsed.isoCode || parsed.symbol || parsed.label
  );
  const label = firstNonEmpty(parsed.label, parsed.name, parsed.currencyName, code);
  if (!code && !label) return null;

  return {
    ...parsed,
    code: code || label,
    currency: code || label,
    label,
  };
};

export const normalizeCurrencyList = (currencies) => {
  const parsed = parseMaybeJson(currencies);
  const isSingleCurrency =
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    ["currency", "code", "currencyCode", "isoCode"].some((key) => parsed[key]);
  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed.split(",").map((item) => item.trim()).filter(Boolean)
      : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed?.currencies)
          ? parsed.currencies
          : isSingleCurrency
            ? [parsed]
            : parsed && typeof parsed === "object"
              ? Object.entries(parsed).map(([code, value]) => (
                value && typeof value === "object"
                  ? { code, ...value }
                  : { code, label: value || code }
              ))
              : [];

  const seen = new Set();
  return list
    .map(normalizeCurrencyEntry)
    .filter(Boolean)
    .filter((entry) => {
      const key = normalizeCurrencyCode(entry.currency || entry.code || entry.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const resolveStore = async (store) => store || await fetchStoreConfig();

export async function fetchShopifyCurrencies({ session, store } = {}) {
  const resolvedStore = await resolveStore(store);
  const user = session?.user || {};

  const shop = stripShopDomain(
    firstNonEmpty(
      user.shopifyDomain,
      user.shopify_domain,
      resolvedStore?.shopifyDomain,
      resolvedStore?.shopify_domain,
      resolvedStore?.shop
    )
  );
  const accessToken = firstNonEmpty(
    user.storeAccessToken,
    user.accessToken,
    user.access_token,
    resolvedStore?.storeAccessToken,
    resolvedStore?.accessToken,
    resolvedStore?.access_token
  );

  if (!shop) {
    throw new Error("Shop domain missing.");
  }
  if (!accessToken) {
    throw new Error("Store access token missing.");
  }

  const { data, errors } = await client.query({
    query: GET_SHOPIFY_CURRENCIES,
    variables: { shop, accessToken },
    fetchPolicy: "network-only",
    errorPolicy: "all",
  });

  if (errors?.length) {
    throw errors[0];
  }

  const result = data?.getShopifyCurrencies;
  if (!result?.success) {
    throw new Error("Currency API did not return a successful response.");
  }

  return normalizeCurrencyList(result?.currencies);
}

const selectedCurrencyKey = ({ session, store } = {}) => {
  const user = session?.user || {};
  const storeId = firstNonEmpty(user.storeId, user.store_id, store?.id, store?.store_id, "store");
  const appId = firstNonEmpty(user.appId, user.app_id, store?.app_id, "app");
  const userId = firstNonEmpty(user.id, user.userId, user.email, "guest");
  return `${SELECTED_CURRENCY_PREFIX}:${appId}:${storeId}:${userId}`;
};

export async function loadSelectedCurrency({ session, store } = {}) {
  const value = await AsyncStorage.getItem(selectedCurrencyKey({ session, store }));
  return normalizeCurrencyCode(value);
}

export async function saveSelectedCurrency({ session, store, currency } = {}) {
  const code = normalizeCurrencyCode(currency);
  if (!code) return "";
  await AsyncStorage.setItem(selectedCurrencyKey({ session, store }), code);
  return code;
}

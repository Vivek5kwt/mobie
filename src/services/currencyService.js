import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "../apollo/client";
import GET_SHOPIFY_CURRENCIES from "../graphql/queries/getShopifyCurrenciesQuery";
import { fetchStoreConfig } from "./storeService";
import { getCurrencyMeta } from "../utils/currencyMeta";
import { currencySymbolForCode } from "../utils/money";

const SELECTED_CURRENCY_PREFIX = "@mobidrag_selected_currency";
const EXCHANGE_RATES_CACHE_KEY = "@mobidrag_currency_rates";

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

// Old currency_switcher blocks stored each option's "currency" as a display
// label like "Dollar - $" (see appmobidrag/builder/src/blocks/liveRegistry.ts's
// currency_switcher defaultProps) instead of a real ISO code. A label like
// that must never be treated as-is: passed straight to price formatting it
// prints verbatim as the price prefix (e.g. "DOLLAR - $73.67" on every
// product). Map the known legacy names back to their ISO code so old saved
// DSL props / persisted selections self-heal instead of leaking through.
const LEGACY_CURRENCY_LABELS = {
  DOLLAR: "USD",
  RUPEE: "INR",
  POUND: "GBP",
  EURO: "EUR",
  YEN: "JPY",
};

export const normalizeCurrencyCode = (value = "") => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  const firstWord = raw.split(/[\s-]/)[0];
  if (LEGACY_CURRENCY_LABELS[firstWord]) return LEGACY_CURRENCY_LABELS[firstWord];
  const match = raw.match(/\b[A-Z]{3}\b/);
  return match ? match[0] : "";
};

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

// The Shopify Admin token is resolved server-side by getShopifyCurrencies's
// resolver now (see appmobidrag/server/graphql/resolvers.js) — it's no
// longer fetched to, or held on, the device at all, so only `shop` is
// actually required here. `accessToken` is kept in the returned shape only
// because fetchShopifyCurrencies below still passes it as a query variable
// for backward compatibility with any stale deployed backend; the current
// resolver ignores it.
const resolveShopCredentials = async (session, store) => {
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

  return shop ? { shop } : null;
};

// store/session can still be mid-flight the first time this runs (e.g. a
// screen mounts before StoreContext's own fetchStoreConfig() call resolves)
// — retry a few times instead of throwing on the very first empty read, so
// a slow load doesn't permanently collapse the caller's currency list down
// to its static DSL fallback.
const waitForShopCredentials = async (session, store, maxAttempts = 8, delayMs = 300) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const creds = await resolveShopCredentials(session, store);
    if (creds) return creds;
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
};

export async function fetchShopifyCurrencies({ session, store } = {}) {
  const creds = await waitForShopCredentials(session, store);
  if (!creds) {
    throw new Error("Shop domain missing.");
  }
  const { shop } = creds;

  const { data, errors } = await client.query({
    query: GET_SHOPIFY_CURRENCIES,
    variables: { shop },
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

  // Prefer the store's actual configured Shopify Markets (real countries the
  // merchant has added) over the generic currency-code list — mirrors
  // appmobidrag/builder/src/blocks/currencySwitcher/Preview.tsx exactly, so
  // the APK doesn't show currencies/countries the store never enabled.
  const markets = Array.isArray(result?.markets) ? result.markets : [];
  if (markets.length > 0) {
    const seen = new Set();
    const mapped = [];
    for (const market of markets) {
      const code = normalizeCurrencyCode(market?.currencyCode);
      if (!code) continue;
      const key = `${code}_${market?.countryCode || market?.countryName || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const countryCode = String(market?.countryCode || "").toLowerCase();
      const meta = getCurrencyMeta(code, countryCode);
      // `currency` must stay the ISO code — CurrencySwitcher.js's
      // currencyValue() reads it to match the selection and to persist/set
      // the active currency for rate lookups (formatMoney/convertPrice key
      // rates by ISO code, not by symbol). `symbol` is added purely for
      // display, matching Builder's own render (blocks/currencySwitcher/
      // Preview.tsx), which shows ".symbol" next to the country name
      // ("India - ₹"), not the bare code.
      mapped.push({
        ...meta,
        currency: code,
        symbol: currencySymbolForCode(code) || code,
        label: market?.countryName || meta.country,
        country: market?.countryName || meta.country,
        countryCode: countryCode || meta.countryCode,
        flag: countryCode ? `https://flagcdn.com/w40/${countryCode}.png` : meta.flag,
        primary: !!market?.primary,
      });
    }
    mapped.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
    if (mapped.length > 0) return mapped;
  }

  // No Markets configured — fall back to the store's generic currency-code
  // list, same as blocks/currencySwitcher/Preview.tsx's own else-branch. That
  // branch still enriches every code through getCurrencyMeta() for a
  // country name + flag; this used to return normalizeCurrencyList()'s bare
  // {code, currency, label} entries with neither, which is why the switcher
  // showed a plain currency code with no flag/country here but a full
  // "India - ₹" row in Builder for the exact same store.
  const parsedCurrencies = normalizeCurrencyList(result?.currencies);
  const storeCurrencyCode = normalizeCurrencyCode(store?.currency);
  const seenCodes = new Set();
  const enriched = [];
  const withSymbol = (code) => ({
    ...getCurrencyMeta(code),
    currency: code,
    symbol: currencySymbolForCode(code) || code,
  });
  if (storeCurrencyCode) {
    seenCodes.add(storeCurrencyCode);
    enriched.push(withSymbol(storeCurrencyCode));
  }
  for (const entry of parsedCurrencies) {
    const code = normalizeCurrencyCode(entry.currency || entry.code || entry.label);
    if (!code || seenCodes.has(code)) continue;
    seenCodes.add(code);
    enriched.push(withSymbol(code));
  }
  return enriched;
}

// USD-relative exchange rates for converting product prices to the selected
// currency — same public endpoint and shape Builder's currency switcher
// uses, cached in AsyncStorage so a network blip doesn't blank out prices.
export async function fetchExchangeRates() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await response.json();
    const rates = data?.rates && typeof data.rates === "object" ? data.rates : null;
    if (rates) {
      await AsyncStorage.setItem(EXCHANGE_RATES_CACHE_KEY, JSON.stringify(rates));
      return rates;
    }
  } catch (_) {
    // fall through to cache
  }
  try {
    const cached = await AsyncStorage.getItem(EXCHANGE_RATES_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}
  return {};
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

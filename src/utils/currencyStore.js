// Shared pub-sub store for the selected currency + USD exchange rates, so any
// screen/component (Currency Switcher, Product Grid, Product Carousel, ...)
// stays in sync without prop drilling — mirrors the established
// sortFilterStore.js / wishlistStore.js convention (DeviceEventEmitter +
// AsyncStorage) used elsewhere in this app.
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatMoney, parseMoneyAmount } from "./money";

const EVENT = "mobidrag:currencyChanged";
const STORAGE_KEY = "@mobidrag_active_currency";

let snapshot = { code: "", rates: {} };
let hydrated = false;

// Old currency_switcher blocks stored each option's "currency" as a display
// label like "Dollar - $" instead of a real ISO code (see
// appmobidrag/builder/src/blocks/liveRegistry.ts's currency_switcher
// defaultProps). If a label like that ever made it into a saved selection or
// into this store's AsyncStorage snapshot, treating it as-is as the ISO code
// prints it verbatim as the price prefix on every product (e.g.
// "DOLLAR - $73.67"). Resolve it back to a real code, or drop it.
const LEGACY_CURRENCY_LABELS = {
  DOLLAR: "USD",
  RUPEE: "INR",
  POUND: "GBP",
  EURO: "EUR",
  YEN: "JPY",
};

function sanitizeCode(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  const firstWord = raw.split(/[\s-]/)[0];
  if (LEGACY_CURRENCY_LABELS[firstWord]) return LEGACY_CURRENCY_LABELS[firstWord];
  const match = raw.match(/\b[A-Z]{3}\b/);
  return match ? match[0] : "";
}

export function getCurrencySnapshot() {
  return snapshot;
}

export function subscribeCurrency(fn) {
  const sub = DeviceEventEmitter.addListener(EVENT, fn);
  return () => sub.remove();
}

export async function hydrateCurrencyFromStorage() {
  if (hydrated) return snapshot;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      snapshot = {
        code: sanitizeCode(parsed?.code),
        rates: parsed?.rates && typeof parsed.rates === "object" ? parsed.rates : {},
      };
    }
  } catch (_) {
    // ignore — keep default snapshot
  }
  return snapshot;
}

// `code` is the newly selected currency; `rates` (optional) refreshes the
// USD-relative rate table at the same time (Currency Switcher fetches these
// alongside the market/currency list).
export async function setActiveCurrency({ code, rates } = {}) {
  snapshot = {
    code: sanitizeCode(code) || snapshot.code,
    rates: rates && typeof rates === "object" ? rates : snapshot.rates,
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {
    // ignore — in-memory snapshot still updates for this session
  }
  DeviceEventEmitter.emit(EVENT, snapshot);
}

// Rates are stored relative to USD (rates.GBP = 0.79 means 1 USD = 0.79 GBP),
// matching open.er-api.com's shape — same convention Builder's CurrencyContext uses.
export function convertPrice(amount, fromCurrencyCode) {
  const numeric = parseMoneyAmount(amount) ?? 0;
  const toCode = snapshot.code;
  const fromCode = String(fromCurrencyCode || toCode || "USD").toUpperCase();
  if (!toCode || fromCode === toCode) return numeric;

  const rates = snapshot.rates || {};
  if (!rates || Object.keys(rates).length === 0) return numeric;

  const fromRate = rates[fromCode] ?? 1;
  const toRate = rates[toCode] ?? 1;
  if (!fromRate) return numeric;
  return (numeric / fromRate) * toRate;
}

export function formatPrice(amount, fromCurrencyCode) {
  const converted = convertPrice(amount, fromCurrencyCode);
  const targetCode = snapshot.code || fromCurrencyCode || "USD";
  return formatMoney(converted, targetCode);
}

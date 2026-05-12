const CURRENCY_SYMBOLS = {
  USD: "$",
  INR: "\u20b9",
  GBP: "\u00a3",
  EUR: "\u20ac",
  CAD: "CA$",
  AUD: "A$",
  JPY: "\u00a5",
  CNY: "\u00a5",
  SGD: "S$",
  AED: "\u062f.\u0625",
};

const CURRENCY_ALIASES = {
  RS: "INR",
  "RS.": "INR",
  RUPEE: "INR",
  RUPEES: "INR",
  "\u20b9": "INR",
};

const CURRENCY_LOCALES = {
  INR: "en-IN",
  GBP: "en-GB",
  EUR: "en-DE",
  JPY: "ja-JP",
  CNY: "zh-CN",
  AED: "ar-AE",
};

const toCleanString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/\s+/g, " ");
};

export const currencyCodeFrom = (value) => {
  const label = toCleanString(value);
  if (!label) return "";
  const upper = label.toUpperCase();
  if (CURRENCY_ALIASES[upper]) return CURRENCY_ALIASES[upper];
  if (/^[A-Z]{3}$/.test(upper)) return upper;
  return "";
};

export const currencySymbolForCode = (code = "") => {
  const upper = toCleanString(code).toUpperCase();
  return CURRENCY_SYMBOLS[upper] || "";
};

export const normalizeCurrencyLabel = (value, fallback = "") => {
  const label = toCleanString(value || fallback);
  if (!label) return "";
  const code = currencyCodeFrom(label);
  if (code) return currencySymbolForCode(code) || `${code} `;
  return label;
};

const parseMoneyAmount = (amount) => {
  if (typeof amount === "number") return Number.isFinite(amount) ? amount : null;
  const text = toCleanString(amount);
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatNumber = (amount, minimumFractionDigits, maximumFractionDigits, locale) => {
  try {
    return amount.toLocaleString(locale || "en-IN", {
      minimumFractionDigits,
      maximumFractionDigits,
    });
  } catch (_) {
    return amount.toFixed(minimumFractionDigits);
  }
};

export const formatMoney = (amount, currency, options = {}) => {
  if (amount === undefined || amount === null || amount === "") return "";

  const minimumFractionDigits = options.minimumFractionDigits ?? 2;
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const code = currencyCodeFrom(currency);
  const locale = options.locale || CURRENCY_LOCALES[code] || "en-IN";
  const numeric = parseMoneyAmount(amount);

  if (numeric === null) {
    const label = normalizeCurrencyLabel(currency);
    const text = toCleanString(amount);
    return label ? `${label}${text}` : text;
  }

  if (code && typeof Intl !== "undefined" && Intl.NumberFormat) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        currencyDisplay: "symbol",
        minimumFractionDigits,
        maximumFractionDigits,
      }).format(numeric);
    } catch (_) {}
  }

  const label = normalizeCurrencyLabel(currency);
  const sign = numeric < 0 ? "-" : "";
  return `${sign}${label}${formatNumber(
    Math.abs(numeric),
    minimumFractionDigits,
    maximumFractionDigits,
    locale
  )}`;
};

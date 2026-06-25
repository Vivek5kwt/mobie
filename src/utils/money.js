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
  if (upper.includes("\u20b9") || /\bINR\b/.test(upper) || /\bRS\.?\b/.test(upper) || /\bRUPEES?\b/.test(upper)) {
    return "INR";
  }
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

export const parseMoneyAmount = (amount) => {
  if (amount && typeof amount === "object") {
    return parseMoneyAmount(amount.amount ?? amount.value ?? amount.price ?? amount.priceAmount);
  }
  if (typeof amount === "number") return Number.isFinite(amount) ? amount : null;
  const text = toCleanString(amount);
  if (!text) return null;
  const match = text.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
};

const currencyLabelFromAmount = (amount) => {
  const text = toCleanString(amount);
  if (!text) return "";
  const match = text.match(/^\s*-?\s*([A-Za-z]{2,4}\.?|[^\d.,\s-]+)\s*/);
  const label = toCleanString(match?.[1]);
  if (!label) return "";
  const code = currencyCodeFrom(label);
  return code ? currencySymbolForCode(code) || `${code} ` : label;
};

const normalizeFractionDigits = (minimumFractionDigits, maximumFractionDigits) => {
  const min = Math.max(0, Number(minimumFractionDigits) || 0);
  const max = Math.max(min, Number(maximumFractionDigits) || 0);
  return { min, max };
};

const fixedWithOptionalDecimals = (amount, minimumFractionDigits, maximumFractionDigits) => {
  const { min, max } = normalizeFractionDigits(minimumFractionDigits, maximumFractionDigits);
  let text = amount.toFixed(max);
  if (max > min && text.includes(".")) {
    while (text.endsWith("0") && text.split(".")[1].length > min) {
      text = text.slice(0, -1);
    }
    if (text.endsWith(".")) text = text.slice(0, -1);
  }
  return text;
};

const formatIndianNumber = (amount, minimumFractionDigits, maximumFractionDigits) => {
  const text = fixedWithOptionalDecimals(amount, minimumFractionDigits, maximumFractionDigits);
  const [integerPart, decimalPart] = text.split(".");
  if (integerPart.length <= 3) return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;

  const lastThree = integerPart.slice(-3);
  const leading = integerPart.slice(0, -3);
  const groupedLeading = leading.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  const grouped = `${groupedLeading},${lastThree}`;
  return decimalPart ? `${grouped}.${decimalPart}` : grouped;
};

const formatNumber = (amount, minimumFractionDigits, maximumFractionDigits, locale) => {
  if ((locale || "").toLowerCase() === "en-in") {
    return formatIndianNumber(amount, minimumFractionDigits, maximumFractionDigits);
  }

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

  const code = currencyCodeFrom(currency) || currencyCodeFrom(amount);
  const isIndianRupee = code === "INR";
  const locale = options.locale || CURRENCY_LOCALES[code] || "en-IN";
  const numeric = parseMoneyAmount(amount);
  const minimumFractionDigits =
    options.minimumFractionDigits ??
    (isIndianRupee && numeric !== null && Number.isInteger(numeric) ? 0 : 2);
  const maximumFractionDigits = options.maximumFractionDigits ?? 2;
  const normalizedCurrencyLabel = normalizeCurrencyLabel(currency);
  const inferredAmountLabel = currencyLabelFromAmount(amount);
  const label =
    normalizedCurrencyLabel ||
    (code ? currencySymbolForCode(code) || `${code} ` : inferredAmountLabel);

  if (numeric === null) {
    const text = toCleanString(amount);
    if (!label || text.startsWith(label)) return text;
    return `${label}${text}`;
  }

  if (isIndianRupee) {
    const sign = numeric < 0 ? "-" : "";
    return `${sign}${label}${formatIndianNumber(
      Math.abs(numeric),
      minimumFractionDigits,
      maximumFractionDigits
    )}`;
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

  const sign = numeric < 0 ? "-" : "";
  return `${sign}${label}${formatNumber(
    Math.abs(numeric),
    minimumFractionDigits,
    maximumFractionDigits,
    locale
  )}`;
};

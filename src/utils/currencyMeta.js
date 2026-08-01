// Mirrors appmobidrag/builder/src/utils/currencyMeta.ts (country name / flag
// lookup by currency code) so the Currency Switcher's market list looks the
// same in the APK as it does in Builder.
const CURRENCY_NAMES = {
  USD: "United States", EUR: "Europe", GBP: "United Kingdom", INR: "India",
  JPY: "Japan", CNY: "China", KRW: "South Korea", RUB: "Russia",
  AUD: "Australia", CAD: "Canada", SGD: "Singapore", HKD: "Hong Kong",
  NZD: "New Zealand", CHF: "Switzerland", SEK: "Sweden", NOK: "Norway",
  DKK: "Denmark", PLN: "Poland", CZK: "Czech Republic", HUF: "Hungary",
  TRY: "Turkey", THB: "Thailand", MYR: "Malaysia", IDR: "Indonesia",
  PHP: "Philippines", VND: "Vietnam", AED: "United Arab Emirates",
  SAR: "Saudi Arabia", QAR: "Qatar", KWD: "Kuwait", BHD: "Bahrain",
  OMR: "Oman", ZAR: "South Africa", MXN: "Mexico", BRL: "Brazil",
  ARS: "Argentina", CLP: "Chile", COP: "Colombia", PEN: "Peru",
  PKR: "Pakistan", BDT: "Bangladesh", LKR: "Sri Lanka", NPR: "Nepal",
  UAH: "Ukraine", ILS: "Israel", EGP: "Egypt", NGN: "Nigeria", KES: "Kenya",
};

const CURRENCY_COUNTRY = {
  USD: "us", EUR: "eu", GBP: "gb", INR: "in", JPY: "jp", CNY: "cn", KRW: "kr",
  RUB: "ru", AUD: "au", CAD: "ca", SGD: "sg", HKD: "hk", NZD: "nz", CHF: "ch",
  SEK: "se", NOK: "no", DKK: "dk", PLN: "pl", CZK: "cz", HUF: "hu", TRY: "tr",
  THB: "th", MYR: "my", IDR: "id", PHP: "ph", VND: "vn", AED: "ae", SAR: "sa",
  QAR: "qa", KWD: "kw", BHD: "bh", OMR: "om", ZAR: "za", MXN: "mx", BRL: "br",
  ARS: "ar", CLP: "cl", COP: "co", PEN: "pe", PKR: "pk", BDT: "bd", LKR: "lk",
  NPR: "np", UAH: "ua", ILS: "il", EGP: "eg", NGN: "ng", KES: "ke", TWD: "tw",
  MAD: "ma", DZD: "dz", TND: "tn", IQD: "iq", IRR: "ir", GEL: "ge", AZN: "az",
  BYN: "by", RON: "ro", BGN: "bg", HRK: "hr", RSD: "rs", ISK: "is", UZS: "uz",
  KZT: "kz", MNT: "mn", ETB: "et", GHS: "gh", TZS: "tz", UGX: "ug", XOF: "sn",
  XAF: "cm",
};

export function getCurrencyMeta(code, countryCode) {
  const normalized = String(code || "").trim().toUpperCase() || "USD";
  const cc = String(countryCode || CURRENCY_COUNTRY[normalized] || "us").trim().toLowerCase();
  return {
    code: normalized,
    country: CURRENCY_NAMES[normalized] || normalized,
    countryCode: cc.toUpperCase(),
    flag: `https://flagcdn.com/w40/${cc || "us"}.png`,
  };
}

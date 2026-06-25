import { parseMoneyAmount } from "./money";

export const normalizeDiscountCode = (code = "") =>
  String(code || "").trim().toUpperCase();

export const normalizeDiscountCodes = (codes = []) => {
  const seen = new Set();
  return (codes || [])
    .map((entry) =>
      normalizeDiscountCode(
        typeof entry === "string" ? entry : entry?.code ?? entry?.discountCode
      )
    )
    .filter((code) => {
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .slice(0, 250);
};

const toNumber = (value, fallback = 0) => {
  const parsed = parseMoneyAmount(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const lineKey = (item = {}) => {
  const rawId = String(item?.variantId || item?.id || "").trim();
  const quantity = Math.max(1, Number(item?.quantity ?? item?.qty) || 1);
  const price = Math.max(0, toNumber(item?.price ?? item?.priceAmount, 0)).toFixed(2);
  return rawId ? `${rawId}:${quantity}:${price}` : "";
};

export const cartDiscountFingerprint = (items = []) =>
  (items || [])
    .map(lineKey)
    .filter(Boolean)
    .sort()
    .join("|");

export const normalizeDiscountRecord = (entry = {}) => {
  if (typeof entry === "string") {
    return {
      code: normalizeDiscountCode(entry),
      applicable: false,
      amount: 0,
      currencyCode: "",
      cartFingerprint: "",
      legacy: true,
    };
  }

  const code = normalizeDiscountCode(entry?.code ?? entry?.discountCode);
  return {
    ...entry,
    code,
    applicable: entry?.applicable === true,
    amount: Math.max(0, toNumber(entry?.amount ?? entry?.discountAmount, 0)),
    currencyCode: String(entry?.currencyCode ?? entry?.currency ?? "").trim(),
    cartFingerprint: String(entry?.cartFingerprint || ""),
  };
};

export const normalizeDiscountRecords = (entries = []) =>
  (entries || [])
    .map(normalizeDiscountRecord)
    .filter((entry) => entry.code);

export const discountAppliesToCart = (entry, cartFingerprint) => {
  const normalized = normalizeDiscountRecord(entry);
  return (
    normalized.applicable === true &&
    normalized.cartFingerprint &&
    normalized.cartFingerprint === cartFingerprint
  );
};

export const activeDiscountRecords = (entries = [], cartFingerprint = "") =>
  normalizeDiscountRecords(entries).filter((entry) =>
    discountAppliesToCart(entry, cartFingerprint)
  );

export const activeDiscountCodes = (entries = [], cartFingerprint = "") =>
  activeDiscountRecords(entries, cartFingerprint).map((entry) => entry.code);

export const totalDiscountAmount = (entries = [], cartFingerprint = "") =>
  activeDiscountRecords(entries, cartFingerprint).reduce(
    (sum, entry) => sum + Math.max(0, toNumber(entry.amount, 0)),
    0
  );

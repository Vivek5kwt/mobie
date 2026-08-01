import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Icon6 from "react-native-vector-icons/FontAwesome6";
import FA6GlyphMap from "react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import { useSelector } from "react-redux";
import { resolveFont } from "../services/typographyService";
import { parseMoneyAmount } from "../utils/money";
import {
  formatPrice as formatCurrencyPrice,
  hydrateCurrencyFromStorage,
  subscribeCurrency,
} from "../utils/currencyStore";
import {
  activeDiscountRecords,
  cartDiscountFingerprint,
  totalDiscountAmount as sumActiveDiscountAmount,
} from "../utils/cartDiscounts";
import { resolveProductImageResizeMode } from "../utils/productImageFit";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback = 0) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  const parsed = parseMoneyAmount(resolved);
  return parsed === null ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

const isDisplayNone = (value) =>
  toString(value, "").trim().toLowerCase() === "none";

const toFontWeight = (value, fallback = "400") => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved) return fallback;
  const w = String(resolved).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium") return "500";
  if (w === "regular" || w === "normal") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

const CUSTOM_ICON_PREFIX = "custom-icon::";
const getCustomIconUrlFromValue = (value) => {
  const raw = String(value || "");
  if (!raw.startsWith(CUSTOM_ICON_PREFIX)) return null;
  const encoded = raw.slice(CUSTOM_ICON_PREFIX.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

const normalizeIconId = (value) => {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  const withoutStyle = trimmed.replace(/^fa-(solid|regular|light|brands|brand|thin|duotone|sharp)\s+/, "");
  return withoutStyle.replace(/^fa-/, "");
};

const toAlign = (value, fallback) => {
  const v = String(unwrapValue(value, "") || "").trim().toLowerCase();
  if (v === "left" || v === "center" || v === "right") return v;
  return fallback;
};

const borderWidthFromLine = (value, fallback = 0) => {
  const line = toString(value, "").trim().toLowerCase();
  if (!line) return fallback;
  if (line === "none" || line === "hidden" || line === "0") return 0;
  const parsed = parseFloat(line);
  return Number.isFinite(parsed) ? parsed : 1;
};

const normalizeCurrencyLabel = (value, fallback = "") => {
  const label = toString(value, fallback).trim();
  if (!label) return "";
  return /^[A-Za-z0-9]{2,}$/.test(label) ? `${label} ` : label;
};

const resolveCurrencyLabel = (...values) => {
  for (const value of values) {
    const label = normalizeCurrencyLabel(value);
    if (label) return label;
  }
  return "";
};

const firstDefined = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") return value;
  }
  return undefined;
};

const fmt = (amount, currency) =>
  formatCurrencyPrice(Math.abs(amount), currency);

const resolveLinePrice = (item = {}) => {
  const candidates = [
    item?.price,
    item?.priceAmount,
    item?.salePrice,
    item?.standardPrice,
    item?.amount,
  ];

  for (const candidate of candidates) {
    const amount =
      candidate && typeof candidate === "object"
        ? candidate.amount ?? candidate.value ?? candidate.price
        : candidate;
    const parsed = toNumber(amount, NaN);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }

  return 0;
};

const resolveLineTax = (item = {}) => {
  const lineCandidates = [
    item?.taxAmount,
    item?.salesTax,
    item?.lineTax,
    item?.totalTax,
    item?.estimatedTax,
  ];

  for (const candidate of lineCandidates) {
    const parsed = toNumber(
      candidate && typeof candidate === "object"
        ? candidate.amount ?? candidate.value
        : candidate,
      NaN
    );
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }

  if (Array.isArray(item?.taxLines)) {
    return item.taxLines.reduce((sum, line) => {
      const amount = line?.price?.amount ?? line?.amount ?? line?.value;
      return sum + Math.max(0, toNumber(amount, 0));
    }, 0);
  }

  const unitTax = firstDefined(item?.unitTax, item?.taxPerItem, item?.perItemTax);
  if (unitTax !== undefined) {
    return Math.max(0, toNumber(unitTax, 0) * toNumber(item?.qty ?? item?.quantity, 1));
  }

  return 0;
};

export default function OrderSummary({ section }) {
  // Currency Switcher writes here; re-render totals when the shopper
  // changes the selected currency (matches Builder's OrderSummary block).
  const [, setCurrencyVersion] = useState(0);
  useEffect(() => {
    let mounted = true;
    const bump = () => {
      if (mounted) setCurrencyVersion((v) => v + 1);
    };
    hydrateCurrencyFromStorage().then(bump);
    const unsub = subscribeCurrency(bump);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, {}) || propsNode || {};
  const presentationCss =
    unwrapValue(propsNode?.presentation?.properties?.css?.value, undefined) ||
    unwrapValue(propsNode?.presentation?.css?.value, undefined) ||
    unwrapValue(propsNode?.presentation?.properties?.css, undefined) ||
    unwrapValue(propsNode?.presentation?.css, {}) ||
    {};
  const layoutCss =
    unwrapValue(propsNode?.layout?.properties?.css?.value, undefined) ||
    unwrapValue(propsNode?.layout?.css?.value, undefined) ||
    unwrapValue(propsNode?.layout?.properties?.css, undefined) ||
    unwrapValue(propsNode?.layout?.css, {}) ||
    {};
  const visibility = {
    ...(unwrapValue(raw?.visibility, {}) || {}),
    ...(unwrapValue(presentationCss?.visibility, {}) || {}),
    ...(unwrapValue(layoutCss?.visibility, {}) || {}),
  };

  // Redux
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const discountRecords = useSelector((state) => state?.cart?.discounts || []);

  // DSL items (post-purchase / injected items override Redux cart)
  const dslItems = Array.isArray(raw?.items) ? raw.items : [];
  const allowDslItemsFallback = toBoolean(
    raw?.useDslItemsFallback ?? raw?.allowDslItemsFallback ?? raw?.showSampleItems,
    false
  );
  const usesDslItems = cartItems.length === 0 && allowDslItemsFallback && dslItems.length > 0;

  // Source items — DSL fallback is only for empty cart/sample states.
  const sourceItems = usesDslItems ? dslItems : cartItems;

  // Price Line's single "Background and Padding" Inspector section styles the
  // WHOLE block as one card (matching PriceLinePreviewLive.tsx's single outer
  // div, gated by the same `backgroundPaddingActive` toggle) — not a
  // conditionally-shown container. Writes cardBgColor/cardBorderRadius/
  // cardColor(border)/cardSide/cardPt-Pb-Pl-Pr.
  // order_summary's own Inspector (OrderSummary/inspectorLive.tsx) calls this
  // same master toggle `bgPadVisible` rather than price_line's
  // `backgroundPaddingActive` — accept either since this component renders
  // both DSL component types.
  const backgroundPaddingActive = toBoolean(raw?.backgroundPaddingActive ?? raw?.bgPadVisible, true);
  // order_summary's "Pricing & Summary" master toggle — price_line has no
  // equivalent single switch, so this only ever goes false for order_summary.
  const pricingVisible = toBoolean(raw?.pricingVisible, true);
  // `cardColor` is the Inspector's BORDER color field, not a background
  // fallback — using it for cardBgColor would paint the whole card in the
  // border color whenever only the border had been customized.
  const cardBgColor = backgroundPaddingActive
    ? toString(raw?.cardBgColor, "#FFFFFF")
    : "transparent";
  const cardRadius = toNumber(raw?.cardBorderRadius ?? raw?.cardRadius ?? raw?.radius, 12);
  const cardBorderColor = toString(raw?.cardColor ?? raw?.cardBorderColor ?? raw?.borderColor, "#E5E7EB");
  // Preview's own default border side is "all" (a full outline), not "none" —
  // matched here via the fallback width, since RN's flat `borderWidth` style
  // already renders on all sides once non-zero.
  const cardBorderWidth = backgroundPaddingActive ? borderWidthFromLine(
    raw?.cardSide ?? raw?.cardBorderLine ?? raw?.borderLine,
    toNumber(raw?.cardBorderWidth, 1)
  ) : 0;
  const cardPadT = backgroundPaddingActive ? toNumber(raw?.cardPadT ?? raw?.cardPt, 12) : 0;
  const cardPadR = backgroundPaddingActive ? toNumber(raw?.cardPadR ?? raw?.cardPr, 16) : 0;
  const cardPadB = backgroundPaddingActive ? toNumber(raw?.cardPadB ?? raw?.cardPb, 12) : 0;
  const cardPadL = backgroundPaddingActive ? toNumber(raw?.cardPadL ?? raw?.cardPl, 16) : 0;
  // No dedicated Inspector control writes any of these image-background keys
  // today, so this always falls back to cardBgColor — matching the
  // "Background & Padding" section's own color, so any letterbox space
  // around a Fit-scaled image blends with the card instead of a mismatched
  // hardcoded white.
  const imageBgColor = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    cardBgColor
  );

  // DSL item-card sub-sections (Product > Image / Product Name / Variant & Quantity /
  // Price) — the Inspector has always exposed these; RN previously ignored every one
  // of them and rendered a fully hardcoded card (fixed 52x52 image, fixed text
  // styles). Only affects the usesDslItems fallback path (see below).
  const showProductCard = toBoolean(raw?.productVisible, true);
  const showCardImage = toBoolean(raw?.cardImage, true);
  const imageCornerRadius = toNumber(raw?.imageCorner, 8);
  const imageAspectRatio = (() => {
    const parts = toString(raw?.ratio, "1:1").split(":").map((n) => parseFloat(n));
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
    return 1;
  })();
  const itemImageSize = { width: 52, height: 52 / imageAspectRatio };

  const showProductName = toBoolean(raw?.productNameVisible, true);
  const productNameStyle = {
    fontSize: toNumber(raw?.productNameSize, 14),
    fontWeight: toBoolean(raw?.productNameBold, false) ? "700" : toFontWeight(raw?.productNameFontWeight, "600"),
    color: toString(raw?.productNameColor, "#111827"),
    ...(cleanFontFamily(toString(raw?.productNameFontFamily, "")) ? { fontFamily: cleanFontFamily(toString(raw?.productNameFontFamily, "")) } : {}),
  };

  const showVariantQty = toBoolean(raw?.v_QVisible, true);
  const variantQtyStyle = {
    fontSize: toNumber(raw?.v_QSize, 12),
    fontWeight: toFontWeight(raw?.v_QFontWeight, "400"),
    color: toString(raw?.v_QColor, "#6B7280"),
    ...(cleanFontFamily(toString(raw?.v_QFontFamily, "")) ? { fontFamily: cleanFontFamily(toString(raw?.v_QFontFamily, "")) } : {}),
  };

  const showItemPrice = toBoolean(raw?.priceVisible, true);
  const itemPriceStyle = {
    fontSize: toNumber(raw?.priceSize, 14),
    fontWeight: toFontWeight(raw?.priceFontWeight, "600"),
    color: toString(raw?.priceColor, "#111827"),
    ...(cleanFontFamily(toString(raw?.priceFontFamily, "")) ? { fontFamily: cleanFontFamily(toString(raw?.priceFontFamily, "")) } : {}),
  };

  // Cart total from items
  const computedCartTotal = useMemo(
    () =>
      sourceItems.reduce(
        (sum, item) =>
          sum + resolveLinePrice(item) * toNumber(item?.qty ?? item?.quantity, 1),
        0
      ),
    [sourceItems]
  );
  const dslCartTotal = raw?.cartTotal != null ? toNumber(raw?.cartTotal, 0) : null;
  const cartTotal = usesDslItems && dslCartTotal != null ? dslCartTotal : computedCartTotal;
  const cartFingerprint = useMemo(
    () => cartDiscountFingerprint(cartItems),
    [cartItems]
  );
  const activeDiscounts = useMemo(
    () => activeDiscountRecords(discountRecords, cartFingerprint),
    [discountRecords, cartFingerprint]
  );

  // Title — Price Line's Inspector calls this "Headline" and writes headline*
  // keys; other shared contexts (order_summary/cart_summary/cart_total) use
  // title*/heading. Check headline* first without dropping the others.
  const titleText = toString(raw?.headline ?? raw?.title ?? raw?.heading ?? raw?.titleText, "Order Summary");
  const titleDisplayHidden =
    isDisplayNone(presentationCss?.title?.display) ||
    isDisplayNone(layoutCss?.title?.display) ||
    isDisplayNone(presentationCss?.heading?.display) ||
    isDisplayNone(layoutCss?.heading?.display);
  const showTitle = toBoolean(
    visibility?.title ??
      visibility?.heading ??
      visibility?.header ??
      raw?.headlineActive ??
      raw?.titleActive ??
      raw?.titleVisible ??
      raw?.headerVisible ??
      raw?.showHeader ??
      raw?.showTitle ??
      raw?.titleEnabled,
    !titleDisplayHidden
  ) && !titleDisplayHidden;
  const titleColor = toString(raw?.headlineColor ?? raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.headlineSize ?? raw?.titleSize, 22);
  const titleBold = toBoolean(raw?.headlineBold ?? raw?.titleBold, false);
  const titleWeight = titleBold ? "700" : toFontWeight(raw?.headlineFontWeight ?? raw?.titleWeight, "700");
  const titleUnderline = toBoolean(raw?.headlineUnderline ?? raw?.titleUnderline ?? raw?.underline, false);
  const titleStrikethrough = toBoolean(raw?.headlineStrikethrough ?? raw?.titleStrikethrough ?? raw?.strikethrough, false);
  const titleTextDecoration = titleUnderline && titleStrikethrough
    ? "underline line-through"
    : titleUnderline
    ? "underline"
    : titleStrikethrough
    ? "line-through"
    : "none";
  const titleItalic = toBoolean(raw?.headlineItalic ?? raw?.titleItalic, false);
  const titleFontStyle = titleItalic ? "italic" : "normal";
  const titleAlignRaw = toString(raw?.headlineAlign ?? raw?.titleAlign, "left").trim().toLowerCase();
  const titleAlign = titleAlignRaw === "center" ? "center" : titleAlignRaw === "right" ? "right" : "left";

  // Currency
  const currencyLabel = resolveCurrencyLabel(
    sourceItems[0]?.currency,
    sourceItems[0]?.priceCurrency,
    sourceItems[0]?.currencySymbol,
    activeDiscounts[0]?.currencyCode,
    raw?.currency,
    raw?.priceCurrency,
    raw?.currencySymbol,
    raw?.symbol
  );

  // Row label style
  const rowLabelColor = toString(raw?.rowLabelColor ?? raw?.labelColor ?? raw?.textColor, "#111827");
  const rowLabelSize = toNumber(raw?.rowLabelSize ?? raw?.labelSize, 14);
  const rowValueSize = toNumber(raw?.rowValueSize ?? raw?.valueSize, 14);

  // Cart total row
  const showCartTotal = toBoolean(raw?.cartTotalActive ?? raw?.showCartTotal, true);
  const cartTotalLabel = toString(raw?.cartTotalText ?? raw?.cartTotalLabel, usesDslItems ? "Subtotal" : "Cart Total");
  const showCartTotalRow = showCartTotal && cartTotalLabel.trim().toLowerCase() !== "total";
  const cartTotalLabelSize = toNumber(raw?.cartTotalFontSize ?? raw?.cartTotalSize, rowLabelSize);
  const cartTotalValueSize = toNumber(raw?.cartTotalPriceFontSize ?? raw?.cartTotalValueSize, rowValueSize);
  const cartTotalLabelColor = toString(raw?.cartTotalColor, rowLabelColor);
  const cartTotalColor = toString(raw?.cartTotalPriceColor ?? raw?.cartTotalColor, "#111827");
  const cartTotalBold = toBoolean(raw?.cartTotalBold, false);
  const cartTotalPriceBold = toBoolean(raw?.cartTotalPriceBold, cartTotalBold);
  const cartTotalWeight = cartTotalBold ? "700" : toFontWeight(raw?.cartTotalFontWeight ?? raw?.cartTotalWeight, "700");
  const cartTotalValueWeight = cartTotalPriceBold ? "700" : toFontWeight(raw?.cartTotalPriceFontWeight, cartTotalWeight);
  const cartTotalLabelAlign = toAlign(raw?.cartTotalAlign, "left");
  const cartTotalValueAlign = toAlign(raw?.cartTotalPriceAlign, "right");

  // Savings row
  const dslSavings = raw?.savings != null ? toNumber(raw?.savings, 0) : null;
  const showSavings = toBoolean(raw?.showSavings ?? raw?.savingsActive, usesDslItems && dslSavings != null);
  const savingsLabel = toString(raw?.savingsText ?? raw?.savingsLabel, "Your Savings");
  const savingsLabelColor = toString(raw?.savingsColor, rowLabelColor);
  const savingsColor = toString(raw?.savingsPriceColor ?? raw?.savingsColor, "#EF4444");
  const savingsLabelSize = toNumber(raw?.savingsFontSize, rowLabelSize);
  const savingsValueSize = toNumber(raw?.savingsPriceFontSize, rowValueSize);
  const savingsLabelAlign = toAlign(raw?.savingsAlign, "left");
  const savingsValueAlign = toAlign(raw?.savingsPriceAlign, "right");
  const savingsLabelFontFamily = cleanFontFamily(toString(raw?.savingsFontFamily, ""));
  const savingsValueFontFamily = cleanFontFamily(toString(raw?.savingsPriceFontFamily, ""));
  const savingsLabelBold = toBoolean(raw?.savingsBold, false);
  const savingsValueBold = toBoolean(raw?.savingsPriceBold, savingsLabelBold);
  const savingsLabelWeight = savingsLabelBold ? "700" : toFontWeight(raw?.savingsFontWeight, "400");
  const savingsValueWeight = savingsValueBold ? "700" : toFontWeight(raw?.savingsPriceFontWeight, "400");
  // Fixed amount OR percentage of cart total
  const savingsAmount = !showSavings
    ? 0
    : usesDslItems && dslSavings != null
    ? dslSavings
    : raw?.savingsAmount != null
    ? toNumber(raw.savingsAmount, 0)
    : (toNumber(raw?.savingsPercent, 0) / 100) * cartTotal;

  // Discount row (applied codes)
  const showDiscount = toBoolean(raw?.discountsActive ?? raw?.showDiscount ?? raw?.discountActive, !usesDslItems);
  const discountLabel = toString(raw?.discountsText ?? raw?.discountLabel, "Discount");
  const discountLabelSize = toNumber(raw?.discountsFontSize ?? raw?.discountFontSize, rowLabelSize);
  const discountValueSize = toNumber(raw?.discountPriceSize ?? raw?.discountValueSize, rowValueSize);
  const discountLabelColor = toString(raw?.discountsColor, rowLabelColor);
  const discountLabelBold = toBoolean(raw?.discountsBold, false);
  const discountValueBold = toBoolean(raw?.discountPriceBold, discountLabelBold);
  const discountLabelWeight = discountLabelBold ? "700" : toFontWeight(raw?.discountsFontWeight, "400");
  const discountValueWeight = discountValueBold ? "700" : toFontWeight(raw?.discountPriceFontWeight, "400");
  const discountColor = toString(raw?.discountPriceColor ?? raw?.discountColor, "#EF4444");
  const discountLabelAlign = toAlign(raw?.discountsAlign, "left");
  const discountValueAlign = toAlign(raw?.discountPriceAlign, "right");
  const discountLabelFontFamily = cleanFontFamily(toString(raw?.discountsFontFamily, ""));
  const discountValueFontFamily = cleanFontFamily(toString(raw?.discountPriceFontFamily, ""));
  const validatedDiscountAmount = sumActiveDiscountAmount(discountRecords, cartFingerprint);
  const totalDiscountAmount = Math.min(cartTotal, validatedDiscountAmount);

  // Chip styling for applied discount codes
  const chipBg = toString(raw?.discountChipBgColor ?? raw?.chipBg ?? raw?.codeBg, "#F9FAFB");
  const chipBorderColor = toString(raw?.discountChipBorderColor ?? raw?.chipBorderColor, "#E5E7EB");
  const chipTextColor = toString(raw?.discountChipColor ?? raw?.chipTextColor, "#374151");
  const chipBorderRadius = toNumber(raw?.discountChipBorderRadius ?? raw?.chipBorderRadius, 6);
  const chipFontSize = toNumber(raw?.discountChipFontSize ?? raw?.chipFontSize, 12);
  const chipBold = toBoolean(raw?.discountChipBold, false);
  const chipFontWeight = chipBold ? "700" : toFontWeight(raw?.discountChipFontWeight ?? raw?.chipFontWeight, "400");
  const chipPadT = toNumber(raw?.discountChipPt ?? raw?.chipPadT, 5);
  const chipPadR = toNumber(raw?.discountChipPr ?? raw?.chipPadR, 10);
  const chipPadB = toNumber(raw?.discountChipPb ?? raw?.chipPadB, 5);
  const chipPadL = toNumber(raw?.discountChipPl ?? raw?.chipPadL, 10);
  const chipBorderLine = toString(raw?.discountChipborderSide ?? raw?.discountChipBorderSide ?? raw?.chipBorderLine, "all");
  const chipIconRaw = toString(raw?.discountChipIcon, "");
  const chipIconUrl = getCustomIconUrlFromValue(chipIconRaw);
  const chipIconNameRaw = normalizeIconId(chipIconRaw);
  const chipIconName = Object.prototype.hasOwnProperty.call(FA6GlyphMap, chipIconNameRaw) ? chipIconNameRaw : "";
  const showChipIcon = !!(chipIconUrl || chipIconName);
  const chipIconSize = toNumber(raw?.discountChipIconSize, 15);
  const chipIconColor = toString(raw?.discountChipIconColor, "#000000");
  const chipIconAlignRight = toString(raw?.discountChipIconAlign, "Right").toLowerCase() === "right";
  const chipBorderWidth = chipBorderLine.trim().toLowerCase() === "none" ? 0 : 1;
  const chipPrefix = toString(raw?.chipPrefix, "Discount - ");
  const showDiscountChips = toBoolean(
    raw?.showDiscountChip ?? raw?.showDiscountBadge ?? raw?.showAppliedDiscountBadge,
    true
  );

  // Tax row — no Inspector control actually sets a tax amount/percentage for
  // this block; the "savings" seed value was previously (wrongly) borrowed as
  // a tax fallback, which showed the exact same fixed number regardless of
  // real cart total. Only genuine, real tax-named fields count now.
  const configuredTaxAmount = firstDefined(
    raw?.taxAmount,
    raw?.salesTax,
    raw?.saleTax,
    raw?.saleAmount,
    raw?.salePrice,
    raw?.sale
  );
  const computedLineTax = sourceItems.reduce((sum, item) => sum + resolveLineTax(item), 0);
  const showTax = toBoolean(
    raw?.showTax ?? raw?.taxActive ?? raw?.saleActive ?? raw?.salePriceActive,
    configuredTaxAmount != null || raw?.taxPercent != null || computedLineTax > 0
  );
  const taxLabel = toString(raw?.taxLabel, "Sales Tax");
  const taxLabelSize = toNumber(raw?.saleSize ?? raw?.taxFontSize, rowLabelSize);
  const taxValueSize = toNumber(raw?.salePriceSize ?? raw?.taxPriceSize, rowValueSize);
  const taxLabelBold = toBoolean(raw?.saleBold, false);
  const taxValueBold = toBoolean(raw?.salePriceBold, taxLabelBold);
  const taxLabelWeight = taxLabelBold ? "700" : toFontWeight(raw?.saleFontWeight ?? raw?.taxFontWeight, "400");
  const taxValueWeight = taxValueBold ? "700" : toFontWeight(raw?.salePriceFontWeight ?? raw?.taxPriceFontWeight, "400");
  const taxLabelColor = toString(raw?.saleColor, rowLabelColor);
  const taxColor = toString(raw?.salePriceColor ?? raw?.saleColor ?? raw?.taxColor, "#EF4444");
  const taxLabelAlign = toAlign(raw?.saleAlign, "left");
  const taxValueAlign = toAlign(raw?.salePriceAlign, "right");
  const taxLabelFontFamily = cleanFontFamily(toString(raw?.saleFontFamily, ""));
  const taxValueFontFamily = cleanFontFamily(toString(raw?.salePriceFontFamily, ""));
  const taxAmount = !showTax
    ? 0
    : computedLineTax > 0
    ? computedLineTax
    : configuredTaxAmount != null
    ? toNumber(configuredTaxAmount, 0)
    : (toNumber(raw?.taxPercent, 0) / 100) * cartTotal;

  // Additional charge row (shipping/handling/custom charges) when configured by DSL.
  const chargeAmountRaw =
    raw?.chargeAmount ??
    raw?.shippingAmount ??
    raw?.shippingCharge ??
    raw?.handlingFee ??
    raw?.additionalCharge;
  const showCharge = toBoolean(
    raw?.showCharge ?? raw?.showShipping ?? raw?.shippingActive ?? raw?.chargeActive,
    chargeAmountRaw != null
  );
  const chargeLabel = toString(
    raw?.chargeLabel ?? raw?.shippingLabel ?? raw?.handlingLabel,
    "Shipping"
  );
  const chargeColor = toString(raw?.chargeColor ?? raw?.shippingColor, rowLabelColor);
  const chargeAmount = showCharge ? Math.max(0, toNumber(chargeAmountRaw, 0)) : 0;

  // Divider
  const showDivider = toBoolean(raw?.showDivider, true);
  const dividerColor = toString(raw?.dividerColor, "#E5E7EB");

  // Font families
  const titleFontFamily = cleanFontFamily(toString(raw?.headlineFontFamily ?? raw?.titleFontFamily ?? raw?.fontFamily, ""));
  const rowFontFamily   = cleanFontFamily(toString(raw?.rowFontFamily   ?? raw?.fontFamily, ""));
  const chipFontFamily  = cleanFontFamily(toString(raw?.chipFontFamily  ?? raw?.fontFamily, ""));
  // Cart Total is the one row type with its own Inspector font-family control
  // (the "Cart Total" section) — falls back to the shared row family, then the
  // block-level family, just like every other row.
  const cartTotalFontFamily = cleanFontFamily(
    toString(raw?.cartTotalFontFamily ?? raw?.rowFontFamily ?? raw?.fontFamily, "")
  );

  // Sub total row
  const showSubTotal = toBoolean(raw?.subtotalActive ?? raw?.showSubTotal ?? raw?.showSubtotal, raw?.subTotal != null || true);
  const subTotalLabel = toString(raw?.subTotalLabel ?? raw?.subtotalLabel ?? raw?.subtotalText, usesDslItems ? "Total" : "Sub Total");
  const subTotalLabelSize = toNumber(raw?.subtotalSize ?? raw?.subTotalFontSize, rowLabelSize);
  const subTotalValueSize = toNumber(raw?.subtotalPriceSize ?? raw?.subTotalPriceSize, rowValueSize);
  const subTotalLabelColor = toString(raw?.subtotalColor, rowLabelColor);
  const subTotalColor = toString(raw?.subtotalPriceColor ?? raw?.subTotalColor, "#EF4444");
  const subTotalBold = toBoolean(raw?.subtotalBold, false);
  const subTotalWeight = subTotalBold ? "700" : toFontWeight(raw?.subtotalFontWeight ?? raw?.subTotalWeight, "700");
  const subTotalValueWeight = toFontWeight(raw?.subtotalPriceFontWeight, subTotalWeight);
  const subTotalLabelAlign = toAlign(raw?.subtotalAlign, "left");
  const subTotalValueAlign = toAlign(raw?.subtotalPriceAlign, "right");
  const subTotalLabelFontFamily = cleanFontFamily(toString(raw?.subtotalFontFamily, "")) || rowFontFamily;
  const subTotalValueFontFamily = cleanFontFamily(toString(raw?.subtotalPriceFontFamily, "")) || rowFontFamily;
  const showOriginalStrike = toBoolean(raw?.showOriginalPrice ?? raw?.showStrike, true);
  const strikeColor = toString(raw?.strikeThroughColor ?? raw?.strikeColor, "#9CA3AF");
  const strikeSize = toNumber(raw?.strikeThroughSize ?? raw?.strikeSize, Math.max(10, subTotalValueSize - 1));
  const strikeWeight = toFontWeight(raw?.strikeThroughFontWeight, "400");
  const strikeFontFamily = cleanFontFamily(toString(raw?.strikeThroughFontFamily, "")) || rowFontFamily;

  // Calculate sub total
  const computedSubTotal = Math.max(0, cartTotal - savingsAmount - totalDiscountAmount + taxAmount + chargeAmount);
  const subTotal = usesDslItems && raw?.subTotal != null ? toNumber(raw?.subTotal, 0) : computedSubTotal;

  const hasReductions = savingsAmount > 0 || totalDiscountAmount > 0;

  if (sourceItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: cardBgColor,
            borderColor: cardBorderColor,
            borderRadius: cardRadius,
            borderWidth: cardBorderWidth,
            paddingTop: cardPadT,
            paddingRight: cardPadR,
            paddingBottom: cardPadB,
            paddingLeft: cardPadL,
          },
        ]}
      >
      {/* Title */}
      {showTitle && !!titleText && (
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: titleSize,
              fontWeight: titleWeight,
              textDecorationLine: titleTextDecoration,
              fontStyle: titleFontStyle,
              textAlign: titleAlign,
              ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* DSL item cards (post-purchase line items) */}
      {usesDslItems && showProductCard && dslItems.map((item, idx) => {
        const itemQty = toNumber(item?.qty ?? item?.quantity, 1);
        const itemPrice = toNumber(item?.price, 0);
        const lineTotal = itemQty * itemPrice;
        const itemCurrency = resolveCurrencyLabel(
          item?.currency,
          item?.priceCurrency,
          item?.currencySymbol,
          currencyLabel
        );
        return (
          <View
            key={item?.id ?? idx}
            style={[
              styles.itemCard,
              {
                backgroundColor: cardBgColor,
                borderRadius: cardRadius,
                borderColor: cardBorderColor,
              },
            ]}
          >
            {/* Product image */}
            {showCardImage && (
              <View style={[styles.itemImageWrap, itemImageSize, { borderRadius: imageCornerRadius, backgroundColor: imageBgColor }]}>
                {item?.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.itemImage}
                    resizeMode={resolveProductImageResizeMode(
                      raw?.imageScale,
                      raw?.scale,
                      raw?.imageResizeMode
                    )}
                  />
                ) : (
                  <View style={[styles.itemImagePlaceholder, { backgroundColor: imageBgColor }]} />
                )}
              </View>
            )}

            {/* Item details */}
            <View style={styles.itemDetails}>
              {showProductName && (
                <Text style={[styles.itemTitle, productNameStyle]} numberOfLines={2}>
                  {toString(item?.title, "Product")}
                </Text>
              )}
              {showVariantQty && (
                <>
                  {!!item?.variant && (
                    <Text style={[styles.itemVariant, variantQtyStyle]}>{item.variant}</Text>
                  )}
                  <Text style={[styles.itemQty, variantQtyStyle]}>Qty {itemQty}</Text>
                </>
              )}
            </View>

            {/* Price */}
            {showItemPrice && (
              <Text style={[styles.itemPrice, itemPriceStyle]}>
                {fmt(lineTotal, itemCurrency)}
              </Text>
            )}
          </View>
        );
      })}

      {pricingVisible && (
      <>
      {/* Cart Total */}
      {showCartTotalRow && (
        <SummaryRow
          label={cartTotalLabel}
          value={fmt(cartTotal, currencyLabel)}
          labelColor={cartTotalLabelColor}
          valueColor={cartTotalColor}
          labelSize={cartTotalLabelSize}
          valueSize={cartTotalValueSize}
          labelWeight={cartTotalWeight}
          valueWeight={cartTotalValueWeight}
          labelAlign={cartTotalLabelAlign}
          valueAlign={cartTotalValueAlign}
          fontFamily={cartTotalFontFamily}
        />
      )}

      {/* Savings */}
      {showSavings && savingsAmount > 0 && (
        <SummaryRow
          label={savingsLabel}
          value={fmt(savingsAmount, currencyLabel)}
          labelColor={savingsLabelColor}
          valueColor={savingsColor}
          labelSize={savingsLabelSize}
          valueSize={savingsValueSize}
          labelWeight={savingsLabelWeight}
          valueWeight={savingsValueWeight}
          labelAlign={savingsLabelAlign}
          valueAlign={savingsValueAlign}
          fontFamily={rowFontFamily}
          labelFontFamily={savingsLabelFontFamily}
          valueFontFamily={savingsValueFontFamily}
        />
      )}

      {/* Discount */}
      {showDiscount && activeDiscounts.length > 0 && (
        <>
          {totalDiscountAmount > 0 && (
            <SummaryRow
              label={discountLabel}
              value={fmt(totalDiscountAmount, currencyLabel)}
              labelColor={discountLabelColor}
              valueColor={discountColor}
              labelSize={discountLabelSize}
              valueSize={discountValueSize}
              labelWeight={discountLabelWeight}
              valueWeight={discountValueWeight}
              labelAlign={discountLabelAlign}
              valueAlign={discountValueAlign}
              fontFamily={rowFontFamily}
              labelFontFamily={discountLabelFontFamily}
              valueFontFamily={discountValueFontFamily}
            />
          )}
          {/* Applied code chips */}
          {showDiscountChips && (
            <View style={styles.chipRow}>
              {activeDiscounts.map((discount) => (
                <View
                  key={discount.code}
                  style={[
                    styles.chip,
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: chipBg,
                      borderColor: chipBorderColor,
                      borderRadius: chipBorderRadius,
                      borderWidth: chipBorderWidth,
                      paddingTop: chipPadT,
                      paddingRight: chipPadR,
                      paddingBottom: chipPadB,
                      paddingLeft: chipPadL,
                    },
                  ]}
                >
                  {showChipIcon && !chipIconAlignRight && (
                    chipIconUrl ? (
                      <Image source={{ uri: chipIconUrl }} style={{ width: chipIconSize, height: chipIconSize, resizeMode: "contain" }} />
                    ) : (
                      <Icon6 name={chipIconName} size={chipIconSize} color={chipIconColor} />
                    )
                  )}
                  <Text style={[styles.chipText, { color: chipTextColor, fontSize: chipFontSize, fontWeight: chipFontWeight, ...(chipFontFamily ? { fontFamily: chipFontFamily } : {}) }]}>
                    {chipPrefix}{discount.code}
                  </Text>
                  {showChipIcon && chipIconAlignRight && (
                    chipIconUrl ? (
                      <Image source={{ uri: chipIconUrl }} style={{ width: chipIconSize, height: chipIconSize, resizeMode: "contain" }} />
                    ) : (
                      <Icon6 name={chipIconName} size={chipIconSize} color={chipIconColor} />
                    )
                  )}
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Tax */}
      {showTax && taxAmount > 0 && (
        <SummaryRow
          label={taxLabel}
          value={fmt(taxAmount, currencyLabel)}
          labelColor={taxLabelColor}
          valueColor={taxColor}
          labelSize={taxLabelSize}
          valueSize={taxValueSize}
          labelWeight={taxLabelWeight}
          valueWeight={taxValueWeight}
          labelAlign={taxLabelAlign}
          valueAlign={taxValueAlign}
          fontFamily={rowFontFamily}
          labelFontFamily={taxLabelFontFamily}
          valueFontFamily={taxValueFontFamily}
        />
      )}

      {/* Additional Charges */}
      {showCharge && chargeAmount > 0 && (
        <SummaryRow
          label={chargeLabel}
          value={fmt(chargeAmount, currencyLabel)}
          labelColor={rowLabelColor}
          valueColor={chargeColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
          fontFamily={rowFontFamily}
        />
      )}

      {/* Divider */}
      {showDivider && (
        <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      )}

      {/* Sub Total */}
      {showSubTotal && (
        <View style={styles.row}>
          <Text
            style={[
              styles.rowLabel,
              { color: subTotalLabelColor, fontSize: subTotalLabelSize, fontWeight: subTotalWeight, textAlign: subTotalLabelAlign, ...(subTotalLabelFontFamily ? { fontFamily: subTotalLabelFontFamily } : {}) },
            ]}
          >
            {subTotalLabel}
          </Text>
          <View
            style={[
              styles.subTotalValues,
              {
                justifyContent:
                  subTotalValueAlign === "center" ? "center" : subTotalValueAlign === "left" ? "flex-start" : "flex-end",
              },
            ]}
          >
            <Text
              style={[
                styles.rowValue,
                { flex: 0, color: subTotalColor, fontSize: subTotalValueSize, fontWeight: subTotalValueWeight, ...(subTotalValueFontFamily ? { fontFamily: subTotalValueFontFamily } : {}) },
              ]}
            >
              {fmt(subTotal, currencyLabel)}
            </Text>
            {showOriginalStrike && hasReductions && (
              <Text
                style={[
                  styles.strikeValue,
                  { color: strikeColor, fontSize: strikeSize, fontWeight: strikeWeight, ...(strikeFontFamily ? { fontFamily: strikeFontFamily } : {}) },
                ]}
              >
                {fmt(cartTotal, currencyLabel)}
              </Text>
            )}
          </View>
        </View>
      )}
      </>
      )}
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  labelColor,
  valueColor,
  labelSize,
  valueSize,
  labelWeight = "400",
  valueWeight = "400",
  labelAlign = "left",
  valueAlign = "right",
  fontFamily,
  labelFontFamily,
  valueFontFamily,
}) {
  const labelFf = labelFontFamily || fontFamily;
  const valueFf = valueFontFamily || fontFamily;
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight, textAlign: labelAlign, ...(labelFf ? { fontFamily: labelFf } : {}) }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: valueColor, fontSize: valueSize, fontWeight: valueWeight, textAlign: valueAlign, ...(valueFf ? { fontFamily: valueFf } : {}) }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  summaryContent: {
    width: "100%",
    gap: 10,
  },
  summaryCard: {
    width: "100%",
    gap: 10,
  },
  title: {
    marginBottom: 4,
  },
  // ── DSL item cards ─────────────────────────────────────────────────────────
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 10,
    gap: 10,
  },
  itemImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemImagePlaceholder: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  itemDetails: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    lineHeight: 20,
  },
  itemVariant: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemQty: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: -2,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: 2,
  },
  subTotalValues: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  strikeValue: {
    textDecorationLine: "line-through",
  },
});

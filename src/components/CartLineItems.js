import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { updateQuantity, removeItem } from "../store/slices/cartSlice";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveFont } from "../services/typographyService";
import { parseMoneyAmount } from "../utils/money";
import {
  formatPrice as formatCurrencyPrice,
  hydrateCurrencyFromStorage,
  subscribeCurrency,
} from "../utils/currencyStore";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { activeDiscountRecords, cartDiscountFingerprint } from "../utils/cartDiscounts";

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

const firstDefined = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") return value;
  }
  return undefined;
};

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

const toTextTransform = (value, fallback = "none") => {
  const normalized = toString(value, fallback).trim().toLowerCase();
  if (normalized === "uppercase" || normalized === "upper") return "uppercase";
  if (normalized === "lowercase" || normalized === "lower") return "lowercase";
  if (normalized === "capitalize" || normalized === "capitalized") return "capitalize";
  return "none";
};

// Builder's BorderLineControl lets merchants pick a single side
// (none/left/right/top/bottom/all), and Preview renders exactly that side —
// RN was collapsing this down to "full 4-side border or none", ignoring
// which specific side was chosen. Computes per-side widths so a single
// selected side renders as only that side, matching Preview.
const borderSideStyle = (line, width) => {
  const w = Math.max(0, toNumber(width, 1));
  switch (String(line || "").toLowerCase()) {
    case "none":
      return { borderWidth: 0 };
    case "top":
      return { borderWidth: 0, borderTopWidth: w, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: 0 };
    case "bottom":
      return { borderWidth: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: w, borderLeftWidth: 0 };
    case "left":
      return { borderWidth: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderLeftWidth: w };
    case "right":
      return { borderWidth: 0, borderTopWidth: 0, borderRightWidth: w, borderBottomWidth: 0, borderLeftWidth: 0 };
    case "all":
    default:
      return { borderWidth: w };
  }
};

const lineHeightFor = (size, ratio = 1.35) => Math.ceil(toNumber(size, 14) * ratio);

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

const fmtPrice = (amount, currency) =>
  formatCurrencyPrice(Math.abs(toNumber(amount, 0)), currency);

const responsiveSize = (screenWidth, ratio, min, max) => {
  const value = Math.round(Math.max(1, screenWidth) * ratio);
  return Math.max(min, Math.min(max, value));
};

export default function CartLineItems({ section }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cartItems = useSelector((state) => state?.cart?.items || []);

  // Currency Switcher writes here; re-render prices when the shopper
  // changes the selected currency.
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
  const appliedDiscounts = useSelector((state) => state?.cart?.discounts || []);

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, null) || propsNode || {};
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
  const dslItems = Array.isArray(raw?.items) ? raw.items : [];
  const allowDslItemsFallback = toBoolean(
    raw?.useDslItemsFallback ?? raw?.allowDslItemsFallback ?? raw?.showSampleItems,
    false
  );
  const usesDslItems = cartItems.length === 0 && allowDslItemsFallback && dslItems.length > 0;
  const sourceItems = cartItems.length > 0 ? cartItems : (usesDslItems ? dslItems : []);

  // Container background — Background3.tsx ("Container Background") owns
  // showBackground/backgroundColor/borderColor/borderLine for the OUTER
  // wrapper; these must not be conflated with the per-card border below.
  const showContainerBackground = toBoolean(raw?.showBackground, true);
  const bgColor = showContainerBackground
    ? toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF")
    : "transparent";
  const emptyBgColor = toString(raw?.emptyBgColor ?? raw?.emptyBackgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 12);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 12);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);
  const containerBorderLine = toString(raw?.borderLine, "all").toLowerCase();
  const containerBorderStyle = !showContainerBackground
    ? { borderWidth: 0 }
    : borderSideStyle(containerBorderLine, 1);
  const containerBorderColor = toString(raw?.borderColor, "#F3F4F6");

  // Card
  // The Inspector never writes `cardBgColor` (Builder's CartItems.tsx has no
  // control for it), so this always falls back to the container's own
  // "Background" color instead of a mismatched hardcoded white.
  const cardBgColor = toString(raw?.cardBgColor, bgColor);
  const cardBorderColor = toString(raw?.cardBorderColor, "#F3F4F6");
  const cardBorderRadius = toNumber(raw?.cardBorderRadius, 12);
  const cardBorderLine = toString(raw?.cardBorderLine, "all").toLowerCase();
  const cardBorderWidth = cardBorderLine === "none" ? 0 : toNumber(raw?.cardBorderWidth, 1);
  const cardGap = toNumber(raw?.cardGap ?? raw?.gap, 12);
  const derivedCardPad = Math.max(0, Math.round(cardBorderRadius * 0.75));
  const cardPadT = toNumber(raw?.cardPadT ?? raw?.cardPt ?? raw?.itemPadT, derivedCardPad);
  const cardPadR = toNumber(raw?.cardPadR ?? raw?.cardPr ?? raw?.itemPadR, derivedCardPad);
  const cardPadB = toNumber(raw?.cardPadB ?? raw?.cardPb ?? raw?.itemPadB, derivedCardPad);
  const cardPadL = toNumber(raw?.cardPadL ?? raw?.cardPl ?? raw?.itemPadL, derivedCardPad);
  const cardInnerGap = toNumber(raw?.cardInnerGap ?? raw?.itemGap, responsiveSize(screenWidth, 0.02, 8, 12));

  // Image
  const showImage = toBoolean(raw?.showImage, true);
  // Preview's own default image box is 96-120px wide (fixed, by imageRatio)
  // — the previous 58-72px default here was roughly half that, making the
  // product thumbnail look noticeably smaller in the APK by default.
  const imageSize = toNumber(
    raw?.imageSize ?? raw?.imageWidth ?? raw?.productImageSize,
    responsiveSize(screenWidth, 0.26, 90, 120)
  );
  const imageRatioRaw = toString(raw?.imageRatio, "Auto");
  // Preview's own default/"Auto" box (96x140) is a tall rectangle, not a
  // square (aspect ≈ 0.686, not 1) — RN previously treated "Auto" as square,
  // giving the thumbnail a different shape than Preview whenever Ratio is
  // left unset (the default state).
  const imageAspect =
    imageRatioRaw === "1:1" ? 1 : imageRatioRaw === "2:3" ? 2 / 3 : imageRatioRaw === "4:5" ? 4 / 5 : 96 / 140;
  const imageHeight = Math.round(imageSize / imageAspect);
  const imageRadius = toNumber(raw?.imageRadius ?? raw?.imageCorner ?? raw?.cardImageCorner, 0);
  // No dedicated Inspector control writes any of these image-background
  // keys today, so this always falls back to bgColor — matching the
  // container "Background" color, so any letterbox space around a
  // Fit-scaled image blends with the card instead of a mismatched
  // hardcoded white.
  const imageBg = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    bgColor
  );

  // Variant row
  const showVariant = toBoolean(raw?.showVariant, true);
  const variantColor = toString(raw?.variantColor, "#0D9488");
  const variantSize = toNumber(raw?.variantSize ?? raw?.variantFontSize, 12);
  const variantWeight = toFontWeight(raw?.variantWeight ?? raw?.variantFontWeight, "400");
  const variantSeparator = toString(raw?.variantSeparator, " | ");

  // Vendor
  const showVendor = toBoolean(raw?.showVendor, true);
  const vendorColor = toString(raw?.vendorColor, "#111827");
  const vendorSize = toNumber(raw?.vendorSize ?? raw?.vendorFontSize, 12);
  const vendorWeight = toFontWeight(raw?.vendorWeight ?? raw?.vendorFontWeight, "600");
  const vendorTextTransform = toTextTransform(raw?.vendorTextTransform ?? raw?.vendorTransform, "none");

  // Title
  const titleVisibilityOverride = firstDefined(
    visibility?.productTitle,
    visibility?.itemTitle,
    visibility?.productName,
    raw?.titleVisible,
    raw?.showTitle,
    raw?.productTitleVisible,
    raw?.itemTitleVisible,
    raw?.showProductTitle,
    raw?.showItemTitle,
    raw?.productNameVisible
  );
  const showTitle =
    titleVisibilityOverride !== undefined
      ? toBoolean(titleVisibilityOverride, true)
      : true;
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize ?? raw?.titleFontSize, 14);
  const titleWeight = toFontWeight(raw?.titleWeight ?? raw?.titleFontWeight, "600");

  // Price
  const showPrice = toBoolean(raw?.showPrice ?? raw?.showStandardPrice, true);
  // Price.tsx's "Standard" sub-panel has its own independent eye
  // (showStandardPrice) distinct from the master showPrice — this was never
  // read separately, so turning off just the Standard price eye (while
  // keeping the master Price eye on) had no effect in the APK.
  const showStandardPrice = toBoolean(raw?.showStandardPrice, true);
  const showTotal = toBoolean(raw?.showTotal ?? raw?.showLineTotal, false);
  const priceColor = toString(raw?.priceColor, "#111827");
  const priceSize = toNumber(raw?.priceSize ?? raw?.priceFontSize, 14);
  const priceWeight = toFontWeight(raw?.priceWeight ?? raw?.priceFontWeight, "700");
  const currencyLabel = resolveCurrencyLabel(
    sourceItems[0]?.currency,
    sourceItems[0]?.priceCurrency,
    sourceItems[0]?.currencySymbol,
    raw?.currency,
    raw?.priceCurrency,
    raw?.currencySymbol,
    raw?.symbol
  );

  // Compare-at (original / strikethrough) price — Price.tsx's "Strikethrough" group
  const showCompareAt = toBoolean(raw?.showStrikePrice ?? raw?.showCompareAt ?? raw?.showOriginalPrice, true);
  const compareAtColor = toString(raw?.strikePriceColor ?? raw?.compareAtColor ?? raw?.strikeColor, "#9CA3AF");
  const compareAtSize = toNumber(raw?.strikePriceFontSize ?? raw?.compareAtSize, 13);
  const compareAtWeight = toFontWeight(raw?.strikePriceFontWeight, "400");
  const compareAtFontFamily = cleanFontFamily(toString(raw?.strikePriceFontFamily, ""));

  // Savings badge
  // Sold Out badge — SoldOutBadge.tsx (text) + Background.tsx (box)
  const showSoldOut = toBoolean(raw?.showSoldOut, true);
  const soldOutShow = toBoolean(raw?.soldOutShow, true);
  const soldOutBackgroundColor = toString(raw?.soldOutBackgroundColor, "#FEE2E2");
  const soldOutBorderColor = toString(raw?.soldOutBorderColor, "#000000");
  const soldOutBorderLine = toString(raw?.soldOutBorderLine, "all").toLowerCase();
  const soldOutFontSize = toNumber(raw?.soldOutFontSize, 12);
  const soldOutFontFamily = cleanFontFamily(toString(raw?.soldOutFontFamily, ""));
  const soldOutFontWeight = toFontWeight(raw?.soldOutFontWeight, "600");
  const soldOutTextTransform = toTextTransform(raw?.soldOutTextTransform, "none");
  const soldOutColor = toString(raw?.soldOutColor, "#B91C1C");
  const soldOutCorners = toNumber(raw?.soldOutCorners, 20);
  const soldOutBoxStyle = soldOutShow
    ? {
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: soldOutBackgroundColor,
        borderRadius: soldOutCorners,
        ...borderSideStyle(soldOutBorderLine, 1),
        borderColor: soldOutBorderColor,
      }
    : { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", borderRadius: 0, borderWidth: 0 };

  const showSavings = toBoolean(raw?.showSavings, true);
  const savingsLabel = toString(raw?.savingsLabel, "Savings");
  // Background2.tsx's ("Saving tag Background") own eye + real keys —
  // previously read raw?.savingsBg/raw?.savingsBorderRadius, neither of
  // which the Inspector ever writes, and showBackground2 wasn't read at
  // all, so the badge chrome was permanently stuck at its hardcoded
  // defaults regardless of the merchant's settings.
  const showBackground2 = toBoolean(raw?.showBackground2, true);
  const savingsBackgroundColor = toString(raw?.savingsBackgroundColor, "#FFFFFF");
  const savingsColor = toString(raw?.savingsColor, "#16A34A");
  const savingsBorderColor = toString(raw?.savingsBorderColor, "#16A34A");
  const savingsBorderLine = toString(raw?.savingsBorderLine, "all").toLowerCase();
  const background2Radius = toNumber(raw?.background2Radius, 20);
  const background2Padding = toNumber(raw?.background2Padding, 10);
  const savingsFontSize = toNumber(raw?.savingsFontSize, 12);
  const savingsFontWeight = toFontWeight(raw?.savingsFontWeight, "600");
  const savingsTextTransform = toTextTransform(raw?.savingsTextTransform, "none");
  const savingsBoxStyle = showBackground2
    ? {
        paddingHorizontal: background2Padding,
        paddingVertical: background2Padding / 2,
        backgroundColor: savingsBackgroundColor,
        borderRadius: background2Radius,
        ...borderSideStyle(savingsBorderLine, 1),
        borderColor: savingsBorderColor,
      }
    : { paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent", borderRadius: 0, borderWidth: 0 };

  // Discounts applied badge — AppliedDiscounts.tsx's Inspector keys
  // (discount*) drive this same real, Redux-backed badge.
  const showDiscountBadge = toBoolean(raw?.showDiscount ?? raw?.showDiscountBadge, true);
  const discountBadgeBg = toString(raw?.discountBadgeBg, "#DBEAFE");
  const discountBadgeColor = toString(raw?.discountColor ?? raw?.discountBadgeColor, "#1D4ED8");
  const discountBadgeRadius = toNumber(raw?.discountCorners ?? raw?.discountBadgeRadius, 20);
  const discountBadgeFontSize = toNumber(raw?.discountFontSize ?? raw?.discountBadgeFontSize, 11);
  const discountBadgeFontWeight = toFontWeight(raw?.discountFontWeight ?? raw?.discountBadgeFontWeight, "700");
  const discountBadgeTextTransform = toTextTransform(raw?.discountTextTransform, "none");
  const discountBadgeFontFamily = cleanFontFamily(toString(raw?.discountFontFamily, ""));
  const discountBadgeSuffix = toString(raw?.discountBadgeSuffix, "DISCOUNTS APPLIED");

  // Quantity controls
  const showQuantityControls = toBoolean(
    visibility?.quantityControls ?? visibility?.quantityPicker ?? raw?.showQuantityControls,
    true
  );
  const qtyBorderColor = toString(raw?.qtyBorderColor, "#E5E7EB");
  const qtyBtnBgColor = toString(raw?.qtyBtnBgColor ?? raw?.quantityButtonBgColor, "#FFFFFF");
  const qtyWrapBgColor = toString(raw?.qtyWrapBgColor ?? raw?.quantityWrapBgColor, "transparent");
  const qtyBtnSize = toNumber(raw?.qtyBtnSize, responsiveSize(screenWidth, 0.06, 22, 28));
  const qtyBtnRadius = toNumber(raw?.qtyBtnRadius, Math.round(qtyBtnSize / 2));
  // Preview has no Inspector control for this at all — the quantity row is
  // unconditionally pinned to the right (justifyContent: "flex-end"). The
  // "left" default here never matched that, making the qty controls sit on
  // the wrong side whenever no explicit qtyAlign value is set (i.e. always).
  const qtyAlignRaw = toString(raw?.qtyAlign ?? raw?.quantityAlign ?? raw?.quantityAlignment, "right").toLowerCase();
  const qtyJustifyContent = qtyAlignRaw === "right" || qtyAlignRaw === "flex-end"
    ? "flex-end"
    : qtyAlignRaw === "center"
      ? "center"
      : "flex-start";

  // Quantity — Text sub-panel
  const showQtyText = toBoolean(raw?.showText, true);
  const qtyTextColor = toString(raw?.qpTextColor ?? raw?.qtyTextColor, "#111827");
  const qtyTextSize = toNumber(raw?.qpTextFontSize ?? raw?.qtyTextSize, 12);
  const qtyTextWeight = toFontWeight(raw?.qpTextFontWeight, "600");
  const qtyTextFontFamily = cleanFontFamily(toString(raw?.qpTextFontFamily ?? raw?.qtyFontFamily, ""));

  // Quantity — Increase / Decrease sub-panels (independent icon/color/size each)
  const showIncrease = toBoolean(raw?.showIncrease, true);
  const increaseIconName = resolveFA4IconName(toString(raw?.qpIncreaseIcon, "")) || "plus";
  const increaseIconColor = toString(raw?.qpIncreaseColor ?? raw?.qtyIconColor, "#111827");
  const increaseIconSize = toNumber(raw?.qpIncreaseSize ?? raw?.qtyIconSize, 10);

  const showDecrease = toBoolean(raw?.showDecrease, true);
  const decreaseIconName = resolveFA4IconName(toString(raw?.qpDecreaseIcon, "")) || "minus";
  const decreaseIconColor = toString(raw?.qpDecreaseColor ?? raw?.qtyIconColor, "#111827");
  const decreaseIconSize = toNumber(raw?.qpDecreaseSize ?? raw?.qtyIconSize, 10);

  // Delete button
  const showDelete = toBoolean(raw?.showDelete ?? raw?.showDeleteButton, true);
  const deleteIconColor = toString(raw?.qpDeleteColor ?? raw?.deleteIconColor, "#9CA3AF");
  const deleteIconSize = toNumber(raw?.qpDeleteSize ?? raw?.deleteIconSize, 14);

  // Item icon (e.g. vendor/profile icon from DSR brandKit — shown top-right of each card)
  // Icon.tsx's real key is "showIcon"; the show* aliases below are legacy/unused.
  const showItemIcon   = toBoolean(raw?.showIcon ?? raw?.showItemIcon ?? raw?.showVendorIcon ?? raw?.showCardIcon, true);
  const rawItemIcon    = toString(
    raw?.itemIcon ?? raw?.itemIconName ?? raw?.vendorIcon ?? raw?.cardIcon ?? raw?.iconName ?? raw?.icon,
    ""
  );
  // Match Preview's own gate exactly: an icon shows only when both the eye is
  // on AND the merchant has actually picked one — no default fallback glyph.
  // A "custom-icon::<url>" value (BrandKit-uploaded icon) never resolves via
  // resolveFA4IconName, so it silently rendered nothing — add the same
  // custom-icon URL fallback used elsewhere in the app (e.g. OrderSummary.js).
  const itemIconUrl     = showItemIcon ? getCustomIconUrlFromValue(rawItemIcon) : null;
  const itemIconName   = showItemIcon && rawItemIcon && !itemIconUrl ? resolveFA4IconName(rawItemIcon) : "";
  const itemIconSize   = toNumber(raw?.itemIconSize ?? raw?.cardIconSize ?? raw?.iconSize, 18);
  const itemIconColor  = toString(raw?.itemIconColor ?? raw?.cardIconColor ?? raw?.iconColor, "#9CA3AF");
  const itemIconBg     = toString(raw?.itemIconBg ?? raw?.cardIconBg ?? raw?.iconBg, "transparent");
  const itemIconRadius = toNumber(raw?.itemIconRadius ?? raw?.cardIconRadius, 20);

  // Divider between items
  const showDivider = toBoolean(raw?.showDivider, false);
  const dividerColor = toString(raw?.dividerColor, "#F3F4F6");

  // Font families
  const titleFontFamily    = cleanFontFamily(toString(raw?.titleFontFamily    ?? raw?.fontFamily, ""));
  const vendorFontFamily   = cleanFontFamily(toString(raw?.vendorFontFamily   ?? raw?.fontFamily, ""));
  const variantFontFamily  = cleanFontFamily(toString(raw?.variantFontFamily  ?? raw?.fontFamily, ""));
  const priceFontFamily    = cleanFontFamily(toString(raw?.priceFontFamily    ?? raw?.fontFamily, ""));
  const savingsFontFamily  = cleanFontFamily(toString(raw?.savingsFontFamily  ?? raw?.fontFamily, ""));
  const titleLineHeight = toNumber(raw?.titleLineHeight, lineHeightFor(titleSize, 1.3));
  const variantLineHeight = toNumber(raw?.variantLineHeight, lineHeightFor(variantSize, 1.35));
  const vendorLineHeight = toNumber(raw?.vendorLineHeight, lineHeightFor(vendorSize, 1.35));
  const priceLineHeight = toNumber(raw?.priceLineHeight, lineHeightFor(priceSize, 1.25));
  const contentGap = toNumber(raw?.contentGap ?? raw?.textGap, Math.max(2, Math.round(cardInnerGap * 0.25)));
  const emptyTitle = toString(raw?.emptyTitle ?? raw?.emptyCartTitle, "Your Cart is Empty");
  const emptySubtitle = toString(
    raw?.emptySubtitle ?? raw?.emptyCartSubtitle ?? raw?.emptyDescription,
    "Looks like you haven't added anything to your cart yet"
  );
  // No Inspector control currently sets this, but it should still be
  // DSL-driven on principle (matching every other flag in this file) rather
  // than a literal constant that would silently ignore a future control.
  const showEmptyButton = toBoolean(raw?.showEmptyButton, false);
  const emptyButtonText = toString(raw?.emptyButtonText ?? raw?.continueShoppingText, "Continue Shopping");
  const emptyIconName = resolveFA4IconName(toString(raw?.emptyIcon ?? raw?.emptyCartIcon, "shopping-bag")) || "shopping-bag";
  const emptyIconColor = toString(raw?.emptyIconColor, "#B6B6B6");
  const emptyIconSize = toNumber(raw?.emptyIconSize, 88);
  const emptyTitleColor = toString(raw?.emptyTitleColor ?? raw?.titleColor, "#111827");
  const emptySubtitleColor = toString(raw?.emptySubtitleColor ?? raw?.subtitleColor, "#6B7280");
  const emptyButtonBgColor = toString(raw?.emptyButtonBgColor ?? raw?.emptyActionBgColor ?? raw?.buttonBgColor, "#0F9FA3");
  const emptyButtonTextColor = toString(raw?.emptyButtonTextColor ?? raw?.buttonTextColor, "#FFFFFF");
  const emptyButtonRadius = toNumber(raw?.emptyButtonRadius ?? raw?.buttonRadius, 4);
  const emptyButtonHeight = toNumber(raw?.emptyButtonHeight ?? raw?.buttonHeight, 44);
  const emptyButtonWidth = toNumber(raw?.emptyButtonWidth, responsiveSize(screenWidth, 0.5, 180, 220));
  const emptyTitleFontSize = toNumber(raw?.emptyTitleFontSize, 18);
  const emptySubtitleFontSize = toNumber(raw?.emptySubtitleFontSize, 13);
  const emptyButtonFontSize = toNumber(raw?.emptyButtonFontSize ?? raw?.buttonTextSize, 16);
  const emptyTitleFontFamily = cleanFontFamily(toString(raw?.emptyTitleFontFamily ?? raw?.headlineFontFamily ?? raw?.fontFamily, ""));
  const emptySubtitleFontFamily = cleanFontFamily(toString(raw?.emptySubtitleFontFamily ?? raw?.subtextFontFamily ?? raw?.fontFamily, ""));
  const emptyButtonFontFamily = cleanFontFamily(toString(raw?.emptyButtonFontFamily ?? raw?.buttonTextFontFamily ?? raw?.fontFamily, ""));

  const cartFingerprint = useMemo(() => cartDiscountFingerprint(cartItems), [cartItems]);
  const discountCount = activeDiscountRecords(appliedDiscounts, cartFingerprint).length;

  if (sourceItems.length === 0) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            backgroundColor: emptyBgColor,
            paddingTop: Math.max(padT, responsiveSize(screenWidth, 0.16, 56, 82)),
            paddingBottom: Math.max(padB, responsiveSize(screenWidth, 0.18, 68, 96)),
            paddingHorizontal: Math.max(padL, padR),
            minHeight: Math.max(320, Math.round(screenHeight * 0.58)),
          },
        ]}
      >
        <FontAwesome name={emptyIconName} size={emptyIconSize} color={emptyIconColor} />
        <Text
          style={[
            styles.emptyTitle,
            {
              color: emptyTitleColor,
              fontSize: emptyTitleFontSize,
              lineHeight: lineHeightFor(emptyTitleFontSize, 1.25),
              ...(emptyTitleFontFamily ? { fontFamily: emptyTitleFontFamily } : {}),
            },
          ]}
        >
          {emptyTitle}
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            {
              color: emptySubtitleColor,
              fontSize: emptySubtitleFontSize,
              lineHeight: lineHeightFor(emptySubtitleFontSize, 1.35),
              ...(emptySubtitleFontFamily ? { fontFamily: emptySubtitleFontFamily } : {}),
            },
          ]}
        >
          {emptySubtitle}
        </Text>
        {showEmptyButton && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.emptyButton,
              {
                width: emptyButtonWidth,
                minHeight: emptyButtonHeight,
                borderRadius: emptyButtonRadius,
                backgroundColor: emptyButtonBgColor,
              },
            ]}
            onPress={() => navigation.navigate("LayoutScreen", { pageName: "home" })}
          >
            <Text
              style={[
                styles.emptyButtonText,
                {
                  color: emptyButtonTextColor,
                  fontSize: emptyButtonFontSize,
                  ...(emptyButtonFontFamily ? { fontFamily: emptyButtonFontFamily } : {}),
                },
              ]}
            >
              {emptyButtonText}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: padT,
          paddingRight: padR,
          paddingBottom: padB,
          paddingLeft: padL,
          gap: cardGap,
          ...containerBorderStyle,
          borderColor: containerBorderColor,
        },
      ]}
    >
      {sourceItems.map((item, index) => {
        const itemTitle = toString(
          item?.title ??
            item?.productTitle ??
            item?.name ??
            item?.product?.title ??
            item?.merchandise?.product?.title,
          "Product"
        );
        const itemImage = toString(
          item?.image ??
            item?.imageUrl ??
            item?.featuredImage?.url ??
            item?.product?.image ??
            item?.product?.imageUrl ??
            item?.merchandise?.image?.url,
          ""
        );
        const itemVendor = toString(
          item?.vendor ??
            item?.brand ??
            item?.product?.vendor ??
            item?.merchandise?.product?.vendor,
          ""
        );
        const itemVariant = toString(
          item?.variant ??
            item?.variantTitle ??
            item?.selectedOptionsText ??
            item?.merchandise?.title,
          ""
        );
        // Reflects availability at add-to-cart time — the cart doesn't do a
        // live re-check, so an item that sells out afterward won't flip this.
        const isSoldOut = item?.soldOut === true || item?.availableForSale === false;
        const quantity = toNumber(item?.quantity, 1);
        const price = toNumber(item?.price, 0);
        const compareAt = toNumber(item?.compareAtPrice, 0);
        const displayPrice = showTotal ? price * quantity : price;
        const displayCompareAt = showTotal ? compareAt * quantity : compareAt;
        const savings = compareAt > price ? (compareAt - price) * quantity : 0;
        const itemCurrency = resolveCurrencyLabel(
          item?.currency,
          item?.priceCurrency,
          item?.currencySymbol,
          currencyLabel
        );

        // Parse variant string into parts for "Size: M | Color: Blue" display
        const variantText = itemVariant.trim();
        const variantParts = variantText
          ? variantText.split(/\s*(?:\/|\|)\s*/).map((v) => v.trim()).filter(Boolean)
          : [];
        const identityText = itemVendor.trim() || (!showTitle ? itemTitle.trim() : "");

        const handleCardPress = () => {
          if (!item?.id && !item?.handle) return;
          navigation.navigate("ProductDetail", {
            product: {
              id: item.id,
              handle: item.handle,
              title: itemTitle,
              imageUrl: itemImage,
              vendor: itemVendor,
              priceAmount: String(item.price ?? ""),
              priceCurrency: item.currency,
            },
          });
        };

        return (
          <View key={String(item?.id || index)}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCardPress}
              style={[
                styles.card,
                {
                  backgroundColor: cardBgColor,
                  borderRadius: cardBorderRadius,
                  borderWidth: cardBorderWidth,
                  borderColor: cardBorderColor,
                  paddingTop: cardPadT,
                  paddingRight: cardPadR,
                  paddingBottom: cardPadB,
                  paddingLeft: cardPadL,
                  gap: cardInnerGap,
                },
              ]}
            >
              {/* Image */}
              {showImage && (
              <View
                style={[
                  styles.imageWrap,
                  {
                    width: imageSize,
                    height: imageHeight,
                    borderRadius: imageRadius,
                    backgroundColor: imageBg,
                  },
                ]}
              >
                {itemImage ? (
                  <Image
                    source={{ uri: itemImage }}
                    style={[styles.image, { borderRadius: imageRadius }]}
                    resizeMode={resolveProductImageResizeMode(raw?.imageScale, raw?.scale, raw?.imageResizeMode)}
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: imageBg }]} />
                )}
              </View>
              )}

              {/* Item icon — top-right of card, only when DSR provides it */}
              {showItemIcon && (itemIconUrl || !!itemIconName) && (
                <View
                  style={[
                    styles.itemIconWrap,
                    { backgroundColor: itemIconBg, borderRadius: itemIconRadius },
                  ]}
                  pointerEvents="none"
                >
                  {itemIconUrl ? (
                    <Image
                      source={{ uri: itemIconUrl }}
                      style={{ width: itemIconSize, height: itemIconSize }}
                      resizeMode="contain"
                    />
                  ) : (
                    <FontAwesome name={itemIconName} size={itemIconSize} color={itemIconColor} />
                  )}
                </View>
              )}

              {/* Right content */}
              <View style={[styles.info, { minHeight: showImage ? imageHeight : 0, gap: contentGap }]}>

                {/* Title */}
                {showTitle && !!itemTitle && (
                  <Text
                    style={[styles.title, { color: titleColor, fontSize: titleSize, fontWeight: titleWeight, lineHeight: titleLineHeight, ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}) }]}
                    numberOfLines={2}
                  >
                    {itemTitle}
                  </Text>
                )}

                {/* Variant row: Size: M | Color: Blue */}
                {showVariant && variantParts.length > 0 && (
                  <Text
                    style={[styles.variant, { color: variantColor, fontSize: variantSize, fontWeight: variantWeight, lineHeight: variantLineHeight, ...(variantFontFamily ? { fontFamily: variantFontFamily } : {}) }]}
                    numberOfLines={1}
                  >
                    {variantParts.join(variantSeparator)}
                  </Text>
                )}

                {/* Vendor */}
                {showVendor && !!identityText && (
                  <Text
                    style={[styles.vendor, { color: vendorColor, fontSize: vendorSize, fontWeight: vendorWeight, lineHeight: vendorLineHeight, textTransform: vendorTextTransform, ...(vendorFontFamily ? { fontFamily: vendorFontFamily } : {}) }]}
                    numberOfLines={1}
                  >
                    {identityText}
                  </Text>
                )}

                {/* Sold Out badge */}
                {isSoldOut && showSoldOut && (
                  <View style={[styles.badge, soldOutBoxStyle]}>
                    <Text
                      style={{
                        color: soldOutColor,
                        fontSize: soldOutFontSize,
                        fontWeight: soldOutFontWeight,
                        textTransform: soldOutTextTransform,
                        ...(soldOutFontFamily ? { fontFamily: soldOutFontFamily } : {}),
                      }}
                    >
                      Sold Out
                    </Text>
                  </View>
                )}

                {/* Price row */}
                {showPrice && !isSoldOut && (
                  <View style={styles.priceRow}>
                    {showStandardPrice && (
                      <Text style={[styles.price, { color: priceColor, fontSize: priceSize, fontWeight: priceWeight, lineHeight: priceLineHeight, ...(priceFontFamily ? { fontFamily: priceFontFamily } : {}) }]}>
                        {fmtPrice(displayPrice, itemCurrency)}
                      </Text>
                    )}
                    {showCompareAt && compareAt > 0 && (
                      <Text style={[styles.compareAt, { color: compareAtColor, fontSize: compareAtSize, fontWeight: compareAtWeight, lineHeight: priceLineHeight, ...(compareAtFontFamily ? { fontFamily: compareAtFontFamily } : {}) }]}>
                        {fmtPrice(displayCompareAt, itemCurrency)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Savings badge */}
                {!isSoldOut && showSavings && savings > 0 && (
                  <View
                    style={[
                      styles.badge,
                      savingsBoxStyle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: savingsColor, fontSize: savingsFontSize, fontWeight: savingsFontWeight, textTransform: savingsTextTransform, ...(savingsFontFamily ? { fontFamily: savingsFontFamily } : {}) },
                      ]}
                    >
                      {savingsLabel} : {fmtPrice(savings, itemCurrency)}
                    </Text>
                  </View>
                )}

                {/* Discounts applied badge */}
                {showDiscountBadge && discountCount > 0 && (
                  <View
                    style={[
                      styles.discountBadge,
                      {
                        backgroundColor: discountBadgeBg,
                        borderRadius: discountBadgeRadius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: discountBadgeColor,
                          fontSize: discountBadgeFontSize,
                          fontWeight: discountBadgeFontWeight,
                          textTransform: discountBadgeTextTransform,
                          ...(discountBadgeFontFamily ? { fontFamily: discountBadgeFontFamily } : {}),
                        },
                      ]}
                    >
                      {discountCount} {discountBadgeSuffix}
                    </Text>
                  </View>
                )}

                {/* Quantity + Delete row */}
                {!isSoldOut && showQuantityControls && (
                  <View style={[styles.qtyRow, { justifyContent: qtyJustifyContent }]}>
                    <View style={[styles.qtyControls, { backgroundColor: qtyWrapBgColor }]}>
                      {/* Minus */}
                      {showDecrease && (
                      <TouchableOpacity
                        style={[
                          styles.qtyBtn,
                          {
                            width: qtyBtnSize,
                            height: qtyBtnSize,
                            borderRadius: qtyBtnRadius,
                            borderColor: qtyBorderColor,
                            backgroundColor: qtyBtnBgColor,
                          },
                        ]}
                        onPress={() => {
                          if (usesDslItems) return;
                          dispatch(updateQuantity({ id: item?.id, quantity: quantity - 1 }));
                        }}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <FontAwesome name={decreaseIconName} size={decreaseIconSize} color={decreaseIconColor} />
                      </TouchableOpacity>
                      )}

                      {/* Count */}
                      {showQtyText && (
                      <Text style={[styles.qtyText, { color: qtyTextColor, fontSize: qtyTextSize, fontWeight: qtyTextWeight, ...(qtyTextFontFamily ? { fontFamily: qtyTextFontFamily } : {}) }]}>
                        {quantity}
                      </Text>
                      )}

                      {/* Plus */}
                      {showIncrease && (
                      <TouchableOpacity
                        style={[
                          styles.qtyBtn,
                          {
                            width: qtyBtnSize,
                            height: qtyBtnSize,
                            borderRadius: qtyBtnRadius,
                            borderColor: qtyBorderColor,
                            backgroundColor: qtyBtnBgColor,
                          },
                        ]}
                        onPress={() => {
                          if (usesDslItems) return;
                          dispatch(updateQuantity({ id: item?.id, quantity: quantity + 1 }));
                        }}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <FontAwesome name={increaseIconName} size={increaseIconSize} color={increaseIconColor} />
                      </TouchableOpacity>
                      )}
                    </View>

                    {/* Delete */}
                    {showDelete && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => {
                          if (usesDslItems) return;
                          dispatch(removeItem({ id: item?.id }));
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome name="trash-o" size={deleteIconSize} color={deleteIconColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {showDivider && index < sourceItems.length - 1 && (
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    marginTop: 22,
    textAlign: "center",
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 14,
    maxWidth: 280,
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyButtonText: {
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    overflow: "hidden",
    position: "relative",
  },
  itemIconWrap: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  imageWrap: {
    overflow: "hidden",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  variant: {
    lineHeight: 15,
  },
  vendor: {
    lineHeight: 14,
  },
  title: {
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {},
  compareAt: {
    textDecorationLine: "line-through",
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    letterSpacing: 0.2,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2,
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  deleteBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});

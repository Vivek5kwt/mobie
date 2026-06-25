import React, { useMemo } from "react";
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
import { formatMoney, parseMoneyAmount } from "../utils/money";
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
  formatMoney(Math.abs(toNumber(amount, 0)), currency);

const responsiveSize = (screenWidth, ratio, min, max) => {
  const value = Math.round(Math.max(1, screenWidth) * ratio);
  return Math.max(min, Math.min(max, value));
};

export default function CartLineItems({ section }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cartItems = useSelector((state) => state?.cart?.items || []);
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

  // Container
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF");
  const emptyBgColor = toString(raw?.emptyBgColor ?? raw?.emptyBackgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 12);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 12);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);

  // Card
  const cardBgColor = toString(raw?.cardBgColor, "#FFFFFF");
  const cardBorderColor = toString(raw?.cardBorderColor ?? raw?.borderColor, "#F3F4F6");
  const cardBorderRadius = toNumber(raw?.cardBorderRadius ?? raw?.borderRadius, 12);
  const cardBorderLine = toString(raw?.cardBorderLine ?? raw?.borderLine ?? raw?.borderStyle, "all").toLowerCase();
  const cardBorderWidth = cardBorderLine === "none" ? 0 : toNumber(raw?.cardBorderWidth ?? raw?.borderSize, 1);
  const cardGap = toNumber(raw?.cardGap ?? raw?.gap, 12);
  const derivedCardPad = Math.max(0, Math.round(cardBorderRadius * 0.75));
  const cardPadT = toNumber(raw?.cardPadT ?? raw?.cardPt ?? raw?.itemPadT, derivedCardPad);
  const cardPadR = toNumber(raw?.cardPadR ?? raw?.cardPr ?? raw?.itemPadR, derivedCardPad);
  const cardPadB = toNumber(raw?.cardPadB ?? raw?.cardPb ?? raw?.itemPadB, derivedCardPad);
  const cardPadL = toNumber(raw?.cardPadL ?? raw?.cardPl ?? raw?.itemPadL, derivedCardPad);
  const cardInnerGap = toNumber(raw?.cardInnerGap ?? raw?.itemGap, responsiveSize(screenWidth, 0.02, 8, 12));

  // Image
  const imageSize = toNumber(
    raw?.imageSize ?? raw?.imageWidth ?? raw?.productImageSize,
    responsiveSize(screenWidth, 0.16, 58, 72)
  );
  const imageRadius = toNumber(raw?.imageRadius ?? raw?.imageCorner ?? raw?.cardImageCorner, 0);
  const imageBg = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    "#FFFFFF"
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

  // Compare-at (original) price
  const showCompareAt = toBoolean(raw?.showCompareAt ?? raw?.showOriginalPrice, true);
  const compareAtColor = toString(raw?.compareAtColor ?? raw?.strikeColor, "#9CA3AF");
  const compareAtSize = toNumber(raw?.compareAtSize, 13);

  // Savings badge
  const showSavings = toBoolean(raw?.showSavings, true);
  const savingsLabel = toString(raw?.savingsLabel, "Savings");
  const savingsBg = toString(raw?.savingsBg, "#FFFFFF");
  const savingsColor = toString(raw?.savingsColor, "#16A34A");
  const savingsBorderColor = toString(raw?.savingsBorderColor, "#16A34A");
  const savingsBorderRadius = toNumber(raw?.savingsBorderRadius, 20);
  const savingsFontSize = toNumber(raw?.savingsFontSize, 12);
  const savingsFontWeight = toFontWeight(raw?.savingsFontWeight, "600");

  // Discounts applied badge
  const showDiscountBadge = toBoolean(raw?.showDiscountBadge, true);
  const discountBadgeBg = toString(raw?.discountBadgeBg, "#DBEAFE");
  const discountBadgeColor = toString(raw?.discountBadgeColor, "#1D4ED8");
  const discountBadgeRadius = toNumber(raw?.discountBadgeRadius, 20);
  const discountBadgeFontSize = toNumber(raw?.discountBadgeFontSize, 11);
  const discountBadgeFontWeight = toFontWeight(raw?.discountBadgeFontWeight, "700");
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
  const qtyTextColor = toString(raw?.qtyTextColor, "#111827");
  const qtyTextSize = toNumber(raw?.qtyTextSize, 12);
  const qtyIconSize = toNumber(raw?.qtyIconSize, 10);
  const qtyIconColor = toString(raw?.qtyIconColor, "#111827");
  const qtyAlignRaw = toString(raw?.qtyAlign ?? raw?.quantityAlign ?? raw?.quantityAlignment, "left").toLowerCase();
  const qtyJustifyContent = qtyAlignRaw === "right" || qtyAlignRaw === "flex-end"
    ? "flex-end"
    : qtyAlignRaw === "center"
      ? "center"
      : "flex-start";

  // Delete button
  const showDelete = toBoolean(raw?.showDelete ?? raw?.showDeleteButton, true);
  const deleteIconColor = toString(raw?.deleteIconColor, "#9CA3AF");
  const deleteIconSize = toNumber(raw?.deleteIconSize, 14);

  // Item icon (e.g. vendor/profile icon from DSR brandKit — shown top-right of each card)
  const showItemIcon   = toBoolean(raw?.showItemIcon ?? raw?.showVendorIcon ?? raw?.showCardIcon, false);
  const rawItemIcon    = toString(
    raw?.itemIcon ?? raw?.itemIconName ?? raw?.vendorIcon ?? raw?.cardIcon ?? raw?.iconName ?? raw?.icon,
    ""
  );
  const itemIconName   = showItemIcon ? (resolveFA4IconName(rawItemIcon) || "user") : null;
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
  const qtyFontFamily      = cleanFontFamily(toString(raw?.qtyFontFamily      ?? raw?.fontFamily, ""));
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
  const showEmptyButton = false;
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
              <View
                style={[
                  styles.imageWrap,
                  {
                    width: imageSize,
                    height: imageSize,
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

              {/* Item icon — top-right of card, only when DSR provides it */}
              {showItemIcon && !!itemIconName && (
                <View
                  style={[
                    styles.itemIconWrap,
                    { backgroundColor: itemIconBg, borderRadius: itemIconRadius },
                  ]}
                  pointerEvents="none"
                >
                  <FontAwesome name={itemIconName} size={itemIconSize} color={itemIconColor} />
                </View>
              )}

              {/* Right content */}
              <View style={[styles.info, { minHeight: imageSize, gap: contentGap }]}>

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

                {/* Price row */}
                {showPrice && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: priceColor, fontSize: priceSize, fontWeight: priceWeight, lineHeight: priceLineHeight, ...(priceFontFamily ? { fontFamily: priceFontFamily } : {}) }]}>
                      {fmtPrice(displayPrice, itemCurrency)}
                    </Text>
                    {showCompareAt && compareAt > 0 && (
                      <Text style={[styles.compareAt, { color: compareAtColor, fontSize: compareAtSize, lineHeight: priceLineHeight, ...(priceFontFamily ? { fontFamily: priceFontFamily } : {}) }]}>
                        {fmtPrice(displayCompareAt, itemCurrency)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Savings badge */}
                {showSavings && savings > 0 && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: savingsBg,
                        borderColor: savingsBorderColor,
                        borderRadius: savingsBorderRadius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: savingsColor, fontSize: savingsFontSize, fontWeight: savingsFontWeight, ...(savingsFontFamily ? { fontFamily: savingsFontFamily } : {}) },
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
                        },
                      ]}
                    >
                      {discountCount} {discountBadgeSuffix}
                    </Text>
                  </View>
                )}

                {/* Quantity + Delete row */}
                {showQuantityControls && (
                  <View style={[styles.qtyRow, { justifyContent: qtyJustifyContent }]}>
                    <View style={[styles.qtyControls, { backgroundColor: qtyWrapBgColor }]}>
                      {/* Minus */}
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
                        <FontAwesome name="minus" size={qtyIconSize} color={qtyIconColor} />
                      </TouchableOpacity>

                      {/* Count */}
                      <Text style={[styles.qtyText, { color: qtyTextColor, fontSize: qtyTextSize, ...(qtyFontFamily ? { fontFamily: qtyFontFamily } : {}) }]}>
                        {quantity}
                      </Text>

                      {/* Plus */}
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
                        <FontAwesome name="plus" size={qtyIconSize} color={qtyIconColor} />
                      </TouchableOpacity>
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

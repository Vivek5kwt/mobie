import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { resolveFont } from "../services/typographyService";
import { formatMoney, parseMoneyAmount } from "../utils/money";
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
  formatMoney(Math.abs(amount), currency);

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

  // DSL styling for item cards
  const cardBgColor = toString(raw?.cardBgColor, "#FFFFFF");
  const cardRadius = toNumber(raw?.radius ?? raw?.cardRadius, 12);
  const cardBorderColor = toString(raw?.borderColor, "#E5E7EB");
  const imageBgColor = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    "#FFFFFF"
  );

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

  // DSL — container
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 16);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 16);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);

  // Title
  const titleText = toString(raw?.title ?? raw?.heading ?? raw?.titleText, "Order Summary");
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
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize, 22);
  const titleWeight = toFontWeight(raw?.titleWeight, "700");
  const titleUnderline = toBoolean(raw?.titleUnderline ?? raw?.underline, false);
  const titleStrikethrough = toBoolean(raw?.titleStrikethrough ?? raw?.strikethrough, false);
  const titleTextDecoration = titleUnderline && titleStrikethrough
    ? "underline line-through"
    : titleUnderline
    ? "underline"
    : titleStrikethrough
    ? "line-through"
    : "none";

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
  const showCartTotal = toBoolean(raw?.showCartTotal, true);
  const cartTotalLabel = toString(raw?.cartTotalLabel, usesDslItems ? "Subtotal" : "Cart Total");
  const showCartTotalRow = showCartTotal && cartTotalLabel.trim().toLowerCase() !== "total";
  const cartTotalLabelSize = toNumber(raw?.cartTotalFontSize ?? raw?.cartTotalSize, rowLabelSize);
  const cartTotalValueSize = toNumber(raw?.cartTotalPriceFontSize ?? raw?.cartTotalValueSize, rowValueSize);
  const cartTotalColor = toString(raw?.cartTotalPriceColor ?? raw?.cartTotalColor, "#111827");
  const cartTotalWeight = toFontWeight(raw?.cartTotalWeight, "700");
  const cartTotalValueWeight = toFontWeight(raw?.cartTotalPriceFontWeight, cartTotalWeight);

  // Savings row
  const dslSavings = raw?.savings != null ? toNumber(raw?.savings, 0) : null;
  const showSavings = toBoolean(raw?.showSavings ?? raw?.savingsActive, usesDslItems && dslSavings != null);
  const savingsLabel = toString(raw?.savingsLabel, "Your Savings");
  const savingsColor = toString(raw?.savingsColor, "#EF4444");
  // Fixed amount OR percentage of cart total
  const savingsAmount = !showSavings
    ? 0
    : usesDslItems && dslSavings != null
    ? dslSavings
    : raw?.savingsAmount != null
    ? toNumber(raw.savingsAmount, 0)
    : (toNumber(raw?.savingsPercent, 0) / 100) * cartTotal;

  // Discount row (applied codes)
  const showDiscount = toBoolean(raw?.showDiscount, !usesDslItems);
  const discountLabel = toString(raw?.discountLabel, "Discount");
  const discountLabelSize = toNumber(raw?.discountsFontSize ?? raw?.discountFontSize, rowLabelSize);
  const discountValueSize = toNumber(raw?.discountPriceSize ?? raw?.discountValueSize, rowValueSize);
  const discountLabelWeight = toFontWeight(raw?.discountsFontWeight, "400");
  const discountValueWeight = toFontWeight(raw?.discountPriceFontWeight, "400");
  const discountColor = toString(raw?.discountPriceColor ?? raw?.discountColor, "#EF4444");
  const validatedDiscountAmount = sumActiveDiscountAmount(discountRecords, cartFingerprint);
  const totalDiscountAmount = Math.min(cartTotal, validatedDiscountAmount);

  // Chip styling for applied discount codes
  const chipBg = toString(raw?.chipBg ?? raw?.codeBg, "#F9FAFB");
  const chipBorderColor = toString(raw?.discountChipBorderColor ?? raw?.chipBorderColor, "#E5E7EB");
  const chipTextColor = toString(raw?.chipTextColor, "#374151");
  const chipBorderRadius = toNumber(raw?.discountChipBorderRadius ?? raw?.chipBorderRadius, 6);
  const chipFontSize = toNumber(raw?.discountChipFontSize ?? raw?.chipFontSize, 12);
  const chipFontWeight = toFontWeight(raw?.discountChipFontWeight ?? raw?.chipFontWeight, "400");
  const chipPadT = toNumber(raw?.discountChipPt ?? raw?.chipPadT, 5);
  const chipPadR = toNumber(raw?.discountChipPr ?? raw?.chipPadR, 10);
  const chipPadB = toNumber(raw?.discountChipPb ?? raw?.chipPadB, 5);
  const chipPadL = toNumber(raw?.discountChipPl ?? raw?.chipPadL, 10);
  const chipBorderLine = toString(raw?.discountChipborderSide ?? raw?.discountChipBorderSide ?? raw?.chipBorderLine, "all");
  const chipBorderWidth = chipBorderLine.trim().toLowerCase() === "none" ? 0 : 1;
  const chipPrefix = toString(raw?.chipPrefix, "Discount - ");

  // Tax row
  const configuredTaxAmount = firstDefined(
    raw?.taxAmount,
    raw?.salesTax,
    raw?.saleTax,
    raw?.saleAmount,
    raw?.salePrice,
    raw?.sale,
    usesDslItems && !toBoolean(raw?.savingsActive, false) ? raw?.savings : undefined
  );
  const computedLineTax = sourceItems.reduce((sum, item) => sum + resolveLineTax(item), 0);
  const showTax = toBoolean(
    raw?.showTax ?? raw?.taxActive ?? raw?.saleActive ?? raw?.salePriceActive,
    configuredTaxAmount != null || raw?.taxPercent != null || computedLineTax > 0
  );
  const taxLabel = toString(raw?.taxLabel, "Sales Tax");
  const taxLabelSize = toNumber(raw?.saleSize ?? raw?.taxFontSize, rowLabelSize);
  const taxValueSize = toNumber(raw?.salePriceSize ?? raw?.taxPriceSize, rowValueSize);
  const taxLabelWeight = toFontWeight(raw?.saleFontWeight ?? raw?.taxFontWeight, "400");
  const taxValueWeight = toFontWeight(raw?.salePriceFontWeight ?? raw?.taxPriceFontWeight, "400");
  const taxColor = toString(raw?.salePriceColor ?? raw?.saleColor ?? raw?.taxColor, "#EF4444");
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
  const titleFontFamily = cleanFontFamily(toString(raw?.titleFontFamily ?? raw?.fontFamily, ""));
  const rowFontFamily   = cleanFontFamily(toString(raw?.rowFontFamily   ?? raw?.fontFamily, ""));
  const chipFontFamily  = cleanFontFamily(toString(raw?.chipFontFamily  ?? raw?.fontFamily, ""));

  // Sub total row
  const showSubTotal = toBoolean(raw?.showSubTotal ?? raw?.showSubtotal, raw?.subTotal != null || true);
  const subTotalLabel = toString(raw?.subTotalLabel ?? raw?.subtotalLabel, usesDslItems ? "Total" : "Sub Total");
  const subTotalLabelSize = toNumber(raw?.subtotalSize ?? raw?.subTotalFontSize, rowLabelSize);
  const subTotalValueSize = toNumber(raw?.subtotalPriceSize ?? raw?.subTotalPriceSize, rowValueSize);
  const subTotalColor = toString(raw?.subtotalPriceColor ?? raw?.subTotalColor, "#EF4444");
  const subTotalWeight = toFontWeight(raw?.subTotalWeight, "700");
  const subTotalValueWeight = toFontWeight(raw?.subtotalPriceFontWeight, subTotalWeight);
  const showOriginalStrike = toBoolean(raw?.showOriginalPrice ?? raw?.showStrike, true);
  const strikeColor = toString(raw?.strikeThroughColor ?? raw?.strikeColor, "#9CA3AF");
  const strikeSize = toNumber(raw?.strikeThroughSize ?? raw?.strikeSize, Math.max(10, subTotalValueSize - 1));
  const strikeWeight = toFontWeight(raw?.strikeThroughFontWeight, "400");

  // Calculate sub total
  const computedSubTotal = Math.max(0, cartTotal - savingsAmount - totalDiscountAmount + taxAmount + chargeAmount);
  const subTotal = usesDslItems && raw?.subTotal != null ? toNumber(raw?.subTotal, 0) : computedSubTotal;

  const hasReductions = savingsAmount > 0 || totalDiscountAmount > 0;

  if (sourceItems.length === 0) return null;

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
              ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* DSL item cards (post-purchase line items) */}
      {usesDslItems && dslItems.map((item, idx) => {
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
            <View style={[styles.itemImageWrap, { backgroundColor: imageBgColor }]}>
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

            {/* Item details */}
            <View style={styles.itemDetails}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {toString(item?.title, "Product")}
              </Text>
              {!!item?.variant && (
                <Text style={styles.itemVariant}>{item.variant}</Text>
              )}
              <Text style={styles.itemQty}>Qty {itemQty}</Text>
            </View>

            {/* Price */}
            <Text style={styles.itemPrice}>
              {fmt(lineTotal, itemCurrency)}
            </Text>
          </View>
        );
      })}

      {/* Cart Total */}
      {showCartTotalRow && (
        <SummaryRow
          label={cartTotalLabel}
          value={fmt(cartTotal, currencyLabel)}
          labelColor={rowLabelColor}
          valueColor={cartTotalColor}
          labelSize={cartTotalLabelSize}
          valueSize={cartTotalValueSize}
          labelWeight={cartTotalWeight}
          valueWeight={cartTotalValueWeight}
          fontFamily={rowFontFamily}
        />
      )}

      {/* Savings */}
      {showSavings && savingsAmount > 0 && (
        <SummaryRow
          label={savingsLabel}
          value={fmt(savingsAmount, currencyLabel)}
          labelColor={rowLabelColor}
          valueColor={savingsColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
          fontFamily={rowFontFamily}
        />
      )}

      {/* Discount */}
      {showDiscount && activeDiscounts.length > 0 && totalDiscountAmount > 0 && (
        <>
          <SummaryRow
            label={discountLabel}
            value={fmt(totalDiscountAmount, currencyLabel)}
            labelColor={rowLabelColor}
            valueColor={discountColor}
            labelSize={discountLabelSize}
            valueSize={discountValueSize}
            labelWeight={discountLabelWeight}
            valueWeight={discountValueWeight}
            fontFamily={rowFontFamily}
          />
          {/* Applied code chips */}
          <View style={styles.chipRow}>
            {activeDiscounts.map((discount) => (
              <View
                key={discount.code}
                style={[
                  styles.chip,
                  {
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
                <Text style={[styles.chipText, { color: chipTextColor, fontSize: chipFontSize, fontWeight: chipFontWeight, ...(chipFontFamily ? { fontFamily: chipFontFamily } : {}) }]}>
                  {chipPrefix}{discount.code}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Tax */}
      {showTax && taxAmount > 0 && (
        <SummaryRow
          label={taxLabel}
          value={fmt(taxAmount, currencyLabel)}
          labelColor={rowLabelColor}
          valueColor={taxColor}
          labelSize={taxLabelSize}
          valueSize={taxValueSize}
          labelWeight={taxLabelWeight}
          valueWeight={taxValueWeight}
          fontFamily={rowFontFamily}
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
              { color: rowLabelColor, fontSize: subTotalLabelSize, fontWeight: subTotalWeight, ...(rowFontFamily ? { fontFamily: rowFontFamily } : {}) },
            ]}
          >
            {subTotalLabel}
          </Text>
          <View style={styles.subTotalValues}>
            <Text
              style={[
                styles.rowValue,
                { color: subTotalColor, fontSize: subTotalValueSize, fontWeight: subTotalValueWeight, ...(rowFontFamily ? { fontFamily: rowFontFamily } : {}) },
              ]}
            >
              {fmt(subTotal, currencyLabel)}
            </Text>
            {showOriginalStrike && hasReductions && (
              <Text
                style={[
                  styles.strikeValue,
                  { color: strikeColor, fontSize: strikeSize, fontWeight: strikeWeight },
                ]}
              >
                {fmt(cartTotal, currencyLabel)}
              </Text>
            )}
          </View>
        </View>
      )}
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
  fontFamily,
}) {
  const ff = fontFamily ? { fontFamily } : {};
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight, ...ff }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: valueColor, fontSize: valueSize, fontWeight: valueWeight, ...ff }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    textAlign: "right",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  strikeValue: {
    textDecorationLine: "line-through",
  },
});

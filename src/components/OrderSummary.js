import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

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
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

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

const fmt = (amount, currency) =>
  `${normalizeCurrencyLabel(currency)}${Math.abs(amount).toFixed(2)}`;

export default function OrderSummary({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, {}) || propsNode || {};

  // Redux
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const appliedCodes = useSelector((state) => state?.cart?.discounts || []);

  // DSL items (post-purchase / injected items override Redux cart)
  const dslItems = Array.isArray(raw?.items) ? raw.items : [];
  const usesDslItems = dslItems.length > 0;

  // Source items — DSL items take priority (post-purchase), else Redux cart
  const sourceItems = usesDslItems ? dslItems : cartItems;

  // DSL styling for item cards
  const cardBgColor = toString(raw?.cardBgColor, "#FFFFFF");
  const cardRadius = toNumber(raw?.radius ?? raw?.cardRadius, 12);
  const cardBorderColor = toString(raw?.borderColor, "#E5E7EB");

  // Cart total from items
  const computedCartTotal = useMemo(
    () =>
      sourceItems.reduce(
        (sum, item) =>
          sum + toNumber(item?.price, 0) * toNumber(item?.qty ?? item?.quantity, 1),
        0
      ),
    [sourceItems]
  );
  const dslCartTotal = raw?.cartTotal != null ? toNumber(raw?.cartTotal, 0) : null;
  const cartTotal = dslCartTotal != null ? dslCartTotal : computedCartTotal;

  // DSL — container
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 16);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 16);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);

  // Title
  const titleText = toString(raw?.title ?? raw?.heading ?? raw?.titleText, "Order Summary");
  const showTitle = toBoolean(raw?.showTitle ?? raw?.titleEnabled, true);
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize, 22);
  const titleWeight = toFontWeight(raw?.titleWeight, "700");

  // Currency
  const currencyLabel = resolveCurrencyLabel(
    sourceItems[0]?.currency,
    sourceItems[0]?.priceCurrency,
    sourceItems[0]?.currencySymbol,
    raw?.currency,
    raw?.priceCurrency,
    raw?.currencySymbol,
    raw?.symbol
  );

  // Row label style
  const rowLabelColor = toString(raw?.rowLabelColor ?? raw?.labelColor, "#111827");
  const rowLabelSize = toNumber(raw?.rowLabelSize ?? raw?.labelSize, 14);
  const rowValueSize = toNumber(raw?.rowValueSize ?? raw?.valueSize, 14);

  // Cart total row
  const showCartTotal = toBoolean(raw?.showCartTotal, true);
  const cartTotalLabel = toString(raw?.cartTotalLabel, usesDslItems ? "Subtotal" : "Cart Total");
  const cartTotalColor = toString(raw?.cartTotalColor, "#111827");
  const cartTotalWeight = toFontWeight(raw?.cartTotalWeight, "700");

  // Savings row
  const dslSavings = raw?.savings != null ? toNumber(raw?.savings, 0) : null;
  const showSavings = toBoolean(raw?.showSavings, dslSavings != null);
  const savingsLabel = toString(raw?.savingsLabel, "Your Savings");
  const savingsColor = toString(raw?.savingsColor, "#EF4444");
  // Fixed amount OR percentage of cart total
  const savingsAmount = dslSavings != null
    ? dslSavings
    : raw?.savingsAmount != null
    ? toNumber(raw.savingsAmount, 0)
    : (toNumber(raw?.savingsPercent, 0) / 100) * cartTotal;

  // Discount row (applied codes)
  const showDiscount = toBoolean(raw?.showDiscount, !usesDslItems);
  const discountLabel = toString(raw?.discountLabel, "Discount");
  const discountColor = toString(raw?.discountColor, "#EF4444");
  // Discount per code: fixed amount or % per code
  const discountPerCodeAmount = raw?.discountAmount != null
    ? toNumber(raw.discountAmount, 0)
    : (toNumber(raw?.discountPercent, 0) / 100) * cartTotal;
  const totalDiscountAmount = discountPerCodeAmount * appliedCodes.length;

  // Chip styling for applied discount codes
  const chipBg = toString(raw?.chipBg ?? raw?.codeBg, "#F9FAFB");
  const chipBorderColor = toString(raw?.chipBorderColor, "#E5E7EB");
  const chipTextColor = toString(raw?.chipTextColor, "#374151");
  const chipBorderRadius = toNumber(raw?.chipBorderRadius, 6);
  const chipFontSize = toNumber(raw?.chipFontSize, 12);
  const chipPrefix = toString(raw?.chipPrefix, "Discount - ");

  // Tax row
  const showTax = toBoolean(raw?.showTax, raw?.taxAmount != null || raw?.taxPercent != null);
  const taxLabel = toString(raw?.taxLabel, "Sales Tax");
  const taxColor = toString(raw?.taxColor, "#EF4444");
  const taxAmount = raw?.taxAmount != null
    ? toNumber(raw.taxAmount, 0)
    : (toNumber(raw?.taxPercent, 0) / 100) * cartTotal;

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
  const subTotalColor = toString(raw?.subTotalColor, "#EF4444");
  const subTotalWeight = toFontWeight(raw?.subTotalWeight, "700");
  const showOriginalStrike = toBoolean(raw?.showOriginalPrice ?? raw?.showStrike, true);
  const strikeColor = toString(raw?.strikeColor, "#9CA3AF");

  // Calculate sub total
  const computedSubTotal = cartTotal - savingsAmount - totalDiscountAmount + taxAmount;
  const subTotal = raw?.subTotal != null ? toNumber(raw?.subTotal, 0) : computedSubTotal;

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
            { color: titleColor, fontSize: titleSize, fontWeight: titleWeight, ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}) },
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
            <View style={styles.itemImageWrap}>
              {item?.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.itemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.itemImagePlaceholder} />
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
              {itemCurrency}{lineTotal.toFixed(2)}
            </Text>
          </View>
        );
      })}

      {/* Cart Total */}
      {showCartTotal && (
        <SummaryRow
          label={cartTotalLabel}
          value={fmt(cartTotal, currencyLabel)}
          labelColor={rowLabelColor}
          valueColor={cartTotalColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
          labelWeight={cartTotalWeight}
          valueWeight={cartTotalWeight}
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
      {showDiscount && appliedCodes.length > 0 && totalDiscountAmount > 0 && (
        <>
          <SummaryRow
            label={discountLabel}
            value={fmt(totalDiscountAmount, currencyLabel)}
            labelColor={rowLabelColor}
            valueColor={discountColor}
            labelSize={rowLabelSize}
            valueSize={rowValueSize}
            fontFamily={rowFontFamily}
          />
          {/* Applied code chips */}
          <View style={styles.chipRow}>
            {appliedCodes.map((code) => (
              <View
                key={code}
                style={[
                  styles.chip,
                  {
                    backgroundColor: chipBg,
                    borderColor: chipBorderColor,
                    borderRadius: chipBorderRadius,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: chipTextColor, fontSize: chipFontSize, ...(chipFontFamily ? { fontFamily: chipFontFamily } : {}) }]}>
                  {chipPrefix}{code}
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
              { color: rowLabelColor, fontSize: rowLabelSize, fontWeight: subTotalWeight, ...(rowFontFamily ? { fontFamily: rowFontFamily } : {}) },
            ]}
          >
            {subTotalLabel}
          </Text>
          <View style={styles.subTotalValues}>
            <Text
              style={[
                styles.rowValue,
                { color: subTotalColor, fontSize: rowValueSize, fontWeight: subTotalWeight, ...(rowFontFamily ? { fontFamily: rowFontFamily } : {}) },
              ]}
            >
              {fmt(subTotal, currencyLabel)}
            </Text>
            {showOriginalStrike && hasReductions && (
              <Text
                style={[
                  styles.strikeValue,
                  { color: strikeColor, fontSize: rowValueSize - 1 },
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
    backgroundColor: "#F3F4F6",
  },
  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemImagePlaceholder: {
    flex: 1,
    backgroundColor: "#E5E7EB",
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

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
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

const fmt = (amount, symbol) =>
  `${symbol}${Math.abs(amount).toFixed(2)}`;

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

  // Cart total from items
  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + toNumber(item?.price, 0) * toNumber(item?.quantity, 1),
        0
      ),
    [cartItems]
  );

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
  const currencySymbol = toString(raw?.currencySymbol ?? raw?.currency ?? raw?.symbol, "$");

  // Row label style
  const rowLabelColor = toString(raw?.rowLabelColor ?? raw?.labelColor, "#111827");
  const rowLabelSize = toNumber(raw?.rowLabelSize ?? raw?.labelSize, 14);
  const rowValueSize = toNumber(raw?.rowValueSize ?? raw?.valueSize, 14);

  // Cart total row
  const showCartTotal = toBoolean(raw?.showCartTotal, true);
  const cartTotalLabel = toString(raw?.cartTotalLabel, "Cart Total");
  const cartTotalColor = toString(raw?.cartTotalColor, "#111827");
  const cartTotalWeight = toFontWeight(raw?.cartTotalWeight, "700");

  // Savings row
  const showSavings = toBoolean(raw?.showSavings, false);
  const savingsLabel = toString(raw?.savingsLabel, "Your Savings");
  const savingsColor = toString(raw?.savingsColor, "#EF4444");
  // Fixed amount OR percentage of cart total
  const savingsAmount = raw?.savingsAmount != null
    ? toNumber(raw.savingsAmount, 0)
    : (toNumber(raw?.savingsPercent, 0) / 100) * cartTotal;

  // Discount row (applied codes)
  const showDiscount = toBoolean(raw?.showDiscount, true);
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
  const showTax = toBoolean(raw?.showTax, false);
  const taxLabel = toString(raw?.taxLabel, "Sales Tax");
  const taxColor = toString(raw?.taxColor, "#EF4444");
  const taxAmount = raw?.taxAmount != null
    ? toNumber(raw.taxAmount, 0)
    : (toNumber(raw?.taxPercent, 0) / 100) * cartTotal;

  // Divider
  const showDivider = toBoolean(raw?.showDivider, true);
  const dividerColor = toString(raw?.dividerColor, "#E5E7EB");

  // Sub total row
  const showSubTotal = toBoolean(raw?.showSubTotal ?? raw?.showSubtotal, true);
  const subTotalLabel = toString(raw?.subTotalLabel ?? raw?.subtotalLabel, "Sub Total");
  const subTotalColor = toString(raw?.subTotalColor, "#EF4444");
  const subTotalWeight = toFontWeight(raw?.subTotalWeight, "700");
  const showOriginalStrike = toBoolean(raw?.showOriginalPrice ?? raw?.showStrike, true);
  const strikeColor = toString(raw?.strikeColor, "#9CA3AF");

  // Calculate sub total
  const subTotal = cartTotal - savingsAmount - totalDiscountAmount + taxAmount;

  const hasReductions = savingsAmount > 0 || totalDiscountAmount > 0;

  if (cartItems.length === 0) return null;

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
            { color: titleColor, fontSize: titleSize, fontWeight: titleWeight },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* Cart Total */}
      {showCartTotal && (
        <SummaryRow
          label={cartTotalLabel}
          value={fmt(cartTotal, currencySymbol)}
          labelColor={rowLabelColor}
          valueColor={cartTotalColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
          labelWeight={cartTotalWeight}
          valueWeight={cartTotalWeight}
        />
      )}

      {/* Savings */}
      {showSavings && savingsAmount > 0 && (
        <SummaryRow
          label={savingsLabel}
          value={fmt(savingsAmount, currencySymbol)}
          labelColor={rowLabelColor}
          valueColor={savingsColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
        />
      )}

      {/* Discount */}
      {showDiscount && appliedCodes.length > 0 && totalDiscountAmount > 0 && (
        <>
          <SummaryRow
            label={discountLabel}
            value={fmt(totalDiscountAmount, currencySymbol)}
            labelColor={rowLabelColor}
            valueColor={discountColor}
            labelSize={rowLabelSize}
            valueSize={rowValueSize}
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
                <Text style={[styles.chipText, { color: chipTextColor, fontSize: chipFontSize }]}>
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
          value={fmt(taxAmount, currencySymbol)}
          labelColor={rowLabelColor}
          valueColor={taxColor}
          labelSize={rowLabelSize}
          valueSize={rowValueSize}
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
              { color: rowLabelColor, fontSize: rowLabelSize, fontWeight: subTotalWeight },
            ]}
          >
            {subTotalLabel}
          </Text>
          <View style={styles.subTotalValues}>
            <Text
              style={[
                styles.rowValue,
                { color: subTotalColor, fontSize: rowValueSize, fontWeight: subTotalWeight },
              ]}
            >
              {fmt(subTotal, currencySymbol)}
            </Text>
            {showOriginalStrike && hasReductions && (
              <Text
                style={[
                  styles.strikeValue,
                  { color: strikeColor, fontSize: rowValueSize - 1 },
                ]}
              >
                {fmt(cartTotal, currencySymbol)}
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
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight }]}>
        {label}
      </Text>
      <Text style={[styles.rowValue, { color: valueColor, fontSize: valueSize, fontWeight: valueWeight }]}>
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

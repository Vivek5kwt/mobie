import React from "react";
import { StyleSheet, Text, View } from "react-native";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

const formatCurrency = (amount, currencySymbol) => {
  if (amount === undefined || amount === null || amount === "") return "";
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${currencySymbol}${amount}`;
  return `${currencySymbol}${numeric}`;
};

export default function ProductInfo({ section }) {
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const title = unwrapValue(propsNode?.title, {});
  const vendor = unwrapValue(propsNode?.vendor, {});
  const price = unwrapValue(propsNode?.price, {});
  const variants = unwrapValue(propsNode?.variants, {});
  const visibility = unwrapValue(propsNode?.visibility, {});
  const background = unwrapValue(propsNode?.backgroundAndPadding, {});

  const titleText = toString(raw?.titleText || raw?.title, title?.text || "Product title");
  const vendorText = toString(raw?.vendorText || raw?.shop, vendor?.text || "");
  const currencySymbol = toString(raw?.currencySymbol, price?.currencySymbol || "$");
  const salePrice = raw?.salePrice ?? price?.salePrice;
  const standardPrice = raw?.standardPrice ?? price?.standardPrice;

  const showTitle = toBoolean(visibility?.productTitle, true);
  const showVendor = toBoolean(visibility?.vendor, true);
  const showPrice = toBoolean(visibility?.price, true);
  const showSale = toBoolean(visibility?.priceSale, true);
  const showStandard = toBoolean(visibility?.priceStandard, false);
  const showStrikethrough = toBoolean(visibility?.priceStrikethrough, true);
  const showVariants = toBoolean(visibility?.variants, true);

  const resolvedPaddingRight = (() => {
    const value = toNumber(background?.paddingRight, 16);
    return value === 0 ? 16 : value;
  })();
  const resolvedPaddingLeft = (() => {
    const value = toNumber(background?.paddingLeft, 16);
    return value === 0 ? 16 : value;
  })();

  const paddingStyle = {
    paddingTop: toNumber(background?.paddingTop, 16),
    paddingRight: resolvedPaddingRight,
    paddingBottom: toNumber(background?.paddingBottom, 16),
    paddingLeft: resolvedPaddingLeft,
    backgroundColor: toString(background?.bgColor, "#ffffff"),
    borderRadius: toNumber(background?.cornerRadius, 0),
    borderWidth: background?.borderLine ? 1 : 0,
    borderColor: toString(background?.borderColor, "#e5e7eb"),
  };

  return (
    <View style={[styles.container, paddingStyle]}>
      {showTitle && (
        <Text
          style={[
            styles.title,
            {
              fontSize: toNumber(title?.fontSize, 20),
              color: toString(title?.color, "#111827"),
              fontWeight: toString(title?.fontWeight, "700"),
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {showVendor && !!vendorText && (
        <Text
          style={[
            styles.vendor,
            {
              fontSize: toNumber(vendor?.fontSize, 17),
              color: toString(vendor?.color, "#6B7280"),
              fontWeight: toString(vendor?.fontWeight, "400"),
            },
          ]}
        >
          {vendorText}
        </Text>
      )}

      {showPrice && (
        <View style={styles.priceRow}>
          {showSale && (
            <Text
              style={[
                styles.priceSale,
                {
                  fontSize: toNumber(price?.sale?.fontSize, 14),
                  color: toString(price?.sale?.color, "#096d70"),
                  fontWeight: toString(price?.sale?.fontWeight, "700"),
                },
              ]}
            >
              {formatCurrency(salePrice, currencySymbol)}
            </Text>
          )}
          {showStandard && (
            <Text
              style={[
                styles.priceStandard,
                {
                  fontSize: toNumber(price?.standard?.fontSize, 14),
                  color: toString(price?.standard?.color, "#096d70"),
                  fontWeight: toString(price?.standard?.fontWeight, "700"),
                },
              ]}
            >
              {formatCurrency(standardPrice, currencySymbol)}
            </Text>
          )}
          {showStrikethrough && standardPrice !== undefined && (
            <Text
              style={[
                styles.priceStrike,
                {
                  fontSize: toNumber(price?.strikethrough?.fontSize, 12),
                  color: toString(price?.strikethrough?.color, "#9CA3AF"),
                  fontWeight: toString(price?.strikethrough?.fontWeight, "400"),
                },
              ]}
            >
              {formatCurrency(standardPrice, currencySymbol)}
            </Text>
          )}
        </View>
      )}

      {showVariants && Array.isArray(raw?.variantOptions) && raw.variantOptions.length > 0 && (
        <View style={styles.variantsWrap}>
          <Text
            style={[
              styles.variantsHeading,
              {
                fontSize: toNumber(variants?.fontSize, 22),
                color: toString(variants?.color, "#111827"),
                fontWeight: toString(variants?.fontWeight, "400"),
              },
            ]}
          >
            Variants
          </Text>
          <View style={styles.variantsDots}>
            {raw.variantOptions.map((option) => (
              <View
                key={option.id}
                style={[
                  styles.variantDot,
                  { backgroundColor: toString(option?.value, "#f3f4f6") },
                ]}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 0,
  },
  title: {
    marginBottom: 6,
  },
  vendor: {
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceSale: {
    marginRight: 8,
  },
  priceStandard: {
    marginRight: 8,
  },
  priceStrike: {
    textDecorationLine: "line-through",
  },
  variantsWrap: {
    marginTop: 12,
  },
  variantsHeading: {
    marginBottom: 6,
  },
  variantsDots: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variantDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
});

import React from "react";
import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

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
  if (typeof resolved === "string") {
    const l = resolved.toLowerCase();
    return ["true", "1", "yes", "y"].includes(l);
  }
  return Boolean(resolved);
};

const formatCurrency = (amount, currencySymbol) => {
  if (amount === undefined || amount === null || amount === "") return "";
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${currencySymbol}${amount}`;
  return `${currencySymbol}${numeric.toFixed(2)}`;
};

export default function ProductInfo({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw        = unwrapValue(propsNode?.raw, {});
  const titleCss   = unwrapValue(propsNode?.title, {});
  const vendorCss  = unwrapValue(propsNode?.vendor, {});
  const priceCss   = unwrapValue(propsNode?.price, {});
  const ratingCss  = unwrapValue(propsNode?.rating ?? propsNode?.reviews ?? propsNode?.review, {});
  const shareCss   = unwrapValue(propsNode?.share, {});
  const variantsCss= unwrapValue(propsNode?.variants, {});
  const visibility = unwrapValue(propsNode?.visibility, {});
  const background = unwrapValue(propsNode?.backgroundAndPadding, {});

  // ── Product data ────────────────────────────────────────────────────────────
  const titleText      = toString(raw?.titleText ?? raw?.title, toString(titleCss?.text, ""));
  const vendorText     = toString(raw?.vendorText ?? raw?.shop, toString(vendorCss?.text, ""));
  const currencySymbol = toString(raw?.currencySymbol, toString(priceCss?.currencySymbol, "$"));
  const salePrice      = raw?.salePrice ?? priceCss?.salePrice;
  const standardPrice  = raw?.standardPrice ?? priceCss?.standardPrice;

  // ── Rating ──────────────────────────────────────────────────────────────────
  const ratingValue     = toString(raw?.ratingText ?? raw?.rating, toString(ratingCss?.value, ""));
  const ratingCountText = toString(raw?.ratingCountText ?? raw?.ratingCount, toString(ratingCss?.count, ""));

  // ── Visibility ──────────────────────────────────────────────────────────────
  const showTitle     = toBoolean(visibility?.productTitle ?? visibility?.title, true);
  const showVendor    = toBoolean(visibility?.vendor, true);
  const showPrice     = toBoolean(visibility?.price, true);
  const showSale      = toBoolean(visibility?.priceSale ?? visibility?.salePrice, true);
  const showStandard  = toBoolean(visibility?.priceStandard ?? visibility?.standardPrice, false);
  const showStrikethrough = toBoolean(visibility?.priceStrikethrough, false);
  const showVariants  = toBoolean(visibility?.variants, true);
  const showRating    = toBoolean(
    visibility?.rating ?? visibility?.reviews ?? raw?.showRating,
    !!ratingValue  // show if a rating value exists in raw
  );
  const showShare     = toBoolean(
    visibility?.share ?? raw?.showShare,
    true
  );

  const hasData = !!(titleText || vendorText || salePrice !== undefined || standardPrice !== undefined);
  if (!hasData) return null;

  // ── Container padding / background ─────────────────────────────────────────
  const resolvedPL = (() => { const v = toNumber(background?.paddingLeft, 16); return v === 0 ? 16 : v; })();
  const resolvedPR = (() => { const v = toNumber(background?.paddingRight, 16); return v === 0 ? 16 : v; })();
  const paddingStyle = {
    paddingTop:    toNumber(background?.paddingTop, 16),
    paddingBottom: toNumber(background?.paddingBottom, 16),
    paddingLeft:   resolvedPL,
    paddingRight:  resolvedPR,
    backgroundColor: toString(background?.bgColor, "#ffffff"),
    borderRadius: toNumber(background?.cornerRadius, 0),
    borderWidth: background?.borderLine ? 1 : 0,
    borderColor: toString(background?.borderColor, "#e5e7eb"),
  };

  // ── Rating bubble styles ────────────────────────────────────────────────────
  const ratingBg           = toString(ratingCss?.bg, "#ffffff");
  const ratingBorderRadius = toNumber(ratingCss?.corner, 12);
  const ratingIconColor    = toString(ratingCss?.icon?.color, "#F59E0B");
  const ratingIconSize     = toNumber(ratingCss?.icon?.size, 12);
  const ratingFontSize     = toNumber(ratingCss?.fontSize ?? ratingCss?.rating?.fontSize, 13);
  const ratingColor        = toString(ratingCss?.color ?? ratingCss?.rating?.color, "#111827");
  const ratingFontWeight   = toString(ratingCss?.fontWeight ?? ratingCss?.rating?.fontWeight, "600");
  const ratingCountColor   = toString(ratingCss?.count?.color, "#6B7280");
  const ratingCountSize    = toNumber(ratingCss?.count?.fontSize, 12);
  const ratingBorderWidth  = ratingCss?.borderLine ? 1 : 0;
  const ratingBorderColor  = toString(ratingCss?.borderColor, "#e5e7eb");
  const showRatingIcon     = toBoolean(visibility?.reviewsIcon ?? visibility?.ratingIcon, true);
  const showRatingText     = toBoolean(visibility?.reviewsRating ?? visibility?.ratingText, true);
  const showRatingCount    = toBoolean(visibility?.reviewsRatingCounter ?? visibility?.ratingCount, false);

  // ── Share button styles ─────────────────────────────────────────────────────
  const shareBg          = toString(shareCss?.bg, "#FBCFE8");
  const shareCorner      = toNumber(shareCss?.corner, 18);
  const shareIconColor   = toString(shareCss?.icon?.color, "#BE185D");
  const shareIconSize    = toNumber(shareCss?.icon?.size, 15);
  const shareSize        = toNumber(shareCss?.size, 36);

  const handleShare = async () => {
    try {
      await Share.share({
        message: titleText ? `Check out ${titleText}` : "Check out this product!",
      });
    } catch (_) {}
  };

  return (
    <View style={[styles.container, paddingStyle]}>

      {/* ── Row 1: Title + Rating ──────────────────────────────────────────── */}
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          {showTitle && !!titleText && (
            <Text
              style={[
                styles.title,
                {
                  fontSize:   toNumber(titleCss?.fontSize, 18),
                  color:      toString(titleCss?.color, "#111827"),
                  fontWeight: toString(titleCss?.fontWeight, "700"),
                },
              ]}
              numberOfLines={2}
            >
              {titleText}
            </Text>
          )}
        </View>

        {showRating && !!ratingValue && (
          <View
            style={[
              styles.ratingBubble,
              {
                backgroundColor: ratingBg,
                borderRadius:    ratingBorderRadius,
                borderWidth:     ratingBorderWidth,
                borderColor:     ratingBorderColor,
              },
            ]}
          >
            {showRatingIcon && (
              <FontAwesome
                name="star"
                size={ratingIconSize}
                color={ratingIconColor}
                style={{ marginRight: showRatingText ? 3 : 0 }}
              />
            )}
            {showRatingText && (
              <Text
                style={{
                  fontSize:   ratingFontSize,
                  color:      ratingColor,
                  fontWeight: ratingFontWeight,
                }}
              >
                {ratingValue}
              </Text>
            )}
            {showRatingCount && !!ratingCountText && (
              <Text
                style={{
                  fontSize:   ratingCountSize,
                  color:      ratingCountColor,
                  marginLeft: 3,
                }}
              >
                {ratingCountText}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* ── Vendor ────────────────────────────────────────────────────────── */}
      {showVendor && !!vendorText && (
        <Text
          style={[
            styles.vendor,
            {
              fontSize:   toNumber(vendorCss?.fontSize, 13),
              color:      toString(vendorCss?.color, "#6B7280"),
              fontWeight: toString(vendorCss?.fontWeight, "400"),
            },
          ]}
        >
          {vendorText}
        </Text>
      )}

      {/* ── Row 2: Price + Share ──────────────────────────────────────────── */}
      {showPrice && (salePrice !== undefined || standardPrice !== undefined) && (
        <View style={styles.priceRow}>
          <View style={styles.priceLeft}>
            {showSale && salePrice !== undefined && (
              <Text
                style={[
                  styles.priceSale,
                  {
                    fontSize:   toNumber(priceCss?.sale?.fontSize, 18),
                    color:      toString(priceCss?.sale?.color, "#111827"),
                    fontWeight: toString(priceCss?.sale?.fontWeight, "700"),
                  },
                ]}
              >
                {formatCurrency(salePrice, currencySymbol)}
              </Text>
            )}
            {showStandard && standardPrice !== undefined && (
              <Text
                style={[
                  {
                    fontSize:   toNumber(priceCss?.standard?.fontSize, 16),
                    color:      toString(priceCss?.standard?.color, "#111827"),
                    fontWeight: toString(priceCss?.standard?.fontWeight, "600"),
                    marginLeft: showSale && salePrice !== undefined ? 8 : 0,
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
                    fontSize:   toNumber(priceCss?.strikethrough?.fontSize, 13),
                    color:      toString(priceCss?.strikethrough?.color, "#9CA3AF"),
                    fontWeight: toString(priceCss?.strikethrough?.fontWeight, "400"),
                    marginLeft: 8,
                  },
                ]}
              >
                {formatCurrency(standardPrice, currencySymbol)}
              </Text>
            )}
          </View>

          {showShare && (
            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.75}
              style={[
                styles.shareButton,
                {
                  width:           shareSize,
                  height:          shareSize,
                  borderRadius:    shareCorner,
                  backgroundColor: shareBg,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Share product"
            >
              <FontAwesome name="share-alt" size={shareIconSize} color={shareIconColor} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Variants ──────────────────────────────────────────────────────── */}
      {showVariants && Array.isArray(raw?.variantOptions) && raw.variantOptions.length > 0 && (
        <View style={styles.variantsWrap}>
          <Text
            style={[
              styles.variantsHeading,
              {
                fontSize:   toNumber(variantsCss?.fontSize, 14),
                color:      toString(variantsCss?.color, "#111827"),
                fontWeight: toString(variantsCss?.fontWeight, "600"),
              },
            ]}
          >
            Variants
          </Text>
          <View style={styles.variantsDots}>
            {raw.variantOptions.map((option) => (
              <View
                key={option.id ?? option.value}
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
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  vendor: {
    marginTop: 2,
    marginBottom: 10,
  },
  // Rating bubble (top-right)
  ratingBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  // Price row
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  priceSale: {},
  priceStrike: {
    textDecorationLine: "line-through",
  },
  // Share button (bottom-right)
  shareButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Variants
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

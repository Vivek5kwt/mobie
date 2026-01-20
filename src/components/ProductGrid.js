import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchShopifyProductsPage } from "../services/shopify";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const resolveFirstNumber = (values, fallback) => {
  for (const entry of values) {
    const resolved = toNumber(entry, undefined);
    if (resolved !== undefined) return resolved;
  }
  return fallback;
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
  const normalized = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return fallback;
};

const toTextAlign = (value, fallback = "left") => {
  const resolved = toString(value, fallback).toLowerCase();
  if (resolved === "center") return "center";
  if (resolved === "right") return "right";
  return "left";
};

const toFontWeight = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "number") return String(resolved);
  const normalized = String(resolved).trim().toLowerCase();
  if (normalized === "bold") return "700";
  if (normalized === "semibold" || normalized === "semi bold") return "600";
  if (normalized === "medium") return "500";
  if (normalized === "regular" || normalized === "normal") return "400";
  if (/^\d+$/.test(normalized)) return normalized;
  return fallback;
};

export default function ProductGrid({ section, limit = 8, title = "Products" }) {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const resolvedLimit = resolveFirstNumber(
    [rawProps?.productsToShow, rawProps?.productCount, rawProps?.limit],
    limit
  );
  const resolvedColumns = Math.max(1, Math.round(toNumber(rawProps?.columns, 2)));
  const resolvedAlignText = toTextAlign(rawProps?.alignText, "left");
  const resolvedTitle = toString(rawProps?.header ?? rawProps?.title, title);
  const presentation = unwrapValue(rawProps?.presentation, {});
  const presentationCss = unwrapValue(presentation?.css, {});
  const headerCss = presentationCss?.header ?? {};
  const cardCss = presentationCss?.card ?? {};
  const cardTitleCss = cardCss?.title ?? {};
  const cardPriceCss = cardCss?.price ?? {};
  const cardImageCss = cardCss?.image ?? {};
  const viewAllCss = presentationCss?.viewAll ?? {};
  const resolvedBgColor = toString(
    rawProps?.bgColor ?? presentationCss?.container?.backgroundColor,
    ""
  );
  const resolvedShowTitle = toBoolean(rawProps?.showTitle, true);
  const resolvedShowPrice = toBoolean(rawProps?.showPrice, true);
  const resolvedFavMode = toString(rawProps?.favMode, "").toLowerCase();
  const shopifyDomain = toString(rawProps?.shopifyDomain, "");
  const shopifyToken = toString(rawProps?.storefrontToken, "");
  const resolvedTitleAlign = toTextAlign(rawProps?.alignText ?? headerCss?.textAlign, "left");
  const resolvedTitleFontSize = resolveFirstNumber(
    [rawProps?.titleSize, rawProps?.headerSize, rawProps?.headerFontSize, headerCss?.fontSize],
    22
  );
  const resolvedTitleColor = toString(rawProps?.titleColor ?? headerCss?.color, "#111827");
  const resolvedTitleWeight = toFontWeight(
    rawProps?.titleWeight ?? headerCss?.fontWeight,
    "700"
  );
  const resolvedTitleFontFamily = toString(
    rawProps?.titleFontFamily ?? rawProps?.headerFontFamily ?? headerCss?.fontFamily,
    ""
  );
  const viewAllTypography = unwrapValue(
    rawProps?.viewAllTypography ??
      rawProps?.viewAllStyle ??
      rawProps?.viewAllTextStyle,
    {}
  );
  const resolvedViewAllText = toString(rawProps?.viewAllText, "View all");
  const resolvedViewAllFontSize = resolveFirstNumber(
    [
      viewAllTypography?.size,
      rawProps?.viewAllTextSize,
      rawProps?.viewAllFontSize,
      rawProps?.viewAllSize,
    ],
    14
  );
  const resolvedViewAllColor = toString(
    viewAllTypography?.color ??
      rawProps?.viewAllTextColor ??
      rawProps?.viewAllColor ??
      viewAllCss?.color,
    "#111827"
  );
  const resolvedViewAllWeight = toFontWeight(
    viewAllTypography?.weightNum ??
      viewAllTypography?.weight ??
      rawProps?.viewAllFontWeightNum ??
      rawProps?.viewAllFontWeight ??
      rawProps?.viewAllWeight ??
      viewAllCss?.fontWeight,
    "600"
  );
  const resolvedViewAllFontFamily = toString(
    viewAllTypography?.fontFamily ?? rawProps?.viewAllFontFamily ?? viewAllCss?.fontFamily,
    ""
  );
  const resolvedShowFavorite =
    resolvedFavMode === "always show" ||
    toBoolean(
      rawProps?.showFavorite ??
      rawProps?.showFavoriteIcon ??
      rawProps?.favEnabled,
    false
  );
  const resolvedImageCorner = resolveFirstNumber(
    [rawProps?.imageCorner, rawProps?.imageCornerRadius, rawProps?.imageRadius],
    undefined
  );
  const resolvedImageHeight = resolveFirstNumber(
    [rawProps?.imageHeight, rawProps?.productImageHeight],
    180
  );
  const resolvedCardCorner = resolveFirstNumber(
    [rawProps?.cardCorner, rawProps?.cardRadius, rawProps?.cardBorderRadius],
    12
  );
  const resolvedCardBackgroundColor = toString(
    rawProps?.cardBackgroundColor ?? rawProps?.cardBgColor ?? cardCss?.backgroundColor,
    "#ffffff"
  );
  const resolvedCardBorderColor = toString(
    rawProps?.cardBorderColor ?? cardCss?.borderColor,
    "#e5e7eb"
  );
  const resolvedCardBorderWidth = resolveFirstNumber(
    [rawProps?.cardBorderWidth, cardCss?.borderWidth],
    1
  );
  const resolvedImageBackgroundColor = toString(
    rawProps?.imageBackgroundColor ?? rawProps?.imageBgColor ?? cardImageCss?.backgroundColor,
    "#f3f4f6"
  );
  const cardCorner = resolvedImageCorner ?? resolvedCardCorner;
  const resolvedProductTitleSize = resolveFirstNumber(
    [
      rawProps?.productTitleSize,
      rawProps?.itemTitleSize,
      rawProps?.cardTitleSize,
      cardTitleCss?.fontSize,
    ],
    16
  );
  const resolvedProductTitleColor = toString(
    rawProps?.productTitleColor ?? rawProps?.itemTitleColor ?? cardTitleCss?.color,
    "#111827"
  );
  const resolvedProductTitleWeight = toFontWeight(
    rawProps?.productTitleWeight ?? rawProps?.itemTitleWeight ?? cardTitleCss?.fontWeight,
    "600"
  );
  const resolvedProductTitleFontFamily = toString(
    rawProps?.productTitleFontFamily ?? cardTitleCss?.fontFamily,
    ""
  );
  const resolvedPriceSize = resolveFirstNumber(
    [
      rawProps?.priceSize,
      rawProps?.productPriceSize,
      rawProps?.cardPriceSize,
      cardPriceCss?.fontSize,
    ],
    14
  );
  const resolvedPriceColor = toString(
    rawProps?.priceColor ?? rawProps?.productPriceColor ?? cardPriceCss?.color,
    "#111827"
  );
  const resolvedPriceWeight = toFontWeight(
    rawProps?.priceWeight ?? rawProps?.productPriceWeight ?? cardPriceCss?.fontWeight,
    "600"
  );
  const resolvedPriceFontFamily = toString(
    rawProps?.priceFontFamily ?? rawProps?.productPriceFontFamily ?? cardPriceCss?.fontFamily,
    ""
  );
  const resolvedStatusColor = toString(
    rawProps?.statusColor ?? presentationCss?.status?.color,
    "#6b7280"
  );
  const resolvedErrorColor = toString(
    rawProps?.errorColor ?? presentationCss?.error?.color,
    "#b91c1c"
  );
  const resolvedFavoriteBackgroundColor = toString(
    rawProps?.favoriteBackgroundColor ?? rawProps?.favoriteBgColor ?? presentationCss?.favorite?.backgroundColor,
    "rgba(255, 255, 255, 0.9)"
  );
  const resolvedFavoriteIconColor = toString(
    rawProps?.favoriteColor ?? rawProps?.favoriteIconColor ?? presentationCss?.favorite?.color,
    "#e11d48"
  );
  const detailSections = useMemo(() => {
    const candidates = [
      rawProps?.productDetailSections,
      rawProps?.detailSections,
      rawProps?.productDetails,
      rawProps?.detail,
      rawProps?.details,
    ];

    for (const candidate of candidates) {
      const resolved = unwrapValue(candidate, undefined);
      if (Array.isArray(resolved)) return resolved;
      if (Array.isArray(resolved?.sections)) return resolved.sections;
    }

    return [];
  }, [rawProps]);
  const gridGap = 16;
  const horizontalPadding = 24;
  const screenWidth = Dimensions.get("window").width;
  const totalGap = gridGap * (resolvedColumns - 1);
  const cardWidth = Math.max(
    0,
    (screenWidth - horizontalPadding * 2 - totalGap) / resolvedColumns
  );
  const imageCorner = resolvedImageCorner ?? Math.min(cardWidth, resolvedImageHeight) / 2;

  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const payload = await fetchShopifyProductsPage({
          first: resolvedLimit,
          after: null,
          options: {
            shop: shopifyDomain || undefined,
            token: shopifyToken || undefined,
          },
        });
        const nextProducts = payload?.products || [];
        const pageInfo = payload?.pageInfo || {};

        if (isMounted) {
          setProducts(nextProducts);
          setHasMore(Boolean(pageInfo?.hasNextPage));
        }
      } catch (err) {
        if (isMounted) {
          setError("Unable to load products right now. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [resolvedLimit, shopifyDomain, shopifyToken]);

  return (
    <View style={[styles.wrapper, resolvedBgColor ? { backgroundColor: resolvedBgColor } : null]}>
      {resolvedShowTitle && (
        <Text
          style={[
            styles.heading,
            {
              textAlign: resolvedTitleAlign,
              fontSize: resolvedTitleFontSize,
              color: resolvedTitleColor,
              fontWeight: resolvedTitleWeight,
              ...(resolvedTitleFontFamily ? { fontFamily: resolvedTitleFontFamily } : null),
            },
          ]}
        >
          {resolvedTitle}
        </Text>
      )}

      {loading && <Text style={[styles.status, { color: resolvedStatusColor }]}>Loading products...</Text>}
      {error && <Text style={[styles.error, { color: resolvedErrorColor }]}>{error}</Text>}

      {!loading && !error && (
        <>
          <View style={styles.grid}>
            {products.map((product, index) => (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.card,
                  {
                    width: cardWidth,
                    marginRight: (index + 1) % resolvedColumns === 0 ? 0 : gridGap,
                    borderRadius: cardCorner,
                    backgroundColor: resolvedCardBackgroundColor,
                    borderColor: resolvedCardBorderColor,
                    borderWidth: resolvedCardBorderWidth,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ProductDetail", {
                    product,
                    detailSections,
                  })
                }
              >
                {resolvedShowFavorite && (
                  <View style={[styles.favoriteBadge, { backgroundColor: resolvedFavoriteBackgroundColor }]}>
                    <Text style={[styles.favoriteIcon, { color: resolvedFavoriteIconColor }]}>♥</Text>
                  </View>
                )}
                {product.imageUrl && (
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={[
                        styles.image,
                        {
                          height: resolvedImageHeight,
                          borderRadius: imageCorner,
                          backgroundColor: resolvedImageBackgroundColor,
                        },
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View style={styles.content}>
                  {resolvedShowTitle && (
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.name,
                        {
                          textAlign: resolvedAlignText,
                          fontSize: resolvedProductTitleSize,
                          color: resolvedProductTitleColor,
                          fontWeight: resolvedProductTitleWeight,
                          ...(resolvedProductTitleFontFamily
                            ? { fontFamily: resolvedProductTitleFontFamily }
                            : null),
                        },
                      ]}
                    >
                      {product.title}
                    </Text>
                  )}
                  {resolvedShowPrice && (
                    <Text
                      style={[
                        styles.price,
                        {
                          textAlign: resolvedAlignText,
                          fontSize: resolvedPriceSize,
                          color: resolvedPriceColor,
                          fontWeight: resolvedPriceWeight,
                          ...(resolvedPriceFontFamily ? { fontFamily: resolvedPriceFontFamily } : null),
                        },
                      ]}
                    >
                      {product.priceCurrency} {product.priceAmount}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {hasMore && (
            <TouchableOpacity
              style={styles.viewAllButton}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate("AllProducts", {
                  title: resolvedTitle,
                  detailSections,
                })
              }
            >
              <Text
                style={[
                  styles.viewAllText,
                  {
                    color: resolvedViewAllColor,
                    fontSize: resolvedViewAllFontSize,
                    fontWeight: resolvedViewAllWeight,
                    ...(resolvedViewAllFontFamily ? { fontFamily: resolvedViewAllFontFamily } : null),
                  },
                ]}
              >
                {resolvedViewAllText} ›
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export function ProductGridExample() {
  return <ProductGrid limit={8} title="Featured Products" />;
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    color: "#111827",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  favoriteBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favoriteIcon: {
    color: "#e11d48",
    fontSize: 14,
    fontWeight: "700",
  },
  image: {
    width: "100%",
    backgroundColor: "#f3f4f6",
    overflow: "hidden",
  },
  imageWrapper: {
    width: "100%",
    padding: 10,
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  price: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    paddingVertical: 12,
    textAlign: "center",
    color: "#6b7280",
  },
  error: {
    paddingVertical: 12,
    textAlign: "center",
    color: "#b91c1c",
  },
  viewAllButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  viewAllText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: 14,
  },
});

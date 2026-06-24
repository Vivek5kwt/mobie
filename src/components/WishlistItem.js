import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { dedupeWishlistProducts, toggleWishlist } from "../store/slices/wishlistSlice";
import Snackbar from "./Snackbar";
import { resolveFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "./FavoriteToggleButton";
import { formatMoney } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { usePageEmptyStateReporter } from "../services/PageEmptyStateContext";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
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

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const toAlign = (value, fallback = "left") => {
  const normalized = toString(value, fallback).trim().toLowerCase();
  if (normalized === "center") return "center";
  if (normalized === "right" || normalized === "flex-end") return "right";
  return "left";
};

const alignToFlex = (align = "left") =>
  align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

const buildRawProps = (rawProps = {}) => {
  const rawBlock = unwrapValue(rawProps.raw, {});
  if (rawBlock && typeof rawBlock === "object" && rawBlock.value !== undefined) {
    return rawBlock.value;
  }
  return rawBlock || {};
};

export default function WishlistItem({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state) => dedupeWishlistProducts(state.wishlist?.items || []));
  const [snackVisible, setSnackVisible] = useState(false);

  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = buildRawProps(rawProps);
  const isWishlistEmpty = wishlistItems.length === 0;
  usePageEmptyStateReporter("wishlist", isWishlistEmpty);

  // ── DSL styling props ──────────────────────────────────────────────────────
  const pt = toNumber(raw?.pt ?? raw?.paddingTop, 12);
  const pb = toNumber(raw?.pb ?? raw?.paddingBottom, 12);
  const pl = toNumber(raw?.pl ?? raw?.paddingLeft, 12);
  const pr = toNumber(raw?.pr ?? raw?.paddingRight, 12);
  const radius = toNumber(raw?.radius, 12);
  const bgColor = toString(raw?.bgColor, "#FFFFFF");
  const emptyBgColor = toString(raw?.emptyBgColor ?? raw?.emptyBackgroundColor, "#FFFFFF");
  const emptyTitle = toString(raw?.emptyTitle ?? raw?.emptyWishlistTitle, "Personal Collection");
  const emptySubtitle = toString(
    raw?.emptySubtitle ?? raw?.emptyWishlistSubtitle,
    "Save your favorite products here."
  );
  const removeSnackbarMessage = toString(
    raw?.removeSnackbarMessage ?? raw?.wishlistRemoveSnackbarMessage ?? raw?.snackbarRemoveMessage,
    "Removed from Personal Collection"
  );
  const borderColor = toString(raw?.borderColor, "#E5E7EB");
  const iconColor = toString(raw?.iconColor, "#EF4444");
  const iconSize = toNumber(raw?.iconSize, 18);
  const favoriteToggleConfig = buildFavoriteToggleConfig({ favIconSize: iconSize, favoriteIconColor: iconColor });
  const imageRadius = toNumber(raw?.imageRadius, 8);
  const imageBgColor = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    "#FFFFFF"
  );
  const imageRatio = toString(raw?.imageRatio, "1:1");
  const priceColor = toString(raw?.priceColor, "#16A34A");
  const titleColor = toString(raw?.titleColor, "#000000");
  const strikeColor = toString(raw?.strikeColor, "#9CA3AF");
  const priceFontSize = toNumber(raw?.priceFontSize, 14);
  const titleFontSize = toNumber(raw?.titleFontSize, 14);
  const strikeFontSize = toNumber(raw?.strikeFontSize, 12);
  const titleFontWeight = toString(raw?.titleFontWeight, "600");
  const priceFontWeight = toString(raw?.priceFontWeight, "500");
  const strikeFontWeight = toString(raw?.strikepriceFontWeight ?? raw?.strikePriceFontWeight, "400");
  const titleFontFamily = resolveFont(toString(raw?.titleFontFamily ?? raw?.fontFamily, ""));
  const contentAlign = toAlign(
    firstDefined(raw?.contentAlign, raw?.cardContentAlign, raw?.cardAlign, raw?.alignText, raw?.textAlign),
    "center"
  );
  const titleAlign = toAlign(
    firstDefined(raw?.titleAlign, raw?.productTitleAlign, raw?.cardTitleAlign, raw?.itemTitleAlign, raw?.textAlign),
    contentAlign
  );
  const priceAlign = toAlign(firstDefined(raw?.priceAlign, raw?.productPriceAlign, raw?.cardPriceAlign), contentAlign);
  const contentJustify = alignToFlex(contentAlign);
  const priceJustify = alignToFlex(priceAlign);

  // Resolve image aspect ratio: "1:1" → 1, "4:3" → 0.75 (height/width), etc.
  const resolveAspectRatio = (ratio) => {
    if (!ratio || typeof ratio !== "string") return 1;
    const parts = ratio.split(":").map(Number);
    if (parts.length === 2 && parts[0] > 0) return parts[1] / parts[0];
    return 1;
  };
  const imageAspect = resolveAspectRatio(imageRatio);

  if (isWishlistEmpty) {
    return (
      <View style={[styles.empty, { backgroundColor: emptyBgColor }]}>
        <FontAwesome name="heart-o" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.grid, { paddingHorizontal: 12, paddingVertical: 12 }]}>
      <Text style={styles.countLabel}>
        {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"} saved
      </Text>
      <View style={styles.row}>
        {wishlistItems.map((product) => {
          const cardWidth = "48%";
          const imageHeight = 150 * imageAspect;

          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.85}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: bgColor,
                  borderRadius: radius,
                  borderColor,
                  paddingTop: pt,
                  paddingBottom: pb,
                  paddingLeft: pl,
                  paddingRight: pr,
                },
              ]}
              onPress={() =>
                navigation.navigate("ProductDetail", {
                  product: {
                    title: product.title,
                    imageUrl: product.image,
                    images: product.image ? [product.image] : [],
                    priceAmount: product.price,
                    priceCurrency: product.currency,
                    handle: product.handle,
                    vendor: product.vendor,
                  },
                })
              }
            >
              {/* Product image */}
              <View
                style={[
                  styles.imageWrap,
                  { height: imageHeight, borderRadius: imageRadius, backgroundColor: imageBgColor },
                ]}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={[styles.image, { borderRadius: imageRadius, backgroundColor: imageBgColor }]}
                    resizeMode={resolveProductImageResizeMode(raw?.imageScale, raw?.scale, raw?.imageResizeMode)}
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { borderRadius: imageRadius, backgroundColor: imageBgColor }]}>
                    <FontAwesome name="image" size={28} color="#D1D5DB" />
                  </View>
                )}

                {/* Heart icon overlay */}
                <FavoriteToggleButton
                  isFavorite
                  config={favoriteToggleConfig}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    e?.preventDefault?.();
                    dispatch(toggleWishlist({ product }));
                    setSnackVisible(true);
                  }}
                  accessibilityLabel="Remove from wishlist"
                />
              </View>

              {/* Product info */}
              <View style={[styles.info, { alignItems: contentJustify }]}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.title,
                    {
                      color: titleColor,
                      fontSize: titleFontSize,
                      fontWeight: titleFontWeight,
                      textAlign: titleAlign,
                      ...(titleFontFamily ? { fontFamily: titleFontFamily } : null),
                    },
                  ]}
                >
                  {product.title}
                </Text>
                <View style={[styles.priceRow, { justifyContent: priceJustify }]}>
                  <Text
                    style={[
                      styles.price,
                      {
                        color: priceColor,
                        fontSize: priceFontSize,
                        fontWeight: priceFontWeight,
                        textAlign: priceAlign,
                      },
                    ]}
                  >
                    {formatMoney(
                      product.price,
                      product.currency || product.priceCurrency || product.currencySymbol
                    ) || "—"}
                  </Text>
                  {product.compareAtPrice > 0 && product.compareAtPrice > product.price && (
                    <Text
                      style={[
                        styles.strike,
                        {
                          color: strikeColor,
                          fontSize: strikeFontSize,
                          fontWeight: strikeFontWeight,
                        },
                      ]}
                    >
                      {formatMoney(
                        product.compareAtPrice,
                        product.currency || product.priceCurrency || product.currencySymbol
                      )}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Snackbar
        visible={snackVisible}
        message={removeSnackbarMessage}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        type="info"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexGrow: 1,
  },
  countLabel: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 12,
    fontWeight: "500",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  card: {
    borderWidth: 1,
    marginBottom: 4,
    overflow: "hidden",
  },
  imageWrap: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  info: {
    gap: 4,
  },
  title: {
    lineHeight: 20,
    width: "100%",
  },
  priceRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  price: {},
  strike: {
    textDecorationLine: "line-through",
  },
  // ── Empty state ────────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  browseBtn: {
    marginTop: 8,
    backgroundColor: "#0D9488",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

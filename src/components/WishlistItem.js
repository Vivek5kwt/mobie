import React, { useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { toggleWishlist } from "../store/slices/wishlistSlice";
import Snackbar from "./Snackbar";

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
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const [snackVisible, setSnackVisible] = useState(false);

  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = buildRawProps(rawProps);

  // ── DSL styling props ──────────────────────────────────────────────────────
  const pt = toNumber(raw?.pt ?? raw?.paddingTop, 12);
  const pb = toNumber(raw?.pb ?? raw?.paddingBottom, 12);
  const pl = toNumber(raw?.pl ?? raw?.paddingLeft, 12);
  const pr = toNumber(raw?.pr ?? raw?.paddingRight, 12);
  const radius = toNumber(raw?.radius, 12);
  const bgColor = toString(raw?.bgColor, "#FFFFFF");
  const borderColor = toString(raw?.borderColor, "#E5E7EB");
  const iconColor = toString(raw?.iconColor, "#EF4444");
  const iconSize = toNumber(raw?.iconSize, 18);
  const imageRadius = toNumber(raw?.imageRadius, 8);
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
  const titleFontFamily = toString(raw?.titleFontFamily, "");

  // Resolve image aspect ratio: "1:1" → 1, "4:3" → 0.75 (height/width), etc.
  const resolveAspectRatio = (ratio) => {
    if (!ratio || typeof ratio !== "string") return 1;
    const parts = ratio.split(":").map(Number);
    if (parts.length === 2 && parts[0] > 0) return parts[1] / parts[0];
    return 1;
  };
  const imageAspect = resolveAspectRatio(imageRatio);

  if (!wishlistItems.length) {
    return (
      <View style={styles.empty}>
        <FontAwesome name="heart-o" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
        <Text style={styles.emptySubtitle}>
          Tap the heart icon on any product to save it here
        </Text>
        <TouchableOpacity
          style={styles.browseBtn}
          activeOpacity={0.8}
          onPress={() => navigation.navigate("LayoutScreen")}
        >
          <Text style={styles.browseBtnText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <ScrollView
      contentContainerStyle={[styles.grid, { paddingHorizontal: 12, paddingVertical: 12 }]}
      showsVerticalScrollIndicator={false}
    >
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
                  { height: imageHeight, borderRadius: imageRadius },
                ]}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image }}
                    style={[styles.image, { borderRadius: imageRadius }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { borderRadius: imageRadius }]}>
                    <FontAwesome name="image" size={28} color="#D1D5DB" />
                  </View>
                )}

                {/* Heart icon overlay */}
                <TouchableOpacity
                  style={styles.heartBtn}
                  onPress={() => {
                    dispatch(toggleWishlist({ product }));
                    setSnackVisible(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.8}
                >
                  <FontAwesome name="heart" size={iconSize} color={iconColor} />
                </TouchableOpacity>
              </View>

              {/* Product info */}
              <View style={styles.info}>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.title,
                    {
                      color: titleColor,
                      fontSize: titleFontSize,
                      fontWeight: titleFontWeight,
                      ...(titleFontFamily ? { fontFamily: titleFontFamily } : null),
                    },
                  ]}
                >
                  {product.title}
                </Text>
                <View style={styles.priceRow}>
                  <Text
                    style={[
                      styles.price,
                      {
                        color: priceColor,
                        fontSize: priceFontSize,
                        fontWeight: priceFontWeight,
                      },
                    ]}
                  >
                    {product.currency ? `${product.currency} ` : ""}
                    {product.price ? Number(product.price).toFixed(2) : "—"}
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
                      {product.currency ? `${product.currency} ` : ""}
                      {Number(product.compareAtPrice).toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
    <Snackbar
      visible={snackVisible}
      message="Product removed from wishlist successfully."
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
    backgroundColor: "#F3F4F6",
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
    backgroundColor: "#F3F4F6",
  },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    gap: 4,
  },
  title: {
    lineHeight: 20,
  },
  priceRow: {
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

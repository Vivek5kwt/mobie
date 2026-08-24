import React, { useEffect, useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { dedupeWishlistProducts, toggleWishlist } from "../store/slices/wishlistSlice";
import { useToast } from "./ToastProvider";
import { resolveFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "./FavoriteToggleButton";
import {
  formatPrice as formatCurrencyPrice,
  hydrateCurrencyFromStorage,
  subscribeCurrency,
} from "../utils/currencyStore";
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
  const showToast = useToast();
  const { width: screenWidth } = useWindowDimensions();

  // Currency Switcher writes here; re-render the price when the shopper
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
  const wishlistItems = useSelector((state) => dedupeWishlistProducts(state.wishlist?.items || []));

  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = buildRawProps(rawProps);
  const isWishlistEmpty = wishlistItems.length === 0;
  usePageEmptyStateReporter("wishlist", isWishlistEmpty);

  // ── DSL styling props ──────────────────────────────────────────────────────
  // "card" = per-item card's own Background & Padding section in Builder;
  // "card2" (the *2-suffixed fields below) = the outer grid/container's own,
  // separate Background & Padding section — two independent toggles/settings,
  // same as Builder's wishlist_item PreviewLive.tsx (visibility.card /
  // visibility.card2, bgColor/bgColor2, radius/radius2, borderColor+borderSide
  // / borderColor2+borderSide2, pt/pb/pl/pr / pt2/pb2/pl2/pr2).
  const cardVisible = raw?.visibility?.card !== false;
  const card2Visible = raw?.visibility?.card2 !== false;
  const pt = toNumber(raw?.pt ?? raw?.paddingTop, 12);
  const pb = toNumber(raw?.pb ?? raw?.paddingBottom, 12);
  const pl = toNumber(raw?.pl ?? raw?.paddingLeft, 12);
  const pr = toNumber(raw?.pr ?? raw?.paddingRight, 12);
  const outerPt = toNumber(raw?.pt2 ?? raw?.outerPt ?? raw?.containerPt ?? raw?.gridPt, 12);
  const outerPb = toNumber(raw?.pb2 ?? raw?.outerPb ?? raw?.containerPb ?? raw?.gridPb, 12);
  const outerPl = toNumber(raw?.pl2 ?? raw?.outerPl ?? raw?.containerPl ?? raw?.gridPl, 12);
  const outerPr = toNumber(raw?.pr2 ?? raw?.outerPr ?? raw?.containerPr ?? raw?.gridPr, 12);
  const columns = Math.max(1, Math.round(toNumber(raw?.columns ?? raw?.itemsPerRow, 2)));
  const gridGap = toNumber(raw?.gap ?? raw?.gridGap ?? raw?.itemGap ?? raw?.columnGap, 12);
  const rowGap = toNumber(raw?.rowGap ?? raw?.verticalGap, gridGap);
  const radius = toNumber(raw?.radius, 12);
  const bgColor = toString(raw?.bgColor, "#FFFFFF");
  // Outer/grid container's own background+radius+border — Builder's card2
  // section (bgColor2/radius2/borderColor2/borderSide2). Was never read here
  // at all before; only its padding (outerPt/outerPb/outerPl/outerPr above)
  // was wired up.
  const bgColor2 = toString(raw?.bgColor2, "#FFFFFF");
  const radius2 = toNumber(raw?.radius2, 12);
  const borderColor2 = toString(raw?.borderColor2, "#EAEAEA");
  const borderSide2 = toString(raw?.borderSide2, "none");
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
  // Matches Builder's own defaults (wishlist_item PreviewLive.tsx) — was
  // "#E5E7EB" here, a different color than Builder's "#EAEAEA" default.
  const borderColor = toString(raw?.borderColor, "#EAEAEA");
  // Inner card's border-line selector — was never read at all here, so the
  // card always showed styles.card's static 1px border below regardless of
  // what "Border Line" was actually set to in Builder (including "None").
  const borderSide = toString(raw?.borderSide, "none");
  const iconColor = toString(raw?.iconColor, "#FF4D4F");
  const iconSize = toNumber(raw?.iconSize, 18);
  // Builder's wishlist_item block has a single configurable "remove" icon
  // (DSL field `iconName`, default "fa-xmark") — not a separate
  // favorite/unfavorite pair like ProductGrid's toggle. Map it to both sides
  // of buildFavoriteToggleConfig so it's used regardless of state; without
  // this it silently fell back to that helper's own generic default
  // ("fa-heart"), ignoring whatever icon was actually picked in Builder.
  const iconName = toString(raw?.iconName, "fa-xmark");
  // Builder's 4-way position enum (top-right/top-left/bottom-right/
  // bottom-left), each hardcoded to an 8px offset from the card edge — no
  // configurable inset field exists there.
  const iconPosition = toString(raw?.iconPosition, "top-right");
  const iconVisible = raw?.visibility?.icon !== false;
  const favoriteToggleConfig = buildFavoriteToggleConfig({
    favIconSize: iconSize,
    favoriteIconColor: iconColor,
    favoriteIconId: iconName,
    unfavoriteIconId: iconName,
    favPosition: iconPosition,
    favBubbleInset: 8,
    // Builder renders a bare icon glyph directly on the image — no circular
    // background behind it. FavoriteToggleButton always draws a bubble
    // shape, so make it fully transparent to match instead of the visible
    // white circle it showed by default.
    favBubbleBgColor: "transparent",
  });
  const imageRadius = toNumber(raw?.imageRadius, 8);
  // Match the card's own background (bgColor) so any letterbox space
  // around a Fit-scaled image blends with the card instead of a
  // mismatched hardcoded white — Builder Preview already renders the
  // image directly on the card with no separate wrapper background.
  const imageBgColor = toString(
    raw?.imageBg ??
      raw?.imageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBgColor ??
      raw?.productImageBackgroundColor,
    bgColor
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
  const countColor = toString(raw?.countColor ?? raw?.labelColor ?? raw?.titleColor, titleColor);
  const countFontSize = toNumber(raw?.countFontSize ?? raw?.labelFontSize, titleFontSize);
  const countFontWeight = toString(raw?.countFontWeight ?? raw?.labelFontWeight, titleFontWeight);
  const countFontFamily = resolveFont(toString(raw?.countFontFamily ?? raw?.labelFontFamily ?? raw?.titleFontFamily ?? raw?.fontFamily, ""));
  const countMarginBottom = toNumber(raw?.countMarginBottom ?? raw?.labelMarginBottom, gridGap);
  const titleLineHeight = Math.max(Math.ceil(titleFontSize * 1.25), toNumber(raw?.titleLineHeight, 0));
  const priceLineHeight = Math.max(Math.ceil(priceFontSize * 1.25), toNumber(raw?.priceLineHeight, 0));

  // "Box settings" — the Background & Padding sections (card/card2) are each
  // an on/off toggle in Builder (visibility.card / visibility.card2): when
  // off, that box's background/padding/radius/border all fall back to
  // transparent/0/none, exactly like Builder's own PreviewLive.tsx
  // (mergeBrandKitWithBlockProps-independent — this is the block's own
  // props, gated the same way there). Compute the *effective* values once
  // here so every consumer below (render + the cardWidth math, which must
  // match whatever padding is actually applied) agrees.
  const resolveBorderStyle = (side, color) => {
    const none = {
      borderWidth: 0,
      borderTopWidth: 0,
      borderBottomWidth: 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
    };
    switch (side) {
      case "top":
        return { ...none, borderTopWidth: 1, borderColor: color };
      case "bottom":
        return { ...none, borderBottomWidth: 1, borderColor: color };
      case "left":
        return { ...none, borderLeftWidth: 1, borderColor: color };
      case "right":
        return { ...none, borderRightWidth: 1, borderColor: color };
      case "none":
        return none;
      case "all":
      default:
        return { ...none, borderWidth: 1, borderColor: color };
    }
  };

  const effectiveOuterPt = card2Visible ? outerPt : 0;
  const effectiveOuterPb = card2Visible ? outerPb : 0;
  const effectiveOuterPl = card2Visible ? outerPl : 0;
  const effectiveOuterPr = card2Visible ? outerPr : 0;
  const effectiveBgColor2 = card2Visible ? bgColor2 : "transparent";
  const effectiveRadius2 = card2Visible ? radius2 : 0;
  const effectiveBorderStyle2 = card2Visible
    ? resolveBorderStyle(borderSide2, borderColor2)
    : resolveBorderStyle("none", borderColor2);

  const effectivePt = cardVisible ? pt : 0;
  const effectivePb = cardVisible ? pb : 0;
  const effectivePl = cardVisible ? pl : 0;
  const effectivePr = cardVisible ? pr : 0;
  const effectiveBgColor = cardVisible ? bgColor : "transparent";
  const effectiveRadius = cardVisible ? radius : 0;
  const effectiveBorderStyle = cardVisible
    ? resolveBorderStyle(borderSide, borderColor)
    : resolveBorderStyle("none", borderColor);

  const availableWidth = Math.max(1, screenWidth - effectiveOuterPl - effectiveOuterPr - gridGap * (columns - 1));
  const cardWidth = availableWidth / columns;

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
        <Text
          style={[
            styles.emptyTitle,
            {
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: titleFontWeight,
              lineHeight: titleLineHeight,
              ...(titleFontFamily ? { fontFamily: titleFontFamily } : null),
            },
          ]}
        >
          {emptyTitle}
        </Text>
        <Text
          style={[
            styles.emptySubtitle,
            {
              color: priceColor,
              fontSize: priceFontSize,
              lineHeight: priceLineHeight,
            },
          ]}
        >
          {emptySubtitle}
        </Text>
      </View>
    );
  }

  return (
    // Plain layout wrapper only — WishlistScreen's ScrollView sets
    // contentContainerStyle={{ flexGrow: 1, ... }} so short content still
    // fills the screen, and this grid View inherits that same flexGrow:1.
    // The box-settings background/padding/radius/border below must NOT live
    // on this View: painting them here stretched the "card2" box across
    // that entire grown height (a large black/colored rectangle reaching
    // down to the bottom nav) instead of hugging just the actual content,
    // the same way Builder's own preview (which has no such grow behavior)
    // renders it. They live on the inner box View instead, which sizes to
    // its content as normal.
    <View style={styles.grid}>
      {/* Count label ("N items saved") is an app-only affordance — Builder's
          own wishlist_item PreviewLive.tsx has no such element and its card2
          "Background & Padding" box wraps only the product grid itself. Kept
          it inside the box before, so paddingTop pushed the label down
          instead of the cards — the actual label-height + margin sat between
          the box's top edge and the first card, on top of pt2, instead of
          pt2 alone. Lives outside the box now so pt2 lands exactly where
          Builder puts it: directly above the first card row. */}
      <Text
        style={[
          styles.countLabel,
          {
            color: countColor,
            fontSize: countFontSize,
            fontWeight: countFontWeight,
            marginBottom: countMarginBottom,
            ...(countFontFamily ? { fontFamily: countFontFamily } : null),
          },
        ]}
      >
        {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"} saved
      </Text>
      <View
        style={{
          backgroundColor: effectiveBgColor2,
          borderRadius: effectiveRadius2,
          paddingTop: effectiveOuterPt,
          paddingBottom: effectiveOuterPb,
          paddingLeft: effectiveOuterPl,
          paddingRight: effectiveOuterPr,
          ...effectiveBorderStyle2,
        }}
      >
        <View style={[styles.row, { gap: gridGap, rowGap }]}>
          {wishlistItems.map((product) => {
            const imageHeight = cardWidth * imageAspect;

            return (
              <TouchableOpacity
                key={product.id}
                activeOpacity={0.85}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: effectiveBgColor,
                  borderRadius: effectiveRadius,
                  paddingTop: effectivePt,
                  paddingBottom: effectivePb,
                  paddingLeft: effectivePl,
                  paddingRight: effectivePr,
                  ...effectiveBorderStyle,
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

                {/* Remove icon overlay — matches Builder's visibility.icon toggle */}
                {iconVisible && (
                  <FavoriteToggleButton
                    isFavorite
                    config={favoriteToggleConfig}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      e?.preventDefault?.();
                      dispatch(toggleWishlist({ product }));
                      showToast({
                        message: removeSnackbarMessage,
                        type: "info",
                        duration: 2500,
                      });
                    }}
                    accessibilityLabel="Remove from wishlist"
                  />
                )}
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
                      lineHeight: titleLineHeight,
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
                        lineHeight: priceLineHeight,
                        textAlign: priceAlign,
                      },
                    ]}
                  >
                    {formatCurrencyPrice(
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
                      {formatCurrencyPrice(
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
      </View>
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
    justifyContent: "flex-start",
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

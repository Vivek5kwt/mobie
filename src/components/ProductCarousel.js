import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";
import {
  fetchShopifyProductsPage,
  fetchShopifyCollectionProducts,
} from "../services/shopify";
import { addItem } from "../store/slices/cartSlice";
import { toggleWishlist } from "../store/slices/wishlistSlice";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import Snackbar from "./Snackbar";

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

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

// Strip web CSS fallback fonts ("Poppins, sans-serif" → "Poppins")
const cleanFontFamily = (family) => {
  if (!family) return "";
  return family.split(",")[0].trim().replace(/['"]/g, "");
};


const parseAspectRatio = (ratio) => {
  if (!ratio || typeof ratio !== "string") return null;
  const match = ratio.match(/(\d+):(\d+)/);
  if (match) {
    const [, w, h] = match;
    return parseFloat(w) / parseFloat(h);
  }
  return null;
};

const getImageResizeMode = (scale) => {
  const normalized = String(scale || "").toLowerCase();
  if (normalized === "cover") return "cover";
  if (normalized === "contain") return "contain";
  if (normalized === "stretch") return "stretch";
  return "cover"; // Default
};

export default function ProductCarousel({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  // Unwrap DSL envelope from raw sub-object and merge into top-level props
  const rawUnwrapped = deepUnwrap(rawProps?.raw);
  const raw = (rawUnwrapped && typeof rawUnwrapped === "object")
    ? { ...rawProps, ...rawUnwrapped }
    : (rawProps || {});

  // Data source configuration
  // DSL places dataSource as a sibling of props under section.properties,
  // not at section.dataSource (top-level) or inside props.
  const dataSourceRaw =
    section?.properties?.dataSource ||   // ← primary: where DSL actually puts it
    section?.dataSource ||               // ← flat / legacy schemas
    rawProps?.dataSource ||              // ← inside props (rare)
    {};
  // DSL wraps values as JSON Schema objects; unwrap .properties for the actual fields
  const dataSource = dataSourceRaw?.properties || dataSourceRaw;
  const dataSourceMode = unwrapValue(dataSource?.mode, "all_products");
  // Normalize handle: builder may store title ("Co-ord Sets Women") or slug ("co-ord-sets-women")
  // Convert title → slug so the Shopify API always gets a valid handle
  const collectionHandleRaw = toString(dataSource?.collectionHandle, "");
  const collectionHandle = collectionHandleRaw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")   // spaces/special chars → hyphens
    .replace(/^-+|-+$/g, "");       // trim leading/trailing hyphens

  // Grid configuration
  // DSL nests grid sub-props under grid.properties; fall back to grid itself for flat schemas
  const gridNode = raw?.grid || {};
  const grid = gridNode?.properties || gridNode;
  const columns = Math.max(1, toNumber(grid?.columns, 2));
  const itemsShown = toNumber(grid?.itemsShown, 3);

  // Background padding
  const bgPadT = toNumber(raw?.bgPadT, 8);
  const bgPadR = toNumber(raw?.bgPadR, 12);
  const bgPadB = toNumber(raw?.bgPadB, 8);
  const bgPadL = toNumber(raw?.bgPadL, 12);
  const bgColor = toString(raw?.bgColor, "#FFFFFF");
  const backgroundActive = toBoolean(raw?.backgroundActive, true);

  // Gaps
  const colGap = toNumber(raw?.colGap, 10);
  const rowGap = toNumber(raw?.rowGap, 12);

  // Header configuration
  const headerGroupActive = toBoolean(raw?.headerGroupActive, true);
  const header = unwrapValue(raw?.header, "");
  const headerText = Array.isArray(header)
    ? header.map((h) => unwrapValue(h)).join(" ")
    : toString(header, "");
  const headerSize = toNumber(raw?.headerSize, 14);
  const headerColor = toString(raw?.headerColor, "#000000");
  const headerFamily = cleanFontFamily(toString(raw?.headerFamily, ""));
  const headerWeight = toFontWeight(raw?.headerWeight, "700");
  const headerBold = toBoolean(raw?.headerBold, false);
  const headerItalic = toBoolean(raw?.headerItalic, false);
  const headerUnderline = toBoolean(raw?.headerUnderline, false);
  const headerStrikethrough = toBoolean(raw?.headerStrikethrough, false);
  const headerDecorationLine = resolveTextDecorationLine({
    underline: headerUnderline,
    strikethrough: headerStrikethrough,
  });
  const headerAlign = toTextAlign(
    raw?.headerAlign ?? raw?.sectionTitleAlign ?? raw?.headerTextAlign ?? raw?.titleTextAlign,
    "left"
  );
  const headerLinkHref = toString(raw?.headerLinkHref, "");
  const gridTitleActive = toBoolean(raw?.gridTitleActive, true);

  // View All configuration
  const viewAllActive = toBoolean(raw?.viewAllActive, true);
  const viewAllText = unwrapValue(raw?.viewAllText, "View all");
  const viewAllSize = toNumber(raw?.viewAllSize, 14);
  const viewAllColor = toString(raw?.viewAllColor, "#000000");
  const viewAllFamily = cleanFontFamily(toString(raw?.viewAllFamily, ""));
  const viewAllWeight = toFontWeight(raw?.viewAllWeight, "700");
  const viewAllBold = toBoolean(raw?.viewAllBold, false);
  const viewAllItalic = toBoolean(raw?.viewAllItalic, false);
  const viewAllUnderline = toBoolean(raw?.viewAllUnderline, false);
  const viewAllStrikethrough = toBoolean(raw?.viewAllStrikethrough, false);
  const viewAllDecorationLine = resolveTextDecorationLine({
    underline: viewAllUnderline,
    strikethrough: viewAllStrikethrough,
  });
  const viewAllLinkHref = toString(raw?.viewAllLinkHref, "");
  const viewAllIconId = toString(raw?.viewAllIconId, "fa-chevron-right");
  const viewAllIconSize = toNumber(raw?.viewAllIconSize, 14);
  const viewAllIconColor = toString(raw?.viewAllIconColor, "#000000");

  // Image configuration
  const cardImageActive = toBoolean(raw?.cardImageActive, true);
  const imageRatio = toString(raw?.imageRatio, "1:1");
  const imageScale = toString(raw?.imageScale, "Fill");
  const imageCorner = toNumber(raw?.imageCorner, 6);
  const imageAspectRatio = parseAspectRatio(imageRatio);
  const imageResizeMode = getImageResizeMode(imageScale);

  // Title configuration
  const cardTitleActive = toBoolean(raw?.cardTitleActive, true);
  const titleSize = toNumber(raw?.titleSize, 14);
  const titleColor = toString(raw?.titleColor, "#000000");
  const titleFamily = cleanFontFamily(toString(raw?.titleFamily, ""));
  const titleWeight = toFontWeight(raw?.titleWeight, "700");
  const titleAlign = toTextAlign(raw?.titleAlign, "Left");
  const titleWrap = toBoolean(
    raw?.titleWrap ?? raw?.textWrap ?? raw?.productTitleWrap ?? raw?.cardTitleWrap,
    false
  );

  // Price configuration
  const cardPriceActive = toBoolean(raw?.cardPriceActive, true);
  const priceSize = toNumber(raw?.priceSize, 14);
  const priceColor = toString(raw?.priceColor, "#000000");
  const priceFamily = cleanFontFamily(toString(raw?.priceFamily, ""));
  const priceWeight = toFontWeight(raw?.priceWeight, "700");
  const priceAlign = toTextAlign(raw?.priceAlign, "Left");
  const priceStrike = toBoolean(raw?.priceStrike, false);
  const strikeSize = toNumber(raw?.strikeSize, 14);
  const strikeColor = toString(raw?.strikeColor, "#6B7280");
  const strikeFamily = cleanFontFamily(toString(raw?.strikeFamily, ""));
  const strikeWeight = toFontWeight(raw?.strikeWeight, "700");

  // Favorite configuration
  // Single source of truth — first explicit DSL flag wins; default false (hidden)
  const showFavorite = toBoolean(
    raw?.favoriteIconEnabled ??
    raw?.favActive ??
    raw?.favEnabled ??
    raw?.showFavoriteIcon ??
    raw?.showFavorite,
    false
  );
  const favoriteIconId = toString(raw?.favoriteIconId, "fa-heart");
  const favoriteIconSize = toNumber(raw?.favIconSize, 18);
  const favoriteIconColor = toString(raw?.favIconColor, "#EF4444");
  const unfavoriteIconId = toString(raw?.unfavoriteIconId, "fa-heart-o");
  const unfavoriteIconSize = toNumber(raw?.unfavoriteIconSize, 18);
  const unfavoriteIconColor = toString(raw?.unfavoriteIconColor, "#9CA3AF");
  const favPosition = toString(raw?.favPosition, "top-right").toLowerCase();
  const favBubbleBgColor = toString(raw?.favBubbleBgColor, "#FFFFFF");
  const favBubblePadT = toNumber(raw?.favBubblePadT, 0);
  const favBubblePadR = toNumber(raw?.favBubblePadR, 0);
  const favBubblePadB = toNumber(raw?.favBubblePadB, 0);
  const favBubblePadL = toNumber(raw?.favBubblePadL, 0);
  const favoriteBubbleInset = toNumber(raw?.favBubbleInset ?? raw?.favBubbleOffset, 12);

  // Add to Cart configuration
  const atcActive = toBoolean(raw?.atcActive, true);
  const atcAvailableText = unwrapValue(raw?.atcAvailableText, "Add To Cart");
  const atcSoldOutText = unwrapValue(raw?.atcSoldOutText, "Sold Out");
  // Normalise ATC position: "above"/"top"/"before" → "above", "overlay"/"on-image" → "overlay", else "below"
  const atcPositionRaw = toString(
    raw?.atcPosition ??
    raw?.addToCartPosition ??
    raw?.cartBtnPosition ??
    raw?.atcPos ??
    raw?.buttonPosition ??
    raw?.cartPosition,
    "below"
  ).toLowerCase();
  const atcPosition =
    atcPositionRaw.includes("above") || atcPositionRaw.includes("top") || atcPositionRaw.includes("before")
      ? "above"
      : atcPositionRaw.includes("overlay") || atcPositionRaw.includes("on-image") || atcPositionRaw.includes("over")
      ? "overlay"
      : "below";
  const atcAlign = toTextAlign(raw?.atcAlign, "Left");
  const atcSize = toNumber(raw?.atcSize, 12);
  const atcBgColor = toString(raw?.atcBgColor, "#096d70");
  const atcTextColor = toString(raw?.atcTextColor, "#FFFFFF");
  const atcFamily = cleanFontFamily(toString(raw?.atcFamily, ""));
  const atcWeight = toFontWeight(raw?.atcWeight, "Semi Bold");
  const atcCorner = toNumber(raw?.atcCorner, 6);
  const atcPadT = toNumber(raw?.atcPadT, 6);
  const atcPadR = toNumber(raw?.atcPadR, 10);
  const atcPadB = toNumber(raw?.atcPadB, 6);
  const atcPadL = toNumber(raw?.atcPadL, 10);
  const atcPadX = toNumber(raw?.atcPadX, 10);
  const atcPadY = toNumber(raw?.atcPadY, 6);
  const atcAvailableBold = toBoolean(raw?.atcAvailableBold, false);
  const atcAvailableItalic = toBoolean(raw?.atcAvailableItalic, false);
  const atcAvailableUnderline = toBoolean(raw?.atcAvailableUnderline, false);
  const atcAvailableStrikethrough = toBoolean(raw?.atcAvailableStrikethrough, false);
  const atcSoldOutBgColor = toString(raw?.atcSoldOutBgColor, "#E5E7EB");
  const atcSoldOutTextColor = toString(raw?.atcSoldOutTextColor, "#111827");
  const atcSoldOutBold = toBoolean(raw?.atcSoldOutBold, false);
  const atcSoldOutItalic = toBoolean(raw?.atcSoldOutItalic, false);
  const atcSoldOutUnderline = toBoolean(raw?.atcSoldOutUnderline, false);
  const atcSoldOutStrikethrough = toBoolean(raw?.atcSoldOutStrikethrough, false);
  const atcBorderLine = toString(raw?.atcBorderLine, "");
  const atcBorderColor = toString(raw?.atcBorderColor, "#E5E7EB");
  // Icon shown inside ATC button — separate for available vs sold-out state
  const atcAvailableIconId = toString(
    raw?.atcAvailableIconId ?? raw?.atcIconId ?? raw?.buttonIcon ?? raw?.atcIcon ?? raw?.cartIcon,
    ""
  );
  const atcSoldOutIconId = toString(
    raw?.atcSoldOutIconId ?? raw?.soldOutIconId,
    ""
  );
  const atcIconPosition = toString(raw?.atcIconPosition ?? raw?.iconPosition, "left").toLowerCase();
  const atcIconSize     = toNumber(raw?.atcIconSize ?? raw?.iconSize, 14);
  const atcIconColor    = toString(raw?.atcIconColor ?? raw?.iconColor, "");

  // Card configuration
  const productCardGroupActive = toBoolean(raw?.productCardGroupActive, true);
  const borderSize = toNumber(raw?.borderSize, 1);
  const borderColor = toString(raw?.borderColor, "#E5E7EB");
  const borderLine = toString(raw?.borderLine, "");
  const outerCorners = toNumber(raw?.outerCorners, 0);
  const layoutAlign = toTextAlign(raw?.layoutAlign, "Left");

  // Horizontal carousel: show ~2.3 cards at a time (peek of 3rd card)
  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = bgPadL + bgPadR;
  const cardWidth = Math.floor((screenWidth - horizontalPadding - colGap) / 2.3);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let result;
      if (dataSourceMode === "collection" && collectionHandle) {
        result = await fetchShopifyCollectionProducts({
          handle: collectionHandle,
          first: itemsShown,
        });
      } else {
        result = await fetchShopifyProductsPage({ first: itemsShown });
      }
      if (isMountedRef.current) {
        setProducts(result?.products || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError("Unable to load products right now. Please try again later.");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [dataSourceMode, collectionHandle, itemsShown]);

  // Initial load and reload whenever data-source params change
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Refresh when the screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  const wishlistIds = useMemo(
    () =>
      new Set(
        wishlistItems
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      ),
    [wishlistItems]
  );

  // Background polling every 60 s to pick up new products
  useEffect(() => {
    const id = setInterval(loadProducts, 60000);
    return () => clearInterval(id);
  }, [loadProducts]);

  const handleAddToCart = (product) => {
    // Extract variant ID from product ID if needed
    const variantId = product.variantId || product.id || "";
    
    dispatch(
      addItem({
        item: {
          id: product.id || `product-${Date.now()}`,
          variantId: variantId,
          handle: product.handle || "",
          title: product.title || "Product Name",
          image: product.imageUrl || "",
          price: parseFloat(product.priceAmount || 0),
          variant: "",
          currency: product.priceCurrency || "USD",
          quantity: 1,
        },
      })
    );
  };

  const handleProductPress = (product) => {
    navigation.navigate("ProductDetail", {
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        imageUrl: product.imageUrl,
        priceAmount: product.priceAmount,
        priceCurrency: product.priceCurrency,
      },
    });
  };

  const resolveScreenName = (href) => {
    if (!href) return null;
    const clean = href.replace(/^\//, "").trim().toLowerCase();
    const MAP = {
      "all-products": "AllProducts",
      "allproducts":  "AllProducts",
      "products":     "AllProducts",
      "shop":         "AllProducts",
      "collection":   "AllProducts",
    };
    return MAP[clean] || href.replace(/^\//, "");
  };

  const renderHeader = () => {
    if (!headerGroupActive || !gridTitleActive) return null;
    if (!headerText) return null;

    const headerStyle = {
      fontSize: headerSize,
      color: headerColor,
      fontWeight: headerBold ? "700" : headerWeight,
      fontStyle: headerItalic ? "italic" : "normal",
      textDecorationLine: headerDecorationLine,
      textAlign: headerAlign,
      ...(headerFamily ? { fontFamily: headerFamily } : {}),
    };

    const headerContent = (
      <Text style={[styles.headerText, headerStyle]}>{headerText}</Text>
    );

    if (headerLinkHref) {
      const screen = resolveScreenName(headerLinkHref) || "AllProducts";
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate(screen, { title: headerText })}
        >
          {headerContent}
        </TouchableOpacity>
      );
    }

    return headerContent;
  };

  const renderViewAll = () => {
    if (!viewAllActive) return null;

    const viewAllTextStr = Array.isArray(viewAllText)
      ? viewAllText.map((t) => unwrapValue(t)).join(" ")
      : toString(viewAllText, "");

    if (!viewAllTextStr) return null;

    const viewAllStyle = {
      fontSize: viewAllSize,
      color: viewAllColor,
      fontWeight: viewAllBold ? "700" : viewAllWeight,
      fontStyle: viewAllItalic ? "italic" : "normal",
      textDecorationLine: viewAllDecorationLine,
      ...(viewAllFamily ? { fontFamily: viewAllFamily } : {}),
    };

    const viewAllIconName = resolveFA4IconName(viewAllIconId);

    const viewAllContent = (
      <View style={styles.viewAllContainer}>
        <Text style={[styles.viewAllText, viewAllStyle]}>{viewAllTextStr}</Text>
        {viewAllIconName && (
          <FontAwesome
            name={viewAllIconName}
            size={viewAllIconSize}
            color={viewAllIconColor}
            style={styles.viewAllIcon}
          />
        )}
      </View>
    );

    const handleViewAllPress = () => {
      const screen = viewAllLinkHref
        ? resolveScreenName(viewAllLinkHref)
        : "AllProducts";
      if (screen) {
        navigation.navigate(screen, { title: headerText });
      }
    };

    return (
      <TouchableOpacity activeOpacity={0.7} onPress={handleViewAllPress}>
        {viewAllContent}
      </TouchableOpacity>
    );
  };

  const renderFavorite = (product, isFavorite) => {
    if (!showFavorite) return null;

    const iconId = isFavorite ? favoriteIconId : unfavoriteIconId;
    const iconSize = isFavorite ? favoriteIconSize : (unfavoriteIconSize || favoriteIconSize);
    const iconColor = isFavorite ? favoriteIconColor : unfavoriteIconColor;
    // State-aware fallback: filled heart = favorited, outline = not
    const iconName = resolveFA4IconName(iconId) || (isFavorite ? "heart" : "heart-o");

    const positionStyle = {};
    if (favPosition.includes("top")) {
      positionStyle.top = favoriteBubbleInset;
    }
    if (favPosition.includes("bottom")) {
      positionStyle.bottom = favoriteBubbleInset;
    }
    if (favPosition.includes("left")) {
      positionStyle.left = favoriteBubbleInset;
    }
    if (favPosition.includes("right")) {
      positionStyle.right = favoriteBubbleInset;
    }
    const bubblePadding = Math.max(favBubblePadT, favBubblePadR, favBubblePadB, favBubblePadL, 0);
    const bubbleSize = Math.max(30, iconSize + bubblePadding * 2);

    return (
      <TouchableOpacity
        style={[
          styles.favoriteButton,
          positionStyle,
          {
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: bubbleSize / 2,
            backgroundColor: favBubbleBgColor,
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          },
        ]}
        onPress={() => {
          const id = String(
            product?.id || product?.variantId || product?.handle || product?.title || ""
          ).trim();
          if (!id) return;
          const adding = !isFavorite;
          dispatch(
            toggleWishlist({
              product: {
                id,
                title: product?.title || "",
                image: product?.imageUrl || product?.image || "",
                price: product?.priceAmount ?? product?.price ?? 0,
                compareAtPrice: product?.compareAtPrice ?? product?.originalPrice ?? 0,
                currency: product?.priceCurrency || product?.currency || "",
                handle: product?.handle || "",
                vendor: product?.vendor || "",
              },
            })
          );
          setSnackMessage(adding ? "Product added to wishlist successfully." : "Product removed from wishlist successfully.");
          setSnackVisible(true);
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <FontAwesome name={iconName} size={iconSize} color={iconColor} />
      </TouchableOpacity>
    );
  };

  const renderAddToCart = (product, isSoldOut = false) => {
    if (!atcActive) return null;

    const isAvailable = !isSoldOut;
    const buttonText = isAvailable ? atcAvailableText : atcSoldOutText;
    const buttonBgColor = isAvailable ? atcBgColor : atcSoldOutBgColor;
    const buttonTextColor = isAvailable ? atcTextColor : atcSoldOutTextColor;
    const buttonBold = isAvailable ? atcAvailableBold : atcSoldOutBold;
    const buttonItalic = isAvailable ? atcAvailableItalic : atcSoldOutItalic;
    const buttonUnderline = isAvailable ? atcAvailableUnderline : atcSoldOutUnderline;
    const buttonStrikethrough = isAvailable ? atcAvailableStrikethrough : atcSoldOutStrikethrough;
    const buttonDecorationLine = resolveTextDecorationLine({
      underline: buttonUnderline,
      strikethrough: buttonStrikethrough,
    });

    const buttonStyle = {
      backgroundColor: buttonBgColor,
      borderRadius: atcCorner,
      paddingTop: atcPadY || atcPadT,
      paddingRight: atcPadX || atcPadR,
      paddingBottom: atcPadY || atcPadB,
      paddingLeft: atcPadX || atcPadL,
      ...(atcBorderLine && atcBorderLine !== "none"
        ? {
            borderWidth: 1,
            borderColor: atcBorderColor,
            borderStyle: atcBorderLine,
          }
        : {}),
    };

    const textStyle = {
      fontSize: atcSize,
      color: buttonTextColor,
      fontWeight: buttonBold ? "700" : atcWeight,
      fontStyle: buttonItalic ? "italic" : "normal",
      textDecorationLine: buttonDecorationLine,
      ...(atcFamily ? { fontFamily: atcFamily } : {}),
    };

    const wrapJustify =
      atcAlign === "center" ? "center" :
      atcAlign === "right"  ? "flex-end" :
      atcAlign === "left"   ? "flex-start" :
      "flex-start";
    const isStretch = !atcAlign || atcAlign === "stretch";

    // Resolve icon for current button state
    const rawIconId = isAvailable ? atcAvailableIconId : atcSoldOutIconId;
    const btnIconName = resolveFA4IconName(rawIconId);

    return (
      <View style={{ flexDirection: "row", justifyContent: wrapJustify }}>
        <TouchableOpacity
          style={[styles.addToCartButton, buttonStyle, isStretch ? { flex: 1 } : {}]}
          onPress={() => (isAvailable ? handleAddToCart(product) : null)}
          disabled={!isAvailable}
          activeOpacity={isAvailable ? 0.7 : 1}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {!!btnIconName && atcIconPosition !== "right" && (
              <FontAwesome name={btnIconName} size={atcIconSize} color={atcIconColor || buttonTextColor} />
            )}
            <Text style={[styles.addToCartText, textStyle]}>{buttonText}</Text>
            {!!btnIconName && atcIconPosition === "right" && (
              <FontAwesome name={btnIconName} size={atcIconSize} color={atcIconColor || buttonTextColor} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (!productCardGroupActive) return null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: bgPadT,
          paddingRight: bgPadR,
          paddingBottom: bgPadB,
          paddingLeft: bgPadL,
          backgroundColor: backgroundActive ? bgColor : "transparent",
        },
      ]}
    >
      {headerGroupActive && (
        <View style={styles.headerContainer}>
          {headerAlign === "right" ? (
            <>
              {renderViewAll()}
              {renderHeader()}
            </>
          ) : (
            <>
              {renderHeader()}
              {renderViewAll()}
            </>
          )}
        </View>
      )}

      {loading && <Text style={styles.statusText}>Loading products...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && products.length === 0 && (
        <Text style={styles.statusText}>No products available.</Text>
      )}

      {!loading && !error && products.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.carousel, { gap: colGap }]}
        >
          {products.slice(0, itemsShown).map((product, index) => {
            const productId = String(
              product?.id || product?.variantId || product?.handle || product?.title || ""
            ).trim();
            const isFavorite = productId ? wishlistIds.has(productId) : false;
            const isSoldOut = product.availableForSale === false;

            return (
              <Pressable
                key={product.id || index}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                  {
                    width: cardWidth,
                    borderRadius: outerCorners || 8,
                    borderWidth: borderSize,
                    borderColor: borderColor,
                  },
                ]}
                onPress={() => handleProductPress(product)}
              >
                {cardImageActive && product.imageUrl && (
                  <View
                    style={[
                      styles.imageContainer,
                      {
                        borderRadius: imageCorner,
                        aspectRatio: imageAspectRatio || 1,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={[
                        styles.image,
                        {
                          borderRadius: imageCorner,
                        },
                      ]}
                      resizeMode={imageResizeMode}
                    />
                    {renderFavorite(product, isFavorite)}
                    {/* ATC overlaid on image */}
                    {atcPosition === "overlay" && (
                      <View style={styles.atcOverlay}>
                        {renderAddToCart(product, isSoldOut)}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.cardContent}>
                  {/* ATC above product info (title / price) */}
                  {atcPosition === "above" && renderAddToCart(product, isSoldOut)}

                  {cardTitleActive && (
                    <Text
                      numberOfLines={titleWrap ? undefined : 2}
                      style={[
                        styles.title,
                        {
                          fontSize: titleSize,
                          color: titleColor,
                          fontWeight: titleWeight,
                          textAlign: titleAlign,
                          ...(titleFamily ? { fontFamily: titleFamily } : {}),
                        },
                      ]}
                    >
                      {product.title}
                    </Text>
                  )}

                  {cardPriceActive && (
                    <View
                      style={[
                        styles.priceContainer,
                        {
                          alignItems:
                            priceAlign === "center"
                              ? "center"
                              : priceAlign === "right"
                              ? "flex-end"
                              : "flex-start",
                        },
                      ]}
                    >
                      {priceStrike && (
                        <Text
                          style={[
                            styles.strikePrice,
                            {
                              fontSize: strikeSize,
                              color: strikeColor,
                              fontWeight: strikeWeight,
                              ...(strikeFamily ? { fontFamily: strikeFamily } : {}),
                            },
                          ]}
                        >
                          {product.priceCurrency} {product.priceAmount}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.price,
                          {
                            fontSize: priceSize,
                            color: priceColor,
                            fontWeight: priceWeight,
                            ...(priceFamily ? { fontFamily: priceFamily } : {}),
                          },
                        ]}
                      >
                        {product.priceCurrency} {product.priceAmount}
                      </Text>
                    </View>
                  )}

                  {/* ATC below product info (default) */}
                  {atcPosition === "below" && renderAddToCart(product, isSoldOut)}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <Snackbar
        visible={snackVisible}
        message={snackMessage}
        onDismiss={() => setSnackVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  headerText: {
    flex: 1,
  },
  viewAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {},
  viewAllIcon: {
    marginLeft: 4,
  },
  statusText: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 12,
  },
  errorText: {
    textAlign: "center",
    color: "#B91C1C",
    paddingVertical: 12,
  },
  carousel: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingBottom: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  imageContainer: {
    width: "100%",
    position: "relative",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    zIndex: 2,
    borderRadius: 20,
  },
  cardContent: {
    padding: 12,
    gap: 8,
  },
  title: {
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {},
  strikePrice: {
    textDecorationLine: "line-through",
  },
  addToCartButton: {
    marginTop: 4,
  },
  addToCartText: {},
  atcOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3,
  },
});

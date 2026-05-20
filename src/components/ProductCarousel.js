import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ProductImage from "./ProductImage";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";
import {
  fetchShopifyProductsPage,
  fetchShopifyCollectionProducts,
} from "../services/shopify";
import { addItem } from "../store/slices/cartSlice";
import { getWishlistUserKey, isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import Snackbar from "./Snackbar";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { resolveFont } from "../services/typographyService";
import { formatMoney } from "../utils/money";

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

const extractIconCandidate = (input) => {
  const unwrapped = deepUnwrap(input);
  if (unwrapped === undefined || unwrapped === null) return "";
  if (typeof unwrapped === "string" || typeof unwrapped === "number") return String(unwrapped);
  if (typeof unwrapped !== "object") return "";

  const candidates = [
    unwrapped.icon,
    unwrapped.iconId,
    unwrapped.iconName,
    unwrapped.name,
    unwrapped.id,
    unwrapped.value,
    unwrapped.const,
    unwrapped.key,
  ];
  for (const candidate of candidates) {
    const resolved = deepUnwrap(candidate);
    if (typeof resolved === "string" && resolved.trim()) return resolved.trim();
    if (typeof resolved === "number") return String(resolved);
  }
  return "";
};

const resolveIconId = (...values) => {
  for (const value of values) {
    const candidate = extractIconCandidate(value);
    if (candidate) return candidate;
  }
  return "";
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

const hasExplicitValue = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null) return false;
  if (typeof resolved === "string") return resolved.trim() !== "";
  return true;
};

const resolveBooleanSetting = (values, fallback = false) => {
  for (const value of values) {
    if (hasExplicitValue(value)) return toBoolean(value, fallback);
  }
  return fallback;
};

const resolveVisibilitySetting = (values, fallback = true) => {
  let sawExplicitTrue = false;
  for (const value of values) {
    if (!hasExplicitValue(value)) continue;
    const resolved = toBoolean(value, fallback);
    if (!resolved) return false;
    sawExplicitTrue = true;
  }
  return sawExplicitTrue || fallback;
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
const cleanFontFamily = (family) => resolveFont(family) || "";


function ShimmerBone({ style }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
  return <Animated.View style={[style, { opacity }]} />;
}

const isProductAvailable = (product) => {
  if (!product || typeof product !== "object") return true;
  if (product.availableForSale === false) return false;
  const inventory =
    product.inventoryQuantity ??
    product.totalInventory ??
    product.stockQuantity ??
    product.quantityAvailable;
  if (typeof inventory === "number" && inventory <= 0) return false;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const anyVariantAvailable = product.variants.some((variant) => variant?.availableForSale !== false);
    if (!anyVariantAvailable) return false;
  }
  return true;
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

export default function ProductCarousel({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { session, initializing } = useAuth();
  const wishlistUserKey = useMemo(() => getWishlistUserKey(session), [session]);
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");
  const favoriteTapRef = useRef(false);

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  // Unwrap DSL envelope from raw sub-object and merge into top-level props
  const rawUnwrapped = deepUnwrap(rawProps?.raw);
  const raw = (rawUnwrapped && typeof rawUnwrapped === "object")
    ? { ...rawProps, ...rawUnwrapped }
    : (rawProps || {});
  const visibilityNode = deepUnwrap(raw?.visibility?.properties ?? raw?.visibility) || {};
  const layoutCss =
    deepUnwrap(raw?.layout?.properties?.css?.value) ||
    deepUnwrap(raw?.layout?.css?.value) ||
    deepUnwrap(raw?.layout?.properties?.css) ||
    deepUnwrap(raw?.layout?.css) ||
    {};

  const _slug = (s) =>
    String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  // Extract collection handle from any location in the section DSL.
  const collectionHandle = (() => {
    // ── 1. Top-level raw props (user's explicit dropdown choice)
    const topLevelKeys = ["collection", "collectionHandle", "collectionId"];
    for (const key of topLevelKeys) {
      const v = _slug(toString(raw?.[key], "") || toString(rawProps?.[key], ""));
      if (v) {
        console.log(`[ProductCarousel] collectionHandle from props.${key} =`, v);
        return v;
      }
    }

    // ── 2. Inside dataSource (unwrap const/value envelope)
    const dsRaw =
      section?.properties?.dataSource ||
      section?.dataSource ||
      rawProps?.dataSource ||
      raw?.dataSource ||
      null;
    if (dsRaw) {
      const dsUnwrapped = unwrapValue(dsRaw, {}) || {};
      const dsProp = dsUnwrapped?.properties || dsUnwrapped;
      // Always check for collection handle in dataSource — builder may set
      // mode="all_products" even when a collection handle is present (builder bug).
      for (const key of topLevelKeys) {
        const v = _slug(toString(dsProp?.[key], ""));
        if (v) {
          console.log(`[ProductCarousel] collectionHandle from dataSource.${key} =`, v);
          return v;
        }
      }
    }

    console.log("[ProductCarousel] no collectionHandle found → all products");
    return "";
  })();

  const useCollectionFetch = !!collectionHandle;

  // ── Shopify credentials (from DSL, falls back to global store config) ──────
  const shopifyDomain = toString(raw?.shopifyDomain ?? rawProps?.shopifyDomain, "");
  const shopifyToken  = toString(raw?.storefrontToken ?? rawProps?.storefrontToken, "");

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
  const headerGroupActive = resolveVisibilitySetting(
    [
      raw?.headerGroupActive,
      raw?.headerActive,
      raw?.showHeader,
      raw?.headerVisible,
      visibilityNode?.header,
      visibilityNode?.headerGroup,
    ],
    true
  );
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
    raw?.headerAlign ?? raw?.sectionTitleAlign ?? raw?.headerTextAlign ?? raw?.titleTextAlign ?? raw?.layoutAlign,
    "left"
  );
  const headerLinkHref = toString(raw?.headerLinkHref, "");
  const gridTitleActive = headerGroupActive && resolveVisibilitySetting(
    [
      raw?.gridTitleActive,
      raw?.carouselTitleActive,
      raw?.carouselTitleVisible,
      raw?.carouselTitleEnabled,
      raw?.sectionTitleActive,
      raw?.sectionTitleVisible,
      raw?.headerTitleActive,
      raw?.headerTitleVisible,
      raw?.titleActive,
      raw?.titleVisible,
      raw?.showGridTitle,
      raw?.showCarouselTitle,
      raw?.showHeaderTitle,
      raw?.showTitle,
      visibilityNode?.gridTitle,
      visibilityNode?.carouselTitle,
      visibilityNode?.sectionTitle,
      visibilityNode?.headerTitle,
      visibilityNode?.title,
    ],
    true
  );

  // View All configuration
  const viewAllActive = headerGroupActive && resolveVisibilitySetting(
    [
      raw?.viewAllActive,
      raw?.viewAllVisible,
      raw?.showViewAll,
      visibilityNode?.viewAll,
    ],
    true
  );
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
  const viewAllIconId = resolveIconId(
    raw?.viewAllIconId,
    raw?.viewAllIcon,
    raw?.viewAllIconName,
    raw?.viewAllIconSelection,
    raw?.viewAll?.icon,
    raw?.iconSelection
  ) || "fa-chevron-right";
  const viewAllIconSize = toNumber(raw?.viewAllIconSize, 14);
  const viewAllIconColor = toString(raw?.viewAllIconColor, "#000000");

  // Image configuration
  const cardImageActive = toBoolean(raw?.cardImageActive, true);
  const imageRatio = toString(raw?.imageRatio ?? raw?.ratio, "");
  const imageScale = toString(raw?.imageScale, "Fit");
  const imageCorner = toNumber(raw?.imageCorner, 6);
  // Parse ratio string → aspectRatio (w/h). "Auto" or empty → null (use explicit height instead)
  const imageAspectRatio = (() => {
    if (!imageRatio) return null;
    const normalized = imageRatio.trim().toLowerCase();
    if (normalized === "auto" || !normalized) return null;
    return parseAspectRatio(imageRatio);
  })();
  const cardImageCss = deepUnwrap(layoutCss?.cardImage ?? layoutCss?.image ?? layoutCss?.imageWrap) || {};
  const imageResizeMode = resolveProductImageResizeMode(
    imageScale,
    raw?.scale,
    raw?.imageResizeMode,
    cardImageCss?.objectFit,
    cardImageCss?.resizeMode
  );
  // Fallback height used when ratio is "Auto" or unset
  const imageHeight = toNumber(raw?.imageHeight ?? raw?.productImageHeight ?? raw?.imageH, 200);
  const imageBgColor = toString(
    raw?.imageBackgroundColor ??
      raw?.productImageBackgroundColor ??
      raw?.imageBgColor ??
      raw?.productImageBgColor ??
      raw?.imageBg ??
      cardImageCss?.backgroundColor ??
      cardImageCss?.background,
    "#FFFFFF"
  );

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
  const showFavorite = resolveBooleanSetting(
    [
      raw?.favActive,
      raw?.favEnabled,
      raw?.showFavorite,
      raw?.showFavoriteIcon,
      raw?.favoriteActive,
      raw?.favoriteVisible,
      raw?.favoriteIconVisible,
      raw?.addToFavoriteActive,
      raw?.addToFavoriteVisible,
      visibilityNode?.favorite,
      visibilityNode?.favoriteIcon,
      visibilityNode?.addToFavorite,
      raw?.favoriteIconEnabled,
    ],
    false
  );
  const favoriteIconId = toString(raw?.favoriteIconId ?? raw?.favoriteIcon ?? raw?.favIcon, "fa-heart");
  const favoriteIconSize = toNumber(raw?.favIconSize ?? raw?.favoriteIconSize, 18);
  const favoriteIconColor = toString(
    raw?.favoriteIconColor ??
      raw?.favoriteColor ??
      raw?.likedIconColor ??
      raw?.likedFavoriteIconColor ??
      raw?.wishlistActiveIconColor,
    "#EF4444"
  );
  const unfavoriteIconId = toString(
    raw?.unfavoriteIconId ?? raw?.unfavoriteIcon ?? raw?.unfavIcon,
    "fa-heart-o"
  );
  const unfavoriteIconSize = toNumber(raw?.unfavoriteIconSize ?? raw?.unfavIconSize, favoriteIconSize);
  const resolvedUnfavoriteIconColor = toString(
    raw?.unfavoriteIconColor ??
      raw?.unfavoriteColor ??
      raw?.favIconInactiveColor ??
      raw?.favIconColor ??
      raw?.favColor,
    "#9CA3AF"
  );
  const inactiveFavoriteFallbackColor =
    favoriteIconColor.trim().toLowerCase() === "#9ca3af" ? "#D1D5DB" : "#9CA3AF";
  const unfavoriteIconColor =
    resolvedUnfavoriteIconColor.trim().toLowerCase() === favoriteIconColor.trim().toLowerCase()
      ? inactiveFavoriteFallbackColor
      : resolvedUnfavoriteIconColor;
  const favPosition = toString(raw?.favPosition, "top-right").toLowerCase();
  const favBubbleBgColor = toString(raw?.favBubbleBgColor, "#FFFFFF");
  const favBubblePadT = toNumber(raw?.favBubblePadT, 0);
  const favBubblePadR = toNumber(raw?.favBubblePadR, 0);
  const favBubblePadB = toNumber(raw?.favBubblePadB, 0);
  const favBubblePadL = toNumber(raw?.favBubblePadL, 0);
  const favoriteBubbleInset = toNumber(raw?.favBubbleInset ?? raw?.favBubbleOffset, 12);
  const favoriteOnIconName = resolveFA4IconName(favoriteIconId) || "heart";
  const favoriteOffIconName = resolveFA4IconName(unfavoriteIconId) || "heart-o";

  // Add to Cart configuration
  const atcActive = resolveBooleanSetting(
    [
      raw?.atcActive,
      raw?.addToCartActive,
      raw?.showAddToCart,
      raw?.showCartButton,
      raw?.addToCartVisible,
      raw?.addToCartEnabled,
      raw?.cartBtnEnabled,
      visibilityNode?.addToCart,
      visibilityNode?.atc,
      visibilityNode?.button,
    ],
    true
  );
  const atcAvailableText = unwrapValue(raw?.atcAvailableText, "Add To Cart");
  const atcSoldOutText = unwrapValue(raw?.atcSoldOutText ?? raw?.unavailableText, "Unavailable");
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
  const atcSoldOutBgColor = toString(raw?.atcSoldOutBgColor ?? raw?.unavailableBgColor, "#7A7A7A");
  const atcSoldOutTextColor = toString(raw?.atcSoldOutTextColor ?? raw?.unavailableTextColor, "#FFFFFF");
  const atcSoldOutBold = toBoolean(raw?.atcSoldOutBold, false);
  const atcSoldOutItalic = toBoolean(raw?.atcSoldOutItalic, false);
  const atcSoldOutUnderline = toBoolean(raw?.atcSoldOutUnderline, false);
  const atcSoldOutStrikethrough = toBoolean(raw?.atcSoldOutStrikethrough, false);
  const atcBorderLine = toString(raw?.atcBorderLine, "");
  const atcBorderColor = toString(raw?.atcBorderColor, "#E5E7EB");
  // Icon shown inside ATC button — separate for available vs sold-out state
  const atcAvailableIconId = resolveIconId(
    raw?.atcAvailableIconId,
    raw?.atcIconId,
    raw?.buttonIcon,
    raw?.atcIcon,
    raw?.cartIcon,
    raw?.iconSelection
  );
  const atcSoldOutIconId = resolveIconId(
    raw?.atcSoldOutIconId,
    raw?.soldOutIconId,
    raw?.unavailableIconId,
    raw?.atcUnavailableIconId
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
  const didInitialLoadRef = useRef(false);
  const loadInFlightRef = useRef(false);
  const lastLoadAtRef = useRef(0);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadProducts = useCallback(async () => {
    const now = Date.now();
    if (loadInFlightRef.current || now - lastLoadAtRef.current < 1200) {
      return;
    }
    loadInFlightRef.current = true;
    lastLoadAtRef.current = now;

    const safeFirst = Math.max(1, Number(itemsShown) || 4);
    const shopOptions = { shop: shopifyDomain || undefined, token: shopifyToken || undefined };

    setLoading(true);
    setError("");

    const tryFetch = async () => {
      // 1. Collection-specific fetch (when DSL specifies a collection)
      if (useCollectionFetch && collectionHandle) {
        const col = await fetchShopifyCollectionProducts({
          handle: collectionHandle, first: safeFirst, options: shopOptions,
        });
        return col || { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }

      // 2. Standard paginated products query
      const page = await fetchShopifyProductsPage({ first: safeFirst, options: shopOptions });
      if (page?.products?.length) return page;

      // 3. Recent-products fallback — different cache key, different query
      return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
    };

    try {
      let result = await tryFetch();

      // Retry once after 2 s if empty — handles startup credential race condition
      if (!result?.products?.length && isMountedRef.current) {
        await new Promise((r) => setTimeout(r, 2000));
        if (isMountedRef.current) result = await tryFetch();
      }

      if (isMountedRef.current) {
        setProducts(result?.products || []);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError("Unable to load products right now. Please try again later.");
      }
    } finally {
      loadInFlightRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [useCollectionFetch, collectionHandle, itemsShown, shopifyDomain, shopifyToken]);

  // Initial load and reload whenever data-source params change
  useEffect(() => {
    didInitialLoadRef.current = true;
    loadProducts();
  }, [loadProducts]);

  // Refresh when the screen comes back into focus
  useFocusEffect(
    useCallback(() => {
      if (!didInitialLoadRef.current) return undefined;
      loadProducts();
      return undefined;
    }, [loadProducts])
  );

  // Background polling every 60 s to pick up new products
  useEffect(() => {
    const id = setInterval(loadProducts, 60000);
    return () => clearInterval(id);
  }, [loadProducts]);

  const handleAddToCart = async (product) => {
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

    if (headerLinkHref) {
      const screen = resolveScreenName(headerLinkHref) || "AllProducts";
      return (
        <TouchableOpacity
          style={styles.headerTextWrapper}
          activeOpacity={0.7}
          onPress={() => navigation.navigate(screen, { title: headerText })}
        >
          <Text style={[styles.headerText, headerStyle]}>{headerText}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.headerTextWrapper}>
        <Text style={[styles.headerText, headerStyle]}>{headerText}</Text>
      </View>
    );
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

    const iconSize = isFavorite ? favoriteIconSize : (unfavoriteIconSize || favoriteIconSize);
    const iconColor = isFavorite ? favoriteIconColor : unfavoriteIconColor;
    const iconName = isFavorite ? favoriteOnIconName : favoriteOffIconName;

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
        onPress={async (e) => {
          e?.stopPropagation?.();
          e?.preventDefault?.();
          const blocked = await requireLoginForAction({ session, navigation, initializing });
          if (blocked) return;
          favoriteTapRef.current = true;
          setTimeout(() => {
            favoriteTapRef.current = false;
          }, 0);
          const id = String(
            product?.id || product?.variantId || product?.handle || product?.title || ""
          ).trim();
          if (!id) return;
          const adding = !isFavorite;
          dispatch(
            toggleWishlist({
              userKey: wishlistUserKey,
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
        onPressIn={(e) => {
          e?.stopPropagation?.();
        }}
        activeOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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

      {loading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={{ flexDirection: "row", gap: colGap, paddingBottom: 4 }}
        >
          {Array.from({ length: Math.min(3, Math.max(1, itemsShown)) }).map((_, i) => {
            const imgH = imageAspectRatio ? cardWidth / imageAspectRatio : imageHeight;
            return (
              <View
                key={i}
                style={{
                  width: cardWidth,
                  borderRadius: outerCorners || 8,
                  overflow: "hidden",
                  backgroundColor: "#FFFFFF",
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.07,
                  shadowRadius: 4,
                }}
              >
                <ShimmerBone
                  style={{
                    width: cardWidth,
                    height: imgH,
                    borderRadius: imageCorner,
                    backgroundColor: "#D4D8DF",
                  }}
                />
                <View style={{ padding: 10, gap: 8 }}>
                  <ShimmerBone style={{ height: 12, width: "75%", borderRadius: 6, backgroundColor: "#D4D8DF" }} />
                  <ShimmerBone style={{ height: 10, width: "50%", borderRadius: 5, backgroundColor: "#D4D8DF" }} />
                  <ShimmerBone style={{ height: 10, width: "35%", borderRadius: 5, backgroundColor: "#D4D8DF" }} />
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
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
            const isFavorite = isWishlistProduct(wishlistItems, product);
            const isSoldOut = !isProductAvailable(product);

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
                onPress={() => {
                  if (favoriteTapRef.current) {
                    favoriteTapRef.current = false;
                    return;
                  }
                  handleProductPress(product);
                }}
              >
                {cardImageActive && (
                  <View
                    style={[
                      styles.imageContainer,
                      {
                        borderRadius: imageCorner,
                        backgroundColor: imageBgColor,
                        ...(imageAspectRatio
                          ? { aspectRatio: imageAspectRatio }
                          : { height: imageHeight }),
                      },
                    ]}
                  >
                    <ProductImage
                      uri={product.imageUrl}
                      style={[styles.image, { borderRadius: imageCorner, backgroundColor: imageBgColor }]}
                      resizeMode={imageResizeMode}
                      placeholderBg={imageBgColor}
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
                {!cardImageActive && renderFavorite(product, isFavorite)}

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
                          {formatMoney(
                            product.priceAmount ?? product.price,
                            product.priceCurrency || product.currency || product.currencySymbol
                          )}
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
                        {formatMoney(
                          product.priceAmount ?? product.price,
                          product.priceCurrency || product.currency || product.currencySymbol
                        )}
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
  headerTextWrapper: {
    flex: 1,
  },
  headerText: {},
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
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    zIndex: 10,
    elevation: 6,
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


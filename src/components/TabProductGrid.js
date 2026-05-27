import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import {
  fetchShopifyCollectionProducts,
  fetchShopifyProducts,
} from "../services/shopify";
import { addItem } from "../store/slices/cartSlice";
import { isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import Snackbar from "./Snackbar";
import { resolveFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "./FavoriteToggleButton";
import { formatMoney } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { getResponsiveColumns } from "../utils/responsiveLayout";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toStr = (value, fallback = "") => {
  const r = unwrapValue(value, fallback);
  return r === undefined || r === null ? fallback : String(r);
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const toNum = (value, fallback) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === "") return fallback;
  if (typeof r === "number") return r;
  const n = parseFloat(r);
  return Number.isNaN(n) ? fallback : n;
};

const toBool = (value, fallback = true) => {
  const r = unwrapValue(value, fallback);
  if (typeof r === "boolean") return r;
  if (typeof r === "string") {
    const l = r.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
  }
  if (typeof r === "number") return r !== 0;
  return fallback;
};

const hasExplicitValue = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null) return false;
  if (typeof resolved === "string") return resolved.trim() !== "";
  return true;
};

const resolveBoolSetting = (values, fallback = true) => {
  for (const value of values) {
    if (hasExplicitValue(value)) return toBool(value, fallback);
  }
  return fallback;
};

const firstNum = (values, fallback) => {
  for (const value of values) {
    if (!hasExplicitValue(value)) continue;
    const resolved = toNum(value, undefined);
    if (resolved !== undefined) return resolved;
  }
  return fallback;
};

const parseAspectRatio = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return undefined;
  if (typeof resolved === "number" && resolved > 0) return resolved;
  const text = String(resolved).trim().toLowerCase();
  const ratioMatch = text.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = parseFloat(ratioMatch[1]);
    const height = parseFloat(ratioMatch[2]);
    return width > 0 && height > 0 ? width / height : undefined;
  }
  const parsed = parseFloat(text);
  return parsed > 0 ? parsed : undefined;
};

const toFontWeight = (value, fallback = "500") => {
  const r = unwrapValue(value, undefined);
  if (!r) return fallback;
  const s = String(r).trim().toLowerCase();
  if (s === "bold") return "700";
  if (s === "semibold" || s === "semi bold") return "600";
  if (s === "medium") return "500";
  if (s === "regular" || s === "normal") return "400";
  if (/^\d+$/.test(s)) return s;
  return fallback;
};

// Returns true if a hex color is "dark" (used to auto-pick text color)
const isDark = (hex) => {
  if (!hex || typeof hex !== "string") return false;
  const c = hex.replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
};

const normalizeAtcPosition = (value, fallback = "below") => {
  const resolved = toStr(value, fallback).toLowerCase();
  if (resolved.includes("above") || resolved.includes("top")) return "above";
  if (resolved.includes("overlay") || resolved.includes("on-image") || resolved.includes("on image")) return "overlay";
  return "below";
};

// limit is intentionally left undefined when the tab has no explicit productsToShow,
// so the caller can fall back to the global productsPerTab setting.
const normalizeTabs = (rawTabs = []) => {
  if (!Array.isArray(rawTabs)) return [];
  return rawTabs
    .map((tab, idx) => {
      const t = tab?.properties || tab || {};
      const id = toStr(t.id, `tab-${idx + 1}`);
      const label = toStr(t.label, "Tab");
      const handle = toStr(t.collectionHandle, "");
      const limit = toNum(t.productsToShow, undefined);
      if (!label) return null;
      return { id, label, handle, limit };
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

const isVariantAvailable = (variant) =>
  variant?.availableForSale !== false &&
  String(variant?.availableForSale).trim().toLowerCase() !== "false";

const isProductAvailable = (product) => {
  if (!product || typeof product !== "object") return true;
  if (product.availableForSale === false || String(product.availableForSale).trim().toLowerCase() === "false") return false;
  const inventory =
    product.inventoryQuantity ??
    product.totalInventory ??
    product.stockQuantity ??
    product.quantityAvailable;
  if (typeof inventory === "number" && inventory <= 0) return false;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const anyVariantAvailable = product.variants.some(isVariantAvailable);
    if (!anyVariantAvailable) return false;
  }
  return true;
};
const COL_GAP = 8;
const DEFAULT_IMAGE_ASPECT_RATIO = 1.55;

export default function TabProductGrid({ section }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { width: screenWidth } = useWindowDimensions();
  const { session, initializing } = useAuth();
  const wishlistItems = useSelector((state) => state?.wishlist?.items || []);
  const favoriteTapRef = useRef(false);

  // ── Parse DSL ──────────────────────────────────────────────────────────────
  const rawProps =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // rawConfig holds all the flat builder values
  const rawConfig = rawProps?.raw?.value || rawProps?.raw || rawProps || {};
  const visibilityConfig = rawConfig?.visibility?.properties || rawConfig?.visibility || {};
  const layoutNode = rawProps?.layout?.properties || rawProps?.layout || {};
  const layoutCss = layoutNode?.css?.value || layoutNode?.css?.properties || layoutNode?.css || {};
  const presentationNode = rawProps?.presentation?.properties || rawProps?.presentation || {};
  const presentationCss = presentationNode?.css?.value || presentationNode?.css?.properties || presentationNode?.css || {};
  const layoutCardCss = layoutCss?.card || {};
  const presentationCardCss = presentationCss?.card || {};
  const layoutCardTitleCss =
    layoutCss?.cardTitle ||
    layoutCardCss?.title ||
    presentationCss?.cardTitle ||
    presentationCardCss?.title ||
    layoutCss?.title ||
    {};
  const layoutCardPriceCss =
    layoutCss?.cardPrice ||
    layoutCss?.priceText ||
    layoutCardCss?.price ||
    presentationCss?.cardPrice ||
    presentationCss?.priceText ||
    presentationCardCss?.price ||
    layoutCss?.price ||
    {};
  const layoutCardImageCss =
    layoutCss?.cardImage ||
    layoutCss?.imageWrap ||
    layoutCss?.image ||
    layoutCardCss?.image ||
    presentationCss?.cardImage ||
    presentationCss?.imageWrap ||
    presentationCss?.image ||
    presentationCardCss?.image ||
    {};
  const layoutCardContentCss =
    layoutCss?.cardContent ||
    layoutCss?.content ||
    layoutCardCss?.content ||
    presentationCss?.cardContent ||
    presentationCss?.content ||
    presentationCardCss?.content ||
    {};
  const layoutAddToCartCss =
    layoutCss?.addToCartButton ||
    layoutCss?.addToCart ||
    layoutCardCss?.addToCart ||
    presentationCss?.addToCartButton ||
    presentationCss?.addToCart ||
    presentationCardCss?.addToCart ||
    {};
  const tabButtonCss = layoutCss?.tabButton || {};
  const carouselCss  = layoutCss?.carousel  || {};
  const tabBarCss    = layoutCss?.tabBar    || {};

  // ── Header props ──────────────────────────────────────────────────────────
  const showHeader      = toBool(rawConfig?.showHeader, false);
  const headerText      = toStr(rawConfig?.headerText ?? rawConfig?.title ?? rawConfig?.sectionTitle, "");
  const headerSize      = toNum(rawConfig?.headerSize ?? rawConfig?.headerFontSize ?? rawConfig?.titleSize, 16);
  const headerColor     = toStr(rawConfig?.headerColor ?? rawConfig?.titleColor, "#111827");
  const headerBold      = toBool(rawConfig?.headerBold, false);
  const headerItalic    = toBool(rawConfig?.headerItalic, false);
  const headerUnderline = toBool(rawConfig?.headerUnderline, false);
  const headerStrike    = toBool(rawConfig?.headerStrikethrough, false);
  const headerFamily    = cleanFontFamily(toStr(rawConfig?.headerFontFamily ?? rawConfig?.titleFontFamily, ""));
  const headerWeight    = toFontWeight(rawConfig?.headerFontWeight ?? rawConfig?.headerWeight, headerBold ? "700" : "600");
  const headerAlignRaw  = toStr(rawConfig?.headerAlign ?? rawConfig?.titleAlign, "left").toLowerCase();
  const headerTextAlign = headerAlignRaw === "center" ? "center" : headerAlignRaw === "right" ? "right" : "left";
  const headerDecorationLine = resolveTextDecorationLine({ underline: headerUnderline, strikethrough: headerStrike });

  const tabs = useMemo(() => normalizeTabs(rawConfig?.tabs || []), [rawConfig?.tabs]);

  const initialTabId =
    toStr(rawConfig?.activeTabId, "") || (tabs.length ? tabs[0].id : "");

  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [productsByTab, setProductsByTab] = useState({});
  const [loadingTabId, setLoadingTabId] = useState(null);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // ── Fetch products when active tab changes ─────────────────────────────────
  useEffect(() => {
    if (!activeTabId || productsByTab[activeTabId]) return;

    let alive = true;
    const limit = Math.max(1, Number(activeTab?.limit ?? toNum(rawConfig?.productsPerTab, 4)) || 4);
    const handle = activeTab?.handle || "";

    const load = async () => {
      setLoadingTabId(activeTabId);
      try {
        let items = [];

        if (handle && handle !== "all" && handle !== "frontpage") {
          const res = await fetchShopifyCollectionProducts({ handle, first: limit });
          const sourceProducts = (res?.products?.length ? res.products : await fetchShopifyProducts(limit)) || [];
          items = sourceProducts.map((p) => ({
            id: p.id,
            variantId: p.variantId || "",
            name: p.name || p.title,
            image: p.image || p.imageUrl,
            price: p.price || p.priceAmount,
            currency: p.currency || p.priceCurrency,
            handle: p.handle,
            availableForSale: p.availableForSale ?? true,
          }));
        } else {
          const list = await fetchShopifyProducts(limit);
          items = (list || []).map((p) => ({
            id: p.id,
            variantId: p.variantId || "",
            name: p.name || p.title,
            image: p.image || p.imageUrl,
            price: p.price || p.priceAmount,
            currency: p.currency || p.priceCurrency,
            handle: p.handle,
            availableForSale: p.availableForSale ?? true,
          }));
        }

        if (alive) {
          setProductsByTab((prev) => ({ ...prev, [activeTabId]: items }));
        }
      } catch (_) {
        if (alive) setProductsByTab((prev) => ({ ...prev, [activeTabId]: [] }));
      } finally {
        if (alive) setLoadingTabId(null);
      }
    };

    load();
    return () => { alive = false; };
  }, [activeTabId]);

  if (!tabs.length) return null;

  // ── Read styling from rawConfig ────────────────────────────────────────────
  const requestedColumns = Math.max(1, toNum(rawConfig?.columns, 2));
  const containerBg  = toStr(rawConfig?.bgColor || rawConfig?.gridBgColor, "#FFFFFF");
  const tabBarBg     = toStr(rawConfig?.tabBarBgColor ?? tabBarCss?.backgroundColor, containerBg);
  const tabBgColor   = toStr(rawConfig?.tabBgColor, "#E5E7EB");
  const tabTextColor = toStr(rawConfig?.tabTextColor, "#374151");
  const activeBg     = toStr(rawConfig?.tabActiveBgColor ?? tabButtonCss?.backgroundColor, "#111111");
  const activeText   = toStr(rawConfig?.tabActiveTextColor ?? tabButtonCss?.color, "#FFFFFF");
  const tabFontSize  = firstNum([rawConfig?.tabFontSize, tabButtonCss?.fontSize, rawConfig?.fontSize], 12);
  const tabFontWt    = toFontWeight(rawConfig?.tabFontWeight ?? tabButtonCss?.fontWeight, "600");
  const tabFamily    = cleanFontFamily(toStr(rawConfig?.tabFontFamily ?? tabButtonCss?.fontFamily ?? rawConfig?.fontFamily, ""));
  const tabBorderRadius = toNum(rawConfig?.tabBorderRadius ?? tabButtonCss?.borderRadius, 999);
  const tabPadT = firstNum([rawConfig?.tabPadT, tabButtonCss?.paddingTop], undefined);
  const tabPadB = firstNum([rawConfig?.tabPadB, tabButtonCss?.paddingBottom], undefined);
  const tabPadL = firstNum([rawConfig?.tabPadL, tabButtonCss?.paddingLeft], undefined);
  const tabPadR = firstNum([rawConfig?.tabPadR, tabButtonCss?.paddingRight], undefined);
  const tabPadX = firstNum([rawConfig?.tabPadX, tabButtonCss?.paddingHorizontal], 14);
  const tabPadY = firstNum([rawConfig?.tabPadY, tabButtonCss?.paddingVertical], 7);

  const paddingTop    = toNum(rawConfig?.paddingTop,    0);
  const paddingBottom = toNum(rawConfig?.paddingBottom, 0);
  const paddingLeft   = toNum(rawConfig?.paddingLeft,   16);
  const paddingRight  = toNum(rawConfig?.paddingRight,  16);

  const cardRadius     = toNum(rawConfig?.cardBorderRadius, 12);
  const imageCorner    = toNum(rawConfig?.cardImageCorner, 0);
  const cardTitleSize  = firstNum(
    [
      rawConfig?.productTitleSize,
      rawConfig?.itemTitleSize,
      rawConfig?.cardTitleSize,
      rawConfig?.cardTitleFontSize,
      layoutCardTitleCss?.fontSize,
    ],
    12
  );
  const cardTitleWt    = toFontWeight(
    rawConfig?.productTitleWeight ??
      rawConfig?.itemTitleWeight ??
      rawConfig?.cardTitleWeight ??
      layoutCardTitleCss?.fontWeight,
    "600"
  );
  const cardTitleFamily= cleanFontFamily(toStr(
    rawConfig?.productTitleFamily ??
      rawConfig?.itemTitleFamily ??
      rawConfig?.cardTitleFamily ??
      rawConfig?.cardTitleFontFamily ??
      layoutCardTitleCss?.fontFamily,
    ""
  ));
  const titleAlignRaw  = toStr(
    rawConfig?.titleAlign ??
      rawConfig?.cardTitleAlign ??
      rawConfig?.productTitleAlign ??
      rawConfig?.alignText ??
      layoutCardTitleCss?.textAlign,
    "Left"
  ).toLowerCase();
  const titleTextAlign = titleAlignRaw === "center" ? "center" : titleAlignRaw === "right" ? "right" : "left";
  const showFavorite   = resolveBoolSetting(
    [
      rawConfig?.favActive,
      rawConfig?.favEnabled,
      rawConfig?.showFavorite,
      rawConfig?.showFavoriteIcon,
      rawConfig?.favoriteActive,
      rawConfig?.favoriteVisible,
      rawConfig?.favoriteIconVisible,
      rawConfig?.addToFavoriteActive,
      rawConfig?.addToFavoriteVisible,
      visibilityConfig?.favorite,
      visibilityConfig?.favoriteIcon,
      visibilityConfig?.addToFavorite,
      rawConfig?.favoriteIconEnabled,
    ],
    true
  );
  const favoriteToggleConfig = buildFavoriteToggleConfig(rawConfig);
  const showAddToCart  = resolveBoolSetting(
    [
      rawConfig?.atcActive,
      rawConfig?.addToCartActive,
      rawConfig?.showAddToCart,
      rawConfig?.showCartButton,
      rawConfig?.addToCartVisible,
      rawConfig?.addToCartEnabled,
      rawConfig?.cartBtnEnabled,
      visibilityConfig?.addToCart,
      visibilityConfig?.atc,
      visibilityConfig?.button,
    ],
    true
  );
  const showPrice      = toBool(rawConfig?.showPrice ?? rawConfig?.cardPriceActive, true);
  const showTitleText  = toBool(rawConfig?.showTitle ?? rawConfig?.cardTitleActive, true);
  const imageBgColor = toStr(
    rawConfig?.imageBg ??
      rawConfig?.imageBgColor ??
      rawConfig?.imageBackgroundColor ??
      rawConfig?.productImageBgColor ??
      rawConfig?.productImageBackgroundColor ??
      layoutCardImageCss?.backgroundColor,
    "#FFFFFF"
  );
  const productImageResizeMode = resolveProductImageResizeMode(
    rawConfig?.imageScale,
    rawConfig?.scale,
    rawConfig?.imageResizeMode,
    layoutCardImageCss?.objectFit,
    layoutCardImageCss?.resizeMode
  );
  const explicitImageHeight = firstNum(
    [
      rawConfig?.cardImageHeight,
      rawConfig?.productImageHeight,
      rawConfig?.imageHeight,
      layoutCardImageCss?.height,
      layoutCardImageCss?.minHeight,
    ],
    undefined
  );
  const imageAspectRatio =
    parseAspectRatio(rawConfig?.cardImageAspectRatio) ||
    parseAspectRatio(rawConfig?.productImageAspectRatio) ||
    parseAspectRatio(rawConfig?.imageAspectRatio) ||
    parseAspectRatio(layoutCardImageCss?.aspectRatio) ||
    DEFAULT_IMAGE_ASPECT_RATIO;
  const priceSize      = firstNum(
    [
      rawConfig?.productPriceSize,
      rawConfig?.cardPriceSize,
      rawConfig?.priceFontSize,
      rawConfig?.standardPriceFontSize,
      rawConfig?.priceSize,
      layoutCardPriceCss?.fontSize,
    ],
    12
  );
  const priceWeight    = toFontWeight(
    rawConfig?.productPriceWeight ??
      rawConfig?.cardPriceWeight ??
      rawConfig?.priceWeight ??
      layoutCardPriceCss?.fontWeight,
    "600"
  );
  const priceFamily    = cleanFontFamily(toStr(
    rawConfig?.productPriceFamily ??
      rawConfig?.cardPriceFamily ??
      rawConfig?.priceFamily ??
      rawConfig?.priceFontFamily ??
      layoutCardPriceCss?.fontFamily,
    ""
  ));
  const priceAlignRaw  = toStr(
    rawConfig?.priceAlign ??
      rawConfig?.cardPriceAlign ??
      layoutCardPriceCss?.textAlign,
    "Left"
  ).toLowerCase();
  const priceTextAlign = priceAlignRaw === "center" ? "center" : priceAlignRaw === "right" ? "right" : "left";
  const atcPosition = normalizeAtcPosition(
    rawConfig?.atcPosition ??
      rawConfig?.addToCartPosition ??
      rawConfig?.cartButtonPosition ??
      rawConfig?.addToCart?.position ??
      rawConfig?.cartButton?.position ??
      rawConfig?.button?.position ??
      rawConfig?.position,
    "below"
  );
  const atcAlignRaw = toStr(
    rawConfig?.atcAlign ??
      rawConfig?.addToCart?.align ??
      rawConfig?.cartButton?.align ??
      rawConfig?.button?.align,
    "Left"
  ).toLowerCase();
  const atcAlign = atcAlignRaw === "center" ? "center" : atcAlignRaw === "right" ? "right" : "left";
  const atcAvailableText = toStr(rawConfig?.atcAvailableText ?? layoutAddToCartCss?.label ?? layoutAddToCartCss?.text, "Add To Cart");
  const atcSoldOutText = toStr(rawConfig?.atcSoldOutText ?? rawConfig?.unavailableText ?? layoutAddToCartCss?.soldOutLabel, "Item Not Available");
  const atcSize = firstNum([rawConfig?.atcSize, rawConfig?.atcFontSize, layoutAddToCartCss?.fontSize], 12);
  const atcBgColor = toStr(rawConfig?.atcBgColor ?? layoutAddToCartCss?.backgroundColor, "#096d70");
  const atcTextColor = toStr(rawConfig?.atcTextColor ?? layoutAddToCartCss?.color, "#FFFFFF");
  const atcSoldOutBgColor = toStr(rawConfig?.atcSoldOutBgColor ?? rawConfig?.unavailableBgColor, "#7A7A7A");
  const atcSoldOutTextColor = toStr(rawConfig?.atcSoldOutTextColor ?? rawConfig?.unavailableTextColor, "#FFFFFF");
  const atcFontFamily = cleanFontFamily(toStr(rawConfig?.atcFamily ?? layoutAddToCartCss?.fontFamily, ""));
  const atcFontWeight = toFontWeight(rawConfig?.atcWeight ?? layoutAddToCartCss?.fontWeight, "600");
  const atcBorderRadius = toNum(rawConfig?.atcCorner ?? rawConfig?.atcBorderRadius ?? rawConfig?.buttonRadius ?? layoutAddToCartCss?.borderRadius, 6);
  const atcPaddingTop = firstNum([rawConfig?.atcPadT, layoutAddToCartCss?.paddingTop], undefined);
  const atcPaddingRight = firstNum([rawConfig?.atcPadR, layoutAddToCartCss?.paddingRight], undefined);
  const atcPaddingBottom = firstNum([rawConfig?.atcPadB, layoutAddToCartCss?.paddingBottom], undefined);
  const atcPaddingLeft = firstNum([rawConfig?.atcPadL, layoutAddToCartCss?.paddingLeft], undefined);
  const atcPaddingX = firstNum([rawConfig?.atcPadX, layoutAddToCartCss?.paddingHorizontal], 10);
  const atcPaddingY = firstNum([rawConfig?.atcPadY, layoutAddToCartCss?.paddingVertical], 6);
  const atcBorderLine = toStr(rawConfig?.atcBorderLine ?? layoutAddToCartCss?.borderStyle, "");
  const atcBorderColor = toStr(rawConfig?.atcBorderColor ?? layoutAddToCartCss?.borderColor, "#E5E7EB");
  const contentPadT = firstNum([rawConfig?.contentPadT, rawConfig?.cardContentPadT, layoutCardContentCss?.paddingTop], 8);
  const contentPadB = firstNum([rawConfig?.contentPadB, rawConfig?.cardContentPadB, layoutCardContentCss?.paddingBottom], 10);
  const contentPadL = firstNum([rawConfig?.contentPadL, rawConfig?.cardContentPadL, layoutCardContentCss?.paddingLeft], 8);
  const contentPadR = firstNum([rawConfig?.contentPadR, rawConfig?.cardContentPadR, layoutCardContentCss?.paddingRight], 8);
  const contentGap = firstNum([rawConfig?.contentGap, rawConfig?.cardContentGap, layoutCardContentCss?.gap], 5);
  const titleLineHeight = firstNum(
    [rawConfig?.cardTitleLineHeight, rawConfig?.productTitleLineHeight, layoutCardTitleCss?.lineHeight],
    Math.round(cardTitleSize * 1.28)
  );
  const priceLineHeight = firstNum(
    [rawConfig?.priceLineHeight, rawConfig?.cardPriceLineHeight, layoutCardPriceCss?.lineHeight],
    Math.round(priceSize * 1.28)
  );
  const atcLineHeight = firstNum(
    [rawConfig?.atcLineHeight, layoutAddToCartCss?.lineHeight],
    Math.round(atcSize * 1.25)
  );
  const titleLines = Math.max(1, Math.round(firstNum(
    [rawConfig?.titleLines, rawConfig?.maxTitleLines, rawConfig?.cardTitleLines, rawConfig?.productTitleLines],
    2
  )));

  // Auto text color based on bg brightness
  const containerDark = isDark(containerBg);
  const cardTextColor = toStr(rawConfig?.titleColor ?? rawConfig?.cardTitleColor ?? rawConfig?.headlineColor ?? layoutCardTitleCss?.color, containerDark ? "#FFFFFF" : "#111111");
  const priceColor    = toStr(rawConfig?.priceColor ?? rawConfig?.cardPriceColor ?? rawConfig?.subtextColor ?? layoutCardPriceCss?.color, containerDark ? "#E5E7EB" : "#374151");

  // Carousel mode detection — unwrap DSL { const: "..." } envelope before stringifying
  const sectionComponent = String(
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    section?.type ||
    section?.componentType ||
    section?.sectionType ||
    ""
  ).toLowerCase().replace(/[\s-]+/g, "_");
  const isCarouselMode = sectionComponent.includes("carousel");

  // Carousel CSS values
  const carouselGap        = firstNum([carouselCss?.gap, rawConfig?.carouselGap], 12);
  const carouselPadLeft    = firstNum([carouselCss?.paddingLeft, carouselCss?.paddingHorizontal], 0);
  const carouselPadRight   = firstNum([carouselCss?.paddingRight, carouselCss?.paddingHorizontal], 0);
  const carouselPadTop     = firstNum([carouselCss?.paddingTop, carouselCss?.paddingVertical], 0);
  const carouselPadBottom  = firstNum([carouselCss?.paddingBottom, carouselCss?.paddingVertical], 0);

  // Card dimensions
  const viewportWidth = Math.max(1, screenWidth);
  const availableW = viewportWidth - paddingLeft - paddingRight;
  const gridColGap = firstNum(
    [rawConfig?.colGap, rawConfig?.columnGap, rawConfig?.gapX, layoutCss?.grid?.columnGap, layoutCss?.grid?.gap],
    COL_GAP
  );
  const gridRowGap = firstNum(
    [rawConfig?.rowGap, rawConfig?.gapY, layoutCss?.grid?.rowGap, layoutCss?.grid?.gap],
    COL_GAP
  );
  const columns = getResponsiveColumns({
    screenWidth: viewportWidth,
    requestedColumns,
    horizontalPadding: paddingLeft + paddingRight,
    gap: gridColGap,
    minCardWidth: 180,
    maxColumns: 6,
  });
  const colGap = columns > 1 ? gridColGap * (columns - 1) : 0;
  const cardW = Math.floor((availableW - colGap) / columns);
  const resolveImageHeight = (width) => {
    if (explicitImageHeight !== undefined) return explicitImageHeight;
    return Math.round(width / imageAspectRatio);
  };
  const gridImageHeight = resolveImageHeight(cardW);

  const products = productsByTab[activeTabId] || [];
  const isLoading = loadingTabId === activeTabId && products.length === 0;

  // ── Build grid rows ────────────────────────────────────────────────────────
  const rows = [];
  for (let i = 0; i < products.length; i += columns) {
    rows.push(products.slice(i, i + columns));
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleProductPress = useCallback((product) => {
    const handle = product?.handle || "";
    const id = product?.id || "";
    if (!handle && !id) return;

    navigation.navigate("ProductDetail", {
      product: {
        id,
        title: product?.name || product?.title || "",
        handle,
        imageUrl: product?.image || product?.imageUrl || "",
        priceAmount: product?.price ?? product?.priceAmount ?? null,
        priceCurrency: product?.currency || product?.priceCurrency || "",
        variantId: product?.variantId || "",
        availableForSale: product?.availableForSale ?? true,
      },
      handle,
      id,
    });
  }, [navigation]);

  const handleAddToCart = useCallback(async (product) => {
    const availableVariant =
      product?.variants?.find(isVariantAvailable) ||
      product?.variants?.[0];
    const variantId = product.variantId || availableVariant?.id || "";
    dispatch(
      addItem({
        item: {
          id: variantId || product.id,
          variantId,
          handle: product.handle || "",
          title: product.name || product.title || "",
          image: product.image || "",
          price: toNum(product.price, 0),
          variant: "",
          currency: product.currency || "",
          quantity: 1,
        },
      })
    );
    setSnackMessage("Product added to cart successfully.");
    setSnackVisible(true);
  }, [dispatch]);

  const handleToggleFavorite = useCallback(async (product, currentlyFav) => {
    const blocked = await requireLoginForAction({ session, navigation, initializing });
    if (blocked) return;
    const productId = String(
      product?.id || product?.variantId || product?.handle || product?.name || product?.title || ""
    ).trim();
    if (!productId) return;

    dispatch(
      toggleWishlist({
        product: {
          id: productId,
          title: product?.title || product?.name || "Product",
          image: product?.image || product?.imageUrl || "",
          price: product?.price ?? product?.priceAmount ?? 0,
          compareAtPrice: product?.compareAtPrice ?? product?.originalPrice ?? 0,
          currency: product?.currency || product?.priceCurrency || "",
          handle: product?.handle || "",
          vendor: product?.vendor || "",
        },
      })
    );
    setSnackMessage(
      currentlyFav
        ? "Product removed from wishlist successfully."
        : "Product added to wishlist successfully."
    );
    setSnackVisible(true);
  }, [dispatch, navigation, session]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderAddToCart = (product, inStock = true) => {
    const isAvailable = !!inStock;
    if (isAvailable && !showAddToCart) return null;

    const buttonText = isAvailable ? atcAvailableText : atcSoldOutText;
    const buttonBgColor = isAvailable ? atcBgColor : atcSoldOutBgColor;
    const buttonTextColor = isAvailable ? atcTextColor : atcSoldOutTextColor;
    const buttonPaddingTop = atcPaddingTop ?? atcPaddingY;
    const buttonPaddingRight = atcPaddingRight ?? atcPaddingX;
    const buttonPaddingBottom = atcPaddingBottom ?? atcPaddingY;
    const buttonPaddingLeft = atcPaddingLeft ?? atcPaddingX;

    return (
      <TouchableOpacity
        activeOpacity={isAvailable ? 0.8 : 1}
        disabled={!isAvailable}
        onPress={(e) => {
          e?.stopPropagation?.();
          if (isAvailable) handleAddToCart(product);
        }}
        style={[
          styles.cartBtn,
          atcPosition === "overlay" && styles.cartBtnOverlay,
          {
            marginTop: atcPosition === "below" ? 2 : 0,
            alignSelf:
              atcPosition === "overlay"
                ? "stretch"
                : atcAlign === "center"
                ? "center"
                : atcAlign === "right"
                ? "flex-end"
                : "flex-start",
            backgroundColor: buttonBgColor,
            borderRadius: atcBorderRadius,
            paddingTop: buttonPaddingTop,
            paddingRight: buttonPaddingRight,
            paddingBottom: buttonPaddingBottom,
            paddingLeft: buttonPaddingLeft,
            ...(atcBorderLine && atcBorderLine !== "none"
              ? {
                  borderWidth: 1,
                  borderColor: atcBorderColor,
                  borderStyle: atcBorderLine,
                }
              : {}),
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.cartBtnText,
            {
              color: buttonTextColor,
              fontSize: atcSize,
              lineHeight: atcLineHeight,
              fontWeight: atcFontWeight,
              ...(atcFontFamily ? { fontFamily: atcFontFamily } : {}),
            },
          ]}
        >
          {buttonText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        },
      ]}
    >
      {/* ── Section Header ── */}
      {showHeader && !!headerText && (
        <Text
          style={[
            styles.sectionHeader,
            {
              color: headerColor,
              fontSize: headerSize,
              fontWeight: headerWeight,
              fontStyle: headerItalic ? "italic" : "normal",
              textDecorationLine: headerDecorationLine,
              textAlign: headerTextAlign,
              ...(headerFamily ? { fontFamily: headerFamily } : {}),
            },
          ]}
        >
          {headerText}
        </Text>
      )}

      {/* ── Tab Bar ── */}
      <View style={[styles.tabBar, { backgroundColor: tabBarBg }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                activeOpacity={0.75}
                style={[
                  styles.tabButton,
                  {
                    backgroundColor: isActive ? activeBg : tabBgColor,
                    borderRadius: tabBorderRadius,
                    paddingTop:    tabPadT ?? tabPadY,
                    paddingBottom: tabPadB ?? tabPadY,
                    paddingLeft:   tabPadL ?? tabPadX,
                    paddingRight:  tabPadR ?? tabPadX,
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: isActive ? activeText : tabTextColor,
                    fontSize: tabFontSize,
                    lineHeight: Math.round(tabFontSize * 1.25),
                    fontWeight: tabFontWt,
                    ...(tabFamily ? { fontFamily: tabFamily } : {}),
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Products (Grid or Carousel) ── */}
      {isLoading ? (
        <ActivityIndicator
          style={{ paddingVertical: 32 }}
          color={containerDark ? "#FFFFFF" : "#6B7280"}
          size="small"
        />
      ) : products.length === 0 ? (
        <Text style={[styles.emptyText, { color: priceColor }]}>
          No products available
        </Text>
      ) : isCarouselMode ? (
        /* ── Horizontal carousel ── */
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: "row",
            gap: carouselGap,
            paddingLeft: carouselPadLeft || paddingLeft,
            paddingRight: carouselPadRight || paddingRight,
            paddingTop: carouselPadTop,
            paddingBottom: carouselPadBottom,
          }}
        >
          {products.map((product) => {
            const carouselCardW = Math.floor(viewportWidth * 0.42);
            const carouselImageHeight = resolveImageHeight(carouselCardW);
            const isFav = isWishlistProduct(wishlistItems, product);
            const inStock = isProductAvailable(product);
            return (
              <Pressable
                key={product.id}
                onPress={() => {
                  if (favoriteTapRef.current) {
                    favoriteTapRef.current = false;
                    return;
                  }
                  handleProductPress(product);
                }}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.9 },
                  {
                    width: carouselCardW,
                    borderRadius: cardRadius,
                    backgroundColor: containerBg,
                  },
                ]}
              >
                <View
                  style={[
                    styles.imageWrapper,
                    {
                      width: carouselCardW,
                      height: carouselImageHeight,
                      borderTopLeftRadius: cardRadius,
                      borderTopRightRadius: cardRadius,
                      borderBottomLeftRadius: imageCorner,
                      borderBottomRightRadius: imageCorner,
                      backgroundColor: imageBgColor,
                    },
                  ]}
                >
                  {product.image ? (
                    <Image
                      source={{ uri: product.image }}
                      style={styles.image}
                      resizeMode={productImageResizeMode}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder} />
                  )}
                  {showFavorite && (
                    <FavoriteToggleButton
                      isFavorite={isFav}
                      config={favoriteToggleConfig}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        favoriteTapRef.current = true;
                        setTimeout(() => {
                          favoriteTapRef.current = false;
                        }, 0);
                        handleToggleFavorite(product, isFav);
                      }}
                      accessibilityLabel={isFav ? "Remove from wishlist" : "Add to wishlist"}
                    />
                  )}
                  {(showAddToCart || !inStock) && atcPosition === "overlay" && renderAddToCart(product, inStock)}
                </View>
                <View
                  style={[
                    styles.cardContent,
                    {
                      paddingTop: contentPadT,
                      paddingBottom: contentPadB,
                      paddingLeft: contentPadL,
                      paddingRight: contentPadR,
                      gap: contentGap,
                    },
                  ]}
                >
                  {(showAddToCart || !inStock) && atcPosition === "above" && renderAddToCart(product, inStock)}
                  {showTitleText && (
                    <Text
                      allowFontScaling={false}
                      numberOfLines={titleLines}
                      style={[
                        styles.cardTitle,
                        {
                          color: cardTextColor,
                          fontSize: cardTitleSize,
                          lineHeight: titleLineHeight,
                          fontWeight: cardTitleWt,
                          textAlign: titleTextAlign,
                          ...(cardTitleFamily ? { fontFamily: cardTitleFamily } : {}),
                        },
                      ]}
                    >
                      {product.name || product.title || ""}
                    </Text>
                  )}
                  {showPrice && product.price && (
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.priceText,
                        {
                          color: priceColor,
                          fontSize: priceSize,
                          lineHeight: priceLineHeight,
                          fontWeight: priceWeight,
                          textAlign: priceTextAlign,
                          ...(priceFamily ? { fontFamily: priceFamily } : {}),
                        },
                      ]}
                    >
                      {formatMoney(product.price, product.currency || product.priceCurrency)}
                    </Text>
                  )}
                  {(showAddToCart || !inStock) && atcPosition === "below" && renderAddToCart(product, inStock)}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        /* ── Vertical grid ── */
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={[
                styles.row,
                { marginBottom: rowIdx < rows.length - 1 ? gridRowGap : 0 },
              ]}
            >
              {row.map((product, colIdx) => {
                const isFav = isWishlistProduct(wishlistItems, product);
                const inStock = isProductAvailable(product);
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => {
                      if (favoriteTapRef.current) {
                        favoriteTapRef.current = false;
                        return;
                      }
                      handleProductPress(product);
                    }}
                    style={({ pressed }) => [
                      styles.card,
                      pressed && { opacity: 0.9 },
                      {
                        width: cardW,
                        borderRadius: cardRadius,
                        backgroundColor: containerBg,
                        marginRight: colIdx < row.length - 1 ? gridColGap : 0,
                      },
                    ]}
                  >
                    {/* Image + Favourite */}
                    <View
                      style={[
                        styles.imageWrapper,
                        {
                          width: cardW,
                          height: gridImageHeight,
                          borderTopLeftRadius: cardRadius,
                          borderTopRightRadius: cardRadius,
                          borderBottomLeftRadius: imageCorner,
                          borderBottomRightRadius: imageCorner,
                          backgroundColor: imageBgColor,
                        },
                      ]}
                    >
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.image}
                          resizeMode={productImageResizeMode}
                        />
                      ) : (
                        <View style={styles.imagePlaceholder} />
                      )}

                      {showFavorite && (
                        <FavoriteToggleButton
                          isFavorite={isFav}
                          config={favoriteToggleConfig}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            favoriteTapRef.current = true;
                            setTimeout(() => {
                              favoriteTapRef.current = false;
                            }, 0);
                            handleToggleFavorite(product, isFav);
                          }}
                          accessibilityLabel={isFav ? "Remove from wishlist" : "Add to wishlist"}
                        />
                      )}

                      {(showAddToCart || !inStock) && atcPosition === "overlay" && renderAddToCart(product, inStock)}
                    </View>

                    {/* Card content */}
                    <View
                      style={[
                        styles.cardContent,
                        {
                          paddingTop: contentPadT,
                          paddingBottom: contentPadB,
                          paddingLeft: contentPadL,
                          paddingRight: contentPadR,
                          gap: contentGap,
                        },
                      ]}
                    >
                      {(showAddToCart || !inStock) && atcPosition === "above" && renderAddToCart(product, inStock)}

                      {showTitleText && (
                        <Text
                          allowFontScaling={false}
                          numberOfLines={titleLines}
                          style={[
                            styles.cardTitle,
                            {
                              color: cardTextColor,
                              fontSize: cardTitleSize,
                              lineHeight: titleLineHeight,
                              fontWeight: cardTitleWt,
                              textAlign: titleTextAlign,
                              ...(cardTitleFamily ? { fontFamily: cardTitleFamily } : {}),
                            },
                          ]}
                        >
                          {product.name || product.title || ""}
                        </Text>
                      )}

                      {showPrice && product.price && (
                        <Text
                          allowFontScaling={false}
                          style={[
                            styles.priceText,
                            {
                              color: priceColor,
                              fontSize: priceSize,
                              lineHeight: priceLineHeight,
                              fontWeight: priceWeight,
                              textAlign: priceTextAlign,
                              ...(priceFamily ? { fontFamily: priceFamily } : {}),
                            },
                          ]}
                        >
                          {formatMoney(product.price, product.currency || product.priceCurrency)}
                        </Text>
                      )}

                      {(showAddToCart || !inStock) && atcPosition === "below" && renderAddToCart(product, inStock)}
                    </View>
                  </Pressable>
                );
              })}

              {/* Fill empty slots in last row so columns align */}
              {row.length < columns &&
                Array.from({ length: columns - row.length }).map((_, i) => (
                  <View key={`empty-${i}`} style={{ width: cardW }} />
                ))}
            </View>
          ))}
        </View>
      )}

      <Snackbar
        visible={snackVisible}
        message={snackMessage}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  sectionHeader: {
    marginBottom: 10,
    lineHeight: 22,
  },
  tabBar: {
    marginBottom: 12,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  card: {
    overflow: "hidden",
  },
  imageWrapper: {
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  cardContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 5,
  },
  cardTitle: {
    lineHeight: 17,
    alignSelf: "stretch",
    width: "100%",
  },
  priceText: {
    fontSize: 12,
    fontWeight: "600",
    alignSelf: "stretch",
    width: "100%",
  },
  cartBtn: {
    marginTop: 2,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  cartBtnOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 6,
  },
  cartBtnText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 13,
  },
});


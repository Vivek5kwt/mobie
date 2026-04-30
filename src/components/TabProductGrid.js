import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
import { toggleWishlist } from "../store/slices/wishlistSlice";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";

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

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

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

const resolveIconName = (value, fallback) =>
  resolveFA4IconName(toStr(value, fallback)) || fallback;

const normalizeAtcPosition = (value, fallback = "below") => {
  const resolved = toStr(value, fallback).toLowerCase();
  if (resolved.includes("above") || resolved.includes("top")) return "above";
  if (resolved.includes("overlay") || resolved.includes("on-image") || resolved.includes("on image")) return "overlay";
  return "below";
};

const normalizeTabs = (rawTabs = []) => {
  if (!Array.isArray(rawTabs)) return [];
  return rawTabs
    .map((tab, idx) => {
      const t = tab?.properties || tab || {};
      const id = toStr(t.id, `tab-${idx + 1}`);
      const label = toStr(t.label, "Tab");
      const handle = toStr(t.collectionHandle, "");
      const limit = toNum(t.productsToShow, 4);
      if (!label) return null;
      return { id, label, handle, limit };
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const COL_GAP = 8;

export default function TabProductGrid({ section }) {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const wishlistItems = useSelector((state) => state?.wishlist?.items || []);

  // ── Parse DSL ──────────────────────────────────────────────────────────────
  const rawProps =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // rawConfig holds all the flat builder values
  const rawConfig = rawProps?.raw?.value || rawProps?.raw || rawProps || {};
  const layoutNode = rawProps?.layout?.properties || rawProps?.layout || {};
  const layoutCss = layoutNode?.css?.value || layoutNode?.css?.properties || layoutNode?.css || {};
  const layoutCardTitleCss = layoutCss?.cardTitle || layoutCss?.title || {};
  const layoutCardPriceCss = layoutCss?.price || layoutCss?.priceText || {};
  const layoutAddToCartCss = layoutCss?.addToCartButton || layoutCss?.addToCart || {};

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
  const wishlistIds = useMemo(
    () =>
      new Set(
        wishlistItems
          .map((item) => String(item?.id || "").trim())
          .filter(Boolean)
      ),
    [wishlistItems]
  );

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // ── Fetch products when active tab changes ─────────────────────────────────
  useEffect(() => {
    if (!activeTabId || productsByTab[activeTabId]) return;

    let alive = true;
    const limit = Math.max(1, Number(activeTab?.limit || toNum(rawConfig?.productsPerTab, 4)) || 4);
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
  const columns = Math.max(1, toNum(rawConfig?.columns, 2));
  const containerBg  = toStr(rawConfig?.bgColor || rawConfig?.gridBgColor, "#FFFFFF");
  const tabBarBg     = toStr(rawConfig?.tabBarBgColor, containerBg);
  const tabBgColor   = toStr(rawConfig?.tabBgColor, "#E5E7EB");
  const tabTextColor = toStr(rawConfig?.tabTextColor, "#374151");
  const activeBg     = toStr(rawConfig?.tabActiveBgColor, "#111111");
  const activeText   = toStr(rawConfig?.tabActiveTextColor, "#FFFFFF");
  const tabFontSize  = toNum(rawConfig?.tabFontSize, 12);
  const tabFontWt    = toFontWeight(rawConfig?.tabFontWeight, "600");
  const tabFamily    = cleanFontFamily(toStr(rawConfig?.tabFontFamily, ""));

  const paddingTop    = toNum(rawConfig?.paddingTop,    0);
  const paddingBottom = toNum(rawConfig?.paddingBottom, 0);
  const paddingLeft   = toNum(rawConfig?.paddingLeft,   16);
  const paddingRight  = toNum(rawConfig?.paddingRight,  16);

  const cardRadius     = toNum(rawConfig?.cardBorderRadius, 12);
  const imageCorner    = toNum(rawConfig?.cardImageCorner, 0);
  const cardTitleSize  = toNum(rawConfig?.cardTitleSize ?? rawConfig?.titleSize ?? rawConfig?.headlineSize ?? layoutCardTitleCss?.fontSize, 12);
  const cardTitleWt    = toFontWeight(rawConfig?.cardTitleWeight ?? rawConfig?.titleWeight ?? rawConfig?.headlineWeight ?? layoutCardTitleCss?.fontWeight, "600");
  const cardTitleFamily= cleanFontFamily(toStr(rawConfig?.cardTitleFamily ?? rawConfig?.titleFontFamily ?? rawConfig?.headlineFontFamily ?? layoutCardTitleCss?.fontFamily, ""));
  const titleAlignRaw  = toStr(
    rawConfig?.titleAlign ??
      rawConfig?.cardTitleAlign ??
      rawConfig?.productTitleAlign ??
      rawConfig?.alignText ??
      layoutCardTitleCss?.textAlign,
    "Left"
  ).toLowerCase();
  const titleTextAlign = titleAlignRaw === "center" ? "center" : titleAlignRaw === "right" ? "right" : "left";
  const titleWrap = toBool(
    rawConfig?.titleWrap ?? rawConfig?.textWrap ?? rawConfig?.cardTitleWrap ?? rawConfig?.productTitleWrap,
    false
  );

  const showFavorite   = toBool(
    rawConfig?.favoriteIconEnabled ??
      rawConfig?.favActive ??
      rawConfig?.showFavorite ??
      rawConfig?.showFavoriteIcon ??
      rawConfig?.favEnabled,
    true
  );
  const favoriteIconName = resolveIconName(
    rawConfig?.favoriteIconId ?? rawConfig?.favoriteIcon ?? rawConfig?.favIcon,
    "heart"
  );
  const unfavoriteIconName = resolveIconName(
    rawConfig?.unfavoriteIconId ?? rawConfig?.unfavoriteIcon ?? rawConfig?.unfavIcon,
    "heart-o"
  );
  const favoriteIconSize = toNum(rawConfig?.favoriteIconSize ?? rawConfig?.favIconSize, 16);
  const unfavoriteIconSize = toNum(rawConfig?.unfavoriteIconSize ?? rawConfig?.unfavIconSize, favoriteIconSize);
  const favoriteIconColor = toStr(
    rawConfig?.favoriteIconColor ?? rawConfig?.favoriteColor ?? rawConfig?.favIconColor ?? rawConfig?.favColor,
    "#EF4444"
  );
  const unfavoriteIconColor = toStr(
    rawConfig?.unfavoriteIconColor ?? rawConfig?.unfavoriteColor ?? rawConfig?.favIconInactiveColor,
    "#9CA3AF"
  );
  const favoriteBadgeBgColor = toStr(
    rawConfig?.favoriteBackgroundColor ?? rawConfig?.favoriteBgColor ?? rawConfig?.favBgColor,
    "rgba(255,255,255,0.95)"
  );
  const showAddToCart  = toBool(rawConfig?.showAddToCart ?? rawConfig?.atcActive, true);
  const showPrice      = toBool(rawConfig?.showPrice ?? rawConfig?.cardPriceActive, true);
  const showTitleText  = toBool(rawConfig?.showTitle ?? rawConfig?.cardTitleActive, true);
  const priceSize      = toNum(rawConfig?.priceSize ?? rawConfig?.subtextSize ?? layoutCardPriceCss?.fontSize, 12);
  const priceWeight    = toFontWeight(rawConfig?.priceWeight ?? rawConfig?.subtextWeight ?? layoutCardPriceCss?.fontWeight, "600");
  const priceFamily    = cleanFontFamily(toStr(rawConfig?.priceFamily ?? rawConfig?.subtextFontFamily ?? layoutCardPriceCss?.fontFamily, ""));
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
  const atcSoldOutText = toStr(rawConfig?.atcSoldOutText ?? layoutAddToCartCss?.soldOutLabel, "Sold Out");
  const atcSize = toNum(rawConfig?.atcSize ?? layoutAddToCartCss?.fontSize, 12);
  const atcBgColor = toStr(rawConfig?.atcBgColor ?? layoutAddToCartCss?.backgroundColor, "#096d70");
  const atcTextColor = toStr(rawConfig?.atcTextColor ?? layoutAddToCartCss?.color, "#FFFFFF");
  const atcSoldOutBgColor = toStr(rawConfig?.atcSoldOutBgColor, "#E5E7EB");
  const atcSoldOutTextColor = toStr(rawConfig?.atcSoldOutTextColor, "#111827");
  const atcFontFamily = cleanFontFamily(toStr(rawConfig?.atcFamily ?? layoutAddToCartCss?.fontFamily, ""));
  const atcFontWeight = toFontWeight(rawConfig?.atcWeight ?? layoutAddToCartCss?.fontWeight, "600");
  const atcBorderRadius = toNum(rawConfig?.atcCorner ?? rawConfig?.atcBorderRadius ?? layoutAddToCartCss?.borderRadius, 6);
  const atcPaddingTop = toNum(rawConfig?.atcPadT ?? layoutAddToCartCss?.paddingTop, undefined);
  const atcPaddingRight = toNum(rawConfig?.atcPadR ?? layoutAddToCartCss?.paddingRight, undefined);
  const atcPaddingBottom = toNum(rawConfig?.atcPadB ?? layoutAddToCartCss?.paddingBottom, undefined);
  const atcPaddingLeft = toNum(rawConfig?.atcPadL ?? layoutAddToCartCss?.paddingLeft, undefined);
  const atcPaddingX = toNum(rawConfig?.atcPadX ?? layoutAddToCartCss?.paddingHorizontal, 10);
  const atcPaddingY = toNum(rawConfig?.atcPadY ?? layoutAddToCartCss?.paddingVertical, 6);
  const atcBorderLine = toStr(rawConfig?.atcBorderLine ?? layoutAddToCartCss?.borderStyle, "");
  const atcBorderColor = toStr(rawConfig?.atcBorderColor ?? layoutAddToCartCss?.borderColor, "#E5E7EB");

  // Auto text color based on bg brightness
  const containerDark = isDark(containerBg);
  const cardTextColor = toStr(rawConfig?.titleColor ?? rawConfig?.cardTitleColor ?? rawConfig?.headlineColor ?? layoutCardTitleCss?.color, containerDark ? "#FFFFFF" : "#111111");
  const priceColor    = toStr(rawConfig?.priceColor ?? rawConfig?.cardPriceColor ?? rawConfig?.subtextColor ?? layoutCardPriceCss?.color, containerDark ? "#E5E7EB" : "#374151");

  // Card dimensions
  const availableW = SCREEN_W - paddingLeft - paddingRight;
  const colGap = columns > 1 ? COL_GAP * (columns - 1) : 0;
  const cardW = Math.floor((availableW - colGap) / columns);

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

  const handleAddToCart = useCallback((product) => {
    dispatch(
      addItem({
        item: {
          id: product.variantId || product.id,
          variantId: product.variantId || "",
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
  }, [dispatch]);

  const handleToggleFavorite = useCallback((product) => {
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
  }, [dispatch]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderAddToCart = (product, inStock = true) => {
    if (!showAddToCart) return null;

    const isAvailable = !!inStock;
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
          style={[
            styles.cartBtnText,
            {
              color: buttonTextColor,
              fontSize: atcSize,
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
                  },
                ]}
              >
                <Text
                  style={{
                    color: isActive ? activeText : tabTextColor,
                    fontSize: tabFontSize,
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

      {/* ── Product Grid ── */}
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
      ) : (
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View
              key={rowIdx}
              style={[
                styles.row,
                { marginBottom: rowIdx < rows.length - 1 ? COL_GAP : 0 },
              ]}
            >
              {row.map((product, colIdx) => {
                const productId = String(
                  product?.id || product?.variantId || product?.handle || product?.name || product?.title || ""
                ).trim();
                const isFav = productId ? wishlistIds.has(productId) : false;
                const inStock = product.availableForSale !== false;
                return (
                  <Pressable
                    key={product.id}
                    onPress={() => handleProductPress(product)}
                    style={({ pressed }) => [
                      styles.card,
                      pressed && { opacity: 0.9 },
                      {
                        width: cardW,
                        borderRadius: cardRadius,
                        backgroundColor: containerBg,
                        marginRight: colIdx < row.length - 1 ? COL_GAP : 0,
                      },
                    ]}
                  >
                    {/* Image + Favourite */}
                    <View
                      style={[
                        styles.imageWrapper,
                        {
                          width: cardW,
                          height: cardW,
                          borderTopLeftRadius: cardRadius,
                          borderTopRightRadius: cardRadius,
                          borderBottomLeftRadius: imageCorner,
                          borderBottomRightRadius: imageCorner,
                        },
                      ]}
                    >
                      {product.image ? (
                        <Image
                          source={{ uri: product.image }}
                          style={styles.image}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imagePlaceholder} />
                      )}

                      {showFavorite && (
                        <TouchableOpacity
                          style={[
                            styles.favBtn,
                            { backgroundColor: favoriteBadgeBgColor },
                          ]}
                          activeOpacity={0.8}
                          onPress={() => handleToggleFavorite(product)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={isFav ? "Remove from wishlist" : "Add to wishlist"}
                        >
                          <FontAwesome
                            name={isFav ? favoriteIconName : unfavoriteIconName}
                            size={isFav ? favoriteIconSize : unfavoriteIconSize}
                            color={isFav ? favoriteIconColor : unfavoriteIconColor}
                            style={styles.favIcon}
                          />
                        </TouchableOpacity>
                      )}

                      {showAddToCart && atcPosition === "overlay" && renderAddToCart(product, inStock)}
                    </View>

                    {/* Card content */}
                    <View style={styles.cardContent}>
                      {showAddToCart && atcPosition === "above" && renderAddToCart(product, inStock)}

                      {showTitleText && (
                        <Text
                          numberOfLines={titleWrap ? 1 : 2}
                          style={[
                            styles.cardTitle,
                            {
                              color: cardTextColor,
                              fontSize: cardTitleSize,
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
                          style={[
                            styles.priceText,
                            {
                              color: priceColor,
                              fontSize: priceSize,
                              fontWeight: priceWeight,
                              textAlign: priceTextAlign,
                              ...(priceFamily ? { fontFamily: priceFamily } : {}),
                            },
                          ]}
                        >
                          {product.currency} {parseFloat(product.price).toFixed(1)}
                        </Text>
                      )}

                      {showAddToCart && atcPosition === "below" && renderAddToCart(product, inStock)}
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
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
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
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  favBtn: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 5,
  },
  favIcon: {
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
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

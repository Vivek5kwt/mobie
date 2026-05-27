import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { resolveFA4IconName } from "../utils/faIconAlias";
import { addItem } from "../store/slices/cartSlice";
import { isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import { fetchShopifyRecentProducts } from "../services/shopify";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { getResponsiveColumns } from "../utils/responsiveLayout";
import { resolveFirstFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "./FavoriteToggleButton";
import { formatMoney } from "../utils/money";
import Snackbar from "./Snackbar";

// ─── DSL helpers ─────────────────────────────────────────────────────────────

const unwrap = (v, fallback = undefined) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return unwrap(v.value, fallback);
  if (v.const !== undefined) return unwrap(v.const, fallback);
  if (v.properties !== undefined) return unwrap(v.properties, fallback);
  return v;
};

const str = (v, fb = "") => {
  const r = unwrap(v, fb);
  return r === undefined || r === null ? fb : String(r);
};

const num = (v, fb) => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === null || r === "") return fb;
  if (typeof r === "number") return r;
  const p = parseFloat(String(r));
  return Number.isNaN(p) ? fb : p;
};

const parsePx = (v, fb) => {
  if (v === undefined || v === null || v === "") return fb;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? fb : n;
};

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const parseBorder = (borderValue, fallbackColor = "#E5E7EB") => {
  const border = str(borderValue, "");
  if (!border || border.toLowerCase() === "none") return null;
  const widthMatch = border.match(/(\d+(?:\.\d+)?)px/i);
  const colorMatch = border.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|[a-z]+/i);
  return {
    borderWidth: widthMatch ? parseFloat(widthMatch[1]) : 1,
    borderColor: colorMatch ? colorMatch[0] : fallbackColor,
  };
};

const fwMap = { thin:"100", extralight:"200", light:"300", regular:"400", medium:"500", semibold:"600", bold:"700", extrabold:"800", black:"900" };
const toFW = (v, fb = "400") => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === null) return fb;
  if (typeof r === "number") return String(r);
  return fwMap[String(r).trim().toLowerCase()] || String(r);
};

const bool = (v, fb = true) => {
  const r = unwrap(v, fb);
  if (r === undefined || r === null) return fb;
  if (typeof r === "boolean") return r;
  if (typeof r === "number") return r !== 0;
  const s = String(r).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fb;
};

const toDecorationLine = (...vals) => {
  const raw = vals.find((v) => v !== undefined && v !== null && v !== "");
  if (raw === undefined) return "none";
  if (typeof raw === "boolean") return raw ? "line-through" : "none";
  const s = String(raw).trim().toLowerCase();
  if (s.includes("line-through") || s.includes("strikethrough")) return "line-through";
  if (s.includes("underline")) return "underline";
  return "none";
};

const decorationEnabled = (value, type) => {
  const resolved = unwrap(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return false;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const normalized = String(resolved).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "none"].includes(normalized)) return false;
  if (type === "underline") return normalized.includes("underline");
  return normalized.includes("line-through") || normalized.includes("strikethrough");
};

const toTextDecorationLine = ({ underline, strikethrough }) => {
  const hasUnderline = decorationEnabled(underline, "underline");
  const hasStrikethrough = decorationEnabled(strikethrough, "strikethrough");
  if (hasUnderline && hasStrikethrough) return "underline line-through";
  if (hasUnderline) return "underline";
  if (hasStrikethrough) return "line-through";
  return "none";
};

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
// ─── Currency symbol lookup ───────────────────────────────────────────────────

const normalizeProducts = (value) => {
  const unwrapped = unwrap(value, []);
  if (!Array.isArray(unwrapped)) return [];
  return unwrapped
    .map((item, index) => {
      const product = unwrap(item, item);
      if (!product || typeof product !== "object") return null;
      const title = str(product.title ?? product.name, "");
      const id = str(product.id ?? product.variantId ?? product.handle ?? title ?? index, "");
      if (!id && !title) return null;
      return {
        ...product,
        id,
        title: title || "Product",
        imageUrl: product.imageUrl || product.image || "",
        image: product.image || product.imageUrl || "",
        priceAmount: product.priceAmount ?? product.price ?? 0,
        priceCurrency: product.priceCurrency || product.currency || "",
      };
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecentProducts({ section }) {
  const navigation = useNavigation();
  const dispatch   = useDispatch();
  const { session, initializing } = useAuth();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);

  // ── DSL extraction ─────────────────────────────────────────────────────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw = unwrap(propsNode?.raw, {});
  const manualProducts = useMemo(() => normalizeProducts(raw?.items), [raw?.items]);
  const hasManualProducts = manualProducts.length > 0;

  // layout.css contains card/atc/image/header/price styling
  const layoutRaw = unwrap(propsNode?.layout, {});
  const css       = unwrap(layoutRaw?.css, {});

  // ── Settings ───────────────────────────────────────────────────────────────
  // Use `header` / `sectionTitle` — NOT `title`, which ProductDetailScreen merges
  // with the current product's name via buildProductDefaults, causing the product
  // name to appear as the section heading.
  const sectionTitle  = str(firstDefined(raw?.header, raw?.sectionTitle, raw?.title), "Recently Viewed");
  const limit         = Math.max(1, num(firstDefined(raw?.itemsShown, raw?.limit), 4));
  const shopifyDomain = str(raw?.shopifyDomain, "");
  const shopifyToken  = str(raw?.storefrontToken, "");
  const requestedColumns = Math.max(1, Math.round(num(raw?.columns, 2)));
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);

  // ── Container ─────────────────────────────────────────────────────────────
  const containerCss = unwrap(css?.container, {});
  const containerBg  = str(raw?.backgroundColor ?? containerCss?.background ?? containerCss?.backgroundColor, "#FFFFFF");
  const containerPT  = parsePx(firstDefined(raw?.paddingTop, raw?.pt, containerCss?.paddingTop), 0);
  const containerPB  = parsePx(firstDefined(raw?.paddingBottom, raw?.pb, containerCss?.paddingBottom), 0);
  const containerPL  = parsePx(firstDefined(raw?.paddingLeft, raw?.pl, containerCss?.paddingLeft), 0);
  const containerPR  = parsePx(firstDefined(raw?.paddingRight, raw?.pr, containerCss?.paddingRight), 0);
  const containerRadius = parsePx(firstDefined(raw?.borderRadius, containerCss?.borderRadius), 0);

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerCss     = unwrap(css?.header, {});
  const headerColor   = str(raw?.headerColor ?? headerCss?.color, "#111111");
  const headerSize    = parsePx(raw?.headerSize ?? headerCss?.fontSize, 14);
  const headerWeight  = toFW(raw?.headerWeight ?? headerCss?.fontWeight, "700");
  const headerFamily  = resolveFirstFont(raw?.headerFamily, raw?.headlineFontFamily, headerCss?.fontFamily, raw?.fontFamily);
  const headerDecoration = toTextDecorationLine({
    underline: firstDefined(raw?.headerUnderline, raw?.sectionTitleUnderline, raw?.headlineUnderline),
    strikethrough: firstDefined(raw?.headerStrikethrough, raw?.sectionTitleStrikethrough, raw?.headlineStrikethrough),
  });
  const headerMB      = parsePx(headerCss?.marginBottom, 8);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const gridCss  = unwrap(css?.grid, {});
  const gridGap  = parsePx(raw?.gap ?? gridCss?.gap, 12);
  const layoutWidth = measuredWidth > 0 ? measuredWidth : windowWidth;
  const columns = getResponsiveColumns({
    screenWidth: layoutWidth,
    requestedColumns,
    horizontalPadding: containerPL + containerPR,
    gap: gridGap,
    minCardWidth: 170,
    maxColumns: 6,
  });

  // ── Card width (needed before imageHeight so we can use it as the default) ─
  const gridWidth = Math.max(0, layoutWidth - containerPL - containerPR);
  const cardWidth = Math.max(0, (gridWidth - gridGap * (columns - 1)) / columns);

  // ── Card ──────────────────────────────────────────────────────────────────
  const cardCss    = unwrap(css?.card, {});
  const cardBg     = str(cardCss?.background ?? cardCss?.backgroundColor, "#FFFFFF");
  const cardRadius = parsePx(raw?.cardRadius ?? cardCss?.borderRadius, 10);
  const parsedCardBorder = parseBorder(cardCss?.border, str(raw?.cardBorderColor, "#E5E7EB"));
  const rawBorderWidth = firstDefined(raw?.cardBorderWidth, raw?.borderWidth);
  const allowLayoutBorder = bool(firstDefined(raw?.useLayoutCardBorder, raw?.useCssCardBorder), false);
  const cardBorderEnabled = bool(
    firstDefined(raw?.cardBorderEnabled, raw?.showCardBorder, raw?.borderEnabled, raw?.showBorder),
    rawBorderWidth !== undefined ? num(rawBorderWidth, 0) > 0 : allowLayoutBorder
  );
  const cardBorder = cardBorderEnabled
    ? {
        borderWidth: num(rawBorderWidth, parsedCardBorder?.borderWidth ?? 1),
        borderColor: str(firstDefined(raw?.cardBorderColor, raw?.borderColor), parsedCardBorder?.borderColor ?? "#E5E7EB"),
      }
    : { borderWidth: 0, borderColor: "transparent" };
  const cardShadowEnabled = bool(firstDefined(raw?.cardShadowEnabled, raw?.showCardShadow, raw?.shadowEnabled), true);
  const cardShadowStyle = cardShadowEnabled
    ? {
        shadowColor: str(raw?.cardShadowColor, "#000000"),
        shadowOffset: {
          width: parsePx(raw?.cardShadowOffsetX, 0),
          height: parsePx(raw?.cardShadowOffsetY, 3),
        },
        shadowOpacity: num(raw?.cardShadowOpacity, 0.08),
        shadowRadius: parsePx(raw?.cardShadowRadius, 8),
        elevation: num(raw?.cardElevation, 2),
      }
    : {};

  // ── Image ─────────────────────────────────────────────────────────────────
  const imageWrapCss  = unwrap(css?.imageWrap, {});
  const imageCss      = unwrap(css?.image, {});
  // Default height = cardWidth → square image area, shows full product photo
  const imageHeight   = parsePx(raw?.imageHeight ?? imageWrapCss?.height, cardWidth);
  const imageBgColor  = str(
    raw?.imageBgColor ??
      raw?.productImageBgColor ??
      raw?.imageBackgroundColor ??
      raw?.productImageBackgroundColor ??
      raw?.imageBg ??
      imageWrapCss?.backgroundColor ??
      imageWrapCss?.background ??
      imageCss?.backgroundColor ??
      imageCss?.background,
    "#FFFFFF"
  );
  const imagePad      = parsePx(raw?.imagePad ?? raw?.imagePadding ?? imageWrapCss?.padding, 0);
  const imageResizeMode = resolveProductImageResizeMode(
    raw?.imageScale,
    raw?.scale,
    raw?.imageResizeMode,
    imageCss?.objectFit,
    imageCss?.resizeMode
  );

  // ── Card details padding ──────────────────────────────────────────────────
  const detailsCss = unwrap(css?.details, {});
  const detailsPad = parsePx(raw?.detailsPadding ?? detailsCss?.padding, 8);

  // ── Product title ─────────────────────────────────────────────────────────
  const titleCss    = unwrap(css?.title, {});
  const titleColor  = str(raw?.titleColor ?? titleCss?.color, "#111827");
  const titleSize   = parsePx(firstDefined(raw?.titleFontSize, raw?.titleSize, titleCss?.fontSize), 12);
  const titleWeight = toFW(firstDefined(raw?.titleFontWeight, raw?.titleWeight, titleCss?.fontWeight), "400");
  const titleFamily = resolveFirstFont(raw?.titleFontFamily, raw?.productTitleFontFamily, titleCss?.fontFamily, raw?.fontFamily);
  const titleLines  = 1;
  const titleDecoration = toDecorationLine(raw?.titleStrikethrough, titleCss?.textDecoration);

  // ── Price ─────────────────────────────────────────────────────────────────
  const priceCss      = unwrap(css?.priceStandard, {});
  const strikesCss    = unwrap(css?.priceStrike, {});
  const priceColor    = str(raw?.priceColor ?? priceCss?.color, "#111827");
  const priceSize     = parsePx(firstDefined(raw?.standardPriceFontSize, raw?.priceFontSize, raw?.priceSize, priceCss?.fontSize), 12);
  const priceWeight   = toFW(firstDefined(raw?.standardPriceFontWeight, raw?.priceFontWeight, raw?.priceWeight, priceCss?.fontWeight), "700");
  const priceFamily   = resolveFirstFont(raw?.standardPriceFontFamily, raw?.priceFontFamily, priceCss?.fontFamily, raw?.fontFamily);
  const strikesColor  = str(strikesCss?.color, "#6B7280");
  const strikesSize   = parsePx(strikesCss?.fontSize, 11);

  // ── ATC button ─────────────────────────────────────────────────────────────
  const atcCss         = unwrap(css?.atc, {});
  const atcBg          = str(firstDefined(raw?.atcBgColor, raw?.buttonBgColor, atcCss?.backgroundColor), "#111111");
  const atcColor       = str(firstDefined(raw?.atcColor, raw?.atcTextColor, raw?.buttonTextColor, atcCss?.color), "#FFFFFF");
  const atcSize        = parsePx(firstDefined(raw?.atcFontSize, raw?.buttonFontSize, atcCss?.fontSize), 12);
  const atcWeight      = toFW(firstDefined(raw?.atcFontWeight, raw?.buttonFontWeight, atcCss?.fontWeight), "700");
  const atcFamily      = resolveFirstFont(raw?.atcFontFamily, raw?.buttonFontFamily, atcCss?.fontFamily, raw?.fontFamily);
  const atcRadius      = parsePx(raw?.atcRadius ?? raw?.atcBorderRadius ?? raw?.buttonRadius ?? atcCss?.borderRadius, 6);
  const atcPadT        = parsePx(atcCss?.paddingTop,    8);
  const atcPadB        = parsePx(atcCss?.paddingBottom, 8);
  const atcIconRaw     = str(raw?.atcIcon ?? raw?.atcIconId, "fa-cart-shopping");
  const atcIconName    = resolveFA4IconName(atcIconRaw) || "shopping-cart";
  const atcIconSize    = num(raw?.atcIconSize ?? raw?.iconSize, 12);
  const atcIconColor   = str(raw?.atcIconColor ?? raw?.iconColor ?? atcColor, atcColor);
  const atcText        = str(firstDefined(raw?.atcText, raw?.addToCartText, raw?.buttonText), "Add to Cart");
  const addedToCartMessage = str(
    firstDefined(raw?.addedToCartMessage, raw?.cartSuccessMessage, raw?.atcSuccessMessage),
    "Item added to cart."
  );
  const snackbarActionText = str(firstDefined(raw?.snackbarActionText, raw?.cartActionText), "View Cart");
  const atcDecorationAvailable = toDecorationLine(raw?.atcStrikethroughAvailable, atcCss?.textDecoration);

  // ── Unavailable button ────────────────────────────────────────────────────
  const unavailCss    = unwrap(css?.atcUnavailable, {});
  const unavailBg     = str(unavailCss?.backgroundColor, "#7A7A7A");
  const unavailColor  = str(unavailCss?.color, "#FFFFFF");
  const unavailText   = str(raw?.unavailableText ?? raw?.soldOutText, "Item Not Available");
  const atcDecorationUnavailable = toDecorationLine(raw?.atcStrikethroughUnavailable, unavailCss?.textDecoration);

  // Visibility / eye toggles
  const visibility = unwrap(raw?.visibility, {});
  const showHeader = bool(visibility?.header ?? raw?.headerActive ?? raw?.showHeader ?? raw?.headerVisible, true);
  const showImage = bool(visibility?.image ?? raw?.imageActive ?? raw?.showImage ?? raw?.cardImageActive, true);
  const showTitle = bool(visibility?.title ?? raw?.titleActive ?? raw?.showTitle ?? raw?.cardTitleActive, true);
  const showPrice = bool(visibility?.price ?? raw?.priceActive ?? raw?.showPrice ?? raw?.cardPriceActive, true);
  const showAtc = bool(visibility?.addToCart ?? visibility?.atc ?? visibility?.button ?? raw?.atcActive ?? raw?.showAddToCart ?? raw?.showAtc ?? raw?.showButton, true);
  const showFavorite = bool(visibility?.addToFavorite ?? visibility?.favorite ?? visibility?.wishlist ?? raw?.showFavorite ?? raw?.showAddToFavorite, false);
  const showAtcIcon = bool(visibility?.icon ?? raw?.iconActive ?? raw?.atcIconActive ?? raw?.showIcon, true);
  const favoriteToggleConfig = useMemo(() => buildFavoriteToggleConfig(raw, css?.favorite), [raw, css]);

  // cardWidth and screenWidth are computed above (before imageHeight)

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const [products, setProducts] = useState(() => manualProducts);
  const [loading,  setLoading]  = useState(false);
  const [cartSnackbarVisible, setCartSnackbarVisible] = useState(false);

  const loadProducts = useCallback(async () => {
    if (hasManualProducts) {
      setProducts(manualProducts);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await fetchShopifyRecentProducts(limit, {
        shop:  shopifyDomain || undefined,
        token: shopifyToken  || undefined,
      });
      setProducts(results || []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [hasManualProducts, limit, manualProducts, shopifyDomain, shopifyToken]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddToCart = (product) => {
    const availableVariant =
      product?.variants?.find(isVariantAvailable) ||
      product?.variants?.[0];
    const variantId = product.variantId || availableVariant?.id || "";
    dispatch(addItem({
      item: {
        id:             variantId || product.id,
        variantId:      String(variantId || ""),
        handle:         product.handle || "",
        title:          product.title || "",
        image:          product.imageUrl || product.image || "",
        price:          parseFloat(product.priceAmount || product.price || 0),
        compareAtPrice: parseFloat(product.compareAtPrice || 0),
        vendor:         product.vendor || "",
        variant:        "",
        currency:       product.priceCurrency || product.currency || "",
        quantity:       1,
      },
    }));
    setCartSnackbarVisible(true);
  };

  const handleProductPress = (product) => {
    navigation.navigate("ProductDetail", { product });
  };

  const handleToggleFavorite = async (product) => {
    const blocked = await requireLoginForAction({ session, navigation, initializing });
    if (blocked) return;
    dispatch(toggleWishlist({ product }));
  };

  if (!loading && products.length === 0) return null;

  return (
    <View
      onLayout={(event) => {
        const nextWidth = event?.nativeEvent?.layout?.width || 0;
        if (nextWidth > 0 && Math.abs(nextWidth - measuredWidth) > 1) {
          setMeasuredWidth(nextWidth);
        }
      }}
      style={{
        backgroundColor: containerBg,
        borderRadius:    containerRadius,
        width:           "100%",
        maxWidth:        "100%",
        alignSelf:       "stretch",
        paddingTop:      containerPT,
        paddingBottom:   containerPB,
        paddingLeft:     containerPL,
        paddingRight:    containerPR,
      }}
    >
      {/* Section header */}
      {showHeader && (
        <Text
          style={{
            color:      headerColor,
            fontSize:   headerSize,
            fontWeight: headerWeight,
            textDecorationLine: headerDecoration,
            marginBottom: headerMB,
            ...(headerFamily ? { fontFamily: headerFamily } : {}),
          }}
        >
          {sectionTitle}
        </Text>
      )}

      {/* Grid */}
      {!loading && (
        <View style={[styles.grid, { width: "100%", maxWidth: "100%" }]}>
          {products.slice(0, limit).map((product, idx) => {
            const isAvailable = isProductAvailable(product);
            const price       = product.priceAmount ?? product.price;
            const compareAt   = product.compareAtPrice;
            const currency    = product.priceCurrency ?? product.currency ?? "";
            const showStrike  = compareAt && parseFloat(compareAt) > parseFloat(price || 0);
            const isFavorite = isWishlistProduct(wishlistItems, product);

            return (
              <TouchableOpacity
                key={product.id || idx}
                style={[
                  styles.card,
                  {
                    width:           cardWidth,
                    backgroundColor: cardBg,
                    borderRadius:    cardRadius,
                    marginRight:     (idx + 1) % columns === 0 ? 0 : gridGap,
                    marginBottom:    gridGap,
                    ...cardBorder,
                    ...cardShadowStyle,
                    overflow: cardShadowEnabled ? "visible" : "hidden",
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => handleProductPress(product)}
              >
                {/* Image */}
                {showImage && (product.imageUrl || product.image) ? (
                  <View
                    style={{
                      width: "100%",
                      height: imageHeight,
                      backgroundColor: imageBgColor,
                      padding: imagePad,
                      borderTopLeftRadius: cardRadius,
                      borderTopRightRadius: cardRadius,
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <Image
                      source={{ uri: product.imageUrl || product.image }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode={imageResizeMode}
                    />
                    {showFavorite && (
                      <FavoriteToggleButton
                        isFavorite={isFavorite}
                        config={favoriteToggleConfig}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleToggleFavorite(product);
                        }}
                      />
                    )}
                  </View>
                ) : showImage ? (
                  <View
                    style={{
                      width:        "100%",
                      height:       imageHeight,
                      backgroundColor: imageBgColor,
                      alignItems:   "center",
                      justifyContent: "center",
                      borderTopLeftRadius:  cardRadius,
                      borderTopRightRadius: cardRadius,
                      position: "relative",
                    }}
                  >
                    <Text style={{ fontSize: 28, color: "#D1D5DB" }}>
                      {(product.title || "?").charAt(0).toUpperCase()}
                    </Text>
                    {showFavorite && (
                      <FavoriteToggleButton
                        isFavorite={isFavorite}
                        config={favoriteToggleConfig}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          handleToggleFavorite(product);
                        }}
                      />
                    )}
                  </View>
                ) : null}

                {/* Details */}
                <View style={{ padding: detailsPad }}>
                  {showTitle && (
                    <Text
                      numberOfLines={titleLines}
                      style={{
                        color:      titleColor,
                        fontSize:   titleSize,
                        fontWeight: titleWeight,
                        textDecorationLine: titleDecoration,
                        marginBottom: 4,
                        ...(titleFamily ? { fontFamily: titleFamily } : {}),
                      }}
                    >
                      {product.title}
                    </Text>
                  )}

                  {/* Price row */}
                  {showPrice && (
                    <View style={styles.priceRow}>
                      <Text
                        style={{
                          color:      priceColor,
                          fontSize:   priceSize,
                          fontWeight: priceWeight,
                          marginBottom: 6,
                          ...(priceFamily ? { fontFamily: priceFamily } : {}),
                        }}
                      >
                        {formatMoney(price, currency)}
                      </Text>
                      {showStrike && (
                        <Text
                          style={{
                            color:              strikesColor,
                            fontSize:           strikesSize,
                            textDecorationLine: "line-through",
                            marginLeft:         4,
                          }}
                        >
                          {formatMoney(compareAt, currency)}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* ATC / Unavailable */}
                  {(showAtc || !isAvailable) && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: isAvailable ? atcBg : unavailBg,
                        borderRadius:    atcRadius,
                        paddingTop:      atcPadT,
                        paddingBottom:   atcPadB,
                        alignItems:      "center",
                        justifyContent:  "center",
                        flexDirection:   "row",
                        gap:             6,
                      }}
                      activeOpacity={isAvailable ? 0.8 : 1}
                      disabled={!isAvailable}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        e?.preventDefault?.();
                        if (isAvailable) handleAddToCart(product);
                      }}
                    >
                      {isAvailable && showAtcIcon && (
                        <FontAwesome
                          name={atcIconName}
                          size={atcIconSize}
                          color={atcIconColor}
                        />
                      )}
                      <Text
                        style={{
                          color:      isAvailable ? atcColor : unavailColor,
                          fontSize:   atcSize,
                          fontWeight: atcWeight,
                          textDecorationLine: isAvailable ? atcDecorationAvailable : atcDecorationUnavailable,
                          ...(atcFamily ? { fontFamily: atcFamily } : {}),
                        }}
                      >
                        {isAvailable ? atcText : unavailText}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Snackbar
        visible={cartSnackbarVisible}
        message={addedToCartMessage}
        actionLabel={snackbarActionText}
        onAction={() => navigation.navigate("BottomNavScreen", { title: "Cart", pageName: "cart", link: "cart" })}
        onDismiss={() => setCartSnackbarVisible(false)}
        duration={2600}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection:  "row",
    flexWrap:       "wrap",
  },
  card: {
    overflow: "visible",
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "baseline",
    flexWrap:      "wrap",
  },
});

import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { addItem } from "../store/slices/cartSlice";
import { fetchShopifyRecentProducts } from "../services/shopify";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";

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

const cleanFamily = (v) => {
  if (!v) return undefined;
  return String(v).split(",")[0].trim().replace(/['"]/g, "") || undefined;
};

const parsePx = (v, fb) => {
  if (v === undefined || v === null || v === "") return fb;
  const n = parseFloat(String(v));
  return Number.isNaN(n) ? fb : n;
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
// ─── Currency symbol lookup ───────────────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  USD: "$", INR: "₹", GBP: "£", EUR: "€", CAD: "CA$",
  AUD: "A$", JPY: "¥", CNY: "¥", SGD: "S$", AED: "د.إ",
};
const toCurrSymbol = (code) =>
  CURRENCY_SYMBOLS[String(code || "").toUpperCase()] || code || "";

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecentProducts({ section }) {
  const navigation = useNavigation();
  const dispatch   = useDispatch();
  const { session } = useAuth();

  // ── DSL extraction ─────────────────────────────────────────────────────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw = unwrap(propsNode?.raw, {});

  // layout.css contains card/atc/image/header/price styling
  const layoutRaw = unwrap(propsNode?.layout, {});
  const css       = unwrap(layoutRaw?.css, {});

  // ── Settings ───────────────────────────────────────────────────────────────
  // Use `header` / `sectionTitle` — NOT `title`, which ProductDetailScreen merges
  // with the current product's name via buildProductDefaults, causing the product
  // name to appear as the section heading.
  const sectionTitle  = str(raw?.header ?? raw?.sectionTitle ?? raw?.title, "Recently Viewed");
  const limit         = Math.max(1, num(raw?.limit ?? raw?.itemsShown, 4));
  const shopifyDomain = str(raw?.shopifyDomain, "");
  const shopifyToken  = str(raw?.storefrontToken, "");
  const columns       = 2;

  // ── Container ─────────────────────────────────────────────────────────────
  const containerCss = unwrap(css?.container, {});
  const containerBg  = str(raw?.backgroundColor ?? containerCss?.background ?? containerCss?.backgroundColor, "#FFFFFF");
  const containerPT  = parsePx(containerCss?.paddingTop,    0);
  const containerPB  = parsePx(containerCss?.paddingBottom, 0);
  const containerPL  = parsePx(containerCss?.paddingLeft,   0);
  const containerPR  = parsePx(containerCss?.paddingRight,  0);

  // ── Header ─────────────────────────────────────────────────────────────────
  const headerCss     = unwrap(css?.header, {});
  const headerColor   = str(raw?.headerColor ?? headerCss?.color, "#111111");
  const headerSize    = parsePx(raw?.headerSize ?? headerCss?.fontSize, 14);
  const headerWeight  = toFW(raw?.headerWeight ?? headerCss?.fontWeight, "700");
  const headerFamily  = cleanFamily(str(raw?.headerFamily ?? headerCss?.fontFamily, ""));
  const headerDecoration = toDecorationLine(raw?.headerStrikethrough, headerCss?.textDecoration);
  const headerMB      = parsePx(headerCss?.marginBottom, 8);

  // ── Grid ──────────────────────────────────────────────────────────────────
  const gridCss  = unwrap(css?.grid, {});
  const gridGap  = parsePx(raw?.gap ?? gridCss?.gap, 8);

  // ── Card ──────────────────────────────────────────────────────────────────
  const cardCss    = unwrap(css?.card, {});
  const cardBg     = str(cardCss?.background ?? cardCss?.backgroundColor, "#FFFFFF");
  const cardRadius = parsePx(raw?.cardRadius ?? cardCss?.borderRadius, 0);
  const cardBorder = cardCss?.border
    ? { borderWidth: 1, borderColor: "#E5E7EB" }
    : { borderWidth: 1, borderColor: str(raw?.cardBorderColor, "#E5E7EB") };

  // ── Image ─────────────────────────────────────────────────────────────────
  const imageWrapCss  = unwrap(css?.imageWrap, {});
  const imageCss      = unwrap(css?.image, {});
  const imageHeight   = parsePx(raw?.imageHeight ?? imageWrapCss?.height, 140);
  const imageBgColor  = str(raw?.imageBgColor ?? raw?.imageBackgroundColor ?? imageWrapCss?.backgroundColor ?? imageCss?.backgroundColor, "#FFFFFF");
  const imagePad      = parsePx(raw?.imagePad ?? raw?.imagePadding ?? imageWrapCss?.padding, 0);
  const imageResizeMode = (() => {
    const s = str(raw?.imageScale ?? raw?.imageResizeMode ?? imageCss?.objectFit, "contain").toLowerCase();
    if (s === "contain" || s === "fit") return "contain";
    if (s === "stretch") return "stretch";
    if (s === "center") return "center";
    if (s === "cover") return "cover";
    return "contain";
  })();

  // ── Card details padding ──────────────────────────────────────────────────
  const detailsCss = unwrap(css?.details, {});
  const detailsPad = parsePx(raw?.detailsPadding ?? detailsCss?.padding, 8);

  // ── Product title ─────────────────────────────────────────────────────────
  const titleCss    = unwrap(css?.title, {});
  const titleColor  = str(raw?.titleColor ?? titleCss?.color, "#111827");
  const titleSize   = parsePx(raw?.titleSize ?? titleCss?.fontSize, 12);
  const titleWeight = toFW(raw?.titleWeight ?? titleCss?.fontWeight, "400");
  const titleFamily = cleanFamily(str(raw?.titleFontFamily ?? titleCss?.fontFamily, ""));
  const titleLines  = 1;
  const titleDecoration = toDecorationLine(raw?.titleStrikethrough, titleCss?.textDecoration);

  // ── Price ─────────────────────────────────────────────────────────────────
  const priceCss      = unwrap(css?.priceStandard, {});
  const strikesCss    = unwrap(css?.priceStrike, {});
  const priceColor    = str(raw?.priceColor ?? priceCss?.color, "#111827");
  const priceSize     = parsePx(raw?.priceSize ?? priceCss?.fontSize, 12);
  const priceWeight   = toFW(raw?.priceWeight ?? priceCss?.fontWeight, "700");
  const priceFamily   = cleanFamily(str(raw?.priceFontFamily ?? priceCss?.fontFamily, ""));
  const strikesColor  = str(strikesCss?.color, "#6B7280");
  const strikesSize   = parsePx(strikesCss?.fontSize, 11);

  // ── ATC button ─────────────────────────────────────────────────────────────
  const atcCss         = unwrap(css?.atc, {});
  const atcBg          = str(raw?.atcBgColor ?? atcCss?.backgroundColor, "#111111");
  const atcColor       = str(raw?.atcColor ?? raw?.atcTextColor ?? atcCss?.color, "#FFFFFF");
  const atcSize        = parsePx(raw?.atcFontSize ?? atcCss?.fontSize, 12);
  const atcWeight      = toFW(raw?.atcFontWeight ?? atcCss?.fontWeight, "700");
  const atcFamily      = cleanFamily(str(raw?.atcFontFamily ?? atcCss?.fontFamily, ""));
  const atcRadius      = parsePx(raw?.atcRadius ?? raw?.atcBorderRadius ?? raw?.buttonRadius ?? atcCss?.borderRadius, 6);
  const atcPadT        = parsePx(atcCss?.paddingTop,    8);
  const atcPadB        = parsePx(atcCss?.paddingBottom, 8);
  const atcIconRaw     = str(raw?.atcIcon ?? raw?.atcIconId, "fa-cart-shopping");
  const atcIconName    = resolveFA4IconName(atcIconRaw) || "shopping-cart";
  const atcIconSize    = num(raw?.atcIconSize ?? raw?.iconSize, 12);
  const atcIconColor   = str(raw?.atcIconColor ?? raw?.iconColor ?? atcColor, atcColor);
  const atcText        = str(raw?.atcText ?? raw?.addToCartText ?? raw?.buttonText, "Add to Cart");
  const atcDecorationAvailable = toDecorationLine(raw?.atcStrikethroughAvailable, atcCss?.textDecoration);

  // ── Unavailable button ────────────────────────────────────────────────────
  const unavailCss    = unwrap(css?.atcUnavailable, {});
  const unavailBg     = str(unavailCss?.backgroundColor, "#7A7A7A");
  const unavailColor  = str(unavailCss?.color, "#FFFFFF");
  const unavailText   = str(raw?.unavailableText ?? raw?.soldOutText, "Unavailable");
  const atcDecorationUnavailable = toDecorationLine(raw?.atcStrikethroughUnavailable, unavailCss?.textDecoration);

  // Visibility / eye toggles
  const visibility = unwrap(raw?.visibility, {});
  const showHeader = bool(visibility?.header ?? raw?.headerActive ?? raw?.showHeader ?? raw?.headerVisible, true);
  const showImage = bool(visibility?.image ?? raw?.imageActive ?? raw?.showImage ?? raw?.cardImageActive, true);
  const showTitle = bool(visibility?.title ?? raw?.titleActive ?? raw?.showTitle ?? raw?.cardTitleActive, true);
  const showPrice = bool(visibility?.price ?? raw?.priceActive ?? raw?.showPrice ?? raw?.cardPriceActive, true);
  const showAtc = bool(visibility?.atc ?? visibility?.button ?? raw?.atcActive ?? raw?.showAtc ?? raw?.showButton, true);
  const showAtcIcon = bool(visibility?.icon ?? raw?.iconActive ?? raw?.atcIconActive ?? raw?.showIcon, true);

  // ── Card width ─────────────────────────────────────────────────────────────
  const screenWidth = Dimensions.get("window").width;
  const cardWidth   = Math.max(0, (screenWidth - containerPL - containerPR - gridGap * (columns - 1)) / columns);

  // ── Data fetch ─────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(false);

  const loadProducts = useCallback(async () => {
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
  }, [limit, shopifyDomain, shopifyToken]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddToCart = async (product) => {
    const blocked = await requireLoginForAction({ session, navigation });
    if (blocked) return;
    dispatch(addItem({
      item: {
        id:             product.variantId || product.id,
        variantId:      String(product.variantId || ""),
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
  };

  const handleProductPress = (product) => {
    navigation.navigate("ProductDetail", { product });
  };

  if (!loading && products.length === 0) return null;

  return (
    <View
      style={{
        backgroundColor: containerBg,
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

      {/* Loading placeholder */}
      {loading && (
        <Text style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingVertical: 16 }}>
          Loading...
        </Text>
      )}

      {/* Grid */}
      {!loading && (
        <View style={styles.grid}>
          {products.slice(0, limit).map((product, idx) => {
            const isAvailable = isProductAvailable(product);
            const price       = product.priceAmount ?? product.price;
            const compareAt   = product.compareAtPrice;
            const currency    = product.priceCurrency ?? product.currency ?? "";
            const showStrike  = compareAt && parseFloat(compareAt) > parseFloat(price || 0);

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
                    }}
                  >
                    <Image
                      source={{ uri: product.imageUrl || product.image }}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderTopLeftRadius: Math.max(0, cardRadius - imagePad),
                        borderTopRightRadius: Math.max(0, cardRadius - imagePad),
                      }}
                      resizeMode={imageResizeMode}
                    />
                  </View>
                ) : showImage ? (
                  <View
                    style={{
                      width:        "100%",
                      height:       imageHeight,
                      backgroundColor: "#F3F4F6",
                      alignItems:   "center",
                      justifyContent: "center",
                      borderTopLeftRadius:  cardRadius,
                      borderTopRightRadius: cardRadius,
                    }}
                  >
                    <Text style={{ fontSize: 28, color: "#D1D5DB" }}>
                      {(product.title || "?").charAt(0).toUpperCase()}
                    </Text>
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
                        {toCurrSymbol(currency)}{parseFloat(price || 0).toFixed(2)}
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
                          {toCurrSymbol(currency)}{parseFloat(compareAt).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* ATC / Unavailable */}
                  {showAtc && (
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
                      onPress={() => isAvailable && handleAddToCart(product)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection:  "row",
    flexWrap:       "wrap",
  },
  card: {
    overflow: "hidden",
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "baseline",
    flexWrap:      "wrap",
  },
});


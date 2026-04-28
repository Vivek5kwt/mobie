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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecentProducts({ section }) {
  const navigation = useNavigation();
  const dispatch   = useDispatch();

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
  const sectionTitle  = str(raw?.title ?? raw?.header, "Recently Viewed");
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
  const imageResizeMode = (() => {
    const s = str(raw?.imageScale ?? raw?.imageResizeMode ?? imageCss?.objectFit, "cover").toLowerCase();
    if (s === "contain" || s === "fit") return "contain";
    if (s === "stretch") return "stretch";
    return "cover";
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
  const atcIconSize    = num(raw?.atcIconSize, 12);

  // ── Unavailable button ────────────────────────────────────────────────────
  const unavailCss    = unwrap(css?.atcUnavailable, {});
  const unavailBg     = str(unavailCss?.backgroundColor, "#E5E7EB");
  const unavailColor  = str(unavailCss?.color, "#111827");
  const unavailText   = str(raw?.unavailableText ?? raw?.soldOutText, "Unavailable");

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
  const handleAddToCart = (product) => {
    dispatch(addItem({
      item: {
        id:             product.variantId || product.id,
        variantId:      String(product.variantId || ""),
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
      <Text
        style={{
          color:      headerColor,
          fontSize:   headerSize,
          fontWeight: headerWeight,
          marginBottom: headerMB,
          ...(headerFamily ? { fontFamily: headerFamily } : {}),
        }}
      >
        {sectionTitle}
      </Text>

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
            const isAvailable = product.availableForSale !== false;
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
                {product.imageUrl || product.image ? (
                  <Image
                    source={{ uri: product.imageUrl || product.image }}
                    style={{
                      width:        "100%",
                      height:       imageHeight,
                      borderTopLeftRadius:  cardRadius,
                      borderTopRightRadius: cardRadius,
                    }}
                    resizeMode={imageResizeMode}
                  />
                ) : (
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
                )}

                {/* Details */}
                <View style={{ padding: detailsPad }}>
                  <Text
                    numberOfLines={titleLines}
                    style={{
                      color:      titleColor,
                      fontSize:   titleSize,
                      fontWeight: titleWeight,
                      marginBottom: 4,
                      ...(titleFamily ? { fontFamily: titleFamily } : {}),
                    }}
                  >
                    {product.title}
                  </Text>

                  {/* Price row */}
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
                      {currency} {parseFloat(price || 0).toFixed(2)}
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
                        {currency} {parseFloat(compareAt).toFixed(2)}
                      </Text>
                    )}
                  </View>

                  {/* ATC / Unavailable */}
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
                    {isAvailable && (
                      <FontAwesome
                        name={atcIconName}
                        size={atcIconSize}
                        color={atcColor}
                      />
                    )}
                    <Text
                      style={{
                        color:      isAvailable ? atcColor : unavailColor,
                        fontSize:   atcSize,
                        fontWeight: atcWeight,
                        ...(atcFamily ? { fontFamily: atcFamily } : {}),
                      }}
                    >
                      {isAvailable ? "Add to Cart" : unavailText}
                    </Text>
                  </TouchableOpacity>
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

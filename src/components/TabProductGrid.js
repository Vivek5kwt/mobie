import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import {
  fetchShopifyCollectionProducts,
  fetchShopifyProducts,
} from "../services/shopify";
import { addItem } from "../store/slices/cartSlice";

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

  // ── Parse DSL ──────────────────────────────────────────────────────────────
  const rawProps =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // rawConfig holds all the flat builder values
  const rawConfig = rawProps?.raw?.value || rawProps?.raw || rawProps || {};

  const tabs = useMemo(() => normalizeTabs(rawConfig?.tabs || []), []);

  const initialTabId =
    toStr(rawConfig?.activeTabId, "") || (tabs.length ? tabs[0].id : "");

  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [productsByTab, setProductsByTab] = useState({});
  const [loadingTabId, setLoadingTabId] = useState(null);
  const [favorited, setFavorited] = useState({});

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // ── Fetch products when active tab changes ─────────────────────────────────
  useEffect(() => {
    if (!activeTabId || productsByTab[activeTabId]) return;

    let alive = true;
    const limit = activeTab?.limit || toNum(rawConfig?.productsPerTab, 4);
    const handle = activeTab?.handle || "";

    const load = async () => {
      setLoadingTabId(activeTabId);
      try {
        let items = [];

        if (handle && handle !== "all" && handle !== "frontpage") {
          const res = await fetchShopifyCollectionProducts({ handle, first: limit });
          items = (res?.products || []).map((p) => ({
            id: p.id,
            variantId: p.variantId || "",
            name: p.title,
            image: p.imageUrl,
            price: p.priceAmount,
            currency: p.priceCurrency,
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
  const tabFamily    = toStr(rawConfig?.tabFontFamily, undefined) || undefined;

  const paddingTop    = toNum(rawConfig?.paddingTop,    12);
  const paddingBottom = toNum(rawConfig?.paddingBottom, 12);
  const paddingLeft   = toNum(rawConfig?.paddingLeft,   16);
  const paddingRight  = toNum(rawConfig?.paddingRight,  16);

  const cardRadius     = toNum(rawConfig?.cardBorderRadius, 12);
  const imageCorner    = toNum(rawConfig?.cardImageCorner, 0);
  const cardTitleSize  = toNum(rawConfig?.cardTitleSize, 12);
  const cardTitleWt    = toFontWeight(rawConfig?.cardTitleWeight, "600");
  const cardTitleFamily= toStr(rawConfig?.cardTitleFamily, undefined) || undefined;

  const showFavorite   = toBool(rawConfig?.showFavorite ?? rawConfig?.favEnabled, true);
  const showAddToCart  = toBool(rawConfig?.showAddToCart, true);
  const showPrice      = toBool(rawConfig?.showPrice, true);
  const showTitleText  = toBool(rawConfig?.showTitle, true);
  const alignText      = toStr(rawConfig?.alignText, "Left").toLowerCase();
  const textAlign      = alignText === "center" ? "center" : alignText === "right" ? "right" : "left";

  // Auto text color based on bg brightness
  const containerDark = isDark(containerBg);
  const cardTextColor = containerDark ? "#FFFFFF" : "#111111";
  const priceColor    = containerDark ? "#E5E7EB" : "#374151";

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
    if (product.handle) {
      navigation.navigate("ProductDetail", { handle: product.handle });
    }
  }, [navigation]);

  const handleAddToCart = useCallback((product) => {
    dispatch(
      addItem({
        item: {
          id: product.variantId || product.id,
          variantId: product.variantId || "",
          title: product.name || "",
          image: product.image || "",
          price: toNum(product.price, 0),
          variant: "",
          currency: product.currency || "",
          quantity: 1,
        },
      })
    );
  }, [dispatch]);

  const toggleFavorite = useCallback((id) => {
    setFavorited((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
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
                const isFav = !!favorited[product.id];
                const inStock = product.availableForSale !== false;
                return (
                  <TouchableOpacity
                    key={product.id}
                    activeOpacity={0.9}
                    onPress={() => handleProductPress(product)}
                    style={[
                      styles.card,
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
                          style={styles.favBtn}
                          activeOpacity={0.8}
                          onPress={() => toggleFavorite(product.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={[styles.favIcon, isFav && styles.favIconActive]}>
                            {isFav ? "♥" : "♡"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Card content */}
                    <View style={styles.cardContent}>
                      {showTitleText && (
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.cardTitle,
                            {
                              color: cardTextColor,
                              fontSize: cardTitleSize,
                              fontWeight: cardTitleWt,
                              textAlign,
                              ...(cardTitleFamily ? { fontFamily: cardTitleFamily } : {}),
                            },
                          ]}
                        >
                          {product.name}
                        </Text>
                      )}

                      {showPrice && product.price && (
                        <Text style={[styles.priceText, { color: priceColor, textAlign }]}>
                          {product.currency} {parseFloat(product.price).toFixed(1)}
                        </Text>
                      )}

                      {showAddToCart && (
                        <TouchableOpacity
                          activeOpacity={inStock ? 0.8 : 1}
                          disabled={!inStock}
                          onPress={() => inStock && handleAddToCart(product)}
                          style={[
                            styles.cartBtn,
                            inStock ? styles.cartBtnActive : styles.cartBtnSoldOut,
                          ]}
                        >
                          <Text
                            style={[
                              styles.cartBtnText,
                              inStock ? styles.cartBtnTextActive : styles.cartBtnTextSoldOut,
                            ]}
                          >
                            {inStock ? "Add to cart" : "Out of stock"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  favIcon: {
    fontSize: 14,
    color: "#9CA3AF",
    lineHeight: 16,
  },
  favIconActive: {
    color: "#EF4444",
  },
  cardContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 5,
  },
  cardTitle: {
    lineHeight: 17,
  },
  priceText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cartBtn: {
    marginTop: 2,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: "center",
  },
  cartBtnActive: {
    backgroundColor: "#111111",
  },
  cartBtnSoldOut: {
    backgroundColor: "#374151",
  },
  cartBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cartBtnTextActive: {
    color: "#FFFFFF",
  },
  cartBtnTextSoldOut: {
    color: "#9CA3AF",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 13,
  },
});

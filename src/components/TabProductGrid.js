import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { useDispatch } from "react-redux";
import {
  fetchShopifyCollectionProducts,
  fetchShopifyProducts,
} from "../services/shopify";
import { convertStyles } from "../utils/convertStyles";
import { addItem } from "../store/slices/cartSlice";

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

const normalizeTabs = (rawTabs = []) => {
  if (Array.isArray(rawTabs)) {
    return rawTabs
      .map((tab, idx) => {
        const props = tab?.properties || tab || {};
        const id = toString(props?.id, `tab-${idx + 1}`);
        const label = toString(props?.label, "Tab");
        const collectionHandle = toString(props?.collectionHandle, "");
        if (!label) return null;
        return { id, label, collectionHandle };
      })
      .filter(Boolean);
  }

  return [];
};

const FALLBACK_PRODUCTS = [
  {
    id: "demo-1",
    name: "Demo Hat",
    image:
      "https://images.unsplash.com/photo-1504595403659-9088ce801e29?auto=format&fit=crop&w=400&q=80",
    price: "14.99",
    currency: "USD",
  },
  {
    id: "demo-2",
    name: "Demo Sunglasses",
    image:
      "https://images.unsplash.com/photo-1465805139202-a644e217f00e?auto=format&fit=crop&w=400&q=80",
    price: "29.00",
    currency: "USD",
  },
  {
    id: "demo-3",
    name: "Demo Backpack",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=400&q=80",
    price: "54.00",
    currency: "USD",
  },
  {
    id: "demo-4",
    name: "Demo Sneakers",
    image:
      "https://images.unsplash.com/photo-1521093470119-a3acdc43374b?auto=format&fit=crop&w=400&q=80",
    price: "79.00",
    currency: "USD",
  },
];

const extractLayoutCss = (rawProps) => {
  const layoutBlock = rawProps?.layout || {};
  return (
    layoutBlock?.properties?.css?.value ||
    layoutBlock?.properties?.css ||
    layoutBlock?.css?.value ||
    layoutBlock?.css ||
    layoutBlock?.value?.css ||
    {}
  );
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

export default function TabProductGrid({ section }) {
  const dispatch = useDispatch();
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  // Extract raw config - handle both raw.value and raw structures
  const rawConfig = rawProps?.raw?.value || rawProps?.raw || rawProps || {};
  
  // Extract tabs - they should be in rawConfig.tabs
  const tabs = useMemo(() => normalizeTabs(rawConfig?.tabs || []), [rawConfig?.tabs]);

  const initialTabId =
    toString(rawConfig?.activeTabId, "") || (tabs.length ? tabs[0]?.id : "");

  const [activeTabId, setActiveTabId] = useState(initialTabId);
  const [productsByTab, setProductsByTab] = useState({});
  const [loadingTab, setLoadingTab] = useState(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId),
    [tabs, activeTabId]
  );

  useEffect(() => {
    if (!activeTabId) return;
    if (productsByTab[activeTabId]) return;

    let isMounted = true;

    const loadProducts = async () => {
      setLoadingTab(activeTabId);
      try {
        const limit = productsPerTab;
        const collectionHandle = activeTab?.collectionHandle || "";

        let nextProducts = [];

        // Handle special collection handles
        if (collectionHandle && collectionHandle !== "all" && collectionHandle !== "frontpage") {
          // Fetch from specific collection
          const response = await fetchShopifyCollectionProducts({
            handle: collectionHandle,
            first: limit,
          });

          nextProducts = (response?.products || []).map((product) => ({
            id: product.id,
            name: product.title,
            image: product.imageUrl,
            price: product.priceAmount,
            currency: product.priceCurrency,
          }));
        } else {
          // Fetch all products (for "all", "frontpage", or empty handle)
          nextProducts = await fetchShopifyProducts(limit);
        }

        if (!nextProducts?.length) {
          nextProducts = FALLBACK_PRODUCTS;
        }

        if (isMounted) {
          setProductsByTab((prev) => ({ ...prev, [activeTabId]: nextProducts }));
        }
      } catch (error) {
        if (isMounted) {
          setProductsByTab((prev) => ({ ...prev, [activeTabId]: FALLBACK_PRODUCTS }));
        }
      } finally {
        if (isMounted) setLoadingTab(null);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [
    activeTab?.collectionHandle,
    activeTabId,
    productsByTab,
    rawConfig?.productsPerTab,
  ]);

  useEffect(() => {
    if (initialTabId && initialTabId !== activeTabId) {
      setActiveTabId(initialTabId);
    }
  }, [initialTabId]);

  if (!tabs.length) return null;

  // Extract layout CSS
  const layoutCss = extractLayoutCss(rawProps);

  // Apply all CSS styles dynamically
  const containerStyle = convertStyles(layoutCss?.container || {});
  const tabsRowStyle = convertStyles(layoutCss?.tabsRow || {});
  const carouselStyle = convertStyles(layoutCss?.carousel || layoutCss?.grid || {});
  const tabBarStyle = convertStyles(layoutCss?.tabBar || {});
  const cardStyle = convertStyles(layoutCss?.card || {});
  const cardTitleStyle = convertStyles(layoutCss?.cardTitle || {});
  const priceRowStyle = convertStyles(layoutCss?.priceRow || {});
  const mediaStyle = convertStyles(layoutCss?.media || {});
  const tabButtonStyle = convertStyles(layoutCss?.tabButton || {});
  const addToCartButtonStyle = convertStyles(layoutCss?.addToCartButton || {});

  // Extract raw config values with schema defaults
  const title = toString(rawConfig?.title, "");
  const columns = Math.max(1, toNumber(rawConfig?.columns, 1));
  const gridColGap = toNumber(rawConfig?.gridColGap, 28);
  const paddingTop = toNumber(rawConfig?.paddingTop, 12);
  const paddingBottom = toNumber(rawConfig?.paddingBottom, 12);
  const paddingLeft = toNumber(rawConfig?.paddingLeft, 16);
  const paddingRight = toNumber(rawConfig?.paddingRight, 16);
  const productsPerTab = toNumber(rawConfig?.productsPerTab, 8);
  const backgroundColor = toString(rawConfig?.backgroundColor, "#FFFFFF");
  const cardRadius = toNumber(rawConfig?.cardBorderRadius, 12);
  const tabBgBorderSide = toString(rawConfig?.tabBgBorderSide, "");

  // Extract gap from CSS or use gridColGap
  const carouselGap = toNumber(layoutCss?.carousel?.gap, gridColGap);
  const tabsRowGap = toNumber(layoutCss?.tabsRow?.gap, 16);

  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = paddingLeft + paddingRight;
  
  // For carousel, calculate card width based on columns
  // If columns is 1, use a fixed width or screen-based calculation
  let cardWidth;
  if (columns === 1) {
    // Single column - use a reasonable width
    cardWidth = Math.min(200, screenWidth - horizontalPadding - 40);
  } else {
    const totalGap = carouselGap * (columns - 1);
    cardWidth = Math.max(
      120,
      (screenWidth - horizontalPadding - totalGap) / columns
    );
  }

  const activeProducts = productsByTab[activeTabId] || [];

  // Extract styles from CSS for tab button text
  const tabButtonTextStyle = {
    fontSize: toNumber(layoutCss?.tabButton?.fontSize, 14),
    color: toString(layoutCss?.tabButton?.color, "#FFFFFF"),
    fontFamily: toString(layoutCss?.tabButton?.fontFamily, "Inter"),
    fontWeight: toFontWeight(layoutCss?.tabButton?.fontWeight, "500"),
  };

  // Extract styles from CSS for card title
  const cardTitleTextStyle = {
    fontSize: toNumber(layoutCss?.cardTitle?.fontSize, 14),
    color: toString(layoutCss?.cardTitle?.color, "#111827"),
    fontFamily: toString(layoutCss?.cardTitle?.fontFamily, "Inter"),
    fontWeight: toFontWeight(layoutCss?.cardTitle?.fontWeight, "500"),
    textAlign: toString(layoutCss?.cardTitle?.textAlign, "left"),
    marginTop: toNumber(layoutCss?.cardTitle?.marginTop, 0),
  };

  // Extract styles from CSS for add to cart button text
  const addToCartTextStyle = {
    fontSize: toNumber(layoutCss?.addToCartButton?.fontSize, 13),
    color: toString(layoutCss?.addToCartButton?.color, "#FFFFFF"),
    fontFamily: toString(layoutCss?.addToCartButton?.fontFamily, "Inter"),
    fontWeight: toFontWeight(layoutCss?.addToCartButton?.fontWeight, "600"),
  };

  // Extract media aspect ratio from CSS
  const mediaAspectRatio = layoutCss?.media?.aspectRatio;
  let aspectRatioValue = null;
  if (mediaAspectRatio) {
    const match = String(mediaAspectRatio).match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      aspectRatioValue = parseFloat(match[1]) / parseFloat(match[2]);
    }
  }

  return (
    <View
      style={[
        styles.container,
        containerStyle,
        {
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
          backgroundColor,
        },
      ]}
    >
      {title ? (
        <Text style={[styles.title, { marginBottom: 16 }]}>{title}</Text>
      ) : null}
      
      <View
        style={[
          styles.tabBar,
          tabBarStyle,
          tabBgBorderSide
            ? {
                borderTopWidth: tabBgBorderSide.includes("top") ? 1 : 0,
                borderBottomWidth: tabBgBorderSide.includes("bottom") ? 1 : 0,
                borderLeftWidth: tabBgBorderSide.includes("left") ? 1 : 0,
                borderRightWidth: tabBgBorderSide.includes("right") ? 1 : 0,
                borderColor: toString(layoutCss?.tabBar?.borderColor, "#111111"),
              }
            : {},
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.tabsRow,
            tabsRowStyle,
          ]}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                style={[
                  styles.tabButton,
                  tabButtonStyle,
                  {
                    marginRight: index < tabs.length - 1 ? tabsRowGap : 0,
                    borderRadius: toNumber(layoutCss?.tabButton?.borderRadius, 32),
                    paddingTop: toNumber(layoutCss?.tabButton?.paddingTop, 8),
                    paddingRight: toNumber(layoutCss?.tabButton?.paddingRight, 16),
                    paddingBottom: toNumber(layoutCss?.tabButton?.paddingBottom, 8),
                    paddingLeft: toNumber(layoutCss?.tabButton?.paddingLeft, 16),
                    backgroundColor: toString(layoutCss?.tabButton?.backgroundColor, "#096d70"),
                  },
                ]}
              >
                <Text style={[styles.tabLabel, tabButtonTextStyle]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loadingTab === activeTabId && !activeProducts.length ? (
        <Text style={styles.statusText}>Loading products…</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.carousel,
            carouselStyle,
          ]}
        >
          {activeProducts.map((product, index) => (
            <View
              key={product.id}
              style={[
                styles.card,
                cardStyle,
                {
                  width: cardWidth,
                  marginRight: index < activeProducts.length - 1 ? carouselGap : 0,
                  borderRadius: cardRadius || toNumber(layoutCss?.card?.borderRadius, 0),
                  backgroundColor: toString(layoutCss?.card?.backgroundColor, "#FFFFFF"),
                  ...(layoutCss?.card?.boxShadow && layoutCss?.card?.boxShadow !== "none"
                    ? {
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                      }
                    : {}),
                },
              ]}
            >
              <View
                style={[
                  styles.mediaWrapper,
                  mediaStyle,
                  {
                    width: toNumber(layoutCss?.media?.width, undefined),
                    height: toNumber(layoutCss?.media?.height, undefined),
                    borderRadius: toNumber(layoutCss?.media?.borderRadius, 24),
                    backgroundColor: toString(layoutCss?.media?.backgroundColor, "#F3F4F6"),
                    ...(aspectRatioValue ? { aspectRatio: aspectRatioValue } : {}),
                  },
                ]}
              >
                {product.image ? (
                  <Image source={{ uri: product.image }} style={styles.image} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.placeholderText}>Image</Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.cardContent,
                  {
                    paddingTop: toNumber(layoutCss?.card?.paddingTop, 8),
                    paddingRight: toNumber(layoutCss?.card?.paddingRight, 8),
                    paddingBottom: toNumber(layoutCss?.card?.paddingBottom, 8),
                    paddingLeft: toNumber(layoutCss?.card?.paddingLeft, 8),
                    backgroundColor: toString(layoutCss?.card?.backgroundColor, "transparent"),
                  },
                ]}
              >
                <Text numberOfLines={2} style={[styles.cardTitle, cardTitleStyle, cardTitleTextStyle]}>
                  {product.name}
                </Text>

                <View
                  style={[
                    styles.priceRow,
                    priceRowStyle,
                    {
                      marginTop: toNumber(layoutCss?.priceRow?.marginTop, 0),
                      alignItems: toString(layoutCss?.priceRow?.alignItems, "baseline"),
                      justifyContent: toString(layoutCss?.priceRow?.justifyContent, "flex-start"),
                    },
                  ]}
                >
                  <Text style={styles.priceText}>
                    {product.currency} {product.price}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.addToCartButton,
                    addToCartButtonStyle,
                    {
                      borderRadius: toNumber(layoutCss?.addToCartButton?.borderRadius, 999),
                      paddingTop: toNumber(layoutCss?.addToCartButton?.paddingTop, 8),
                      paddingRight: toNumber(layoutCss?.addToCartButton?.paddingRight, 10),
                      paddingBottom: toNumber(layoutCss?.addToCartButton?.paddingBottom, 8),
                      paddingLeft: toNumber(layoutCss?.addToCartButton?.paddingLeft, 10),
                    },
                  ]}
                  onPress={() =>
                    dispatch(
                      addItem({
                        item: {
                          id: product.variantId || product.id,
                          variantId: product.variantId || "",
                          title: product.name || "Product Name",
                          image: product.image || "",
                          price: toNumber(product.price, 0),
                          variant: "",
                          currency: product.currency || "",
                          quantity: 1,
                        },
                      })
                    )
                  }
                >
                  <Text style={[styles.addToCartLabel, addToCartTextStyle]}>
                    Add to cart
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  tabsRow: {
    flexDirection: "row",
  },
  tabBar: {
    marginBottom: 40,
  },
  tabButton: {
    // Styles will be applied from CSS
  },
  tabLabel: {
    // Styles will be applied from CSS
  },
  statusText: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 12,
  },
  carousel: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  card: {
    overflow: "hidden",
    marginBottom: 12,
  },
  mediaWrapper: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  cardContent: {
    padding: 8,
    gap: 6,
  },
  cardTitle: {
    // Styles will be applied from CSS
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  addToCartButton: {
    alignSelf: "flex-start",
    // Styles will be applied from CSS
  },
  addToCartLabel: {
    // Styles will be applied from CSS
  },
});

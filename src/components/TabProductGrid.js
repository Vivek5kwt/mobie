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

export default function TabProductGrid({ section }) {
  const dispatch = useDispatch();
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const rawConfig = rawProps?.raw?.value || rawProps?.raw || {};
  const tabs = useMemo(() => normalizeTabs(rawConfig?.tabs || rawProps?.tabs || []), [
    rawConfig?.tabs,
    rawProps?.tabs,
  ]);

  const initialTabId =
    toString(rawConfig?.activeTabId, "") || (tabs.length ? tabs[0].id : "");

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
        const limit = toNumber(rawConfig?.productsPerTab, 4);
        const collectionHandle = activeTab?.collectionHandle || "";

        let nextProducts = [];

        if (collectionHandle) {
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

  const layoutCss = extractLayoutCss(rawProps);

  const containerStyle = convertStyles(layoutCss?.container || {});
  const tabsRowStyle = convertStyles(layoutCss?.tabsRow || {});
  const carouselStyle = convertStyles(layoutCss?.carousel || layoutCss?.grid || {});
  const tabBarStyle = convertStyles(layoutCss?.tabBar || {});
  const cardStyle = convertStyles(layoutCss?.card || {});
  const cardContentStyle = convertStyles(layoutCss?.cardContent || {});
  const cardTitleStyle = convertStyles(layoutCss?.cardTitle || {});
  const priceRowStyle = convertStyles(layoutCss?.priceRow || {});
  const mediaStyle = convertStyles(layoutCss?.media || {});
  const tabButtonStyle = convertStyles(layoutCss?.tabButton || {});
  const activeTabButtonStyle = convertStyles(layoutCss?.activeTabButton || {});
  const addToCartButtonStyle = convertStyles(layoutCss?.addToCartButton || {});

  const gap = toNumber(layoutCss?.grid?.gap, 12);
  const carouselGap = toNumber(layoutCss?.carousel?.gap, gap);
  const columns = Math.max(1, toNumber(rawConfig?.columns, 2));
  const paddingTop = toNumber(rawConfig?.paddingTop, 16);
  const paddingBottom = toNumber(rawConfig?.paddingBottom, 16);
  const paddingLeft = toNumber(rawConfig?.paddingLeft, 16);
  const paddingRight = toNumber(rawConfig?.paddingRight, 16);
  const cardRadius = toNumber(rawConfig?.cardBorderRadius, 12);
  const backgroundColor = toString(rawConfig?.backgroundColor, "#FFFFFF");

  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = paddingLeft + paddingRight;
  const totalGap = carouselGap * (columns - 1);
  const cardWidth = Math.max(
    120,
    (screenWidth - horizontalPadding - totalGap) / columns
  );

  const activeProducts = productsByTab[activeTabId] || [];

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
      <View style={[styles.tabBar, tabBarStyle]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsRow, tabsRowStyle]}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTabId(tab.id)}
                style={[
                  styles.tabButton,
                  tabButtonStyle,
                  isActive && styles.activeTab,
                  isActive && activeTabButtonStyle,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    isActive && styles.activeTabLabel,
                    isActive && { color: activeTabButtonStyle?.color },
                  ]}
                >
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
          contentContainerStyle={[styles.carousel, carouselStyle, { gap: carouselGap }]}
        >
          {activeProducts.map((product) => (
            <View
              key={product.id}
              style={[
                styles.card,
                cardStyle,
                {
                  width: cardWidth,
                  borderRadius: cardRadius,
                },
              ]}
            >
              <View
                style={[
                  styles.mediaWrapper,
                  { borderRadius: cardRadius },
                  mediaStyle,
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

              <View style={[styles.cardContent, cardContentStyle]}>
                <Text numberOfLines={2} style={[styles.cardTitle, cardTitleStyle]}>
                  {product.name}
                </Text>

                <View style={[styles.priceRow, priceRowStyle]}>
                  <Text style={styles.priceText}>
                    {product.currency} {product.price}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.addToCartButton, addToCartButtonStyle]}
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
                  <Text style={styles.addToCartLabel}>Add to cart</Text>
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
  tabsRow: {
    gap: 16,
  },
  tabBar: {
    marginBottom: 40,
  },
  tabButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  tabLabel: {
    fontSize: 12,
    color: "#111827",
  },
  activeTab: {
    backgroundColor: "#E5F3F4",
    borderColor: "#096d70",
  },
  activeTabLabel: {
    color: "#096d70",
    fontWeight: "600",
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
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    marginBottom: 12,
  },
  mediaWrapper: {
    width: "100%",
    aspectRatio: 4 / 5,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
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
    fontSize: 12,
    fontWeight: "500",
    color: "#111827",
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  addToCartLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});

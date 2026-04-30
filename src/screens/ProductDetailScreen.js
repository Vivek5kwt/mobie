import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchShopifyProductDetails } from "../services/shopify";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import Header from "../components/Topheader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const resolveSections = (detailSections) => {
  if (Array.isArray(detailSections)) return detailSections;
  if (Array.isArray(detailSections?.sections)) return detailSections.sections;
  return [];
};

const buildProductDefaults = (product = {}) => {
  const imageUrl = product?.imageUrl;
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : imageUrl ? [imageUrl] : [];
  return {
    titleText: product?.title,
    title: product?.title,
    imageUrl,
    images,
    salePrice: product?.priceAmount,
    standardPrice: product?.priceAmount,
    priceCurrency: product?.priceCurrency,
    currency: product?.priceCurrency,
    currencySymbol: product?.priceCurrency ? `${product.priceCurrency} ` : undefined,
    vendorText: product?.vendor,
    shop: product?.vendor,
    description: product?.description,
    descriptionText: product?.description,
    variantOptions: product?.variantOptions,
    variantId: product?.variantId,
    handle: product?.handle,
    // Rating from Shopify metafields (populated by review apps)
    rating: product?.rating || undefined,
    ratingText: product?.rating || undefined,
    reviewCount: product?.reviewCount || undefined,
    ratingCountText: product?.reviewCount ? `(${product.reviewCount})` : undefined,
  };
};

const mergeRawNode = (rawNode, mergedRaw) => {
  if (rawNode && typeof rawNode === "object") {
    if (rawNode.value !== undefined) {
      return { ...rawNode, value: mergedRaw };
    }
    if (rawNode.const !== undefined) {
      return { ...rawNode, const: mergedRaw };
    }
    if (rawNode.properties) {
      return { ...rawNode, properties: mergedRaw };
    }
  }
  return mergedRaw;
};

const mergeSectionWithProduct = (section, product) => {
  if (!section) return section;
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const mergedRaw = { ...(raw || {}), ...buildProductDefaults(product) };
  const mergedRawNode = mergeRawNode(propsNode?.raw, mergedRaw);

  if (section?.properties?.props?.properties) {
    return {
      ...section,
      properties: {
        ...section.properties,
        props: {
          ...section.properties.props,
          properties: {
            ...section.properties.props.properties,
            raw: mergedRawNode,
          },
        },
      },
    };
  }

  if (section?.properties?.props) {
    return {
      ...section,
      properties: {
        ...section.properties,
        props: {
          ...section.properties.props,
          raw: mergedRawNode,
        },
      },
    };
  }

  if (section?.props) {
    return {
      ...section,
      props: {
        ...section.props,
        raw: mergedRawNode,
      },
    };
  }

  return {
    ...section,
    props: {
      raw: mergedRawNode,
    },
  };
};

export default function ProductDetailScreen() {
  const route = useRoute();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const routeProduct = route?.params?.product;
  const routeHandle = route?.params?.handle;
  const routeId = route?.params?.id;
  const product = useMemo(() => {
    const baseProduct = routeProduct && typeof routeProduct === "object" ? routeProduct : {};
    const nextProduct = { ...baseProduct };

    if (routeHandle && !nextProduct.handle) {
      nextProduct.handle = routeHandle;
    }

    if (routeId && !nextProduct.id) {
      nextProduct.id = routeId;
    }

    return nextProduct;
  }, [routeProduct, routeHandle, routeId]);
  const detailSections = route?.params?.detailSections;
  const appId = useMemo(
    () =>
      resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const [detailProduct, setDetailProduct] = useState(null);
  const [dslSections, setDslSections] = useState([]);
  const [dslLoading, setDslLoading] = useState(true);
  const [productReady, setProductReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const isMountedRef = useRef(true);
  const dslVersionRef = useRef(null);
  const productRef = useRef(product);

  const loadProductDetails = useCallback(async (overrideProduct) => {
    const baseProduct = overrideProduct || productRef.current || {};
    if (!baseProduct?.handle && !baseProduct?.id) {
      if (isMountedRef.current) {
        setLoading(false);
        setError("No product selected.");
      }
      return;
    }
    setLoading(true);
    setError("");

    let details = null;
    try {
      details = await fetchShopifyProductDetails({
        handle: baseProduct?.handle,
        id: baseProduct?.id,
      });
    } catch (err) {
      console.error("❌ Product detail refresh failed:", err);
    }

    if (!isMountedRef.current) return;
    if (details) {
      setDetailProduct({ ...baseProduct, ...details });
      setProductReady(true);
    } else {
      setError("Unable to load product details right now.");
    }
    setLoading(false);
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    productRef.current = product;
    setDetailProduct(null);
    setProductReady(false);
    loadProductDetails(product);
  }, [loadProductDetails, product]);

  useFocusEffect(
    useCallback(() => {
      loadProductDetails(productRef.current);
      if (!productRef.current?.handle && !productRef.current?.id) return undefined;

      const refreshInterval = setInterval(() => {
        loadProductDetails(productRef.current);
      }, 30000);

      return () => clearInterval(refreshInterval);
    }, [loadProductDetails])
  );

  useEffect(() => {
    let isMounted = true;
    const loadDetailLayout = async () => {
      const resolvedSections = resolveSections(detailSections);
      if (resolvedSections.length) {
        setDslSections(resolvedSections);
        dslVersionRef.current = null;
      }

      setDslLoading(!resolvedSections.length);
      const liveDsl = await fetchDSL(appId, "product-detail");
      if (!isMounted) return;
      const nextSections = resolveSections(liveDsl?.dsl);
      if (nextSections.length) {
        setDslSections(nextSections);
        dslVersionRef.current = liveDsl?.versionNumber ?? null;
      }
      setDslLoading(false);
    };

    loadDetailLayout();

    return () => {
      isMounted = false;
    };
  }, [appId, detailSections]);

  // Auto-refresh DSL periodically to pick up newly published versions
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, "product-detail");
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;
        if (incomingVersion === dslVersionRef.current) return;

        const nextSections = resolveSections(latest.dsl);
        if (!nextSections.length) return;

        setDslSections(nextSections);
        dslVersionRef.current = incomingVersion;
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [appId, detailSections]);

  // Fetch bottom nav from home DSL so it shows on the product detail screen
  useEffect(() => {
    let mounted = true;
    fetchDSL(appId, "home").then((data) => {
      if (!mounted) return;
      const nav = (data?.dsl?.sections || []).find((s) => {
        const c = (
          s?.component?.const || s?.component ||
          s?.properties?.component?.const || s?.properties?.component || ""
        ).toLowerCase();
        return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(c);
      });
      if (nav) setBottomNavSection(nav);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [appId]);

  const sectionsToRender = useMemo(
    () => resolveSections(dslSections),
    [dslSections]
  );
  const showLoadingState = (loading || dslLoading) && !productReady;

  // Only render sections once the Shopify API has returned real product data.
  // Never show DSL placeholder/default values before real data arrives.
  const renderSections = useMemo(() => {
    if (!productReady || !detailProduct) return [];
    if (sectionsToRender.length === 0) return [];
    return sectionsToRender.map((section) =>
      mergeSectionWithProduct(section, detailProduct)
    );
  }, [productReady, detailProduct, sectionsToRender]);
  const showEmptyState = !showLoadingState && (!renderSections.length || !!error);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <View style={styles.container}>
        <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
          <Header showNotification={false} />
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 24 },
          ]}
        >
          {showLoadingState ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#6b7280" />
            </View>
          ) : showEmptyState ? (
            <View style={styles.emptyState}>
              <Text style={styles.error}>
                {error || "No product details available."}
              </Text>
            </View>
          ) : renderSections.length > 0 ? (
            renderSections.map((section, index) => (
              <View key={section?.id || section?.component || index} style={styles.section}>
                <DynamicRenderer section={section} />
              </View>
            ))
          ) : null}
        </ScrollView>

        {bottomNavSection && (
          <View
            style={styles.bottomNav}
            onLayout={(e) => setBottomNavHeight(e.nativeEvent.layout.height)}
          >
            <BottomNavigation section={bottomNavSection} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
  },
  headerWrapper: {
    backgroundColor: "#ffffff",
    minHeight: 64,
    paddingBottom: 8,
    justifyContent: "center",
    zIndex: 2,
    elevation: 3,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  scrollContent: {
    backgroundColor: "#F7F7F7",
    minHeight: "100%",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  section: {
    marginBottom: 10,
  },
  status: {
    paddingTop: 12,
    textAlign: "center",
    color: "#6b7280",
  },
  error: {
    paddingTop: 12,
    textAlign: "center",
    color: "#b91c1c",
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});

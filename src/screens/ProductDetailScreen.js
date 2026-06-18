import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import SkeletonLoader from "../components/SkeletonLoader";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchShopifyProductDetails } from "../services/shopify";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import HeaderDefault from "../components/HeaderDefault";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { trackViewItem } from "../services/analyticsService";

const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

const DEFAULT_PRODUCT_DETAIL_HEADER = {
  left: [
    {
      icon: "fa-chevron-left",
      type: "icon",
      active: "icon",
      linkTo: "__BACK__",
      iconSize: 20,
      iconColor: "#111111",
      navigateType: "PreviousScreen",
    },
  ],
  right: [
    {
      icon: "fa-cart-shopping",
      type: "icon",
      active: "icon",
      linkTo: "Cart",
      iconSize: 20,
      iconColor: "#111111",
      navigateRef: "Cart",
      navigateType: "Screen",
    },
  ],
  enabled: true,
  showCart: true,
  iconColor: "#111111",
  textColor: "#111111",
  backgroundColor: "#FFFFFF",
};

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

const getDslFingerprint = (incomingDsl) => {
  try {
    return JSON.stringify({
      headerdefault: incomingDsl?.headerdefault ?? null,
      brandKit: incomingDsl?.brandKit ?? null,
      sections: incomingDsl?.sections || [],
    });
  } catch (_) {
    return (incomingDsl?.sections || []).map((section) => section?.component?.const || section?.component || "").join(",");
  }
};

const hasProductIdentity = (product = {}) => !!(product?.handle || product?.id);

const buildProductDefaults = (product = {}) => {
  const imageUrl = product?.imageUrl;
  const images = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : imageUrl ? [imageUrl] : [];
  return {
    id: product?.id,
    titleText: product?.title,
    title: product?.title,
    imageUrl,
    images,
    salePrice: product?.priceAmount,
    standardPrice: product?.priceAmount,
    priceCurrency: product?.priceCurrency,
    currency: product?.priceCurrency,
    currencySymbol: product?.currencySymbol || product?.priceCurrency,
    vendorText: product?.vendor,
    shop: product?.vendor,
    description: product?.description,
    descriptionHtml: product?.descriptionHtml,
    descriptionText: product?.descriptionHtml || product?.description,
    variantOptions: product?.variantOptions,
    variantId: product?.variantId,
    variants: product?.variants,
    availableForSale: product?.availableForSale,
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

const PRODUCT_DEFAULT_SKIP_COMPONENTS = new Set([
  "recent_products",
  "recently_viewed",
  "recent_viewed",
  "recentproducts",
  "recentlyviewed",
]);

const getComponentName = (section) =>
  String(
    section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      section?.properties?.component ||
      ""
  )
    .trim()
    .toLowerCase();

const mergeSectionWithProduct = (section, product) => {
  if (!section) return section;
  if (PRODUCT_DEFAULT_SKIP_COMPONENTS.has(getComponentName(section))) {
    return section;
  }
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

const getSectionPropsNode = (section) =>
  section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

const isTruthySticky = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  return ["true", "1", "yes", "y", "sticky", "fixed", "bottom"].includes(s);
};

const isAddToCartStickySection = (section) => {
  const componentName = (
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    ""
  ).toLowerCase();
  if (componentName !== "add_to_cart" && componentName !== "addtocart" && componentName !== "add-to-cart") {
    return false;
  }

  const propsNode = getSectionPropsNode(section);
  const raw = unwrapValue(propsNode?.raw, {}) || {};
  const presentation = unwrapValue(propsNode?.presentation, {}) || {};
  const css = unwrapValue(presentation?.css, {}) || {};
  const visibility = unwrapValue(raw?.visibility, {}) || unwrapValue(css?.visibility, {}) || {};

  return (
    isTruthySticky(raw?.sticky) ||
    isTruthySticky(raw?.isSticky) ||
    isTruthySticky(raw?.stickey) ||
    isTruthySticky(raw?.fixed) ||
    isTruthySticky(raw?.pinToBottom) ||
    isTruthySticky(raw?.position === "sticky" ? "sticky" : raw?.position) ||
    isTruthySticky(css?.sticky) ||
    isTruthySticky(css?.isSticky) ||
    isTruthySticky(visibility?.sticky)
  );
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
  const [, setProductReady] = useState(false);
  const [productLoadSettled, setProductLoadSettled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [headerDefaultConfig, setHeaderDefaultConfig] = useState(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [stickyAtcHeight, setStickyAtcHeight] = useState(130);
  const isMountedRef = useRef(true);
  const dslVersionRef = useRef(null);
  const dslFingerprintRef = useRef(null);
  const productRef = useRef(product);
  const viewedProductKeyRef = useRef("");

  const loadProductDetails = useCallback(async (overrideProduct) => {
    const baseProduct = overrideProduct || productRef.current || {};
    if (!hasProductIdentity(baseProduct)) {
      if (isMountedRef.current) {
        setLoading(false);
        setProductReady(false);
        setProductLoadSettled(true);
        setError("No Product Detail Found");
      }
      return;
    }
    setLoading(true);
    setError("");

    let details = null;
    let requestFailed = false;
    try {
      details = await fetchShopifyProductDetails({
        handle: baseProduct?.handle,
        id: baseProduct?.id,
      });
    } catch (err) {
      requestFailed = true;
      console.error("❌ Product detail refresh failed:", err);
    }

    if (!isMountedRef.current) return;
    if (details) {
      setDetailProduct({ ...baseProduct, ...details });
      setProductReady(true);
    } else {
      setDetailProduct(null);
      setProductReady(false);
      setError(requestFailed ? "Unable to load product details right now." : "No Product Detail Found");
    }
    setProductLoadSettled(true);
    setLoading(false);
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    productRef.current = product;
    setDetailProduct(null);
    setProductReady(false);
    setProductLoadSettled(false);
    setError("");
    loadProductDetails(product);
  }, [loadProductDetails, product]);

  useEffect(() => {
    const viewedProduct = detailProduct || product;
    const viewKey = String(
      viewedProduct?.id ||
        viewedProduct?.variantId ||
        viewedProduct?.handle ||
        viewedProduct?.title ||
        ""
    );
    if (!viewKey || viewedProductKeyRef.current === viewKey) return;
    viewedProductKeyRef.current = viewKey;
    trackViewItem(viewedProduct, { session }).catch(() => {});
  }, [detailProduct, product, session]);

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
      try {
        const liveDsl = await fetchDSL(appId, "product-detail");
        if (!isMounted) return;
        const nextSections = resolveSections(liveDsl?.dsl);
        if (liveDsl?.dsl?.headerdefault !== undefined) {
          setHeaderDefaultConfig(liveDsl.dsl.headerdefault);
        } else {
          setHeaderDefaultConfig(null);
        }
        if (nextSections.length) {
          setDslSections(nextSections);
          dslVersionRef.current = liveDsl?.versionNumber ?? null;
          dslFingerprintRef.current = getDslFingerprint(liveDsl?.dsl);
        } else if (!resolvedSections.length) {
          setDslSections([]);
        }
      } catch (error) {
        console.log("❌ Product detail DSL load failed:", error);
        if (isMounted && !resolvedSections.length) {
          setDslSections([]);
        }
      } finally {
        if (isMounted) setDslLoading(false);
      }
    };

    loadDetailLayout();

    return () => {
      isMounted = false;
    };
  }, [appId, detailSections]);

  // Auto-refresh DSL periodically to pick up any live Builder changes
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, "product-detail");
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;
        const incomingFingerprint = getDslFingerprint(latest.dsl);
        if (
          incomingVersion === dslVersionRef.current &&
          incomingFingerprint === dslFingerprintRef.current
        ) {
          return;
        }

        const nextSections = resolveSections(latest.dsl);
        if (!nextSections.length) return;

        if (latest.dsl?.headerdefault !== undefined) {
          setHeaderDefaultConfig(latest.dsl.headerdefault);
        } else {
          setHeaderDefaultConfig(null);
        }
        setDslSections(nextSections);
        dslVersionRef.current = incomingVersion;
        dslFingerprintRef.current = incomingFingerprint;
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      }
    }, LIVE_DSL_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [appId, detailSections]);

  // Fetch only the bottom nav from home DSL. HeaderDefault must come from the
  // Product Detail page DSL so product screens follow their own builder config.
  useEffect(() => {
    let mounted = true;
    fetchDSL(appId, "home").then((data) => {
      if (!mounted) return;
      const sections = data?.dsl?.sections || [];
      const getComponent = (s) =>
        (s?.component?.const || s?.component ||
         s?.properties?.component?.const || s?.properties?.component || "").toLowerCase();

      const nav = sections.find((s) =>
        ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(getComponent(s))
      );
      if (nav) setBottomNavSection(nav);

    }).catch(() => {});
    return () => { mounted = false; };
  }, [appId]);

  const sectionsToRender = useMemo(
    () => resolveSections(dslSections),
    [dslSections]
  );

  const productForRender = useMemo(
    () => detailProduct || (hasProductIdentity(product) ? product : null),
    [detailProduct, product]
  );

  // Render as soon as DSL plus route product data are available, then hydrate
  // with fuller Shopify detail data when that request settles.
  const renderSections = useMemo(() => {
    if (!productForRender) return [];
    if (sectionsToRender.length === 0) return [];
    return sectionsToRender.map((section) =>
      mergeSectionWithProduct(section, productForRender)
    );
  }, [productForRender, sectionsToRender]);
  const stickyAddToCartSections = useMemo(
    () => renderSections.filter((section) => isAddToCartStickySection(section)),
    [renderSections]
  );
  const scrollSections = useMemo(
    () => renderSections.filter((section) => !isAddToCartStickySection(section)),
    [renderSections]
  );
  const stickyAtcReservedSpace = stickyAddToCartSections.length > 0 ? stickyAtcHeight : 0;
  const hasProductData = !!productForRender;
  const waitingForInitialProduct = loading && !hasProductData && !productLoadSettled;
  const waitingForInitialDsl = dslLoading && !renderSections.length && !error;
  const showLoadingState = waitingForInitialProduct || waitingForInitialDsl;
  const showEmptyState = !showLoadingState && (
    !!error ||
    (productLoadSettled && !hasProductData) ||
    (hasProductData && !dslLoading && renderSections.length === 0)
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <View style={styles.container}>
        <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
          <HeaderDefault
            config={headerDefaultConfig || DEFAULT_PRODUCT_DETAIL_HEADER}
            hideTabs={true}
            showBack={true}
          />
        </View>
        {showLoadingState ? (
          <SkeletonLoader />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingBottom: (bottomNavSection ? bottomNavHeight + 16 : 24) + stickyAtcReservedSpace,
              },
            ]}
          >
            {showEmptyState ? (
              <View style={styles.emptyState}>
                <Text style={styles.error}>
                  {error || "No product details available."}
                </Text>
              </View>
            ) : scrollSections.length > 0 ? (
              scrollSections.map((section, index) => (
                <View key={section?.id || section?.component || index} style={styles.section}>
                  <DynamicRenderer section={section} />
                </View>
              ))
            ) : null}
          </ScrollView>
        )}

        {stickyAddToCartSections.length > 0 && (
          <View
            style={[
              styles.stickyAddToCartDock,
              { bottom: bottomNavSection ? bottomNavHeight : 0 },
            ]}
            onLayout={(e) => setStickyAtcHeight(e.nativeEvent.layout.height)}
          >
            {stickyAddToCartSections.map((section, index) => (
              <View key={section?.id || section?.component || `sticky-atc-${index}`} style={styles.stickySectionItem}>
                <DynamicRenderer section={section} />
              </View>
            ))}
          </View>
        )}

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
    backgroundColor: "#ffffff",
  },
  scrollView: {
    backgroundColor: "#ffffff",
  },
  headerWrapper: {
    zIndex: 2,
  },
  scrollContent: {
    backgroundColor: "#ffffff",
    minHeight: "100%",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  stickyAddToCartDock: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 3,
    elevation: 6,
  },
  stickySectionItem: {
    width: "100%",
  },
  section: {
    marginBottom: 10,
    backgroundColor: "#ffffff",
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

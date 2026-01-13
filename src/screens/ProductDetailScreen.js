import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchShopifyProductDetails } from "../services/shopify";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import Header from "../components/Topheader";

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

const buildProductDefaults = (product = {}) => ({
  titleText: product?.title,
  title: product?.title,
  imageUrl: product?.imageUrl,
  salePrice: product?.priceAmount,
  standardPrice: product?.priceAmount,
  currencySymbol: product?.priceCurrency ? `${product.priceCurrency} ` : undefined,
  vendorText: product?.vendor,
  shop: product?.vendor,
  description: product?.description,
  descriptionText: product?.description,
  variantOptions: product?.variantOptions,
  variantId: product?.variantId,
  handle: product?.handle,
});

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
  const product = route?.params?.product || {};
  const detailSections = route?.params?.detailSections;
  const appId = useMemo(
    () =>
      resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const [detailProduct, setDetailProduct] = useState(product);
  const [dslSections, setDslSections] = useState([]);
  const [dslLoading, setDslLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);
  const dslVersionRef = useRef(null);
  const productRef = useRef(product);

  const loadProductDetails = useCallback(async (overrideProduct) => {
    const baseProduct = overrideProduct || productRef.current || {};
    if (!baseProduct?.handle && !baseProduct?.id) return;
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
      setDetailProduct((prev) => ({ ...prev, ...baseProduct, ...details }));
    } else {
      setDetailProduct(baseProduct);
      setError("Unable to load product details right now.");
    }
    setLoading(false);
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    productRef.current = product;
    setDetailProduct(product);
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
        return;
      }

      setDslLoading(true);
      const liveDsl = await fetchDSL(appId, "product-detail");
      if (!isMounted) return;
      const nextSections = resolveSections(liveDsl?.dsl);
      setDslSections(nextSections);
      dslVersionRef.current = liveDsl?.versionNumber ?? null;
      setDslLoading(false);
    };

    loadDetailLayout();

    return () => {
      isMounted = false;
    };
  }, [appId, detailSections]);

  // Auto-refresh DSL periodically to pick up newly published versions
  useEffect(() => {
    const resolvedSections = resolveSections(detailSections);
    if (resolvedSections.length) return undefined;

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

  const sectionsToRender = useMemo(
    () => resolveSections(dslSections),
    [dslSections]
  );

  const fallbackSections = useMemo(() => {
    const defaults = buildProductDefaults(detailProduct);

    return [
      {
        id: "product-detail-image",
        component: "product_library",
        props: {
          raw: {
            imageUrl: defaults.imageUrl,
          },
        },
      },
      {
        id: "product-detail-info",
        component: "product_info",
        props: {
          raw: defaults,
        },
      },
      {
        id: "product-detail-description",
        component: "product_description",
        props: {
          raw: defaults,
        },
      },
    ];
  }, [detailProduct]);

  const renderSections = useMemo(() => {
    const baseSections = sectionsToRender.length ? sectionsToRender : fallbackSections;
    return baseSections.map((section) => mergeSectionWithProduct(section, detailProduct));
  }, [detailProduct, fallbackSections, sectionsToRender]);

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {dslLoading && <Text style={styles.status}>Loading product layout...</Text>}
          {loading && <Text style={styles.status}>Loading product details...</Text>}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {renderSections.map((section, index) => (
            <View key={section?.id || section?.component || index} style={styles.section}>
              <DynamicRenderer section={section} />
            </View>
          ))}
        </ScrollView>
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    backgroundColor: "#F7F7F7",
    minHeight: "100%",
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
});

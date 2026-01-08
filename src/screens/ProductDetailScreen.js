import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchShopifyProductDetails } from "../services/shopify";
import { fetchDSL } from "../engine/dslHandler";

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
  const product = route?.params?.product || {};
  const detailSections = route?.params?.detailSections;
  const [detailProduct, setDetailProduct] = useState(product);
  const [dslSections, setDslSections] = useState([]);
  const [dslLoading, setDslLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isMountedRef = useRef(true);

  const loadProductDetails = useCallback(async () => {
    if (!product?.handle && !product?.id) return;
    setLoading(true);
    setError("");

    const details = await fetchShopifyProductDetails({
      handle: product?.handle,
      id: product?.id,
    });

    if (!isMountedRef.current) return;
    if (details) {
      setDetailProduct({ ...product, ...details });
    } else {
      setDetailProduct(product);
      setError("Unable to load product details right now.");
    }
    setLoading(false);
  }, [product]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProductDetails();
      if (!product?.handle && !product?.id) return undefined;

      const refreshInterval = setInterval(() => {
        loadProductDetails();
      }, 30000);

      return () => clearInterval(refreshInterval);
    }, [loadProductDetails, product?.handle, product?.id])
  );

  useEffect(() => {
    let isMounted = true;
    const loadDetailLayout = async () => {
      const resolvedSections = resolveSections(detailSections);
      if (resolvedSections.length) {
        setDslSections(resolvedSections);
        return;
      }

      setDslLoading(true);
      const liveDsl = await fetchDSL(1, "product-detail");
      if (!isMounted) return;
      const nextSections = resolveSections(liveDsl?.dsl);
      setDslSections(nextSections);
      setDslLoading(false);
    };

    loadDetailLayout();

    return () => {
      isMounted = false;
    };
  }, [detailSections]);

  const sectionsToRender = useMemo(
    () =>
      resolveSections(dslSections).map((section) =>
        mergeSectionWithProduct(section, detailProduct)
      ),
    [detailProduct, dslSections]
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

  const renderSections = sectionsToRender.length ? sectionsToRender : fallbackSections;

  return (
    <SafeArea>
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
    </SafeArea>
  );
}

const styles = StyleSheet.create({
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

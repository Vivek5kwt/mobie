import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { SafeArea } from "../utils/SafeAreaHandler";

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
});

const mergeSectionWithProduct = (section, product) => {
  if (!section) return section;
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const mergedRaw = { ...buildProductDefaults(product), ...(raw || {}) };

  if (section?.properties?.props?.properties) {
    return {
      ...section,
      properties: {
        ...section.properties,
        props: {
          ...section.properties.props,
          properties: {
            ...section.properties.props.properties,
            raw: mergedRaw,
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
          raw: mergedRaw,
        },
      },
    };
  }

  if (section?.props) {
    return {
      ...section,
      props: {
        ...section.props,
        raw: mergedRaw,
      },
    };
  }

  return {
    ...section,
    props: {
      raw: mergedRaw,
    },
  };
};

export default function ProductDetailScreen() {
  const route = useRoute();
  const product = route?.params?.product || {};
  const detailSections = route?.params?.detailSections;

  const sectionsToRender = useMemo(
    () =>
      resolveSections(detailSections).map((section) =>
        mergeSectionWithProduct(section, product)
      ),
    [detailSections, product]
  );

  return (
    <SafeArea>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {sectionsToRender.length ? (
          sectionsToRender.map((section, index) => (
            <View key={section?.id || section?.component || index} style={styles.section}>
              <DynamicRenderer section={section} />
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No product details configured.</Text>
            <Text style={styles.emptySubtitle}>
              Add product detail components in the JSON to show them here.
            </Text>
          </View>
        )}
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
  emptyState: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});

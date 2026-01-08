import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getShopifyDomain, getShopifyToken } from "../services/shopify";

const PRODUCT_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          featuredImage {
            url
          }
          variants(first: 1) {
            edges {
              node {
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;

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

export default function ProductGrid({ section, limit = 8, title = "Products" }) {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const resolvedLimit = toNumber(rawProps?.limit, limit);
  const resolvedTitle = toString(rawProps?.title, title);
  const detailSections = useMemo(() => {
    const candidates = [
      rawProps?.productDetailSections,
      rawProps?.detailSections,
      rawProps?.productDetails,
      rawProps?.detail,
      rawProps?.details,
    ];

    for (const candidate of candidates) {
      const resolved = unwrapValue(candidate, undefined);
      if (Array.isArray(resolved)) return resolved;
      if (Array.isArray(resolved?.sections)) return resolved.sections;
    }

    return [];
  }, [rawProps]);
  const gridGap = 16;
  const horizontalPadding = 24;
  const screenWidth = Dimensions.get("window").width;
  const cardWidth = Math.max(
    0,
    (screenWidth - horizontalPadding * 2 - gridGap) / 2
  );

  useEffect(() => {
    setShowAll(false);
  }, [resolvedLimit, resolvedTitle]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchProductsPage = async ({ first, after }) => {
      const shopifyDomain = getShopifyDomain();
      const shopifyToken = getShopifyToken();
      const endpoint = `https://${shopifyDomain}/api/2024-10/graphql.json`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": shopifyToken,
        },
        body: JSON.stringify({
          query: PRODUCT_QUERY,
          variables: { first, after },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      return response.json();
    };

    const mapProducts = (edges) =>
      edges.map(({ node }) => {
        const priceNode = node?.variants?.edges?.[0]?.node?.price;
        return {
          id: node?.id,
          title: node?.title,
          handle: node?.handle,
          imageUrl: node?.featuredImage?.url,
          priceAmount: priceNode?.amount,
          priceCurrency: priceNode?.currencyCode,
        };
      });

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        if (!showAll) {
          const payload = await fetchProductsPage({ first: resolvedLimit, after: null });
          const edges = payload?.data?.products?.edges || [];
          const nextProducts = mapProducts(edges);
          const pageInfo = payload?.data?.products?.pageInfo || {};

          if (isMounted) {
            setProducts(nextProducts);
            setHasMore(Boolean(pageInfo?.hasNextPage));
          }
          return;
        }

        let cursor = null;
        let hasNextPage = true;
        const allProducts = [];
        const pageSize = 50;

        while (hasNextPage) {
          const payload = await fetchProductsPage({ first: pageSize, after: cursor });
          const edges = payload?.data?.products?.edges || [];
          const pageInfo = payload?.data?.products?.pageInfo || {};
          allProducts.push(...mapProducts(edges));
          hasNextPage = Boolean(pageInfo?.hasNextPage);
          cursor = pageInfo?.endCursor || null;
        }

        if (isMounted) {
          setProducts(allProducts);
          setHasMore(false);
        }
      } catch (err) {
        if (isMounted && err?.name !== "AbortError") {
          setError("Unable to load products right now. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [resolvedLimit, showAll]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>{resolvedTitle}</Text>

      {loading && <Text style={styles.status}>Loading products...</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (
        <>
          <View style={styles.grid}>
            {products.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={[styles.card, { width: cardWidth }]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("ProductDetail", {
                    product,
                    detailSections,
                  })
                }
              >
                {product.imageUrl && (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.image}
                    resizeMode="cover"
                  />
                )}

                <View style={styles.content}>
                  <Text numberOfLines={2} style={styles.name}>
                    {product.title}
                  </Text>
                  <Text style={styles.price}>
                    {product.priceCurrency} {product.priceAmount}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          {hasMore && !showAll && (
            <TouchableOpacity
              style={styles.viewAllButton}
              activeOpacity={0.8}
              onPress={() => setShowAll(true)}
            >
              <Text style={styles.viewAllText}>View all ›</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

export function ProductGridExample() {
  return <ProductGrid limit={8} title="Featured Products" />;
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    color: "#111827",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  image: {
    width: "100%",
    height: 200,
    backgroundColor: "#f3f4f6",
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  price: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    paddingVertical: 12,
    textAlign: "center",
    color: "#6b7280",
  },
  error: {
    paddingVertical: 12,
    textAlign: "center",
    color: "#b91c1c",
  },
  viewAllButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  viewAllText: {
    color: "#111827",
    fontWeight: "600",
  },
});

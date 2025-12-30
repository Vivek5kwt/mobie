import React, { useEffect, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";

const SHOPIFY_DOMAIN = "YOUR_SHOP_DOMAIN";
const STOREFRONT_TOKEN = "YOUR_STOREFRONT_TOKEN";
const SHOPIFY_ENDPOINT = `https://${SHOPIFY_DOMAIN}.myshopify.com/api/2024-10/graphql.json`;

const PRODUCT_QUERY = `
  query GetProducts($first: Int!) {
    products(first: $first) {
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

export default function ProductGrid({ limit = 8, title = "Products" }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const cardWidth = Math.max(160, (Dimensions.get("window").width - 72) / 2);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(SHOPIFY_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
          },
          body: JSON.stringify({
            query: PRODUCT_QUERY,
            variables: { first: limit },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const payload = await response.json();
        const edges = payload?.data?.products?.edges || [];
        const nextProducts = edges.map(({ node }) => {
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

        if (isMounted) {
          setProducts(nextProducts);
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
  }, [limit]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>{title}</Text>

      {loading && <Text style={styles.status}>Loading products...</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && (
        <View style={styles.grid}>
          {products.map((product) => (
            <View key={product.id} style={[styles.card, { width: cardWidth }]}>
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
            </View>
          ))}
        </View>
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
});

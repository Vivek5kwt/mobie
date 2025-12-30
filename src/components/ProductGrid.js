import React, { useEffect, useMemo, useState } from "react";

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

  const styles = useMemo(
    () => ({
      wrapper: {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
      heading: {
        fontSize: "1.5rem",
        fontWeight: 700,
        marginBottom: "16px",
      },
      grid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
      },
      card: {
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "#fff",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.05)",
      },
      image: {
        width: "100%",
        height: "200px",
        objectFit: "cover",
        backgroundColor: "#f3f4f6",
        display: "block",
      },
      content: {
        padding: "12px 14px 16px",
      },
      name: {
        fontSize: "1rem",
        fontWeight: 600,
        margin: 0,
      },
      price: {
        marginTop: "6px",
        color: "#111827",
        fontWeight: 600,
      },
      link: {
        textDecoration: "none",
        color: "inherit",
      },
      status: {
        padding: "12px",
        textAlign: "center",
        color: "#6b7280",
      },
      error: {
        padding: "12px",
        textAlign: "center",
        color: "#b91c1c",
      },
    }),
    []
  );

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
    <section style={styles.wrapper}>
      <h2 style={styles.heading}>{title}</h2>

      {loading && <div style={styles.status}>Loading products...</div>}
      {error && <div style={styles.error}>{error}</div>}

      {!loading && !error && (
        <div style={styles.grid}>
          {products.map((product) => (
            <article key={product.id} style={styles.card}>
              <a href={`/products/${product.handle}`} style={styles.link}>
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    style={styles.image}
                  />
                )}

                <div style={styles.content}>
                  <h3 style={styles.name}>{product.title}</h3>
                  <div style={styles.price}>
                    {product.priceCurrency} {product.priceAmount}
                  </div>
                </div>
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProductGridExample() {
  return <ProductGrid limit={8} title="Featured Products" />;
}

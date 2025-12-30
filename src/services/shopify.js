const STOREFRONT_VERSION = "2024-10";
export const SHOPIFY_SHOP = "5kwebtech-test.myshopify.com";

export const SHOPIFY_TOKEN = "79363ed16cc2c1e01f4dc18f813c41a8";

// ----------------------
// BASE GRAPHQL CALL
// ----------------------
export async function directStorefrontGraphQL({
  shop,
  token,
  query,
  variables,
}) {
  const endpoint = `https://${shop}/api/${STOREFRONT_VERSION}/graphql.json`;

  console.log("🟡 Shopify Request →", {
    endpoint,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": "***hidden***",
    },
    variables,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  console.log("🟡 HTTP Status:", res.status);

  let json;
  try {
    json = await res.json();
  } catch (e) {
    console.error("❌ Failed to parse JSON from Shopify:", e);
    throw e;
  }

  console.log("🟡 Raw Shopify Response JSON →", JSON.stringify(json, null, 2));

  if (!res.ok) {
    console.error("❌ HTTP Error Response:", json);
    throw new Error(`Storefront HTTP Error ${res.status}`);
  }

  return json;
}

// ----------------------
// FETCH PRODUCTS
// ----------------------
export async function fetchShopifyProducts(limit = 10, options = {}) {
  const shop = options.shop || SHOPIFY_SHOP;
  const token = options.token || SHOPIFY_TOKEN;

  const query = `
    query Products($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
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

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      query,
      variables: { first: limit },
    });

    // LOG GRAPHQL ERRORS
    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    // LOG DATA SHAPE
    console.log(
      "🟢 Shopify Products Data Shape →",
      JSON.stringify(json?.data?.products, null, 2)
    );

    const edges = json?.data?.products?.edges || [];

    // SAFETY: handle empty / missing variants
    const products = edges.map((edge) => {
      const variants = edge?.node?.variants?.edges || [];
      const price = variants[0]?.node?.price;

      return {
        id: edge?.node?.id,
        name: edge?.node?.title,
        image: edge?.node?.featuredImage?.url || null,
        price: price?.amount || null,
        currency: price?.currencyCode || null,
      };
    });

    console.log("🟢 Final Parsed Product List →", products);

    return products;
  } catch (error) {
    console.error("❌ Shopify Product Fetch Error:", error);
    return [];
  }
}

const STOREFRONT_VERSION = "2024-10";
export const SHOPIFY_SHOP = "newmobidrag.myshopify.com";

export const SHOPIFY_TOKEN =
  "shpua_5467f837b05502095a558b7d58ef91a2";

export async function directStorefrontGraphQL({
  shop,
  token,
  query,
  variables,
}) {
  const endpoint = `https://${shop}/api/${STOREFRONT_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Storefront ${res.status}`);
  return res.json();
}

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
            featuredImage { url }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
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

    return (
      json?.data?.products?.edges?.map((edge) => ({
        id: edge.node.id,
        name: edge.node.title,
        image: edge.node.featuredImage?.url,
        price: edge.node.priceRange.minVariantPrice.amount,
        currency: edge.node.priceRange.minVariantPrice.currencyCode,
      })) || []
    );
  } catch (error) {
    console.log("❌ Shopify Product Fetch Error:", error);
    return [];
  }
}

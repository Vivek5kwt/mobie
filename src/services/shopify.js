export const SHOPIFY_DOMAIN =
  "https://newmobidrag.myshopify.com/api/2024-10/graphql.json";

export const SHOPIFY_TOKEN =
  "shpua_5467f837b05502095a558b7d58ef91a2";

export async function fetchShopifyProducts(limit = 10) {
  const query = `
    {
      products(first: ${limit}) {
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
    const res = await fetch(SHOPIFY_DOMAIN, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();

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

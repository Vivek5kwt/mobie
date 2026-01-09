const STOREFRONT_VERSION = "2024-10";
export const SHOPIFY_SHOP = "5kwebtech-test.myshopify.com";

export const SHOPIFY_TOKEN = "79363ed16cc2c1e01f4dc18f813c41a8";

const getWindowValue = (key) => {
  if (typeof window === "undefined") return undefined;
  return window?.[key];
};

export const getShopifyDomain = () => getWindowValue("__SHOP_DOMAIN__") || SHOPIFY_SHOP;

export const getShopifyToken = () => getWindowValue("__STOREFRONT_TOKEN__") || SHOPIFY_TOKEN;

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
      "X-Shopify-Storefront-Access-Token": "79363ed16cc2c1e01f4dc18f813c41a8",
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
  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

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

// ----------------------
// FETCH PRODUCTS (PAGINATED)
// ----------------------
export async function fetchShopifyProductsPage({
  first = 20,
  after = null,
  options = {},
} = {}) {
  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

  const query = `
    query Products($first: Int!, $after: String) {
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

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      query,
      variables: { first, after },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    const edges = json?.data?.products?.edges || [];
    const pageInfo = json?.data?.products?.pageInfo || {
      hasNextPage: false,
      endCursor: null,
    };

    const products = edges.map((edge) => {
      const variants = edge?.node?.variants?.edges || [];
      const price = variants[0]?.node?.price;

      return {
        id: edge?.node?.id,
        title: edge?.node?.title,
        handle: edge?.node?.handle,
        imageUrl: edge?.node?.featuredImage?.url || null,
        priceAmount: price?.amount || null,
        priceCurrency: price?.currencyCode || null,
      };
    });

    return { products, pageInfo };
  } catch (error) {
    console.error("❌ Shopify Product Page Fetch Error:", error);
    return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }
}

// ----------------------
// FETCH PRODUCT DETAILS
// ----------------------
export async function fetchShopifyProductDetails({ handle, id, options = {} }) {
  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

  const queryByHandle = `
    query ProductByHandle($handle: String!) {
      productByHandle(handle: $handle) {
        id
        title
        handle
        vendor
        description
        featuredImage {
          url
        }
        options {
          name
          values
        }
        variants(first: 1) {
          edges {
            node {
              id
              price {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  const queryById = `
    query ProductById($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        vendor
        description
        featuredImage {
          url
        }
        options {
          name
          values
        }
        variants(first: 1) {
          edges {
            node {
              id
              price {
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
    const query = handle ? queryByHandle : queryById;
    const variables = handle ? { handle } : { id };

    if (!variables.handle && !variables.id) {
      return null;
    }

    const json = await directStorefrontGraphQL({
      shop,
      token,
      query,
      variables,
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return null;
    }

    const product = handle ? json?.data?.productByHandle : json?.data?.product;
    if (!product) return null;

    const priceNode = product?.variants?.edges?.[0]?.node?.price;
    const variantId = product?.variants?.edges?.[0]?.node?.id;
    const variantOptions =
      product?.options?.flatMap((option) =>
        (option?.values || []).map((value) => ({
          id: `${option?.name}-${value}`,
          name: option?.name,
          value,
        }))
      ) || [];

    return {
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
      vendor: product?.vendor,
      description: product?.description,
      imageUrl: product?.featuredImage?.url,
      priceAmount: priceNode?.amount,
      priceCurrency: priceNode?.currencyCode,
      variantOptions,
      variantId,
    };
  } catch (error) {
    console.error("❌ Shopify Product Detail Fetch Error:", error);
    return null;
  }
}

export async function createShopifyCheckout({ variantId, quantity = 1, options = {} }) {
  if (!variantId) {
    throw new Error("Missing variant ID for checkout.");
  }

  const ensureVariantGid = (value) => {
    if (!value) return "";
    const raw = String(value);
    if (raw.startsWith("gid://")) return raw;
    const match = raw.match(/(\d+)/);
    if (match) {
      return `gid://shopify/ProductVariant/${match[1]}`;
    }
    return raw;
  };

  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();
  const merchandiseId = ensureVariantGid(variantId);

  const mutation = `
    mutation CreateCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const json = await directStorefrontGraphQL({
    shop,
    token,
    query: mutation,
    variables: {
      input: {
        lines: [
          {
            merchandiseId,
            quantity: Math.max(1, quantity),
          },
        ],
      },
    },
  });

  if (json?.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join(" "));
  }

  const payload = json?.data?.cartCreate;
  const errors = payload?.userErrors || [];

  if (errors.length) {
    throw new Error(errors.map((error) => error.message).join(" "));
  }

  const checkoutUrl = payload?.cart?.checkoutUrl ?? payload?.cart?.checckoutUrl;
  if (!checkoutUrl) {
    throw new Error("Checkout URL not returned.");
  }

  return checkoutUrl;
}

// ----------------------
// SEARCH PRODUCTS
// ----------------------
export async function searchShopifyProducts(searchTerm, limit = 10, options = {}) {
  const term = String(searchTerm || "").trim();
  if (!term) return [];

  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

  const query = `
    query SearchProducts($first: Int!, $query: String!) {
      products(first: $first, query: $query) {
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

  const searchQuery = `title:*${term}* OR handle:*${term}*`;

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      query,
      variables: { first: limit, query: searchQuery },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    const edges = json?.data?.products?.edges || [];

    return edges.map(({ node }) => {
      const priceNode = node?.variants?.edges?.[0]?.node?.price;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        imageUrl: node?.featuredImage?.url || null,
        priceAmount: priceNode?.amount || null,
        priceCurrency: priceNode?.currencyCode || null,
      };
    });
  } catch (error) {
    console.error("❌ Shopify Product Search Error:", error);
    return [];
  }
}

// ----------------------
// FETCH COLLECTIONS
// ----------------------
export async function fetchShopifyCollections(limit = 10, options = {}) {
  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

  const query = `
    query Collections($first: Int!) {
      collections(first: $first) {
        edges {
          node {
            id
            title
            handle
            image {
              url
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

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    const edges = json?.data?.collections?.edges || [];

    return edges.map(({ node }) => ({
      id: node?.id,
      title: node?.title,
      handle: node?.handle,
      imageUrl: node?.image?.url || null,
    }));
  } catch (error) {
    console.error("❌ Shopify Collections Fetch Error:", error);
    return [];
  }
}

// ----------------------
// FETCH COLLECTION PRODUCTS
// ----------------------
export async function fetchShopifyCollectionProducts({
  handle,
  first = 20,
  after = null,
  options = {},
} = {}) {
  if (!handle) return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };

  const shop = options.shop || getShopifyDomain();
  const token = options.token || getShopifyToken();

  const query = `
    query CollectionProducts($handle: String!, $first: Int!, $after: String) {
      collection(handle: $handle) {
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
    }
  `;

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      query,
      variables: { handle, first, after },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    const productsNode = json?.data?.collection?.products;
    const edges = productsNode?.edges || [];
    const pageInfo = productsNode?.pageInfo || {
      hasNextPage: false,
      endCursor: null,
    };

    const products = edges.map(({ node }) => {
      const priceNode = node?.variants?.edges?.[0]?.node?.price;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        imageUrl: node?.featuredImage?.url || null,
        priceAmount: priceNode?.amount || null,
        priceCurrency: priceNode?.currencyCode || null,
      };
    });

    return { products, pageInfo };
  } catch (error) {
    console.error("❌ Shopify Collection Products Fetch Error:", error);
    return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }
}

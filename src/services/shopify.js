import { fetchStoreConfig, getStoreConfigSync } from './storeService';

const STOREFRONT_VERSION = "2024-10";
// Backend proxy — handles Shopify auth server-side so the mobile app
// never needs a valid storefront token on-device.
const PROXY_ENDPOINT = "https://app.mobidrag.com/api/shopify/preview-graphql";

// Fallback credentials — used when getStore fails
const FALLBACK_SHOP    = "mobidrag-demo.myshopify.com";
const FALLBACK_TOKEN   = "f19ea13e90fdadc0723f8a060f1d754b";
const FALLBACK_STORE_ID = 40;
const DEFAULT_CHECKOUT_COUNTRY_CODE = "US";

/**
 * Async: awaits the GetStore result so we always use the live credentials.
 * Returns { shop, token, storeId } — storeId sent to proxy for server-side auth lookup.
 */
const getShopifyCredentials = async () => {
  const config = await fetchStoreConfig();
  const storeId = config?.id ? Number(config.id) : FALLBACK_STORE_ID;
  console.log(`🛒 Shopify credentials: storeId=${storeId} shop=${config?.shopify_domain || FALLBACK_SHOP}`);
  return {
    shop:    config?.shopify_domain          || FALLBACK_SHOP,
    token:   config?.storefront_access_token || FALLBACK_TOKEN,
    storeId,
  };
};

// Sync accessors kept for callers that haven't migrated yet (post-cache only)
export const getShopifyDomain = () =>
  getStoreConfigSync()?.shopify_domain || FALLBACK_SHOP;

export const getShopifyToken = () =>
  getStoreConfigSync()?.storefront_access_token || FALLBACK_TOKEN;

// ─── GraphQL query constants ───────────────────────────────────────────────

export const QUERY_RECENT_PRODUCTS = `
  query RecentProductsFallback($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          availableForSale
          featuredImage { url altText }
          images(first: 1) { edges { node { url altText } } }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          variants(first: 1) {
            edges {
              node {
                id
                availableForSale
                compareAtPrice
              }
            }
          }
        }
      }
    }
  }
`;

export const QUERY_COLLECTIONS = `
  query Collections($first: Int = 20) {
    collections(first: $first) {
      edges {
        node {
          id
          title
          handle
          image { url altText }
        }
      }
    }
  }
`;

// ─── Base GraphQL call ─────────────────────────────────────────────────────
// Routes through the backend proxy so the server supplies valid Shopify
// credentials. Falls back to a direct Storefront API call if the proxy
// is unreachable (offline / dev environment).
export async function directStorefrontGraphQL({ shop, token, storeId, query, variables }) {
  const resolvedStoreId = storeId || FALLBACK_STORE_ID;

  // ── 1. Try backend proxy (preferred) ──────────────────────────────────────
  try {
    console.log(`🔌 Proxy request: storeId=${resolvedStoreId} shop=${shop}`);
    const proxyRes = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: resolvedStoreId, shop, query, variables }),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (!json?.errors) {
        console.log("✅ Proxy success");
        return json;
      }
      console.warn("⚠️ Proxy GraphQL errors:", JSON.stringify(json.errors));
      // Fall through to direct call
    } else {
      const text = await proxyRes.text().catch(() => "");
      console.warn(`⚠️ Proxy HTTP ${proxyRes.status}: ${text}`);
    }
  } catch (proxyErr) {
    console.warn("⚠️ Proxy unreachable:", proxyErr.message);
  }

  // ── 2. Direct Storefront API fallback ──────────────────────────────────────
  if (!token) throw new Error("No storefront token and proxy unavailable");

  console.log(`🔌 Direct Storefront call: ${shop}`);
  const endpoint = `https://${shop}/api/${STOREFRONT_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  let json;
  try { json = await res.json(); } catch (e) { throw e; }

  if (!res.ok) {
    console.error("❌ Direct Storefront HTTP Error:", res.status, json);
    throw new Error(`Storefront HTTP Error ${res.status}`);
  }

  console.log("✅ Direct Storefront success");
  return json;
}

// ----------------------
// FETCH PRODUCTS
// ----------------------
export async function fetchShopifyProducts(limit = 10, options = {}) {
  // Delegate to the richer recent-products query (proxy-aware, more fields)
  return fetchShopifyRecentProducts(limit, options);
}

// ----------------------
// FETCH RECENT PRODUCTS (richer query via proxy)
// ----------------------
export async function fetchShopifyRecentProducts(limit = 10, options = {}) {
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

  try {
    const json = await directStorefrontGraphQL({
      shop, token, storeId,
      query: QUERY_RECENT_PRODUCTS,
      variables: { first: Math.max(1, limit) },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    const edges = json?.data?.products?.edges || [];
    return edges.map(({ node }) => {
      const variant = node?.variants?.edges?.[0]?.node;
      const price = node?.priceRangeV2?.minVariantPrice;
      return {
        id: node?.id,
        name: node?.title,
        title: node?.title,
        handle: node?.handle,
        availableForSale: node?.availableForSale ?? true,
        image: node?.featuredImage?.url || node?.images?.edges?.[0]?.node?.url || null,
        imageUrl: node?.featuredImage?.url || node?.images?.edges?.[0]?.node?.url || null,
        price: price?.amount || null,
        priceAmount: price?.amount || null,
        currency: price?.currencyCode || null,
        priceCurrency: price?.currencyCode || null,
        compareAtPrice: variant?.compareAtPrice || null,
        variantId: variant?.id || null,
      };
    });
  } catch (error) {
    console.error("❌ fetchShopifyRecentProducts error:", error);
    return [];
  }
}

// ----------------------
// FETCH COLLECTIONS LIST
// ----------------------
export async function fetchShopifyCollectionsList(limit = 20, options = {}) {
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

  try {
    const json = await directStorefrontGraphQL({
      shop, token, storeId,
      query: QUERY_COLLECTIONS,
      variables: { first: Math.max(1, limit) },
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
    console.error("❌ fetchShopifyCollectionsList error:", error);
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
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

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
            availableForSale
            featuredImage {
              url
            }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            variants(first: 1) {
              edges {
                node {
                  id
                  availableForSale
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
      storeId,
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
      const variant = edge?.node?.variants?.edges?.[0]?.node;
      const price = edge?.node?.priceRangeV2?.minVariantPrice;

      return {
        id: edge?.node?.id,
        title: edge?.node?.title,
        handle: edge?.node?.handle,
        availableForSale: edge?.node?.availableForSale ?? true,
        variantId: variant?.id || null,
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
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

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
        images(first: 10) {
          edges {
            node {
              url
            }
          }
        }
        options {
          name
          values
        }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
        ratingMeta: metafield(namespace: "reviews", key: "rating") { value }
        ratingCountMeta: metafield(namespace: "reviews", key: "rating_count") { value }
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
        images(first: 10) {
          edges {
            node {
              url
            }
          }
        }
        options {
          name
          values
        }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
        ratingMeta: metafield(namespace: "reviews", key: "rating") { value }
        ratingCountMeta: metafield(namespace: "reviews", key: "rating_count") { value }
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
      storeId,
      query,
      variables,
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return null;
    }

    const product = handle ? json?.data?.productByHandle : json?.data?.product;
    if (!product) return null;

    const priceNode = product?.priceRangeV2?.minVariantPrice;
    const variantId = product?.variants?.edges?.[0]?.node?.id;
    const variantOptions =
      product?.options?.flatMap((option) =>
        (option?.values || []).map((value) => ({
          id: `${option?.name}-${value}`,
          name: option?.name,
          value,
        }))
      ) || [];

    const images = (product?.images?.edges || [])
      .map((e) => e?.node?.url)
      .filter(Boolean);

    // Rating metafields — written by Judge.me / Yotpo / Stamped / Okendo etc.
    // The "rating" metafield value is JSON like {"value":"4.6","scale_max":"5.0"}
    // The "rating_count" metafield is a plain number string
    let ratingValue = "";
    let ratingCount = "";
    try {
      const ratingRaw = product?.ratingMeta?.value;
      if (ratingRaw) {
        const parsed = typeof ratingRaw === "string" ? JSON.parse(ratingRaw) : ratingRaw;
        ratingValue = String(parsed?.value ?? parsed ?? "");
      }
      const countRaw = product?.ratingCountMeta?.value;
      if (countRaw) {
        ratingCount = String(countRaw);
      }
    } catch (_) {}

    return {
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
      vendor: product?.vendor,
      description: product?.description,
      imageUrl: product?.featuredImage?.url,
      images: images.length > 0 ? images : (product?.featuredImage?.url ? [product.featuredImage.url] : []),
      priceAmount: priceNode?.amount,
      priceCurrency: priceNode?.currencyCode,
      variantOptions,
      variantId,
      rating: ratingValue,
      reviewCount: ratingCount,
    };
  } catch (error) {
    console.error("❌ Shopify Product Detail Fetch Error:", error);
    return null;
  }
}

const ensureVariantGid = (value) => {
  if (!value) return "";
  const raw = String(value);
  if (raw.startsWith("gid://")) {
    return raw.includes("ProductVariant") ? raw : "";
  }
  const match = raw.match(/(\d+)/);
  if (match) {
    return `gid://shopify/ProductVariant/${match[1]}`;
  }
  return "";
};

const resolveBuyerCountryCode = (options = {}) => {
  const rawCode = String(
    options?.countryCode ??
    options?.buyerCountryCode ??
    options?.country ??
    DEFAULT_CHECKOUT_COUNTRY_CODE
  ).trim().toUpperCase();

  return /^[A-Z]{2}$/.test(rawCode) ? rawCode : DEFAULT_CHECKOUT_COUNTRY_CODE;
};

export async function createShopifyCheckout({ variantId, quantity = 1, options = {} }) {
  if (!variantId) {
    throw new Error("Missing variant ID for checkout.");
  }

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  const merchandiseId = ensureVariantGid(variantId);
  const buyerCountryCode = resolveBuyerCountryCode(options);

  if (!merchandiseId) {
    throw new Error("Invalid variant ID for checkout.");
  }

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
    storeId,
    query: mutation,
    variables: {
      input: {
        lines: [
          {
            merchandiseId,
            quantity: Math.max(1, quantity),
          },
        ],
        buyerIdentity: {
          countryCode: buyerCountryCode,
        },
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

export async function createShopifyCartCheckout({ items = [], options = {} }) {
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  const buyerCountryCode = resolveBuyerCountryCode(options);

  const lines = (items || [])
    .map((item) => ({
      merchandiseId: ensureVariantGid(item?.variantId || item?.id),
      quantity: Math.max(1, Number(item?.quantity) || 1),
    }))
    .filter((line) => line.merchandiseId);

  // Build numeric variant IDs for direct cart URL fallback (no API needed)
  const directCartLines = (items || [])
    .map((item) => {
      const raw = String(item?.variantId || item?.id || "");
      const match = raw.match(/ProductVariant\/(\d+)/) || (!raw.includes("gid://") && raw.match(/^(\d+)$/));
      if (!match) return null;
      return `${match[1]}:${Math.max(1, Number(item?.quantity) || 1)}`;
    })
    .filter(Boolean);

  if (!lines.length && !directCartLines.length) {
    throw new Error("No valid cart items for checkout.");
  }

  // ── Attempt 1: cartCreate mutation (Storefront API 2021-07+) ──────────────
  if (lines.length) {
    const cartCreateMutation = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart { checkoutUrl }
          userErrors { field message }
        }
      }
    `;
    try {
      const json = await directStorefrontGraphQL({
        shop, token, storeId,
        query: cartCreateMutation,
        variables: {
          input: {
            lines,
            buyerIdentity: {
              countryCode: buyerCountryCode,
            },
          },
        },
      });
      if (!json?.errors?.length) {
        const payload = json?.data?.cartCreate;
        if (!payload?.userErrors?.length) {
          const url = payload?.cart?.checkoutUrl;
          if (url) {
            console.log("✅ Checkout via cartCreate:", url);
            return url;
          }
        }
      }
      console.warn("⚠️ cartCreate failed, trying checkoutCreate...");
    } catch (e) {
      console.warn("⚠️ cartCreate error:", e.message);
    }

    // ── Attempt 2: checkoutCreate mutation (older Storefront API) ────────────
    const checkoutCreateMutation = `
      mutation CheckoutCreate($input: CheckoutCreateInput!) {
        checkoutCreate(input: $input) {
          checkout { webUrl }
          checkoutUserErrors { field message }
        }
      }
    `;
    try {
      const lineItems = lines.map((line) => ({
        variantId: line.merchandiseId,
        quantity: line.quantity,
      }));
      const json = await directStorefrontGraphQL({
        shop, token, storeId,
        query: checkoutCreateMutation,
        variables: { input: { lineItems } },
      });
      if (!json?.errors?.length) {
        const payload = json?.data?.checkoutCreate;
        if (!payload?.checkoutUserErrors?.length) {
          const url = payload?.checkout?.webUrl;
          if (url) {
            console.log("✅ Checkout via checkoutCreate:", url);
            return url;
          }
        }
      }
      console.warn("⚠️ checkoutCreate failed, falling back to direct cart URL...");
    } catch (e) {
      console.warn("⚠️ checkoutCreate error:", e.message);
    }
  }

  // ── Attempt 3: direct Shopify cart URL (no API call needed) ─────────────
  if (directCartLines.length) {
    const url = `https://${shop}/cart/${directCartLines.join(",")}`;
    console.log("✅ Checkout via direct cart URL:", url);
    return url;
  }

  throw new Error("Checkout URL not returned. Please try again.");
}

// ----------------------
// SEARCH PRODUCTS
// ----------------------
export async function searchShopifyProducts(searchTerm, limit = 10, options = {}) {
  const term = String(searchTerm || "").trim();
  if (!term) return [];

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

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
            priceRangeV2 { minVariantPrice { amount currencyCode } }
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
      storeId,
      query,
      variables: { first: limit, query: searchQuery },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    const edges = json?.data?.products?.edges || [];

    return edges.map(({ node }) => {
      const priceNode = node?.priceRangeV2?.minVariantPrice;
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
  return fetchShopifyCollectionsList(limit, options);
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

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

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
              availableForSale
              featuredImage {
                url
              }
              priceRangeV2 { minVariantPrice { amount currencyCode } }
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
      storeId,
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
      const priceNode = node?.priceRangeV2?.minVariantPrice;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        availableForSale: node?.availableForSale ?? true,
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

// ----------------------
// FETCH CUSTOMER ORDERS
// ----------------------
export async function fetchCustomerOrders({ customerAccessToken, first = 10 } = {}) {
  if (!customerAccessToken) return { orders: [] };

  const creds = await getShopifyCredentials();
  const { shop, token, storeId } = creds;

  const query = `
    query CustomerOrders($customerAccessToken: String!, $first: Int!) {
      customer(customerAccessToken: $customerAccessToken) {
        orders(first: $first, reverse: true) {
          edges {
            node {
              id
              name
              orderNumber
              processedAt
              financialStatus
              fulfillmentStatus
              currentTotalPrice { amount currencyCode }
              totalShippingPrice { amount currencyCode }
              totalTax { amount currencyCode }
              shippingAddress {
                name
                address1
                address2
                city
                country
                zip
              }
              lineItems(first: 20) {
                edges {
                  node {
                    title
                    quantity
                    variant {
                      title
                      image { url }
                      price { amount currencyCode }
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
      shop, token, storeId,
      query,
      variables: { customerAccessToken, first },
    });

    if (json?.errors) {
      console.error("❌ Customer Orders GraphQL errors:", json.errors);
      return { orders: [] };
    }

    const edges = json?.data?.customer?.orders?.edges || [];
    const orders = edges.map(({ node }) => {
      const addr = node.shippingAddress;
      const addressText = addr
        ? [addr.name, addr.address1, addr.address2, addr.city, addr.country, addr.zip]
            .filter(Boolean).join("\n")
        : "";
      const currency = node.currentTotalPrice?.currencyCode || "";
      return {
        id:             node.id,
        orderNumber:    `#${node.orderNumber}`,
        orderDate:      node.processedAt
          ? new Date(node.processedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : "",
        status:         node.fulfillmentStatus || node.financialStatus || "",
        deliveryMethod: "Standard",
        address:        addressText,
        arrival:        "",
        billing:        "Same as delivery address",
        payment:        "",
        delivery:       parseFloat(node.totalShippingPrice?.amount || 0),
        tax:            parseFloat(node.totalTax?.amount || 0),
        total:          parseFloat(node.currentTotalPrice?.amount || 0),
        currencySymbol: currency,
        lineItems: (node.lineItems?.edges || []).map(({ node: li }) => ({
          id:       li.variant?.id || li.title,
          title:    li.title,
          variant:  li.variant?.title || "",
          imageUrl: li.variant?.image?.url || null,
          price:    li.variant?.price
            ? `${currency} ${parseFloat(li.variant.price.amount).toFixed(2)}`
            : "",
          quantity: li.quantity,
        })),
      };
    });

    return { orders };
  } catch (err) {
    console.error("❌ fetchCustomerOrders error:", err);
    return { orders: [] };
  }
}

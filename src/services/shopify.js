import { fetchStoreConfig, getStoreConfigSync } from './storeService';

const STOREFRONT_VERSION = "2024-10";
// Backend proxy — handles Shopify auth server-side so the mobile app
// never needs a valid storefront token on-device.
const PROXY_ENDPOINT = "https://app.mobidrag.com/api/shopify/preview-graphql";
const ADMIN_API_VERSION = STOREFRONT_VERSION;

// Fallback credentials — used when getStore fails
const FALLBACK_SHOP    = "mobidrag-demo.myshopify.com";
const FALLBACK_TOKEN   = "f19ea13e90fdadc0723f8a060f1d754b";
const FALLBACK_STORE_ID = 40;
const DEFAULT_CHECKOUT_COUNTRY_CODE = "US";
const REQUEST_CACHE_TTL_MS = 30000;
const _requestCache = new Map();
const _inflightRequests = new Map();

const buildCacheKey = (scope, payload = {}) => `${scope}:${JSON.stringify(payload)}`;

const getCached = (key) => {
  const hit = _requestCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > REQUEST_CACHE_TTL_MS) {
    _requestCache.delete(key);
    return null;
  }
  return hit.value;
};

const setCached = (key, value) => {
  _requestCache.set(key, { at: Date.now(), value });
};

const withRequestCache = async (key, producer) => {
  const cached = getCached(key);
  if (cached !== null) return cached;

  if (_inflightRequests.has(key)) {
    return _inflightRequests.get(key);
  }

  const task = (async () => {
    try {
      const value = await producer();
      // Never cache empty product lists — transient errors or startup races
      // would lock out retries for the full TTL window.
      const isPlainArray = Array.isArray(value);
      const isProductObject =
        !isPlainArray && value != null && typeof value === "object" && "products" in value;
      const isEmpty =
        (isProductObject && !(value.products?.length > 0)) ||
        (isPlainArray && value.length === 0);
      if (!isEmpty) {
        setCached(key, value);
      }
      return value;
    } finally {
      _inflightRequests.delete(key);
    }
  })();

  _inflightRequests.set(key, task);
  return task;
};

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
    currency: config?.currency || "",
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
          featuredImage { url altText }
          images(first: 1) { edges { node { url altText } } }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          variants(first: 1) {
            edges {
              node {
                id
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
  const cacheKey = buildCacheKey("recentProducts", {
    limit: Math.max(1, Number(limit) || 10),
    shop: options.shop || "",
    storeId: options.storeId || "",
  });

  return withRequestCache(cacheKey, async () => {
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
  });
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
  const cacheKey = buildCacheKey("productsPage", {
    first: Math.max(1, Number(first) || 20),
    after: after || null,
    shop: options.shop || "",
    storeId: options.storeId || "",
  });

  return withRequestCache(cacheKey, async () => {
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
            vendor
            productType
            tags
            options {
              name
              values
            }
            featuredImage { url }
            images(first: 1) { edges { node { url } } }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            variants(first: 1) {
              edges {
                node {
                  id
                  compareAtPrice
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
        vendor: edge?.node?.vendor || "",
        productType: edge?.node?.productType || "",
        tags: edge?.node?.tags || [],
        options: edge?.node?.options || [],
        availableForSale: true,
        variantId: variant?.id || null,
        imageUrl:
          edge?.node?.featuredImage?.url ||
          edge?.node?.images?.edges?.[0]?.node?.url ||
          null,
        priceAmount: price?.amount || null,
        priceCurrency: price?.currencyCode || null,
        compareAtPrice: variant?.compareAtPrice || null,
      };
    });

    return { products, pageInfo };
  } catch (error) {
    console.error("❌ Shopify Product Page Fetch Error:", error);
    return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }
  });
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
        descriptionHtml
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
        descriptionHtml
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

    const firstImageUrl = product?.featuredImage?.url || images[0] || null;
    return {
      id: product?.id,
      title: product?.title,
      handle: product?.handle,
      vendor: product?.vendor,
      description: product?.description,
      descriptionHtml: product?.descriptionHtml,
      imageUrl: firstImageUrl,
      images: images.length > 0 ? images : (firstImageUrl ? [firstImageUrl] : []),
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

const resolveCustomerAccessToken = (options = {}) => {
  const raw =
    options?.customerAccessToken ??
    options?.shopifyCustomerAccessToken ??
    options?.customer_access_token ??
    options?.buyerIdentity?.customerAccessToken ??
    "";
  const value = String(raw || "").trim();
  return value || "";
};

const buildBuyerIdentity = (options = {}) => {
  const buyerIdentity = {
    countryCode: resolveBuyerCountryCode(options),
  };
  const customerAccessToken = resolveCustomerAccessToken(options);
  if (customerAccessToken) {
    buyerIdentity.customerAccessToken = customerAccessToken;
  }
  if (options?.email) {
    buyerIdentity.email = options.email;
  }
  return buyerIdentity;
};

const currencySymbolForCode = (code = "") => {
  const normalized = String(code || "").trim().toUpperCase();
  const symbols = {
    INR: "₹",
    USD: "$",
    CAD: "$",
    AUD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
  };
  return symbols[normalized] || normalized || "$";
};

const formatOrderStatus = (fulfillmentStatus, financialStatus) => {
  const raw = String(fulfillmentStatus || financialStatus || "").trim();
  if (!raw) return "";
  const normalized = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const labels = {
    FULFILLED: "Delivered",
    PARTIALLY_FULFILLED: "Partially fulfilled",
    IN_PROGRESS: "In progress",
    ON_HOLD: "On hold",
    OPEN: "Order placed",
    PENDING_FULFILLMENT: "Pending",
    RESTOCKED: "Restocked",
    SCHEDULED: "Scheduled",
    UNFULFILLED: "Order placed",
    PAID: "Paid",
    AUTHORIZED: "Authorized",
    PENDING: "Pending",
    PARTIALLY_PAID: "Partially paid",
    REFUNDED: "Refunded",
    VOIDED: "Voided",
  };
  return labels[normalized] || raw.toLowerCase().replace(/(^|\s)\w/g, (m) => m.toUpperCase());
};

const formatOrderDate = (value, style = "long") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const options =
    style === "short"
      ? { year: "numeric", month: "short", day: "numeric" }
      : { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

const extractShopifyNumericId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const gidMatch = raw.match(/\/(\d+)(?:\?|$)/);
  if (gidMatch) return gidMatch[1];
  const plainMatch = raw.match(/^#?(\d+)$/);
  if (plainMatch) return plainMatch[1];
  return "";
};

const normalizeOrderIdentity = (value) =>
  String(value || "").trim().toLowerCase().replace(/^order\s+/i, "").replace(/^#/, "");

const sameOrderDay = (a, b) => {
  if (!a || !b) return false;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return false;
  return first.toISOString().slice(0, 10) === second.toISOString().slice(0, 10);
};

const nearlySameMoney = (a, b) => {
  const first = Number(a);
  const second = Number(b);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return false;
  return Math.abs(first - second) < 0.01;
};

const formatAddressLines = (address = {}) => {
  if (!address || typeof address !== "object") return "";
  if (Array.isArray(address.formatted) && address.formatted.length) {
    return address.formatted.filter(Boolean).join("\n");
  }
  return [
    address.name,
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.country,
    address.zip,
    address.phone,
  ]
    .filter(Boolean)
    .join("\n");
};

const getShopifyAdminCredentials = async () => {
  const config = await fetchStoreConfig();
  const shop = config?.shopify_domain || FALLBACK_SHOP;
  const accessToken = config?.access_token || config?.admin_access_token || "";
  const storeId = config?.id ? Number(config.id) : FALLBACK_STORE_ID;
  return { shop, accessToken, storeId, currency: config?.currency || "" };
};

const shopifyAdminRequest = async ({ path, method = "GET", body }) => {
  const { shop, accessToken } = await getShopifyAdminCredentials();
  if (!accessToken) {
    throw new Error("Store Admin API token is unavailable.");
  }

  const response = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = {};
  }

  if (!response.ok) {
    const message =
      json?.errors ||
      json?.error ||
      json?.message ||
      text ||
      `Shopify Admin API HTTP ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return json;
};

const mapAdminOrder = (adminOrder = {}, fallback = {}) => {
  if (!adminOrder || typeof adminOrder !== "object") return fallback;
  const currency = adminOrder.currency || fallback.currencyCode || "";
  const currencySymbol = currency ? currencySymbolForCode(currency) : fallback.currencySymbol || "";
  const paymentGatewayNames = Array.isArray(adminOrder.payment_gateway_names)
    ? adminOrder.payment_gateway_names.filter(Boolean)
    : [];
  const shippingLine = Array.isArray(adminOrder.shipping_lines)
    ? adminOrder.shipping_lines.find(Boolean)
    : null;
  const totalShipping = Array.isArray(adminOrder.shipping_lines)
    ? adminOrder.shipping_lines.reduce((sum, line) => sum + parseFloat(line?.price || 0), 0)
    : fallback.delivery;
  const financialStatus = adminOrder.financial_status || fallback.financialStatus || "";
  const fulfillmentStatus = adminOrder.fulfillment_status || fallback.fulfillmentStatus || "";
  const cancelledAt = adminOrder.cancelled_at || fallback.cancelledAt || "";
  const status = cancelledAt
    ? "Canceled"
    : formatOrderStatus(fulfillmentStatus, financialStatus) || fallback.status || "";

  return {
    ...fallback,
    id: fallback.id || adminOrder.admin_graphql_api_id || (adminOrder.id ? `gid://shopify/Order/${adminOrder.id}` : ""),
    adminOrderId: adminOrder.id ? String(adminOrder.id) : fallback.adminOrderId || "",
    adminGraphqlApiId: adminOrder.admin_graphql_api_id || fallback.adminGraphqlApiId || "",
    name: adminOrder.name || fallback.name || "",
    orderNumber: adminOrder.name || fallback.orderNumber || "",
    orderDate: formatOrderDate(adminOrder.processed_at || adminOrder.created_at) || fallback.orderDate || "",
    placedAt: adminOrder.processed_at || adminOrder.created_at || fallback.placedAt || "",
    placedOn: formatOrderDate(adminOrder.processed_at || adminOrder.created_at, "short") || fallback.placedOn || "",
    status,
    financialStatus,
    fulfillmentStatus,
    cancelledAt,
    cancelReason: adminOrder.cancel_reason || fallback.cancelReason || "",
    statusUrl: adminOrder.order_status_url || fallback.statusUrl || "",
    deliveryMethod: shippingLine?.title || shippingLine?.code || fallback.deliveryMethod || "",
    shippingAddress: adminOrder.shipping_address || fallback.shippingAddress || null,
    billingAddress: adminOrder.billing_address || fallback.billingAddress || null,
    address: formatAddressLines(adminOrder.shipping_address) || fallback.address || "",
    billing: formatAddressLines(adminOrder.billing_address) || fallback.billing || "",
    paymentGatewayNames,
    paymentMethod: paymentGatewayNames.join(", ") || fallback.paymentMethod || "",
    payment: paymentGatewayNames.join(", ") || fallback.payment || "",
    delivery: Number.isFinite(totalShipping) ? totalShipping : parseFloat(adminOrder.total_shipping_price_set?.shop_money?.amount || 0),
    tax: parseFloat(adminOrder.current_total_tax || adminOrder.total_tax || fallback.tax || 0),
    subtotal: parseFloat(adminOrder.current_subtotal_price || adminOrder.subtotal_price || fallback.subtotal || 0),
    total: parseFloat(adminOrder.current_total_price || adminOrder.total_price || fallback.total || 0),
    currencyCode: currency,
    currencySymbol,
    cancellable: !cancelledAt && !["refunded", "voided"].includes(String(financialStatus).toLowerCase()),
    lineItems: Array.isArray(fallback.lineItems) && fallback.lineItems.length
      ? fallback.lineItems
      : (adminOrder.line_items || []).map((line) => ({
          id: line.admin_graphql_api_id || String(line.id || ""),
          variantId: line.variant_id ? `gid://shopify/ProductVariant/${line.variant_id}` : "",
          productId: line.product_id ? `gid://shopify/Product/${line.product_id}` : "",
          title: line.title || line.name || "Product",
          variant: line.variant_title || "",
          quantity: line.quantity || 1,
          priceAmount: parseFloat(line.price || 0),
          priceCurrency: currency,
          price: `${currencySymbol}${parseFloat(line.price || 0).toFixed(2)}`,
        })),
  };
};

const findAdminOrderForCustomerOrder = async (order = {}) => {
  const numericCandidates = [
    order?.adminOrderId,
    order?.admin_order_id,
    order?.orderId,
    order?.order_id,
    order?.id,
    order?.adminGraphqlApiId,
    order?.admin_graphql_api_id,
  ].map(extractShopifyNumericId).filter(Boolean);
  const fields = [
    "id",
    "admin_graphql_api_id",
    "name",
    "order_number",
    "processed_at",
    "created_at",
    "cancelled_at",
    "cancel_reason",
    "financial_status",
    "fulfillment_status",
    "currency",
    "current_total_price",
    "total_price",
    "current_subtotal_price",
    "subtotal_price",
    "current_total_tax",
    "total_tax",
    "shipping_address",
    "billing_address",
    "payment_gateway_names",
    "shipping_lines",
    "line_items",
    "order_status_url",
  ].join(",");

  for (const numericId of [...new Set(numericCandidates)]) {
    try {
      const json = await shopifyAdminRequest({
        path: `/orders/${numericId}.json?fields=${encodeURIComponent(fields)}`,
      });
      if (json?.order) return json.order;
    } catch (_) {}
  }

  const rawNameCandidates = [
    order?.name,
    order?.orderNumber,
    order?.order_number,
    order?.number,
  ].map((value) => String(value || "").trim()).filter(Boolean);
  const nameCandidates = [...new Set(rawNameCandidates.flatMap((value) => {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    return [value, normalized];
  }))];

  for (const name of nameCandidates) {
    try {
      const json = await shopifyAdminRequest({
        path: `/orders.json?status=any&limit=1&name=${encodeURIComponent(name)}&fields=${encodeURIComponent(fields)}`,
      });
      if (Array.isArray(json?.orders) && json.orders[0]) return json.orders[0];
    } catch (_) {}
  }

  const orderNumber = rawNameCandidates
    .map((value) => String(value || "").match(/(\d+)/)?.[1] || "")
    .find(Boolean);
  if (orderNumber) {
    try {
      const json = await shopifyAdminRequest({
        path: `/orders.json?status=any&limit=5&order_number=${encodeURIComponent(orderNumber)}&fields=${encodeURIComponent(fields)}`,
      });
      if (Array.isArray(json?.orders) && json.orders[0]) return json.orders[0];
    } catch (_) {}
  }

  try {
    const json = await shopifyAdminRequest({
      path: `/orders.json?status=any&limit=50&fields=${encodeURIComponent(fields)}`,
    });
    const orders = Array.isArray(json?.orders) ? json.orders : [];
    const orderIdentities = rawNameCandidates.map(normalizeOrderIdentity).filter(Boolean);
    const statusUrl = String(order?.statusUrl || order?.orderStatusUrl || "").trim();
    const matched = orders.find((adminOrder) => {
      const adminIdentities = [
        adminOrder.name,
        adminOrder.order_number,
        adminOrder.id,
        adminOrder.admin_graphql_api_id,
      ].map(normalizeOrderIdentity).filter(Boolean);
      if (orderIdentities.some((value) => adminIdentities.includes(value))) return true;
      if (statusUrl && adminOrder.order_status_url === statusUrl) return true;
      return (
        nearlySameMoney(order?.total, adminOrder.current_total_price || adminOrder.total_price) &&
        sameOrderDay(order?.placedAt || order?.orderDate || order?.placedOn, adminOrder.processed_at || adminOrder.created_at)
      );
    });
    if (matched) return matched;
  } catch (_) {}

  return null;
};

const findMatchingCustomerOrder = (target = {}, orders = []) => {
  if (!Array.isArray(orders) || !orders.length) return null;
  const targetIdentities = [
    target?.adminOrderId,
    target?.id,
    target?.name,
    target?.orderNumber,
    target?.statusUrl,
  ].map(normalizeOrderIdentity).filter(Boolean);

  const matched = orders.find((candidate) => {
    const candidateIdentities = [
      candidate?.adminOrderId,
      candidate?.id,
      candidate?.name,
      candidate?.orderNumber,
      candidate?.statusUrl,
    ].map(normalizeOrderIdentity).filter(Boolean);
    if (targetIdentities.some((value) => candidateIdentities.includes(value))) return true;
    return (
      nearlySameMoney(target?.total, candidate?.total) &&
      sameOrderDay(target?.placedAt || target?.orderDate || target?.placedOn, candidate?.placedAt || candidate?.orderDate || candidate?.placedOn)
    );
  });

  if (matched) return matched;
  if (target?.needsStoreRefresh && orders[0]) return orders[0];
  if (!targetIdentities.length && orders.length === 1) return orders[0];
  return null;
};

const findAdminOrderWithCustomerFallback = async ({ order, customerAccessToken } = {}) => {
  let lookupOrder = order || {};
  let adminOrder = await findAdminOrderForCustomerOrder(lookupOrder);
  if (adminOrder || !customerAccessToken) {
    return { adminOrder, lookupOrder };
  }

  const { orders } = await fetchCustomerOrders({ customerAccessToken, first: 10 });
  const customerOrder = findMatchingCustomerOrder(lookupOrder, orders);
  if (!customerOrder) {
    return { adminOrder: null, lookupOrder };
  }

  lookupOrder = { ...lookupOrder, ...customerOrder };
  adminOrder = await findAdminOrderForCustomerOrder(lookupOrder);
  return { adminOrder, lookupOrder };
};

export async function fetchShopifyOrderDetails({ order, customerAccessToken } = {}) {
  if (!order) return null;
  const { adminOrder, lookupOrder } = await findAdminOrderWithCustomerFallback({
    order,
    customerAccessToken,
  });
  return adminOrder ? mapAdminOrder(adminOrder, lookupOrder) : lookupOrder;
}

export async function cancelShopifyOrder({ order, reason = "customer", notifyCustomer = true, customerAccessToken } = {}) {
  if (!order) {
    throw new Error("Order is required.");
  }
  const { adminOrder, lookupOrder } = await findAdminOrderWithCustomerFallback({
    order,
    customerAccessToken,
  });
  const adminOrderId = adminOrder?.id || extractShopifyNumericId(lookupOrder?.adminOrderId || lookupOrder?.id);
  if (!adminOrderId) {
    throw new Error("Unable to sync this order from Shopify. Please reopen order history and try again.");
  }
  if (adminOrder?.cancelled_at) {
    return {
      success: true,
      order: mapAdminOrder(adminOrder, lookupOrder),
      alreadyCanceled: true,
    };
  }

  const json = await shopifyAdminRequest({
    path: `/orders/${adminOrderId}/cancel.json`,
    method: "POST",
    body: {
      reason,
      email: notifyCustomer,
    },
  });

  const canceledOrder = json?.order || {
    ...adminOrder,
    cancelled_at: new Date().toISOString(),
    cancel_reason: reason,
  };

  return {
    success: true,
    order: mapAdminOrder(canceledOrder, lookupOrder),
  };
}

export async function createShopifyCustomerAccessToken({ email, password, options = {} } = {}) {
  if (!email || !password) return null;

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

  const mutation = `
    mutation CustomerAccessTokenCreate($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        customerUserErrors {
          field
          message
          code
        }
      }
    }
  `;

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query: mutation,
      variables: {
        input: {
          email,
          password,
        },
      },
    });

    if (json?.errors?.length) {
      console.warn("⚠️ Customer token GraphQL errors:", JSON.stringify(json.errors));
      return null;
    }

    const payload = json?.data?.customerAccessTokenCreate;
    const userErrors = payload?.customerUserErrors || [];
    if (userErrors.length) {
      console.warn("⚠️ Customer token user errors:", JSON.stringify(userErrors));
      return null;
    }

    const accessToken = payload?.customerAccessToken?.accessToken || "";
    if (!accessToken) return null;

    return {
      accessToken,
      expiresAt: payload?.customerAccessToken?.expiresAt || null,
    };
  } catch (error) {
    console.warn("⚠️ createShopifyCustomerAccessToken failed:", error?.message || error);
    return null;
  }
}

export async function createShopifyCheckout({ variantId, quantity = 1, options = {} }) {
  if (!variantId) {
    throw new Error("Missing variant ID for checkout.");
  }

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  const merchandiseId = ensureVariantGid(variantId);
  const buyerIdentity = buildBuyerIdentity(options);

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
        buyerIdentity,
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
  const buyerIdentity = buildBuyerIdentity(options);

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
            buyerIdentity,
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
            vendor
            productType
            tags
            options {
              name
              values
            }
            featuredImage { url }
            images(first: 1) { edges { node { url } } }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            variants(first: 1) {
              edges {
                node {
                  id
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }
  `;

  const escapeSearchTerm = (value) =>
    String(value || "")
      .trim()
      .replace(/[\\"]/g, "")
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ");

  const safeTerm = escapeSearchTerm(term);
  const tokens = safeTerm
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .slice(0, 4);

  const queryParts = [];
  if (safeTerm) {
    queryParts.push(
      `title:*${safeTerm}*`,
      `handle:*${safeTerm.replace(/\s+/g, "-")}*`,
      `vendor:*${safeTerm}*`,
      `product_type:*${safeTerm}*`,
      `tag:*${safeTerm}*`
    );
  }
  tokens.forEach((token) => {
    queryParts.push(`title:*${token}*`, `handle:*${token}*`, `tag:*${token}*`);
  });

  const searchQuery = queryParts.length ? queryParts.join(" OR ") : safeTerm;

  const mapProductEdges = (edges = []) =>
    edges.map(({ node }) => {
      const variant = node?.variants?.edges?.[0]?.node;
      const priceNode = node?.priceRangeV2?.minVariantPrice;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        vendor: node?.vendor || "",
        productType: node?.productType || "",
        tags: node?.tags || [],
        options: node?.options || [],
        availableForSale: true,
        variantId: variant?.id || null,
        imageUrl: node?.featuredImage?.url || node?.images?.edges?.[0]?.node?.url || null,
        priceAmount: priceNode?.amount || null,
        priceCurrency: priceNode?.currencyCode || null,
        compareAtPrice: variant?.compareAtPrice || null,
      };
    });

  try {
    const json = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query,
      variables: { first: limit, query: searchQuery },
    });

    if (json.errors && searchQuery !== safeTerm) {
      const fallbackJson = await directStorefrontGraphQL({
        shop,
        token,
        storeId,
        query,
        variables: { first: limit, query: safeTerm },
      });
      if (fallbackJson.errors) {
        console.error("Shopify GraphQL search fallback errors:", fallbackJson.errors);
        return [];
      }
      return mapProductEdges(fallbackJson?.data?.products?.edges || []);
    }

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return [];
    }

    const edges = json?.data?.products?.edges || [];
    if (edges.length > 0 || searchQuery === safeTerm) {
      return mapProductEdges(edges);
    }

    const fallbackJson = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query,
      variables: { first: limit, query: safeTerm },
    });

    if (fallbackJson.errors) {
      console.error("âŒ Shopify GraphQL Search Fallback Errors â†’", fallbackJson.errors);
      return [];
    }

    return mapProductEdges(fallbackJson?.data?.products?.edges || []);
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
  const safeFirst = Math.max(1, Number(first) || 20);
  const cacheKey = buildCacheKey("collectionProducts", {
    handle: String(handle),
    first: safeFirst,
    after: after || null,
    shop: options.shop || "",
    storeId: options.storeId || "",
  });

  return withRequestCache(cacheKey, async () => {

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;

  const query = `
    query CollectionProducts($query: String!, $firstCollections: Int!, $first: Int!, $after: String) {
      collections(first: $firstCollections, query: $query) {
        edges {
          node {
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
                  vendor
                  productType
                  tags
                  options {
                    name
                    values
                  }
                  featuredImage { url }
                  images(first: 1) { edges { node { url } } }
                  priceRangeV2 { minVariantPrice { amount currencyCode } }
                  variants(first: 1) {
                    edges {
                      node {
                        id
                        compareAtPrice
                      }
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
      storeId,
      query,
      variables: {
        query: `handle:${handle}`,
        firstCollections: 1,
        first: safeFirst,
        after,
      },
    });

    if (json.errors) {
      console.error("❌ Shopify GraphQL Errors →", json.errors);
      return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
    }

    const productsNode = json?.data?.collections?.edges?.[0]?.node?.products;
    const edges = productsNode?.edges || [];
    const pageInfo = productsNode?.pageInfo || {
      hasNextPage: false,
      endCursor: null,
    };

    const products = edges.map(({ node }) => {
      const priceNode = node?.priceRangeV2?.minVariantPrice;
      const variant = node?.variants?.edges?.[0]?.node;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        vendor: node?.vendor || "",
        productType: node?.productType || "",
        tags: node?.tags || [],
        options: node?.options || [],
        availableForSale: true,
        variantId: variant?.id || null,
        imageUrl:
          node?.featuredImage?.url ||
          node?.images?.edges?.[0]?.node?.url ||
          null,
        priceAmount: priceNode?.amount || null,
        priceCurrency: priceNode?.currencyCode || null,
        compareAtPrice: variant?.compareAtPrice || null,
      };
    });

    return { products, pageInfo };
  } catch (error) {
    console.error("❌ Shopify Collection Products Fetch Error:", error);
    return { products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }
  });
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
              statusUrl
              totalPriceV2 { amount currencyCode }
              subtotalPriceV2 { amount currencyCode }
              totalShippingPriceV2 { amount currencyCode }
              totalTaxV2 { amount currencyCode }
              shippingAddress {
                name
                address1
                address2
                city
                province
                country
                zip
                phone
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
                    product {
                      handle
                      title
                      vendor
                    }
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
      const addressText = formatAddressLines(addr);
      const totalMoney = node.totalPriceV2 || {};
      const subtotalMoney = node.subtotalPriceV2 || totalMoney;
      const shippingMoney = node.totalShippingPriceV2 || {};
      const taxMoney = node.totalTaxV2 || {};
      const currency = totalMoney?.currencyCode || subtotalMoney?.currencyCode || creds.currency || "";
      const currencySymbol = currencySymbolForCode(currency);
      return {
        id:             node.id,
        name:           node.name || (node.orderNumber ? `#${node.orderNumber}` : ""),
        orderNumber:    node.name || (node.orderNumber ? `#${node.orderNumber}` : ""),
        orderDate:      formatOrderDate(node.processedAt),
        placedAt:       node.processedAt || "",
        placedOn:       formatOrderDate(node.processedAt, "short"),
        status:         formatOrderStatus(node.fulfillmentStatus, node.financialStatus),
        fulfillmentStatus: node.fulfillmentStatus || "",
        financialStatus: node.financialStatus || "",
        statusUrl:      node.statusUrl || "",
        deliveryMethod: "",
        shippingAddress: addr || null,
        address:        addressText,
        arrival:        "",
        billingAddress: null,
        billing:        "",
        paymentMethod:  "",
        paymentGatewayNames: [],
        payment:        "",
        delivery:       parseFloat(shippingMoney?.amount || 0),
        tax:            parseFloat(taxMoney?.amount || 0),
        subtotal:       parseFloat(subtotalMoney?.amount || totalMoney?.amount || 0),
        total:          parseFloat(totalMoney?.amount || 0),
        currencyCode:   currency,
        currencySymbol,
        cancellable:    !["REFUNDED", "VOIDED"].includes(String(node.financialStatus || "").toUpperCase()),
        lineItems: (node.lineItems?.edges || []).map(({ node: li }) => ({
          id:            li.variant?.id || li.title,
          variantId:     li.variant?.id || "",
          handle:        li.variant?.product?.handle || "",
          title:         li.title || li.variant?.product?.title || "Product",
          vendor:        li.variant?.product?.vendor || "",
          variant:       li.variant?.title || "",
          imageUrl:      li.variant?.image?.url || null,
          image:         li.variant?.image?.url || "",
          priceAmount:   parseFloat(li.variant?.price?.amount || 0),
          priceCurrency: li.variant?.price?.currencyCode || currency,
          price:         li.variant?.price
            ? `${currencySymbolForCode(li.variant.price.currencyCode || currency)}${parseFloat(li.variant.price.amount || 0).toFixed(2)}`
            : "",
          quantity:      li.quantity,
        })),
      };
    });

    return { orders };
  } catch (err) {
    console.error("❌ fetchCustomerOrders error:", err);
    return { orders: [] };
  }
}

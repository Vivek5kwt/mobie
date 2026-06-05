import { fetchStoreConfig, getStoreConfigSync } from './storeService';
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
} from '../utils/money';
import {
  cartDiscountFingerprint,
  normalizeDiscountCode,
  normalizeDiscountCodes,
} from '../utils/cartDiscounts';

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
const PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE = "Password reset is temporarily unavailable. Please try again later.";
const _requestCache = new Map();
const _inflightRequests = new Map();
const _runtimeStorefrontTokenCache = new Map();

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

const isStorefrontAuthFailure = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("storefront http error 401") ||
    message.includes("storefront http error 403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("access denied") ||
    message.includes("invalid token") ||
    message.includes("no storefront token")
  );
};

const withRequestCache = async (key, producer, { cacheEmpty = false } = {}) => {
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
      if (!isEmpty || cacheEmpty) {
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

const variantNodesFromEdges = (edges = []) =>
  (edges || []).map((edge) => edge?.node).filter(Boolean);

const isAvailableVariant = (variant = {}) =>
  variant?.availableForSale !== false &&
  String(variant?.availableForSale).trim().toLowerCase() !== "false";

const pickAvailableVariant = (variants = []) =>
  variants.find(isAvailableVariant) || variants[0] || null;

const productAvailableFromVariants = (variants = []) =>
  variants.length ? variants.some(isAvailableVariant) : true;

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
          variants(first: 10) {
            edges {
              node {
                id
                title
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

export const QUERY_TRENDING_SEARCH_TERMS = `
  query TrendingSearchTerms($productsFirst: Int!, $collectionsFirst: Int!) {
    products(first: $productsFirst, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          tags
        }
      }
    }
    collections(first: $collectionsFirst) {
      edges {
        node {
          id
          title
          handle
        }
      }
    }
  }
`;

// ─── Base GraphQL call ─────────────────────────────────────────────────────
// Routes through the backend proxy so the server supplies valid Shopify
// credentials. Falls back to a direct Storefront API call if the proxy
// is unreachable (offline / dev environment).
export async function directStorefrontGraphQL({ shop, token, storeId, query, variables, adminToken, accessToken }) {
  const resolvedStoreId = storeId || FALLBACK_STORE_ID;
  const resolvedAdminToken = adminToken || accessToken || "";

  // ── 1. Try backend proxy (preferred) ──────────────────────────────────────
  try {
    console.log(`🔌 Proxy request: storeId=${resolvedStoreId} shop=${shop}`);
    const proxyRes = await fetch(PROXY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: resolvedStoreId,
        shop,
        query,
        variables,
        token,
        storefrontAccessToken: token,
        accessToken: resolvedAdminToken,
        adminAccessToken: resolvedAdminToken,
      }),
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
    console.warn("Direct Storefront HTTP Error:", res.status, json);
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
      const variants = variantNodesFromEdges(node?.variants?.edges);
      const variant = pickAvailableVariant(variants);
      const price = node?.priceRangeV2?.minVariantPrice;
      return {
        id: node?.id,
        name: node?.title,
        title: node?.title,
        handle: node?.handle,
        availableForSale: productAvailableFromVariants(variants),
        variants,
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
// FETCH TRENDING SEARCHES
// ----------------------
const TRENDING_TERM_STOP_WORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "from",
  "your",
  "new",
  "sale",
  "product",
  "products",
  "collection",
  "collections",
]);

const cleanTrendingTerm = (value) => {
  const text = String(value || "")
    .replace(/[_|/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || text.length < 2) return "";
  if (/^\d+(\.\d+)?$/.test(text)) return "";
  return text;
};

const addTrendingTerm = (bucket, value, query, score, index) => {
  const text = cleanTrendingTerm(value);
  if (!text) return;
  const lower = text.toLowerCase();
  if (TRENDING_TERM_STOP_WORDS.has(lower)) return;
  const key = lower.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  if (!key) return;
  const existing = bucket.get(key);
  if (existing) {
    existing.score += score;
    existing.count += 1;
    return;
  }
  bucket.set(key, {
    text,
    query: cleanTrendingTerm(query || text) || text,
    score,
    count: 1,
    index,
  });
};

const titleToTrendingPhrase = (title) => {
  const words = String(title || "")
    .replace(/[^a-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)
    .filter((word) => word.length > 2)
    .filter((word) => !TRENDING_TERM_STOP_WORDS.has(word.toLowerCase()))
    .filter((word) => !/^\d+$/.test(word));
  return words.slice(0, 3).join(" ");
};

export async function fetchShopifyTrendingSearches(limit = 6, options = {}) {
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  const productsFirst = Math.max(12, safeLimit * 4);
  const collectionsFirst = Math.max(6, safeLimit * 2);
  const cacheKey = buildCacheKey("trendingSearches", {
    limit: safeLimit,
    shop: options.shop || "",
    storeId: options.storeId || "",
  });

  return withRequestCache(
    cacheKey,
    async () => {
      const creds = await getShopifyCredentials();
      const shop = options.shop || creds.shop;
      const token = options.token || creds.token;
      const storeId = options.storeId || creds.storeId;

      try {
        const json = await directStorefrontGraphQL({
          shop,
          token,
          storeId,
          query: QUERY_TRENDING_SEARCH_TERMS,
          variables: {
            productsFirst,
            collectionsFirst,
          },
        });

        if (json.errors && !json?.data) {
          console.error("Shopify trending-search GraphQL errors:", json.errors);
          return [];
        }

        const productEdges = json?.data?.products?.edges || [];
        const collectionEdges = json?.data?.collections?.edges || [];
        const bucket = new Map();
        let order = 0;

        collectionEdges.forEach(({ node }) => {
          addTrendingTerm(bucket, node?.title, node?.title, 12, order++);
        });

        productEdges.forEach(({ node }) => {
          const productIndex = order++;
          addTrendingTerm(bucket, node?.productType, node?.productType, 10, productIndex);
          (node?.tags || []).slice(0, 6).forEach((tag) => {
            addTrendingTerm(bucket, tag, tag, 8, productIndex);
          });
          addTrendingTerm(bucket, node?.vendor, node?.vendor, 4, productIndex);
          addTrendingTerm(bucket, titleToTrendingPhrase(node?.title), node?.title, 3, productIndex);
        });

        return [...bucket.values()]
          .sort((a, b) => {
            const scoreDiff = b.score - a.score;
            if (scoreDiff !== 0) return scoreDiff;
            const countDiff = b.count - a.count;
            if (countDiff !== 0) return countDiff;
            return a.index - b.index;
          })
          .slice(0, safeLimit)
          .map(({ text, query }) => ({ text, query }));
      } catch (error) {
        console.error("fetchShopifyTrendingSearches error:", error);
        return [];
      }
    },
    { cacheEmpty: true }
  );
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
            variants(first: 10) {
              edges {
                node {
                  id
                  title
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
      const variants = variantNodesFromEdges(edge?.node?.variants?.edges);
      const variant = pickAvailableVariant(variants);
      const price = edge?.node?.priceRangeV2?.minVariantPrice;

      return {
        id: edge?.node?.id,
        title: edge?.node?.title,
        handle: edge?.node?.handle,
        vendor: edge?.node?.vendor || "",
        productType: edge?.node?.productType || "",
        tags: edge?.node?.tags || [],
        options: edge?.node?.options || [],
        availableForSale: productAvailableFromVariants(variants),
        variants,
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
        variants(first: 20) {
          edges {
            node {
              id
              title
              availableForSale
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
        variants(first: 20) {
          edges {
            node {
              id
              title
              availableForSale
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
    const variants = variantNodesFromEdges(product?.variants?.edges);
    const variant = pickAvailableVariant(variants);
    const variantId = variant?.id;
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
      variants,
      availableForSale: productAvailableFromVariants(variants),
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

const buildCheckoutQueryString = ({ discountCodes = [], email = "" } = {}) => {
  const params = [];
  const normalizedEmail = String(email || "").trim();
  if (discountCodes.length) {
    params.push(`discount=${encodeURIComponent(discountCodes.join(","))}`);
  }
  if (normalizedEmail) {
    params.push(`checkout%5Bemail%5D=${encodeURIComponent(normalizedEmail)}`);
  }
  return params.length ? `?${params.join("&")}` : "";
};

const moneyAmount = (money = {}) => {
  const amount = parseFloat(money?.amount ?? 0);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currencyCode: money?.currencyCode || "",
  };
};

const buildCheckoutLines = (items = []) =>
  (items || [])
    .map((item) => ({
      merchandiseId: ensureVariantGid(item?.variantId || item?.id),
      quantity: Math.max(1, Number(item?.quantity) || 1),
    }))
    .filter((line) => line.merchandiseId);

const buildDirectCartLines = (items = []) =>
  (items || [])
    .map((item) => {
      const raw = String(item?.variantId || item?.id || "");
      const match = raw.match(/ProductVariant\/(\d+)/) || (!raw.includes("gid://") && raw.match(/^(\d+)$/));
      if (!match) return null;
      return `${match[1]}:${Math.max(1, Number(item?.quantity) || 1)}`;
    })
    .filter(Boolean);

const CHECKOUT_LOG = "[ShopifyCheckout]";

const checkoutItemSummary = (item = {}, index = 0) => ({
  index,
  id: item?.id ? String(item.id) : "",
  variantId: item?.variantId ? String(item.variantId) : "",
  productId: item?.productId ? String(item.productId) : "",
  handle: item?.handle || "",
  title: item?.title || item?.name || "",
  quantity: Math.max(1, Number(item?.quantity) || 1),
});

const checkoutLineSummary = (lines = []) =>
  (lines || []).map((line, index) => ({
    index,
    merchandiseId: line?.merchandiseId || "",
    quantity: line?.quantity || 1,
  }));

const productGidFromValue = (value) => {
  const raw = String(value || "").trim();
  return raw.startsWith("gid://") && raw.includes("Product/") && !raw.includes("ProductVariant/")
    ? raw
    : "";
};

const pickVariantFromProductNode = (productNode = {}) =>
  pickAvailableVariant(variantNodesFromEdges(productNode?.variants?.edges));

const resolveCheckoutVariantFromProductId = async ({ productId, shop, token, storeId }) => {
  if (!productId) return "";
  const query = `
    query ResolveCheckoutVariantByProductId($id: ID!) {
      node(id: $id) {
        ... on Product {
          variants(first: 20) {
            edges {
              node {
                id
                availableForSale
              }
            }
          }
        }
        ... on ProductVariant {
          id
          availableForSale
        }
      }
    }
  `;

  const json = await directStorefrontGraphQL({
    shop,
    token,
    storeId,
    query,
    variables: { id: productId },
  });

  if (json?.errors?.length) {
    console.warn(`${CHECKOUT_LOG} variant resolve by product id GraphQL errors`, JSON.stringify(json.errors));
    return "";
  }

  const node = json?.data?.node;
  if (node?.id && String(node.id).includes("ProductVariant/")) {
    return node.id;
  }
  return pickVariantFromProductNode(node)?.id || "";
};

const resolveCheckoutVariantFromHandle = async ({ handle, shop, token, storeId }) => {
  const safeHandle = String(handle || "").trim();
  if (!safeHandle) return "";
  const query = `
    query ResolveCheckoutVariantByHandle($handle: String!) {
      product(handle: $handle) {
        variants(first: 20) {
          edges {
            node {
              id
              availableForSale
            }
          }
        }
      }
    }
  `;

  const json = await directStorefrontGraphQL({
    shop,
    token,
    storeId,
    query,
    variables: { handle: safeHandle },
  });

  if (json?.errors?.length) {
    console.warn(`${CHECKOUT_LOG} variant resolve by handle GraphQL errors`, JSON.stringify(json.errors));
    return "";
  }

  return pickVariantFromProductNode(json?.data?.product)?.id || "";
};

const resolveCheckoutVariantForItem = async (item = {}, context = {}) => {
  const directVariant = [
    item?.variantId,
    item?.merchandiseId,
    item?.id,
  ].map(ensureVariantGid).find(Boolean);
  if (directVariant) {
    return {
      merchandiseId: directVariant,
      source: "direct",
    };
  }

  const productId = [
    item?.productId,
    item?.product_id,
    item?.variantId,
    item?.id,
  ].map(productGidFromValue).find(Boolean);

  try {
    const resolvedById = productId
      ? await resolveCheckoutVariantFromProductId({ productId, ...context })
      : "";
    if (resolvedById) {
      return {
        merchandiseId: resolvedById,
        source: "product-id",
      };
    }

    const resolvedByHandle = await resolveCheckoutVariantFromHandle({
      handle: item?.handle,
      ...context,
    });
    if (resolvedByHandle) {
      return {
        merchandiseId: resolvedByHandle,
        source: "handle",
      };
    }
  } catch (error) {
    console.warn(`${CHECKOUT_LOG} variant resolve failed`, {
      item: checkoutItemSummary(item),
      message: error?.message || String(error),
    });
  }

  return {
    merchandiseId: "",
    source: "unresolved",
  };
};

const buildResolvedCheckoutLines = async (items = [], context = {}) => {
  const results = await Promise.all(
    (items || []).map(async (item, index) => {
      const resolved = await resolveCheckoutVariantForItem(item, context);
      const quantity = Math.max(1, Number(item?.quantity) || 1);
      return {
        index,
        item,
        quantity,
        ...resolved,
      };
    })
  );

  return {
    lines: results
      .filter((entry) => entry.merchandiseId)
      .map((entry) => ({
        merchandiseId: entry.merchandiseId,
        quantity: entry.quantity,
      })),
    resolved: results.filter((entry) => entry.merchandiseId && entry.source !== "direct"),
    invalid: results.filter((entry) => !entry.merchandiseId),
  };
};

const buildDirectCartLinesFromCheckoutLines = (lines = []) =>
  (lines || [])
    .map((line) => {
      const match = String(line?.merchandiseId || "").match(/ProductVariant\/(\d+)/);
      if (!match) return null;
      return `${match[1]}:${Math.max(1, Number(line?.quantity) || 1)}`;
    })
    .filter(Boolean);

const sumDiscountAllocations = (cart, requestedCodes = []) => {
  const requested = new Set(requestedCodes);
  const amounts = new Map();
  const currencies = new Map();
  const addAllocation = (allocation = {}) => {
    const code = normalizeDiscountCode(
      allocation?.code ||
      allocation?.discountApplication?.code ||
      allocation?.sourceDiscountApplication?.code
    );
    if (!code || !requested.has(code)) return;
    const money = moneyAmount(allocation?.discountedAmount || allocation?.allocatedAmount);
    if (money.amount <= 0) return;
    amounts.set(code, (amounts.get(code) || 0) + money.amount);
    if (money.currencyCode) currencies.set(code, money.currencyCode);
  };

  (cart?.discountAllocations || []).forEach(addAllocation);
  (cart?.lines?.edges || []).forEach((edge) => {
    (edge?.node?.discountAllocations || []).forEach(addAllocation);
  });

  return { amounts, currencies };
};

const buildDiscountPreviewResult = ({ cart, requestedCodes, cartFingerprint }) => {
  const codes = normalizeDiscountCodes(requestedCodes);
  const returnedCodes = Array.isArray(cart?.discountCodes) ? cart.discountCodes : [];
  const { amounts, currencies } = sumDiscountAllocations(cart, codes);
  const subtotal = moneyAmount(cart?.cost?.subtotalAmount);
  const total = moneyAmount(cart?.cost?.totalAmount);
  const costDelta = Math.max(0, subtotal.amount - total.amount);

  const records = codes.map((code) => {
    const returned = returnedCodes.find(
      (entry) => normalizeDiscountCode(entry?.code) === code
    );
    const applicable = returned?.applicable === true;
    return {
      code,
      applicable,
      amount: applicable ? Math.max(0, amounts.get(code) || 0) : 0,
      currencyCode: currencies.get(code) || subtotal.currencyCode || total.currencyCode || "",
      cartFingerprint,
      message: applicable ? "" : "Discount code is not valid for this cart.",
      checkedAt: Date.now(),
    };
  });

  const applicableRecords = records.filter((record) => record.applicable);
  const allocatedTotal = applicableRecords.reduce((sum, record) => sum + record.amount, 0);
  if (costDelta > allocatedTotal && applicableRecords.length === 1) {
    applicableRecords[0].amount = costDelta;
    applicableRecords[0].currencyCode =
      applicableRecords[0].currencyCode || subtotal.currencyCode || total.currencyCode || "";
  }

  return {
    discounts: records,
    totalDiscountAmount: records.reduce(
      (sum, record) => sum + (record.applicable ? Math.max(0, record.amount) : 0),
      0
    ),
    subtotalAmount: subtotal.amount,
    totalAmount: total.amount,
    currencyCode: subtotal.currencyCode || total.currencyCode || "",
    checkoutUrl: cart?.checkoutUrl || "",
    cartFingerprint,
  };
};

const cartSubtotalAmount = (items = []) =>
  (items || []).reduce((sum, item) => {
    const price = parseFloat(item?.price ?? item?.priceAmount ?? 0);
    const quantity = Math.max(1, Number(item?.quantity ?? item?.qty) || 1);
    return sum + (Number.isFinite(price) ? price : 0) * quantity;
  }, 0);

const cartQuantity = (items = []) =>
  (items || []).reduce((sum, item) => sum + Math.max(1, Number(item?.quantity ?? item?.qty) || 1), 0);

const extractShopifyGid = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("gid://shopify/")) return raw;
  const variantMatch = raw.match(/ProductVariant\/(\d+)/);
  if (variantMatch) return `gid://shopify/ProductVariant/${variantMatch[1]}`;
  const productMatch = raw.match(/Product\/(\d+)/);
  if (productMatch) return `gid://shopify/Product/${productMatch[1]}`;
  return "";
};

const discountStatusIsActive = (discount = {}) => {
  const status = String(discount?.status || "").toUpperCase();
  if (status && status !== "ACTIVE") return false;
  const now = Date.now();
  const starts = discount?.startsAt ? Date.parse(discount.startsAt) : null;
  const ends = discount?.endsAt ? Date.parse(discount.endsAt) : null;
  if (Number.isFinite(starts) && starts > now) return false;
  if (Number.isFinite(ends) && ends < now) return false;
  const usageLimit = Number(discount?.usageLimit || 0);
  const usageCount = Number(discount?.asyncUsageCount || 0);
  if (usageLimit > 0 && usageCount >= usageLimit) return false;
  return true;
};

const eligibleDiscountLines = (items = [], discountItems = {}) => {
  const type = discountItems?.__typename || "";
  if (!type || type === "AllDiscountItems" || discountItems?.allItems === true) {
    return items;
  }

  const productIds = new Set((discountItems?.products?.nodes || []).map((node) => node?.id).filter(Boolean));
  const variantIds = new Set((discountItems?.productVariants?.nodes || []).map((node) => node?.id).filter(Boolean));

  if (type === "DiscountProducts" && (productIds.size || variantIds.size)) {
    const matched = (items || []).filter((item) => {
      const variantId = extractShopifyGid(item?.variantId || item?.id);
      const productId = extractShopifyGid(item?.productId || item?.productGid || item?.adminGraphqlApiId);
      return (variantId && variantIds.has(variantId)) || (productId && productIds.has(productId));
    });
    return matched.length ? matched : items;
  }

  return items;
};

const calculateDiscountAmountFromAdmin = (discount = {}, items = []) => {
  const subtotal = cartSubtotalAmount(items);
  const totalQuantity = cartQuantity(items);
  const minimum = discount?.minimumRequirement;

  if (!discountStatusIsActive(discount)) {
    return { applicable: false, amount: 0, message: "Discount code is not active." };
  }

  if (minimum?.__typename === "DiscountMinimumSubtotal") {
    const min = parseFloat(minimum?.greaterThanOrEqualToSubtotal?.amount ?? 0);
    if (Number.isFinite(min) && subtotal < min) {
      return {
        applicable: false,
        amount: 0,
        message: `Minimum purchase amount is ${formatSharedMoney(min, minimum?.greaterThanOrEqualToSubtotal?.currencyCode || "")}.`,
      };
    }
  }

  if (minimum?.__typename === "DiscountMinimumQuantity") {
    const minQty = Number(minimum?.greaterThanOrEqualToQuantity || 0);
    if (minQty > 0 && totalQuantity < minQty) {
      return {
        applicable: false,
        amount: 0,
        message: `Minimum quantity is ${minQty}.`,
      };
    }
  }

  if (discount?.__typename === "DiscountCodeFreeShipping") {
    return {
      applicable: true,
      amount: 0,
      currencyCode: discount?.maximumShippingPrice?.currencyCode || "",
      type: "SHIPPING",
      message: "Free shipping discount will be applied at checkout.",
    };
  }

  if (discount?.__typename !== "DiscountCodeBasic") {
    return {
      applicable: true,
      amount: 0,
      currencyCode: "",
      type: discount?.__typename || "DISCOUNT",
      message: "Discount will be applied at checkout.",
    };
  }

  const lines = eligibleDiscountLines(items, discount?.customerGets?.items);
  const eligibleSubtotal = cartSubtotalAmount(lines);
  const eligibleQuantity = cartQuantity(lines);
  const value = discount?.customerGets?.value || {};
  const valueType = value?.__typename || "";

  if (eligibleSubtotal <= 0) {
    return { applicable: false, amount: 0, message: "Discount code is not valid for these products." };
  }

  if (valueType === "DiscountPercentage") {
    const rawPercent = parseFloat(value?.percentage ?? 0);
    const multiplier = rawPercent > 1 ? rawPercent / 100 : rawPercent;
    return {
      applicable: true,
      amount: Math.min(eligibleSubtotal, eligibleSubtotal * Math.max(0, multiplier)),
      currencyCode: "",
      type: "PERCENTAGE",
    };
  }

  if (valueType === "DiscountAmount") {
    const money = moneyAmount(value?.amount);
    const amount = value?.appliesOnEachItem === true
      ? money.amount * eligibleQuantity
      : money.amount;
    return {
      applicable: true,
      amount: Math.min(eligibleSubtotal, Math.max(0, amount)),
      currencyCode: money.currencyCode,
      type: "FIXED",
    };
  }

  return {
    applicable: true,
    amount: 0,
    currencyCode: "",
    type: valueType || "DISCOUNT",
    message: "Discount will be applied at checkout.",
  };
};

async function validateShopifyAdminDiscounts({ items = [], discountCodes = [], cartFingerprint = "" } = {}) {
  const codes = normalizeDiscountCodes(discountCodes);
  const query = `
    query CodeDiscount($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic {
            title
            status
            startsAt
            endsAt
            summary
            usageLimit
            asyncUsageCount
            codes(first: 1) { nodes { code } }
            minimumRequirement {
              __typename
              ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
            customerGets {
              items {
                __typename
                ... on AllDiscountItems { allItems }
                ... on DiscountProducts {
                  products(first: 250) { nodes { id } }
                  productVariants(first: 250) { nodes { id product { id } } }
                }
                ... on DiscountCollections { collections(first: 250) { nodes { id handle } } }
              }
              value {
                __typename
                ... on DiscountPercentage { percentage }
                ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
              }
            }
          }
          ... on DiscountCodeFreeShipping {
            title
            status
            startsAt
            endsAt
            summary
            usageLimit
            asyncUsageCount
            codes(first: 1) { nodes { code } }
            maximumShippingPrice { amount currencyCode }
            minimumRequirement {
              __typename
              ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
              ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
            }
          }
          ... on DiscountCodeBxgy {
            title
            status
            startsAt
            endsAt
            summary
            usageLimit
            asyncUsageCount
            codes(first: 1) { nodes { code } }
          }
        }
      }
    }
  `;

  const discounts = [];
  for (const code of codes) {
    try {
      const json = await shopifyAdminGraphQL({ query, variables: { code } });
      const discount = json?.data?.codeDiscountNodeByCode?.codeDiscount || null;
      if (!discount) {
        discounts.push({
          code,
          applicable: false,
          amount: 0,
          currencyCode: "",
          cartFingerprint,
          message: "Invalid discount code.",
          checkedAt: Date.now(),
          source: "shopify-admin",
        });
        continue;
      }

      const resolved = calculateDiscountAmountFromAdmin(discount, items);
      discounts.push({
        code,
        applicable: resolved.applicable === true,
        amount: resolved.applicable === true ? Math.max(0, resolved.amount || 0) : 0,
        currencyCode: resolved.currencyCode || "",
        cartFingerprint,
        message: resolved.message || "",
        checkedAt: Date.now(),
        title: discount?.title || "",
        type: resolved.type || discount?.__typename || "",
        source: "shopify-admin",
      });
    } catch (error) {
      discounts.push({
        code,
        applicable: false,
        amount: 0,
        currencyCode: "",
        cartFingerprint,
        message: "Coupon could not be checked right now. Please try again.",
        checkedAt: Date.now(),
        source: "shopify-admin",
      });
    }
  }

  return {
    discounts,
    totalDiscountAmount: discounts.reduce(
      (sum, discount) => sum + (discount.applicable ? Math.max(0, discount.amount || 0) : 0),
      0
    ),
    subtotalAmount: cartSubtotalAmount(items),
    totalAmount: Math.max(
      0,
      cartSubtotalAmount(items) -
        discounts.reduce((sum, discount) => sum + (discount.applicable ? Math.max(0, discount.amount || 0) : 0), 0)
    ),
    currencyCode: discounts.find((discount) => discount.currencyCode)?.currencyCode || "",
    cartFingerprint,
    source: "shopify-admin",
  };
}

export async function validateShopifyCartDiscounts({ items = [], discountCodes = [], options = {} } = {}) {
  const codes = normalizeDiscountCodes(discountCodes);
  const cartFingerprint = options.cartFingerprint || cartDiscountFingerprint(items);
  if (!codes.length) {
    return { discounts: [], totalDiscountAmount: 0, cartFingerprint };
  }

  const lines = buildCheckoutLines(items);
  if (!lines.length) {
    return {
      discounts: codes.map((code) => ({
        code,
        applicable: false,
        amount: 0,
        currencyCode: "",
        cartFingerprint,
        message: "Add products before applying a discount code.",
        checkedAt: Date.now(),
      })),
      totalDiscountAmount: 0,
      cartFingerprint,
    };
  }

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  const buyerIdentity = buildBuyerIdentity(options);

  const mutation = `
    mutation ValidateCartDiscounts($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          checkoutUrl
          discountCodes { code applicable }
          discountAllocations {
            discountedAmount { amount currencyCode }
            ... on CartCodeDiscountAllocation { code }
          }
          cost {
            subtotalAmount { amount currencyCode }
            totalAmount { amount currencyCode }
          }
          lines(first: 250) {
            edges {
              node {
                discountAllocations {
                  discountedAmount { amount currencyCode }
                  ... on CartCodeDiscountAllocation { code }
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  let json;
  try {
    json = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query: mutation,
      variables: {
        input: {
          lines,
          discountCodes: codes,
          buyerIdentity,
        },
      },
    });
  } catch (error) {
    console.warn("Cart discount preview failed, using Admin discount lookup:", error?.message || error);
    return validateShopifyAdminDiscounts({ items, discountCodes: codes, cartFingerprint });
  }

  if (json?.errors?.length) {
    console.warn("Cart discount preview returned errors, using Admin discount lookup:", JSON.stringify(json.errors));
    return validateShopifyAdminDiscounts({ items, discountCodes: codes, cartFingerprint });
  }

  const payload = json?.data?.cartCreate;
  const errors = payload?.userErrors || [];
  if (errors.length) {
    console.warn("Cart discount preview user errors, using Admin discount lookup:", JSON.stringify(errors));
    return validateShopifyAdminDiscounts({ items, discountCodes: codes, cartFingerprint });
  }

  if (!payload?.cart) {
    return validateShopifyAdminDiscounts({ items, discountCodes: codes, cartFingerprint });
  }

  return buildDiscountPreviewResult({
    cart: payload.cart,
    requestedCodes: codes,
    cartFingerprint,
  });
}

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

const compact = (value) => String(value || "").trim();

const humanizeErrorField = (value = "") =>
  compact(value).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const flattenShopifyErrorMessages = (value, field = "") => {
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = compact(value);
    return text ? [field ? `${humanizeErrorField(field)}: ${text}` : text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenShopifyErrorMessages(item, field));
  }
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      flattenShopifyErrorMessages(item, key)
    );
  }
  return [];
};

const createShopifyAdminError = ({ status, json = {}, text = "", path = "", method = "GET" } = {}) => {
  const messages = [
    ...flattenShopifyErrorMessages(json?.errors),
    ...flattenShopifyErrorMessages(json?.error),
    ...flattenShopifyErrorMessages(json?.message),
    ...flattenShopifyErrorMessages(text),
  ].filter(Boolean);
  const uniqueMessages = [...new Set(messages)];
  const fallback = `Shopify Admin API returned HTTP ${status || "error"}`;
  const message = uniqueMessages.join(" ") || fallback;
  const error = new Error(message);
  error.name = "ShopifyAdminApiError";
  error.status = status;
  error.path = path;
  error.method = method;
  error.payload = json;
  error.rawText = text;
  error.messages = uniqueMessages;
  error.userMessage = message;
  return error;
};

const shopifyAdminRequest = async ({ path, method = "GET", body }) => {
  const { shop, accessToken } = await getShopifyAdminCredentials();
  if (!accessToken) {
    const error = new Error("This store is missing the Shopify Admin access token required for order management.");
    error.name = "ShopifyAdminConfigError";
    error.code = "SHOPIFY_ADMIN_TOKEN_MISSING";
    error.userMessage = error.message;
    throw error;
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
    throw createShopifyAdminError({ status: response.status, json, text, path, method });
  }

  return json;
};

async function shopifyAdminGraphQL({ query, variables = {} }) {
  const { shop, accessToken } = await getShopifyAdminCredentials();
  if (!accessToken) {
    const error = new Error("This store is missing the Shopify Admin access token required for order management.");
    error.name = "ShopifyAdminConfigError";
    error.code = "SHOPIFY_ADMIN_TOKEN_MISSING";
    error.userMessage = error.message;
    throw error;
  }

  const response = await fetch(`https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = {};
  }

  if (!response.ok) {
    throw createShopifyAdminError({
      status: response.status,
      json,
      text,
      path: "/graphql.json",
      method: "POST",
    });
  }

  if (json?.errors?.length) {
    throw createShopifyAdminError({
      status: response.status,
      json,
      text,
      path: "/graphql.json",
      method: "POST",
    });
  }

  return json;
}

const getStorefrontTokenFromPayload = (payload = {}) => {
  const direct =
    payload?.access_token ||
    payload?.accessToken ||
    payload?.token ||
    payload?.storefront_access_token ||
    payload?.storefrontAccessToken;
  if (direct) return compact(direct);

  const nested =
    payload?.storefront_access_token?.access_token ||
    payload?.storefront_access_token?.accessToken ||
    payload?.storefrontAccessToken?.accessToken ||
    payload?.storefrontAccessToken?.access_token;
  if (nested) return compact(nested);

  const list = payload?.storefront_access_tokens || payload?.storefrontAccessTokens || [];
  if (Array.isArray(list)) {
    const item = list.find((entry) =>
      compact(entry?.access_token || entry?.accessToken || entry?.token)
    );
    return item ? compact(item.access_token || item.accessToken || item.token) : "";
  }

  return "";
};

const resolveRuntimeStorefrontToken = async ({ options = {}, storeConfig = null, shop, storeId } = {}) => {
  const explicitToken = compact(
    options.token ||
    options.storefrontAccessToken ||
    storeConfig?.storefront_access_token ||
    storeConfig?.storefrontAccessToken
  );
  if (explicitToken) {
    return { token: explicitToken, source: "configured" };
  }

  const cacheKey = `${storeId || ""}:${shop || ""}`;
  const cachedToken = _runtimeStorefrontTokenCache.get(cacheKey);
  if (cachedToken) {
    return { token: cachedToken, source: "runtime-cache" };
  }

  try {
    const existing = await shopifyAdminRequest({ path: "/storefront_access_tokens.json" });
    const existingToken = getStorefrontTokenFromPayload(existing);
    if (existingToken) {
      _runtimeStorefrontTokenCache.set(cacheKey, existingToken);
      return { token: existingToken, source: "admin-list" };
    }
  } catch (error) {
    console.warn("Unable to list Shopify Storefront access tokens", {
      shop,
      storeId,
      error: error?.message || String(error),
    });
  }

  try {
    const created = await shopifyAdminRequest({
      path: "/storefront_access_tokens.json",
      method: "POST",
      body: {
        storefront_access_token: {
          title: "MobiDrag Mobile App",
        },
      },
    });
    const createdToken = getStorefrontTokenFromPayload(created);
    if (createdToken) {
      _runtimeStorefrontTokenCache.set(cacheKey, createdToken);
      return { token: createdToken, source: "admin-create" };
    }
  } catch (error) {
    console.warn("Unable to create Shopify Storefront access token", {
      shop,
      storeId,
      error: error?.message || String(error),
    });
  }

  return { token: "", source: "missing" };
};

const normalizeCancelReason = (reason) => {
  const value = compact(reason).toLowerCase();
  return ["customer", "inventory", "fraud", "declined", "other"].includes(value)
    ? value
    : "other";
};

const getOrderReference = (order = {}) =>
  compact(order?.name || order?.orderNumber || order?.order_number || order?.adminOrderId || order?.id);

const hasCompletedFulfillment = (order = {}) => {
  const fulfillments = Array.isArray(order?.fulfillments) ? order.fulfillments : [];
  if (fulfillments.some((fulfillment) => {
    const status = compact(fulfillment?.status).toLowerCase();
    return status && !["cancelled", "canceled", "failure", "failed", "closed"].includes(status);
  })) {
    return true;
  }
  const fulfillmentStatus = compact(order?.fulfillment_status || order?.fulfillmentStatus).toLowerCase();
  return ["fulfilled", "partial", "restocked"].includes(fulfillmentStatus);
};

const getOrderCancellationBlockReason = (order = {}, fallback = {}) => {
  const cancelledAt = order?.cancelled_at || fallback?.cancelledAt;
  if (cancelledAt) return "This order is already canceled in Shopify.";

  const financialStatus = compact(order?.financial_status || fallback?.financialStatus).toLowerCase();
  if (["refunded", "voided"].includes(financialStatus)) {
    return `This order cannot be canceled because its payment status is ${financialStatus}.`;
  }

  const isPaid = ["paid", "partially_refunded"].includes(financialStatus);
  if (isPaid && hasCompletedFulfillment(order)) {
    return "Shopify does not allow paid orders with fulfillments to be canceled.";
  }

  return "";
};

const createOrderCancellationError = ({ message, code, order, adminOrder } = {}) => {
  const reference = getOrderReference(adminOrder) || getOrderReference(order);
  const text = compact(message) || (reference
    ? `Shopify could not cancel order ${reference}.`
    : "Shopify could not cancel this order.");
  const error = new Error(text);
  error.name = "ShopifyOrderCancellationError";
  error.code = code || "ORDER_CANCELLATION_FAILED";
  error.userMessage = text;
  error.orderReference = reference;
  return error;
};

const rethrowFatalAdminLookupError = (error) => {
  if (
    error?.code === "SHOPIFY_ADMIN_TOKEN_MISSING" ||
    error?.status === 401 ||
    error?.status === 403
  ) {
    throw error;
  }
};

const mapAdminOrder = (adminOrder = {}, fallback = {}) => {
  if (!adminOrder || typeof adminOrder !== "object") return fallback;
  const currency = adminOrder.currency || fallback.currencyCode || "";
  const currencySymbol = currency ? sharedCurrencySymbolForCode(currency) : fallback.currencySymbol || "";
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
  const cancellationBlockReason = getOrderCancellationBlockReason(adminOrder, fallback);
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
    cancellationBlockReason,
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
    cancellable: !cancellationBlockReason,
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
          price: formatSharedMoney(line.price || 0, currency),
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
    "closed_at",
    "financial_status",
    "fulfillment_status",
    "fulfillments",
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
    } catch (error) {
      rethrowFatalAdminLookupError(error);
    }
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
    } catch (error) {
      rethrowFatalAdminLookupError(error);
    }
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
    } catch (error) {
      rethrowFatalAdminLookupError(error);
    }
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
  } catch (error) {
    rethrowFatalAdminLookupError(error);
  }

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
    throw createOrderCancellationError({
      code: "ORDER_REQUIRED",
      message: "Select an order before requesting cancellation.",
    });
  }
  const { adminOrder, lookupOrder } = await findAdminOrderWithCustomerFallback({
    order,
    customerAccessToken,
  });
  const adminOrderId = adminOrder?.id || extractShopifyNumericId(lookupOrder?.adminOrderId || lookupOrder?.id);
  if (!adminOrderId) {
    throw createOrderCancellationError({
      code: "ORDER_NOT_FOUND_IN_SHOPIFY",
      order: lookupOrder,
      message: getOrderReference(lookupOrder)
        ? `Order ${getOrderReference(lookupOrder)} could not be matched with a Shopify order. Refresh order history and try again.`
        : "This order could not be matched with a Shopify order. Refresh order history and try again.",
    });
  }
  if (adminOrder?.cancelled_at) {
    const mapped = mapAdminOrder(adminOrder, lookupOrder);
    return {
      success: true,
      order: mapped,
      alreadyCanceled: true,
      message: getOrderReference(mapped)
        ? `Order ${getOrderReference(mapped)} is already canceled in Shopify.`
        : "This order is already canceled in Shopify.",
    };
  }

  const cancellationBlockReason = getOrderCancellationBlockReason(adminOrder, lookupOrder);
  if (cancellationBlockReason) {
    throw createOrderCancellationError({
      code: "ORDER_CANCELLATION_NOT_ALLOWED",
      order: lookupOrder,
      adminOrder,
      message: getOrderReference(adminOrder) || getOrderReference(lookupOrder)
        ? `Order ${getOrderReference(adminOrder) || getOrderReference(lookupOrder)} cannot be canceled. ${cancellationBlockReason}`
        : cancellationBlockReason,
    });
  }

  let json;
  try {
    json = await shopifyAdminRequest({
      path: `/orders/${adminOrderId}/cancel.json`,
      method: "POST",
      body: {
        reason: normalizeCancelReason(reason),
        email: !!notifyCustomer,
      },
    });
  } catch (error) {
    const serverMessage = error?.userMessage || error?.message || "";
    throw createOrderCancellationError({
      code: error?.code || "SHOPIFY_CANCEL_REQUEST_FAILED",
      order: lookupOrder,
      adminOrder,
      message: getOrderReference(adminOrder) || getOrderReference(lookupOrder)
        ? `Order ${getOrderReference(adminOrder) || getOrderReference(lookupOrder)} could not be canceled. ${serverMessage}`
        : serverMessage,
    });
  }

  const canceledOrder = json?.order || {
    ...adminOrder,
    cancelled_at: new Date().toISOString(),
    cancel_reason: normalizeCancelReason(reason),
  };
  const mapped = mapAdminOrder(canceledOrder, lookupOrder);

  return {
    success: true,
    order: mapped,
    message: getOrderReference(mapped)
      ? `Order ${getOrderReference(mapped)} has been canceled in Shopify.`
      : "This order has been canceled in Shopify.",
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

export async function recoverShopifyCustomerPassword({ email, options = {} } = {}) {
  const normalizedEmail = String(email || "").trim();
  if (!normalizedEmail) {
    throw new Error("Email is required.");
  }

  const storeConfig = await fetchStoreConfig();
  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const storeId = options.storeId || creds.storeId;
  const storefrontToken = await resolveRuntimeStorefrontToken({
    options,
    storeConfig,
    shop,
    storeId,
  });
  const token = storefrontToken.token;

  const mutation = `
    mutation CustomerRecover($email: String!) {
      customerRecover(email: $email) {
        customerUserErrors {
          field
          message
          code
        }
      }
    }
  `;

  let json;
  try {
    json = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query: mutation,
      variables: { email: normalizedEmail },
      adminToken: storeConfig?.access_token || storeConfig?.admin_access_token || "",
    });
  } catch (error) {
    if (isStorefrontAuthFailure(error)) {
      console.warn("Password recovery Storefront auth/config failure", {
        shop,
        storeId,
        tokenSource: storefrontToken.source,
        hasRuntimeStorefrontToken: Boolean(token),
        error: error?.message || String(error),
      });
      throw new Error(PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }

  if (json?.errors?.length) {
    const message = json.errors[0]?.message || "Unable to send reset password link.";
    if (isStorefrontAuthFailure(message)) {
      throw new Error(PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE);
    }
    throw new Error(message);
  }

  const userErrors = json?.data?.customerRecover?.customerUserErrors || [];
  if (userErrors.length) {
    throw new Error(userErrors[0]?.message || "Unable to send reset password link.");
  }

  return { success: true };
}

export async function createShopifyCheckout({ variantId, quantity = 1, options = {} }) {
  if (!variantId) {
    throw new Error("Missing variant ID for checkout.");
  }

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  let merchandiseId = ensureVariantGid(variantId);
  const buyerIdentity = buildBuyerIdentity(options);

  if (!merchandiseId) {
    const resolved = await resolveCheckoutVariantForItem(
      {
        variantId,
        id: options.productId || options.id,
        handle: options.handle,
        quantity,
      },
      { shop, token, storeId }
    );
    merchandiseId = resolved.merchandiseId;
    if (merchandiseId) {
      console.log(`${CHECKOUT_LOG} resolved single product variant`, {
        source: resolved.source,
        merchandiseId,
      });
    }
  }

  console.log(`${CHECKOUT_LOG} create single checkout`, {
    variantId: String(variantId || ""),
    merchandiseId,
    quantity: Math.max(1, quantity),
    shop,
    hasCustomerAccessToken: !!resolveCustomerAccessToken(options),
  });

  if (!merchandiseId) {
    console.warn(`${CHECKOUT_LOG} invalid variant for single checkout`, {
      variantId: String(variantId || ""),
      options: {
        productId: options.productId || options.id || "",
        handle: options.handle || "",
      },
    });
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
    console.warn(`${CHECKOUT_LOG} single checkout GraphQL errors`, JSON.stringify(json.errors));
    throw new Error(json.errors.map((error) => error.message).join(" "));
  }

  const payload = json?.data?.cartCreate;
  const errors = payload?.userErrors || [];

  if (errors.length) {
    console.warn(`${CHECKOUT_LOG} single checkout user errors`, JSON.stringify(errors));
    throw new Error(errors.map((error) => error.message).join(" "));
  }

  const checkoutUrl = payload?.cart?.checkoutUrl ?? payload?.cart?.checckoutUrl;
  if (!checkoutUrl) {
    console.warn(`${CHECKOUT_LOG} single checkout missing URL`, { merchandiseId });
    throw new Error("Checkout URL not returned.");
  }

  console.log(`${CHECKOUT_LOG} single checkout URL created`, { checkoutUrl });
  return checkoutUrl;
}

export async function createShopifyCartCheckout({ items = [], discountCodes = [], options = {} }) {
  const requestedDiscountCodes = normalizeDiscountCodes(
    discountCodes.length ? discountCodes : options.discountCodes || []
  );

  const initialLines = buildCheckoutLines(items);

  // Build numeric variant IDs for direct cart URL fallback (no API needed)
  const initialDirectCartLines = buildDirectCartLines(items);

  if (!Array.isArray(items) || !items.length) {
    console.warn(`${CHECKOUT_LOG} checkout requested with empty cart`);
    throw new Error("No valid cart items for checkout.");
  }

  const customerAccessToken = resolveCustomerAccessToken(options);
  const checkoutCacheKey = buildCacheKey("cartCheckout", {
    lines: initialLines,
    directCartLines: initialDirectCartLines,
    items: (items || []).map(checkoutItemSummary),
    discountCodes: requestedDiscountCodes,
    buyerIdentity: {
      customerAccessToken,
      email: options.email || "",
      countryCode: resolveBuyerCountryCode(options),
    },
    shop: options.shop || "",
    storeId: options.storeId || "",
  });

  return withRequestCache(checkoutCacheKey, async () => {
    const creds = await getShopifyCredentials();
    const shop = options.shop || creds.shop;
    const token = options.token || creds.token;
    const storeId = options.storeId || creds.storeId;
    const buyerIdentity = buildBuyerIdentity(options);
    const resolvedCheckout = await buildResolvedCheckoutLines(items, { shop, token, storeId });
    const lines = resolvedCheckout.lines.length ? resolvedCheckout.lines : initialLines;
    const directCartLines = buildDirectCartLinesFromCheckoutLines(lines);

    console.log(`${CHECKOUT_LOG} create cart checkout`, {
      itemCount: items.length,
      lineCount: lines.length,
      directCartLineCount: directCartLines.length,
      discountCodes: requestedDiscountCodes,
      shop,
      hasCustomerAccessToken: !!customerAccessToken,
      buyerCountryCode: buyerIdentity?.countryCode || "",
    });

    if (resolvedCheckout.resolved.length) {
      console.log(`${CHECKOUT_LOG} resolved checkout variants`, resolvedCheckout.resolved.map((entry) => ({
        source: entry.source,
        merchandiseId: entry.merchandiseId,
        item: checkoutItemSummary(entry.item, entry.index),
      })));
    }

    if (resolvedCheckout.invalid.length) {
      console.warn(`${CHECKOUT_LOG} cart items without valid variant`, resolvedCheckout.invalid.map((entry) =>
        checkoutItemSummary(entry.item, entry.index)
      ));
      throw new Error("Some cart items are missing valid Shopify variants.");
    }

    if (!lines.length && !directCartLines.length) {
      console.warn(`${CHECKOUT_LOG} no valid checkout lines`, {
        items: (items || []).map(checkoutItemSummary),
      });
      throw new Error("No valid cart items for checkout.");
    }

  // ── Attempt 1: cartCreate mutation (Storefront API 2021-07+) ──────────────
  let directCartFallbackAllowed = true;
  let checkoutFailureReason = "";

  if (lines.length) {
    const cartCreateMutation = `
      mutation CreateCart($input: CartInput!) {
        cartCreate(input: $input) {
          cart {
            checkoutUrl
            discountCodes { code applicable }
          }
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
            ...(requestedDiscountCodes.length ? { discountCodes: requestedDiscountCodes } : {}),
          },
        },
      });
      if (json?.errors?.length) {
        console.warn(`${CHECKOUT_LOG} cartCreate GraphQL errors`, JSON.stringify(json.errors));
      }
      if (!json?.errors?.length) {
        const payload = json?.data?.cartCreate;
        if (payload?.userErrors?.length) {
          console.warn(`${CHECKOUT_LOG} cartCreate user errors`, JSON.stringify(payload.userErrors));
          directCartFallbackAllowed = false;
          checkoutFailureReason = payload.userErrors.map((error) => error?.message).filter(Boolean).join(" ");
        }
        if (!payload?.userErrors?.length) {
          if (requestedDiscountCodes.length) {
            const returnedCodes = payload?.cart?.discountCodes || [];
            const invalidCode = requestedDiscountCodes.find((code) => {
              const match = returnedCodes.find(
                (entry) => normalizeDiscountCode(entry?.code) === code
              );
              return !match || match.applicable !== true;
            });
            if (invalidCode) {
              const error = new Error(`Discount code ${invalidCode} is not valid for this cart.`);
              error.discountValidationFailed = true;
              throw error;
            }
          }
          const url = payload?.cart?.checkoutUrl;
          if (url) {
            console.log("✅ Checkout via cartCreate:", url);
            return url;
          }
        }
      }
      console.warn("⚠️ cartCreate failed, trying checkoutCreate...");
    } catch (e) {
      if (e?.discountValidationFailed) throw e;
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
        variables: {
          input: {
            lineItems,
            ...(options.email ? { email: String(options.email).trim() } : {}),
            ...(requestedDiscountCodes.length ? { discountCodes: requestedDiscountCodes } : {}),
          },
        },
      });
      if (json?.errors?.length) {
        console.warn(`${CHECKOUT_LOG} checkoutCreate GraphQL errors`, JSON.stringify(json.errors));
      }
      if (!json?.errors?.length) {
        const payload = json?.data?.checkoutCreate;
        if (payload?.checkoutUserErrors?.length) {
          console.warn(`${CHECKOUT_LOG} checkoutCreate user errors`, JSON.stringify(payload.checkoutUserErrors));
          directCartFallbackAllowed = false;
          checkoutFailureReason = payload.checkoutUserErrors.map((error) => error?.message).filter(Boolean).join(" ");
        }
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
  if (directCartFallbackAllowed && directCartLines.length) {
    const queryString = buildCheckoutQueryString({
      discountCodes: requestedDiscountCodes,
      email: options.email,
    });
    const url = `https://${shop}/cart/${directCartLines.join(",")}${queryString}`;
    console.log(`${CHECKOUT_LOG} checkout via direct cart URL`, {
      url,
      lines: directCartLines,
    });
    return url;
  }

  if (!directCartFallbackAllowed) {
    throw new Error(checkoutFailureReason || "Some cart items cannot be checked out.");
  }

  console.warn(`${CHECKOUT_LOG} checkout URL not returned`, {
    lines: checkoutLineSummary(lines),
    directCartLines,
  });
  throw new Error("Checkout URL not returned. Please try again.");
  });
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
            description
            options {
              name
              values
            }
            rating: metafield(namespace: "reviews", key: "rating") { value }
            ratingCount: metafield(namespace: "reviews", key: "rating_count") { value }
            featuredImage { url }
            images(first: 1) { edges { node { url } } }
            priceRangeV2 { minVariantPrice { amount currencyCode } }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
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
      const variants = (node?.variants?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean);
      const variant = pickAvailableVariant(variants);
      const priceNode = node?.priceRangeV2?.minVariantPrice;
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        vendor: node?.vendor || "",
        productType: node?.productType || "",
        tags: node?.tags || [],
        description: node?.description || "",
        options: node?.options || [],
        availableForSale: productAvailableFromVariants(variants),
        variants,
        variantId: variant?.id || null,
        imageUrl: node?.featuredImage?.url || node?.images?.edges?.[0]?.node?.url || null,
        priceAmount: priceNode?.amount || null,
        priceCurrency: priceNode?.currencyCode || null,
        compareAtPrice: variant?.compareAtPrice || null,
        rating: node?.rating?.value || null,
        ratingCount: node?.ratingCount?.value || null,
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
  const safeLimit = Math.max(1, Number(limit) || 10);
  const cacheKey = buildCacheKey("collectionsList", {
    first: safeLimit,
    shop: options.shop || "",
    storeId: options.storeId || "",
  });
  return withRequestCache(cacheKey, () => fetchShopifyCollectionsList(safeLimit, options));
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
                  variants(first: 10) {
                    edges {
                      node {
                        id
                        title
                        availableForSale
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
      const variants = variantNodesFromEdges(node?.variants?.edges);
      const variant = pickAvailableVariant(variants);
      return {
        id: node?.id,
        title: node?.title,
        handle: node?.handle,
        vendor: node?.vendor || "",
        productType: node?.productType || "",
        tags: node?.tags || [],
        options: node?.options || [],
        availableForSale: productAvailableFromVariants(variants),
        variants,
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
      const currencySymbol = sharedCurrencySymbolForCode(currency);
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
            ? formatSharedMoney(li.variant.price.amount || 0, li.variant.price.currencyCode || currency)
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

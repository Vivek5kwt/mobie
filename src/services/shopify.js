import { fetchStoreConfig, getStoreConfigSync } from './storeService';
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
  parseMoneyAmount,
} from '../utils/money';
import { getCurrencySnapshot } from '../utils/currencyStore';
import {
  cartDiscountFingerprint,
  normalizeDiscountCode,
  normalizeDiscountCodes,
} from '../utils/cartDiscounts';

const STOREFRONT_VERSION = "2024-10";
// Backend proxy — handles Shopify auth server-side using the store's Admin
// API access token, which every installed store has from OAuth install.
// The app deliberately never uses a Storefront Access Token anywhere:
// Shopify now requires an app to be a registered Sales Channel to mint one,
// so it can never be reliably available here. Cart/checkout goes through
// draftOrderCreate (Admin API) instead of the Storefront-only
// cartCreate/checkoutCreate mutations for the same reason.
const PROXY_ENDPOINT = "https://app.mobidrag.com/api/shopify/preview-graphql";
const ADMIN_API_VERSION = STOREFRONT_VERSION;

// Fallback credentials — used when getStore fails
const FALLBACK_SHOP    = "mobidrag-demo.myshopify.com";
const FALLBACK_TOKEN   = "f19ea13e90fdadc0723f8a060f1d754b";
const FALLBACK_STORE_ID = 40;
const DEFAULT_CHECKOUT_COUNTRY_CODE = "US";
const REQUEST_CACHE_TTL_MS = 30000;

// The direct Shopify cart-URL fallback (createShopifyCartCheckout's Attempt
// 3) builds `https://${shop}/cart/...` straight from the resolved shop
// domain — if that value ever carries a protocol/path (e.g. saved as
// "https://mystore.myshopify.com" instead of the bare host), the resulting
// URL becomes malformed ("https://https://...") and the WebView can't
// resolve it at all, surfacing as a generic "Failed to load checkout page"
// with no indication why.
const normalizeShopDomain = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split("?")[0]
    .trim();
};
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
  query RecentProductsFallback($first: Int!, $query: String) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true, query: $query) {
      edges {
        node {
          id
          title
          handle
          vendor
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
    products(first: $productsFirst, sortKey: UPDATED_AT, reverse: true, query: "status:active") {
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
// Routes through the backend's Admin-API proxy so the server supplies valid
// Shopify credentials from the store's OAuth access token — the app never
// needs a Storefront Access Token on-device at all. There used to be a
// direct-Storefront-API fallback here; removed deliberately: Shopify now
// requires an app to be a registered Sales Channel to mint Storefront
// tokens, so this app can never reliably have one, and silently falling
// back to it just produced confusing cross-store auth failures.
export async function directStorefrontGraphQL({
  shop, storeId, query, variables, adminToken, accessToken, accessType, accessFields,
}) {
  const resolvedStoreId = storeId || FALLBACK_STORE_ID;
  const resolvedAdminToken = adminToken || accessToken || "";

  const proxyRes = await fetch(PROXY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId: resolvedStoreId,
      shop,
      query,
      variables,
      accessToken: resolvedAdminToken,
      adminAccessToken: resolvedAdminToken,
      accessType,
      accessFields,
    }),
  });

  if (!proxyRes.ok) {
    const text = await proxyRes.text().catch(() => "");
    throw new Error(`Shopify proxy HTTP ${proxyRes.status}: ${text}`);
  }

  const json = await proxyRes.json();
  if (json?.errors?.length) {
    console.warn("⚠️ Proxy GraphQL errors:", JSON.stringify(json.errors));
  }
  return json;
}

// Real Shopify Storefront API proxy — unlike directStorefrontGraphQL above
// (which, despite its name, actually calls the backend's Admin API proxy),
// this hits /api/shopify/storefront-graphql, which resolves the store's
// real storefront_access_token server-side and posts to Shopify's actual
// /api/{version}/graphql.json endpoint. Needed for the handful of things
// only the real Storefront schema exposes — customerCreate (the only
// Shopify API that can set a password) and customerAccessTokenCreate
// (verifying it). The "never reliably available" caveat on
// directStorefrontGraphQL was about an app-level Storefront token minted
// via the GraphQL Admin API; utils/shopifyAuth.js's
// ensureStorefrontAccessToken instead uses the REST
// storefront_access_tokens.json endpoint, which doesn't have that
// restriction — so this path is expected to work.
const REAL_STOREFRONT_PROXY_ENDPOINT = "https://app.mobidrag.com/api/shopify/storefront-graphql";

async function realStorefrontGraphQL({ shop, query, variables }) {
  const proxyRes = await fetch(REAL_STOREFRONT_PROXY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop, query, variables }),
  });

  const text = await proxyRes.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = {};
  }

  if (!proxyRes.ok) {
    throw new Error(`Storefront proxy HTTP ${proxyRes.status}: ${text}`);
  }
  if (json?.errors?.length) {
    console.warn("⚠️ Real Storefront GraphQL errors:", JSON.stringify(json.errors));
  }
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
      variables: { first: Math.max(1, limit), query: "status:active" },
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
        vendor: node?.vendor || "",
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
  // Shopify's default catalog-all collection ("All Products"/"All product",
  // often titled "Home page" too) isn't a real search term — every store has
  // one, so it was showing up as a trending chip on every install.
  "all products",
  "all product",
  "home page",
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
    query Products($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query) {
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
      variables: { first, after, query: "status:active" },
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
              selectedOptions { name value }
              price
              compareAtPrice
              image { url }
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
              selectedOptions { name value }
              price
              compareAtPrice
              image { url }
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
  // Without this, the permalink adds the item(s) to cart and then follows
  // Shopify's own default redirect to the plain /cart page — which
  // CheckoutWebViewScreen's onShouldStartLoadWithRequest deliberately BLOCKS
  // navigating to (isCheckoutCartPageUrl guard, meant to stop the shopper
  // from getting bounced out of checkout back to the cart) since it's a
  // different URL than the one this screen was opened with. With no
  // permitted destination to fall through to, the WebView is left showing
  // nothing — a blank white screen instead of checkout. return_to=/checkout
  // is Shopify's own documented permalink convention for skipping straight
  // to checkout instead of the cart page, avoiding that blocked hop entirely.
  params.push("return_to=/checkout");
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
    all: results,
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

// Cart lines with a resolved variant can still be genuinely unorderable
// (deleted, unpublished, or out of stock with no "continue selling"
// override) — cartCreate/checkoutCreate happily accept such a line and
// hand back a working-looking checkoutUrl; Shopify only discovers the
// problem when the checkout page itself is loaded, surfacing as a
// dead-end "Cart Error: One or more items are no longer available" page.
// Checking availableForSale up front lets the caller drop the stale
// item and retry instead of sending the user into that dead end.
export async function checkVariantsAvailability(variantGids = [], context = {}) {
  const ids = [...new Set((variantGids || []).filter(Boolean))];
  if (!ids.length) return {};

  const query = `
    query CheckVariantsAvailability($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          availableForSale
          title
          product { title }
        }
      }
    }
  `;

  try {
    const json = await directStorefrontGraphQL({ ...context, query, variables: { ids } });
    if (json?.errors?.length) {
      console.warn(`${CHECKOUT_LOG} availability check GraphQL errors`, JSON.stringify(json.errors));
      return {};
    }
    const nodes = json?.data?.nodes || [];
    const result = {};
    ids.forEach((id, index) => {
      const node = nodes[index];
      result[id] = {
        exists: !!node,
        availableForSale: node ? node.availableForSale !== false : false,
        title: node ? [node.product?.title, node.title].filter(Boolean).join(" - ") : "",
      };
    });
    return result;
  } catch (error) {
    console.warn(`${CHECKOUT_LOG} availability check failed`, {
      message: error?.message || String(error),
    });
    return {};
  }
}

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
    const price = parseMoneyAmount(item?.price ?? item?.priceAmount);
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

  // Discount validation only needs the Admin API (access token) — no
  // Storefront cartCreate preview needed at all, so no Storefront token is
  // ever involved here.
  return validateShopifyAdminDiscounts({ items, discountCodes: codes, cartFingerprint });
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

// DraftOrderStatus enum values — distinct from Order's fulfillment/financial
// status, since a draft order (this app's checkout goes through
// draftOrderCreate — see createDraftOrderCheckoutUrl) hasn't been paid yet.
const formatDraftOrderStatus = (status) => {
  const normalized = String(status || "").trim().toUpperCase();
  const labels = {
    OPEN: "Awaiting payment",
    INVOICE_SENT: "Invoice sent",
    COMPLETED: "Paid",
    CANCELLED: "Cancelled",
  };
  return labels[normalized] || "";
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

// Both functions below route through the backend's Admin-API proxy instead
// of calling Shopify directly from the device. Previously they fetched a raw
// Shopify Admin API token (full read/write access to every customer on the
// store, not just one) via getShopifyAdminCredentials(), which read it off a
// client-facing `getStore` query with no caller-identity check, then cached
// it in the device's AsyncStorage — a real, live security gap (tracked as
// C-1 in audit/audit-mobile.md) that meant every install effectively carried
// a copy of the merchant's full Admin credential. The token now never leaves
// the backend; the device only ever sends `shop` + what it wants to fetch,
// and the server resolves the real token itself (see shopifyProxy.controller.js
// :: adminRestProxy / previewGraphQL).
const ADMIN_REST_PROXY_ENDPOINT = "https://app.mobidrag.com/api/shopify/admin-rest-proxy";

const shopifyAdminRequest = async ({ path, method = "GET", body, accessType, accessFields }) => {
  const config = await fetchStoreConfig();
  const shop = config?.shopify_domain || FALLBACK_SHOP;

  const proxyRes = await fetch(ADMIN_REST_PROXY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop, path, method, body, accessType, accessFields }),
  });

  const text = await proxyRes.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (_) {
    json = {};
  }

  if (!proxyRes.ok) {
    throw createShopifyAdminError({ status: proxyRes.status, json, text, path, method });
  }

  return json;
};

async function shopifyAdminGraphQL({ query, variables = {}, accessType, accessFields }) {
  const config = await fetchStoreConfig();
  const shop = config?.shopify_domain || FALLBACK_SHOP;
  const storeId = config?.id ? Number(config.id) : FALLBACK_STORE_ID;

  const json = await directStorefrontGraphQL({
    shop,
    storeId,
    query,
    variables,
    accessType,
    accessFields,
  });

  if (json?.errors?.length) {
    throw createShopifyAdminError({
      status: 200,
      json,
      text: "",
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

// order.id falls back to the completed checkout URL (buildOrderFromCart in
// CheckoutWebViewScreen.js) when no real order number could be detected yet
// — a reasonable unique-ish placeholder for local matching, but never a
// value that should be shown to a shopper as "their order number", so it's
// excluded here even though the other candidates are genuinely usable IDs.
const getOrderReference = (order = {}) => {
  const candidates = [order?.name, order?.orderNumber, order?.order_number, order?.adminOrderId, order?.id];
  return candidates.map(compact).find((value) => value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) || "";
};

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
        accessType: "order_lookup",
        accessFields: "name,email,phone,address",
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
        accessType: "order_lookup",
        accessFields: "name,email,phone,address",
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
        accessType: "order_lookup",
        accessFields: "name,email,phone,address",
      });
      if (Array.isArray(json?.orders) && json.orders[0]) return json.orders[0];
    } catch (error) {
      rethrowFatalAdminLookupError(error);
    }
  }

  try {
    const json = await shopifyAdminRequest({
      path: `/orders.json?status=any&limit=50&fields=${encodeURIComponent(fields)}`,
      accessType: "order_lookup",
      accessFields: "name,email,phone,address",
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

const findAdminOrderWithCustomerFallback = async ({ order, customerId, customerAccessToken } = {}) => {
  let lookupOrder = order || {};
  let adminOrder = await findAdminOrderForCustomerOrder(lookupOrder);
  const resolvedCustomerId = customerId || customerAccessToken;
  if (adminOrder || !resolvedCustomerId) {
    return { adminOrder, lookupOrder };
  }

  const { orders } = await fetchCustomerOrders({ customerId: resolvedCustomerId, first: 10 });
  const customerOrder = findMatchingCustomerOrder(lookupOrder, orders);
  if (!customerOrder) {
    return { adminOrder: null, lookupOrder };
  }

  lookupOrder = { ...lookupOrder, ...customerOrder };
  adminOrder = await findAdminOrderForCustomerOrder(lookupOrder);
  return { adminOrder, lookupOrder };
};

export async function fetchShopifyOrderDetails({ order, customerId, customerAccessToken } = {}) {
  if (!order) return null;
  const { adminOrder, lookupOrder } = await findAdminOrderWithCustomerFallback({
    order,
    customerId,
    customerAccessToken,
  });
  return adminOrder ? mapAdminOrder(adminOrder, lookupOrder) : lookupOrder;
}

export async function cancelShopifyOrder({ order, reason = "customer", notifyCustomer = true, customerId, customerAccessToken } = {}) {
  if (!order) {
    throw createOrderCancellationError({
      code: "ORDER_REQUIRED",
      message: "Select an order before requesting cancellation.",
    });
  }
  const { adminOrder, lookupOrder } = await findAdminOrderWithCustomerFallback({
    order,
    customerId,
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
      accessType: "order_cancel",
      accessFields: "name,email,phone,address",
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
    const json = await realStorefrontGraphQL({
      shop,
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

// Fetches the real Shopify customer record (id, name, email, phone) behind
// a customerAccessToken from createShopifyCustomerAccessToken above — this
// is what gives the session a real shopifyCustomerId instead of only a
// Postgres-local one, and doubles as confirmation the token is actually
// live before the caller trusts it.
export async function fetchShopifyCustomerDetails({ accessToken, options = {} } = {}) {
  if (!accessToken) return null;

  const creds = await getShopifyCredentials();
  const shop = options.shop || creds.shop;

  const query = `
    query CustomerDetails($customerAccessToken: String!) {
      customer(customerAccessToken: $customerAccessToken) {
        id
        firstName
        lastName
        email
        phone
      }
    }
  `;

  try {
    const json = await realStorefrontGraphQL({
      shop,
      query,
      variables: { customerAccessToken: accessToken },
    });

    if (json?.errors?.length) {
      console.warn("⚠️ Customer details GraphQL errors:", JSON.stringify(json.errors));
      return null;
    }

    const customer = json?.data?.customer;
    if (!customer?.id) return null;

    return {
      shopifyCustomerId: String(customer.id).replace("gid://shopify/Customer/", ""),
      firstName: customer.firstName || "",
      lastName: customer.lastName || "",
      email: customer.email || "",
      phone: customer.phone || "",
    };
  } catch (error) {
    console.warn("⚠️ fetchShopifyCustomerDetails failed:", error?.message || error);
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
  const storeId = options.storeId || creds.storeId;
  let merchandiseId = ensureVariantGid(variantId);

  if (!merchandiseId) {
    const resolved = await resolveCheckoutVariantForItem(
      {
        variantId,
        id: options.productId || options.id,
        handle: options.handle,
        quantity,
      },
      { shop, storeId }
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

  // "Buy Now" used to skip straight to a raw, unchecked cart permalink —
  // if the product had since been deleted/unpublished, Shopify's own cart
  // page rejected it with a dead-end "Cart Error" the caller had no way to
  // recover from. Re-validate right before checkout, same as the cart flow.
  const availabilityMap = await checkVariantsAvailability([merchandiseId], { shop, storeId });
  const availability = availabilityMap[merchandiseId];
  if (availability && (availability.exists === false || availability.availableForSale === false)) {
    const title = availability.title || "This item";
    console.warn(`${CHECKOUT_LOG} single checkout item unavailable`, { merchandiseId, title });
    const error = new Error(`${title} is no longer available.`);
    error.unavailableItems = [{ id: variantId, variantId, title }];
    throw error;
  }

  const singleLine = [{ merchandiseId, quantity: Math.max(1, quantity) }];

  try {
    const draftOrderUrl = await createDraftOrderCheckoutUrl({
      shop,
      storeId,
      lines: singleLine,
      options,
    });
    if (draftOrderUrl) {
      console.log(`${CHECKOUT_LOG} single checkout via draftOrderCreate`, { draftOrderUrl });
      return draftOrderUrl;
    }
  } catch (error) {
    console.warn(`${CHECKOUT_LOG} single checkout draftOrderCreate error:`, error?.message || error);
  }

  const directMatch = String(merchandiseId).match(/ProductVariant\/(\d+)/);
  if (directMatch) {
    // Same fix as createShopifyCartCheckout's direct-cart-URL fallback below:
    // this permalink adds to the storefront's existing cookie-based cart
    // rather than replacing it, so clear it server-side first. Also send it
    // straight to /checkout (Shopify's own return_to convention) instead of
    // letting it fall through to its default /cart landing — CheckoutWebViewScreen
    // deliberately blocks navigating to a bare /cart page mid-checkout, which
    // otherwise leaves the WebView showing nothing after the add-to-cart hop.
    // /cart/clear's own return_to must be a relative path, not a full
    // absolute URL — Shopify's open-redirect protection silently ignores (no
    // redirect at all, leaving the WebView on a blank "cart cleared" page)
    // a return_to value that looks like a different/external origin, even
    // when it's actually the same shop domain.
    const permalinkPath = `/cart/${directMatch[1]}:${Math.max(1, quantity)}?return_to=/checkout`;
    const permalinkUrl = `https://${shop}${permalinkPath}`;
    const url = `https://${shop}/cart/clear?return_to=${encodeURIComponent(permalinkPath)}`;
    console.log(`${CHECKOUT_LOG} single checkout via direct cart URL (cleared first)`, { url, permalinkUrl });
    return url;
  }

  console.warn(`${CHECKOUT_LOG} single checkout missing URL`, { merchandiseId });
  throw new Error("Checkout URL not returned.");
}

// Checkout via the Admin API access token — every installed store already has
// one from OAuth install, unlike a Storefront Access Token (which Shopify now
// restricts to apps registered as a Sales Channel). draftOrderCreate produces
// a real, payable invoiceUrl the customer can complete in a WebView, same as
// a normal checkout link. Requires the app to have Shopify's "Protected
// Customer Data" access approved (Partner Dashboard → API access) — without
// it, Shopify returns an ACCESS_DENIED error and the caller falls back to the
// Storefront-token-based attempts.
async function createDraftOrderCheckoutUrl({ shop, storeId, lines = [], options = {} }) {
  const lineItems = (lines || [])
    .map((line) => ({
      variantId: line?.merchandiseId,
      quantity: Math.max(1, Number(line?.quantity) || 1),
    }))
    .filter((line) => line.variantId);
  if (!lineItems.length) return "";

  const email = options?.email ? String(options.email).trim() : "";
  // draftOrderCreate is an Admin API mutation — it has no buyerIdentity
  // concept (that's Storefront-only), so the currency shown at checkout has
  // to be set explicitly here via presentmentCurrencyCode instead. Without
  // this, checkout always invoiced in the shop's own default currency
  // regardless of what the shopper picked in the Currency Switcher. Only
  // sent when a currency has actually been explicitly selected — Shopify
  // rejects a presentmentCurrencyCode that isn't one of the shop's enabled
  // markets, and an empty/omitted value correctly falls back to the shop
  // default, matching "same as default → show as-is".
  const presentmentCurrencyCode = getCurrencySnapshot().code || "";

  const mutation = `
    mutation CreateDraftOrderCheckout($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder {
          id
          invoiceUrl
        }
        userErrors { field message }
      }
    }
  `;

  const json = await directStorefrontGraphQL({
    shop,
    storeId,
    query: mutation,
    variables: {
      input: {
        lineItems,
        ...(email ? { email } : {}),
        ...(presentmentCurrencyCode ? { presentmentCurrencyCode } : {}),
        useCustomerDefaultAddress: false,
      },
    },
  });

  if (json?.errors?.length) {
    console.warn(`${CHECKOUT_LOG} draftOrderCreate GraphQL errors`, JSON.stringify(json.errors));
    return "";
  }

  const payload = json?.data?.draftOrderCreate;
  if (payload?.userErrors?.length) {
    console.warn(`${CHECKOUT_LOG} draftOrderCreate user errors`, JSON.stringify(payload.userErrors));
    return "";
  }

  return payload?.draftOrder?.invoiceUrl || "";
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

  // Deliberately NOT wrapped in withRequestCache: cartCreate/checkoutCreate
  // are mutations that mint a brand-new, ephemeral Shopify checkout session
  // every time. Caching the returned URL for the (identical-cart-contents)
  // request key meant a retry within the cache TTL replayed an OLD session
  // token — if Shopify had already invalidated/consumed that cart between
  // the first and second attempt, the WebView loads a URL that's now
  // genuinely stale, and Shopify's own server correctly (from its side)
  // responds "Link no longer exists". Always create a fresh session.
  const creds = await getShopifyCredentials();
  const shop = normalizeShopDomain(options.shop || creds.shop);
  const token = options.token || creds.token;
  const storeId = options.storeId || creds.storeId;
  const customerAccessToken = resolveCustomerAccessToken(options);
  if (!shop) {
    console.warn(`${CHECKOUT_LOG} missing shop domain — cannot build checkout URL`, {
      hasOptionsShop: !!options.shop,
      hasCredsShop: !!creds.shop,
    });
    throw new Error("Store is not configured for checkout. Please try again later.");
  }
  {
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

    const uniqueMerchandiseIds = [...new Set(
      resolvedCheckout.all.map((entry) => entry.merchandiseId).filter(Boolean)
    )];
    const availabilityMap = uniqueMerchandiseIds.length
      ? await checkVariantsAvailability(uniqueMerchandiseIds, { shop, token, storeId })
      : {};
    const unavailableEntries = resolvedCheckout.all.filter((entry) => {
      const info = entry.merchandiseId ? availabilityMap[entry.merchandiseId] : null;
      return info && (info.exists === false || info.availableForSale === false);
    });
    if (unavailableEntries.length) {
      const unavailableItems = unavailableEntries.map((entry) => ({
        id: entry.item?.id || entry.item?.variantId || "",
        variantId: entry.item?.variantId || "",
        title:
          availabilityMap[entry.merchandiseId]?.title ||
          entry.item?.title ||
          entry.item?.name ||
          "Item",
      }));
      console.warn(`${CHECKOUT_LOG} cart contains unavailable items`, unavailableItems);
      const names = unavailableItems.map((entry) => entry.title).join(", ");
      const error = new Error(
        `${names} ${unavailableItems.length > 1 ? "are" : "is"} no longer available.`
      );
      error.unavailableItems = unavailableItems;
      throw error;
    }

  // ── Attempt 0: draftOrderCreate (Admin API access token — no Storefront
  // token needed at all). Shopify gates DraftOrder/Order/Customer objects
  // behind "Protected Customer Data" approval in the Partner Dashboard; until
  // that's granted this returns an ACCESS_DENIED error and we fall through to
  // the Storefront-based attempts below exactly as before.
  const draftOrderLines = lines.length ? lines : initialLines;
  if (draftOrderLines.length) {
    try {
      const draftOrderUrl = await createDraftOrderCheckoutUrl({
        shop,
        storeId,
        lines: draftOrderLines,
        options,
      });
      if (draftOrderUrl) {
        console.log("✅ Checkout via draftOrderCreate:", draftOrderUrl);
        return draftOrderUrl;
      }
    } catch (e) {
      console.warn(`${CHECKOUT_LOG} draftOrderCreate error:`, e?.message || e);
    }
  }

  // ── Attempt 1: direct Shopify cart URL (no API call needed at all) ───────
  // cartCreate/checkoutCreate (Storefront API) are deliberately not used —
  // they require a Storefront Access Token, which this app can never
  // reliably have (see the note on directStorefrontGraphQL above). The
  // availability pre-check above already caught genuinely invalid items,
  // so any remaining lines are safe to send straight to Shopify's plain
  // cart permalink.
  if (directCartLines.length) {
    const queryString = buildCheckoutQueryString({
      discountCodes: requestedDiscountCodes,
      email: options.email,
    });
    const permalinkPath = `/cart/${directCartLines.join(",")}${queryString}`;
    const permalinkUrl = `https://${shop}${permalinkPath}`;
    // This permalink ADDS to whatever's already in Shopify's own storefront
    // cart (tracked via the checkout WebView's shared/persistent cookies) —
    // it does not replace it. A previous checkout attempt that was opened
    // but abandoned before completing payment left its items in that same
    // cookie-based cart, so the next checkout (even with fewer/different
    // items after removing something from the app's own cart) silently
    // merged the current items on top of the stale ones — the customer saw
    // products they'd already removed reappear at checkout. Routing through
    // Shopify's own /cart/clear first (a standard storefront endpoint) wipes
    // that stale cart server-side before adding back exactly the current
    // set, via the same `return_to` redirect convention Shopify's storefront
    // already uses elsewhere (cart/add, account/login, ...).
    // /cart/clear's own return_to must be a relative path, not a full
    // absolute URL — Shopify's open-redirect protection silently ignores (no
    // redirect at all, leaving the WebView on a blank "cart cleared" page) a
    // return_to value that looks like a different/external origin, even when
    // it's actually the same shop domain.
    const url = `https://${shop}/cart/clear?return_to=${encodeURIComponent(permalinkPath)}`;
    console.log(`${CHECKOUT_LOG} checkout via direct cart URL (cleared first)`, {
      url,
      permalinkUrl,
      lines: directCartLines,
    });
    return url;
  }

  console.warn(`${CHECKOUT_LOG} checkout URL not returned`, {
    lines: checkoutLineSummary(lines),
    directCartLines,
  });
  throw new Error("Checkout URL not returned. Please try again.");
  }
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

  // Wrap the OR-joined field matches in parens before ANDing with
  // status:active — Shopify's search grammar has AND bind tighter than OR,
  // so without the parens only the first OR-branch would actually be
  // restricted to active products.
  const activeTermQuery = safeTerm ? `status:active AND ${safeTerm}` : "status:active";
  const searchQuery = queryParts.length
    ? `status:active AND (${queryParts.join(" OR ")})`
    : activeTermQuery;

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

    if (json.errors && queryParts.length > 0) {
      const fallbackJson = await directStorefrontGraphQL({
        shop,
        token,
        storeId,
        query,
        variables: { first: limit, query: activeTermQuery },
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
    if (edges.length > 0 || queryParts.length === 0) {
      return mapProductEdges(edges);
    }

    const fallbackJson = await directStorefrontGraphQL({
      shop,
      token,
      storeId,
      query,
      variables: { first: limit, query: activeTermQuery },
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
                  status
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

    // Collection.products (unlike the root-level products field) doesn't
    // accept a "query" filter argument in Shopify's Admin API schema — that
    // was crashing this whole query with a GraphQL "doesn't accept argument
    // 'query'" error. Filter out non-active products client-side instead.
    const products = edges
      .filter(({ node }) => !node?.status || node.status === "ACTIVE")
      .map(({ node }) => {
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
// Builder/APK never has a reliable Shopify Storefront Access Token (see the
// PROXY_ENDPOINT comment above — a store must be a registered Sales Channel
// to mint one), so this can't use the Storefront API's
// `customer(customerAccessToken: ...)` lookup the way a Storefront-only app
// would. It used to anyway, sent through directStorefrontGraphQL (which is
// actually the Admin API proxy) — the Admin schema has no such argument on
// `customer` at all, which is exactly the "missing required arguments: id"
// error this was producing. Rewritten to use the Admin API's real
// `customer(id: ID!)` lookup with the Shopify customer GID captured at
// login/registration (session.user.shopifyCustomerId in authService.ts).
const CUSTOMER_ORDER_NODE_FIELDS = `
  id
  name
  processedAt
  displayFinancialStatus
  displayFulfillmentStatus
  cancelledAt
  cancelReason
  statusPageUrl
  totalPriceSet { shopMoney { amount currencyCode } }
  subtotalPriceSet { shopMoney { amount currencyCode } }
  totalShippingPriceSet { shopMoney { amount currencyCode } }
  totalTaxSet { shopMoney { amount currencyCode } }
  paymentGatewayNames
  shippingLines(first: 5) {
    edges { node { title } }
  }
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
  billingAddress {
    name
    address1
    address2
    city
    province
    country
    zip
    phone
  }
  fulfillments(first: 5) {
    displayStatus
    estimatedDeliveryAt
    trackingInfo(first: 3) {
      company
      number
      url
    }
  }
  lineItems(first: 20) {
    edges {
      node {
        title
        quantity
        vendor
        image { url }
        originalUnitPriceSet { shopMoney { amount currencyCode } }
        variant {
          id
          title
          product {
            handle
            title
          }
        }
      }
    }
  }
`;

const mapCustomerOrderNode = (node, creds) => {
  const addr = node.shippingAddress;
  const addressText = formatAddressLines(addr);
  const billingAddr = node.billingAddress;
  const billingText = formatAddressLines(billingAddr);
  const totalMoney = node.totalPriceSet?.shopMoney || {};
  const subtotalMoney = node.subtotalPriceSet?.shopMoney || totalMoney;
  const shippingMoney = node.totalShippingPriceSet?.shopMoney || {};
  const taxMoney = node.totalTaxSet?.shopMoney || {};
  const currency = totalMoney?.currencyCode || subtotalMoney?.currencyCode || creds?.currency || "";
  const currencySymbol = sharedCurrencySymbolForCode(currency);
  const financialStatus = node.displayFinancialStatus || "";
  const fulfillmentStatus = node.displayFulfillmentStatus || "";
  // Shopify's cancellation state is its own top-level `cancelledAt` field —
  // it isn't folded into displayFinancialStatus/displayFulfillmentStatus,
  // so a cancelled order can still read e.g. "PAID"/"UNFULFILLED" there.
  // This used to never be fetched at all, which is why an order Shopify
  // itself already shows as cancelled kept reporting cancellable:true here
  // and the app kept offering a "Cancel Order" button for it.
  const cancelledAt = node.cancelledAt || "";
  const isCancelled = !!cancelledAt;
  const paymentGatewayNames = Array.isArray(node.paymentGatewayNames) ? node.paymentGatewayNames.filter(Boolean) : [];
  const deliveryMethod = node.shippingLines?.edges?.find(({ node: line }) => line?.title)?.node?.title || "";
  const fulfillment = Array.isArray(node.fulfillments) ? node.fulfillments.find((f) => f?.estimatedDeliveryAt) || node.fulfillments[0] : null;
  const tracking = fulfillment?.trackingInfo?.find((t) => t?.number || t?.url) || null;
  return {
    id:             node.id,
    name:           node.name || "",
    orderNumber:    node.name || "",
    orderDate:      formatOrderDate(node.processedAt),
    placedAt:       node.processedAt || "",
    placedOn:       formatOrderDate(node.processedAt, "short"),
    status:         isCancelled ? "Cancelled" : formatOrderStatus(fulfillmentStatus, financialStatus),
    fulfillmentStatus,
    financialStatus,
    cancelledAt,
    cancelReason:   node.cancelReason || "",
    statusUrl:      node.statusPageUrl || "",
    deliveryMethod,
    shippingAddress: addr || null,
    address:        addressText,
    arrival:        fulfillment?.estimatedDeliveryAt ? formatOrderDate(fulfillment.estimatedDeliveryAt) : "",
    billingAddress: billingAddr || null,
    billing:        billingText || (addr ? "Same as delivery address" : ""),
    paymentMethod:  paymentGatewayNames.join(", "),
    paymentGatewayNames,
    payment:        paymentGatewayNames.join(", "),
    trackingNumber: tracking?.number || "",
    trackingUrl:    tracking?.url || "",
    trackingCompany: tracking?.company || "",
    delivery:       parseFloat(shippingMoney?.amount || 0),
    tax:            parseFloat(taxMoney?.amount || 0),
    subtotal:       parseFloat(subtotalMoney?.amount || totalMoney?.amount || 0),
    total:          parseFloat(totalMoney?.amount || 0),
    currencyCode:   currency,
    currencySymbol,
    cancellable:    !isCancelled && !["REFUNDED", "VOIDED"].includes(String(financialStatus).toUpperCase()),
    lineItems: (node.lineItems?.edges || []).map(({ node: li }) => {
      const unitMoney = li.originalUnitPriceSet?.shopMoney;
      return {
        id:            li.variant?.id || li.title,
        variantId:     li.variant?.id || "",
        handle:        li.variant?.product?.handle || "",
        title:         li.title || li.variant?.product?.title || "Product",
        vendor:        li.vendor || "",
        variant:       li.variant?.title || "",
        imageUrl:      li.image?.url || null,
        image:         li.image?.url || "",
        priceAmount:   parseFloat(unitMoney?.amount || 0),
        priceCurrency: unitMoney?.currencyCode || currency,
        price:         unitMoney
          ? formatSharedMoney(unitMoney.amount || 0, unitMoney.currencyCode || currency)
          : "",
        quantity:      li.quantity,
      };
    }),
  };
};

const DRAFT_ORDER_NODE_FIELDS = `
  id
  name
  status
  invoiceUrl
  createdAt
  updatedAt
  totalPriceSet { shopMoney { amount currencyCode } }
  subtotalPriceSet { shopMoney { amount currencyCode } }
  lineItems(first: 20) {
    edges {
      node {
        title
        quantity
        image { url }
        variant {
          id
          title
          product {
            handle
            title
          }
        }
      }
    }
  }
`;

// This app's own checkout goes through draftOrderCreate (see
// createDraftOrderCheckoutUrl) rather than a Storefront cart checkout — a
// shopper who never finishes Shopify's own invoice/payment step for that
// draft never gets a real Order at all, so customer(id:).orders (which only
// ever returns completed Order objects) can't see it. Mapped into the same
// shape fetchCustomerOrders already returns for real orders, so OrderHistory/
// OrderDetail render it identically — cancellable is always false (draft
// orders aren't cancelled through the order-cancel REST endpoint; they'd need
// draftOrderDelete, which isn't wired up here).
const mapDraftOrderNode = (node, creds) => {
  const totalMoney = node.totalPriceSet?.shopMoney || {};
  const subtotalMoney = node.subtotalPriceSet?.shopMoney || totalMoney;
  const currency = totalMoney?.currencyCode || subtotalMoney?.currencyCode || creds?.currency || "";
  const currencySymbol = sharedCurrencySymbolForCode(currency);
  return {
    id:             node.id,
    name:           node.name || "",
    orderNumber:    node.name || "",
    orderDate:      formatOrderDate(node.createdAt),
    placedAt:       node.createdAt || "",
    placedOn:       formatOrderDate(node.createdAt, "short"),
    status:         formatDraftOrderStatus(node.status),
    isDraftOrder:   true,
    statusUrl:      node.invoiceUrl || "",
    deliveryMethod: "",
    shippingAddress: null,
    address:        "",
    arrival:        "",
    billingAddress: null,
    billing:        "",
    paymentMethod:  "",
    paymentGatewayNames: [],
    payment:        "",
    delivery:       0,
    tax:            0,
    subtotal:       parseFloat(subtotalMoney?.amount || 0),
    total:          parseFloat(totalMoney?.amount || 0),
    currencyCode:   currency,
    currencySymbol,
    cancellable:    false,
    lineItems: (node.lineItems?.edges || []).map(({ node: li }) => ({
      id:            li.variant?.id || li.title,
      variantId:     li.variant?.id || "",
      handle:        li.variant?.product?.handle || "",
      title:         li.title || li.variant?.product?.title || "Product",
      vendor:        "",
      variant:       li.variant?.title || "",
      imageUrl:      li.image?.url || null,
      image:         li.image?.url || "",
      priceAmount:   0,
      priceCurrency: currency,
      price:         "",
      quantity:      li.quantity,
    })),
  };
};

async function fetchCustomerDraftOrders({ shop, token, storeId, customerGid, first, creds }) {
  const numericCustomerId = extractShopifyNumericId(customerGid);
  if (!numericCustomerId) return [];
  try {
    const json = await directStorefrontGraphQL({
      shop, token, storeId,
      query: `
        query CustomerDraftOrders($searchQuery: String!, $first: Int!) {
          draftOrders(first: $first, query: $searchQuery, reverse: true) {
            edges { node { ${DRAFT_ORDER_NODE_FIELDS} } }
          }
        }
      `,
      variables: { searchQuery: `customer_id:${numericCustomerId}`, first },
      accessType: "draft_orders",
      accessFields: "name,email,phone,address",
    });
    if (json?.errors) {
      console.error("❌ Customer Draft Orders GraphQL errors:", json.errors);
      return [];
    }
    return (json?.data?.draftOrders?.edges || [])
      .map(({ node }) => node)
      // COMPLETED drafts have already become a real Order (returned by the
      // customer(id:).orders query above) — showing both would duplicate the
      // same purchase. CANCELLED ones were abandoned, not worth surfacing.
      .filter((node) => !["COMPLETED", "CANCELLED"].includes(String(node.status || "").toUpperCase()))
      .map((node) => mapDraftOrderNode(node, creds));
  } catch (err) {
    console.error("❌ fetchCustomerDraftOrders error:", err);
    return [];
  }
}

export async function fetchCustomerOrders({ customerId, customerAccessToken, email, first = 10 } = {}) {
  const creds = await getShopifyCredentials();
  const { shop, token, storeId } = creds;

  const resolvedCustomerId = customerId || customerAccessToken;
  let customerGid = resolvedCustomerId
    ? (String(resolvedCustomerId).startsWith("gid://")
        ? String(resolvedCustomerId)
        : `gid://shopify/Customer/${resolvedCustomerId}`)
    : null;

  // Only `customer(id:).orders` is reachable without Shopify's "Protected
  // customer data" approval — a root-level `orders(query: "email:...")` (or
  // `customers(query: "email:...")` search that RETURNS protected fields)
  // is a shop-wide search and gets ACCESS_DENIED ("not approved to access
  // the Order object") on any store that hasn't been granted that access
  // level. Requesting only `id` back from a `customers` search stays within
  // what's allowed (id isn't protected data) and is how accounts logged in
  // before shopifyCustomerId was captured (see authService.ts) still get a
  // usable GID to feed into the one query that's actually permitted.
  if (!customerGid && email) {
    try {
      const lookupJson = await directStorefrontGraphQL({
        shop, token, storeId,
        query: `
          query CustomerByEmail($query: String!) {
            customers(first: 1, query: $query) {
              edges { node { id } }
            }
          }
        `,
        variables: { query: `email:"${email}"` },
        accessType: "customer_lookup",
        accessFields: "email",
      });
      if (lookupJson?.errors) {
        console.error("❌ fetchCustomerOrders email lookup GraphQL errors:", lookupJson.errors);
      }
      customerGid = lookupJson?.data?.customers?.edges?.[0]?.node?.id || null;
    } catch (err) {
      console.error("❌ fetchCustomerOrders email lookup error:", err);
    }
  }

  if (!customerGid) return { orders: [] };

  let orders = [];
  try {
    const json = await directStorefrontGraphQL({
      shop, token, storeId,
      query: `
        query CustomerOrders($customerId: ID!, $first: Int!) {
          customer(id: $customerId) {
            orders(first: $first, reverse: true) {
              edges { node { ${CUSTOMER_ORDER_NODE_FIELDS} } }
            }
          }
        }
      `,
      variables: { customerId: customerGid, first },
      accessType: "customer_orders",
      accessFields: "name,email,phone,address",
    });

    if (json?.errors) {
      console.error("❌ Customer Orders GraphQL errors:", json.errors);
    } else {
      orders = (json?.data?.customer?.orders?.edges || [])
        .map(({ node }) => mapCustomerOrderNode(node, creds));
    }
  } catch (err) {
    console.error("❌ fetchCustomerOrders error:", err);
  }

  const draftOrders = await fetchCustomerDraftOrders({ shop, token, storeId, customerGid, first, creds });

  const merged = [...orders, ...draftOrders].sort(
    (a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0)
  );

  return { orders: merged };
}

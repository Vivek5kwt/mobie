import { resolveAppId } from '../utils/appId';

const GRAPHQL_ENDPOINT = 'https://app.mobidrag.com/graphql';

// ── Queries ────────────────────────────────────────────────────────────────

// Step 1: resolve storeId from the layouts for this appId
const LAYOUTS_STORE_ID_QUERY = `
  query Layouts($appId: Int) {
    layouts(app_id: $appId) {
      store_id
    }
  }
`;

// Step 2: fetch full store config using the resolved storeId
const GET_STORE_QUERY = `
  query GetStore($storeId: Int!) {
    getStore(store_id: $storeId) {
      id
      user_id
      shopify_domain
      access_token
      storefront_access_token
      shop_name
      shop_owner
      currency
      timezone
      country
      plan_name
      status
      onboarding
      created_at
      updated_at
    }
  }
`;

// ── Cache ──────────────────────────────────────────────────────────────────

let _cache = null;
let _cacheAppId = null;   // track which appId the cache belongs to
let _inflight = null;

// ── Helpers ────────────────────────────────────────────────────────────────

async function graphqlFetch(query, variables) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Fetches store config dynamically for the current app:
 *   1. Resolves appId from app.json / env / default
 *   2. Queries layouts(app_id) to get store_id
 *   3. Queries getStore(store_id) for full credentials
 *
 * Result is cached for the lifetime of the session.
 */
export async function fetchStoreConfig() {
  const appId = resolveAppId();
  // Invalidate cache if appId changed since last fetch
  if (_cache && _cacheAppId !== appId) {
    _cache = null;
    _cacheAppId = null;
  }
  if (_cache) return _cache;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      console.log(`🏪 Fetching store config for appId: ${appId}`);

      // Step 1 — resolve storeId from layouts
      const layoutsJson = await graphqlFetch(LAYOUTS_STORE_ID_QUERY, { appId });

      if (layoutsJson.errors) {
        console.warn('⚠️ Layouts query errors:', layoutsJson.errors);
      }

      const layouts = layoutsJson?.data?.layouts;
      const storeId = Array.isArray(layouts) && layouts.length > 0
        ? Number(layouts[0]?.store_id)
        : null;

      if (!storeId || !Number.isFinite(storeId)) {
        console.warn(`⚠️ Could not resolve storeId from layouts for appId ${appId}`);
        return null;
      }

      console.log(`🏪 Resolved storeId: ${storeId} — fetching store config...`);

      // Step 2 — fetch store config using resolved storeId
      const storeJson = await graphqlFetch(GET_STORE_QUERY, { storeId });

      if (storeJson.errors || !storeJson.data?.getStore) {
        console.warn('⚠️ GetStore query failed:', storeJson.errors);
        return null;
      }

      _cache = storeJson.data.getStore;
      _cacheAppId = appId;
      console.log(`✅ Store loaded: ${_cache.shop_name} (${_cache.shopify_domain})`);
      console.log(`   currency: ${_cache.currency} | country: ${_cache.country} | status: ${_cache.status}`);
      return _cache;

    } catch (err) {
      console.error('❌ fetchStoreConfig error:', err.message);
      return null;
    } finally {
      _inflight = null;
    }
  })();

  return _inflight;
}

/** Synchronous read of already-fetched cache. Returns null if not yet loaded. */
export function getStoreConfigSync() {
  return _cache;
}

/** Clear cache — call this if appId changes at runtime */
export function clearStoreCache() {
  _cache = null;
  _cacheAppId = null;
}

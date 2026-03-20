import { resolveAppId } from '../utils/appId';

const GRAPHQL_ENDPOINT = 'https://mobidrag.ampleteck.com/graphql';
export const STORE_ID = 20; // static store ID

const GET_STORE_QUERY = `
  query GetStore($storeId: Int!, $appId: Int) {
    getStore(store_id: $storeId, app_id: $appId) {
      user_id
      updated_at
      timezone
      storefront_access_token
      status
      shopify_domain
      shop_owner
      shop_name
      plan_name
      onboarding
      id
      currency
      created_at
      country
      access_token
    }
  }
`;

let _cache = null;
let _inflight = null;

/**
 * Fetch store config from GetStore query.
 * Uses dynamic appId from app.json (written by CI) and static storeId = 20.
 * Result is cached for the lifetime of the app session.
 */
export async function fetchStoreConfig() {
  if (_cache) return _cache;
  if (_inflight) return _inflight;

  _inflight = (async () => {
    try {
      const appId = resolveAppId();
      console.log(`🏪 Fetching store config — appId: ${appId}, storeId: ${STORE_ID}`);

      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: GET_STORE_QUERY,
          variables: { storeId: STORE_ID, appId },
        }),
      });

      const json = await response.json();

      if (json.errors || !json.data?.getStore) {
        console.warn('⚠️ GetStore failed:', json.errors);
        return null;
      }

      _cache = json.data.getStore;
      console.log(`✅ Store loaded: ${_cache.shop_name} (${_cache.shopify_domain})`);
      return _cache;
    } catch (err) {
      console.error('❌ fetchStoreConfig error:', err);
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

export function clearStoreCache() {
  _cache = null;
}

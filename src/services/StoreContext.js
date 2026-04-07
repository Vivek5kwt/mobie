import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchStoreConfig } from './storeService';

const StoreContext = createContext(null);

/**
 * Fetches GetStore on mount and makes store credentials available
 * to the entire component tree via useStore().
 */
export function StoreProvider({ children }) {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStoreConfig()
      .then(setStore)
      .finally(() => setLoading(false));
  }, []);

  return (
    <StoreContext.Provider value={{ store, loading }}>
      {children}
    </StoreContext.Provider>
  );
}

/**
 * Returns { store, loading } where store is the full getStore response.
 * Convenience getters:
 *   shopifyDomain      → store.shopify_domain
 *   storefrontToken    → store.storefront_access_token
 */
export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>');
  const { store, loading } = ctx;
  return {
    store,
    loading,
    // Shopify credentials
    shopifyDomain:    store?.shopify_domain              ?? null,
    storefrontToken:  store?.storefront_access_token     ?? null,
    accessToken:      store?.access_token                ?? null,
    // Store identity
    storeId:          store?.id                          ?? null,
    userId:           store?.user_id                     ?? null,
    shopName:         store?.shop_name                   ?? null,
    shopOwner:        store?.shop_owner                  ?? null,
    // Locale / commerce
    currency:         store?.currency                    ?? null,
    country:          store?.country                     ?? null,
    timezone:         store?.timezone                    ?? null,
    // Status
    storeStatus:      store?.status                      ?? null,
    planName:         store?.plan_name                   ?? null,
    onboarding:       store?.onboarding                  ?? null,
  };
}

export default StoreProvider;

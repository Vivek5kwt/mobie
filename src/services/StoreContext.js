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
    shopifyDomain: store?.shopify_domain ?? null,
    storefrontToken: store?.storefront_access_token ?? null,
    shopName: store?.shop_name ?? null,
    currency: store?.currency ?? null,
    country: store?.country ?? null,
    storeStatus: store?.status ?? null,
  };
}

export default StoreProvider;

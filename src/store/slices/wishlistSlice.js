import { createSlice } from "@reduxjs/toolkit";

const GUEST_WISHLIST_USER_KEY = "guest";

export const normalizeWishlistKey = (value) => String(value || "").trim();

const normalizeWishlistUserKeyPart = (value) => normalizeWishlistKey(value).toLowerCase();

export const getWishlistUserKey = (sessionOrUser = null) => {
  const user = sessionOrUser?.user || sessionOrUser || {};
  const scope = normalizeWishlistUserKeyPart(
    user.appId || user.storeId || user.shopifyDomain || user.shopName || "default"
  );
  const identity = normalizeWishlistUserKeyPart(
    user.id ||
      user.shopifyCustomerId ||
      user.email
  );

  return identity ? `${scope}:${identity}` : GUEST_WISHLIST_USER_KEY;
};

export const getWishlistKeys = (product = {}) =>
  [
    product.id,
    product.variantId,
    product.adminGraphqlApiId,
    product.graphqlId,
    product.handle,
    product.productHandle,
    product.title,
    product.name,
  ]
    .map(normalizeWishlistKey)
    .filter(Boolean);

export const getWishlistIdentityKeys = (product = {}) =>
  [
    product.id,
    product.variantId,
    product.adminGraphqlApiId,
    product.graphqlId,
    product.handle,
    product.productHandle,
  ]
    .map(normalizeWishlistKey)
    .filter(Boolean);

export const wishlistProductsMatch = (left = {}, right = {}) => {
  const leftIdentity = getWishlistIdentityKeys(left);
  const rightIdentity = getWishlistIdentityKeys(right);
  if (leftIdentity.length && rightIdentity.length) {
    return leftIdentity.some((key) => rightIdentity.includes(key));
  }
  const leftKeys = getWishlistKeys(left);
  const rightKeys = getWishlistKeys(right);
  return leftKeys.some((key) => rightKeys.includes(key));
};

export const isWishlistProduct = (wishlistItems = [], product = {}) => {
  const keys = getWishlistKeys(product);
  if (!keys.length) return false;
  return wishlistItems.some((item) => wishlistProductsMatch(item, product));
};

export const dedupeWishlistProducts = (wishlistItems = []) => {
  let changed = false;
  const deduped = wishlistItems.filter((item, index, items) => {
    const keep = !!item && items.findIndex((candidate) => wishlistProductsMatch(candidate, item)) === index;
    if (!keep) changed = true;
    return keep;
  });
  return changed ? deduped : wishlistItems;
};

export const buildWishlistProduct = (product = {}) => {
  const keys = getWishlistKeys(product);
  const id = keys[0] || "";
  if (!id) return null;
  const image = product.image || product.imageUrl || product.featuredImage || "";
  const price = product.price ?? product.priceAmount ?? product.salePrice ?? 0;
  const compareAtPrice =
    product.compareAtPrice ??
    product.originalPrice ??
    product.standardPrice ??
    product.compareAtPriceAmount ??
    0;
  const currency = product.currency || product.priceCurrency || product.currencyCode || "";

  return {
    id,
    variantId: product.variantId || "",
    title: product.title || product.name || product.titleText || "Product",
    image,
    imageUrl: product.imageUrl || image,
    price,
    priceAmount: price,
    compareAtPrice,
    originalPrice: compareAtPrice,
    currency,
    priceCurrency: currency,
    handle: product.handle || product.productHandle || "",
    vendor: product.vendor || product.vendorText || product.shop || "",
  };
};

const normalizeWishlistItems = (items = []) => dedupeWishlistProducts(Array.isArray(items) ? items.filter(Boolean) : []);

const ensureWishlistBuckets = (state) => {
  if (!state.itemsByUser || typeof state.itemsByUser !== "object" || Array.isArray(state.itemsByUser)) {
    state.itemsByUser = {};
  }
  if (!state.activeUserKey) {
    state.activeUserKey = GUEST_WISHLIST_USER_KEY;
  }
};

const getActionWishlistUserKey = (payload = {}, fallback = GUEST_WISHLIST_USER_KEY) => {
  if (payload.userKey) return payload.userKey;
  if (payload.session || payload.user) return getWishlistUserKey(payload.session || payload.user);
  return fallback;
};

const activateWishlistUser = (state, nextUserKey) => {
  ensureWishlistBuckets(state);
  const prevUserKey = state.activeUserKey || GUEST_WISHLIST_USER_KEY;
  const legacyItems = normalizeWishlistItems(state.items);
  const targetItems = normalizeWishlistItems(state.itemsByUser[nextUserKey] || []);

  // Seed the target bucket only when it's still empty:
  //   • from the legacy flat `items` array on the very first bucket migration
  //     (older persisted state that predates per-user buckets), OR
  //   • from the guest bucket when a guest signs in — carry the products they
  //     saved while logged out into their account instead of abandoning them.
  // Without the guest carry-over, the header wishlist badge (reads state.items
  // before login) stayed at e.g. "2" while the Wishlist screen (reads the
  // now-active, empty user bucket after the login redirect) showed the empty
  // state — the "badge count vs. actual items" mismatch.
  if (!targetItems.length) {
    const isGuestSignIn =
      prevUserKey === GUEST_WISHLIST_USER_KEY && nextUserKey !== GUEST_WISHLIST_USER_KEY;
    const guestItems = isGuestSignIn
      ? normalizeWishlistItems(state.itemsByUser[GUEST_WISHLIST_USER_KEY] || [])
      : [];
    // The legacy flat `items` array is only a valid seed on the very first
    // migration, before any per-user bucket exists — never copy it across when
    // another account already has a bucket (that would leak one user's list
    // into another's).
    const anyBucketHasItems = Object.values(state.itemsByUser).some(
      (items) => Array.isArray(items) && items.length > 0
    );
    const seed = guestItems.length
      ? guestItems
      : anyBucketHasItems
        ? []
        : legacyItems;
    if (seed.length) {
      state.itemsByUser[nextUserKey] = seed;
      // Empty the guest bucket so the same items can't later be carried into a
      // different account (or double-counted).
      if (isGuestSignIn) {
        state.itemsByUser[GUEST_WISHLIST_USER_KEY] = [];
      }
    }
  }

  const nextItems = normalizeWishlistItems(state.itemsByUser[nextUserKey] || []);
  state.activeUserKey = nextUserKey;
  state.itemsByUser[nextUserKey] = nextItems;
  state.items = nextItems;
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: {
    items: [],
    activeUserKey: GUEST_WISHLIST_USER_KEY,
    itemsByUser: {
      [GUEST_WISHLIST_USER_KEY]: [],
    },
  },
  reducers: {
    setWishlistUser(state, action) {
      const nextUserKey = getActionWishlistUserKey(action.payload || {}, GUEST_WISHLIST_USER_KEY);
      activateWishlistUser(state, nextUserKey);
    },
    toggleWishlist(state, action) {
      ensureWishlistBuckets(state);
      const payload = action.payload || {};
      const product = action.payload?.product || {};
      const wishlistProduct = buildWishlistProduct(product);
      if (!wishlistProduct) return;
      const userKey = getActionWishlistUserKey(payload, state.activeUserKey || GUEST_WISHLIST_USER_KEY);
      if (state.activeUserKey !== userKey) {
        activateWishlistUser(state, userKey);
      }

      const currentItems = normalizeWishlistItems(state.itemsByUser[userKey] || state.items);
      const existing = currentItems.filter((p) => wishlistProductsMatch(p, product));
      let nextItems;
      if (existing.length) {
        nextItems = currentItems.filter((p) => !wishlistProductsMatch(p, product));
      } else {
        nextItems = dedupeWishlistProducts([...currentItems, wishlistProduct]);
      }
      state.itemsByUser[userKey] = nextItems;
      state.items = nextItems;
    },
    clearWishlist(state, action) {
      ensureWishlistBuckets(state);
      const userKey = getActionWishlistUserKey(action.payload || {}, state.activeUserKey || GUEST_WISHLIST_USER_KEY);
      state.itemsByUser[userKey] = [];
      if (state.activeUserKey === userKey) {
        state.items = [];
      }
    },
    clearAllWishlists(state) {
      state.items = [];
      state.itemsByUser = {
        [GUEST_WISHLIST_USER_KEY]: [],
      };
      state.activeUserKey = GUEST_WISHLIST_USER_KEY;
    },
  },
});

export const { setWishlistUser, toggleWishlist, clearWishlist, clearAllWishlists } = wishlistSlice.actions;
export default wishlistSlice.reducer;

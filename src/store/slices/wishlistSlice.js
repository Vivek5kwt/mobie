import { createSlice } from "@reduxjs/toolkit";

export const normalizeWishlistKey = (value) => String(value || "").trim();

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

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: {
    items: [],
  },
  reducers: {
    toggleWishlist(state, action) {
      const product = action.payload?.product || {};
      const wishlistProduct = buildWishlistProduct(product);
      if (!wishlistProduct) return;
      const idx = state.items.findIndex((p) => {
        return wishlistProductsMatch(p, product);
      });
      if (idx >= 0) {
        state.items.splice(idx, 1);
      } else {
        state.items.push(wishlistProduct);
      }
    },
    clearWishlist(state) {
      state.items = [];
    },
  },
});

export const { toggleWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

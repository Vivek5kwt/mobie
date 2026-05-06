import { createSlice } from "@reduxjs/toolkit";

const normalizeId = (value) => String(value || "").trim();

const getWishlistKeys = (product = {}) =>
  [
    product.id,
    product.variantId,
    product.handle,
    product.title,
  ]
    .map(normalizeId)
    .filter(Boolean);

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: {
    items: [],
  },
  reducers: {
    toggleWishlist(state, action) {
      const product = action.payload?.product || {};
      const keys = getWishlistKeys(product);
      const id = keys[0] || "";
      if (!id) return;
      const idx = state.items.findIndex((p) => {
        const existingKeys = getWishlistKeys(p);
        return existingKeys.some((key) => keys.includes(key));
      });
      if (idx >= 0) {
        state.items.splice(idx, 1);
      } else {
        state.items.push({
          id,
          title: product.title || "Product",
          image: product.image || product.imageUrl || "",
          price: product.price ?? product.priceAmount ?? 0,
          compareAtPrice: product.compareAtPrice ?? product.originalPrice ?? 0,
          currency: product.currency || product.priceCurrency || "",
          handle: product.handle || "",
          vendor: product.vendor || "",
        });
      }
    },
    clearWishlist(state) {
      state.items = [];
    },
  },
});

export const { toggleWishlist, clearWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;

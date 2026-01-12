import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
};

const normalizeId = (item = {}) =>
  String(item.id || item.variantId || item.handle || item.title || "").trim();

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem(state, action) {
      const item = action.payload?.item || {};
      const id = normalizeId(item);
      if (!id) return;

      const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
      const existing = state.items.find((entry) => normalizeId(entry) === id);

      if (existing) {
        existing.quantity = Math.max(1, (existing.quantity || 0) + quantity);
      } else {
        state.items.push({
          id,
          title: item.title || "Product",
          image: item.image || "",
          price: item.price ?? 0,
          variant: item.variant || "",
          currency: item.currency || "",
          quantity: Math.max(1, quantity),
        });
      }
    },
    updateQuantity(state, action) {
      const { id, quantity } = action.payload || {};
      const normalizedId = normalizeId({ id });
      const target = state.items.find((entry) => normalizeId(entry) === normalizedId);
      if (!target) return;

      const nextQuantity = Number.isFinite(quantity) ? quantity : target.quantity;
      if (nextQuantity <= 0) {
        state.items = state.items.filter((entry) => normalizeId(entry) !== normalizedId);
      } else {
        target.quantity = nextQuantity;
      }
    },
    removeItem(state, action) {
      const normalizedId = normalizeId({ id: action.payload?.id });
      if (!normalizedId) return;
      state.items = state.items.filter((entry) => normalizeId(entry) !== normalizedId);
    },
    clearCart(state) {
      state.items = [];
    },
  },
});

export const { addItem, updateQuantity, removeItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

import { createSlice } from "@reduxjs/toolkit";
import { normalizeDiscountCode, normalizeDiscountRecord } from "../../utils/cartDiscounts";

const initialState = {
  items: [],
  discounts: [],
};

const normalizeId = (item = {}) =>
  String(item.id || item.variantId || item.handle || item.title || "").trim();

const toPositiveNumber = (value, fallback = 0) => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addItem(state, action) {
      const item = action.payload?.item || {};
      const id = normalizeId(item);
      if (!id) return;

      const quantity = toPositiveNumber(item.quantity, 1);
      const nextPrice = toPositiveNumber(item.price, 0);
      const nextCompareAtPrice = toPositiveNumber(item.compareAtPrice ?? item.originalPrice, 0);
      const existing = state.items.find((entry) => normalizeId(entry) === id);

      if (existing) {
        existing.quantity = Math.max(1, (existing.quantity || 0) + quantity);
        existing.title = existing.title && existing.title !== "Product" ? existing.title : item.title || "Product";
        existing.image = existing.image || item.image || item.imageUrl || "";
        existing.handle = existing.handle || item.handle || "";
        existing.vendor = existing.vendor || item.vendor || "";
        existing.variant = existing.variant || item.variant || "";
        existing.currency = existing.currency || item.currency || "";
        if (nextPrice > 0) existing.price = nextPrice;
        else existing.price = existing.price ?? item.price ?? 0;
        if (nextCompareAtPrice > 0) existing.compareAtPrice = nextCompareAtPrice;
        else existing.compareAtPrice = existing.compareAtPrice || item.compareAtPrice || item.originalPrice || 0;
      } else {
        state.items.push({
          id,
          variantId: item.variantId || "",
          handle: item.handle || "",
          title: item.title || "Product",
          image: item.image || "",
          price: nextPrice || item.price || 0,
          compareAtPrice: nextCompareAtPrice || item.compareAtPrice || item.originalPrice || 0,
          vendor: item.vendor || "",
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

      const nextQuantity = toFiniteNumber(quantity, target.quantity);
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
      state.discounts = [];
    },
    applyDiscount(state, action) {
      const discount = normalizeDiscountRecord(action.payload?.discount || action.payload || {});
      const code = normalizeDiscountCode(discount.code);
      if (!code) return;
      if (!state.discounts) state.discounts = [];
      state.discounts = state.discounts.filter(
        (entry) => normalizeDiscountCode(entry?.code || entry) !== code
      );
      state.discounts.push({ ...discount, code });
    },
    setDiscounts(state, action) {
      const discounts = Array.isArray(action.payload?.discounts)
        ? action.payload.discounts
        : [];
      state.discounts = discounts
        .map(normalizeDiscountRecord)
        .filter((entry) => entry.code && entry.applicable === true);
    },
    removeDiscount(state, action) {
      const code = normalizeDiscountCode(action.payload?.code);
      if (!state.discounts) return;
      state.discounts = state.discounts.filter(
        (entry) => normalizeDiscountCode(entry?.code || entry) !== code
      );
    },
  },
});

export const {
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
  applyDiscount,
  setDiscounts,
  removeDiscount,
} = cartSlice.actions;
export default cartSlice.reducer;

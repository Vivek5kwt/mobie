import {
  trackAddToCart,
  trackRemoveFromCart,
  trackWishlistChange,
} from "../services/analyticsService";

const normalizeKey = (value) => String(value || "").trim();

const productKeys = (product = {}) =>
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
    .map(normalizeKey)
    .filter(Boolean);

const productsMatch = (left = {}, right = {}) => {
  const leftKeys = productKeys(left);
  const rightKeys = productKeys(right);
  if (!leftKeys.length || !rightKeys.length) return false;
  return leftKeys.some((key) => rightKeys.includes(key));
};

const findCartItem = (state, id) =>
  (state?.cart?.items || []).find((item) => normalizeKey(item?.id || item?.variantId) === normalizeKey(id));

const findWishlistItem = (state, product) =>
  (state?.wishlist?.items || []).find((item) => productsMatch(item, product));

const analyticsMiddleware = (storeApi) => (next) => (action) => {
  const prevState = storeApi.getState();
  const result = next(action);
  const nextState = storeApi.getState();

  try {
    switch (action?.type) {
      case "cart/addItem": {
        const item = action?.payload?.item || {};
        trackAddToCart(item);
        break;
      }
      case "cart/removeItem": {
        const removed = findCartItem(prevState, action?.payload?.id);
        if (removed) trackRemoveFromCart(removed);
        break;
      }
      case "cart/updateQuantity": {
        const previous = findCartItem(prevState, action?.payload?.id);
        const current = findCartItem(nextState, action?.payload?.id);
        if (previous && (!current || Number(current.quantity || 0) < Number(previous.quantity || 0))) {
          trackRemoveFromCart({
            ...previous,
            quantity: current ? Number(previous.quantity || 1) - Number(current.quantity || 0) : previous.quantity,
          });
        }
        break;
      }
      case "wishlist/toggleWishlist": {
        const product = action?.payload?.product || {};
        const wasInWishlist = !!findWishlistItem(prevState, product);
        const isInWishlist = !!findWishlistItem(nextState, product);
        if (wasInWishlist !== isInWishlist) {
          trackWishlistChange(product, isInWishlist);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.log("Analytics middleware failed:", error?.message || String(error));
  }

  return result;
};

export default analyticsMiddleware;

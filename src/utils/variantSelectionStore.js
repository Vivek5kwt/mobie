// Shared pub-sub store that lets VariantSelector (color/size picker) tell
// AddToCart (and any other sibling block) which exact Shopify variant is
// currently selected. The two blocks are independent DSL sections on the
// same screen with no parent-child prop relationship (see
// DynamicRenderer.js), so cross-block communication needs a shared store —
// mirrors the currencyStore.js / cartStore.js convention (DeviceEventEmitter
// pub-sub) used elsewhere in this app.
//
// Keyed per-product (handle or id) since a shopper can navigate between
// different product screens within the same app session and a selection
// made on one product must never leak into another.
import { DeviceEventEmitter } from "react-native";

const EVENT = "mobidrag:variantSelectionChanged";

let selections = {};

// productKey: string (product handle or id)
// variant: the raw Shopify variant node — { id, title, availableForSale,
//   selectedOptions, price, compareAtPrice, image } — or null.
export function setVariantSelection(productKey, variant) {
  if (!productKey) return;
  selections = { ...selections, [productKey]: variant || null };
  DeviceEventEmitter.emit(EVENT, productKey);
}

export function getVariantSelection(productKey) {
  if (!productKey) return null;
  return selections[productKey] || null;
}

// fn receives the productKey that changed, so subscribers can ignore
// updates for a different product.
export function subscribeVariantSelection(fn) {
  const sub = DeviceEventEmitter.addListener(EVENT, fn);
  return () => sub.remove();
}

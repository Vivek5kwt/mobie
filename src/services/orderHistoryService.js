import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "@mobidrag_order_history:v1";
const MAX_ORDERS = 30;

const keyPart = (value) =>
  encodeURIComponent(String(value || "guest").trim().toLowerCase() || "guest");

export const getOrderHistoryKey = ({ appId, userId, email } = {}) =>
  `${KEY_PREFIX}:${keyPart(appId)}:${keyPart(userId || email || "guest")}`;

const orderIdentity = (order = {}) =>
  String(order.id || order.orderNumber || order.name || order.statusUrl || "").trim();

const orderTimestamp = (order = {}) => {
  const raw = order.placedAt || order.processedAt || order.createdAt || order.orderDate || "";
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

export const getStoredOrders = async ({ appId, userId, email } = {}) => {
  try {
    const raw = await AsyncStorage.getItem(getOrderHistoryKey({ appId, userId, email }));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

export const saveCompletedOrder = async ({ appId, userId, email, order } = {}) => {
  if (!order) return [];
  try {
    const key = getOrderHistoryKey({ appId, userId, email });
    const existingRaw = await AsyncStorage.getItem(key);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const id = orderIdentity(order);
    const next = [
      order,
      ...list.filter((item) => {
        const itemId = orderIdentity(item);
        return id ? itemId !== id : item !== order;
      }),
    ]
      .sort((a, b) => orderTimestamp(b) - orderTimestamp(a))
      .slice(0, MAX_ORDERS);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch (_) {
    return [];
  }
};

export const mergeOrdersByIdentity = (...groups) => {
  const seen = new Set();
  const merged = [];
  groups.flat().filter(Boolean).forEach((order) => {
    const id = orderIdentity(order) || JSON.stringify(order);
    if (seen.has(id)) return;
    seen.add(id);
    merged.push(order);
  });
  return merged.sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
};

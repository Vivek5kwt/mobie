import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SEARCH_HISTORY_KEY = "mobidrag:searchHistory:v1";
export const SEARCH_HISTORY_CHANGED_EVENT = "mobidrag:search:historyChanged";

const normalizeSearchTerm = (value) => {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 2) return "";
  return text;
};

const readSearchHistory = async () => {
  const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const recordUserSearchTerm = async (term, { maxItems = 30 } = {}) => {
  const text = normalizeSearchTerm(term);
  if (!text) return [];

  const now = Date.now();
  const key = text.toLowerCase();
  const history = await readSearchHistory();
  const existing = history.find((item) => String(item?.key || "").toLowerCase() === key);
  let next;

  if (existing) {
    next = history.map((item) =>
      String(item?.key || "").toLowerCase() === key
        ? {
            ...item,
            text,
            query: text,
            count: (Number(item.count) || 0) + 1,
            lastSearchedAt: now,
          }
        : item
    );
  } else {
    next = [
      {
        key,
        text,
        query: text,
        count: 1,
        lastSearchedAt: now,
      },
      ...history,
    ];
  }

  next = next
    .filter((item) => normalizeSearchTerm(item?.text || item?.query))
    .sort((a, b) => {
      const recentDiff = (Number(b.lastSearchedAt) || 0) - (Number(a.lastSearchedAt) || 0);
      if (recentDiff !== 0) return recentDiff;
      return (Number(b.count) || 0) - (Number(a.count) || 0);
    })
    .slice(0, Math.max(1, Number(maxItems) || 30));

  await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  DeviceEventEmitter.emit(SEARCH_HISTORY_CHANGED_EVENT, { term: text });
  return next;
};

export const fetchUserSearchTerms = async (limit = 6) => {
  const safeLimit = Math.max(1, Number(limit) || 6);
  const history = await readSearchHistory();
  return history
    .filter((item) => normalizeSearchTerm(item?.text || item?.query))
    .sort((a, b) => {
      const countDiff = (Number(b.count) || 0) - (Number(a.count) || 0);
      if (countDiff !== 0) return countDiff;
      return (Number(b.lastSearchedAt) || 0) - (Number(a.lastSearchedAt) || 0);
    })
    .slice(0, safeLimit)
    .map((item) => {
      const text = normalizeSearchTerm(item.text || item.query);
      return {
        text,
        query: normalizeSearchTerm(item.query || item.text) || text,
        source: "history",
      };
    });
};

// Shared sort + filter store for the mobile app — mirrors builder's
// blocks/sortFilterStore.ts: FilterSortHeader writes; ProductGrid (and any
// other block) reads. Uses this app's existing DeviceEventEmitter + AsyncStorage
// pub-sub convention (see services/searchHistoryService.js) instead of
// localStorage, since RN has no synchronous storage equivalent.
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ab:sortFilter:state:v1";
export const SORT_FILTER_CHANGED_EVENT = "mobidrag:sortFilter:changed";

let _snapshot = { sortOption: "Best Selling", selectedFilters: [] };
let _hydrated = false;

export function getSortFilterSnapshot() {
  return _snapshot;
}

export function subscribeSortFilter(fn) {
  const sub = DeviceEventEmitter.addListener(SORT_FILTER_CHANGED_EVENT, fn);
  return () => sub.remove();
}

export async function hydrateSortFilterFromStorage() {
  if (_hydrated) return;
  _hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const sortOption =
      typeof parsed?.sortOption === "string" ? parsed.sortOption : _snapshot.sortOption;
    const selectedFilters = Array.isArray(parsed?.selectedFilters)
      ? parsed.selectedFilters
      : _snapshot.selectedFilters;
    if (
      sortOption !== _snapshot.sortOption ||
      selectedFilters.join("|") !== _snapshot.selectedFilters.join("|")
    ) {
      _snapshot = { sortOption, selectedFilters };
      DeviceEventEmitter.emit(SORT_FILTER_CHANGED_EVENT);
    }
  } catch {
    // Ignore corrupt/missing storage — keep the in-memory default.
  }
}

export function setSortFilterState(next) {
  const sortOption = next?.sortOption ?? _snapshot.sortOption;
  const selectedFilters = next?.selectedFilters ?? _snapshot.selectedFilters;
  if (sortOption === _snapshot.sortOption && selectedFilters === _snapshot.selectedFilters) return;
  _snapshot = { sortOption, selectedFilters };
  DeviceEventEmitter.emit(SORT_FILTER_CHANGED_EVENT);
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_snapshot)).catch(() => {});
}

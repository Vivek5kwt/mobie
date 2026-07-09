// components/FilterSortHeader.js
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";

const SORT_OPTIONS = ["Popular", "Newest", "Price: Low", "Price: High"];

function resolveProp(obj, key, fallback) {
  if (!obj) return fallback;
  const raw = obj[key];
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw.value !== undefined ? raw.value : fallback;
  }
  return raw;
}

function resolveBoolProp(obj, key, fallback = false) {
  const value = resolveProp(obj, key, undefined);
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return fallback;
}

function resolveNumberProp(obj, key, fallback) {
  const value = resolveProp(obj, key, undefined);
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveWeight(value, fallback = "500") {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return String(value);
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "bold") return "700";
  if (normalized === "semibold" || normalized === "semi bold") return "600";
  if (normalized === "medium") return "500";
  if (normalized === "regular" || normalized === "normal") return "400";
  return /^\d+$/.test(normalized) ? normalized : fallback;
}

function hasResolvedProp(obj, key) {
  return resolveProp(obj, key, undefined) !== undefined;
}

function deepUnwrap(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  return value;
}

function getSectionProps(section) {
  const root =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = deepUnwrap(root?.raw);
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...root, ...raw }
    : root;
}

function resolveIconName(raw, keys, fallback) {
  for (const key of keys) {
    const icon = resolveFA4IconName(resolveProp(raw, key, ""));
    if (icon) return icon;
  }
  return resolveFA4IconName(fallback) || fallback;
}

export default function FilterSortHeader({
  section,
  filterItems: filterItemsProp,
  onSortChange,
  onViewModeChange,
  onFilterChange,
}) {
  const raw = getSectionProps(section);

  const bgColor      = resolveProp(raw, "bgColor", "#ffffff");
  const pt           = resolveProp(raw, "pt", 10);
  const pb           = resolveProp(raw, "pb", 10);
  const pl           = resolveProp(raw, "pl", 16);
  const pr           = resolveProp(raw, "pr", 16);
  const showSortText = resolveProp(raw, "sortButtonTextVisible", true);
  const hasCompactStyle = [
    "sortBgColor",
    "sortBorderColor",
    "sortBorderRadius",
    "filterBgColor",
    "filterBorderColor",
    "filterBorderRadius",
  ].some((key) => hasResolvedProp(raw, key));
  const compactControls =
    resolveProp(raw, "compactSearchControls", false) === true ||
    resolveProp(raw, "compactControls", false) === true ||
    resolveProp(raw, "variant", "") === "searchResults" ||
    hasCompactStyle;
  const showColumnPicker = resolveBoolProp(raw, "columnPickerVisible", true) &&
    resolveBoolProp(raw, "gridListToggleVisible", true) &&
    resolveBoolProp(raw, "viewToggleVisible", true) &&
    resolveBoolProp(raw, "showViewToggle", true);
  const showSortButton = resolveBoolProp(raw, "sortVisible", true) &&
    resolveBoolProp(raw, "sortButtonVisible", true) &&
    resolveBoolProp(raw, "showSort", true);
  const showFilterButton = resolveBoolProp(raw, "filterVisible", true) &&
    resolveBoolProp(raw, "filterButtonVisible", true) &&
    resolveBoolProp(raw, "showFilter", true);
  const dropdownIconColor = resolveProp(
    raw,
    "dropdownIconColor",
    resolveProp(raw, "arrowIconColor", "#111827")
  );
  const dropdownIconSize = Number(
    resolveProp(raw, "dropdownIconSize", resolveProp(raw, "arrowIconSize", 12))
  ) || 12;
  const sortDropdownIcon = resolveIconName(
    raw,
    ["sortDropdownIcon", "sortArrowIcon", "dropdownIcon", "arrowIcon", "chevronIcon"],
    "chevron-down"
  );
  const filterDropdownIcon = resolveIconName(
    raw,
    ["filterDropdownIcon", "filterArrowIcon", "dropdownIcon", "arrowIcon", "chevronIcon"],
    "chevron-down"
  );
  const listIconName = resolveIconName(raw, ["listIcon", "listViewIcon"], "bars");
  const gridIconName = resolveIconName(raw, ["gridIcon", "gridViewIcon"], "th-large");

  // Filter items from DSL (for the filter modal)
  const rawItems    = resolveProp(raw, "items", []);
  const filterItems = Array.isArray(filterItemsProp) && filterItemsProp.length > 0
    ? filterItemsProp
    : Array.isArray(rawItems) ? rawItems : [];

  const [selectedSort, setSelectedSort]   = useState("Popular");
  const [viewMode, setViewMode]           = useState("grid"); // "grid" | "list"
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible]     = useState(false);
  const [activeFilter, setActiveFilter]   = useState(null);

  const handleSortSelect = (opt) => {
    setSelectedSort(opt);
    setSortVisible(false);
    onSortChange && onSortChange(opt);
  };

  const handleViewMode = (mode) => {
    setViewMode(mode);
    onViewModeChange && onViewModeChange(mode);
  };

  const handleApplyFilter = () => {
    setFilterVisible(false);
    onFilterChange && onFilterChange(activeFilter);
  };

  const handleClearFilter = () => {
    setActiveFilter(null);
    setFilterVisible(false);
    onFilterChange && onFilterChange(null);
  };

  const containerPad = {
    paddingTop: pt,
    paddingBottom: pb,
    paddingLeft: pl,
    paddingRight: pr,
    backgroundColor: bgColor,
  };

  const sortPillStyle = {
    backgroundColor: resolveProp(raw, "sortBgColor", "#ECECEC"),
    borderColor: resolveProp(raw, "sortBorderColor", "transparent"),
    borderWidth: resolveProp(raw, "sortBorderSide", "none") === "none" ? 0 : 1,
    borderRadius: resolveNumberProp(raw, "sortBorderRadius", 18),
    paddingTop: resolveNumberProp(raw, "sortPt", 8),
    paddingBottom: resolveNumberProp(raw, "sortPb", 8),
    paddingLeft: resolveNumberProp(raw, "sortPl", 14),
    paddingRight: resolveNumberProp(raw, "sortPr", 14),
  };
  const sortPillTextStyle = {
    color: resolveProp(raw, "sorttitleColor", "#111827"),
    fontSize: resolveNumberProp(raw, "sorttitleFontSize", 14),
    fontWeight: resolveWeight(resolveProp(raw, "sorttitleFontWeight", undefined), "500"),
  };
  const filterPillStyle = {
    backgroundColor: resolveProp(raw, "filterBgColor", "#ECECEC"),
    borderColor: resolveProp(raw, "filterBorderColor", "transparent"),
    borderWidth: resolveProp(raw, "filterBorderSide", "none") === "none" ? 0 : 1,
    borderRadius: resolveNumberProp(raw, "filterBorderRadius", 18),
    paddingTop: resolveNumberProp(raw, "filterPt", 8),
    paddingBottom: resolveNumberProp(raw, "filterPb", 8),
    paddingLeft: resolveNumberProp(raw, "filterPl", 14),
    paddingRight: resolveNumberProp(raw, "filterPr", 14),
  };
  const filterPillTextStyle = {
    color: resolveProp(raw, "filtertitleColor", "#111827"),
    fontSize: resolveNumberProp(raw, "filtertitleFontSize", 14),
    fontWeight: resolveWeight(resolveProp(raw, "filtertitleFontWeight", undefined), "500"),
  };

  if (!showSortButton && !showFilterButton && !showColumnPicker) return null;

  return (
    <>
      {/* ── Main bar ─────────────────────────────────────────────────── */}
      <View style={[styles.bar, compactControls && styles.compactBar, containerPad]}>
        {/* Left: Filter + Sort tabs */}
        {compactControls ? (
          <View style={styles.compactLeft}>
            {showSortButton ? (
              <TouchableOpacity
                style={[styles.compactPill, sortPillStyle]}
                activeOpacity={0.75}
                onPress={() => setSortVisible(true)}
              >
                <Text style={[styles.compactPillText, sortPillTextStyle]} numberOfLines={1}>Sort</Text>
                <Icon name={sortDropdownIcon} size={dropdownIconSize} color={dropdownIconColor} />
              </TouchableOpacity>
            ) : null}
            {showFilterButton ? (
              <TouchableOpacity
                style={[styles.compactPill, filterPillStyle]}
                activeOpacity={0.75}
                onPress={() => setFilterVisible(true)}
              >
                <Text style={[styles.compactPillText, filterPillTextStyle]} numberOfLines={1}>
                  {activeFilter?.label || "Filter"}
                </Text>
                <Icon name={filterDropdownIcon} size={dropdownIconSize} color={dropdownIconColor} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.leftScroll}
          >
            {/* Filter button */}
            {showFilterButton ? (
              <TouchableOpacity
                style={styles.pill}
                activeOpacity={0.75}
                onPress={() => setFilterVisible(true)}
              >
                <Icon name="sliders" size={12} color="#111827" style={styles.pillIcon} />
                {showSortText && (
                  <Text style={styles.pillText} numberOfLines={1}>
                    {activeFilter?.label || "Filter"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}

            {/* Sort option chips */}
            {showSortButton ? SORT_OPTIONS.map((opt) => {
              const active = selectedSort === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.pill, active && styles.pillActive]}
                  activeOpacity={0.75}
                  onPress={() => handleSortSelect(opt)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            }) : null}
          </ScrollView>
        )}

        {/* Right: List / Grid toggle */}
        {showColumnPicker ? (
          <View style={[styles.viewToggle, compactControls && styles.compactViewToggle]}>
            <TouchableOpacity
              style={[styles.toggleBtn, compactControls && styles.compactToggleBtn, viewMode === "list" && styles.toggleBtnActive]}
              activeOpacity={0.75}
              onPress={() => handleViewMode("list")}
            >
              <Icon name={listIconName} size={14} color={viewMode === "list" ? "#111827" : "#D1D5DB"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, compactControls && styles.compactToggleBtn, viewMode === "grid" && styles.toggleBtnActive]}
              activeOpacity={0.75}
              onPress={() => handleViewMode("grid")}
            >
              <Icon name={gridIconName} size={14} color={viewMode === "grid" ? "#111827" : "#D1D5DB"} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* ── Filter Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={sortVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortVisible(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setSortVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sort Products</Text>
            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map((opt) => {
                const active = selectedSort === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.sortOption, active && styles.sortOptionActive]}
                    activeOpacity={0.75}
                    onPress={() => handleSortSelect(opt)}
                  >
                    <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                      {opt}
                    </Text>
                    {active ? <Icon name="check" size={13} color="#111827" /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setFilterVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by Category</Text>

            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={styles.filterChips}
              showsVerticalScrollIndicator={false}
            >
              {filterItems.length > 0 ? (
                filterItems.map((item) => {
                  const label = item?.label || item?.title || item?.name || String(item);
                  const value = item?.value ?? label;
                  const selected =
                    activeFilter &&
                    (activeFilter.id === item?.id ||
                      `${activeFilter.type || ""}:${activeFilter.value ?? activeFilter.label}` === `${item?.type || ""}:${value}`);
                  return (
                    <TouchableOpacity
                      key={item?.id || label}
                      style={[styles.filterChip, selected && styles.filterChipActive]}
                      activeOpacity={0.75}
                      onPress={() => setActiveFilter(selected ? null : { ...item, label, value })}
                    >
                      <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.noFilters}>No filter options available.</Text>
              )}
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.applyBtn}
                activeOpacity={0.85}
                onPress={handleApplyFilter}
              >
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
              {activeFilter ? (
                <TouchableOpacity
                  style={styles.clearBtn}
                  activeOpacity={0.85}
                  onPress={handleClearFilter}
                >
                  <Text style={styles.clearBtnText}>Clear filter</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  compactBar: {
    justifyContent: "space-between",
    borderBottomWidth: 0,
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  compactPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#ECECEC",
  },
  compactPillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },

  // Scrollable left area
  leftScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 8,
  },

  // Pill buttons (Filter + Sort options)
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  pillActive: {
    borderColor: "#0891B2",
    backgroundColor: "#E0F2FE",
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  pillTextActive: {
    color: "#0891B2",
    fontWeight: "600",
  },

  // Grid/List toggle
  viewToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
    gap: 4,
  },
  compactViewToggle: {
    gap: 8,
  },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  compactToggleBtn: {
    width: 24,
    height: 28,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  toggleBtnActive: {
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
  },

  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },

  // Modal backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  // Bottom sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 18,
    paddingTop: 12,
    maxHeight: "82%",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  filterScroll: {
    maxHeight: 360,
  },
  sortOptions: {
    gap: 8,
  },
  sortOption: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
  },
  sortOptionActive: {
    backgroundColor: "#F3F4F6",
  },
  sortOptionText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "500",
  },
  sortOptionTextActive: {
    color: "#111827",
    fontWeight: "700",
  },
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 18,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  filterChipActive: {
    borderColor: "#0891B2",
    backgroundColor: "#E0F2FE",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
  },
  filterChipTextActive: {
    color: "#0891B2",
    fontWeight: "600",
  },
  noFilters: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  sheetActions: {
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
    backgroundColor: "#FFFFFF",
  },
  applyBtn: {
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  applyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  clearBtn: {
    marginTop: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  clearBtnText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 14,
  },
});

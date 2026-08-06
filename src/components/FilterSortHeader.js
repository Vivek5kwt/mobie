// components/FilterSortHeader.js
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { resolveFont } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";
import {
  getSortFilterSnapshot,
  hydrateSortFilterFromStorage,
  setSortFilterState,
  subscribeSortFilter,
} from "../utils/sortFilterStore";

// Builder's FilterAndSortHeader (PreviewLive.tsx) has no Inspector control for
// the sort-option list or the filter category list — both are hardcoded there.
// Mirrored verbatim here so DSL-driven pages behave the same as Builder.
const SORT_OPTIONS = [
  "Recommended",
  "What's New",
  "Best Selling",
  "Price: Low to High",
  "Price: High to Low",
];
const AVAILABILITY_FILTERS = [
  { label: "In stock", count: 8, disabled: false },
  { label: "Out of stock", count: 1, disabled: false },
  { label: "Available soon", count: 0, disabled: true },
];

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

function cleanFontFamily(value, fallback) {
  return resolveFont(value) || fallback;
}

// Builder never exposes a configurable border WIDTH for this block — every
// side is hardcoded to a 1px line, so the RN side matches that (no width field).
function resolveBorderStyle(sideValue, color) {
  const side = String(sideValue || "none").trim().toLowerCase();
  const borderColor = color || "transparent";
  if (side === "all" || side === "solid" || side === "full" || side === "box") {
    return { borderWidth: 1, borderColor };
  }
  if (side === "top") return { borderTopWidth: 1, borderTopColor: borderColor };
  if (side === "bottom") return { borderBottomWidth: 1, borderBottomColor: borderColor };
  if (side === "left") return { borderLeftWidth: 1, borderLeftColor: borderColor };
  if (side === "right") return { borderRightWidth: 1, borderRightColor: borderColor };
  return null;
}

function renderIconGlyph(iconType, size, color) {
  const name = resolveFA4IconName(iconType);
  if (!name) return null;
  return <Icon name={name} size={size} color={color} />;
}

export default function FilterSortHeader({
  section,
  filterItems: filterItemsProp,
  onSortChange,
  onViewModeChange,
  onFilterChange,
}) {
  const raw = getSectionProps(section);

  // Screens that pass their own product-derived filter categories (e.g.
  // CollectionProductsScreen, AllProductsScreen) get their existing richer,
  // single-select category-filter behavior untouched. A pure DSL block usage
  // (no filterItems passed) gets Builder's actual fixed "Availability" filter.
  const legacyFilterMode = Array.isArray(filterItemsProp) && filterItemsProp.length > 0;

  // ── Outer container ────────────────────────────────────────────────────
  const contVisible = resolveBoolProp(raw, "contVisible", true);
  const bgColor = resolveProp(raw, "bgColor", "#fff");
  const borderColor = resolveProp(raw, "borderColor", "#ddd");
  const borderSide = resolveProp(raw, "borderSide", "all");
  const borderRadius = resolveNumberProp(raw, "borderRadius", 0);
  const pt = resolveNumberProp(raw, "pt", 0);
  const pr = resolveNumberProp(raw, "pr", 10);
  const pb = resolveNumberProp(raw, "pb", 0);
  const pl = resolveNumberProp(raw, "pl", 10);

  // ── Filter button ──────────────────────────────────────────────────────
  const cardTitleVisible = resolveBoolProp(raw, "cardTitleVisible", true);
  const titleFontSize = resolveNumberProp(raw, "titleFontSize", 14);
  const titleFontWeight = resolveWeight(resolveProp(raw, "titleFontWeight", undefined), "400");
  const titleColor = resolveProp(raw, "titleColor", "#000");
  const titleFontFamily = cleanFontFamily(resolveProp(raw, "titleFontFamily", "Inter"), "Inter");
  const alignFilterIcon = String(resolveProp(raw, "alignFilterIcon", "Left"));
  const imageVisible = resolveBoolProp(raw, "imageVisible", true);
  const iconType = resolveProp(raw, "iconType", "");
  const iconHeight = resolveNumberProp(raw, "iconHeight", 14);
  const titleIconColor = resolveProp(raw, "titleIconColor", "#000");
  const filterBgPaddingVisible = resolveBoolProp(raw, "filterVisible", true);
  const filterBgColor = resolveProp(raw, "filterBgColor", "#E5E7EB");
  const filterBorderColor = resolveProp(raw, "filterBorderColor", "#E5E7EB");
  const filterBorderRadius = resolveNumberProp(raw, "filterBorderRadius", 8);
  const filterBorderSide = resolveProp(raw, "filterBorderSide", "all");
  const filterPt = resolveNumberProp(raw, "filterPt", 9);
  const filterPr = resolveNumberProp(raw, "filterPr", 10);
  const filterPb = resolveNumberProp(raw, "filterPb", 12);
  const filterPl = resolveNumberProp(raw, "filterPl", 10);

  // ── Sort button ────────────────────────────────────────────────────────
  const sortTitleVisible = resolveBoolProp(raw, "sortTitleVisible", true);
  const sorttitleFontSize = resolveNumberProp(raw, "sorttitleFontSize", 14);
  const sorttitleFontWeight = resolveWeight(resolveProp(raw, "sorttitleFontWeight", undefined), "400");
  const sorttitleColor = resolveProp(raw, "sorttitleColor", "#000");
  const sorttitleFontFamily = cleanFontFamily(resolveProp(raw, "sorttitleFontFamily", "Inter"), "Inter");
  const sortimageVisible = resolveBoolProp(raw, "sortimageVisible", true);
  const sorticonType = resolveProp(raw, "sorticonType", "");
  const sorticonHeight = resolveNumberProp(raw, "sorticonHeight", 14);
  const sorttitleIconColor = resolveProp(raw, "sorttitleIconColor", "#000");
  const sortalignIcon = String(resolveProp(raw, "sortalignIcon", "Right"));
  const sortBgPaddingVisible = resolveBoolProp(raw, "sortVisible", true);
  const sortBgColor = resolveProp(raw, "sortBgColor", "#E5E7EB");
  const sortBorderColor = resolveProp(raw, "sortBorderColor", "#E5E7EB");
  const sortBorderRadius = resolveNumberProp(raw, "sortBorderRadius", 6);
  const sortBorderSide = resolveProp(raw, "sortBorderSide", "all");
  const sortPt = resolveNumberProp(raw, "sortPt", 9);
  const sortPr = resolveNumberProp(raw, "sortPr", 10);
  const sortPb = resolveNumberProp(raw, "sortPb", 12);
  const sortPl = resolveNumberProp(raw, "sortPl", 10);

  // ── Active filters (chip row) ──────────────────────────────────────────
  const activeTitleVisible = resolveBoolProp(raw, "activeTitleVisible", true);
  const activetitleFontSize = resolveNumberProp(raw, "activetitleFontSize", 12);
  const activetitleFontWeight = resolveWeight(resolveProp(raw, "activetitleFontWeight", undefined), "400");
  const activetitleColor = resolveProp(raw, "activetitleColor", "#fff");
  const activetitleFontFamily = cleanFontFamily(resolveProp(raw, "activetitleFontFamily", "Inter"), "Inter");
  const activeVisible = resolveBoolProp(raw, "activeVisible", true);
  const activeBgColor = resolveProp(raw, "activeBgColor", "#000");
  const activeBorderColor = resolveProp(raw, "activeBorderColor", "#000");
  const activeBorderRadius = resolveNumberProp(raw, "activeBorderRadius", 20);
  const activeBorderSide = resolveProp(raw, "activeBorderSide", "all");
  const activePt = resolveNumberProp(raw, "activePt", 6);
  const activePr = resolveNumberProp(raw, "activePr", 10);
  const activePb = resolveNumberProp(raw, "activePb", 6);
  const activePl = resolveNumberProp(raw, "activePl", 10);
  const activealignIcon = String(resolveProp(raw, "activealignIcon", "Right"));
  const activeimageVisible = resolveBoolProp(raw, "activeimageVisible", true);
  const activeiconType = resolveProp(raw, "activeiconType", "");
  const activeiconHeight = resolveNumberProp(raw, "activeiconHeight", 12);
  const activetitleIconColor = resolveProp(raw, "activetitleIconColor", "#fff");

  // ── Column picker ──────────────────────────────────────────────────────
  const columnPickerVisible = resolveBoolProp(raw, "columnPickerVisible", true);
  const columnPrimaryColor = resolveProp(raw, "columnPrimaryColor", "#000000");
  const listVisible = resolveBoolProp(raw, "listVisible", true);
  const listIconSize = resolveNumberProp(raw, "listIconSize", 18);
  const listiconType = resolveProp(raw, "listiconType", "");
  // Old saved documents (pre-rename) stored this under the legacy key
  // `columnActiveColor` — fall back to it only when the current key is absent,
  // matching Builder's own restore logic (layout/centerLive.tsx).
  const listActiveColor = resolveProp(raw, "listActiveColor", resolveProp(raw, "columnActiveColor", "#000"));
  const gridVisible = resolveBoolProp(raw, "gridVisible", true);
  const gridIconSize = resolveNumberProp(raw, "gridIconSize", 18);
  const gridiconType = resolveProp(raw, "gridiconType", "");
  const gridActiveColor = resolveProp(raw, "gridActiveColor", resolveProp(raw, "columnActiveColor", "#000"));
  const columnBgVisible = resolveBoolProp(raw, "columnBgVisible", true);
  const columnBgColor = resolveProp(raw, "columnBgColor", "#fff");
  const columnBorderColor = resolveProp(raw, "columnBorderColor", "#E5E7EB");
  const columnBorderRadius = resolveNumberProp(raw, "columnBorderRadius", 8);
  const columnBorderSide = resolveProp(raw, "columnBorderSide", "all");
  const columnPt = resolveNumberProp(raw, "columnPt", 1);
  const columnPr = resolveNumberProp(raw, "columnPr", 1);
  const columnPb = resolveNumberProp(raw, "columnPb", 1);
  const columnPl = resolveNumberProp(raw, "columnPl", 1);

  // ── Drawer (sort bottom sheet + filter bottom sheet) ──────────────────
  const drawerTextVisible = resolveBoolProp(raw, "drawerTextVisible", true);
  const drawerFontSize = resolveNumberProp(raw, "drawerFontSize", 16);
  const drawerFontWeight = resolveWeight(resolveProp(raw, "drawerFontWeight", undefined), "500");
  const drawerFontFamily = cleanFontFamily(resolveProp(raw, "drawerFontFamily", "Inter"), "Inter");
  const drawerTextColor = resolveProp(raw, "drawerTextColor", "#000000");
  const drawerCounterColor = resolveProp(raw, "drawerCounterColor", "#6B7280");
  const drawerVisible = resolveBoolProp(raw, "drawerVisible", true);
  const drawerCheckboxVisible = resolveBoolProp(raw, "drawerCheckboxVisible", true);
  const drawerCheckedColor = resolveProp(raw, "drawerCheckedColor", "#000000");
  const drawerUncheckedColor = resolveProp(raw, "drawerUncheckedColor", "#999999");
  const drawerDisabledColor = resolveProp(raw, "drawerDisabledColor", "#E5E7EB");

  // ── Local UI state ─────────────────────────────────────────────────────
  const [showSort, setShowSort] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [openAvailability, setOpenAvailability] = useState(true);
  const [tempFilters, setTempFilters] = useState([]);
  const [selectedFilters, setSelectedFilters] = useState(() => getSortFilterSnapshot().selectedFilters);
  const [selectedSort, setSelectedSort] = useState(() => getSortFilterSnapshot().sortOption);
  const [viewType, setViewType] = useState("grid2"); // "list" | "grid2" — matches Builder's own default
  const [activeFilter, setActiveFilter] = useState(null); // legacy single-select mode only

  // Hydrate from + subscribe to the shared store (mirrors Builder's
  // hydrateSortFilterFromLocalStorage + useSyncExternalStore pattern), so any
  // sibling Filter/Sort header or Product Grid on the same page stays in sync.
  useEffect(() => {
    let mounted = true;
    const applySnapshot = () => {
      if (!mounted) return;
      const snap = getSortFilterSnapshot();
      setSelectedSort(snap.sortOption);
      setSelectedFilters(snap.selectedFilters);
      setTempFilters(snap.selectedFilters);
    };
    hydrateSortFilterFromStorage().then(applySnapshot);
    const unsub = subscribeSortFilter(applySnapshot);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    onViewModeChange && onViewModeChange(viewType === "list" ? "list" : "grid");
  }, [viewType]);

  const sortButtonText = selectedSort === "Best Selling" ? "Popular" : selectedSort;

  const removeFilter = (value) => {
    setSelectedFilters((prev) => {
      const next = prev.filter((v) => v !== value);
      setSortFilterState({ sortOption: selectedSort, selectedFilters: next });
      onFilterChange && onFilterChange(next.length ? next : null);
      return next;
    });
  };

  const toggleFilter = (value) => {
    setTempFilters((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  // The Sort header row is now always the single Builder/DSL-matching
  // button (see render below) — the old per-option inline pills that used
  // to call this with legacyFilterMode true (immediate apply + close, no
  // explicit "Apply" step) are gone, so this always uses Builder's actual
  // behavior: selecting a row keeps the drawer open until "Apply" is tapped.
  const handleSortSelect = (value) => {
    setSelectedSort(value);
    setSortFilterState({ sortOption: value, selectedFilters });
    onSortChange && onSortChange(value);
  };

  const handleOpenSort = () => {
    // Just open the drawer on the currently active sort (selectedSort already
    // drives which row shows as checked, see SORT_OPTIONS.map below) — this
    // used to force a reset to "Best Selling" on every open, which silently
    // discarded whatever sort the shopper had actually picked and re-applied
    // "Best Selling" as if they'd chosen it themselves.
    setShowSort(true);
    setShowFilter(false);
  };

  const handleApplyAvailabilityFilters = () => {
    setSelectedFilters(tempFilters);
    setSortFilterState({ sortOption: selectedSort, selectedFilters: tempFilters });
    onFilterChange && onFilterChange(tempFilters.length ? tempFilters : null);
    setShowFilter(false);
  };

  const handleApplyLegacyFilter = () => {
    setShowFilter(false);
    onFilterChange && onFilterChange(activeFilter);
  };

  const handleClearLegacyFilter = () => {
    setActiveFilter(null);
    setShowFilter(false);
    onFilterChange && onFilterChange(null);
  };

  const containerStyle = {
    backgroundColor: contVisible ? bgColor : "transparent",
    borderRadius: contVisible ? borderRadius : 0,
    paddingTop: pt,
    paddingRight: pr,
    paddingBottom: pb,
    paddingLeft: pl,
    ...(contVisible ? resolveBorderStyle(borderSide, borderColor) : null),
  };

  const filterButtonStyle = {
    backgroundColor: filterBgPaddingVisible ? filterBgColor : "transparent",
    borderRadius: filterBgPaddingVisible ? filterBorderRadius : 0,
    paddingTop: filterBgPaddingVisible ? filterPt : 0,
    paddingRight: filterBgPaddingVisible ? filterPr : 0,
    paddingBottom: filterBgPaddingVisible ? filterPb : 0,
    paddingLeft: filterBgPaddingVisible ? filterPl : 0,
    ...(filterBgPaddingVisible ? resolveBorderStyle(filterBorderSide, filterBorderColor) : null),
  };

  const sortButtonStyle = {
    backgroundColor: sortBgPaddingVisible ? sortBgColor : "transparent",
    borderRadius: sortBgPaddingVisible ? sortBorderRadius : 0,
    paddingTop: sortBgPaddingVisible ? sortPt : 0,
    paddingRight: sortBgPaddingVisible ? sortPr : 0,
    paddingBottom: sortBgPaddingVisible ? sortPb : 0,
    paddingLeft: sortBgPaddingVisible ? sortPl : 0,
    ...(sortBgPaddingVisible ? resolveBorderStyle(sortBorderSide, sortBorderColor) : null),
  };

  const columnBoxStyle = {
    backgroundColor: columnBgVisible ? columnBgColor : "transparent",
    borderRadius: columnBgVisible ? columnBorderRadius : 0,
    paddingTop: columnBgVisible ? columnPt : 0,
    paddingRight: columnBgVisible ? columnPr : 0,
    paddingBottom: columnBgVisible ? columnPb : 0,
    paddingLeft: columnBgVisible ? columnPl : 0,
    ...(columnBgVisible ? resolveBorderStyle(columnBorderSide, columnBorderColor) : null),
  };

  return (
    <>
      <View style={[styles.container, containerStyle]}>
        <View style={styles.headerRow}>
          <View style={styles.leftGroup}>
            {cardTitleVisible ? (
              <TouchableOpacity
                style={[styles.pillButton, filterButtonStyle]}
                activeOpacity={0.75}
                onPress={() => {
                  setShowFilter(true);
                  setShowSort(false);
                }}
              >
                {alignFilterIcon !== "Right" && imageVisible ? (
                  <View style={styles.pillIconGap}>{renderIconGlyph(iconType, iconHeight, titleIconColor)}</View>
                ) : null}
                <Text
                  style={{
                    fontSize: titleFontSize,
                    fontWeight: titleFontWeight,
                    color: titleColor,
                    fontFamily: titleFontFamily,
                  }}
                >
                  Filter
                </Text>
                {alignFilterIcon === "Right" && imageVisible ? (
                  <View style={styles.pillIconGap}>{renderIconGlyph(iconType, iconHeight, titleIconColor)}</View>
                ) : null}
              </TouchableOpacity>
            ) : null}

            {sortTitleVisible ? (
              <TouchableOpacity
                style={[styles.pillButton, sortButtonStyle]}
                activeOpacity={0.75}
                onPress={handleOpenSort}
              >
                {sortalignIcon !== "Right" && sortimageVisible ? (
                  <View style={styles.pillIconGap}>
                    {renderIconGlyph(sorticonType, sorticonHeight, sorttitleIconColor)}
                  </View>
                ) : null}
                <Text
                  style={{
                    fontSize: sorttitleFontSize,
                    fontWeight: sorttitleFontWeight,
                    color: sorttitleColor,
                    fontFamily: sorttitleFontFamily,
                  }}
                  numberOfLines={1}
                >
                  {sortButtonText}
                </Text>
                {sortalignIcon === "Right" && sortimageVisible ? (
                  <View style={styles.pillIconGap}>
                    {renderIconGlyph(sorticonType, sorticonHeight, sorttitleIconColor)}
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.columnBox, columnBoxStyle]}>
            {columnPickerVisible ? (
              <View style={styles.columnButtons}>
                {listVisible ? (
                  <TouchableOpacity style={styles.toggleBtn} activeOpacity={0.75} onPress={() => setViewType("list")}>
                    {renderIconGlyph(listiconType, listIconSize, viewType === "list" ? listActiveColor : columnPrimaryColor)}
                  </TouchableOpacity>
                ) : null}
                {gridVisible ? (
                  <TouchableOpacity style={styles.toggleBtn} activeOpacity={0.75} onPress={() => setViewType("grid2")}>
                    {renderIconGlyph(gridiconType, gridIconSize, viewType === "grid2" ? gridActiveColor : columnPrimaryColor)}
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {!legacyFilterMode && activeTitleVisible && selectedFilters.length > 0 ? (
          <View style={styles.activeRow}>
            {selectedFilters.map((filter) => (
              <View
                key={filter}
                style={[
                  styles.activeChip,
                  {
                    backgroundColor: activeVisible ? activeBgColor : "transparent",
                    borderRadius: activeVisible ? activeBorderRadius : 0,
                    paddingTop: activeVisible ? activePt : 0,
                    paddingRight: activeVisible ? activePr : 0,
                    paddingBottom: activeVisible ? activePb : 0,
                    paddingLeft: activeVisible ? activePl : 0,
                    ...(activeVisible ? resolveBorderStyle(activeBorderSide, activeBorderColor) : null),
                  },
                ]}
              >
                {activealignIcon !== "Right" && activeimageVisible && activeiconType ? (
                  <TouchableOpacity onPress={() => removeFilter(filter)}>
                    {renderIconGlyph(activeiconType, activeiconHeight, activetitleIconColor)}
                  </TouchableOpacity>
                ) : null}
                <Text
                  style={{
                    fontSize: activetitleFontSize,
                    fontWeight: activetitleFontWeight,
                    color: activetitleColor,
                    fontFamily: activetitleFontFamily,
                  }}
                >
                  {filter}
                </Text>
                {activealignIcon === "Right" && activeimageVisible && activeiconType ? (
                  <TouchableOpacity onPress={() => removeFilter(filter)}>
                    {renderIconGlyph(activeiconType, activeiconHeight, activetitleIconColor)}
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── Sort bottom sheet ────────────────────────────────────────────── */}
      <Modal visible={showSort && drawerVisible} transparent animationType="slide" onRequestClose={() => setShowSort(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowSort(false)} />
          <View style={[styles.sheet, { backgroundColor: bgColor }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              {drawerTextVisible ? (
                <Text style={[styles.sheetTitle, { fontFamily: drawerFontFamily }]}>SORT</Text>
              ) : (
                <View />
              )}
              <TouchableOpacity onPress={() => setShowSort(false)}>
                <Text style={styles.closeGlyph}>✕</Text>
              </TouchableOpacity>
            </View>

            {SORT_OPTIONS.map((label) => {
              const checked = selectedSort === label;
              return (
                <TouchableOpacity
                  key={label}
                  style={styles.sortRow}
                  activeOpacity={0.7}
                  onPress={() => handleSortSelect(label)}
                >
                  {drawerCheckboxVisible ? (
                    <View
                      style={[
                        styles.radioOuter,
                        {
                          borderColor: checked ? drawerCheckedColor : drawerUncheckedColor,
                          backgroundColor: checked ? drawerCheckedColor : "transparent",
                        },
                      ]}
                    >
                      {checked ? <View style={styles.radioInner} /> : null}
                    </View>
                  ) : null}
                  {drawerTextVisible ? (
                    <Text
                      style={{
                        fontSize: drawerFontSize,
                        fontWeight: drawerFontWeight,
                        fontFamily: drawerFontFamily,
                        color: drawerTextColor,
                      }}
                    >
                      {label}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={() => setShowSort(false)}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Filter bottom sheet ──────────────────────────────────────────── */}
      <Modal visible={showFilter && drawerVisible} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowFilter(false)} />
          <View style={[styles.sheet, { backgroundColor: bgColor }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              {drawerTextVisible ? <Text style={[styles.sheetTitle, { fontFamily: drawerFontFamily }]}>FILTER</Text> : <View />}
              <TouchableOpacity onPress={() => setShowFilter(false)}>
                <Text style={styles.closeGlyph}>✕</Text>
              </TouchableOpacity>
            </View>

            {legacyFilterMode ? (
              <>
                <ScrollView style={styles.filterScroll} contentContainerStyle={styles.filterChips}>
                  {filterItemsProp.map((item) => {
                    const label = item?.label || item?.title || item?.name || String(item);
                    const value = item?.value ?? label;
                    const selected =
                      activeFilter &&
                      (activeFilter.id === item?.id ||
                        `${activeFilter.type || ""}:${activeFilter.value ?? activeFilter.label}` ===
                          `${item?.type || ""}:${value}`);
                    return (
                      <TouchableOpacity
                        key={item?.id || label}
                        style={[styles.filterChip, selected && styles.filterChipActive]}
                        activeOpacity={0.75}
                        onPress={() => setActiveFilter(selected ? null : { ...item, label, value })}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            {
                              color: drawerTextColor,
                              fontSize: drawerFontSize,
                              fontFamily: drawerFontFamily,
                            },
                            selected && { color: drawerCheckedColor },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={handleApplyLegacyFilter}>
                    <Text style={styles.applyBtnText}>Apply</Text>
                  </TouchableOpacity>
                  {activeFilter ? (
                    <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85} onPress={handleClearLegacyFilter}>
                      <Text style={{ color: drawerTextColor, fontWeight: drawerFontWeight, fontFamily: drawerFontFamily }}>
                        Clear filter
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  activeOpacity={0.75}
                  onPress={() => setOpenAvailability((v) => !v)}
                >
                  <Text style={{ fontWeight: drawerFontWeight, fontFamily: drawerFontFamily, color: drawerTextColor }}>
                    Availability
                  </Text>
                  <Icon name={openAvailability ? "chevron-down" : "chevron-left"} size={14} color={drawerTextColor} />
                </TouchableOpacity>

                {openAvailability ? (
                  <View style={styles.accordionBody}>
                    {AVAILABILITY_FILTERS.map((item) => {
                      const checked = tempFilters.includes(item.label);
                      return (
                        <TouchableOpacity
                          key={item.label}
                          disabled={item.disabled}
                          style={styles.filterRow}
                          activeOpacity={0.7}
                          onPress={() => !item.disabled && toggleFilter(item.label)}
                        >
                          {drawerCheckboxVisible ? (
                            <View
                              style={[
                                styles.checkboxOuter,
                                {
                                  borderColor: item.disabled
                                    ? drawerDisabledColor
                                    : checked
                                      ? drawerCheckedColor
                                      : drawerUncheckedColor,
                                  backgroundColor: checked && !item.disabled ? drawerCheckedColor : "transparent",
                                },
                              ]}
                            >
                              {checked && !item.disabled ? <Text style={styles.checkGlyph}>✓</Text> : null}
                            </View>
                          ) : null}
                          {drawerTextVisible ? (
                            <Text
                              style={{
                                flex: 1,
                                fontSize: drawerFontSize,
                                fontWeight: drawerFontWeight,
                                fontFamily: drawerFontFamily,
                                color: item.disabled ? drawerDisabledColor : drawerTextColor,
                              }}
                            >
                              {item.label}
                            </Text>
                          ) : null}
                          <Text
                            style={{
                              color: item.disabled ? drawerDisabledColor : drawerCounterColor,
                              fontSize: drawerFontSize,
                            }}
                          >
                            ({item.count})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.clearBtn} activeOpacity={0.85} onPress={() => setTempFilters([])}>
                    <Text style={{ color: drawerTextColor, fontWeight: drawerFontWeight, fontFamily: drawerFontFamily }}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.applyBtn} activeOpacity={0.85} onPress={handleApplyAvailabilityFilters}>
                    <Text style={styles.applyBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {},
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  leftScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingRight: 10,
  },
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6, // matches Builder's button style: display:inline-flex, gap:6
  },
  pillIconGap: {},
  columnBox: {
    flexShrink: 0,
  },
  columnButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  toggleBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  activeRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  sheet: {
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
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
  },
  closeGlyph: {
    fontSize: 18,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 10,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  accordionBody: {
    paddingLeft: 4,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  checkboxOuter: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkGlyph: {
    color: "#fff",
    fontSize: 12,
  },
  filterScroll: {
    maxHeight: 360,
  },
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 12,
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
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: "#000",
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
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
  },
});

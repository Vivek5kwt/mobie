// components/FilterSortHeader.js
import React, { useEffect, useMemo, useState } from "react";
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

function resolveSpacing(raw, shortKey, longKey, fallback) {
  return resolveNumberProp(
    raw,
    shortKey,
    resolveNumberProp(raw, longKey, fallback)
  );
}

function resolveBorderStyle(sideValue, color, width = 1) {
  const side = String(sideValue || "none").trim().toLowerCase();
  if (["", "none", "off", "false", "0"].includes(side)) {
    return { borderWidth: 0 };
  }

  const borderColor = color || "transparent";
  if (["all", "solid", "full", "box"].includes(side)) {
    return { borderWidth: width, borderColor };
  }
  if (side === "top") return { borderWidth: 0, borderTopWidth: width, borderTopColor: borderColor };
  if (side === "bottom") return { borderWidth: 0, borderBottomWidth: width, borderBottomColor: borderColor };
  if (side === "left") return { borderWidth: 0, borderLeftWidth: width, borderLeftColor: borderColor };
  if (side === "right") return { borderWidth: 0, borderRightWidth: width, borderRightColor: borderColor };
  return { borderWidth: 0 };
}

function normalizeSortOptions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { label: item, value: item };
      if (!item || typeof item !== "object") return null;
      const label = item.label || item.title || item.name || item.value;
      if (!label) return null;
      return { ...item, label: String(label), value: item.value ?? label };
    })
    .filter(Boolean);
}

export default function FilterSortHeader({
  section,
  filterItems: filterItemsProp,
  onSortChange,
  onViewModeChange,
  onFilterChange,
}) {
  const raw = getSectionProps(section);

  const bgColor      = resolveProp(raw, "bgColor", resolveProp(raw, "backgroundColor", "#ffffff"));
  const pt           = resolveSpacing(raw, "pt", "paddingTop", 10);
  const pb           = resolveSpacing(raw, "pb", "paddingBottom", 10);
  const pl           = resolveSpacing(raw, "pl", "paddingLeft", 16);
  const pr           = resolveSpacing(raw, "pr", "paddingRight", 16);
  const showSortText = resolveBoolProp(raw, "sortButtonTextVisible", true);
  const sortTitleVisible = resolveBoolProp(raw, "sortTitleVisible", true);
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
  const showFilterIcon = resolveBoolProp(raw, "filterIconVisible", true) &&
    resolveBoolProp(raw, "showFilterIcon", true);
  const filterIconAlignment = String(
    resolveProp(raw, "alignFilterIcon", resolveProp(raw, "filterIconAlign", "Left"))
  ).trim().toLowerCase();
  const filterIconName = resolveIconName(
    raw,
    ["filterIcon", "filterIconType", "filtericonType"],
    "sliders"
  );
  const filterIconSize = resolveNumberProp(raw, "filterIconSize", resolveNumberProp(raw, "iconSize", 16));
  const filterIconColor = resolveProp(raw, "filterIconColor", resolveProp(raw, "iconColor", "#111827"));
  const dropdownIconColor = resolveProp(
    raw,
    "dropdownIconColor",
    resolveProp(raw, "arrowIconColor", resolveProp(raw, "titleIconColor", "#111827"))
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
  const listIconName = resolveIconName(raw, ["listIcon", "listViewIcon", "listiconType"], "bars");
  const gridIconName = resolveIconName(raw, ["gridIcon", "gridViewIcon", "gridiconType"], "th-large");
  const toggleIconSize = resolveNumberProp(
    raw,
    "gridIconSize",
    resolveNumberProp(raw, "listIconSize", resolveNumberProp(raw, "iconSize", 14))
  );
  const toggleActiveColor = resolveProp(raw, "columnActiveColor", "#111827");
  const toggleInactiveColor = resolveProp(raw, "columnPrimaryColor", "#D1D5DB");
  const columns = Math.max(1, Math.round(resolveNumberProp(raw, "columns", 2)));
  const initialViewMode = columns <= 1 ? "list" : "grid";
  const horizontalGap = resolveNumberProp(raw, "horizontalGap", 8);
  const verticalGap = resolveNumberProp(raw, "verticalGap", 8);
  const controlRadius = resolveNumberProp(raw, "buttonRadius", 8);
  const controlHeight = resolveNumberProp(
    raw,
    "controlHeight",
    Math.max(34, filterIconSize + 10, toggleIconSize + 10)
  );
  const columnButtonSize = resolveNumberProp(
    raw,
    "columnButtonSize",
    Math.max(28, toggleIconSize + 10)
  );
  const columnBgColor = resolveProp(raw, "columnBgColor", "transparent");
  const columnActiveBgColor = resolveProp(raw, "activeBgColor", columnBgColor);
  const containerBorder = resolveBorderStyle(
    resolveProp(raw, "borderSide", "none"),
    resolveProp(raw, "borderColor", "transparent"),
    resolveNumberProp(raw, "borderWidth", 1)
  );

  // Filter items from DSL (for the filter modal)
  const rawItems    = resolveProp(raw, "items", []);
  const filterItems = Array.isArray(filterItemsProp) && filterItemsProp.length > 0
    ? filterItemsProp
    : Array.isArray(rawItems) ? rawItems : [];

  const sortOptions = useMemo(() => {
    const configured = normalizeSortOptions(
      resolveProp(raw, "sortOptions", resolveProp(raw, "sortItems", []))
    );
    return configured.length > 0
      ? configured
      : SORT_OPTIONS.map((label) => ({ label, value: label }));
  }, [section]);
  const defaultSort = String(
    resolveProp(raw, "defaultSort", resolveProp(raw, "selectedSort", sortOptions[0]?.value || "Popular"))
  );

  const [selectedSort, setSelectedSort]   = useState(defaultSort);
  const [viewMode, setViewMode]           = useState(initialViewMode); // "grid" | "list"
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible]     = useState(false);
  const [activeFilter, setActiveFilter]   = useState(null);

  useEffect(() => {
    setViewMode(initialViewMode);
    onViewModeChange && onViewModeChange(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    setSelectedSort(defaultSort);
  }, [defaultSort]);

  const handleSortSelect = (option) => {
    const value = option?.value ?? option?.label ?? option;
    setSelectedSort(value);
    setSortVisible(false);
    onSortChange && onSortChange(value);
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
    ...containerBorder,
  };

  const baseTitleColor  = resolveProp(raw, "titleColor", "#111827");
  const baseTitleSize   = resolveNumberProp(raw, "titleFontSize", 14);
  const baseTitleWeight = resolveWeight(resolveProp(raw, "titleFontWeight", undefined), "500");
  const baseTitleFamily = resolveFont(
    resolveProp(raw, "titleFontFamily", resolveProp(raw, "textFontFamily", resolveProp(raw, "fontFamily", undefined)))
  );
  const titleAlign = String(resolveProp(raw, "titleAlign", "left")).trim().toLowerCase();

  const sortPillStyle = {
    backgroundColor: resolveProp(raw, "sortBgColor", "#ECECEC"),
    borderColor: resolveProp(raw, "sortBorderColor", "transparent"),
    ...resolveBorderStyle(
      resolveProp(raw, "sortBorderSide", "none"),
      resolveProp(raw, "sortBorderColor", "transparent"),
      resolveNumberProp(raw, "sortBorderWidth", 1)
    ),
    borderRadius: resolveNumberProp(raw, "sortBorderRadius", controlRadius),
    paddingTop: resolveNumberProp(raw, "sortPt", 8),
    paddingBottom: resolveNumberProp(raw, "sortPb", 8),
    paddingLeft: resolveNumberProp(raw, "sortPl", 14),
    paddingRight: resolveNumberProp(raw, "sortPr", 14),
  };
  const sortPillTextStyle = {
    color: resolveProp(raw, "sorttitleColor", baseTitleColor),
    fontSize: resolveNumberProp(raw, "sorttitleFontSize", baseTitleSize),
    fontWeight: resolveWeight(resolveProp(raw, "sorttitleFontWeight", undefined), baseTitleWeight),
    textAlign: titleAlign,
    ...(baseTitleFamily ? { fontFamily: baseTitleFamily } : {}),
  };
  const filterPillStyle = {
    backgroundColor: resolveProp(raw, "filterBgColor", "#ECECEC"),
    borderColor: resolveProp(raw, "filterBorderColor", "transparent"),
    ...resolveBorderStyle(
      resolveProp(raw, "filterBorderSide", "none"),
      resolveProp(raw, "filterBorderColor", "transparent"),
      resolveNumberProp(raw, "filterBorderWidth", 1)
    ),
    borderRadius: resolveNumberProp(raw, "filterBorderRadius", controlRadius),
    paddingTop: resolveNumberProp(raw, "filterPt", 8),
    paddingBottom: resolveNumberProp(raw, "filterPb", 8),
    paddingLeft: resolveNumberProp(raw, "filterPl", 14),
    paddingRight: resolveNumberProp(raw, "filterPr", 14),
  };
  const filterPillTextStyle = {
    color: resolveProp(raw, "filtertitleColor", baseTitleColor),
    fontSize: resolveNumberProp(raw, "filtertitleFontSize", baseTitleSize),
    fontWeight: resolveWeight(resolveProp(raw, "filtertitleFontWeight", undefined), baseTitleWeight),
    textAlign: titleAlign,
    ...(baseTitleFamily ? { fontFamily: baseTitleFamily } : {}),
  };
  const drawerTextColor    = resolveProp(raw, "drawerTextColor", "#374151");
  const drawerCheckedColor = resolveProp(raw, "drawerCheckedColor", "#0891B2");
  const activeTitleColor   = resolveProp(raw, "activetitleColor", "#111827");
  const selectedSortLabel =
    sortOptions.find((option) => String(option.value) === String(selectedSort))?.label ||
    String(selectedSort);
  const filterLabel = String(resolveProp(raw, "filterTitle", resolveProp(raw, "filterText", "Filter")));
  const sortSheetTitle = String(resolveProp(raw, "sortDrawerTitle", resolveProp(raw, "sortModalTitle", "Sort Products")));
  const filterSheetTitle = String(resolveProp(raw, "filterDrawerTitle", resolveProp(raw, "filterModalTitle", "Filter by Category")));
  const actionBgColor = resolveProp(raw, "buttonBgColor", activeTitleColor);
  const actionTextColor = resolveProp(raw, "buttonTextColor", "#ffffff");
  const actionFontFamily = resolveFont(resolveProp(raw, "buttonFontFamily", baseTitleFamily));
  const actionFontSize = resolveNumberProp(raw, "buttonFontSize", baseTitleSize);
  const actionFontWeight = resolveWeight(resolveProp(raw, "buttonFontWeight", undefined), "600");

  if (!showSortButton && !showFilterButton && !showColumnPicker) return null;

  return (
    <>
      {/* ── Main bar ─────────────────────────────────────────────────── */}
      <View
        style={[
          styles.bar,
          compactControls && styles.compactBar,
          containerPad,
          { columnGap: horizontalGap, rowGap: verticalGap },
        ]}
      >
        {/* Left: Filter + Sort tabs */}
        {compactControls ? (
          <View style={[styles.compactLeft, { gap: horizontalGap }]}>
            {showFilterButton ? (
              <TouchableOpacity
                style={[styles.compactPill, { minHeight: controlHeight }, filterPillStyle]}
                activeOpacity={0.75}
                onPress={() => setFilterVisible(true)}
              >
                {showFilterIcon && filterIconAlignment !== "right" ? (
                  <Icon name={filterIconName} size={filterIconSize} color={filterIconColor} />
                ) : null}
                {showSortText ? (
                  <Text style={[styles.compactPillText, filterPillTextStyle]} numberOfLines={1}>
                    {activeFilter?.label || filterLabel}
                  </Text>
                ) : null}
                {showFilterIcon && filterIconAlignment === "right" ? (
                  <Icon name={filterIconName} size={filterIconSize} color={filterIconColor} />
                ) : null}
                <Icon name={filterDropdownIcon} size={dropdownIconSize} color={dropdownIconColor} />
              </TouchableOpacity>
            ) : null}
            {showSortButton ? (
              <TouchableOpacity
                style={[styles.compactPill, { minHeight: controlHeight }, sortPillStyle]}
                activeOpacity={0.75}
                onPress={() => setSortVisible(true)}
              >
                {sortTitleVisible ? (
                  <Text style={[styles.compactPillText, sortPillTextStyle]} numberOfLines={1}>
                    {selectedSortLabel}
                  </Text>
                ) : null}
                <Icon name={sortDropdownIcon} size={dropdownIconSize} color={dropdownIconColor} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.leftScroll, { gap: horizontalGap }]}
          >
            {/* Filter button */}
            {showFilterButton ? (
              <TouchableOpacity
                style={[styles.pill, filterPillStyle]}
                activeOpacity={0.75}
                onPress={() => setFilterVisible(true)}
              >
                {showFilterIcon && filterIconAlignment !== "right" ? (
                  <Icon name={filterIconName} size={filterIconSize} color={filterIconColor} style={styles.pillIcon} />
                ) : null}
                {showSortText && (
                  <Text style={[styles.pillText, filterPillTextStyle]} numberOfLines={1}>
                    {activeFilter?.label || filterLabel}
                  </Text>
                )}
                {showFilterIcon && filterIconAlignment === "right" ? (
                  <Icon name={filterIconName} size={filterIconSize} color={filterIconColor} />
                ) : null}
              </TouchableOpacity>
            ) : null}

            {/* Sort option chips */}
            {showSortButton ? sortOptions.map((option) => {
              const active = String(selectedSort) === String(option.value);
              return (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[
                    styles.pill,
                    sortPillStyle,
                    active && styles.pillActive,
                    active && { backgroundColor: columnActiveBgColor },
                  ]}
                  activeOpacity={0.75}
                  onPress={() => handleSortSelect(option)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      sortPillTextStyle,
                      active && styles.pillTextActive,
                      active && { color: activeTitleColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            }) : null}
          </ScrollView>
        )}

        {/* Right: List / Grid toggle */}
        {showColumnPicker ? (
          <View
            style={[
              styles.viewToggle,
              compactControls && styles.compactViewToggle,
              { gap: horizontalGap, backgroundColor: columnBgColor, borderRadius: controlRadius },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                compactControls && styles.compactToggleBtn,
                {
                  width: columnButtonSize,
                  height: controlHeight,
                  borderRadius: controlRadius,
                  backgroundColor: columnBgColor,
                },
                viewMode === "list" && styles.toggleBtnActive,
                viewMode === "list" && { backgroundColor: columnActiveBgColor },
              ]}
              activeOpacity={0.75}
              onPress={() => handleViewMode("list")}
            >
              <Icon name={listIconName} size={toggleIconSize} color={viewMode === "list" ? toggleActiveColor : toggleInactiveColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                compactControls && styles.compactToggleBtn,
                {
                  width: columnButtonSize,
                  height: controlHeight,
                  borderRadius: controlRadius,
                  backgroundColor: columnBgColor,
                },
                viewMode === "grid" && styles.toggleBtnActive,
                viewMode === "grid" && { backgroundColor: columnActiveBgColor },
              ]}
              activeOpacity={0.75}
              onPress={() => handleViewMode("grid")}
            >
              <Icon name={gridIconName} size={toggleIconSize} color={viewMode === "grid" ? toggleActiveColor : toggleInactiveColor} />
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
          <View style={[styles.sheet, { backgroundColor: bgColor }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, sortPillTextStyle]}>{sortSheetTitle}</Text>
            <View style={[styles.sortOptions, { gap: verticalGap }]}>
              {sortOptions.map((option) => {
                const active = String(selectedSort) === String(option.value);
                return (
                  <TouchableOpacity
                    key={String(option.value)}
                    style={[
                      styles.sortOption,
                      { backgroundColor: sortPillStyle.backgroundColor, borderRadius: controlRadius },
                      active && styles.sortOptionActive,
                      active && { backgroundColor: columnActiveBgColor },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleSortSelect(option)}
                  >
                    <Text
                      style={[
                        styles.sortOptionText,
                        sortPillTextStyle,
                        active && styles.sortOptionTextActive,
                        active && { color: activeTitleColor },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {active ? <Icon name="check" size={13} color={activeTitleColor} /> : null}
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
          <View style={[styles.sheet, { backgroundColor: bgColor }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, filterPillTextStyle]}>{filterSheetTitle}</Text>

            <ScrollView
              style={styles.filterScroll}
              contentContainerStyle={[styles.filterChips, { gap: horizontalGap }]}
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
                      style={[
                        styles.filterChip,
                        { backgroundColor: filterPillStyle.backgroundColor, borderRadius: controlRadius },
                        selected && styles.filterChipActive,
                        selected && { borderColor: drawerCheckedColor, backgroundColor: columnActiveBgColor },
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setActiveFilter(selected ? null : { ...item, label, value })}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          {
                            color: drawerTextColor,
                            fontSize: baseTitleSize,
                            fontWeight: baseTitleWeight,
                            ...(baseTitleFamily ? { fontFamily: baseTitleFamily } : {}),
                          },
                          selected && styles.filterChipTextActive,
                          selected && { color: drawerCheckedColor },
                        ]}
                      >
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
                style={[styles.applyBtn, { backgroundColor: actionBgColor, borderRadius: controlRadius }]}
                activeOpacity={0.85}
                onPress={handleApplyFilter}
              >
                <Text
                  style={[
                    styles.applyBtnText,
                    {
                      color: actionTextColor,
                      fontSize: actionFontSize,
                      fontWeight: actionFontWeight,
                      ...(actionFontFamily ? { fontFamily: actionFontFamily } : {}),
                    },
                  ]}
                >
                  {String(resolveProp(raw, "applyButtonText", "Apply"))}
                </Text>
              </TouchableOpacity>
              {activeFilter ? (
                <TouchableOpacity
                  style={styles.clearBtn}
                  activeOpacity={0.85}
                  onPress={handleClearFilter}
                >
                  <Text style={[styles.clearBtnText, { color: drawerTextColor }]}>
                    {String(resolveProp(raw, "clearButtonText", "Clear filter"))}
                  </Text>
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
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  compactPill: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#ECECEC",
  },
  compactPillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flexShrink: 1,
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
    gap: 4,
    flexShrink: 0,
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

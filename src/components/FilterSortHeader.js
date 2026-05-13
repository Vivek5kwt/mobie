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

export default function FilterSortHeader({
  section,
  filterItems: filterItemsProp,
  onSortChange,
  onViewModeChange,
  onFilterChange,
}) {
  const raw = section?.props || section?.properties?.props || {};

  const bgColor      = resolveProp(raw, "bgColor", "#ffffff");
  const pt           = resolveProp(raw, "pt", 10);
  const pb           = resolveProp(raw, "pb", 10);
  const pl           = resolveProp(raw, "pl", 16);
  const pr           = resolveProp(raw, "pr", 16);
  const showSortText = resolveProp(raw, "sortButtonTextVisible", true);
  const compactControls =
    resolveProp(raw, "compactSearchControls", false) === true ||
    resolveProp(raw, "compactControls", false) === true ||
    resolveProp(raw, "variant", "") === "searchResults";

  // Filter items from DSL (for the filter modal)
  const rawItems    = resolveProp(raw, "items", []);
  const filterItems = Array.isArray(filterItemsProp)
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

  return (
    <>
      {/* ── Main bar ─────────────────────────────────────────────────── */}
      <View style={[styles.bar, compactControls && styles.compactBar, containerPad]}>
        {/* Left: Filter + Sort tabs */}
        {compactControls ? (
          <View style={styles.compactLeft}>
            <TouchableOpacity
              style={styles.compactPill}
              activeOpacity={0.75}
              onPress={() => setSortVisible(true)}
            >
              <Text style={styles.compactPillText} numberOfLines={1}>Sort</Text>
              <Icon name="angle-down" size={12} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.compactPill}
              activeOpacity={0.75}
              onPress={() => setFilterVisible(true)}
            >
              <Text style={styles.compactPillText} numberOfLines={1}>
                {activeFilter?.label || "Filter"}
              </Text>
              <Icon name="angle-down" size={12} color="#111827" />
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.leftScroll}
          >
            {/* Filter button */}
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

            {/* Sort option chips */}
            {SORT_OPTIONS.map((opt) => {
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
            })}
          </ScrollView>
        )}

        {/* Right: List / Grid toggle */}
        <View style={[styles.viewToggle, compactControls && styles.compactViewToggle]}>
          <TouchableOpacity
            style={[styles.toggleBtn, compactControls && styles.compactToggleBtn, viewMode === "list" && styles.toggleBtnActive]}
            activeOpacity={0.75}
            onPress={() => handleViewMode("list")}
          >
            <Icon name="bars" size={14} color={viewMode === "list" ? "#111827" : "#D1D5DB"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, compactControls && styles.compactToggleBtn, viewMode === "grid" && styles.toggleBtnActive]}
            activeOpacity={0.75}
            onPress={() => handleViewMode("grid")}
          >
            <Icon name="th-large" size={14} color={viewMode === "grid" ? "#111827" : "#D1D5DB"} />
          </TouchableOpacity>
          {compactControls ? (
            <TouchableOpacity
              style={[styles.toggleBtn, styles.compactToggleBtn]}
              activeOpacity={0.75}
              onPress={() => handleViewMode("grid")}
            >
              <Icon name="th" size={14} color="#D1D5DB" />
            </TouchableOpacity>
          ) : null}
        </View>
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

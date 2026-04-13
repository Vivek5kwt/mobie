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

  // Filter items from DSL (for the filter modal)
  const rawItems    = resolveProp(raw, "items", []);
  const filterItems = Array.isArray(rawItems) ? rawItems : [];

  const [selectedSort, setSelectedSort]   = useState("Popular");
  const [viewMode, setViewMode]           = useState("grid"); // "grid" | "list"
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeFilter, setActiveFilter]   = useState(null);

  const handleSortSelect = (opt) => {
    setSelectedSort(opt);
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
      <View style={[styles.bar, containerPad]}>
        {/* Left: Filter + Sort tabs */}
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
            {showSortText && <Text style={styles.pillText}>Filter</Text>}
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

        {/* Right: List / Grid toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "list" && styles.toggleBtnActive]}
            activeOpacity={0.75}
            onPress={() => handleViewMode("list")}
          >
            <Icon name="bars" size={14} color={viewMode === "list" ? "#111827" : "#9CA3AF"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "grid" && styles.toggleBtnActive]}
            activeOpacity={0.75}
            onPress={() => handleViewMode("grid")}
          >
            <Icon name="th-large" size={14} color={viewMode === "grid" ? "#111827" : "#9CA3AF"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setFilterVisible(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Filter by Category</Text>

          <View style={styles.filterChips}>
            {filterItems.length > 0 ? (
              filterItems.map((item) => {
                const label = item?.title || item?.name || String(item);
                const selected = activeFilter === label;
                return (
                  <TouchableOpacity
                    key={item?.id || label}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                    activeOpacity={0.75}
                    onPress={() => setActiveFilter(selected ? null : label)}
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
          </View>

          <TouchableOpacity
            style={styles.applyBtn}
            activeOpacity={0.85}
            onPress={handleApplyFilter}
          >
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
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
  toggleBtnActive: {
    backgroundColor: "#F3F4F6",
    borderColor: "#9CA3AF",
  },

  // Modal backdrop
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },

  // Bottom sheet
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
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
  filterChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
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
});

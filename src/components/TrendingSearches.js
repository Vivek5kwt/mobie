import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

// ─── DSL helpers ─────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const l = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
  }
  return fallback;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const deriveWeight = (value, fallback = "600") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "string") {
    const l = resolved.toLowerCase();
    if (l === "bold") return "700";
    if (l === "medium") return "500";
    if (l === "regular") return "400";
  }
  return String(resolved);
};

// ─── Normalize search items from various DSL shapes ──────────────────────────

const normalizeSearches = (raw) => {
  if (!raw) return [];
  let source = raw;
  if (raw?.value) source = raw.value;
  else if (raw?.properties?.value) source = raw.properties.value;

  const mapItem = (item) => {
    const props = item?.properties || item || {};
    const text = unwrapValue(
      props?.label ?? props?.text ?? props?.query ?? props?.name ?? props?.keyword,
      ""
    );
    if (!text) return null;
    const link = unwrapValue(props?.link ?? props?.href ?? props?.url, "");
    const query = unwrapValue(props?.query ?? props?.searchQuery ?? props?.keyword, text);
    return {
      text: String(text),
      link: typeof link === "string" ? link.trim() : "",
      query: String(query),
    };
  };

  if (Array.isArray(source)) return source.map(mapItem).filter(Boolean);
  if (source && typeof source === "object") {
    return Object.values(source).map(mapItem).filter(Boolean);
  }
  return [];
};

const borderStyleForSide = (side, color) => {
  const normalized = (side || "").toLowerCase();
  if (!normalized) return {};
  const style = { borderColor: color || "#E5E7EB" };
  if (normalized === "all") return { ...style, borderWidth: 1 };
  if (normalized === "top") return { ...style, borderTopWidth: 1 };
  if (normalized === "bottom") return { ...style, borderBottomWidth: 1 };
  if (normalized === "left") return { ...style, borderLeftWidth: 1 };
  if (normalized === "right") return { ...style, borderRightWidth: 1 };
  return {};
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrendingSearches({ section }) {
  const navigation = useNavigation();

  const rawProps =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // Try multiple DSL field names for the searches array
  const searchesRaw =
    rawProps?.trendingSearches ??
    rawProps?.searches ??
    rawProps?.items ??
    rawProps?.keywords ??
    rawProps?.tags ??
    [];

  const searches = useMemo(() => normalizeSearches(searchesRaw), [searchesRaw]);

  if (!searches.length) return null;

  // ── Heading ────────────────────────────────────────────────────────────────
  const headingVisible = toBoolean(rawProps?.headingVisible, true);
  const headingText = unwrapValue(rawProps?.headingText ?? rawProps?.title, "Trending Searches");
  const headingColor = unwrapValue(rawProps?.headingColor, "#111827");
  const headingSize = toNumber(rawProps?.headingFontSize ?? rawProps?.titleFontSize, 18);
  const headingBold = toBoolean(rawProps?.headingBold, true);
  const headingItalic = toBoolean(rawProps?.headingItalic, false);
  const headingUnderline = toBoolean(rawProps?.headingUnderline, false);
  const headingWeight = deriveWeight(rawProps?.headingFontWeight, headingBold ? "700" : "600");
  const headingPaddingBottom = toNumber(rawProps?.headingPaddingBottom, 10);

  // ── Chip / pill styling ────────────────────────────────────────────────────
  const chipBgColor = unwrapValue(rawProps?.chipBgColor ?? rawProps?.tagBgColor, "#C8EDF0");
  const chipTextColor = unwrapValue(rawProps?.chipTextColor ?? rawProps?.tagTextColor, "#0E7490");
  const chipFontSize = toNumber(rawProps?.chipFontSize ?? rawProps?.tagFontSize, 13);
  const chipFontWeight = deriveWeight(rawProps?.chipFontWeight ?? rawProps?.tagFontWeight, "500");
  const chipBorderRadius = toNumber(rawProps?.chipBorderRadius ?? rawProps?.tagBorderRadius, 999);
  const chipPaddingH = toNumber(rawProps?.chipPaddingH ?? rawProps?.tagPaddingH, 14);
  const chipPaddingV = toNumber(rawProps?.chipPaddingV ?? rawProps?.tagPaddingV, 8);
  const chipBorderColor = unwrapValue(rawProps?.chipBorderColor, "transparent");
  const chipBorderWidth = toNumber(rawProps?.chipBorderWidth, 0);
  const chipGap = toNumber(rawProps?.chipGap ?? rawProps?.gap, 8);

  // ── Container ─────────────────────────────────────────────────────────────
  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const containerBorderRadius = toNumber(rawProps?.borderRadius, 0);
  const borderColor = unwrapValue(rawProps?.borderColor, "#E5E7EB");
  const borderSide = unwrapValue(rawProps?.borderSide, "");

  const padding = {
    paddingTop: toNumber(rawProps?.pt, 16),
    paddingRight: toNumber(rawProps?.pr, 16),
    paddingBottom: toNumber(rawProps?.pb, 16),
    paddingLeft: toNumber(rawProps?.pl, 16),
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleChipPress = (item) => {
    const link = item.link || "";
    if (link.startsWith("/")) {
      const cleaned = link.replace(/^\//, "");
      if (cleaned.startsWith("collections/")) {
        navigation.navigate("CollectionProducts", {
          handle: cleaned.replace("collections/", ""),
        });
        return;
      }
      if (cleaned.startsWith("products/")) {
        navigation.navigate("ProductDetail", {
          handle: cleaned.replace("products/", ""),
        });
        return;
      }
      if (cleaned) {
        navigation.navigate("LayoutScreen", { pageName: cleaned });
        return;
      }
    }
    // Fall back: navigate to search results with the chip text as query
    if (item.query) {
      try {
        navigation.navigate("SearchResults", { query: item.query });
      } catch (_) {
        // SearchResults screen may not exist in all builds — silently ignore
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, borderRadius: containerBorderRadius },
        padding,
        borderStyleForSide(borderSide, borderColor),
      ]}
    >
      {headingVisible && (
        <Text
          style={[
            styles.heading,
            {
              color: headingColor,
              fontSize: headingSize,
              fontWeight: headingWeight,
              fontStyle: headingItalic ? "italic" : "normal",
              textDecorationLine: headingUnderline ? "underline" : "none",
              paddingBottom: headingPaddingBottom,
            },
          ]}
        >
          {headingText}
        </Text>
      )}

      {/* Chips wrap to next row — matching the builder preview */}
      <View style={[styles.chipList, { gap: chipGap }]}>
        {searches.map((item, index) => (
          <TouchableOpacity
            key={`${item.text}-${index}`}
            activeOpacity={0.75}
            onPress={() => handleChipPress(item)}
            style={[
              styles.chip,
              {
                backgroundColor: chipBgColor,
                borderRadius: chipBorderRadius,
                paddingHorizontal: chipPaddingH,
                paddingVertical: chipPaddingV,
                ...(chipBorderWidth > 0
                  ? { borderWidth: chipBorderWidth, borderColor: chipBorderColor }
                  : {}),
              },
            ]}
          >
            <Text
              style={{
                color: chipTextColor,
                fontSize: chipFontSize,
                fontWeight: chipFontWeight,
                lineHeight: 18,
              }}
            >
              {item.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  heading: {
    marginBottom: 4,
  },
  // flexWrap so chips spill to the next row — same as builder preview
  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  chip: {
    alignSelf: "flex-start",
  },
});

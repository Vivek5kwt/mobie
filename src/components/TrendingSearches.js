import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

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
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
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

const deriveWeight = (value, fallback = "700") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "string") {
    const lowered = resolved.toLowerCase();
    if (lowered === "bold") return "700";
    if (lowered === "medium") return "500";
    if (lowered === "regular") return "400";
  }
  return String(resolved);
};

const normalizeSearches = (raw) => {
  let source = raw;
  if (raw?.value) source = raw.value;
  if (raw?.properties?.value) source = raw.properties.value;

  if (Array.isArray(source)) {
    return source.map((item) => String(item)).filter(Boolean);
  }

  if (source && typeof source === "object") {
    return Object.values(source)
      .map((item) => String(item))
      .filter(Boolean);
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

export default function TrendingSearches({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const searches = useMemo(
    () => normalizeSearches(rawProps?.trendingSearches || []),
    [rawProps?.trendingSearches]
  );

  const headingVisible = toBoolean(rawProps?.headingVisible, true);
  const headingText = unwrapValue(rawProps?.headingText, "Trending Searches");
  const headingColor = unwrapValue(rawProps?.headingColor, "#111827");
  const headingSize = toNumber(rawProps?.headingFontSize, 20);
  const headingBold = toBoolean(rawProps?.headingBold, false);
  const headingItalic = toBoolean(rawProps?.headingItalic, false);
  const headingUnderline = toBoolean(rawProps?.headingUnderline, false);
  const headingWeight = deriveWeight(rawProps?.headingFontWeight, headingBold ? "700" : "600");

  const chipVisible = toBoolean(rawProps?.chipVisible, true);
  const chipFontSize = toNumber(rawProps?.chipFontSize, 16);
  const chipFontFamily = unwrapValue(rawProps?.chipFontFamily, undefined);
  const chipFontWeight = deriveWeight(rawProps?.chipFontWeight, "600");
  const chipTextColor = unwrapValue(rawProps?.trendingPillTextColor, "#017176");
  const chipBgColor = unwrapValue(rawProps?.trendingPillBgColor, "#C2EEF4");

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const borderRadius = toNumber(rawProps?.borderRadius, 0);
  const borderColor = unwrapValue(rawProps?.borderColor, "#E5E7EB");
  const borderSide = unwrapValue(rawProps?.borderSide, "");

  const padding = {
    paddingTop: toNumber(rawProps?.pt, 16),
    paddingRight: toNumber(rawProps?.pr, 16),
    paddingBottom: toNumber(rawProps?.pb, 16),
    paddingLeft: toNumber(rawProps?.pl, 16),
  };

  if (!headingVisible && (!chipVisible || searches.length === 0)) return null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, borderRadius },
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
            },
          ]}
        >
          {headingText}
        </Text>
      )}

      {chipVisible && (
        <View style={styles.chips}>
          {searches.map((label, index) => (
            <View key={`${label}-${index}`} style={[styles.chip, { backgroundColor: chipBgColor }]}>
              <Text
                style={[
                  styles.chipText,
                  {
                    color: chipTextColor,
                    fontSize: chipFontSize,
                    fontWeight: chipFontWeight,
                    fontFamily: chipFontFamily,
                  },
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  heading: {
    marginBottom: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    lineHeight: 24,
  },
});

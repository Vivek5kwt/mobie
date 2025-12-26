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

const normalizeCollections = (rawCollections) => {
  let source = rawCollections;
  if (rawCollections?.value) source = rawCollections.value;
  if (rawCollections?.properties?.value) source = rawCollections.properties.value;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        const props = item?.properties || item || {};
        const label = unwrapValue(props?.label, "");
        if (!label) return null;
        return { label };
      })
      .filter(Boolean);
  }

  if (source && typeof source === "object") {
    return Object.values(source)
      .map((item) => {
        const props = item?.properties || item || {};
        const label = unwrapValue(props?.label, "");
        if (!label) return null;
        return { label };
      })
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

export default function TrendingCollections({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const collections = useMemo(
    () => normalizeCollections(rawProps?.trendingCollections || []),
    [rawProps?.trendingCollections]
  );

  if (!collections.length) return null;

  const headingVisible = toBoolean(rawProps?.headingVisible, true);
  const headingText = unwrapValue(rawProps?.headingText, "Trending Collections");
  const headingColor = unwrapValue(rawProps?.headingColor, "#111827");
  const headingSize = toNumber(rawProps?.headingFontSize, 20);
  const headingBold = toBoolean(rawProps?.headingBold, false);
  const headingItalic = toBoolean(rawProps?.headingItalic, false);
  const headingUnderline = toBoolean(rawProps?.headingUnderline, false);
  const headingWeight = deriveWeight(rawProps?.headingFontWeight, headingBold ? "700" : "600");
  const headingPaddingTop = toNumber(rawProps?.headingPaddingTop, 0);
  const headingPaddingBottom = toNumber(rawProps?.headingPaddingBottom, 12);
  const headingPaddingLeft = toNumber(rawProps?.headingPaddingLeft, 0);
  const headingPaddingRight = toNumber(rawProps?.headingPaddingRight, 0);

  const collectionColor = unwrapValue(rawProps?.collectionColor, "#111827");
  const collectionSize = toNumber(rawProps?.collectionFontSize, 16);
  const collectionWeight = deriveWeight(rawProps?.collectionFontWeight, "600");

  const circleBg = unwrapValue(rawProps?.collectionCircleBgColor, "#E5E7EB");
  const circleIcon = unwrapValue(rawProps?.collectionCircleIconColor, "#111827");

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
              paddingTop: headingPaddingTop,
              paddingBottom: headingPaddingBottom,
              paddingLeft: headingPaddingLeft,
              paddingRight: headingPaddingRight,
            },
          ]}
        >
          {headingText}
        </Text>
      )}

      <View style={styles.list}>
        {collections.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.item}>
            <View style={[styles.circle, { backgroundColor: circleBg }]}>
              <View style={[styles.circleIcon, { borderColor: circleIcon }]} />
              <View style={[styles.circleIconDot, { backgroundColor: circleIcon }]} />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: collectionColor,
                  fontSize: collectionSize,
                  fontWeight: collectionWeight,
                },
              ]}
            >
              {item.label}
            </Text>
          </View>
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
    marginBottom: 8,
  },
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  item: {
    alignItems: "center",
    gap: 10,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  circleIcon: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
  },
  circleIconDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    right: 18,
    top: 18,
  },
  label: {
    textAlign: "center",
  },
});

import React, { useMemo } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { resolveTextDecorationLine } from "../utils/textDecoration";

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

// ─── Deep-unwrap a DSL node to its plain value ───────────────────────────────

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return value.const;
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return value;
};

// ─── Normalize search items from various DSL shapes ──────────────────────────

const normalizeSearches = (raw) => {
  if (!raw) return [];

  // Unwrap DSL envelope: { value: [...] } or { properties: { value: [...] } }
  let source = raw;
  const unwrapped = deepUnwrap(raw);
  if (Array.isArray(unwrapped)) {
    source = unwrapped;
  } else if (unwrapped && typeof unwrapped === "object") {
    // Still an object — try common array keys inside it
    const inner =
      unwrapped.items     ??
      unwrapped.searches  ??
      unwrapped.keywords  ??
      unwrapped.tags      ??
      unwrapped.list      ??
      null;
    if (inner !== null) {
      source = deepUnwrap(inner);
    } else {
      source = unwrapped;
    }
  }

  const mapItem = (item) => {
    // Plain string item → use as both text and query
    if (typeof item === "string") {
      const t = item.trim();
      return t ? { text: t, link: "", query: t } : null;
    }
    if (!item || typeof item !== "object") return null;

    const p = item?.properties || item;
    const text = unwrapValue(
      p?.label ?? p?.text ?? p?.title ?? p?.query ?? p?.name ?? p?.keyword,
      ""
    );
    if (!text) return null;
    const link  = unwrapValue(p?.link ?? p?.href ?? p?.url, "");
    const query = unwrapValue(p?.query ?? p?.searchQuery ?? p?.keyword, text);
    return {
      text:  String(text),
      link:  typeof link === "string" ? link.trim() : "",
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

  // `raw` sub-object is where builder stores live data (same pattern as all other components)
  const rawData = deepUnwrap(rawProps?.raw) || {};

  // Search through every likely key, checking both rawProps and rawData
  const searchesRaw =
    rawProps?.trendingSearches   ??
    rawData?.trendingSearches    ??
    rawProps?.searches           ??
    rawData?.searches            ??
    rawProps?.items              ??
    rawData?.items               ??
    rawProps?.keywords           ??
    rawData?.keywords            ??
    rawProps?.tags               ??
    rawData?.tags                ??
    rawData?.list                ??
    rawProps?.list               ??
    null;

  const searches = useMemo(
    () => normalizeSearches(searchesRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(searchesRaw)]
  );

  // Debug: log what was found (remove after confirming it works)
  if (__DEV__) {
    if (!searches.length) {
      console.log("[TrendingSearches] No searches found. rawProps keys:", Object.keys(rawProps));
      console.log("[TrendingSearches] rawData keys:", Object.keys(rawData));
    }
  }

  if (!searches.length) return null;

  // helper: check rawProps first, fall back to rawData
  const rp = (key) => rawProps?.[key] ?? rawData?.[key];

  // ── Heading ────────────────────────────────────────────────────────────────
  const headingVisible = toBoolean(rp("headingVisible"), true);
  const headingText    = unwrapValue(rp("headingText") ?? rp("title"), "Trending Searches");
  const headingColor   = unwrapValue(rp("headingColor"), "#111827");
  const headingSize    = toNumber(rp("headingFontSize") ?? rp("titleFontSize"), 16);
  const headingBold    = toBoolean(rp("headingBold"), true);
  const headingItalic  = toBoolean(rp("headingItalic"), false);
  const headingUnderline = toBoolean(rp("headingUnderline"), false);
  const headingStrikethrough = toBoolean(rp("headingStrikethrough"), false);
  const headingDecorationLine = resolveTextDecorationLine({
    underline: headingUnderline,
    strikethrough: headingStrikethrough,
  });
  const headingWeight  = deriveWeight(rp("headingFontWeight"), headingBold ? "700" : "600");
  const headingPaddingBottom = toNumber(rp("headingPaddingBottom"), 10);

  // ── Chip / pill styling ────────────────────────────────────────────────────
  const chipBgColor     = unwrapValue(rp("chipBgColor") ?? rp("tagBgColor"), "#C8EDF0");
  const chipTextColor   = unwrapValue(rp("chipTextColor") ?? rp("tagTextColor"), "#0E7490");
  const chipFontSize    = toNumber(rp("chipFontSize") ?? rp("tagFontSize"), 13);
  const chipFontWeight  = deriveWeight(rp("chipFontWeight") ?? rp("tagFontWeight"), "500");
  const chipBorderRadius = toNumber(rp("chipBorderRadius") ?? rp("tagBorderRadius"), 999);
  const chipPaddingH    = toNumber(rp("chipPaddingH") ?? rp("tagPaddingH"), 14);
  const chipPaddingV    = toNumber(rp("chipPaddingV") ?? rp("tagPaddingV"), 8);
  const chipBorderColor = unwrapValue(rp("chipBorderColor"), "transparent");
  const chipBorderWidth = toNumber(rp("chipBorderWidth"), 0);
  const chipGap         = toNumber(rp("chipGap") ?? rp("gap"), 8);

  // ── Container ─────────────────────────────────────────────────────────────
  const bgColor              = unwrapValue(rp("bgColor"), "#FFFFFF");
  const containerBorderRadius = toNumber(rp("borderRadius"), 0);
  const borderColor          = unwrapValue(rp("borderColor"), "#E5E7EB");
  const borderSide           = unwrapValue(rp("borderSide"), "");

  const padding = {
    paddingTop:    toNumber(rp("pt"), 0),
    paddingRight:  toNumber(rp("pr"), 0),
    paddingBottom: toNumber(rp("pb"), 0),
    paddingLeft:   toNumber(rp("pl"), 0),
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
              textDecorationLine: headingDecorationLine,
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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchShopifyTrendingSearches } from "../services/shopify";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import { resolveFont } from "../services/typographyService";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return value.const;
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return value;
};

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const normalized = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
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

const firstDefined = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const deriveWeight = (value, fallback = "600") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "string") {
    const normalized = resolved.toLowerCase();
    if (normalized === "bold") return "700";
    if (normalized === "semi bold" || normalized === "semibold") return "600";
    if (normalized === "medium") return "500";
    if (normalized === "regular") return "400";
  }
  return String(resolved);
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const normalizeSearches = (raw) => {
  if (!raw) return [];

  let source = raw;
  const unwrapped = deepUnwrap(raw);
  if (Array.isArray(unwrapped)) {
    source = unwrapped;
  } else if (unwrapped && typeof unwrapped === "object") {
    const inner =
      unwrapped.items ??
      unwrapped.searches ??
      unwrapped.keywords ??
      unwrapped.tags ??
      unwrapped.list ??
      null;
    source = inner !== null ? deepUnwrap(inner) : unwrapped;
  }

  const mapItem = (item) => {
    if (typeof item === "string") {
      const text = item.trim();
      return text ? { text, link: "", query: text } : null;
    }
    if (!item || typeof item !== "object") return null;

    const props = item?.properties || item;
    const text = unwrapValue(
      props?.label ?? props?.text ?? props?.title ?? props?.query ?? props?.name ?? props?.keyword,
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
  const normalized = String(side || "").toLowerCase();
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
  const navigation = useNavigation();

  const rawProps =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const rawData = deepUnwrap(rawProps?.raw) || {};
  const dataSource =
    deepUnwrap(section?.dataSource ?? section?.properties?.dataSource ?? rawProps?.dataSource ?? rawData?.dataSource) ||
    {};

  const rp = useCallback((key) => rawProps?.[key] ?? rawData?.[key], [rawData, rawProps]);

  const searchesRaw = firstDefined(
    rawProps?.trendingSearches,
    rawData?.trendingSearches,
    rawProps?.searches,
    rawData?.searches,
    rawProps?.items,
    rawData?.items,
    rawProps?.keywords,
    rawData?.keywords,
    rawProps?.tags,
    rawData?.tags,
    rawData?.list,
    rawProps?.list,
    null
  );

  const manualKey = useMemo(() => {
    try {
      return JSON.stringify(searchesRaw ?? null);
    } catch {
      return String(searchesRaw ?? "");
    }
  }, [searchesRaw]);

  const manualSearches = useMemo(() => normalizeSearches(searchesRaw), [manualKey]);
  const sourceMode = String(
    unwrapValue(dataSource?.mode ?? rp("sourceMode") ?? rp("trendingSource"), "store")
  ).toLowerCase();
  const hasDslSearches = searchesRaw !== null && searchesRaw !== undefined;
  const useManualSearches = hasDslSearches || ["manual", "static", "dsl"].includes(sourceMode);

  const headingVisible = toBoolean(rp("headingVisible"), true);
  const headingText = unwrapValue(rp("headingText") ?? rp("title"), "Trending Searches");
  const headingColor = unwrapValue(rp("headingColor"), "#111827");
  const headingSize = toNumber(rp("headingFontSize") ?? rp("titleFontSize"), 16);
  const headingFontFamily = cleanFontFamily(rp("headingFontFamily"));
  const headingBold = toBoolean(rp("headingBold"), true);
  const headingItalic = toBoolean(rp("headingItalic"), false);
  const headingUnderline = toBoolean(rp("headingUnderline"), false);
  const headingStrikethrough = toBoolean(rp("headingStrikethrough"), false);
  const headingDecorationLine = resolveTextDecorationLine({
    underline: headingUnderline,
    strikethrough: headingStrikethrough,
  });
  const headingWeight = deriveWeight(rp("headingFontWeight"), headingBold ? "700" : "600");
  const headingPadding = {
    paddingTop: toNumber(rp("headingPaddingTop"), 0),
    paddingRight: toNumber(rp("headingPaddingRight"), 0),
    paddingBottom: toNumber(rp("headingPaddingBottom"), 0),
    paddingLeft: toNumber(rp("headingPaddingLeft"), 0),
  };

  const chipBgColor = unwrapValue(
    firstDefined(
      rp("chipbgColor"),
      rp("chipBgColor"),
      rp("chipBackgroundColor"),
      rp("tagBgColor"),
      rp("trendingPillBgColor")
    ),
    "#F3F4F6"
  );
  const chipTextColor = unwrapValue(
    firstDefined(
      rp("chipColor"),
      rp("chipTextColor"),
      rp("tagTextColor"),
      rp("trendingPillTextColor")
    ),
    "#111827"
  );
  const chipFontSize = toNumber(rp("chipFontSize") ?? rp("tagFontSize"), 13);
  const chipFontWeight = deriveWeight(rp("chipFontWeight") ?? rp("tagFontWeight"), "500");
  const chipFontFamily = cleanFontFamily(rp("chipFontFamily"));
  const chipBorderRadius = toNumber(rp("chipborderRadius") ?? rp("chipBorderRadius") ?? rp("tagBorderRadius"), 999);
  const chipPadding = {
    paddingTop: toNumber(rp("t") ?? rp("chipPaddingTop") ?? rp("tagPaddingTop"), 0),
    paddingRight: toNumber(rp("r") ?? rp("chipPaddingRight") ?? rp("tagPaddingRight"), 0),
    paddingBottom: toNumber(rp("b") ?? rp("chipPaddingBottom") ?? rp("tagPaddingBottom"), 0),
    paddingLeft: toNumber(rp("l") ?? rp("chipPaddingLeft") ?? rp("tagPaddingLeft"), 0),
  };
  const chipBorderColor = unwrapValue(rp("chipborderColor") ?? rp("chipBorderColor"), "transparent");
  const chipBorderWidth = toNumber(rp("chipBorderWidth"), 0);
  const chipBorderSide = unwrapValue(rp("chipborderSide") ?? rp("chipBorderSide"), "");
  const chipGap = toNumber(rp("chipGap") ?? rp("gap"), 8);
  const chipLineHeight = toNumber(rp("chipLineHeight"), Math.ceil(chipFontSize * 1.35));
  const chipVisible = toBoolean(rp("chipVisible"), true);
  const maxChipCount = toNumber(rp("maxChipCount"), 6);
  const chipLayout = String(unwrapValue(rp("chipLayout"), "Wrap") || "Wrap").toLowerCase();
  const emptyText = unwrapValue(rp("emptyText") ?? rp("emptyTitle"), "No trending searches yet");
  const errorText = unwrapValue(rp("errorText"), "Unable to load trending searches");
  const showEmptyState = toBoolean(rp("emptyStateVisible"), true);

  const bgColor = unwrapValue(rp("bgColor"), "#FFFFFF");
  const containerBorderRadius = toNumber(rp("borderRadius"), 0);
  const borderColor = unwrapValue(rp("borderColor"), "#E5E7EB");
  const borderSide = unwrapValue(rp("borderSide"), "");
  const padding = {
    paddingTop: toNumber(rp("pt"), 0),
    paddingRight: toNumber(rp("pr"), 0),
    paddingBottom: toNumber(rp("pb"), 0),
    paddingLeft: toNumber(rp("pl"), 0),
  };

  const requestLimit = Math.max(1, Math.min(12, Number(maxChipCount) || 6));
  const [searches, setSearches] = useState(() => (useManualSearches ? manualSearches : []));
  const [loading, setLoading] = useState(() => !useManualSearches);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    if (useManualSearches) {
      setSearches(manualSearches);
      setLoading(false);
      setError("");
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError("");

    fetchShopifyTrendingSearches(requestLimit)
      .then((items) => {
        if (!alive) return;
        setSearches(normalizeSearches(items));
      })
      .catch(() => {
        if (!alive) return;
        setSearches([]);
        setError(errorText);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [errorText, manualSearches, requestLimit, useManualSearches]);

  const visibleSearches = useMemo(
    () => searches.slice(0, requestLimit),
    [requestLimit, searches]
  );

  const handleChipPress = useCallback(
    (item) => {
      const query = String(item?.query || item?.text || "").trim();
      if (query) {
        DeviceEventEmitter.emit("mobidrag:search:setQuery", { query });
      }

      const link = item?.link || "";
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

      if (query) {
        navigation.navigate("AllProducts", {
          title: `Search results for "${query}"`,
          query,
        });
      }
    },
    [navigation]
  );

  if (!headingVisible && !chipVisible) return null;
  if (!loading && !error && !visibleSearches.length && !showEmptyState && !headingVisible) {
    return null;
  }

  const isRowLayout = chipLayout === "row";
  const skeletonWidths = [106, 78, 92, 118, 84, 98];

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
            {
              color: headingColor,
              fontSize: headingSize,
              fontWeight: headingWeight,
              fontStyle: headingItalic ? "italic" : "normal",
              textDecorationLine: headingDecorationLine,
              ...headingPadding,
              ...(headingFontFamily ? { fontFamily: headingFontFamily } : null),
            },
          ]}
        >
          {headingText}
        </Text>
      )}

      {loading && chipVisible ? (
        <View
          style={[
            styles.chipList,
            isRowLayout ? styles.chipListRow : null,
            { gap: chipGap },
          ]}
        >
          {Array.from({ length: Math.min(6, Math.max(3, requestLimit)) }).map((_, index) => (
            <View
              key={`trending-skeleton-${index}`}
              style={[
                styles.skeletonChip,
                {
                  width: skeletonWidths[index % skeletonWidths.length],
                  height: chipLineHeight + chipPadding.paddingTop + chipPadding.paddingBottom,
                  borderRadius: chipBorderRadius,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {!loading && error ? (
        <Text style={[styles.statusText, { color: headingColor }]}>{error}</Text>
      ) : null}

      {!loading && !error && chipVisible && visibleSearches.length > 0 ? (
        <View
          style={[
            styles.chipList,
            isRowLayout ? styles.chipListRow : null,
            { gap: chipGap },
          ]}
        >
          {visibleSearches.map((item, index) => (
            <TouchableOpacity
              key={`${item.text}-${index}`}
              activeOpacity={0.75}
              onPress={() => handleChipPress(item)}
              style={[
                styles.chip,
                {
                  backgroundColor: chipBgColor,
                  borderRadius: chipBorderRadius,
                  ...chipPadding,
                  ...(chipBorderWidth > 0
                    ? { borderWidth: chipBorderWidth, borderColor: chipBorderColor }
                    : borderStyleForSide(chipBorderSide, chipBorderColor)),
                },
              ]}
            >
              <Text
                style={{
                  color: chipTextColor,
                  fontSize: chipFontSize,
                  fontWeight: chipFontWeight,
                  lineHeight: chipLineHeight,
                  ...(chipFontFamily ? { fontFamily: chipFontFamily } : null),
                }}
              >
                {item.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {!loading && !error && !visibleSearches.length && showEmptyState ? (
        <Text style={[styles.statusText, { color: headingColor }]}>{emptyText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  heading: {
  },
  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  chipListRow: {
    flexWrap: "nowrap",
  },
  chip: {
    alignSelf: "flex-start",
  },
  skeletonChip: {
    backgroundColor: "#E5E7EB",
    opacity: 0.85,
  },
  statusText: {
    fontSize: 13,
    opacity: 0.7,
  },
});

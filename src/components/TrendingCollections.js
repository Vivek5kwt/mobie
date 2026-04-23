import React, { useMemo } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { resolveTextDecorationLine } from "../utils/textDecoration";

// ─── Deep-unwrap a DSL node ───────────────────────────────────────────────────
const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return value.const;
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return value;
};

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

const normalizeIconName = (name) => {
  if (!name) return "";
  return String(name).replace(/^fa[srldb]?[-_]?/, "");
};

const normalizeCollections = (rawCollections) => {
  let source = rawCollections;
  if (rawCollections?.value) source = rawCollections.value;
  if (rawCollections?.properties?.value) source = rawCollections.properties.value;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        const props = item?.properties || item || {};
        const label = unwrapValue(props?.label ?? props?.name ?? props?.title, "");
        if (!label) return null;
        const image = unwrapValue(
          props?.image ?? props?.imageUrl ?? props?.img ?? props?.src ?? props?.thumbnail,
          ""
        );
        const handle = unwrapValue(
          props?.handle ?? props?.collectionHandle ?? props?.slug ?? props?.id,
          ""
        );
        const link = unwrapValue(props?.link ?? props?.href ?? props?.url, "");
        const iconName = normalizeIconName(
          unwrapValue(props?.iconName ?? props?.icon, "")
        );
        return {
          label,
          image: typeof image === "string" ? image.trim() : "",
          handle: typeof handle === "string" ? handle.trim() : "",
          link: typeof link === "string" ? link.trim() : "",
          iconName,
        };
      })
      .filter(Boolean);
  }

  if (source && typeof source === "object") {
    return Object.values(source)
      .map((item) => {
        const props = item?.properties || item || {};
        const label = unwrapValue(props?.label ?? props?.name ?? props?.title, "");
        if (!label) return null;
        const image = unwrapValue(
          props?.image ?? props?.imageUrl ?? props?.img ?? props?.src ?? props?.thumbnail,
          ""
        );
        const handle = unwrapValue(
          props?.handle ?? props?.collectionHandle ?? props?.slug ?? props?.id,
          ""
        );
        const link = unwrapValue(props?.link ?? props?.href ?? props?.url, "");
        const iconName = normalizeIconName(
          unwrapValue(props?.iconName ?? props?.icon, "")
        );
        return {
          label,
          image: typeof image === "string" ? image.trim() : "",
          handle: typeof handle === "string" ? handle.trim() : "",
          link: typeof link === "string" ? link.trim() : "",
          iconName,
        };
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
  const navigation = useNavigation();

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  // `raw` sub-object — same pattern as TrendingSearches, ProductCarousel, etc.
  const rawData = deepUnwrap(rawProps?.raw) || {};

  // helper: check rawProps first, fall back to rawData
  const rp = (key) => rawProps?.[key] ?? rawData?.[key];

  // Check all possible keys where collections might live
  const collectionsRaw =
    rp("trendingCollections") ??
    rp("collections") ??
    rp("items") ??
    rp("collectionList") ??
    rp("collectionItems") ??
    [];

  const collections = useMemo(
    () => normalizeCollections(collectionsRaw),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(collectionsRaw)]
  );

  if (!collections.length) return null;

  // ── Heading ────────────────────────────────────────────────────────────────
  const headingVisible = toBoolean(rp("headingVisible"), true);
  const headingText = unwrapValue(rp("headingText") ?? rp("title"), "Trending Collections");
  const headingColor = unwrapValue(rp("headingColor"), "#111827");
  const headingSize = toNumber(rp("headingFontSize") ?? rp("titleFontSize"), 18);
  const headingBold = toBoolean(rp("headingBold"), true);
  const headingItalic = toBoolean(rp("headingItalic"), false);
  const headingUnderline = toBoolean(rp("headingUnderline"), false);
  const headingStrikethrough = toBoolean(rp("headingStrikethrough"), false);
  const headingDecorationLine = resolveTextDecorationLine({
    underline: headingUnderline,
    strikethrough: headingStrikethrough,
  });
  const headingWeight = deriveWeight(rp("headingFontWeight"), headingBold ? "700" : "600");
  const headingPaddingTop = toNumber(rp("headingPaddingTop"), 0);
  const headingPaddingBottom = toNumber(rp("headingPaddingBottom"), 10);
  const headingPaddingLeft = toNumber(rp("headingPaddingLeft"), 0);
  const headingPaddingRight = toNumber(rp("headingPaddingRight"), 0);

  // ── Collection item styles ─────────────────────────────────────────────────
  const collectionColor = unwrapValue(rp("collectionColor") ?? rp("labelColor"), "#111827");
  const collectionSize = toNumber(rp("collectionFontSize") ?? rp("labelFontSize"), 12);
  const collectionWeight = deriveWeight(rp("collectionFontWeight") ?? rp("labelFontWeight"), "500");
  const itemGap = toNumber(rp("itemGap") ?? rp("gap"), 16);

  // Circle size: read from DSL or default 68px
  const circleSize = toNumber(rp("collectionCircleSize") ?? rp("circleSize") ?? rp("imageSize"), 68);
  const circleBg = unwrapValue(rp("collectionCircleBgColor") ?? rp("circleBg") ?? rp("imageBg"), "#E5F3F4");
  const circleIconColor = unwrapValue(rp("collectionCircleIconColor") ?? rp("iconColor"), "#0D9488");
  const defaultPlaceholderIcon = normalizeIconName(
    unwrapValue(rp("collectionPlaceholderIcon") ?? rp("placeholderIcon"), "image")
  ) || "image";
  const circleIconSize = toNumber(rp("collectionCircleIconSize") ?? rp("iconSize"), 26);

  // ── Container ─────────────────────────────────────────────────────────────
  const bgColor = unwrapValue(rp("bgColor"), "#FFFFFF");
  const borderRadius = toNumber(rp("borderRadius"), 0);
  const borderColor = unwrapValue(rp("borderColor"), "#E5E7EB");
  const borderSide = unwrapValue(rp("borderSide"), "");

  const padding = {
    paddingTop:    toNumber(rp("pt"), 0),
    paddingRight:  toNumber(rp("pr"), 0),
    paddingBottom: toNumber(rp("pb"), 0),
    paddingLeft:   toNumber(rp("pl"), 0),
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const handlePress = (item) => {
    const handle = item.handle || item.link?.replace(/^\/collections\//, "") || "";
    const link = item.link || "";

    if (handle) {
      navigation.navigate("CollectionProducts", { handle });
    } else if (link.startsWith("/")) {
      const cleaned = link.replace(/^\//, "");
      if (cleaned.startsWith("collections/")) {
        navigation.navigate("CollectionProducts", {
          handle: cleaned.replace("collections/", ""),
        });
      }
    }
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
              textDecorationLine: headingDecorationLine,
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

      {/* Horizontal scroll so items never wrap to a second row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { gap: itemGap }]}
      >
        {collections.map((item, index) => (
          <TouchableOpacity
            key={`${item.label}-${index}`}
            style={styles.item}
            activeOpacity={0.75}
            onPress={() => handlePress(item)}
          >
            {/* Circle */}
            <View
              style={[
                styles.circle,
                {
                  width: circleSize,
                  height: circleSize,
                  borderRadius: circleSize / 2,
                  backgroundColor: circleBg,
                },
              ]}
            >
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={[
                    styles.circleImage,
                    {
                      width: circleSize,
                      height: circleSize,
                      borderRadius: circleSize / 2,
                    },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <Icon
                  name={item.iconName || defaultPlaceholderIcon}
                  size={circleIconSize}
                  color={circleIconColor}
                />
              )}
            </View>

            {/* Label */}
            <Text
              numberOfLines={2}
              style={[
                styles.label,
                {
                  color: collectionColor,
                  fontSize: collectionSize,
                  fontWeight: collectionWeight,
                  maxWidth: circleSize + 16,
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  listContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 4,
  },
  item: {
    alignItems: "center",
    gap: 8,
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  circleImage: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  label: {
    textAlign: "center",
    lineHeight: 16,
  },
});

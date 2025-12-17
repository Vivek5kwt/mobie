import React, { useMemo } from "react";
import { Dimensions, FlatList, Image, StyleSheet, Text, View } from "react-native";
import { convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback = undefined) => {
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

const parseAspectRatio = (value, fallback = 1) => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved || typeof resolved !== "string") return fallback;
  const parts = resolved.split(":").map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] / parts[1];
  }
  return fallback;
};

const normalizeItems = (rawItems) => {
  const source = Array.isArray(rawItems) ? rawItems : Object.values(rawItems || {});
  return source
    .map((item, idx) => {
      const props = item?.properties || item || {};
      const id = unwrapValue(props.id, `item-${idx}`);
      const title = unwrapValue(props.title, "");
      const subtitle = unwrapValue(props.subtitle, "");
      const badge = unwrapValue(props.badge, "");
      const src = unwrapValue(props.src, "");
      const mediaType = unwrapValue(props.mediaType, "image");

      if (!title && !src && !subtitle) return null;
      return { id, title, subtitle, badge, src, mediaType };
    })
    .filter(Boolean);
};

export default function MediaGrid({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};

  const items = useMemo(() => normalizeItems(rawProps?.items || []), [rawProps?.items]);
  if (!items.length) return null;

  const columns = Math.max(1, toNumber(rawProps?.columns, 2));
  const gap = toNumber(rawProps?.cardGap, 8);
  const cardRadius = toNumber(rawProps?.cardRadius, 8);
  const cardAspectRatio = parseAspectRatio(rawProps?.cardAspectRatio, 4 / 5);

  const showHeader = toBoolean(rawProps?.showHeader, true);
  const headerText = unwrapValue(rawProps?.headerText, "Media Gallery");
  const headerSize = toNumber(rawProps?.headerSize, 16);
  const headerColor = unwrapValue(rawProps?.headerColor, "#111827");
  const headerBold = toBoolean(rawProps?.headerBold, false);
  const headerItalic = toBoolean(rawProps?.headerItalic, false);
  const headerUnderline = toBoolean(rawProps?.headerUnderline, false);

  const showButton = toBoolean(rawProps?.showButton, false);
  const buttonLabel = unwrapValue(rawProps?.buttonLabel, "View all");
  const buttonTextColor = unwrapValue(rawProps?.buttonTextColor, "#FFFFFF");
  const buttonBgColor = unwrapValue(rawProps?.buttonBgColor, "#111827");
  const buttonRadius = toNumber(rawProps?.buttonRadius, 4);
  const buttonFontSize = toNumber(rawProps?.buttonFontSize, 12);
  const buttonTextBold = toBoolean(rawProps?.buttonTextBold, false);
  const buttonTextItalic = toBoolean(rawProps?.buttonTextItalic, false);
  const buttonTextUnderline = toBoolean(rawProps?.buttonTextUnderline, false);

  const showCardTitle = toBoolean(rawProps?.showCardTitle, true);
  const cardTitleColor = unwrapValue(rawProps?.cardTitleColor, "#000000");
  const cardTitleSize = toNumber(rawProps?.cardTitleSize, 12);
  const cardTitleWeight = deriveWeight(rawProps?.cardTitleWeight, "500");
  const cardTitleAlign = (unwrapValue(rawProps?.cardTitleAlign, "left") || "left").toLowerCase();

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");

  const containerStyle = convertStyles(layoutCss?.container || {});
  const headerStyle = convertStyles(layoutCss?.header || {});
  const gridStyle = convertStyles(layoutCss?.grid || {});
  const cardStyle = convertStyles(layoutCss?.card || {});
  const mediaStyle = convertStyles(layoutCss?.media || {});
  const buttonStyle = convertStyles(layoutCss?.button || {});
  const cardTitleStyle = convertStyles(layoutCss?.cardTitle || {});

  const contentPadding = {
    paddingTop: toNumber(rawProps?.pt, 16),
    paddingRight: toNumber(rawProps?.pr, 16),
    paddingBottom: toNumber(rawProps?.pb, 16),
    paddingLeft: toNumber(rawProps?.pl, 16),
  };

  const cardWidth = () => {
    const screenWidth = Dimensions.get("window").width;
    const horizontalPadding = (contentPadding.paddingLeft || 0) + (contentPadding.paddingRight || 0);
    const totalGap = gap * (columns - 1);
    return (screenWidth - horizontalPadding - totalGap) / columns;
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        cardStyle,
        {
          width: cardWidth(),
          marginBottom: gap,
          borderRadius: cardRadius,
          overflow: "hidden",
          backgroundColor: cardStyle.backgroundColor || "#F3F4F6",
        },
      ]}
    >
      {toBoolean(rawProps?.showMediaImage, true) && (
        <View style={{ width: "100%", aspectRatio: cardAspectRatio }}>
          {item.src ? (
            <Image source={{ uri: item.src }} style={[styles.media, mediaStyle]} resizeMode="cover" />
          ) : (
            <View style={[styles.placeholder, mediaStyle]}>
              <Text style={styles.placeholderText}>Image</Text>
            </View>
          )}
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </View>
      )}

      {showCardTitle && (
        <Text
          numberOfLines={2}
          style={[
            styles.cardTitle,
            cardTitleStyle,
            {
              color: cardTitleColor,
              fontSize: cardTitleSize,
              fontWeight: cardTitleWeight,
              textAlign: cardTitleAlign,
              padding: 8,
            },
          ]}
        >
          {item.title}
        </Text>
      )}

      {item.subtitle ? (
        <Text style={[styles.subtitle, { textAlign: cardTitleAlign, paddingHorizontal: 8 }]}>
          {item.subtitle}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle, contentPadding]}>
      {showHeader && (
        <Text
          style={[
            styles.header,
            headerStyle,
            {
              color: headerColor,
              fontSize: headerSize,
              fontWeight: headerBold ? "700" : "600",
              fontStyle: headerItalic ? "italic" : "normal",
              textDecorationLine: headerUnderline ? "underline" : "none",
            },
          ]}
        >
          {headerText}
        </Text>
      )}

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={{ columnGap: gap }}
        contentContainerStyle={[{ rowGap: gap }, gridStyle]}
        scrollEnabled={false}
      />

      {showButton && (
        <View style={[styles.buttonRow, { marginTop: 12 }]}> 
          <Text
            style={[
              styles.button,
              buttonStyle,
              {
                color: buttonTextColor,
                backgroundColor: buttonBgColor,
                borderRadius: buttonRadius,
                fontSize: buttonFontSize,
                fontWeight: buttonTextBold ? "700" : "600",
                fontStyle: buttonTextItalic ? "italic" : "normal",
                textDecorationLine: buttonTextUnderline ? "underline" : "none",
              },
            ]}
          >
            {buttonLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
  },
  header: {
    marginBottom: 12,
    fontWeight: "700",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  placeholderText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  card: {
    overflow: "hidden",
  },
  cardTitle: {
    paddingTop: 8,
  },
  subtitle: {
    color: "#4B5563",
    fontSize: 12,
    paddingBottom: 10,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#22C55E",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buttonRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});


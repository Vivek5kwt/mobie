import React from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

const buildInsets = (layout = {}) => ({
  paddingTop: toNumber(layout?.paddingTop, 0),
  paddingRight: toNumber(layout?.paddingRight, 0),
  paddingBottom: toNumber(layout?.paddingBottom, 0),
  paddingLeft: toNumber(layout?.paddingLeft, 0),
});

export default function ProductLibrary({ section }) {
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const layout = unwrapValue(propsNode?.layout, {});
  const raw = unwrapValue(propsNode?.raw, {});

  const css = layout?.css || {};
  const outer = css?.outer || {};
  const classNames = css?.classNames || {};
  const visibility = css?.visibility || {};

  const resolvedImageUrl = toString(raw?.imageUrl, "");
  const showRating = toBoolean(raw?.showRating, true);
  const ratingText = toString(raw?.ratingText, "0");
  const ratingCountText = toString(raw?.ratingCountText, "(0)");

  const containerStyle = [
    styles.container,
    {
      backgroundColor: toString(outer?.background, "#ffffff"),
      borderColor: toString(outer?.borderColor, "#e5e7eb"),
      borderRadius: toNumber(outer?.borderRadius, 0),
      borderWidth: outer?.borderLine ? 1 : 0,
    },
    buildInsets(outer),
  ];

  const screenWidth = Dimensions.get("window").width;
  const metrics = layout?.metrics?.elements || {};
  const imageMetrics = metrics?.image || {};
  const imageWidth = imageMetrics?.width ? Number(imageMetrics.width) : screenWidth - 32;
  const imageHeight = imageMetrics?.height ? Number(imageMetrics.height) : 220;

  const ratingVisible = toBoolean(visibility?.reviews, showRating);
  const shareVisible = toBoolean(visibility?.share, true);
  const favouriteVisible = toBoolean(visibility?.favourite, true);

  return (
    <View style={containerStyle}>
      <View style={styles.imageWrap}>
        {resolvedImageUrl ? (
          <Image
            source={{ uri: resolvedImageUrl }}
            style={[styles.image, { width: imageWidth, height: imageHeight }]}
            resizeMode="cover"
            accessibilityLabel="Product"
          />
        ) : (
          <View style={[styles.imagePlaceholder, { width: imageWidth, height: imageHeight }]}>
            <Text style={styles.placeholderText}>Product image</Text>
          </View>
        )}

        {favouriteVisible && (
          <View style={[styles.iconBubble, styles.favoriteBubble]}>
            <Text style={styles.iconText}>❤</Text>
          </View>
        )}

        {shareVisible && (
          <View style={[styles.iconBubble, styles.shareBubble]}>
            <Text style={styles.iconText}>⇪</Text>
          </View>
        )}

        {ratingVisible && (
          <View style={styles.ratingBubble}>
            <Text style={styles.ratingStar}>★</Text>
            <Text style={styles.ratingText}>
              {ratingText} {ratingCountText}
            </Text>
          </View>
        )}
      </View>

      {!!classNames && (
        <Text style={styles.debugLabel}>
          {classNames.container ? `.${classNames.container}` : "Product Library"}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 16,
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  imagePlaceholder: {
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 12,
  },
  iconBubble: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5f3f4",
  },
  iconText: {
    fontSize: 14,
    color: "#111827",
  },
  favoriteBubble: {
    top: 16,
    right: 16,
  },
  shareBubble: {
    top: 64,
    right: 16,
  },
  ratingBubble: {
    position: "absolute",
    left: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingStar: {
    fontSize: 12,
    color: "#111827",
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    color: "#111827",
  },
  debugLabel: {
    marginTop: 12,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
});

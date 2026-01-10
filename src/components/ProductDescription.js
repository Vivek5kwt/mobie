import React from "react";
import { StyleSheet, Text, View } from "react-native";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

export default function ProductDescription({ section }) {
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const title = unwrapValue(propsNode?.title, {});
  const info = unwrapValue(propsNode?.info, {});
  const visibility = unwrapValue(propsNode?.visibility, {});

  const titleText = toString(title?.text, raw?.title || "Description");
  const descriptionText = toString(
    raw?.description || raw?.descriptionText,
    info?.descriptionText || ""
  );

  const resolvedPaddingTop = (() => {
    const value = toNumber(info?.paddingTop, 16);
    return value === 0 ? 16 : value;
  })();
  const resolvedPaddingRight = (() => {
    const value = toNumber(info?.paddingRight, 16);
    return value === 0 ? 16 : value;
  })();
  const resolvedPaddingBottom = (() => {
    const value = toNumber(info?.paddingBottom, 16);
    return value === 0 ? 16 : value;
  })();
  const resolvedPaddingLeft = (() => {
    const value = toNumber(info?.paddingLeft, 16);
    return value === 0 ? 16 : value;
  })();

  const showTitle = toBoolean(visibility?.title, true);
  const showDescription = toBoolean(visibility?.infoDescription, true);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: toString(info?.backgroundColor, "#ffffff"),
          paddingTop: resolvedPaddingTop,
          paddingRight: resolvedPaddingRight,
          paddingBottom: resolvedPaddingBottom,
          paddingLeft: resolvedPaddingLeft,
        },
      ]}
    >
      {showTitle && (
        <Text
          style={[
            styles.title,
            {
              fontSize: toNumber(title?.style?.fontSize, 14),
              color: toString(title?.style?.color, "#111827"),
              fontWeight: toString(title?.style?.fontWeight, "700"),
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {showDescription && !!descriptionText && (
        <Text
          style={[
            styles.description,
            {
              fontSize: toNumber(info?.descriptionStyle?.fontSize, 12),
              color: toString(info?.descriptionStyle?.color, "#6B7280"),
              fontWeight: toString(info?.descriptionStyle?.fontWeight, "400"),
              fontStyle: toBoolean(info?.descriptionStyle?.italic, false)
                ? "italic"
                : "normal",
              textDecorationLine: toBoolean(info?.descriptionStyle?.underline, false)
                ? "underline"
                : "none",
            },
          ]}
        >
          {descriptionText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 0,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    lineHeight: 18,
  },
});

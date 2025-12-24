import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const asBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof resolved === "number") return resolved !== 0;
  return fallback;
};

export default function TextBlock({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const iconCfg = rawProps?.icon?.properties || rawProps?.icon || {};
  const styleCfg = rawProps?.style?.properties || rawProps?.style || {};
  const alignmentCfg =
    rawProps?.alignmentAndPadding?.properties || rawProps?.alignmentAndPadding || {};

  const showIcon = asBoolean(rawProps?.showIcon, true);
  const showHeadline = asBoolean(rawProps?.showHeadline, true);
  const showSubtext = asBoolean(rawProps?.showSubtext, true);

  const headline = unwrapValue(rawProps?.headline, "");
  const subtext = unwrapValue(rawProps?.subtext, "");

  const headlineStyle = convertStyles(layoutCss.headline || {});
  const subtextStyle = convertStyles(layoutCss.subtext || {});
  const containerStyle = convertStyles({
    ...layoutCss.container,
    padding: alignmentCfg?.padding?.value ?? layoutCss.container?.padding,
  });
  const iconStyle = convertStyles(layoutCss.icon || {});
  const overrideStyle = convertStyles({
    backgroundColor: unwrapValue(styleCfg?.bgColor),
    borderColor: unwrapValue(styleCfg?.borderColor),
    borderRadius: unwrapValue(styleCfg?.borderRadius),
    backgroundOpacity: unwrapValue(styleCfg?.backgroundOpacity),
  });

  const iconEmoji = unwrapValue(iconCfg?.emoji, "");
  const iconColor = unwrapValue(iconCfg?.color, iconStyle?.color || "#FFFFFF");
  const iconSize = unwrapValue(iconCfg?.width, iconStyle?.width || 20);

  const textContainerStyle = [styles.textContainer, { flex: 1 }];
  const resolvedHeadlineLines = headlineStyle?.numberOfLines || undefined;
  const resolvedSubtextLines = subtextStyle?.numberOfLines || undefined;

  const hasIcon = showIcon && !!iconEmoji;
  const hasHeadline = showHeadline && !!headline;
  const hasSubtext = showSubtext && !!subtext;

  if (!hasIcon && !hasHeadline && !hasSubtext) {
    return null;
  }

  return (
    <View style={[styles.container, containerStyle, overrideStyle]}>
      {hasIcon && (
        <View
          style={[
            styles.icon,
            iconStyle,
            {
              width: iconSize,
              height: iconSize,
              minWidth: iconSize,
              minHeight: iconSize,
              backgroundColor: iconStyle?.backgroundColor || "#16A34A",
            },
          ]}
        >
          <Text style={[styles.iconText, { color: iconColor, fontSize: iconStyle?.fontSize || 14 }]}>
            {iconEmoji}
          </Text>
        </View>
      )}

      <View style={textContainerStyle}>
        {showHeadline && !!headline && (
          <Text
            numberOfLines={resolvedHeadlineLines}
            style={[styles.headline, headlineStyle]}
            ellipsizeMode="tail"
          >
            {headline}
          </Text>
        )}

        {showSubtext && !!subtext && (
          <Text
            numberOfLines={resolvedSubtextLines}
            style={[styles.subtext, subtextStyle]}
            ellipsizeMode="tail"
          >
            {subtext}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#096d70",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  icon: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 999,
  },
  iconText: {
    fontWeight: "700",
  },
  textContainer: {
    flexDirection: "column",
    gap: 4,
  },
  headline: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "600",
  },
  subtext: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "400",
  },
});

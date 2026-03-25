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

const asNumber = (value, fallback = undefined) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parsePx = (v) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(String(v).replace(/px/g, "").trim());
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

const resolveWeight = (weightStr) => {
  if (!weightStr) return undefined;
  const w = String(weightStr).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semi bold" || w === "semibold") return "600";
  if (w === "medium") return "500";
  if (w === "regular" || w === "normal") return "400";
  if (w === "light") return "300";
  if (/^\d+$/.test(w)) return w;
  return undefined;
};

// Strip web-only / layout-breaking CSS props before applying to RN Text elements.
// e.g. maxWidth:"0%" collapses text to zero width; overflow/whiteSpace are web-only.
const stripTextCss = (style) => {
  if (!style) return {};
  const {
    maxWidth, minWidth,
    overflow, whiteSpace, textOverflow,
    numberOfLines,
    display,
    ...rest
  } = style;
  return rest;
};

const applyTextAttributes = (baseStyle, attributes) => {
  const attrs = attributes || {};
  const next = { ...(baseStyle || {}) };

  const size = asNumber(attrs.size, undefined);
  if (size != null) next.fontSize = size;

  const color = unwrapValue(attrs.color, undefined);
  if (color) next.color = color;

  // Read weight string first ("Bold", "Regular", etc.), fall back to bold boolean
  const weightAttr = resolveWeight(unwrapValue(attrs.weight, undefined));
  if (weightAttr) {
    next.fontWeight = weightAttr;
  } else if (asBoolean(attrs.bold, undefined) === true) {
    next.fontWeight = "700";
  }

  const italic = asBoolean(attrs.italic, undefined);
  if (italic === true) next.fontStyle = "italic";

  const underline = asBoolean(attrs.underline, undefined);
  const strikethrough = asBoolean(attrs.strikethrough, undefined);
  if (underline || strikethrough) {
    if (underline && strikethrough) {
      next.textDecorationLine = "underline line-through";
    } else if (underline) {
      next.textDecorationLine = "underline";
    } else {
      next.textDecorationLine = "line-through";
    }
  }

  const fontFamily = unwrapValue(attrs.fontFamily, undefined);
  if (fontFamily) next.fontFamily = fontFamily;

  return next;
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

  const paddingRaw = alignmentCfg?.paddingRaw?.properties || alignmentCfg?.paddingRaw || {};

  const rawContainerStyle = convertStyles(layoutCss.container || {});
  // Remove web layout props that conflict with RN flex layout for the TextBlock row
  const {
    justifyContent: _jc,  // DSL sends "flex-end" but text must stay centered
    overflow: _ov,
    display: _disp,
    ...safeContainerStyle
  } = rawContainerStyle;
  const containerStyle = {
    ...safeContainerStyle,
    paddingTop: asNumber(paddingRaw?.pt, safeContainerStyle.paddingTop),
    paddingRight: asNumber(paddingRaw?.pr, safeContainerStyle.paddingRight),
    paddingBottom: asNumber(paddingRaw?.pb, safeContainerStyle.paddingBottom),
    paddingLeft: asNumber(paddingRaw?.pl, safeContainerStyle.paddingLeft),
  };

  const baseHeadlineStyle = stripTextCss(convertStyles(layoutCss.headline || {}));
  const baseSubtextStyle = stripTextCss(convertStyles(layoutCss.subtext || {}));
  const iconStyle = convertStyles(layoutCss.icon || {});
  const overrideBgColor = unwrapValue(styleCfg?.bgColor);
  const overrideBorderColor = unwrapValue(styleCfg?.borderColor);
  const overrideBorderRadius =
    parsePx(unwrapValue(styleCfg?.borderRadius)) ??
    parsePx(baseContainerStyle?.borderRadius);

  const overrideStyle = {
    ...(overrideBgColor ? { backgroundColor: overrideBgColor } : {}),
    ...(overrideBorderColor
      ? { borderColor: overrideBorderColor, borderWidth: 1 }
      : { borderWidth: 0 }),
    ...(overrideBorderRadius != null ? { borderRadius: overrideBorderRadius } : {}),
  };

  const headlineAttributes =
    rawProps?.headlineAttributes?.properties || rawProps?.headlineAttributes || {};
  const subtextAttributes =
    rawProps?.subtextAttributes?.properties || rawProps?.subtextAttributes || {};

  const headlineStyle = applyTextAttributes(baseHeadlineStyle, headlineAttributes);
  const subtextStyle = applyTextAttributes(baseSubtextStyle, subtextAttributes);

  const iconEmoji = unwrapValue(iconCfg?.emoji, "");
  const iconColor = unwrapValue(iconCfg?.color, iconStyle?.color || "#FFFFFF");
  const iconSize = unwrapValue(iconCfg?.width, iconStyle?.width || 20);

  const headtextAlign = unwrapValue(rawProps?.headtextAlign, null);
  const subtextAlign = unwrapValue(rawProps?.subtextAlign, null);

  const textContainerStyle = [styles.textContainer, { flex: 1 }];

  const rawHeadlineLines = asNumber(rawProps?.headlineHeight, undefined);
  const rawSubtextLines = asNumber(rawProps?.subtextHeight, undefined);

  const resolvedHeadlineLines =
    rawHeadlineLines && rawHeadlineLines > 0 ? rawHeadlineLines : undefined;
  const resolvedSubtextLines =
    rawSubtextLines && rawSubtextLines > 0 ? rawSubtextLines : undefined;

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
            style={[
              styles.headline,
              headlineStyle,
              headtextAlign
                ? { textAlign: String(headtextAlign).toLowerCase() }
                : null,
            ]}
            ellipsizeMode="tail"
          >
            {headline}
          </Text>
        )}

        {showSubtext && !!subtext && (
          <Text
            numberOfLines={resolvedSubtextLines}
            style={[
              styles.subtext,
              subtextStyle,
              subtextAlign
                ? { textAlign: String(subtextAlign).toLowerCase() }
                : null,
            ]}
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
    backgroundColor: "#FFFFFF",
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

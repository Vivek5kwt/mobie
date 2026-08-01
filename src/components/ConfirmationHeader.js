import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Icon6 from "react-native-vector-icons/FontAwesome6";
import FA6GlyphMap from "react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import { resolveFont } from "../services/typographyService";

const CUSTOM_ICON_PREFIX = "custom-icon::";

// Builder's icon picker (IconDropdownField, used by
// blocks/ConfirmationHeader/InspectorLive.tsx) lets a merchant upload a
// custom icon image instead of picking a FontAwesome name — that value is
// stored as "custom-icon::<encoded-url>", which isn't a valid glyph name, so
// rendering it via <FontAwesome> shows nothing at all.
const getCustomIconUrlFromValue = (value) => {
  const raw = String(value || "");
  if (!raw.startsWith(CUSTOM_ICON_PREFIX)) return null;
  const encoded = raw.slice(CUSTOM_ICON_PREFIX.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
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

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

// Builder's ConfirmationHeader Inspector/PreviewLive give *Bold priority over
// the numeric *FontWeight when set (see blocks/ConfirmationHeader/PreviewLive.tsx:
// `fontWeight: safeValue.titleBold ? 700 : safeValue.titleFontWeight ?? 400`).
const toFontWeight = (boldValue, weightValue, fallback = "700") => {
  if (toBoolean(boldValue, false)) return "700";
  const resolved = unwrapValue(weightValue, undefined);
  if (!resolved && resolved !== 0) return fallback;
  const w = String(resolved).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium" || w === "500") return "500";
  if (w === "regular" || w === "normal" || w === "400") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

// Builder's icon picker (IconDropdownField) offers the full FontAwesome 6
// free-solid/free-regular library, saving ids like "fa-shield-halved" or
// "fa-regular fa-heart" — a two-word style+name pair for regular-style icons
// (mirrors SearchBar.js's normalizeIconId). Strip the style token and "fa-"
// prefix to get the bare FA6 glyph name.
const normalizeIconId = (value) => {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  const withoutStyle = trimmed.replace(/^fa-(solid|regular|light|brands|brand|thin|duotone|sharp)\s+/, "");
  return withoutStyle.replace(/^fa-/, "");
};

const toAlign = (value, fallback = "center") => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  return "center";
};

const buildRawProps = (rawProps = {}) => {
  const rawBlock = unwrapValue(rawProps.raw, {});
  const resolvedRaw =
    rawBlock && typeof rawBlock === "object" && rawBlock.value !== undefined
      ? rawBlock.value
      : (rawBlock || {});
  // Merge top-level props + raw block so both DSL shapes are supported.
  return {
    ...(rawProps || {}),
    ...(resolvedRaw && typeof resolvedRaw === "object" ? resolvedRaw : {}),
  };
};

// Mirrors Builder's blocks/ConfirmationHeader/PreviewLive.tsx getBorderStyle().
const buildBorderStyle = (line, color, width) => {
  const normalizedLine = String(line || "none").toLowerCase();
  if (!normalizedLine || normalizedLine === "none") return { borderWidth: 0 };
  if (normalizedLine === "all") return { borderWidth: width, borderColor: color };
  return {
    borderTopWidth: normalizedLine === "top" ? width : 0,
    borderBottomWidth: normalizedLine === "bottom" ? width : 0,
    borderLeftWidth: normalizedLine === "left" ? width : 0,
    borderRightWidth: normalizedLine === "right" ? width : 0,
    borderColor: color,
  };
};

export default function ConfirmationHeader({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = buildRawProps(rawProps);

  // ── Background / Border / Padding ("Background & Padding" panel) ────────────
  const bgPadVisible = toBoolean(raw?.bgPadVisible, true);
  const cardBgColor = toString(raw?.cardBgColor, "#FFFFFF");
  const borderColor = toString(raw?.borderColor, "#000000");
  const borderRadius = bgPadVisible ? toNumber(raw?.borderRadius, 0) : 0;
  const borderWidth = toNumber(raw?.borderWidth, 1);
  const borderLine = toString(raw?.borderLine, "none").toLowerCase();
  const borderStyle = bgPadVisible ? buildBorderStyle(borderLine, borderColor, borderWidth) : { borderWidth: 0 };
  const pt = bgPadVisible ? toNumber(raw?.bgpt, 16) : 0;
  const pb = bgPadVisible ? toNumber(raw?.bgpb, 16) : 0;
  const pl = bgPadVisible ? toNumber(raw?.bgpl, 16) : 0;
  const pr = bgPadVisible ? toNumber(raw?.bgpr, 16) : 0;

  const align = toAlign(raw?.align, "center");
  const textAlign = align;
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Icon
  const iconVisible = toBoolean(raw?.iconVisible, true);
  const rawIconValue = toString(raw?.iconName, "fa-thumbs-up");
  const customIconUrl = getCustomIconUrlFromValue(rawIconValue);
  const iconNameRaw = normalizeIconId(rawIconValue) || "thumbs-up";
  const iconName = Object.prototype.hasOwnProperty.call(FA6GlyphMap, iconNameRaw)
    ? iconNameRaw
    : "thumbs-up";
  const iconSize = toNumber(raw?.iconSize, 24);
  const iconColor = toString(raw?.iconColor, "#FFFFFF");
  const iconBgColor = toString(raw?.iconBgColor, "#20D380");
  const shape = toString(raw?.shape, "circle").toLowerCase();
  const iconBgSize = 72;
  const iconBgRadius = shape === "circle" ? iconBgSize / 2 : 12;

  // Title
  const showTitle = toBoolean(raw?.showTitle, true);
  const titleText = toString(raw?.title ?? raw?.titleText, "Thank You For Your Order");
  const titleColor = toString(raw?.titleColor, "#000000");
  const titleSize = toNumber(raw?.titleSize, 32);
  const titleWeight = toFontWeight(raw?.titleBold, raw?.titleFontWeight, "700");
  const titleFontFamily = resolveFont(toString(raw?.titleFontFamily, ""));
  const titleItalic = toBoolean(raw?.titleItalic, false);
  const titleLineHeight = toNumber(raw?.titleLineHeight, 1.3) * titleSize;
  const titleLetterSpacing = toNumber(raw?.titleLetterSpacing, 0);
  const titleTextDecoration = [
    toBoolean(raw?.titleUnderline, false) ? "underline" : "",
    toBoolean(raw?.titleStrikethrough, false) ? "line-through" : "",
  ].filter(Boolean).join(" ");

  // Sub heading — text content comes from `subtext` (injected with the real
  // order number by PostPurchaseScreen.js); styling uses the "subTitle*"
  // names Builder's Inspector/PreviewLive actually write/read.
  const showSubtext = toBoolean(raw?.showSubTitle, true);
  const subtextText = toString(raw?.subtext ?? raw?.subtextText, "");
  const subtextColor = toString(raw?.subTitleColor, "#6B7280");
  const subtextSize = toNumber(raw?.subTitleSize, 14);
  const subtextWeight = toFontWeight(false, raw?.subTitleFontWeight, "400");
  const subtextFontFamily = resolveFont(toString(raw?.subTitleFontFamily, ""));
  const subtextItalic = toBoolean(raw?.subTitleItalic, false);
  const subtextAlign = toAlign(raw?.subTitleAlign, align);
  const subtextLineHeight = toNumber(raw?.subTitleLineHeight, 1.5) * subtextSize;
  const subtextLetterSpacing = toNumber(raw?.subTitleLetterSpacing, 0);
  const subtextTextDecoration = [
    toBoolean(raw?.subTitleUnderline, false) ? "underline" : "",
    toBoolean(raw?.subTitleStrikethrough, false) ? "line-through" : "",
  ].filter(Boolean).join(" ");

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgPadVisible ? cardBgColor : "transparent",
          paddingTop: pt,
          paddingBottom: pb,
          paddingLeft: pl,
          paddingRight: pr,
          borderRadius,
          alignItems,
        },
        borderStyle,
      ]}
    >
      {/* Icon bubble */}
      {iconVisible && (
        <View
          style={[
            styles.iconBubble,
            {
              width: iconBgSize,
              height: iconBgSize,
              borderRadius: iconBgRadius,
              backgroundColor: iconBgColor,
              marginBottom: 16,
            },
          ]}
        >
          {customIconUrl ? (
            <Image
              source={{ uri: customIconUrl }}
              style={{ width: iconSize, height: iconSize, resizeMode: "contain" }}
            />
          ) : (
            <Icon6 name={iconName} size={iconSize} color={iconColor} />
          )}
        </View>
      )}

      {/* Title */}
      {showTitle && !!titleText && (
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: titleSize,
              fontWeight: titleWeight,
              fontStyle: titleItalic ? "italic" : "normal",
              textAlign,
              lineHeight: titleLineHeight,
              letterSpacing: titleLetterSpacing,
              ...(titleTextDecoration ? { textDecorationLine: titleTextDecoration } : {}),
              ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* Subtext */}
      {showSubtext && !!subtextText && (
        <Text
          style={[
            styles.subtext,
            {
              color: subtextColor,
              fontSize: subtextSize,
              fontWeight: subtextWeight,
              fontStyle: subtextItalic ? "italic" : "normal",
              textAlign: subtextAlign,
              lineHeight: subtextLineHeight,
              letterSpacing: subtextLetterSpacing,
              ...(subtextTextDecoration ? { textDecorationLine: subtextTextDecoration } : {}),
              ...(subtextFontFamily ? { fontFamily: subtextFontFamily } : {}),
            },
          ]}
        >
          {subtextText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  iconBubble: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    marginBottom: 8,
  },
  subtext: {
    marginTop: 4,
  },
});

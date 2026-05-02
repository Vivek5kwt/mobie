import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import FontAwesome6 from "react-native-vector-icons/FontAwesome6";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";

// ─── DSL helpers ──────────────────────────────────────────────────────────────

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

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(String(resolved).replace("px", ""));
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return ["true", "1", "yes", "y"].includes(resolved.trim().toLowerCase());
  return Boolean(resolved);
};

const hasVisibleBorder = (line, width, color) => {
  const l = toString(line, "").trim().toLowerCase();
  if (l === "none" || l === "false" || l === "0") return false;
  if (width > 0) return true;
  const c = toString(color, "").trim().toLowerCase();
  return !!c && c !== "transparent";
};

// Strip "fa-" / "fas-" / "far-" prefix, return bare icon name
const stripFaPrefix = (v) =>
  v ? String(v).trim().replace(/^fa[srldb]?[-_]/i, "").toLowerCase() : "";

// ─── Icon renderer — FA4 first, FA6 fallback ──────────────────────────────────

function DescIcon({ rawName, size, color, style }) {
  if (!rawName) return null;
  const bare  = stripFaPrefix(rawName);
  const fa4   = resolveFA4IconName(bare);
  if (fa4) {
    return <FontAwesome name={fa4} size={size} color={color} style={style} />;
  }
  try {
    return <FontAwesome6 name={bare} size={size} color={color} style={style} />;
  } catch {
    return <FontAwesome name="info-circle" size={size} color={color} style={style} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductDescription({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw        = unwrapValue(propsNode?.raw, {}) || {};
  const titleNode  = unwrapValue(propsNode?.title, {});
  const infoNode   = unwrapValue(propsNode?.info, {});
  const outerNode  = unwrapValue(propsNode?.outer, {});
  const iconNode   = unwrapValue(propsNode?.icon, {});
  const visNode    = unwrapValue(propsNode?.visibility, {});

  // Both layout and presentation carry the same CSS snapshot — prefer layout
  const layoutCss = (() => {
    const l = unwrapValue(propsNode?.layout, {});
    return unwrapValue(l?.css, l?.css) || unwrapValue(l?.properties?.css, l?.properties?.css) || {};
  })();
  const presCss = (() => {
    const p = unwrapValue(propsNode?.presentation, {});
    return unwrapValue(p?.css, p?.css) || unwrapValue(p?.properties?.css, p?.properties?.css) || {};
  })();

  // ── Text content ───────────────────────────────────────────────────────────
  const titleText = toString(
    titleNode?.text ?? raw?.title,
    "Description"
  );
  const descriptionText = toString(
    raw?.description ?? raw?.descriptionText ?? infoNode?.descriptionText,
    ""
  );

  if (!descriptionText && !titleText) return null;

  // ── Visibility ─────────────────────────────────────────────────────────────
  const showTitle       = toBoolean(visNode?.title,           true);
  const showDescription = toBoolean(visNode?.infoDescription, true);
  const showIcon        = toBoolean(visNode?.icon,            true);

  // ── Icon ───────────────────────────────────────────────────────────────────
  // raw.dropdownIconValue is what the builder sets when the user picks an icon
  // propsNode.icon.icon is the DSL-level default
  // layoutCss.icon.icon / presCss.icon.icon are CSS-snapshot values
  const rawIconVal  = toString(
    raw?.dropdownIconValue ?? raw?.iconId ?? raw?.icon ?? raw?.iconStyle?.icon,
    ""
  );
  const iconNodeVal = toString(iconNode?.icon ?? iconNode?.value, "");
  const cssIconVal  = toString(layoutCss?.icon?.icon ?? presCss?.icon?.icon, "");
  const resolvedIconRaw = rawIconVal || iconNodeVal || cssIconVal || "fa-circle-info";

  // Icon color — raw.dropdownIconColor overrides the node/css color
  const iconColor = (() => {
    const fromRaw  = toString(raw?.dropdownIconColor ?? raw?.iconColor ?? raw?.iconStyle?.color, "");
    const fromNode = toString(iconNode?.color, "");
    const fromCss  = toString(layoutCss?.icon?.color ?? presCss?.icon?.color, "");
    return fromRaw || fromNode || fromCss || "#096d70";
  })();

  // Icon size — try raw keys, then icon node, then CSS fontSize
  const iconSize = (() => {
    const fromRaw  = toNumber(raw?.dropdownIconSize ?? raw?.iconSize ?? raw?.iconStyle?.size, undefined);
    const fromNode = toNumber(iconNode?.size, undefined);
    const fromCss  = toNumber(layoutCss?.icon?.fontSize ?? presCss?.icon?.fontSize, undefined);
    return fromRaw ?? fromNode ?? fromCss ?? 16;
  })();

  // ── Arrow / chevron colour ─────────────────────────────────────────────────
  const arrowColor = toString(
    layoutCss?.arrow?.color ?? presCss?.arrow?.color ?? raw?.arrowColor,
    "#111827"
  );
  const arrowSize = toNumber(
    layoutCss?.arrow?.fontSize ?? presCss?.arrow?.fontSize ?? raw?.arrowSize,
    14
  );

  // ── Container (outer) ─────────────────────────────────────────────────────
  const outerPT = toNumber(raw?.paddingTop    ?? outerNode?.paddingTop    ?? layoutCss?.container?.paddingTop,    0);
  const outerPB = toNumber(raw?.paddingBottom ?? outerNode?.paddingBottom ?? layoutCss?.container?.paddingBottom, 0);
  const outerPL = toNumber(raw?.paddingLeft   ?? outerNode?.paddingLeft   ?? layoutCss?.container?.paddingLeft,   0);
  const outerPR = toNumber(raw?.paddingRight  ?? outerNode?.paddingRight  ?? layoutCss?.container?.paddingRight,  0);
  const outerBg = toString(
    raw?.backgroundColor ??
    outerNode?.backgroundColor ?? outerNode?.background ??
    layoutCss?.container?.background ?? layoutCss?.container?.backgroundColor,
    "#FFFFFF"
  );
  const outerRadius = toNumber(
    raw?.corners ?? outerNode?.corners ?? outerNode?.borderRadius ?? layoutCss?.container?.borderRadius,
    0
  );
  const outerBorderColor = toString(
    raw?.borderColor ?? outerNode?.borderColor ?? layoutCss?.container?.borderColor,
    "#E5E7EB"
  );
  const outerBorderWidth = toNumber(
    raw?.borderWidth ?? outerNode?.borderWidth ?? layoutCss?.container?.borderWidth,
    1
  );
  const outerBorderLine = toString(
    raw?.borderLine ?? outerNode?.borderLine ?? layoutCss?.container?.borderLine,
    ""
  );
  const outerShouldBorder = hasVisibleBorder(outerBorderLine, outerBorderWidth, outerBorderColor);

  // ── Header row paddingTop ─────────────────────────────────────────────────
  const headerPT = toNumber(
    raw?.paddingTop ?? outerNode?.paddingTop ?? layoutCss?.headerRow?.paddingTop ?? presCss?.headerRow?.paddingTop,
    0
  );

  // ── Info box ──────────────────────────────────────────────────────────────
  const infoPT = toNumber(infoNode?.paddingTop    ?? layoutCss?.infoBox?.paddingTop,    0);
  const infoPB = toNumber(infoNode?.paddingBottom ?? layoutCss?.infoBox?.paddingBottom, 0);
  const infoPL = toNumber(infoNode?.paddingLeft   ?? layoutCss?.infoBox?.paddingLeft,   0);
  const infoPR = toNumber(infoNode?.paddingRight  ?? layoutCss?.infoBox?.paddingRight,  0);
  const infoBg = toString(
    infoNode?.backgroundColor ?? infoNode?.background ??
    layoutCss?.infoBox?.background ?? layoutCss?.infoBox?.backgroundColor,
    "#FFFFFF"
  );

  // ── Title style ────────────────────────────────────────────────────────────
  const titleStyle     = unwrapValue(titleNode?.style, {});
  const titleFontSize  = toNumber(titleStyle?.fontSize ?? layoutCss?.title?.fontSize, 14);
  const titleColor     = toString(titleStyle?.color    ?? layoutCss?.title?.color,    "#111827");
  const titleWeight    = (() => {
    const v = toString(titleStyle?.fontWeight ?? layoutCss?.title?.fontWeight, "700");
    return v;
  })();
  const titleFontFamily = cleanFontFamily(toString(titleStyle?.fontFamily ?? layoutCss?.title?.fontFamily, ""));
  const titleItalic         = toBoolean(titleStyle?.italic,        false);
  const titleUnderline      = toBoolean(titleStyle?.underline,     false);
  const titleStrikethrough  = toBoolean(titleStyle?.strikethrough, false);
  const titleDecorationLine = resolveTextDecorationLine({ underline: titleUnderline, strikethrough: titleStrikethrough });

  // ── Body (description) style ───────────────────────────────────────────────
  const descStyle      = unwrapValue(infoNode?.descriptionStyle, {});
  const bodyFontSize   = toNumber(descStyle?.fontSize ?? layoutCss?.infoText?.fontSize, 12);
  const bodyColor      = toString(descStyle?.color    ?? layoutCss?.infoText?.color,    "#6B7280");
  const bodyWeight     = toString(descStyle?.fontWeight ?? layoutCss?.infoText?.fontWeight, "400");
  const bodyFontFamily = cleanFontFamily(toString(descStyle?.fontFamily ?? layoutCss?.infoText?.fontFamily, ""));
  const bodyItalic        = toBoolean(descStyle?.italic,    false);
  const bodyUnderline     = toBoolean(descStyle?.underline, false);
  const bodyStrikethrough = toBoolean(descStyle?.strikethrough, false);
  const bodyDecorationLine = resolveTextDecorationLine({ underline: bodyUnderline, strikethrough: bodyStrikethrough });
  const bodyLineHeight    = toNumber(layoutCss?.infoText?.lineHeight, 1.5);

  // ── Accordion state ────────────────────────────────────────────────────────
  const defaultOpen = toBoolean(raw?.defaultOpen, false);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={{
        width:           "100%",
        backgroundColor: outerBg,
        borderRadius:    outerRadius,
        borderWidth:     outerShouldBorder ? outerBorderWidth : 0,
        borderColor:     outerBorderColor,
        paddingTop:      outerPT,
        paddingBottom:   outerPB,
        paddingLeft:     outerPL,
        paddingRight:    outerPR,
      }}
    >
      {/* ── Accordion header ──────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.headerRow, { paddingTop: headerPT }]}
        activeOpacity={0.75}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? "Collapse description" : "Expand description"}
      >
        <View style={styles.titleRow}>
          {showTitle && (
            <Text
              style={{
                fontSize:           titleFontSize,
                color:              titleColor,
                fontWeight:         String(titleWeight),
                fontStyle:          titleItalic ? "italic" : "normal",
                textDecorationLine: titleDecorationLine,
                flex:               1,
                ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
              }}
            >
              {titleText}
            </Text>
          )}
        </View>

        {/* Dropdown toggle icon — custom icon replaces the default chevron */}
        {showIcon && resolvedIconRaw ? (
          <DescIcon
            rawName={resolvedIconRaw}
            size={iconSize}
            color={iconColor}
          />
        ) : (
          <FontAwesome
            name={open ? "chevron-up" : "chevron-down"}
            size={arrowSize}
            color={arrowColor}
          />
        )}
      </TouchableOpacity>

      {/* ── Description body ──────────────────────────────────────────────── */}
      {open && showDescription && !!descriptionText && (
        <View
          style={{
            backgroundColor: infoBg,
            paddingTop:      infoPT || 10,
            paddingBottom:   infoPB,
            paddingLeft:     infoPL,
            paddingRight:    infoPR,
          }}
        >
          <Text
            style={{
              fontSize:           bodyFontSize,
              color:              bodyColor,
              fontWeight:         String(bodyWeight),
              fontStyle:          bodyItalic ? "italic" : "normal",
              textDecorationLine: bodyDecorationLine,
              lineHeight:         bodyFontSize * bodyLineHeight,
              ...(bodyFontFamily ? { fontFamily: bodyFontFamily } : {}),
            }}
          >
            {descriptionText}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingBottom:  16,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems:    "center",
    flex:          1,
  },
});

import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveTextDecorationLine } from "../utils/textDecoration";

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
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw        = unwrapValue(propsNode?.raw, {});
  const titleCss   = unwrapValue(propsNode?.title, {});
  const infoCss    = unwrapValue(propsNode?.info, {});
  const outerCss   = unwrapValue(propsNode?.outer, {});
  const iconCss    = unwrapValue(propsNode?.icon, {});
  const layoutCss  = unwrapValue(propsNode?.layout, {});
  const visibility = unwrapValue(propsNode?.visibility, {});

  // ── Text content ───────────────────────────────────────────────────────────
  const titleText = toString(
    titleCss?.text ?? raw?.title,
    "Description"
  );
  const descriptionText = toString(
    raw?.description ?? raw?.descriptionText ?? infoCss?.descriptionText,
    ""
  );

  if (!descriptionText && !titleText) return null;

  // ── Visibility ─────────────────────────────────────────────────────────────
  const showTitle       = toBoolean(visibility?.title, true);
  const showDescription = toBoolean(visibility?.infoDescription, true);
  const showIcon        = toBoolean(visibility?.icon, true);

  // ── Icon ───────────────────────────────────────────────────────────────────
  const iconColor = toString(iconCss?.color, "#096d70");
  const iconSize  = toNumber(iconCss?.size, 14);
  // DSL may say "fa-circle-info" — FontAwesome 4 uses "info-circle"
  const rawIconName = toString(iconCss?.icon, "info-circle");
  const iconName  = rawIconName.replace(/^fa-/, "").replace("circle-info", "info-circle");

  // ── Container (outer) padding ──────────────────────────────────────────────
  const outerPT = toNumber(outerCss?.paddingTop,    0);
  const outerPB = toNumber(outerCss?.paddingBottom, 0);
  const outerPL = toNumber(outerCss?.paddingLeft,   0);
  const outerPR = toNumber(outerCss?.paddingRight,  0);
  const outerBg = toString(outerCss?.backgroundColor ?? outerCss?.background, "#FFFFFF");

  // ── Info box padding ───────────────────────────────────────────────────────
  const infoPT = toNumber(infoCss?.paddingTop,    0);
  const infoPB = toNumber(infoCss?.paddingBottom, 0);
  const infoPL = toNumber(infoCss?.paddingLeft,   0);
  const infoPR = toNumber(infoCss?.paddingRight,  0);
  const infoBg = toString(infoCss?.backgroundColor ?? infoCss?.background, "#FFFFFF");

  // ── Header row paddingTop (from layout.css.headerRow or default 30) ────────
  const headerPT = (() => {
    const css = layoutCss?.css || layoutCss;
    const hr  = css?.headerRow;
    if (hr?.paddingTop !== undefined) {
      return toNumber(String(hr.paddingTop).replace("px", ""), 16);
    }
    return 16;
  })();

  // ── Title style ────────────────────────────────────────────────────────────
  const titleFontSize  = toNumber(titleCss?.style?.fontSize, 14);
  const titleColor     = toString(titleCss?.style?.color, "#111827");
  const titleWeight    = toString(titleCss?.style?.fontWeight, "700");
  const titleItalic    = toBoolean(titleCss?.style?.italic, false);
  const titleUnderline = toBoolean(titleCss?.style?.underline, false);
  const titleStrikethrough = toBoolean(titleCss?.style?.strikethrough, false);
  const titleDecorationLine = resolveTextDecorationLine({
    underline: titleUnderline,
    strikethrough: titleStrikethrough,
  });

  // ── Body style ─────────────────────────────────────────────────────────────
  const bodyFontSize  = toNumber(infoCss?.descriptionStyle?.fontSize, 12);
  const bodyColor     = toString(infoCss?.descriptionStyle?.color, "#6B7280");
  const bodyWeight    = toString(infoCss?.descriptionStyle?.fontWeight, "400");
  const bodyItalic    = toBoolean(infoCss?.descriptionStyle?.italic, false);
  const bodyUnderline = toBoolean(infoCss?.descriptionStyle?.underline, false);
  const bodyStrikethrough = toBoolean(infoCss?.descriptionStyle?.strikethrough, false);
  const bodyDecorationLine = resolveTextDecorationLine({
    underline: bodyUnderline,
    strikethrough: bodyStrikethrough,
  });

  // ── Arrow / chevron colour ─────────────────────────────────────────────────
  const arrowColor = (() => {
    const css = layoutCss?.css || layoutCss;
    return toString(css?.arrow?.color, "#111827");
  })();

  // ── Accordion open state ───────────────────────────────────────────────────
  const defaultOpen = toBoolean(raw?.defaultOpen, false);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: outerBg,
          paddingTop:    outerPT,
          paddingBottom: outerPB,
          paddingLeft:   outerPL,
          paddingRight:  outerPR,
        },
      ]}
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
          {showIcon && (
            <FontAwesome
              name={iconName}
              size={iconSize}
              color={iconColor}
              style={styles.infoIcon}
            />
          )}
          {showTitle && (
            <Text
              style={{
                fontSize:   titleFontSize,
                color:      titleColor,
                fontWeight: String(titleWeight),
                fontStyle:  titleItalic ? "italic" : "normal",
                textDecorationLine: titleDecorationLine,
                flex: 1,
              }}
            >
              {titleText}
            </Text>
          )}
        </View>
        <FontAwesome
          name={open ? "chevron-up" : "chevron-down"}
          size={12}
          color={arrowColor}
        />
      </TouchableOpacity>

      {/* ── Description body ──────────────────────────────────────────────── */}
      {open && showDescription && !!descriptionText && (
        <View
          style={{
            backgroundColor: infoBg,
            paddingTop:    infoPT || 10,
            paddingBottom: infoPB,
            paddingLeft:   infoPL,
            paddingRight:  infoPR,
          }}
        >
          <Text
            style={{
              fontSize:          bodyFontSize,
              color:             bodyColor,
              fontWeight:        String(bodyWeight),
              fontStyle:         bodyItalic    ? "italic"    : "normal",
              textDecorationLine: bodyDecorationLine,
              lineHeight:        bodyFontSize * 1.6,
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
  container: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingBottom:  16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems:    "center",
    flex: 1,
  },
  infoIcon: {
    marginRight: 8,
  },
});

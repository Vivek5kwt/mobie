import React, { useMemo, useState } from "react";
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

const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const stripInlineHtml = (value) =>
  decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .trim();

const normalizeDescriptionBlocks = (value) => {
  const text = toString(value, "");
  if (!text.trim()) return [];

  const htmlLike = /<\/?[a-z][\s\S]*>/i.test(text);
  const normalized = htmlLike
    ? text
        .replace(/<li[^>]*>/gi, "\n[[BULLET]]")
        .replace(/<\/li>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|h[1-6])>/gi, "\n\n")
        .replace(/<\/(ul|ol)>/gi, "\n\n")
    : text;

  return normalized
    .split(/\n+/)
    .map((line) => stripInlineHtml(line))
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("[[BULLET]]")) {
        return { type: "bullet", text: line.replace("[[BULLET]]", "").trim() };
      }
      const bulletMatch = line.match(/^([•*-])\s+(.+)$/);
      if (bulletMatch) return { type: "bullet", text: bulletMatch[2].trim() };
      const numberMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
      if (numberMatch) return { type: "number", marker: `${numberMatch[1]}.`, text: numberMatch[2].trim() };
      return { type: "paragraph", text: line };
    })
    .filter((block) => block.text);
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
    return null;
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
  const descriptionBlocks = useMemo(
    () =>
      normalizeDescriptionBlocks(
        raw?.descriptionHtml ??
        raw?.descriptionHTML ??
        raw?.bodyHtml ??
        raw?.description ??
        raw?.descriptionText ??
        infoNode?.descriptionHtml ??
        infoNode?.descriptionText
      ),
    [raw, infoNode]
  );
  const hasDescription = descriptionBlocks.length > 0;

  if (!hasDescription && !titleText) return null;

  // ── Visibility ─────────────────────────────────────────────────────────────
  const showTitle       = toBoolean(visNode?.title,           true);
  const showDescription = toBoolean(visNode?.infoDescription, true);
  const showIcon        = toBoolean(visNode?.icon,            true);

  // ── Icon (left of title — info/leading icon) ──────────────────────────────
  // This icon is shown to the LEFT of the title text.
  // Source: raw.iconStyle.icon → propsNode.icon → layout CSS snapshot icon
  const resolvedIconRaw = toString(raw?.iconStyle?.icon, "");

  // Icon color
  const iconColor = (() => {
    const fromRaw  = toString(raw?.iconStyle?.color ?? raw?.iconColor, "");
    const fromNode = toString(iconNode?.color, "");
    const fromCss  = toString(layoutCss?.icon?.color ?? presCss?.icon?.color, "");
    return fromRaw || fromNode || fromCss || "#096d70";
  })();

  // Icon size
  const iconSize = (() => {
    const fromRaw  = toNumber(raw?.iconStyle?.size ?? raw?.iconSize, undefined);
    const fromNode = toNumber(iconNode?.size, undefined);
    const fromCss  = toNumber(layoutCss?.icon?.fontSize ?? presCss?.icon?.fontSize, undefined);
    return fromRaw ?? fromNode ?? fromCss ?? 16;
  })();

  // ── Dropdown toggle icon (right side — replaces chevron when set) ──────────
  // The builder writes the user's chosen dropdown icon to raw.dropdownIconValue
  // or raw.iconId. Falls back to chevron when nothing is explicitly set.
  const dropdownIconRaw = toString(
    raw?.dropdownIconValue ?? raw?.iconId ?? raw?.dropdownIcon ?? raw?.arrowIconValue,
    ""
  );

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
  const bodyLineHeightRaw = toNumber(layoutCss?.infoText?.lineHeight, 1.5);
  const bodyLineHeight =
    bodyLineHeightRaw > 0 && bodyLineHeightRaw <= 10
      ? bodyFontSize * bodyLineHeightRaw
      : bodyLineHeightRaw;

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
          {/* Info icon — left of title */}
          {showIcon && !!resolvedIconRaw && (
            <DescIcon
              rawName={resolvedIconRaw}
              size={iconSize}
              color={iconColor}
              style={{ marginRight: 8 }}
            />
          )}
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

        {/* Dropdown toggle — user's selected icon or default chevron */}
        {dropdownIconRaw ? (
          <DescIcon
            rawName={dropdownIconRaw}
            size={arrowSize}
            color={arrowColor}
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
      {open && showDescription && hasDescription && (
        <View
          style={{
            backgroundColor: infoBg,
            paddingTop:      infoPT || 10,
            paddingBottom:   infoPB,
            paddingLeft:     infoPL,
            paddingRight:    infoPR,
          }}
        >
          {descriptionBlocks.map((block, idx) => {
            const isListItem = block.type === "bullet" || block.type === "number";
            const marker = block.type === "number" ? block.marker : "\u2022";
            const textStyle = {
              fontSize:           bodyFontSize,
              color:              bodyColor,
              fontWeight:         String(bodyWeight),
              fontStyle:          bodyItalic ? "italic" : "normal",
              textDecorationLine: bodyDecorationLine,
              lineHeight:         bodyLineHeight,
              flexShrink:         1,
              ...(bodyFontFamily ? { fontFamily: bodyFontFamily } : {}),
            };

            if (isListItem) {
              return (
                <View
                  key={`desc-item-${idx}`}
                  style={[
                    styles.listRow,
                    { marginBottom: idx < descriptionBlocks.length - 1 ? 8 : 0 },
                  ]}
                >
                  <Text style={[textStyle, styles.listMarker]}>{marker}</Text>
                  <Text style={[textStyle, styles.listText]}>{block.text}</Text>
                </View>
              );
            }

            return (
              <Text
                key={`desc-p-${idx}`}
                style={[
                  textStyle,
                  { marginBottom: idx < descriptionBlocks.length - 1 ? 10 : 0 },
                ]}
              >
                {block.text}
              </Text>
            );
          })}
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
  listRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listMarker: {
    width: 18,
  },
  listText: {
    flex: 1,
  },
});

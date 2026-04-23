import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { getTypography } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";

// ── DSL helpers ────────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const asBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const l = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
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

const asStr = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  const s = String(resolved).trim();
  return s && s !== "undefined" && s !== "null" ? s : fallback;
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

// Detect if a string is an emoji / non-ASCII character (not usable as FA icon name)
// Returns true if the string contains any character outside basic ASCII printable range
const containsEmoji = (str) => {
  if (!str) return false;
  return /[^\x00-\x7E]/.test(str);
};

// Strip web-only CSS props before applying to RN Text
const stripTextCss = (style) => {
  if (!style) return {};
  const {
    maxWidth, minWidth, overflow, whiteSpace,
    textOverflow, numberOfLines, display, ...rest
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
    if (underline && strikethrough) next.textDecorationLine = "underline line-through";
    else if (underline) next.textDecorationLine = "underline";
    else next.textDecorationLine = "line-through";
  }

  const fontFamily = unwrapValue(attrs.fontFamily, undefined);
  if (fontFamily) next.fontFamily = fontFamily;

  return next;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function TextBlock({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const layoutCss     = rawProps?.layout?.properties?.css  || rawProps?.layout?.css  || {};
  const iconCfg       = rawProps?.icon?.properties         || rawProps?.icon         || {};
  const styleCfg      = rawProps?.style?.properties        || rawProps?.style        || {};
  const alignmentCfg  = rawProps?.alignmentAndPadding?.properties || rawProps?.alignmentAndPadding || {};
  const paddingRaw    = alignmentCfg?.paddingRaw?.properties || alignmentCfg?.paddingRaw || {};

  // Global text alignment — read from alignmentAndPadding first, then rawProps, then CSS
  const globalAlign = asStr(
    alignmentCfg?.textAlign ??
    alignmentCfg?.align ??
    rawProps?.textAlign ??
    rawProps?.align ??
    rawProps?.headtextAlign,
    ""
  ).toLowerCase();

  // ── Visibility ─────────────────────────────────────────────────────────────
  const showHeadline  = asBoolean(rawProps?.showHeadline, true);
  const showSubtext   = asBoolean(rawProps?.showSubtext,  true);
  // showIcon only activates when DSL explicitly enables it AND provides a valid FA icon name
  const showIconDsl   = asBoolean(rawProps?.showIcon, false);

  // ── Text content ───────────────────────────────────────────────────────────
  const headline = asStr(rawProps?.headline, "");
  const subtext  = asStr(rawProps?.subtext,  "");

  // ── Icon — emoji is NEVER rendered; only valid FontAwesome icon names ───────
  // Builder may send: iconCfg.emoji (emoji char), iconCfg.icon / iconCfg.iconName (FA name)
  const rawIconValue = asStr(
    iconCfg?.icon ?? iconCfg?.iconName ?? iconCfg?.name ?? iconCfg?.emoji,
    ""
  );
  // Resolve FA5/FA6 name → FA4 equivalent; emoji/unknown names become ""
  const faIconName   = containsEmoji(rawIconValue) ? "" : resolveFA4IconName(rawIconValue);
  const iconColor    = asStr(iconCfg?.color, "#FFFFFF");
  const iconBgColor  = asStr(iconCfg?.bgColor ?? iconCfg?.backgroundColor, "#16A34A");
  const iconSize     = asNumber(iconCfg?.size ?? iconCfg?.width, 20);
  const iconFaSize   = asNumber(iconCfg?.iconSize ?? iconCfg?.faSize, 11);
  const iconRadius   = asNumber(iconCfg?.borderRadius ?? iconCfg?.corner, 999);

  const hasIcon = showIconDsl && !!faIconName;
  const hasHeadline  = showHeadline && !!headline;
  const hasSubtext   = showSubtext  && !!subtext;

  if (!hasIcon && !hasHeadline && !hasSubtext) return null;

  // ── Container style ────────────────────────────────────────────────────────
  const rawContainerStyle = convertStyles(layoutCss.container || {});
  const {
    justifyContent: _jc, overflow: _ov, display: _disp,
    borderWidth: _bw, borderColor: _bc, borderStyle: _bs,
    border: _b, backgroundColor: _bg, ...safeContainerStyle
  } = rawContainerStyle;

  // Derive alignItems for the container from global alignment
  const containerAlignItems =
    globalAlign === "center" ? "center" :
    globalAlign === "right"  ? "flex-end" :
    globalAlign === "left"   ? "flex-start" :
    safeContainerStyle?.alignItems ?? "flex-start";

  const containerStyle = {
    ...safeContainerStyle,
    paddingTop:    asNumber(paddingRaw?.pt,    safeContainerStyle.paddingTop    ?? 0),
    paddingRight:  asNumber(paddingRaw?.pr,    safeContainerStyle.paddingRight  ?? 0),
    paddingBottom: asNumber(paddingRaw?.pb,    safeContainerStyle.paddingBottom ?? 0),
    paddingLeft:   asNumber(paddingRaw?.pl,    safeContainerStyle.paddingLeft   ?? 0),
    // Override alignItems from global alignment so content centers/aligns correctly
    ...(globalAlign ? { alignItems: containerAlignItems } : {}),
  };

  const overrideBgColor = asStr(styleCfg?.bgColor, "");

  // ── No border ever on mobile TextBlock ───────────────────────────────────────
  // Border is a web-only concept for this component; never render one on mobile.
  const overrideBorderRadius =
    parsePx(unwrapValue(styleCfg?.borderRadius)) ?? parsePx(safeContainerStyle?.borderRadius);

  const overrideStyle = {
    ...(overrideBgColor            ? { backgroundColor: overrideBgColor }     : {}),
    ...(overrideBorderRadius != null ? { borderRadius: overrideBorderRadius } : {}),
  };

  // ── Text styles ────────────────────────────────────────────────────────────
  const headlineAttributes = rawProps?.headlineAttributes?.properties || rawProps?.headlineAttributes || {};
  const subtextAttributes  = rawProps?.subtextAttributes?.properties  || rawProps?.subtextAttributes  || {};

  // Global typography fonts (set by dslHandler after every DSL fetch).
  // Per-element fontFamily from the DSL attributes takes priority; global
  // font is used only when no per-element override is present.
  const typography = getTypography();

  const headlineStyle = applyTextAttributes(stripTextCss(convertStyles(layoutCss.headline || {})), headlineAttributes);
  if (!headlineStyle.fontFamily && typography.headlineFontFamily) {
    headlineStyle.fontFamily = typography.headlineFontFamily;
  }

  const subtextStyle  = applyTextAttributes(stripTextCss(convertStyles(layoutCss.subtext  || {})), subtextAttributes);
  if (!subtextStyle.fontFamily && typography.subtextFontFamily) {
    subtextStyle.fontFamily = typography.subtextFontFamily;
  }

  // Per-element alignment — fall back to globalAlign so setting one place controls both
  const headtextAlign = (
    asStr(rawProps?.headtextAlign ?? rawProps?.headlineAlign ?? rawProps?.headAlign, "") ||
    (headlineStyle?.textAlign ? String(headlineStyle.textAlign) : "") ||
    globalAlign
  ).toLowerCase();
  const subtextAlign = (
    asStr(rawProps?.subtextAlign ?? rawProps?.bodyAlign ?? rawProps?.subtextTextAlign, "") ||
    (subtextStyle?.textAlign ? String(subtextStyle.textAlign) : "") ||
    globalAlign
  ).toLowerCase();
  // Only use as numberOfLines when the DSL sends a whole positive integer.
  // Fractional values like 1.2 or 4.1 are builder-internal metrics, not line counts —
  // using them would floor to 1 and wrongly truncate multi-line headline text.
  const resolvedHLines = asNumber(rawProps?.headlineHeight, undefined);
  const resolvedSLines = asNumber(rawProps?.subtextHeight,  undefined);
  const headlineLines  = (resolvedHLines != null && Number.isInteger(resolvedHLines) && resolvedHLines >= 1)
    ? resolvedHLines : undefined;
  const subtextLines   = (resolvedSLines != null && Number.isInteger(resolvedSLines) && resolvedSLines >= 1)
    ? resolvedSLines : undefined;

  // When icon is present, switch to row layout so icon sits beside text
  const layoutStyle = hasIcon
    ? { flexDirection: "row", alignItems: "center", gap: 12 }
    : {};

  return (
    <View style={[styles.container, containerStyle, overrideStyle, layoutStyle]}>

      {/* ── Icon: FontAwesome only — emoji characters are never rendered ─── */}
      {hasIcon && (
        <View
          style={[
            styles.iconWrap,
            {
              width:           iconSize,
              height:          iconSize,
              minWidth:        iconSize,
              minHeight:       iconSize,
              borderRadius:    iconRadius,
              backgroundColor: iconBgColor,
            },
          ]}
        >
          <FontAwesome
            name={faIconName}
            size={iconFaSize}
            color={iconColor}
          />
        </View>
      )}

      {/* ── Text ──────────────────────────────────────────────────────────── */}
      <View style={[styles.textContainer, hasIcon ? { flex: 1 } : { width: "100%" }]}>
        {hasHeadline && (
          <Text
            numberOfLines={headlineLines}
            ellipsizeMode="tail"
            style={[
              styles.headline,
              headlineStyle,
              headtextAlign ? { textAlign: headtextAlign.toLowerCase() } : null,
            ]}
          >
            {headline}
          </Text>
        )}

        {hasSubtext && (
          <Text
            numberOfLines={subtextLines}
            ellipsizeMode="tail"
            style={[
              styles.subtext,
              subtextStyle,
              subtextAlign ? { textAlign: subtextAlign.toLowerCase() } : null,
            ]}
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
    flexDirection:  "column",
    alignItems:     "flex-start",
    width:          "100%",
  },
  iconWrap: {
    justifyContent: "center",
    alignItems:     "center",
    flexShrink:     0,
  },
  textContainer: {
    flexDirection: "column",
    gap:           4,
  },
  headline: {
    color:      "#111111",
    fontSize:   18,
    fontWeight: "600",
  },
  subtext: {
    color:      "#6B7280",
    fontSize:   14,
    fontWeight: "400",
  },
});

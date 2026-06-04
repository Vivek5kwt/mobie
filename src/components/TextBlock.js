import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { getTypography, resolveFont } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";

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

const asObject = (value, fallback = {}) => {
  const resolved = unwrapValue(value, value);
  return resolved && typeof resolved === "object" && !Array.isArray(resolved)
    ? resolved
    : fallback;
};

const mergeRawProps = (propsRoot = {}) => {
  const raw = asObject(propsRoot?.raw, null);
  return raw ? { ...propsRoot, ...raw } : propsRoot;
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

const firstDefined = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") return resolved;
  }
  return undefined;
};

const resolveAuthVerticalSpace = (value, viewportHeight, maxViewportShare) => {
  const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return normalized;
  return Math.round(Math.min(normalized, viewportHeight * maxViewportShare));
};

const BORDER_STYLE_KEYS = [
  "border",
  "borderWidth",
  "borderColor",
  "borderStyle",
  "borderTopWidth",
  "borderTopColor",
  "borderRightWidth",
  "borderRightColor",
  "borderBottomWidth",
  "borderBottomColor",
  "borderLeftWidth",
  "borderLeftColor",
];

const stripContainerBorderStyle = (style = {}) => {
  const next = { ...(style || {}) };
  BORDER_STYLE_KEYS.forEach((key) => {
    delete next[key];
  });
  return next;
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

const stripFaPrefix = (value) => {
  if (!value || typeof value !== "string") return "";
  return value.replace(/^fa[srldb]?[-_]?/i, "").trim();
};

const resolveTextBlockIconName = (value) => {
  const raw = stripFaPrefix(String(value || "").trim());
  if (!raw) return "";

  const glyphAliases = {
    "→": "arrow-right",
    "➜": "arrow-right",
    "➔": "arrow-right",
    "➤": "arrow-right",
    "›": "chevron-right",
    "»": "angle-double-right",
    "←": "arrow-left",
    "‹": "chevron-left",
    "«": "angle-double-left",
  };

  return resolveFA4IconName(glyphAliases[raw] || raw);
};

const resolveAlign = (value, fallback = "left") => {
  const v = String(value || fallback).trim().toLowerCase();
  if (v === "center" || v === "middle") return "center";
  if (v === "right" || v === "end") return "right";
  return "left";
};

const textAlignToJustify = (align) => {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
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

const applyTextAttributes = (baseStyle, attributes, decorationOverrides = {}) => {
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

  const underlineSource =
    decorationOverrides.underline !== undefined
      ? decorationOverrides.underline
      : attrs.underline;
  const strikethroughSource =
    decorationOverrides.strikethrough !== undefined
      ? decorationOverrides.strikethrough
      : attrs.strikethrough;
  const underline = asBoolean(underlineSource, undefined);
  const strikethrough = asBoolean(strikethroughSource, undefined);
  if (underlineSource !== undefined || strikethroughSource !== undefined) {
    next.textDecorationLine = resolveTextDecorationLine({
      underline: underline === true,
      strikethrough: strikethrough === true,
    });
  }

  const fontFamily = resolveFont(unwrapValue(attrs.fontFamily, undefined));
  if (fontFamily) next.fontFamily = fontFamily;

  return next;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function TextBlock({ section }) {
  const propsRoot =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const rawProps = mergeRawProps(propsRoot);

  const layoutNode    = asObject(rawProps?.layout?.properties || rawProps?.layout, {});
  const layoutCss     = asObject(layoutNode?.css, {});
  const iconCfg       = asObject(rawProps?.icon?.properties || rawProps?.icon, {});
  const iconStyle     = convertStyles(layoutCss.icon || {});
  const styleCfg      = asObject(rawProps?.style?.properties || rawProps?.style, {});
  const alignmentCfg  = asObject(rawProps?.alignmentAndPadding?.properties || rawProps?.alignmentAndPadding, {});
  const paddingRaw    = asObject(alignmentCfg?.paddingRaw?.properties || alignmentCfg?.paddingRaw, {});

  // Global text alignment — read from alignmentAndPadding first, then rawProps, then CSS
  const globalAlign = resolveAlign(asStr(
    alignmentCfg?.textAlign ??
    alignmentCfg?.align ??
    rawProps?.textAlign ??
    rawProps?.align ??
    rawProps?.headtextAlign,
    ""
  ));

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
  const faIconName   = containsEmoji(rawIconValue) ? "" : resolveTextBlockIconName(rawIconValue);
  const iconColor    = asStr(iconCfg?.color ?? iconStyle?.color, "#FFFFFF");
  const iconBgColor  = asStr(
    iconCfg?.bgColor ?? iconCfg?.backgroundColor ?? iconStyle?.backgroundColor,
    "transparent"
  );
  const iconSize     = asNumber(iconCfg?.size ?? iconCfg?.width ?? iconStyle?.width, 20);
  const iconFaSize   = asNumber(iconCfg?.iconSize ?? iconCfg?.faSize ?? iconStyle?.fontSize, 11);
  const iconRadius   = asNumber(iconCfg?.borderRadius ?? iconCfg?.corner ?? iconStyle?.borderRadius, 0);
  const iconAlign    = resolveAlign(asStr(iconCfg?.align, globalAlign));

  const hasRenderableIcon = !!faIconName;

  const hasIcon = showIconDsl && hasRenderableIcon;
  const hasHeadline  = showHeadline && !!headline;
  const hasSubtext   = showSubtext  && !!subtext;

  if (!hasIcon && !hasHeadline && !hasSubtext) return null;

  // ── Container style ────────────────────────────────────────────────────────
  const rawContainerStyle = convertStyles(layoutCss.container || {});
  const {
    display: _disp,
    boxSizing: _boxSizing,
    maxWidth: _maxWidth,
    ...containerStyleFromCss
  } = rawContainerStyle;
  const safeContainerStyle = stripContainerBorderStyle(containerStyleFromCss);

  // Derive alignItems for the container from global alignment
  const containerAlignItems = textAlignToJustify(globalAlign);
  const authViewportHeight = asNumber(section?.__authVerticalViewport, 0);
  const resolvedPaddingTop = asNumber(paddingRaw?.pt, safeContainerStyle.paddingTop ?? 0);
  const resolvedPaddingBottom = asNumber(paddingRaw?.pb, safeContainerStyle.paddingBottom ?? 0);

  const containerStyle = {
    ...safeContainerStyle,
    paddingTop:    resolveAuthVerticalSpace(resolvedPaddingTop, authViewportHeight, 0.08),
    paddingRight:  asNumber(paddingRaw?.pr,    safeContainerStyle.paddingRight  ?? 0),
    paddingBottom: resolveAuthVerticalSpace(resolvedPaddingBottom, authViewportHeight, 0.05),
    paddingLeft:   asNumber(paddingRaw?.pl,    safeContainerStyle.paddingLeft   ?? 0),
    // Override alignItems from global alignment so content centers/aligns correctly
    ...(globalAlign ? { alignItems: containerAlignItems } : {}),
  };

  const overrideBgColor = firstDefined(
    rawProps?.containerBgColor,
    rawProps?.bgColor,
    rawProps?.backgroundColor,
    layoutCss?.container?.backgroundColor,
    layoutCss?.container?.background,
    styleCfg?.bgColor
  );

  const overrideBorderRadius = parsePx(firstDefined(
    rawProps?.containerBorderRadius,
    rawProps?.borderRadius,
    layoutCss?.container?.borderRadius,
    styleCfg?.borderRadius
  ));
  const borderStyle = {
    borderWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  };

  const overrideStyle = {
    ...(overrideBgColor ? { backgroundColor: overrideBgColor } : {}),
    ...(overrideBorderRadius != null ? { borderRadius: overrideBorderRadius } : {}),
    ...borderStyle,
  };

  // ── Text styles ────────────────────────────────────────────────────────────
  const headlineAttributes = rawProps?.headlineAttributes?.properties || rawProps?.headlineAttributes || {};
  const subtextAttributes  = rawProps?.subtextAttributes?.properties  || rawProps?.subtextAttributes  || {};

  // Global typography fonts (set by dslHandler after every DSL fetch).
  // Per-element fontFamily from the DSL attributes takes priority; global
  // font is used only when no per-element override is present.
  const typography = getTypography();

  const headlineStyle = applyTextAttributes(
    stripTextCss(convertStyles(layoutCss.headline || {})),
    headlineAttributes,
    {
      underline: rawProps?.headlineUnderline,
      strikethrough: rawProps?.headlineStrikethrough,
    }
  );
  if (!headlineStyle.fontFamily && typography.headlineFontFamily) {
    headlineStyle.fontFamily = typography.headlineFontFamily;
  }

  const subtextStyle  = applyTextAttributes(
    stripTextCss(convertStyles(layoutCss.subtext || {})),
    subtextAttributes,
    {
      underline: rawProps?.subtextUnderline,
      strikethrough: rawProps?.subtextStrikethrough,
    }
  );
  if (!subtextStyle.fontFamily && typography.subtextFontFamily) {
    subtextStyle.fontFamily = typography.subtextFontFamily;
  }

  // Per-element alignment — fall back to globalAlign so setting one place controls both
  const headtextAlign = resolveAlign(
    asStr(rawProps?.headtextAlign ?? rawProps?.headlineAlign ?? rawProps?.headAlign, "") ||
    (headlineStyle?.textAlign ? String(headlineStyle.textAlign) : "") ||
    globalAlign
  );
  const subtextAlign = resolveAlign(
    asStr(rawProps?.subtextAlign ?? rawProps?.bodyAlign ?? rawProps?.subtextTextAlign, "") ||
    (subtextStyle?.textAlign ? String(subtextStyle.textAlign) : "") ||
    globalAlign
  );
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
    ? {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: textAlignToJustify(iconAlign),
      }
    : {};
  const iconTextGap = asNumber(layoutCss?.container?.gap, 0);

  return (
    <View style={[styles.container, containerStyle, overrideStyle, layoutStyle]}>

      {/* ── Icon: FontAwesome only — emoji characters are never rendered ─── */}
      {hasIcon && (
        <View
          style={[
            styles.iconWrap,
            iconStyle,
            {
              width:           iconSize,
              height:          iconSize,
              minWidth:        iconSize,
              minHeight:       iconSize,
              borderRadius:    iconRadius,
              backgroundColor: iconBgColor,
              marginRight:     iconTextGap,
            },
          ]}
        >
          {!!faIconName && (
            <FontAwesome
              name={faIconName}
              size={iconFaSize}
              color={iconColor}
            />
          )}
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

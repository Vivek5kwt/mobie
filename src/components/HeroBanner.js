import React from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { applyMetricsPositioning, convertStyles } from "../utils/convertStyles";
import { resolveFA4IconName } from "../utils/faIconAlias";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

// Recursively unwrap value/const DSL envelope wrappers
const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

// Merge the .raw sub-object into root props so all DSL fields are top-level accessible
const getRawProps = (section) => {
  const root =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const rawUnwrapped = deepUnwrap(root?.raw);
  return (rawUnwrapped && typeof rawUnwrapped === "object")
    ? { ...root, ...rawUnwrapped }
    : root;
};

// Read layout CSS from both 'layout' and 'presentation' DSL paths
const getLayoutCss = (rawProps) => {
  const fromLayout = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const presUnwrapped = deepUnwrap(rawProps?.presentation) || {};
  const fromPres = presUnwrapped?.properties?.css || presUnwrapped?.css || {};
  const fromCss = deepUnwrap(rawProps?.css) || {};
  const merge = (key) => ({
    ...(fromLayout[key] || {}),
    ...(fromPres[key]   || {}),
    ...(fromCss[key]    || {}),
  });
  return {
    container: merge("container"),
    headline:  merge("headline"),
    subtext:   merge("subtext"),
    button:    merge("button"),
    image:     merge("image"),
  };
};

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
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

const toFontWeight = (value, bold = false) => {
  if (bold) return "700";
  if (!value) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (raw === "bold") return "700";
  if (raw === "semibold" || raw === "semi bold") return "600";
  if (raw === "medium") return "500";
  if (raw === "regular" || raw === "normal") return "400";
  if (/^\d+$/.test(raw)) return raw;
  return undefined;
};

const buildTextAttributesStyle = (attributes) => {
  if (!attributes || typeof attributes !== "object") return null;

  const color = unwrapValue(attributes?.color, undefined);
  const fontFamily = unwrapValue(attributes?.fontFamily, undefined);
  const fontSize = toNumber(attributes?.size, undefined);
  const isBold = toBoolean(attributes?.bold, false);
  const isItalic = toBoolean(attributes?.italic, false);
  const isUnderline = toBoolean(attributes?.underline, false);
  const weight = unwrapValue(attributes?.weight, undefined);
  const fontWeight = toFontWeight(weight, isBold);

  // Line-height and letter-spacing from attributes
  const rawLineHeight = toNumber(attributes?.lineHeight, undefined);
  const letterSpacing = toNumber(attributes?.letterSpacing, undefined);

  // If lineHeight is a small number (like 1), treat it as a multiplier of fontSize.
  const resolvedLineHeight =
    rawLineHeight && fontSize
      ? rawLineHeight > 0 && rawLineHeight <= 10
        ? fontSize * rawLineHeight
        : rawLineHeight
      : undefined;

  return {
    color,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle: isItalic ? "italic" : "normal",
    textDecorationLine: isUnderline ? "underline" : "none",
    ...(resolvedLineHeight ? { lineHeight: resolvedLineHeight } : {}),
    ...(letterSpacing !== undefined ? { letterSpacing } : {}),
  };
};

const withColorOpacity = (color, opacityPct = 100) => {
  if (!color) return color;
  const alpha = Math.max(0, Math.min(1, opacityPct / 100));

  if (typeof color === "string" && color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  return color;
};

export default function HeroBanner({ section }) {
  const navigation = useNavigation();
  // Merge .raw sub-object so DSL data nested inside raw is accessible at top level
  const rawProps = getRawProps(section);

  // Extract layout CSS from all possible DSL sources (layout / presentation / css)
  const layoutCss = getLayoutCss(rawProps);
  const layoutNode = rawProps?.layout?.properties || rawProps?.layout || {};
  const layoutMetrics = layoutNode?.metrics || {};
  // Only use metrics when explicitly available (available: true) — skip when all zeros or available: false
  const metricsAvailable = layoutMetrics?.available === true;
  const metricElements = metricsAvailable ? (layoutMetrics?.elements || {}) : {};

  // Convert CSS styles
  const containerStyleRaw = convertStyles(layoutCss?.container || {});
  const headlineCssStyle = convertStyles(layoutCss?.headline || {});
  const subtextCssStyle = convertStyles(layoutCss?.subtext || {});
  const buttonCssStyle = convertStyles(layoutCss?.button || {});
  const imageCssStyleRaw = convertStyles(layoutCss?.image || {});

  // Strip padding, margin, sizing, and borderRadius from containerStyle.
  // borderRadius is stripped here so it cannot override the computed containerBorderRadius below.
  // Height is managed by containerHeightStyle + aspectRatio/minHeight below.
  const {
    padding: _cP, paddingTop: _cPt, paddingBottom: _cPb,
    paddingLeft: _cPl, paddingRight: _cPr,
    paddingHorizontal: _cPh, paddingVertical: _cPv,
    margin: _cM, marginTop: _cMt, marginBottom: _cMb,
    marginLeft: _cMl, marginRight: _cMr,
    marginHorizontal: _cMh, marginVertical: _cMv,
    height: _cH, minHeight: _cMinH, maxHeight: _cMaxH,
    borderRadius: _cBrFromCss,
    ...containerStyle
  } = containerStyleRaw;

  // Strip positioning, sizing, and spacing from imageCssStyle so DSL cannot push
  // the image away from the container edges (the base style pins top/left/right/bottom to 0).
  const {
    position: _iPos,
    width: _iW, height: _iH, minWidth: _iMW, minHeight: _iMH, maxWidth: _iMaxW, maxHeight: _iMaxH,
    top: _iT, left: _iL, right: _iR, bottom: _iB,
    margin: _iM, marginTop: _iMt, marginBottom: _iMb,
    marginLeft: _iMl, marginRight: _iMr,
    marginHorizontal: _iMh, marginVertical: _iMv,
    padding: _iPad, paddingTop: _iPt, paddingBottom: _iPb,
    paddingLeft: _iPl, paddingRight: _iPr,
    paddingHorizontal: _iPh, paddingVertical: _iPv,
    ...imageCssStyle
  } = imageCssStyleRaw;

  // Extract text attributes
  const headlineAttributes =
    rawProps?.headlineAttributes?.properties || rawProps?.headlineAttributes || {};
  const subtextAttributes =
    rawProps?.subtextAttributes?.properties || rawProps?.subtextAttributes || {};

  // Optional explicit line-height overrides from schema
  const headlineLineHeightToken = toNumber(rawProps?.headlineLineHeight, undefined);
  const subtextLineHeightToken = toNumber(rawProps?.subtextLineHeight, undefined);

  // Build headline style from CSS and attributes
  const headlineAttrStyle = buildTextAttributesStyle(headlineAttributes) || {};

  const headlineStyle = {
    ...headlineCssStyle,
    ...headlineAttrStyle,
    // Override with CSS if present
    color: headlineCssStyle?.color || headlineAttrStyle.color,
    fontSize: headlineCssStyle?.fontSize || headlineAttrStyle.fontSize,
    fontFamily: headlineCssStyle?.fontFamily || headlineAttrStyle.fontFamily,
    fontWeight: headlineCssStyle?.fontWeight || headlineAttrStyle.fontWeight,
    // Explicit line-height token wins last
    ...(headlineLineHeightToken && (headlineCssStyle?.fontSize || headlineAttrStyle.fontSize)
      ? {
          lineHeight:
            headlineLineHeightToken > 0 && headlineLineHeightToken <= 10
              ? (headlineCssStyle?.fontSize || headlineAttrStyle.fontSize) *
                  headlineLineHeightToken
              : headlineLineHeightToken,
        }
      : {}),
  };

  // Build subtext style from CSS and attributes
  const subtextAttrStyle = buildTextAttributesStyle(subtextAttributes) || {};

  const subtextStyle = {
    ...subtextCssStyle,
    ...subtextAttrStyle,
    // Override with CSS if present
    color: subtextCssStyle?.color || subtextAttrStyle.color,
    fontSize: subtextCssStyle?.fontSize || subtextAttrStyle.fontSize,
    fontFamily: subtextCssStyle?.fontFamily || subtextAttrStyle.fontFamily,
    fontWeight: subtextCssStyle?.fontWeight || subtextAttrStyle.fontWeight,
    marginTop: subtextCssStyle?.marginTop || toNumber(subtextAttributes?.marginTop, 8),
    marginBottom: subtextCssStyle?.marginBottom || toNumber(subtextAttributes?.marginBottom, 12),
    // Explicit line-height token wins last
    ...(subtextLineHeightToken && (subtextCssStyle?.fontSize || subtextAttrStyle.fontSize)
      ? {
          lineHeight:
            subtextLineHeightToken > 0 && subtextLineHeightToken <= 10
              ? (subtextCssStyle?.fontSize || subtextAttrStyle.fontSize) *
                  subtextLineHeightToken
              : subtextLineHeightToken,
        }
      : {}),
  };

  // Image attributes and settings
  const imageAttributes = rawProps?.imageAttributes?.properties || rawProps?.imageAttributes || {};
  const imageSettingsEnabled = toBoolean(rawProps?.imageSettingsEnabled, true);
  const imageScale = toString(imageAttributes?.scale, "Cover").toLowerCase();
  // Default to 0 — no rounded corners unless DSL explicitly sets a radius
  const imageCornerRadius = toNumber(imageAttributes?.imageCorner, 0);
  
  // Parse image ratio
  const parseImageRatio = (value) => {
    const ratio = unwrapValue(value, undefined);
    if (ratio === undefined) return undefined;

    if (typeof ratio === "string") {
      const trimmed = ratio.trim();
      if (!trimmed || trimmed.toLowerCase() === "auto") return undefined;
      if (trimmed.includes(":")) {
        const [width, height] = trimmed.split(":").map(Number);
        if (width > 0 && height > 0) return width / height;
      }
      const parsed = parseFloat(trimmed);
      return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
    }

    if (typeof ratio === "number" && ratio > 0) return ratio;
    return undefined;
  };

  const imageAspectRatio = parseImageRatio(imageAttributes?.imageRatio);
  
  // Map image scale to React Native resizeMode
  // CSS objectFit: cover -> cover, fill/stretch -> stretch, contain/fit -> contain
  const cssObjectFit = toString(layoutCss?.image?.objectFit, "cover").toLowerCase();
  const resizeMode =
    cssObjectFit === "cover" || imageScale === "cover" || imageScale === "fill"
      ? "cover"
      : cssObjectFit === "fill" || imageScale === "stretch"
        ? "stretch"
        : imageScale === "fit"
          ? "contain"
          : "contain";

  // Text content – prefer top-level props, but fall back to flatProps snapshot
  const flatPropsNode = rawProps?.flatProps?.value || rawProps?.flatProps || {};
  const headline =
    unwrapValue(rawProps?.headline, undefined) ??
    unwrapValue(flatPropsNode?.headline, undefined) ??
    unwrapValue(flatPropsNode?.title, "");
  const subtext =
    unwrapValue(rawProps?.subtext, undefined) ??
    unwrapValue(flatPropsNode?.subtext, undefined) ??
    unwrapValue(flatPropsNode?.subtitle, "");

  // Visibility flags from flatProps (showHeadline / showSubtext / showButton)
  const showHeadline = flatPropsNode?.showHeadline !== undefined
    ? toBoolean(flatPropsNode.showHeadline, true)
    : true;
  const showSubtext = flatPropsNode?.showSubtext !== undefined
    ? toBoolean(flatPropsNode.showSubtext, true)
    : true;

  // Button configuration
  const button = rawProps?.button || {};
  // buttonAttributes — dedicated DSL node sent by the builder with more specific button config
  // keys: bgColor, textColor, fontFamily, fontWeight, fontSize, letterSpacing,
  //       icon, iconSize, iconColor, borderRadius, borderColor, borderSide, pt/pb/pl/pr
  const buttonAttrs = rawProps?.buttonAttributes?.properties || rawProps?.buttonAttributes || {};

  const buttonEnabled = button?.properties?.enabled || button?.enabled;
  const showButtonFromEnabled = buttonEnabled === "yes" || buttonEnabled === true || toBoolean(buttonEnabled, false);
  const showButton = flatPropsNode?.showButton !== undefined
    ? toBoolean(flatPropsNode.showButton, showButtonFromEnabled)
    : showButtonFromEnabled;

  // Label — check button.label, flatProps.buttonText
  const buttonLabel =
    unwrapValue(button?.properties?.label || button?.label, "") ||
    toString(flatPropsNode?.buttonText, "Button");

  const buttonLink = unwrapValue(button?.properties?.link || button?.link, "/products");
  const buttonNavigateRef = unwrapValue(button?.properties?.navigateRef || button?.navigateRef, "");
  const buttonNavigateType = unwrapValue(button?.properties?.navigateType || button?.navigateType, "");

  // Button style tokens - default to white background as per schema
  const buttonTokens = button?.properties?.style?.properties || button?.style?.properties || {};

  // Background color — buttonAttrs.bgColor > flatProps.buttonBgColor > tokenStyle > CSS
  const buttonBgColor =
    toString(buttonAttrs?.bgColor, "") ||
    toString(flatPropsNode?.buttonBgColor, "") ||
    unwrapValue(buttonTokens?.backgroundColor, undefined) ||
    toString(layoutCss?.button?.backgroundColor, "#111111");

  // Text color — buttonAttrs.textColor > flatProps.buttonTextColor > tokenStyle.color > CSS
  const buttonTextColor =
    toString(buttonAttrs?.textColor, "") ||
    toString(flatPropsNode?.buttonTextColor, "") ||
    unwrapValue(buttonTokens?.color, undefined) ||
    toString(layoutCss?.button?.color, "#FFFFFF");

  const buttonBorder = unwrapValue(buttonTokens?.border, "none");

  // Padding — per-side from buttonAttrs first, then tokenStyle string, then CSS
  const hasBtnAttrPad = buttonAttrs?.pt !== undefined || buttonAttrs?.pb !== undefined ||
                        buttonAttrs?.pl !== undefined || buttonAttrs?.pr !== undefined;
  const buttonPadding = hasBtnAttrPad ? null : (unwrapValue(buttonTokens?.padding, null) || toString(layoutCss?.button?.padding, "8px 14px"));

  // Border radius — priority: buttonAttrs > flatProps > tokenStyle > button prop > CSS > default 7
  const buttonBorderRadius = (() => {
    const fromAttrs = toNumber(buttonAttrs?.borderRadius, undefined);
    if (fromAttrs !== undefined) return fromAttrs;
    const fromFlat = toNumber(flatPropsNode?.buttonBorderRadius, undefined);
    if (fromFlat !== undefined) return fromFlat;
    const fromToken = unwrapValue(buttonTokens?.borderRadius, undefined);
    if (fromToken !== undefined && fromToken !== null && fromToken !== "") return toNumber(fromToken, 0);
    const fromProp = unwrapValue(button?.properties?.borderRadius ?? button?.borderRadius, undefined);
    if (fromProp !== undefined && fromProp !== null && fromProp !== "") return toNumber(fromProp, 0);
    const fromCss = buttonCssStyle?.borderRadius;
    if (fromCss !== undefined && fromCss !== null) return typeof fromCss === "number" ? fromCss : toNumber(fromCss, 0);
    return 7;
  })();
  
  // Parse padding string (e.g., "8px 14px" or "8px 14px 8px 14px")
  const parsePadding = (paddingStr) => {
    if (!paddingStr || typeof paddingStr !== "string") return {};
    const parts = paddingStr.split(/\s+/).map(p => parseFloat(p) || 0);
    if (parts.length === 1) {
      return { paddingVertical: parts[0], paddingHorizontal: parts[0] };
    } else if (parts.length === 2) {
      return { paddingVertical: parts[0], paddingHorizontal: parts[1] };
    } else if (parts.length === 4) {
      return { paddingTop: parts[0], paddingRight: parts[1], paddingBottom: parts[2], paddingLeft: parts[3] };
    }
    return {};
  };
  
  const buttonPaddingStyle = hasBtnAttrPad
    ? {
        paddingTop:    toNumber(buttonAttrs?.pt, 8),
        paddingBottom: toNumber(buttonAttrs?.pb, 8),
        paddingLeft:   toNumber(buttonAttrs?.pl, 14),
        paddingRight:  toNumber(buttonAttrs?.pr, 14),
      }
    : parsePadding(buttonPadding || "8px 14px");
  
  // Extract button text style properties
  // buttonAttrs takes priority over button.properties (dedicated attributes node from builder)
  const buttonWeight =
    unwrapValue(buttonAttrs?.fontWeight, undefined) ||
    toString(flatPropsNode?.buttonFontWeight, "") ||
    unwrapValue(button?.properties?.weight || button?.weight, undefined);
  const buttonBold = toBoolean(button?.properties?.bold || button?.bold, false);
  const buttonItalic = toBoolean(button?.properties?.italic || button?.italic, false);
  const buttonUnderline = toBoolean(button?.properties?.underline || button?.underline, false);

  // Button typography — fontFamily, fontSize, letterSpacing
  // Priority: buttonAttrs > flatProps > button.properties > tokenStyle > layoutCSS
  const buttonFontFamily =
    toString(buttonAttrs?.fontFamily, "") ||
    toString(flatPropsNode?.buttonFontFamily, "") ||
    toString(
      button?.properties?.fontFamily ??
      button?.properties?.font ??
      button?.fontFamily ??
      button?.font ??
      buttonTokens?.fontFamily,
      ""
    ) ||
    toString(layoutCss?.button?.fontFamily, "");

  const buttonFontSize =
    toNumber(buttonAttrs?.fontSize, undefined) ??
    toNumber(flatPropsNode?.buttonFontSize, undefined) ??
    toNumber(
      button?.properties?.size ??
      button?.properties?.fontSize ??
      button?.size ??
      button?.fontSize ??
      buttonTokens?.fontSize,
      undefined
    ) ??
    toNumber(layoutCss?.button?.fontSize, undefined);

  const buttonLetterSpacing =
    toNumber(buttonAttrs?.letterSpacing, undefined) ??
    toNumber(flatPropsNode?.buttonLetterSpacing, undefined) ??
    toNumber(
      button?.properties?.letterSpacing ??
      button?.letterSpacing ??
      buttonTokens?.letterSpacing,
      undefined
    ) ??
    toNumber(layoutCss?.button?.letterSpacing, undefined);
  
  // Build dynamic button style - prioritize CSS, then button tokens, then defaults
  const dynamicButtonStyle = {
    ...buttonCssStyle,
    color: buttonTextColor,
    backgroundColor: buttonBgColor,
    borderRadius: buttonBorderRadius,
    ...buttonPaddingStyle,
    fontWeight: toFontWeight(
      buttonWeight || layoutCss?.button?.fontWeight,
      buttonBold
    ) || "400",
    fontStyle: buttonItalic ? "italic" :
               (layoutCss?.button?.fontStyle || "normal"),
    textDecorationLine: buttonUnderline
      ? "underline"
      : (layoutCss?.button?.textDecoration || "none"),
    ...(buttonFontFamily        ? { fontFamily:     buttonFontFamily }        : {}),
    ...(buttonFontSize    != null ? { fontSize:       buttonFontSize }         : {}),
    ...(buttonLetterSpacing != null ? { letterSpacing: buttonLetterSpacing }   : {}),
    ...(buttonBorder && buttonBorder !== "none" ? {
      borderWidth: 1,
      borderColor: buttonBorder
    } : {}),
  };
  
  // Button icon — resolves FA5/FA6 names to FA4 equivalents; unknown names are silently dropped
  // Priority: buttonAttrs.icon > flatProps.buttonIcon > button.properties.icon
  const rawBtnIcon =
    toString(buttonAttrs?.icon, "") ||
    toString(flatPropsNode?.buttonIcon, "") ||
    unwrapValue(
      button?.properties?.icon ??
      button?.properties?.iconName ??
      button?.icon ??
      button?.iconName,
      ""
    );
  const buttonIconName = resolveFA4IconName(rawBtnIcon);
  const buttonIconPosition = toString(
    buttonAttrs?.iconPosition ?? button?.properties?.iconPosition ?? button?.iconPosition,
    "left"
  ).toLowerCase();
  const buttonIconSize  = toNumber(buttonAttrs?.iconSize ?? button?.properties?.iconSize ?? button?.iconSize, 14);
  const buttonIconColor =
    toString(buttonAttrs?.iconColor, "") ||
    toString(button?.properties?.iconColor ?? button?.iconColor, "") ||
    buttonTextColor ||
    "#FFFFFF";

  // Split dynamicButtonStyle into container props (View) and text props (Text label).
  // All text-only CSS properties must be stripped from btnViewDynStyle to avoid RN warnings.
  const {
    color: _dynColor,
    fontWeight: _dynFw,
    fontStyle: _dynFs,
    textDecorationLine: _dynTdl,
    textAlign: _dynTa,
    letterSpacing: _dynLs,
    fontFamily: _dynFontFamily,
    fontSize: _dynFontSize,
    ...btnViewDynStyle
  } = dynamicButtonStyle;
  const btnTextDynStyle = {
    color:              dynamicButtonStyle.color,
    fontWeight:         dynamicButtonStyle.fontWeight,
    fontStyle:          dynamicButtonStyle.fontStyle,
    textDecorationLine: dynamicButtonStyle.textDecorationLine,
    ...(dynamicButtonStyle.fontFamily    ? { fontFamily:     dynamicButtonStyle.fontFamily }    : {}),
    ...(dynamicButtonStyle.fontSize   != null ? { fontSize:       dynamicButtonStyle.fontSize }  : {}),
    ...(dynamicButtonStyle.letterSpacing != null ? { letterSpacing: dynamicButtonStyle.letterSpacing } : {}),
  };

  // Handle button navigation
  const handleButtonPress = () => {
    const ref = buttonNavigateRef?.trim();
    const type = (buttonNavigateType || "").trim().toLowerCase();

    if (ref && type) {
      if (type === "collection") {
        navigation.navigate("CollectionProducts", { handle: ref });
      } else if (type === "product") {
        navigation.navigate("ProductDetail", { handle: ref });
      } else if (type === "allproducts" || type === "all_products" || type === "all-products") {
        navigation.navigate("AllProducts");
      } else if (type === "route") {
        navigation.navigate(ref);
      }
      // "url" type opens external link — no-op in native app without Linking
    } else if (buttonLink && typeof buttonLink === "string" && buttonLink.trim()) {
      const link = buttonLink.trim();
      if (!link.startsWith("/")) return;
      // Map common web paths to native screens
      if (link.startsWith("/collections/")) {
        navigation.navigate("CollectionProducts", { handle: link.replace("/collections/", "") });
      } else if (link.startsWith("/products/")) {
        navigation.navigate("ProductDetail", { handle: link.replace("/products/", "") });
      } else if (link === "/products") {
        navigation.navigate("AllProducts");
      }
    }
  };

  // Content settings
  const contentSettingsEnabled = toBoolean(rawProps?.contentSettingsEnabled, true);
  const contentProps = rawProps?.content?.properties || rawProps?.content || {};
  
  // Image source - check multiple possible property names and nested structures
  // Filter out empty strings and whitespace-only strings
  const rawImageSrc =
    unwrapValue(rawProps?.uploadImage, "") ||
    unwrapValue(rawProps?.imageLink, "") ||
    unwrapValue(rawProps?.image, "") ||
    unwrapValue(rawProps?.imageUrl, "") ||
    unwrapValue(rawProps?.imageURL, "") ||
    unwrapValue(rawProps?.backgroundImage, "") ||
    unwrapValue(rawProps?.bgImage, "") ||
    unwrapValue(rawProps?.src, "") ||
    unwrapValue(rawProps?.url, "") ||
    // Also check in imageAttributes
    unwrapValue(imageAttributes?.imageUrl, "") ||
    unwrapValue(imageAttributes?.image, "") ||
    unwrapValue(imageAttributes?.src, "") ||
    // Check in content properties
    unwrapValue(contentProps?.image, "") ||
    unwrapValue(contentProps?.imageUrl, "");
  
  // Only use imageSrc if it's a non-empty string
  const imageSrc = rawImageSrc && typeof rawImageSrc === "string" && rawImageSrc.trim() !== "" ? rawImageSrc.trim() : null;
  const imageAlt = toString(contentProps?.alt, "");
  const overlayOpacity =
    toNumber(contentProps?.overlayOpacity, undefined) ??
    toNumber(layoutCss?.image?.overlayOpacityPct, 40);

  // Alignment and padding
  const alignSettingsEnabled = toBoolean(rawProps?.alignSettingsEnabled, true);
  const alignmentAndPadding = rawProps?.alignmentAndPadding?.properties || rawProps?.alignmentAndPadding || {};
  const textAlign = toString(alignmentAndPadding?.textAlign, "center").toLowerCase();
  const align = toString(alignmentAndPadding?.align, "Center").toLowerCase();
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Per-element text alignment — reads from element attributes first, then flatProps aliases,
  // then falls back to the global textAlign above.
  // Builder stores the typography-panel "Alignment" control as align/textAlign inside each attributes object.
  const headlineTextAlign = (
    toString(headlineAttributes?.textAlign ?? headlineAttributes?.align, "") ||
    toString(
      flatPropsNode?.headlineTextAlign ??
      flatPropsNode?.headlineAlign ??
      flatPropsNode?.headAlign,
      ""
    ) ||
    textAlign
  ).toLowerCase();

  const subtextTextAlign = (
    toString(subtextAttributes?.textAlign ?? subtextAttributes?.align, "") ||
    toString(
      flatPropsNode?.subtextTextAlign ??
      flatPropsNode?.subtextAlign ??
      flatPropsNode?.bodyAlign ??
      flatPropsNode?.subtextTextAlign,
      ""
    ) ||
    textAlign
  ).toLowerCase();
  
  // Extract padding from paddingRaw or padding string
  const paddingRaw = alignmentAndPadding?.paddingRaw?.properties || alignmentAndPadding?.paddingRaw || {};
  const paddingString = toString(alignmentAndPadding?.padding, "");
  const paddingTop = toNumber(paddingRaw?.pt, paddingString ? parseFloat(paddingString.split(/\s+/)[0]) : 21);
  const paddingRight = toNumber(paddingRaw?.pr, paddingString ? parseFloat(paddingString.split(/\s+/)[1] || paddingString.split(/\s+/)[0]) : 55);
  const paddingBottom = toNumber(paddingRaw?.pb, paddingString ? parseFloat(paddingString.split(/\s+/)[2] || paddingString.split(/\s+/)[0]) : 50);
  const paddingLeft = toNumber(paddingRaw?.pl, paddingString ? parseFloat(paddingString.split(/\s+/)[3] || paddingString.split(/\s+/)[1] || paddingString.split(/\s+/)[0]) : 58);

  // Background settings
  const bgSettingsEnabled = toBoolean(rawProps?.bgSettingsEnabled, true);
  const styleProps = rawProps?.style?.properties || rawProps?.style || {};
  const backgroundColor = toString(styleProps?.backgroundColor || layoutCss?.container?.background, "#ebeef4");
  const backgroundOpacity =
    toNumber(styleProps?.backgroundOpacity, undefined) ??
    toNumber(layoutCss?.container?.backgroundOpacityPct, 100);
  // Gradient end color — used by the builder to create a gradient overlay effect
  const containerBgGradientColor =
    toString(rawProps?.containerBgGradiantColor, "") ||
    toString(flatPropsNode?.containerBgGradiantColor, "");
  // Container border radius — fully DSL-driven, defaults to 0 (sharp corners).
  // Priority: style prop > raw prop aliases > layout CSS > CSS post-convert > 0
  // _cBrFromCss is stripped from containerStyle above so it cannot override this value later.
  const containerBorderRadius = (() => {
    const fromStyle = toNumber(styleProps?.borderRadius, undefined);
    if (fromStyle !== undefined) return fromStyle;
    const fromRaw = toNumber(
      rawProps?.containerRadius ??
      rawProps?.cornerRadius ??
      rawProps?.borderRadius,
      undefined
    );
    if (fromRaw !== undefined) return fromRaw;
    const fromCss = toNumber(layoutCss?.container?.borderRadius, undefined);
    if (fromCss !== undefined) return fromCss;
    if (_cBrFromCss !== undefined && _cBrFromCss !== null) {
      return typeof _cBrFromCss === "number" ? _cBrFromCss : toNumber(_cBrFromCss, 0);
    }
    return 0;
  })();
  const containerHeight = toString(styleProps?.height || layoutCss?.container?.height, "auto");

  // Outer card container — transparent by default so no white box appears around the banner
  const outerBgColor = toString(rawProps?.containerBgColor, "transparent");
  const outerBorderColor = toString(rawProps?.containerBorderColor, "transparent");
  const outerBorderSide = toString(rawProps?.containerBorderSide, "none").toLowerCase();
  const outerBorderRadius = toNumber(rawProps?.containerBorderRadius, 0);

  const outerBorderStyle =
    outerBorderSide === "none"
      ? {}
      : outerBorderSide === "all" || !outerBorderSide
      ? { borderWidth: 1, borderColor: outerBorderColor }
      : outerBorderSide === "bottom"
      ? { borderBottomWidth: 1, borderColor: outerBorderColor }
      : outerBorderSide === "top"
      ? { borderTopWidth: 1, borderColor: outerBorderColor }
      : outerBorderSide === "left"
      ? { borderLeftWidth: 1, borderColor: outerBorderColor }
      : outerBorderSide === "right"
      ? { borderRightWidth: 1, borderColor: outerBorderColor }
      : { borderWidth: 1, borderColor: outerBorderColor };

  const contentPositionStyle = applyMetricsPositioning({}, metricElements?.container);
  const headlinePositionStyle = applyMetricsPositioning({}, metricElements?.headline);
  const subtextPositionStyle = applyMetricsPositioning({}, metricElements?.subtext);
  const buttonPositionStyle = applyMetricsPositioning({}, metricElements?.button);

  const hasAbsoluteMetrics =
    contentPositionStyle?.position === "absolute" ||
    headlinePositionStyle?.position === "absolute" ||
    subtextPositionStyle?.position === "absolute" ||
    buttonPositionStyle?.position === "absolute";

  const hasTextContent =
    (showHeadline && headline) || (showSubtext && subtext) || (showButton && buttonLabel);
  const hasVisibleContent = hasTextContent || imageSrc;
  if (!hasVisibleContent) return null;

  // Calculate container height:
  // 1. Explicit numeric height from DSL style/CSS (highest priority)
  // 2. Metrics container height — builder-defined pixel height (use when CSS says "auto")
  // 3. No fixed height — container grows with content
  const numericContainerHeight = containerHeight !== "auto"
    ? toNumber(containerHeight, undefined)
    : metricsAvailable && metricElements?.container?.height
    ? toNumber(metricElements.container.height, undefined)
    : undefined;

  // When an image is present, the content View is position:absolute (overlays the image),
  // so the container needs an explicit height — it gets no natural height from absolute children.
  // When there is NO image, content is in normal flow and the container grows to fit the text.
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const DEFAULT_BANNER_HEIGHT = Math.round(SCREEN_WIDTH * 0.55); // ~55% of screen width

  const containerHeightStyle = numericContainerHeight
    ? { height: numericContainerHeight }
    : imageAspectRatio
    ? {} // aspectRatio handles height
    : imageSrc
    ? { height: DEFAULT_BANNER_HEIGHT } // image present — need explicit height
    : {}; // text-only banner — container grows naturally with content

  const innerContainerStyle = [
    styles.container,
    {
      borderRadius: containerBorderRadius,
      ...(imageAspectRatio ? { aspectRatio: imageAspectRatio } : {}),
      ...containerHeightStyle,
    },
    containerStyle,
  ];

  const innerChildren = (
    <>
      {imageSrc ? (
        <Image
          source={{ uri: imageSrc }}
          style={[
            imageCssStyle,
            styles.image, // base style last so position/top/left/right/bottom always win
          ]}
          resizeMode={resizeMode}
        />
      ) : null}

      {imageSrc && contentSettingsEnabled && overlayOpacity > 0 ? (
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: "#000000",
              opacity: overlayOpacity / 100,
            },
          ]}
        />
      ) : null}

      {/* When image is present: content overlays it (position:absolute).
          When no image: content is in normal flow so the container grows to fit the text. */}
      <View
        style={[
          imageSrc ? styles.content : styles.contentInline,
          {
            alignItems: alignSettingsEnabled ? alignItems : "center",
            paddingTop: hasTextContent
              ? (alignSettingsEnabled
                  ? paddingTop > 0 ? paddingTop : (imageSrc ? 0 : 24)
                  : imageSrc ? 40 : 24)
              : 0,
            paddingRight:  hasTextContent ? (alignSettingsEnabled ? paddingRight  : 30) : 0,
            paddingBottom: hasTextContent ? (alignSettingsEnabled ? paddingBottom : (imageSrc ? 50 : 24)) : 0,
            paddingLeft:   hasTextContent ? (alignSettingsEnabled ? paddingLeft   : 30) : 0,
          },
        ]}
      >
        {showHeadline && headline ? (
          <Text style={[styles.headline, headlineStyle, { textAlign: headlineTextAlign || "center" }]}>
            {headline}
          </Text>
        ) : null}

        {showSubtext && subtext ? (
          <Text style={[styles.subtext, subtextStyle, { textAlign: subtextTextAlign || "center" }]}>
            {subtext}
          </Text>
        ) : null}

        {showButton && buttonLabel ? (
          <View style={styles.buttonWrapper}>
            <TouchableOpacity onPress={handleButtonPress} activeOpacity={0.8}>
              <View style={[styles.buttonInner, btnViewDynStyle]}>
                {!!buttonIconName && buttonIconPosition !== "right" && (
                  <FontAwesome
                    name={buttonIconName}
                    size={buttonIconSize}
                    color={buttonIconColor}
                  />
                )}
                <Text style={[styles.buttonText, btnTextDynStyle]}>{buttonLabel}</Text>
                {!!buttonIconName && buttonIconPosition === "right" && (
                  <FontAwesome
                    name={buttonIconName}
                    size={buttonIconSize}
                    color={buttonIconColor}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.outerCard,
        { backgroundColor: outerBgColor, borderRadius: outerBorderRadius, ...outerBorderStyle },
      ]}
    >
      {containerBgGradientColor ? (
        <LinearGradient
          colors={[
            bgSettingsEnabled ? withColorOpacity(backgroundColor, backgroundOpacity) : "transparent",
            containerBgGradientColor,
          ]}
          angle={180}
          useAngle={true}
          style={innerContainerStyle}
        >
          {innerChildren}
        </LinearGradient>
      ) : (
        <View
          style={[
            ...innerContainerStyle,
            {
              // When an image is present it covers the container entirely; keep bg transparent
              // so no colour bleeds out if the container is ever taller than the image.
              backgroundColor: imageSrc
                ? "transparent"
                : bgSettingsEnabled
                  ? withColorOpacity(backgroundColor, backgroundOpacity)
                  : "transparent",
            },
          ]}
        >
          {innerChildren}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerCard: {
    width: "100%",
    overflow: "hidden",
  },
  container: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    flexShrink: 0,
    alignSelf: "stretch",
  },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    zIndex: 1, // Above image, below content
  },
  content: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  absoluteContentLayer: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  headline: {
    color: "#0f0f0f",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center", // Center headline text
    width: "100%", // Full width for proper centering
  },
  subtext: {
    marginTop: 8,
    color: "#3b3c40",
    fontSize: 16,
    textAlign: "center", // Center subtext
    width: "100%", // Full width for proper centering
  },
  buttonWrapper: {
    marginTop: 12,
    width: "100%", // Full width to allow centering
    alignItems: "center", // Center the button horizontally
    justifyContent: "center", // Center the button horizontally
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
  },
  buttonText: {
    textAlign: "center",
  },
  contentInline: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
});

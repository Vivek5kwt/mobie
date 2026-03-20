import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { applyMetricsPositioning, convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
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
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  // Extract layout CSS and metrics
  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const layoutMetrics = rawProps?.layout?.properties?.metrics || rawProps?.layout?.metrics || {};
  const metricElements = layoutMetrics?.elements || {};

  // Convert CSS styles
  const containerStyle = convertStyles(layoutCss?.container || {});
  const headlineCssStyle = convertStyles(layoutCss?.headline || {});
  const subtextCssStyle = convertStyles(layoutCss?.subtext || {});
  const buttonCssStyle = convertStyles(layoutCss?.button || {});
  const imageCssStyle = convertStyles(layoutCss?.image || {});

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
  const imageScale = toString(imageAttributes?.scale, "Fit").toLowerCase();
  const imageCornerRadius = toNumber(imageAttributes?.imageCorner, 7);
  
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
  // CSS objectFit: contain -> contain, cover -> cover, fill -> stretch
  const cssObjectFit = toString(layoutCss?.image?.objectFit, "contain").toLowerCase();
  const resizeMode =
    cssObjectFit === "cover" || imageScale === "cover"
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
  const buttonEnabled = button?.properties?.enabled || button?.enabled;
  const showButtonFromEnabled = buttonEnabled === "yes" || buttonEnabled === true || toBoolean(buttonEnabled, false);
  const showButton = flatPropsNode?.showButton !== undefined
    ? toBoolean(flatPropsNode.showButton, showButtonFromEnabled)
    : showButtonFromEnabled;
  const buttonLabel = unwrapValue(button?.properties?.label || button?.label, "Shop Now");
  const buttonLink = unwrapValue(button?.properties?.link || button?.link, "/products");
  const buttonNavigateRef = unwrapValue(button?.properties?.navigateRef || button?.navigateRef, "");
  const buttonNavigateType = unwrapValue(button?.properties?.navigateType || button?.navigateType, "");
  
  // Button style tokens - default to white background as per schema
  const buttonTokens = button?.properties?.style?.properties || button?.style?.properties || {};
  const buttonBgColor = unwrapValue(buttonTokens?.backgroundColor, undefined) || 
                        toString(layoutCss?.button?.backgroundColor, "#FFFFFF");
  const buttonTextColor = unwrapValue(buttonTokens?.color, undefined) || 
                          toString(layoutCss?.button?.color, "#111827");
  const buttonBorder = unwrapValue(buttonTokens?.border, "none");
  const buttonPadding = unwrapValue(buttonTokens?.padding, "8px 14px");
  const buttonBorderRadius = unwrapValue(buttonTokens?.borderRadius, "7px");
  
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
  
  const buttonPaddingStyle = parsePadding(buttonPadding);
  
  // Extract button text style properties
  const buttonWeight = unwrapValue(button?.properties?.weight || button?.weight, undefined);
  const buttonBold = toBoolean(button?.properties?.bold || button?.bold, false);
  const buttonItalic = toBoolean(button?.properties?.italic || button?.italic, false);
  const buttonUnderline = toBoolean(button?.properties?.underline || button?.underline, false);
  
  // Build dynamic button style - prioritize CSS, then button tokens, then defaults
  const dynamicButtonStyle = {
    ...buttonCssStyle,
    color: buttonTextColor,
    backgroundColor: buttonBgColor,
    borderRadius: toNumber(buttonBorderRadius, 7),
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
    ...(buttonBorder && buttonBorder !== "none" ? { 
      borderWidth: 1, 
      borderColor: buttonBorder 
    } : {}),
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
  const containerBorderRadius = toNumber(styleProps?.borderRadius, 7) || 
                                 toNumber(layoutCss?.container?.borderRadius, 7);
  const containerHeight = toString(styleProps?.height || layoutCss?.container?.height, "auto");

  // Outer card container (white card + border), matching web DSL containerBgColor/containerBorder*
  const outerBgColor = toString(rawProps?.containerBgColor, "#FFFFFF");
  const outerBorderColor = toString(rawProps?.containerBorderColor, "#D1D5DB");
  const outerBorderSide = toString(rawProps?.containerBorderSide, "all").toLowerCase();
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

  const hasVisibleContent =
    (showHeadline && headline) || (showSubtext && subtext) || (showButton && buttonLabel) || imageSrc;
  if (!hasVisibleContent) return null;

  // Calculate container height:
  // - If an explicit numeric height is provided, use it.
  // - Otherwise, let content determine the height dynamically so the image
  //   always expands behind all text (no clipping when text is taller).
  const numericContainerHeight = containerHeight !== "auto"
    ? toNumber(containerHeight, undefined)
    : undefined;

  const containerHeightStyle = numericContainerHeight
    ? { height: numericContainerHeight }
    : {}; // No fixed height; container grows with content, and image fills it

  return (
    <View
      style={[
        styles.outerCard,
        {
          backgroundColor: outerBgColor,
          borderRadius: outerBorderRadius,
          ...outerBorderStyle,
        },
      ]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: bgSettingsEnabled
              ? withColorOpacity(backgroundColor, backgroundOpacity)
              : "transparent",
            borderRadius: containerBorderRadius,
            ...containerHeightStyle,
          },
          containerStyle,
        ]}
      >
        {imageSrc ? (
          <Image
            source={{ uri: imageSrc }}
            style={[
              styles.image,
              {
                borderRadius: imageCornerRadius || toNumber(layoutCss?.image?.borderRadius, 7),
              },
              imageCssStyle,
            ]}
            resizeMode={resizeMode}
          />
        ) : null}

        {imageSrc && contentSettingsEnabled && overlayOpacity > 0 ? (
          <View
            style={[
              styles.overlay,
              {
                opacity: overlayOpacity / 100,
                borderRadius: imageCornerRadius || toNumber(layoutCss?.image?.borderRadius, 7),
              },
            ]}
          />
        ) : null}

        <View
          style={[
            styles.content,
            hasAbsoluteMetrics ? styles.absoluteContentLayer : null,
            {
              alignItems: alignSettingsEnabled ? alignItems : "center",
              paddingTop: alignSettingsEnabled ? paddingTop : 40,
              paddingRight: alignSettingsEnabled ? paddingRight : 30,
              paddingBottom: alignSettingsEnabled ? paddingBottom : 50,
              paddingLeft: alignSettingsEnabled ? paddingLeft : 30,
            },
            contentPositionStyle,
          ]}
        >
          {showHeadline && headline ? (
            <Text
              style={[
                styles.headline,
                headlineStyle,
                headlinePositionStyle,
                { textAlign: "center" },
              ]}
            >
              {headline}
            </Text>
          ) : null}

          {showSubtext && subtext ? (
            <Text
              style={[
                styles.subtext,
                subtextStyle,
                subtextPositionStyle,
                { textAlign: "center" },
              ]}
            >
              {subtext}
            </Text>
          ) : null}

          {showButton && buttonLabel ? (
            <View
              style={[
                styles.buttonWrapper,
                buttonPositionStyle,
              ]}
            >
              <TouchableOpacity onPress={handleButtonPress} activeOpacity={0.8}>
                <Text style={[styles.button, dynamicButtonStyle]}>{buttonLabel}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerCard: {
    width: "100%",
    padding: 0,
    margin: 0,
  },
  container: {
    position: "relative",
    width: "100%",
    minHeight: 200, // Minimum height to ensure visibility
    overflow: "hidden",
    // Ensure container can expand to fit content dynamically
    flexShrink: 0,
    // Remove any default padding/margin that might prevent image from filling
    padding: 0,
    margin: 0,
    // Allow container to grow based on content
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
    minWidth: "100%",
    minHeight: "100%",
    zIndex: 0, // Behind all content
    // Ensure image covers the entire area
    resizeMode: "cover", // This will be overridden by the resizeMode prop, but ensures default behavior
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
    position: "relative",
    width: "100%",
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally (will be overridden by dynamic alignItems)
    zIndex: 2, // Ensure content is above image/overlay
    minHeight: 200, // Minimum height to ensure content is visible
    // Don't use flex: 1 - let content determine its own height
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
  button: {
    textAlign: "center", // Center text within button
    alignSelf: "center", // Ensure button itself is centered
    // All other styles (padding, borderRadius, fontWeight, backgroundColor, color) are set dynamically from config
  },
});

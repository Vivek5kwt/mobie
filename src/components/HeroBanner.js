import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
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

const normalizeWeight = (weight, bold = false) => {
  if (bold) return "700";
  if (!weight) return undefined;
  const raw = String(weight).trim().toLowerCase();
  if (raw === "bold") return "700";
  if (raw === "regular") return "400";
  return String(weight);
};

const buildTextAttributesStyle = (attributes) => {
  if (!attributes || typeof attributes !== "object") return null;

  const color = unwrapValue(attributes?.color, undefined);
  const fontFamily = unwrapValue(attributes?.fontFamily, undefined);
  const fontSize = toNumber(attributes?.size, undefined);
  const isBold = toBoolean(attributes?.bold, false);
  const isItalic = toBoolean(attributes?.italic, false);
  const isUnderline = toBoolean(attributes?.underline, false);
  const fontWeight = normalizeWeight(unwrapValue(attributes?.weight, undefined), isBold);

  return {
    color,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle: isItalic ? "italic" : "normal",
    textDecorationLine: isUnderline ? "underline" : "none",
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
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const layoutMetrics = rawProps?.layout?.properties?.metrics || rawProps?.layout?.metrics || {};
  const metricElements = layoutMetrics?.elements || {};

  const containerStyle = convertStyles(layoutCss?.container || {});
  const headlineCssStyle = convertStyles(layoutCss?.headline || {});
  const subtextCssStyle = convertStyles(layoutCss?.subtext || {});
  const buttonStyle = convertStyles(layoutCss?.button || {});
  const imageStyle = convertStyles(layoutCss?.image || {});

  const headlineAttributes =
    rawProps?.headlineAttributes?.properties || rawProps?.headlineAttributes || {};
  const subtextAttributes =
    rawProps?.subtextAttributes?.properties || rawProps?.subtextAttributes || {};

  const headlineStyle = {
    ...headlineCssStyle,
    ...buildTextAttributesStyle(headlineAttributes),
  };
  const subtextStyle = {
    ...subtextCssStyle,
    ...buildTextAttributesStyle(subtextAttributes),
  };

  const imageAttributes = rawProps?.imageAttributes?.properties || rawProps?.imageAttributes || {};
  const imageScale = unwrapValue(imageAttributes?.scale, "Cover")?.toString().toLowerCase();
  const imageCornerRadius = toNumber(imageAttributes?.imageCorner, 0);
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
  const resizeMode =
    imageScale === "fit"
      ? "contain"
      : imageScale === "stretch"
        ? "stretch"
        : imageScale === "center"
          ? "center"
          : "cover";

  const headline = unwrapValue(rawProps?.headline, "") || unwrapValue(rawProps?.title, "");
  const subtext = unwrapValue(rawProps?.subtext, "") || unwrapValue(rawProps?.subtitle, "");
  const button = rawProps?.button || {};
  const buttonLabel = unwrapValue(button?.properties?.label || button?.label, "");
  const showButton = toBoolean(button?.properties?.enabled || button?.enabled, false);
  const buttonTokens = button?.properties?.style?.properties || button?.style?.properties || {};
  
  // Get button background color from config, default to white
  const buttonBgColor = unwrapValue(buttonTokens?.backgroundColor, undefined) || "#FFFFFF";
  
  // Helper to determine if a color is dark (for automatic text color contrast)
  const isDarkColor = (color) => {
    if (!color || typeof color !== "string") return false;
    // Handle hex colors
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16);
      const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16);
      const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16);
      // Calculate luminance
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    }
    // Handle named colors (basic check)
    const darkColors = ["black", "#000", "#000000", "dark"];
    return darkColors.some(dark => color.toLowerCase().includes(dark));
  };
  
  // Auto-adjust text color for contrast if not explicitly set
  const explicitTextColor = unwrapValue(buttonTokens?.color, undefined);
  const autoTextColor = isDarkColor(buttonBgColor) ? "#FFFFFF" : "#111111";
  const buttonTextColor = explicitTextColor || autoTextColor;
  
  const dynamicButtonStyle = {
    ...buttonStyle,
    ...convertStyles({
      color: buttonTextColor, // Use auto-contrast or explicit color
      border: unwrapValue(buttonTokens?.border, undefined),
      padding: unwrapValue(buttonTokens?.padding, undefined),
      borderRadius: unwrapValue(buttonTokens?.borderRadius, undefined),
      backgroundColor: buttonBgColor, // Fully dynamic from config
      fontWeight: toBoolean(button?.properties?.bold || button?.bold, false) ? "700" : undefined,
      fontStyle: toBoolean(button?.properties?.italic || button?.italic, false) ? "italic" : "normal",
      textDecoration: toBoolean(button?.properties?.underline || button?.underline, false)
        ? "underline"
        : "none",
    }),
  };

  const imageSrc =
    unwrapValue(rawProps?.uploadImage, "") ||
    unwrapValue(rawProps?.imageLink, "") ||
    unwrapValue(rawProps?.image, "") ||
    unwrapValue(rawProps?.imageUrl, "") ||
    unwrapValue(rawProps?.imageURL, "");
  const overlayOpacity =
    toNumber(rawProps?.content?.properties?.overlayOpacity || rawProps?.content?.overlayOpacity, undefined) ??
    toNumber(layoutCss?.image?.overlayOpacityPct, 0);

  const align = (unwrapValue(rawProps?.alignmentAndPadding?.properties?.textAlign, "center") || "center")
    .toString()
    .toLowerCase();
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  const backgroundColor = unwrapValue(
    rawProps?.style?.properties?.backgroundColor || rawProps?.style?.backgroundColor,
    "#ebeef4"
  );

  const backgroundOpacity =
    toNumber(rawProps?.style?.properties?.backgroundOpacity || rawProps?.style?.backgroundOpacity, undefined) ??
    toNumber(layoutCss?.container?.backgroundOpacityPct, 100);

  const contentPositionStyle = applyMetricsPositioning({}, metricElements?.container);
  const headlinePositionStyle = applyMetricsPositioning({}, metricElements?.headline);
  const subtextPositionStyle = applyMetricsPositioning({}, metricElements?.subtext);
  const buttonPositionStyle = applyMetricsPositioning({}, metricElements?.button);

  const hasAbsoluteMetrics =
    contentPositionStyle?.position === "absolute" ||
    headlinePositionStyle?.position === "absolute" ||
    subtextPositionStyle?.position === "absolute" ||
    buttonPositionStyle?.position === "absolute";

  if (!headline && !subtext && !imageSrc) return null;

  return (
    <View
      style={[
        styles.container,
        containerStyle,
        { backgroundColor: withColorOpacity(backgroundColor, backgroundOpacity) },
        imageAspectRatio ? { aspectRatio: imageAspectRatio } : null,
        imageCornerRadius ? { borderRadius: imageCornerRadius } : null,
      ]}
    >
      {imageSrc ? (
        <Image
          source={{ uri: imageSrc }}
          style={[styles.image, imageStyle, imageCornerRadius ? { borderRadius: imageCornerRadius } : null]}
          resizeMode={resizeMode}
        />
      ) : null}

      {overlayOpacity ? (
        <View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity / 100,
              backgroundColor: "#000",
            },
            imageCornerRadius ? { borderRadius: imageCornerRadius } : null,
          ]}
        />
      ) : null}

      <View
        style={[
          styles.content,
          hasAbsoluteMetrics ? styles.absoluteContentLayer : null,
          { alignItems },
          contentPositionStyle,
        ]}
      >
        {headline ? (
          <Text style={[styles.headline, headlineStyle, headlinePositionStyle, { textAlign: "center" }]}>{headline}</Text>
        ) : null}

        {subtext ? (
          <Text style={[styles.subtext, subtextStyle, subtextPositionStyle, { textAlign: "center" }]}>{subtext}</Text>
        ) : null}

        {showButton && buttonLabel ? (
          <View style={[styles.buttonWrapper, buttonPositionStyle, { alignSelf: "center" }]}>
            <Text style={[styles.button, dynamicButtonStyle]}>{buttonLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
    minHeight: 250, // Default minimum height for hero banner to ensure proper visibility
    overflow: "hidden",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    width: "100%",
    paddingVertical: 32, // Add vertical padding for better spacing
    paddingHorizontal: 20, // Add horizontal padding for better spacing
    minHeight: 200, // Ensure content area has minimum height
    justifyContent: "center", // Center content vertically
    alignItems: "center", // Center content horizontally (will be overridden by dynamic alignItems)
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
    paddingHorizontal: 20, // Better padding for button
    paddingVertical: 12, // Better padding for button
    borderRadius: 8,
    fontWeight: "700",
    textAlign: "center", // Center text within button
    alignSelf: "center", // Ensure button itself is centered
    // backgroundColor and color are set dynamically from config
  },
});

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { convertStyles } from "../utils/convertStyles";

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

export default function HeroBanner({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const containerStyle = convertStyles(layoutCss?.container || {});
  const headlineStyle = convertStyles(layoutCss?.headline || {});
  const subtextStyle = convertStyles(layoutCss?.subtext || {});
  const buttonStyle = convertStyles(layoutCss?.button || {});
  const imageStyle = convertStyles(layoutCss?.image || {});

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

  const headline = unwrapValue(rawProps?.headline, "");
  const subtext = unwrapValue(rawProps?.subtext, "");
  const button = rawProps?.button || {};
  const buttonLabel = unwrapValue(button?.properties?.label || button?.label, "");
  const showButton = toBoolean(button?.properties?.enabled || button?.enabled, false);

  const imageSrc = unwrapValue(rawProps?.uploadImage, "") || unwrapValue(rawProps?.imageLink, "");
  const overlayOpacity = toNumber(rawProps?.content?.properties?.overlayOpacity || rawProps?.content?.overlayOpacity, 0);

  const align = (unwrapValue(rawProps?.alignmentAndPadding?.properties?.textAlign, "center") || "center")
    .toString()
    .toLowerCase();
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  const backgroundColor = unwrapValue(
    rawProps?.style?.properties?.backgroundColor || rawProps?.style?.backgroundColor,
    "#ebeef4"
  );

  if (!headline && !subtext && !imageSrc) return null;

  return (
    <View
      style={[
        styles.container,
        containerStyle,
        { backgroundColor },
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

      <View style={[styles.content, { alignItems }]}>
        {headline ? (
          <Text style={[styles.headline, headlineStyle]}>{headline}</Text>
        ) : null}

        {subtext ? (
          <Text style={[styles.subtext, subtextStyle]}>{subtext}</Text>
        ) : null}

        {showButton && buttonLabel ? (
          <View style={styles.buttonWrapper}>
            <Text style={[styles.button, buttonStyle]}>{buttonLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
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
  },
  headline: {
    color: "#0f0f0f",
    fontSize: 24,
    fontWeight: "700",
  },
  subtext: {
    marginTop: 8,
    color: "#3b3c40",
    fontSize: 16,
  },
  buttonWrapper: {
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: "#ffffff",
    backgroundColor: "#111111",
    borderRadius: 8,
    fontWeight: "700",
  },
});

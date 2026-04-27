import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
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

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

const deriveWeight = (value, fallback = "700") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "string") {
    const lowered = resolved.toLowerCase();
    if (lowered === "bold") return "700";
    if (lowered === "medium") return "500";
    if (lowered === "regular") return "400";
  }
  return String(resolved);
};

const normalizePlatforms = (rawPlatforms) => {
  const resolvedPlatforms = unwrapValue(rawPlatforms, rawPlatforms);
  const source = Array.isArray(resolvedPlatforms)
    ? resolvedPlatforms
    : Array.isArray(resolvedPlatforms?.items)
      ? resolvedPlatforms.items
      : Array.isArray(resolvedPlatforms?.properties?.items)
        ? resolvedPlatforms.properties.items
        : Object.values(resolvedPlatforms || {});
  return source
    .map((item, idx) => {
      const props = item?.properties || item || {};
      const id = unwrapValue(props.id, `platform-${idx}`);
      const platform = unwrapValue(props.platform, id);
      const url = unwrapValue(props.url, "");
      const enabled = toBoolean(props.enabled, true);

      if (!enabled) return null;
      return { id, platform, url };
    })
    .filter(Boolean);
};

const brandColors = {
  facebook: "#1877F2",
  twitter: "#000000",
  "x-twitter": "#000000",
  instagram: "#C13584",
  youtube: "#FF0000",
  whatsapp: "#25D366",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  tiktok: "#000000",
};

const iconNameMap = {
  facebook: "facebook",
  twitter: "x-twitter",
  "x-twitter": "x-twitter",
  instagram: "instagram",
  youtube: "youtube",
  whatsapp: "whatsapp",
  linkedin: "linkedin",
  pinterest: "pinterest",
  tiktok: "tiktok",
};

// Parse CSS border shorthand e.g. "1px solid #016D77"
const parseBorderShorthand = (borderStr) => {
  if (!borderStr || typeof borderStr !== "string") return null;
  const parts = borderStr.trim().split(/\s+/);
  const widthPart = parts.find((p) => /px$/i.test(p));
  const colorPart = parts.find((p) => p.startsWith("#") || p.startsWith("rgb"));
  const width = widthPart ? parseFloat(widthPart) : null;
  if (!width || !colorPart) return null;
  return { borderWidth: width, borderColor: colorPart };
};

const brandIconNames = new Set(Object.values(iconNameMap));
const isHttpUrl = (url = "") => /^https?:\/\//i.test(String(url));

export default function SocialMediaIcons({ section }) {
  const navigation = useNavigation();
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};

  const platforms = useMemo(
    () => normalizePlatforms(rawProps?.platforms || []),
    [rawProps?.platforms],
  );

  if (!platforms.length) return null;

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const pt = toNumber(rawProps?.pt, 8);
  const pr = toNumber(rawProps?.pr, 0);
  const pb = toNumber(rawProps?.pb, 8);
  const pl = toNumber(rawProps?.pl, 0);
  const align = (unwrapValue(rawProps?.align, "left") || "left").toLowerCase();

  // ── Feature toggles — respect builder on/off switches ───────────────────────
  const titleSettingsEnabled   = toBoolean(rawProps?.titleSettingsEnabled,   true);
  const iconsSettingsEnabled   = toBoolean(rawProps?.iconsSettingsEnabled,   true);

  const titleText = unwrapValue(rawProps?.titleText, "");
  const titleColor = unwrapValue(rawProps?.titleColor, "#111111");
  const titleFontSize = toNumber(rawProps?.titleFontSize, 14);
  const titleFontFamily = cleanFontFamily(unwrapValue(rawProps?.titleFontFamily, undefined));
  const titleFontWeight = toBoolean(rawProps?.titleBold, false)
    ? "700"
    : deriveWeight(rawProps?.titleFontWeight, "600");
  const titleFontStyle = toBoolean(rawProps?.titleItalic, false) ? "italic" : "normal";
  const titleDecoration = toBoolean(rawProps?.titleUnderline, false) ? "underline" : "none";
  const titleStrikethrough = toBoolean(rawProps?.titleStrikethrough, false);
  const titleDecorationLine = titleDecoration === "underline" && titleStrikethrough
    ? "underline line-through"
    : titleDecoration === "underline" ? "underline"
    : titleStrikethrough ? "line-through"
    : "none";

  // Title is shown ONLY when the builder explicitly enables it AND there is text
  const showTitle = titleSettingsEnabled && !!titleText;

  const iconSize = toNumber(rawProps?.iconSize, 28);
  const iconColor = unwrapValue(rawProps?.iconColor, "#FFFFFF");
  const iconSpacing = toNumber(rawProps?.iconSpacing, 4);
  const iconBorderRadius = toNumber(rawProps?.iconBorderRadius, 0);
  const useBrand = toBoolean(rawProps?.useBrandColors, true);

  const containerStyle = convertStyles(layoutCss?.container || {});
  const titleStyle = convertStyles(layoutCss?.title || {});
  const iconsRowStyle = convertStyles(layoutCss?.iconsRow || {});
  const iconBoxCss = layoutCss?.iconBox || {};
  const iconBoxStyle = convertStyles(iconBoxCss);
  const iconStyle = convertStyles(layoutCss?.icon || {});

  // Parse CSS shorthand border and explicit size from iconBox CSS
  const iconBoxBorder = parseBorderShorthand(iconBoxCss?.border);
  const iconBoxWidth = toNumber(iconBoxCss?.width, undefined);
  const iconBoxHeight = toNumber(iconBoxCss?.height, undefined);
  // Gap from iconsRow CSS (RN may not support gap on older versions — use marginRight fallback)
  const iconsRowGap = toNumber(layoutCss?.iconsRow?.gap, iconSpacing);
  const iconsRowPadding = toNumber(layoutCss?.iconsRow?.padding, 0);

  const alignment = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const openLink = async (url) => {
    if (!url) return;
    try {
      if (navigation?.navigate && isHttpUrl(url)) {
        navigation.navigate("CheckoutWebView", { url, title: "Social" });
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      console.log("❌ Failed to open URL", url, err);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: bgColor, paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl },
        containerStyle,
      ]}
    >
      {showTitle && (
        <Text
          style={[
            styles.title,
            titleStyle,
            {
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: titleFontWeight,
              fontStyle: titleFontStyle,
              textDecorationLine: titleDecorationLine,
              fontFamily: titleFontFamily,
              textAlign: align,
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {iconsSettingsEnabled && (
      <View
        style={[
          styles.iconsRow,
          iconsRowStyle,
          {
            justifyContent: alignment,
            padding: iconsRowPadding || undefined,
          },
        ]}
      >
        {platforms.map((platform, idx) => {
          const key = platform.id || platform.platform || `platform-${idx}`;
          const normalizedId = String(platform.platform || platform.id || "").toLowerCase();
          const brandColor = useBrand ? brandColors[normalizedId] : null;
          const resolvedIconName = iconNameMap[normalizedId] || normalizedId || "link";
          const isBrandIcon = brandIconNames.has(resolvedIconName);
          const accessibilityLabel = `Open ${normalizedId || "social"} link`;
          const iconFgColor = useBrand ? "#FFFFFF" : (iconStyle.color || iconColor);

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => openLink(platform.url)}
              style={{ marginRight: idx === platforms.length - 1 ? 0 : iconsRowGap }}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
            >
              <View
                style={[
                  styles.iconBox,
                  iconBoxStyle,
                  {
                    backgroundColor: brandColor || iconBoxStyle.backgroundColor || "#016D77",
                    borderRadius: iconBorderRadius,
                    ...(iconBoxWidth ? { width: iconBoxWidth, height: iconBoxHeight || iconBoxWidth } : {}),
                    ...(iconBoxBorder || {}),
                  },
                ]}
              >
                <Icon
                  name={resolvedIconName}
                  size={iconSize}
                  color={iconFgColor}
                  brand={isBrandIcon}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  title: {
    marginBottom: 8,
    fontWeight: "700",
  },
  iconsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBox: {
    alignItems: "center",
    justifyContent: "center",
  },
});

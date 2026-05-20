import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import FA6GlyphMap from "react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import { convertStyles } from "../utils/convertStyles";
import { resolveFont } from "../services/typographyService";

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

const pickValue = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved !== undefined && resolved !== null && resolved !== "") return resolved;
  }
  return undefined;
};

const pickString = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved === undefined || resolved === null) continue;
    if (typeof resolved === "object") {
      const nested = pickString(
        resolved.icon,
        resolved.iconName,
        resolved.name,
        resolved.id,
        resolved.value,
      );
      if (nested) return nested;
      continue;
    }
    const text = String(resolved).trim();
    if (text) return text;
  }
  return "";
};

const cleanFontFamily = (family) => resolveFont(family) || "";

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
      const platform = unwrapValue(props.platform, "") || id;
      const url = unwrapValue(props.url, "");
      const enabled = toBoolean(props.enabled, true);

      if (!enabled) return null;
      return { ...props, id, platform, url };
    })
    .filter(Boolean);
};

const brandColors = {
  facebook: "#1877F2",
  twitter: "#000000",
  "x-twitter": "#000000",
  x: "#000000",
  instagram: "#C13584",
  youtube: "#FF0000",
  whatsapp: "#25D366",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  tiktok: "#000000",
};

const platformIconAliases = {
  facebook: "facebook",
  "facebook-f": "facebook-f",
  twitter: "twitter",
  "x-twitter": "x-twitter",
  x: "x-twitter",
  instagram: "instagram",
  youtube: "youtube",
  whatsapp: "whatsapp",
  linkedin: "linkedin",
  "linkedin-in": "linkedin-in",
  pinterest: "pinterest",
  "pinterest-p": "pinterest-p",
  tiktok: "tiktok",
};

const brandIconNames = new Set(Object.values(platformIconAliases));

const normalizeIconName = (value) =>
  String(value || "")
    .trim()
    .replace(/^(fa[srldb]|fa[0-9]+)[-_]/i, "")
    .replace(/^fa[-_]/i, "")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

const resolveSocialIconName = (platform) => {
  const explicitIcon = pickString(
    platform?.icon,
    platform?.iconName,
    platform?.iconId,
    platform?.faIcon,
    platform?.fontAwesomeIcon,
    platform?.platformIcon,
  );
  const explicitName = normalizeIconName(explicitIcon);
  if (explicitName && Object.prototype.hasOwnProperty.call(FA6GlyphMap, explicitName)) {
    return explicitName;
  }

  const platformKey = normalizeIconName(pickString(platform?.platform, platform?.id));
  const aliasedName = platformIconAliases[platformKey] || platformKey;
  if (aliasedName && Object.prototype.hasOwnProperty.call(FA6GlyphMap, aliasedName)) {
    return aliasedName;
  }

  return "";
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

const isHttpUrl = (url = "") => /^https?:\/\//i.test(String(url));
const normalizeExternalUrl = (url = "") => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (isHttpUrl(raw)) return raw;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

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

  const iconSize = toNumber(rawProps?.iconSize, undefined);
  const iconSpacing = toNumber(rawProps?.iconSpacing, 4);
  const iconBorderRadius = toNumber(rawProps?.iconBorderRadius, undefined);
  const useBrand = toBoolean(rawProps?.useBrandColors, false);

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
  const iconBoxBaseSize = toNumber(
    pickValue(rawProps?.iconBoxSize, rawProps?.boxSize, rawProps?.iconContainerSize),
    undefined,
  );
  const resolvedIconSize = iconSize || toNumber(layoutCss?.icon?.fontSize, 16);
  const resolvedIconColor = pickValue(
    rawProps?.iconColor,
    iconStyle.color,
    iconBoxStyle.color,
    iconBoxCss?.color,
  );
  const resolvedIconBgColor = pickValue(
    rawProps?.iconBgColor,
    iconBoxStyle.backgroundColor,
    iconBoxCss?.backgroundColor,
  );
  const resolvedIconBorderColor = pickValue(
    rawProps?.iconBorderColor,
    iconBoxStyle.borderColor,
    iconBoxBorder?.borderColor,
  );
  // Gap from iconsRow CSS (RN may not support gap on older versions — use marginRight fallback)
  const iconsRowGap = toNumber(layoutCss?.iconsRow?.gap, iconSpacing);
  const iconsRowPadding = toNumber(layoutCss?.iconsRow?.padding, 0);

  const alignment = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const openLink = async (url) => {
    const resolvedUrl = normalizeExternalUrl(url);
    if (!resolvedUrl) return;
    try {
      if (navigation?.navigate && isHttpUrl(resolvedUrl)) {
        try {
          navigation.navigate("CheckoutWebView", { url: resolvedUrl, title: "Social" });
          return;
        } catch (_navErr) {
          // Fallback to external browser when this route is unavailable in preview context.
        }
      }
      const supported = await Linking.canOpenURL(resolvedUrl);
      if (supported) {
        await Linking.openURL(resolvedUrl);
      }
    } catch (err) {
      console.log("❌ Failed to open URL", resolvedUrl, err);
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
          const normalizedId = normalizeIconName(pickString(platform.platform, platform.id));
          const brandColor = brandColors[normalizedId] || null;
          const resolvedIconName = resolveSocialIconName(platform);
          if (!resolvedIconName) return null;

          const isBrandIcon = brandIconNames.has(resolvedIconName);
          const accessibilityLabel = `Open ${normalizedId || "social"} link`;
          const iconFgColor = pickValue(
            platform?.iconColor,
            platform?.color,
            platform?.textColor,
            resolvedIconColor,
          );
          const iconBgColor = pickValue(
            platform?.iconBgColor,
            platform?.bgColor,
            platform?.backgroundColor,
            useBrand ? brandColor : undefined,
            resolvedIconBgColor,
          );
          const iconBorderColor = pickValue(
            platform?.iconBorderColor,
            platform?.borderColor,
            useBrand ? brandColor : undefined,
            resolvedIconBorderColor,
          );
          const platformUrl = normalizeExternalUrl(platform.url);
          const boxWidth = toNumber(platform?.iconBoxWidth ?? platform?.boxWidth, iconBoxWidth || iconBoxBaseSize);
          const boxHeight = toNumber(platform?.iconBoxHeight ?? platform?.boxHeight, iconBoxHeight || iconBoxBaseSize);
          const boxRadius = toNumber(platform?.iconBorderRadius, iconBorderRadius ?? iconBoxStyle.borderRadius);

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={0.75}
              onPress={() => openLink(platformUrl)}
              disabled={!platformUrl}
              style={{ marginRight: idx === platforms.length - 1 ? 0 : iconsRowGap }}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
            >
              <View
                style={[
                  styles.iconBox,
                  iconBoxStyle,
                  {
                    ...(iconBoxBorder || {}),
                    backgroundColor: iconBgColor,
                    ...(iconBorderColor ? { borderColor: iconBorderColor } : {}),
                    ...(boxRadius !== undefined ? { borderRadius: boxRadius } : {}),
                    ...(boxWidth ? { width: boxWidth, height: boxHeight || boxWidth } : {}),
                  },
                ]}
              >
                <Icon
                  name={resolvedIconName}
                  size={toNumber(platform?.iconSize, resolvedIconSize)}
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

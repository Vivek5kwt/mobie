import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const source = Array.isArray(rawPlatforms) ? rawPlatforms : Object.values(rawPlatforms || {});
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
  twitter: "#1DA1F2",
  instagram: "#C13584",
  youtube: "#FF0000",
  linkedin: "#0A66C2",
  pinterest: "#E60023",
  tiktok: "#000000",
};

const iconNameMap = {
  facebook: "facebook",
  twitter: "twitter",
  instagram: "instagram",
  youtube: "youtube",
  linkedin: "linkedin",
  pinterest: "pinterest",
  tiktok: "tiktok",
};

export default function SocialMediaIcons({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};

  const platforms = useMemo(() => normalizePlatforms(rawProps?.platforms || []), [rawProps?.platforms]);

  if (!platforms.length) return null;

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const pt = toNumber(rawProps?.pt, 8);
  const pr = toNumber(rawProps?.pr, 0);
  const pb = toNumber(rawProps?.pb, 8);
  const pl = toNumber(rawProps?.pl, 0);
  const align = (unwrapValue(rawProps?.align, "left") || "left").toLowerCase();

  const titleText = unwrapValue(rawProps?.titleText, "Connect with us");
  const titleColor = unwrapValue(rawProps?.titleColor, "#111111");
  const titleFontSize = toNumber(rawProps?.titleFontSize, 20);
  const titleFontFamily = unwrapValue(rawProps?.titleFontFamily, undefined);
  const titleFontWeight = toBoolean(rawProps?.titleBold, false)
    ? "700"
    : deriveWeight(rawProps?.titleFontWeight, "700");
  const titleFontStyle = toBoolean(rawProps?.titleItalic, false) ? "italic" : "normal";
  const titleDecoration = toBoolean(rawProps?.titleUnderline, false) ? "underline" : "none";

  const iconSize = toNumber(rawProps?.iconSize, 28);
  const iconColor = unwrapValue(rawProps?.iconColor, "#FFFFFF");
  const iconSpacing = toNumber(rawProps?.iconSpacing, 10);
  const iconBorderRadius = toNumber(rawProps?.iconBorderRadius, 6);
  const useBrand = toBoolean(rawProps?.useBrandColors, true);

  const containerStyle = convertStyles(layoutCss?.container || {});
  const titleStyle = convertStyles(layoutCss?.title || {});
  const iconsRowStyle = convertStyles(layoutCss?.iconsRow || {});
  const iconBoxStyle = convertStyles(layoutCss?.iconBox || {});
  const iconStyle = convertStyles(layoutCss?.icon || {});

  const alignment = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const openLink = async (url) => {
    if (!url) return;
    try {
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
      {titleText ? (
        <Text
          style={[
            styles.title,
            titleStyle,
            {
              color: titleColor,
              fontSize: titleFontSize,
              fontWeight: titleFontWeight,
              fontStyle: titleFontStyle,
              textDecorationLine: titleDecoration,
              fontFamily: titleFontFamily,
              textAlign: align,
            },
          ]}
        >
          {titleText}
        </Text>
      ) : null}

      <View
        style={[
          styles.iconsRow,
          iconsRowStyle,
          {
            justifyContent: alignment,
          },
        ]}
      >
        {platforms.map((platform, idx) => {
          const key = platform.id || platform.platform || `platform-${idx}`;
          const normalizedId = String(platform.platform || platform.id || "").toLowerCase();
          const brandColor = useBrand ? brandColors[normalizedId] : null;
          const resolvedIconName = iconNameMap[normalizedId] || normalizedId || "link";

          return (
            <TouchableOpacity
              key={key}
              activeOpacity={platform.url ? 0.7 : 1}
              onPress={() => openLink(platform.url)}
              disabled={!platform.url}
              style={{ marginRight: idx === platforms.length - 1 ? 0 : iconSpacing }}
            >
              <View
                style={[
                  styles.iconBox,
                  iconBoxStyle,
                  {
                    backgroundColor: brandColor || iconBoxStyle.backgroundColor || "#016D77",
                    borderRadius: iconBorderRadius,
                  },
                ]}
              >
                <Icon
                  name={resolvedIconName || "link"}
                  size={iconSize}
                  color={useBrand ? "#FFFFFF" : iconStyle.color || iconColor}
                  style={[iconStyle, { color: useBrand ? "#FFFFFF" : iconStyle.color || iconColor }]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
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

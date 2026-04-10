import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
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

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

const toFontWeight = (value, fallback = "700") => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved && resolved !== 0) return fallback;
  const w = String(resolved).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium" || w === "500") return "500";
  if (w === "regular" || w === "normal" || w === "400") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

// Strip "fa-", "fas-", etc. prefix from icon names
const normalizeIconName = (name) => {
  if (!name) return "check";
  return String(name).replace(/^fa[srldb]?[-_]?/, "").trim() || "check";
};

const buildRawProps = (rawProps = {}) => {
  const rawBlock = unwrapValue(rawProps.raw, {});
  if (rawBlock && typeof rawBlock === "object" && rawBlock.value !== undefined) {
    return rawBlock.value;
  }
  return rawBlock || {};
};

export default function ConfirmationHeader({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = buildRawProps(rawProps);

  // ── Props ──────────────────────────────────────────────────────────────────
  const bgColor = toString(raw?.bgColor, "#F3F3F3");
  const pt = toNumber(raw?.pt ?? raw?.paddingTop, 40);
  const pb = toNumber(raw?.pb ?? raw?.paddingBottom, 40);
  const pl = toNumber(raw?.pl ?? raw?.paddingLeft, 24);
  const pr = toNumber(raw?.pr ?? raw?.paddingRight, 24);

  const align = toString(raw?.align, "Center").toLowerCase();
  const textAlign = align === "left" ? "left" : align === "right" ? "right" : "center";
  const alignItems = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";

  // Icon
  const iconVisible = toBoolean(raw?.iconVisible, true);
  const iconName = normalizeIconName(toString(raw?.iconName, "check"));
  const iconSize = toNumber(raw?.iconSize, 24);
  const iconColor = toString(raw?.iconColor, "#FFFFFF");
  const iconBgColor = toString(raw?.iconBgColor, "#20D380");
  const shape = toString(raw?.shape, "circle").toLowerCase();
  const iconBgSize = iconSize * 2.2;
  const iconBgRadius = shape === "circle" ? iconBgSize / 2 : shape === "square" ? 8 : iconBgSize / 2;

  // Title
  const showTitle = toBoolean(raw?.showTitle, true);
  const titleText = toString(raw?.title ?? raw?.titleText, "Thank You For Your Order");
  const titleColor = toString(raw?.titleColor, "#000000");
  const titleSize = Math.min(toNumber(raw?.titleSize, 28), 32);
  const titleWeight = toFontWeight(raw?.titleFontWeight ?? raw?.titleWeight, "700");

  // Subtext
  const showSubtext = toBoolean(raw?.showSubtext, true);
  const subtextText = toString(raw?.subtext ?? raw?.subtextText, "");
  const subtextColor = toString(raw?.subtextColor, "#6B7280");
  const subtextSize = toNumber(raw?.subtextSize, 14);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: pt,
          paddingBottom: pb,
          paddingLeft: pl,
          paddingRight: pr,
          alignItems,
        },
      ]}
    >
      {/* Icon bubble */}
      {iconVisible && (
        <View
          style={[
            styles.iconBubble,
            {
              width: iconBgSize,
              height: iconBgSize,
              borderRadius: iconBgRadius,
              backgroundColor: iconBgColor,
              marginBottom: 20,
            },
          ]}
        >
          <FontAwesome name={iconName} size={iconSize} color={iconColor} />
        </View>
      )}

      {/* Title */}
      {showTitle && !!titleText && (
        <Text
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: titleSize,
              fontWeight: titleWeight,
              textAlign,
            },
          ]}
        >
          {titleText}
        </Text>
      )}

      {/* Subtext */}
      {showSubtext && !!subtextText && (
        <Text
          style={[
            styles.subtext,
            {
              color: subtextColor,
              fontSize: subtextSize,
              textAlign,
            },
          ]}
        >
          {subtextText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  iconBubble: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    lineHeight: 40,
    marginBottom: 8,
  },
  subtext: {
    lineHeight: 20,
    marginTop: 4,
  },
});

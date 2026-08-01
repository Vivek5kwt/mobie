import React, { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { resolveFont } from "../services/typographyService";
import { navigateToDslTarget } from "../utils/navigationTarget";

const CUSTOM_ICON_PREFIX = "custom-icon::";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const unwrapDeep = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map(unwrapDeep);
  if (!isObject(value)) return value;
  if (value.value !== undefined) return unwrapDeep(value.value);
  if (value.const !== undefined) return unwrapDeep(value.const);
  if (value.properties !== undefined) return unwrapDeep(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = unwrapDeep(next);
    return acc;
  }, {});
};

const getProps = (section = {}) => {
  const root =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const flat = unwrapDeep(root) || {};
  const raw = unwrapDeep(flat.raw) || {};
  return isObject(raw) ? { ...flat, ...raw } : flat;
};

const str = (value, fallback = "") => {
  const resolved = unwrapDeep(value);
  if (resolved === undefined || resolved === null) return fallback;
  const text = String(resolved);
  return text.trim() ? text : fallback;
};

const num = (value, fallback = 0) => {
  const resolved = unwrapDeep(value);
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const parsed = parseFloat(String(resolved ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = true) => {
  const resolved = unwrapDeep(value);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
};

const fontWeight = (value, fallback = "500") => {
  const resolved = unwrapDeep(value);
  if (typeof resolved === "number") return String(resolved);
  const lowered = String(resolved || "").trim().toLowerCase();
  if (/^\d+$/.test(lowered)) return lowered;
  if (lowered === "bold") return "700";
  if (lowered === "semibold" || lowered === "semi bold") return "600";
  if (lowered === "medium") return "500";
  if (lowered === "regular" || lowered === "normal") return "400";
  return fallback;
};

const normalizeIconName = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^fa[srldb]?[-_]?/i, "")
    .replace(/^fa-/, "");

const getCustomIconUrlFromValue = (value) => {
  const raw = String(value || "");
  if (!raw.startsWith(CUSTOM_ICON_PREFIX)) return null;
  const encoded = raw.slice(CUSTOM_ICON_PREFIX.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

const alignToFlex = (value, fallback = "center") => {
  const normalized = String(value || fallback).trim().toLowerCase();
  if (["left", "start", "flex-start"].includes(normalized)) return "flex-start";
  if (["right", "end", "flex-end"].includes(normalized)) return "flex-end";
  return "center";
};

// Mirrors Builder's blocks/CustomButton/Preview.tsx getBorderStyles().
const buildBorderStyle = (line, color) => {
  const normalized = String(line || "none").toLowerCase();
  if (!normalized || normalized === "none") return { borderWidth: 0 };
  if (normalized === "all") return { borderWidth: 1, borderColor: color };
  return {
    borderTopWidth: normalized === "top" ? 1 : 0,
    borderBottomWidth: normalized === "bottom" ? 1 : 0,
    borderLeftWidth: normalized === "left" ? 1 : 0,
    borderRightWidth: normalized === "right" ? 1 : 0,
    borderColor: color,
  };
};

export default function CustomButton({ section }) {
  const navigation = useNavigation();
  const raw = useMemo(() => getProps(section), [section]);
  const visibility = isObject(raw.visibility) ? raw.visibility : {};
  const secured = isObject(raw.secured) ? raw.secured : {};

  // Builder's Inspector (blocks/CustomButton/Inspector.tsx) writes 4
  // independent "hide from canvas" toggles under `visibility`; PreviewLive
  // gates the text block, icon block, and the inner/outer background+padding
  // blocks on these — none of that was previously read here.
  const showText = bool(visibility.customText, true);
  const showIconPanel = bool(visibility.icon, true);
  const showInnerBgPadding = bool(visibility.bgPadding, true);
  const showOuterBgPadding = bool(visibility.bgPadding2, true);

  const label = str(raw.title ?? raw.label ?? raw.buttonText ?? raw.text, "Custom Button");

  // Icon fields live under `secured.*` in Builder's DSL, not top-level.
  const iconName = normalizeIconName(
    str(secured.icon ?? raw.icon ?? raw.iconName ?? raw.buttonIcon, "shield-halved")
  );
  const iconColor = str(secured.color ?? raw.iconColor, "#FFFFFF");
  const iconSize = num(secured.size ?? raw.iconSize, 14);
  const customIconUrl = getCustomIconUrlFromValue(secured.icon ?? raw.icon);
  const showIcon = showIconPanel && !!(iconName || customIconUrl);
  const iconOnRight = str(raw.iconAlign, "Left").toLowerCase() === "right";

  const pageObjectRef = str(
    raw.customPage?.handle ??
      raw.customPage?.slug ??
      raw.customPage?.pageName ??
      raw.customPage?.id ??
      raw.selectedPage?.handle ??
      raw.selectedPage?.slug ??
      raw.selectedPage?.pageName ??
      raw.selectedPage?.id ??
      raw.action?.page?.handle ??
      raw.action?.page?.slug ??
      raw.action?.page?.id ??
      raw.action?.target?.handle ??
      raw.action?.target?.slug ??
      raw.action?.target?.id,
    ""
  );

  const navigateType = str(raw.navigateType ?? raw.destinationType ?? raw.buttonNavigateType ?? raw.linkType, "");
  const navigateRef = str(
    raw.navigateRef ||
      raw.linkTo ||
      raw.destination ||
      raw.destinationRef ||
      raw.pageId ||
      raw.page_id ||
      raw.customPageId ||
      raw.custom_page_id ||
      pageObjectRef ||
      raw.buttonNavigateRef ||
      raw.selectScreen ||
      raw.screen ||
      raw.pageName ||
      raw.href ||
      raw.url ||
      raw.link,
    ""
  );

  // Outer container — backgroundColor2 / borderLine2 / borderColor2 /
  // borderRadius2 / padding*2, gated by visibility.bgPadding2.
  const outerBg = showOuterBgPadding ? str(raw.backgroundColor2, "transparent") : "transparent";
  const outerBorderColor = str(raw.borderColor2, "#000000");
  const outerBorderRadius = showOuterBgPadding ? num(raw.borderRadius2, 6) : 0;
  const outerBorderStyle = showOuterBgPadding
    ? buildBorderStyle(raw.borderLine2, outerBorderColor)
    : { borderWidth: 0 };
  const containerPadding = showOuterBgPadding
    ? {
        paddingTop: num(raw.paddingTop2, 10),
        paddingRight: num(raw.paddingRight2, 16),
        paddingBottom: num(raw.paddingBottom2, 10),
        paddingLeft: num(raw.paddingLeft2, 16),
      }
    : { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 };

  // Inner button — backgroundColor / borderLine / borderColor / borderRadius
  // / padding (4 independent sides), gated by visibility.bgPadding.
  const innerBg = showInnerBgPadding ? str(raw.backgroundColor, "transparent") : "transparent";
  const innerBorderColor = str(raw.borderColor, "#000000");
  const innerBorderRadius = showInnerBgPadding ? num(raw.borderRadius, 0) : 0;
  const innerBorderStyle = showInnerBgPadding
    ? buildBorderStyle(raw.borderLine, innerBorderColor)
    : { borderWidth: 0 };
  const buttonPadding = showInnerBgPadding
    ? {
        paddingLeft: num(raw.paddingLeft, 60),
        paddingRight: num(raw.paddingRight, 60),
        paddingTop: num(raw.paddingTop, 10),
        paddingBottom: num(raw.paddingBottom, 10),
      }
    : { paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 };

  const buttonWidth = num(raw.buttonWidth ?? raw.width, undefined);
  const buttonAlign = alignToFlex(raw.align ?? raw.buttonAlign ?? raw.textAlign);

  const buttonStyle = {
    backgroundColor: innerBg,
    borderRadius: innerBorderRadius,
    ...innerBorderStyle,
    ...buttonPadding,
    ...(buttonWidth ? { width: buttonWidth } : { alignSelf: buttonAlign }),
  };

  const fontFamily = resolveFont(str(raw.headerFontFamily, ""));
  const textDecorationLine = [
    bool(raw.headerUnderline, false) ? "underline" : "",
    bool(raw.headerStrikethrough, false) ? "line-through" : "",
  ].filter(Boolean).join(" ") || "none";
  const headerFontSize = num(raw.headerFontSize, 14);
  const textStyle = {
    color: str(raw.headerColor ?? raw.buttonTextColor ?? raw.textColor, "#FFFFFF"),
    fontSize: headerFontSize,
    fontWeight: bool(raw.headerBold, false) ? "700" : fontWeight(raw.headerFontWeight, "500"),
    fontStyle: bool(raw.headerItalic, false) ? "italic" : "normal",
    textTransform: bool(raw.autoUppercase, false) ? "uppercase" : "none",
    textDecorationLine,
    lineHeight: num(raw.headerLineHeight, 1.2) * headerFontSize,
    letterSpacing: num(raw.headerLetterSpacing, 0),
    ...(fontFamily ? { fontFamily } : {}),
  };

  const handlePress = () => {
    if (!navigateRef && !navigateType) return;
    void navigateToDslTarget(navigation, {
      target: navigateRef,
      navigateRef,
      navigateType,
      label,
      fallbackTitle: label,
    });
  };

  if (!showText && !showIcon) return null;

  return (
    <View
      style={[
        styles.container,
        containerPadding,
        {
          alignItems: buttonAlign,
          backgroundColor: outerBg,
          borderRadius: outerBorderRadius,
        },
        outerBorderStyle,
      ]}
    >
      <TouchableOpacity activeOpacity={0.82} style={[styles.button, buttonStyle]} onPress={handlePress}>
        <View style={[styles.content, { gap: 6, flexDirection: iconOnRight ? "row-reverse" : "row" }]}>
          {showIcon ? (
            customIconUrl ? (
              <Image
                source={{ uri: customIconUrl }}
                style={{ width: iconSize, height: iconSize, resizeMode: "contain" }}
              />
            ) : (
              <Icon name={iconName} size={iconSize} color={iconColor} />
            )
          ) : null}
          {showText && !!label ? (
            <Text allowFontScaling={false} style={[styles.label, textStyle]}>
              {label}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "transparent",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    textAlign: "center",
  },
});

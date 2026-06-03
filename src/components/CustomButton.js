import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { resolveFont } from "../services/typographyService";
import { navigateToDslTarget } from "../utils/navigationTarget";

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

const fontWeight = (value, fallback = "600") => {
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

export default function CustomButton({ section }) {
  const navigation = useNavigation();
  const raw = useMemo(() => getProps(section), [section]);
  const visibility = raw.visibility || {};

  const label = str(raw.title ?? raw.label ?? raw.buttonText ?? raw.text, "Button");
  const iconName = normalizeIconName(str(raw.icon ?? raw.iconName ?? raw.buttonIcon, ""));
  const showIcon = bool(visibility.icon ?? raw.showIcon, Boolean(iconName));
  const gap = num(raw.gap, 6);
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

  const navigateType = str(raw.destinationType ?? raw.navigateType ?? raw.buttonNavigateType ?? raw.linkType, "");
  const navigateRef = str(
    raw.destination ||
      raw.destinationRef ||
      raw.pageId ||
      raw.page_id ||
      raw.customPageId ||
      raw.custom_page_id ||
      pageObjectRef ||
      raw.navigateRef ||
      raw.buttonNavigateRef ||
      raw.selectScreen ||
      raw.screen ||
      raw.pageName ||
      raw.linkTo ||
      raw.href ||
      raw.url ||
      raw.link,
    ""
  );

  const containerPadding = {
    paddingTop: num(raw.paddingTop ?? raw.pt, 0),
    paddingRight: num(raw.paddingRight ?? raw.pr, 16),
    paddingBottom: num(raw.paddingBottom ?? raw.pb, 0),
    paddingLeft: num(raw.paddingLeft ?? raw.pl, 16),
  };

  const buttonPadding = {
    paddingVertical: num(raw.paddingY, 10),
    paddingHorizontal: num(raw.paddingX, 16),
  };

  const borderLine = str(raw.borderLine ?? raw.borderLine2, "").toLowerCase();
  const borderWidth = borderLine && borderLine !== "none" ? num(raw.borderWidth, 1) : 0;
  const buttonStyle = {
    backgroundColor: str(
      raw.buttonBgColor ?? raw.buttonBackgroundColor ?? raw.bgColor ?? raw.backgroundColor,
      "#111111"
    ),
    borderRadius: num(raw.borderRadius ?? raw.buttonRadius, 0),
    borderWidth,
    borderColor: str(raw.borderColor, "transparent"),
    ...buttonPadding,
  };

  const fontFamily = resolveFont(str(raw.headerFontFamily ?? raw.fontFamily, ""));
  const textStyle = {
    color: str(raw.headerColor ?? raw.buttonTextColor ?? raw.textColor, "#FFFFFF"),
    fontSize: num(raw.headerFontSize ?? raw.fontSize, 14),
    fontWeight: fontWeight(raw.headerFontWeight ?? raw.fontWeight, "600"),
    ...(fontFamily ? { fontFamily } : {}),
    letterSpacing: num(raw.headerLetterSpacing, 0),
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

  if (!label) return null;

  return (
    <View style={[styles.container, containerPadding]}>
      <TouchableOpacity activeOpacity={0.82} style={[styles.button, buttonStyle]} onPress={handlePress}>
        <View style={[styles.content, { gap }]}>
          {showIcon && iconName ? (
            <Icon name={iconName} size={num(raw.iconSize, 16)} color={str(raw.iconColor, textStyle.color)} />
          ) : null}
          <Text allowFontScaling={false} style={[styles.label, textStyle]}>
            {label}
          </Text>
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

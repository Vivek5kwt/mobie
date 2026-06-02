import React, { useMemo } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";
import { resolveFont } from "../services/typographyService";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => deepUnwrap(item));
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = deepUnwrap(next);
    return acc;
  }, {});
};

const str = (value, fallback = "") => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null) return fallback;
  const text = String(resolved).trim();
  return text ? text : fallback;
};

const num = (value, fallback = 0) => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const parsed = Number.parseFloat(String(resolved).replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = true) => {
  const resolved = deepUnwrap(value);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const normalized = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

const weight = (value, fallback = "400") => {
  const raw = str(value, fallback).toLowerCase();
  if (/^\d+$/.test(raw)) return raw;
  if (raw === "bold") return "700";
  if (raw === "semibold" || raw === "semi bold") return "600";
  if (raw === "medium") return "500";
  if (raw === "regular" || raw === "normal") return "400";
  return fallback;
};

const omitStyleKeys = (style = {}, keys = []) => {
  const next = { ...style };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
};

const parseIconName = (iconClass) => {
  const tokens = String(iconClass || "").split(/\s+/).filter(Boolean);
  const skip = new Set(["fa-solid", "fa-regular", "fa-light", "fa-thin", "fa-brands"]);
  const token =
    tokens.find((item) => item.startsWith("fa-") && !skip.has(item)) ||
    tokens.find((item) => item.startsWith("fa-")) ||
    iconClass;
  return resolveFA4IconName(String(token || "").replace(/^fa-/, "")) || "sign-out";
};

const getProps = (section) => {
  const propsRoot =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const normalized = deepUnwrap(propsRoot) || {};
  const raw = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : {};
  return { normalized, raw: { ...normalized, ...raw } };
};

const borderStyle = (line, color) => {
  const side = str(line, "").toLowerCase();
  if (!side || side === "none") return {};
  const borderColor = color || "#D9D9D9";
  if (side === "all" || side === "full") return { borderWidth: 1, borderColor };
  if (side === "top") return { borderTopWidth: 1, borderColor };
  if (side === "right") return { borderRightWidth: 1, borderColor };
  if (side === "bottom") return { borderBottomWidth: 1, borderColor };
  if (side === "left") return { borderLeftWidth: 1, borderColor };
  return {};
};

export default function Logout({ section }) {
  const navigation = useNavigation();
  const { logout, initializing } = useAuth();
  const { normalized, raw } = useMemo(() => getProps(section), [section]);
  const css = normalized?.presentation?.css || {};
  const visibility = { ...(css?.visibility || {}), ...(raw?.visibility || {}) };

  const containerCss = omitStyleKeys(convertStyles(css?.container || {}), ["cursor", "boxSizing"]);
  const rowCss = omitStyleKeys(convertStyles(css?.logoutRow || css?.row || {}), ["cursor", "boxSizing"]);
  const textCss = omitStyleKeys(convertStyles(css?.logoutText || css?.text || {}), ["display"]);

  const showIcon = bool(visibility?.icons, true);
  const showText = bool(visibility?.logoutText ?? visibility?.text, true);
  if (!showIcon && !showText) return null;

  const label = str(raw?.text ?? raw?.label ?? raw?.buttonText, "Logout");
  const iconAlign = str(raw?.iconAlign, "Right").toLowerCase();
  const iconName = parseIconName(raw?.iconName ?? raw?.icon ?? "fa-sign-out");
  const iconColor = str(raw?.iconColor, "#111111");
  const iconSize = num(raw?.iconSize, 18);
  const textFontFamily = resolveFont(str(raw?.textFontFamily ?? raw?.fontFamily, "")) || textCss.fontFamily;
  const textStyle = {
    color: str(raw?.textColor, textCss.color || "#444444"),
    fontSize: num(raw?.textFontSize ?? raw?.fontSize, textCss.fontSize || 16),
    fontWeight: bool(raw?.textBold, false)
      ? "700"
      : weight(raw?.textFontWeight ?? raw?.fontWeight, textCss.fontWeight || "400"),
    fontStyle: bool(raw?.textItalic, false) ? "italic" : (textCss.fontStyle || "normal"),
    textTransform: bool(raw?.textUppercase, false) ? "uppercase" : "none",
    textDecorationLine: resolveTextDecorationLine({
      underline: bool(raw?.textUnderline, false),
      strikethrough: bool(raw?.textStrikethrough, false),
    }),
    ...(textFontFamily ? { fontFamily: textFontFamily } : {}),
  };

  const handleLogoutPress = () => {
    if (initializing) return;
    const popupTitle = str(raw?.popupTitle ?? raw?.confirmTitle, label);
    const popupMessage = str(raw?.popupMessage ?? raw?.confirmMessage, "");
    const cancelButtonText = str(raw?.cancelButtonText ?? raw?.cancelText, "Cancel");
    const logoutButtonText = str(raw?.logoutButtonText ?? raw?.confirmButtonText, label);

    Alert.alert(
      popupTitle,
      popupMessage,
      [
        { text: cancelButtonText, style: "cancel" },
        {
          text: logoutButtonText,
          style: "destructive",
          onPress: async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: "Auth", params: { initialMode: "login" } }] });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const iconNode = showIcon ? (
    <FontAwesome
      name={iconName}
      size={iconSize}
      color={iconColor}
      style={[
        styles.icon,
        showText ? (iconAlign === "right" ? styles.iconRight : styles.iconLeft) : null,
      ]}
    />
  ) : null;

  return (
    <View style={[styles.container, containerCss, { backgroundColor: str(raw?.bgColor, containerCss.backgroundColor || "#FFFFFF") }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={handleLogoutPress}
        style={[
          styles.row,
          rowCss,
          borderStyle(raw?.borderLine, str(raw?.borderColor, "")),
          {
            paddingTop: num(raw?.pt, rowCss.paddingTop ?? 12),
            paddingRight: num(raw?.pr, rowCss.paddingRight ?? 16),
            paddingBottom: num(raw?.pb, rowCss.paddingBottom ?? 12),
            paddingLeft: num(raw?.pl, rowCss.paddingLeft ?? 16),
            backgroundColor: str(raw?.bgColor, rowCss.backgroundColor || "#FFFFFF"),
            borderRadius: num(raw?.borderCorners ?? raw?.borderRadius, rowCss.borderRadius || 0),
          },
        ]}
      >
        {iconAlign !== "right" && iconNode}
        {showText && (
          <Text numberOfLines={1} style={[styles.text, textCss, textStyle]}>
            {label}
          </Text>
        )}
        {iconAlign === "right" && iconNode}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  icon: {
    flexShrink: 0,
  },
  iconLeft: {
    marginRight: 12,
  },
  iconRight: {
    marginLeft: 12,
  },
});

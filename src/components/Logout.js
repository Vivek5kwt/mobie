import React, { useMemo, useState } from "react";
import {
  Modal,
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
import { resolveDslNavigationTarget } from "../utils/navigationTarget";

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

// Builds a font/text style object for one of the confirmation drawer's text
// roles (drawer message, cancel button, logout button) from its "<prefix>*"
// props — mirrors builder/src/blocks/Logout/Preview.tsx's own per-role style
// blocks exactly, so the drawer looks the same on both sides.
const textRoleStyle = (raw, prefix, defaults) => {
  const fontFamily = resolveFont(str(raw?.[`${prefix}FontFamily`], "")) || undefined;
  return {
    fontSize: num(raw?.[`${prefix}FontSize`], defaults.fontSize),
    color: str(raw?.[`${prefix}Color`], defaults.color),
    fontWeight: bool(raw?.[`${prefix}Bold`], false)
      ? "700"
      : weight(raw?.[`${prefix}FontWeight`], defaults.fontWeight),
    fontStyle: bool(raw?.[`${prefix}Italic`], false) ? "italic" : "normal",
    textTransform: bool(raw?.[`${prefix}Uppercase`], false) ? "uppercase" : "none",
    textDecorationLine: resolveTextDecorationLine({
      underline: bool(raw?.[`${prefix}Underline`], false),
      strikethrough: bool(raw?.[`${prefix}Strikethrough`], false),
    }),
    ...(fontFamily ? { fontFamily } : {}),
  };
};

export default function Logout({ section }) {
  const navigation = useNavigation();
  const { logout, initializing } = useAuth();
  const { normalized, raw } = useMemo(() => getProps(section), [section]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const css = normalized?.presentation?.css || {};
  const visibility = { ...(css?.visibility || {}), ...(raw?.visibility || {}) };

  const containerCss = omitStyleKeys(convertStyles(css?.container || {}), ["cursor", "boxSizing"]);
  const rowCss = omitStyleKeys(convertStyles(css?.logoutRow || css?.row || {}), ["cursor", "boxSizing"]);
  const textCss = omitStyleKeys(convertStyles(css?.logoutText || css?.text || {}), ["display"]);

  const showIcon = bool(visibility?.icons, true);
  const showText = bool(visibility?.logoutText ?? visibility?.text, true);

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

  // ── Confirmation drawer (bottom sheet) ──────────────────────────────────
  // Used to be a plain native Alert.alert(), which can't be styled at all —
  // the merchant's drawer text/cancel/logout-button design settings (color,
  // font, background, border, padding) had no way to show up here. Now reads
  // the exact same "<role>*" props the builder's own drawer preview does.
  const drawerTextVisible = bool(visibility?.drawerText, true);
  const textDrawer = str(raw?.textDrawer, "Are you sure you want to logout?");
  const textDrawerStyle = textRoleStyle(raw, "textDrawer", {
    fontSize: 16,
    color: "#666666",
    fontWeight: "400",
  });

  const cancelVisible = bool(visibility?.cancelText, true);
  const textCancel = str(raw?.textCancel, "Cancel");
  const textCancelStyle = textRoleStyle(raw, "textCancel", {
    fontSize: 16,
    color: "#111111",
    fontWeight: "400",
  });
  const cancelPaddingVisible = bool(visibility?.bgCancelPadding, true);
  const cancelButtonStyle = {
    backgroundColor: cancelPaddingVisible ? str(raw?.bgCancelColor, "#FFFFFF") : "transparent",
    borderRadius: cancelPaddingVisible ? num(raw?.borderCancelCorners, 12) : 0,
    paddingTop: cancelPaddingVisible ? num(raw?.ptCancel, 10) : 0,
    paddingBottom: cancelPaddingVisible ? num(raw?.pbCancel, 10) : 0,
    paddingLeft: cancelPaddingVisible ? num(raw?.plCancel, 16) : 0,
    paddingRight: cancelPaddingVisible ? num(raw?.prCancel, 16) : 0,
    ...(cancelPaddingVisible
      ? borderStyle(raw?.borderCancelLine ?? "all", str(raw?.borderCancelColor, "#D1D5DB"))
      : {}),
  };

  const logoutBtnVisible = bool(visibility?.logoutButtonText, true);
  const textLogoutButton = str(raw?.textLogoutButton, label || "Logout");
  const textLogoutButtonStyle = textRoleStyle(raw, "textLogoutButton", {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  });
  const logoutBtnPaddingVisible = bool(visibility?.bgLogoutButtonPadding, true);
  const logoutButtonStyle = {
    backgroundColor: logoutBtnPaddingVisible ? str(raw?.bgLogoutButtonColor, "#DC2626") : "transparent",
    borderRadius: logoutBtnPaddingVisible ? num(raw?.borderLogoutButtonCorners, 12) : 0,
    paddingTop: logoutBtnPaddingVisible ? num(raw?.ptLogoutButton, 10) : 0,
    paddingBottom: logoutBtnPaddingVisible ? num(raw?.pbLogoutButton, 10) : 0,
    paddingLeft: logoutBtnPaddingVisible ? num(raw?.plLogoutButton, 16) : 0,
    paddingRight: logoutBtnPaddingVisible ? num(raw?.prLogoutButton, 16) : 0,
    ...(logoutBtnPaddingVisible
      ? borderStyle(raw?.borderLogoutButtonLine ?? "none", str(raw?.borderLogoutButtonColor, "#DC2626"))
      : {}),
  };

  const contPaddingVisible = bool(visibility?.bgPaddingCont, true);
  const drawerCardStyle = {
    backgroundColor: contPaddingVisible ? str(raw?.bgContColor, "#FFFFFF") : "transparent",
    borderRadius: contPaddingVisible ? num(raw?.borderContCorners, 20) : 0,
    paddingTop: contPaddingVisible ? num(raw?.ptCont, 20) : 0,
    paddingBottom: contPaddingVisible ? num(raw?.pbCont, 20) : 0,
    paddingLeft: contPaddingVisible ? num(raw?.plCont, 20) : 0,
    paddingRight: contPaddingVisible ? num(raw?.prCont, 20) : 0,
    ...(contPaddingVisible ? borderStyle(raw?.borderContLine, str(raw?.borderContColor, "")) : {}),
  };

  if (!showIcon && !showText) return null;

  // Inspector's "Redirect" panel (NavigateToField) writes navigateType/
  // navigateRef/linkTo, but this was never read here — logout always reset
  // to the Sign In screen regardless of what the merchant configured.
  const performPostLogoutRedirect = () => {
    const resolved = resolveDslNavigationTarget({
      navigateType: raw?.navigateType,
      navigateRef: raw?.navigateRef,
      linkTo: raw?.linkTo,
      target: raw?.navigateRef || raw?.linkTo,
      fallbackTitle: "Home",
    });

    if (resolved?.type === "external" && resolved.url) {
      navigation.navigate("CheckoutWebView", { url: resolved.url, title: resolved.title || "Page" });
      return;
    }

    if (resolved?.type === "stack" && resolved.name) {
      navigation.reset({ index: 0, routes: [{ name: resolved.name, params: resolved.params }] });
      return;
    }

    // No redirect configured (or an unsupported/"back" result) — keep the
    // original default of landing on Sign In after logging out.
    navigation.reset({ index: 0, routes: [{ name: "Auth", params: { initialMode: "login" } }] });
  };

  const handleLogoutPress = () => {
    if (initializing) return;
    setConfirmVisible(true);
  };

  const handleCancel = () => setConfirmVisible(false);

  const handleConfirmLogout = async () => {
    setConfirmVisible(false);
    await logout();
    performPostLogoutRedirect();
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

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleCancel} />
          <View style={[styles.card, drawerCardStyle]}>
            {drawerTextVisible && (
              <Text style={[styles.drawerText, textDrawerStyle]}>{textDrawer}</Text>
            )}
            <View style={styles.buttonRow}>
              {cancelVisible && (
                <TouchableOpacity activeOpacity={0.8} onPress={handleCancel} style={cancelButtonStyle}>
                  <Text style={textCancelStyle}>{textCancel}</Text>
                </TouchableOpacity>
              )}
              {logoutBtnVisible && (
                <TouchableOpacity activeOpacity={0.8} onPress={handleConfirmLogout} style={logoutButtonStyle}>
                  <Text style={textLogoutButtonStyle}>{textLogoutButton}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  modalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  // Full device width — same as the builder's own inline drawer, not a
  // narrow floating dialog card.
  card: {
    width: "100%",
  },
  drawerText: {
    textAlign: "center",
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
});

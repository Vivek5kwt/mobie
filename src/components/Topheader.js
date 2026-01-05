// components/Header.js
import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSideMenu } from "../services/SideMenuContext";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
};

const resolveBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof resolved === "number") return resolved !== 0;
  return fallback;
};

const normalizeIconName = (name, fallback = "bars") => {
  if (!name) return fallback;
  const cleaned = String(name).replace(/^fa[srldb]?[-_]?/, "");
  return cleaned || fallback;
};

export default function Header({ section }) {
  const { toggleSideMenu, hasSideNav } = useSideMenu();

  const props = section?.props || section?.properties?.props?.properties || {};
  const layout = props?.layout?.properties?.css || props?.layout?.css || {};

  // -----------------------------------------

  const sideMenuProps = props?.sideMenu?.properties || props?.sideMenu || {};
  const sideMenuVisible = resolveBoolean(sideMenuProps?.visible, true);
  const sideMenuIconName = normalizeIconName(
    unwrapValue(sideMenuProps?.iconId ?? sideMenuProps?.iconName ?? sideMenuProps?.icon, "")
  );
  const sideMenuIconSize = unwrapValue(sideMenuProps?.width, 24);
  const sideMenuIconColor = unwrapValue(sideMenuProps?.color, "#111827");

  const logoEnabled = resolveBoolean(props?.enableLogo, true);
  const logoImage = unwrapValue(props?.logoImage, "");

  const cartProps = props?.cart?.properties || props?.cart || {};
  const cartVisible = resolveBoolean(cartProps?.visible, true);
  const cartIconName = normalizeIconName(unwrapValue(cartProps?.iconId, "cart-shopping"));
  const cartIconSize = unwrapValue(cartProps?.width, 18);
  const cartIconColor = unwrapValue(cartProps?.color, "#016D77");
  const cartShowBadge = resolveBoolean(cartProps?.showBadge, false);

  const notificationProps = props?.notification?.properties || props?.notification || {};
  const notificationVisible = resolveBoolean(notificationProps?.visible, true);
  const notificationIconName = normalizeIconName(
    unwrapValue(notificationProps?.iconId, "bell"),
  );
  const notificationIconSize = unwrapValue(notificationProps?.width, 18);
  const notificationIconColor = unwrapValue(notificationProps?.color, "#016D77");
  const notificationShowBadge = resolveBoolean(notificationProps?.showBadge, false);

  const badgeStyle = layout.badge || {};

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: props.style?.properties?.backgroundColor?.value,
          minHeight: props.style?.properties?.minHeight?.value,
          padding: convertPadding(props.style?.properties?.padding?.value),
          borderColor: props.style?.properties?.borderColor?.value,
          borderWidth: 1,
          flexDirection: "row",
          justifyContent: layout.container?.justifyContent || "space-between",
          alignItems: layout.container?.alignItems || "center",
        }
      ]}
    >
      {/* LEFT ICON */}
      <View style={[styles.leftSlot, layout.leftSlot]}>
        {sideMenuVisible && hasSideNav && (
          <TouchableOpacity onPress={toggleSideMenu} activeOpacity={0.7}>
            <Icon
              name={sideMenuIconName}
              size={sideMenuIconSize}
              color={sideMenuIconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* LOGO */}
      <View style={[styles.logoSlot, layout.logoSlot]}>
        {logoEnabled && logoImage ? (
          <Image
            source={{ uri: logoImage }}
            style={[styles.logoImage, layout.logoImage]}
            resizeMode="contain"
          />
        ) : null}
      </View>

      {/* RIGHT ICONS */}
      <View style={[styles.rightSlot, layout.rightSlot]}>
        {cartVisible && (
          <View style={styles.iconWrapper}>
            <Icon
              name={cartIconName}
              size={cartIconSize}
              color={cartIconColor}
            />
            {cartShowBadge && <View style={[styles.badge, badgeStyle]} />}
          </View>
        )}
        {notificationVisible && (
          <View style={styles.iconWrapper}>
            <Icon
              name={notificationIconName}
              size={notificationIconSize}
              color={notificationIconColor}
            />
            {notificationShowBadge && <View style={[styles.badge, badgeStyle]} />}
          </View>
        )}
      </View>
    </View>
  );
}

// Convert padding "14px 16px" → 14
function convertPadding(str) {
  if (!str) return 0;
  const parts = str.replace("px", "").split(" ");
  return parseInt(parts[0]);
}

const styles = StyleSheet.create({
  container: {},
  leftSlot: { flexDirection: "row", alignItems: "center" },
  logoSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoImage: { height: 26, width: "auto" },
  rightSlot: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrapper: { position: "relative" },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },
});

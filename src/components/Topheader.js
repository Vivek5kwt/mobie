// components/Header.js
import React from "react";
import { View, Image, StyleSheet, TouchableOpacity } from "react-native";
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

const isEnabled = (value) => resolveBoolean(value, false);
const DEFAULT_LOGO = require("../assets/logo/mobidraglogo.png");

export default function Header({ section }) {
  const { toggleSideMenu, hasSideNav } = useSideMenu();

  const props = section?.properties?.props?.properties || {};
  const layout = props?.layout?.properties?.css || {};

  // Extract logo URL directly from JSON (no fallback)
  const rawLogo = props?.logoImage?.value ?? props?.logoImage?.const ?? props?.logoImage;
  const logoUrl = typeof rawLogo === "string" ? rawLogo.trim() : "";
  const logoSource =
  logoUrl && logoUrl !== '/images/mobidrag.png'
    ? { uri: logoUrl }
    : DEFAULT_LOGO;


  // -----------------------------------------

  const sideMenuProps = props?.sideMenu?.properties || props?.sideMenu || {};
  const sideMenuVisible = resolveBoolean(sideMenuProps?.visible, true);
  const sideMenuIconName = normalizeIconName(
    unwrapValue(sideMenuProps?.iconId ?? sideMenuProps?.iconName ?? sideMenuProps?.icon, "")
  );
  const sideMenuIconSize = unwrapValue(sideMenuProps?.width, 24);
  const sideMenuIconColor = unwrapValue(sideMenuProps?.color, "#111827");

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
        {isEnabled(props.enableLogo?.value) && (
          <View style={[styles.logoSlot, layout.logoSlot]}>
            <Image
              source={logoSource}
              style={{
                width: layout.logoImage?.width === "auto" ? 80 : layout.logoImage?.width,
                height: layout.logoImage?.height || 26,
                resizeMode: "contain",
              }}
            />
          </View>
        )}

      {/* RIGHT ICONS */}
      <View style={[styles.rightSlot, layout.rightSlot]}>

        {/* Cart */}
        {isEnabled(props.cart?.properties?.visible?.value) && (
          <View style={{ position: "relative" }}>
            <Icon
              name={props.cart.properties.iconId.value}
              size={props.cart.properties.width.value}
              color={props.cart.properties.color.value}
            />

            {isEnabled(props.cart.properties.showBadge?.value) && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: layout.badge.backgroundColor,
                    width: layout.badge.width,
                    height: layout.badge.height,
                    top: layout.badge.top,
                    right: layout.badge.right,
                  }
                ]}
              />
            )}
          </View>
        )}

        {/* Notification */}
        {isEnabled(props.notification?.properties?.visible?.value) && (
           <View style={{ position: "relative" }}>
           <Icon
             name={props.notification.properties.iconId.value}
             size={props.notification.properties.width.value}
             color={props.notification.properties.color.value}
           />

           {isEnabled(props.notification.properties.showBadge?.value) && (
             <View
               style={[
                 styles.badge,
                 {
                   backgroundColor: layout.badge.backgroundColor,
                   width: layout.badge.width,
                   height: layout.badge.height,
                   top: layout.badge.top,
                   right: layout.badge.right,
                 }
               ]}
             />
           )}
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
  logoSlot: { flex: 1, alignItems: "center" },
  rightSlot: { flexDirection: "row", alignItems: "center", gap: 14 },
  badge: { position: "absolute", borderRadius: 20 },
});

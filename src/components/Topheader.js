// components/Header.js
import React from "react";
import { View, Image, StyleSheet, useWindowDimensions } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";

export default function Header({ section }) {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 360;
  const isTablet = width >= 768;

  const props = section?.properties?.props?.properties || {};
  const layout = props?.layout?.properties?.css || {};

  const resolvedPadding = convertPadding(props.style?.properties?.padding?.value);
  const basePadding = isTablet ? 20 : isSmallScreen ? 10 : 14;
  const horizontalPadding = resolvedPadding || basePadding;

  const logoWidth = layout.logoImage?.width === "auto"
    ? isSmallScreen
      ? 64
      : 80
    : layout.logoImage?.width;

  const logoHeight = layout.logoImage?.height || (isSmallScreen ? 22 : 26);

  const iconSize = (size) => {
    const numericSize = typeof size === "number" ? size : parseInt(size, 10);
    if (Number.isNaN(numericSize)) return isSmallScreen ? 18 : 22;
    if (isTablet) return numericSize + 2;
    if (isSmallScreen) return Math.max(18, numericSize - 2);
    return numericSize;
  };

  // -----------------------------------------
  // 1️⃣ Extract Logo URL properly (IMPORTANT)
  // -----------------------------------------

  let logoUrl = props?.logoImage?.value || "";

  // If backend gives relative path → convert to absolute
  if (logoUrl?.startsWith("/")) {
    logoUrl = "https://your-live-domain.com" + logoUrl;
  }

  // -----------------------------------------

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: props.style?.properties?.backgroundColor?.value,
          minHeight: props.style?.properties?.minHeight?.value,
          paddingHorizontal: horizontalPadding,
          paddingVertical: isSmallScreen ? basePadding / 1.5 : basePadding,
          borderColor: props.style?.properties?.borderColor?.value,
          borderWidth: 1,
          flexDirection: "row",
          justifyContent: layout.container?.justifyContent || "space-between",
          alignItems: layout.container?.alignItems || "center",
          gap: isSmallScreen ? 8 : 12,
        }
      ]}
    >

      {/* LEFT ICON */}
      <View style={[styles.leftSlot, layout.leftSlot]}>
        {props.sideMenu?.properties?.visible?.value && (
          <Icon
            name={props.sideMenu.properties.iconId.value}
            size={iconSize(props.sideMenu.properties.width.value)}
            color={props.sideMenu.properties.color.value}
          />
        )}
      </View>

      {/* LOGO */}
      {props.enableLogo?.value && (
        <View style={[styles.logoSlot, layout.logoSlot]}>
          <Image
            source={{ uri: logoUrl }}   // <--- FIX APPLIED HERE
            style={{
              width: logoWidth,
              height: logoHeight,
              resizeMode: "contain",
            }}
          />
        </View>
      )}

      {/* RIGHT ICONS */}
      <View style={[styles.rightSlot, layout.rightSlot]}>

        {/* Notification */}
        {props.notification?.properties?.visible?.value && (
          <View style={styles.iconWrapper}>
            <Icon
              name={props.notification.properties.iconId.value}
              size={iconSize(props.notification.properties.width.value)}
              color={props.notification.properties.color.value}
            />

            {props.notification.properties.showBadge?.value && (
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

        {/* Cart */}
        {props.cart?.properties?.visible?.value && (
          <View style={styles.iconWrapper}>
            <Icon
              name={props.cart.properties.iconId.value}
              size={iconSize(props.cart.properties.width.value)}
              color={props.cart.properties.color.value}
            />

            {props.cart.properties.showBadge?.value && (
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
  container: {
    width: "100%",
    flexWrap: "nowrap",
  },
  leftSlot: { flexDirection: "row", alignItems: "center" },
  logoSlot: { flex: 1, alignItems: "center" },
  rightSlot: { flexDirection: "row", alignItems: "center" },
  iconWrapper: { position: "relative", marginLeft: 14 },
  badge: { position: "absolute", borderRadius: 20 },
});

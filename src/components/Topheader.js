// components/Header.js
import React from "react";
import { View, Image, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";

const isEnabled = (value) => value === true || value === "true";

export default function Header({ section }) {

  const props = section?.properties?.props?.properties || {};
  const layout = props?.layout?.properties?.css || {};

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
        {isEnabled(props.sideMenu?.properties?.visible?.value) && (
          <Icon
            name={props.sideMenu.properties.iconId.value}
            size={props.sideMenu.properties.width.value}
            color={props.sideMenu.properties.color.value}
          />
        )}
      </View>

      {/* LOGO */}
      {isEnabled(props.enableLogo?.value) && (
        <View style={[styles.logoSlot, layout.logoSlot]}>
          <Image
            source={{ uri: logoUrl }}   // <--- FIX APPLIED HERE
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

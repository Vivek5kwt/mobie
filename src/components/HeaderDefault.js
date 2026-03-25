import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";

const normalizeIconName = (name) => {
  if (!name) return "";
  return String(name).replace(/^fa[srldb]?[-_]?/, "");
};

export default function HeaderDefault({ config, bottomNavSection }) {
  const navigation = useNavigation();
  const navSection = bottomNavSection || bottomNavigationStyle1Section;

  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const qty = Number(item?.quantity);
      return sum + (Number.isFinite(qty) ? qty : 1);
    }, 0)
  );

  if (!config) return null;

  // Unwrap DSL value if needed, then check enabled
  const resolveVal = (v) => {
    if (v && typeof v === "object") {
      if (v.value !== undefined) return v.value;
      if (v.const !== undefined) return v.const;
    }
    return v;
  };
  const enabledRaw = resolveVal(config.enabled);
  // enabled: true  → show the bar
  // enabled: false → hide the bar
  if (enabledRaw !== true && enabledRaw !== "true" && enabledRaw !== 1) return null;

  console.log("[HeaderDefault] rendering config:", JSON.stringify(config));

  const bgColor = resolveVal(config.backgroundColor) || "#e6d7cd";
  const textColor = resolveVal(config.textColor) || "#111111";
  const iconColor = resolveVal(config.iconColor) || "#000000";

  const resolveNavItems = (rawSection) => {
    if (!rawSection) return [];
    const rawProps =
      rawSection?.props ||
      rawSection?.properties?.props?.properties ||
      rawSection?.properties?.props ||
      {};
    const raw = rawProps?.raw?.value ?? rawProps?.raw ?? {};
    let items = raw?.items ?? rawProps?.items ?? [];
    if (items?.value && Array.isArray(items.value)) return items.value;
    return Array.isArray(items) ? items : [];
  };

  const openNavTarget = (target) => {
    const items = resolveNavItems(navSection);
    const normalized = String(target || "").trim().toLowerCase();
    let idx = items.findIndex((item) => {
      const id = String(item?.id || "").toLowerCase();
      const label = String(
        item?.label ?? item?.title ?? item?.name ?? item?.text ?? ""
      ).toLowerCase();
      return id.includes(normalized) || label.includes(normalized);
    });
    if (idx < 0) idx = target === "cart" ? 1 : 2;
    const item = items[idx];
    const title =
      item?.label || item?.title || item?.name || (target === "cart" ? "Cart" : "Notifications");
    const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
    const link = typeof rawLink === "string" ? rawLink.replace(/^\//, "") : "";
    navigation.dispatch(
      StackActions.replace("BottomNavScreen", { title, link, activeIndex: idx, bottomNavSection: navSection })
    );
  };

  const renderItem = (item, idx) => {
    if (!item) return null;

    if (item.type === "text") {
      return (
        <Text
          key={idx}
          style={{ color: textColor, fontSize: 13, fontWeight: "500" }}
        >
          {item.title || ""}
        </Text>
      );
    }

    if (item.type === "icon") {
      const iconName = normalizeIconName(item.icon || "");
      if (!iconName) return null;
      const isCart = iconName.includes("cart");
      const isBell = iconName.includes("bell");
      const showBadge = isCart && cartCount > 0;

      return (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.7}
          style={{ position: "relative" }}
          onPress={() => {
            if (isCart) openNavTarget("cart");
            else if (isBell) openNavTarget("notification");
          }}
        >
          <Icon name={iconName} size={20} color={iconColor} />
          {showBadge && (
            <View
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                backgroundColor: "#EF4444",
                borderRadius: 8,
                minWidth: 16,
                height: 16,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "700" }}>
                {cartCount > 99 ? "99+" : String(cartCount)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return null;
  };

  const resolveArray = (v) => {
    const unwrapped = resolveVal(v);
    return Array.isArray(unwrapped) ? unwrapped : [];
  };
  const leftItems = resolveArray(config.left);
  const rightItems = resolveArray(config.right);
  const centerItems = resolveArray(config.center);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: bgColor,
        paddingVertical: 8,
        paddingHorizontal: 16,
      }}
    >
      {/* Left */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
        {leftItems.map(renderItem)}
      </View>

      {/* Center */}
      {centerItems.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {centerItems.map(renderItem)}
        </View>
      )}

      {/* Right */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
        {rightItems.map(renderItem)}
      </View>
    </View>
  );
}

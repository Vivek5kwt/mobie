import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";

const normalizeIconName = (name) => {
  if (!name) return "";
  return String(name).replace(/^fa[srldb]?[-_]?/, "");
};

// Unwrap DSL-wrapped values like { value: "..." } or { const: "..." }
const resolveVal = (v) => {
  if (v && typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
  }
  return v;
};

const resolveArray = (v) => {
  const u = resolveVal(v);
  return Array.isArray(u) ? u : [];
};

export default function HeaderDefault({ config, bottomNavSection, hideTabs = false }) {
  const navigation = useNavigation();
  const navSection = bottomNavSection || bottomNavigationStyle1Section;

  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const qty = Number(item?.quantity);
      return sum + (Number.isFinite(qty) ? qty : 1);
    }, 0)
  );

  // Tabs active index — must be a hook (called before any early returns)
  const [activeTabIdx, setActiveTabIdx] = useState(
    Number.isFinite(Number(config?.activeTabIndex)) ? Number(config.activeTabIndex) : 0
  );

  if (!config) return null;

  // enabled check
  const enabledRaw = resolveVal(config.enabled);
  if (enabledRaw !== true && enabledRaw !== "true" && enabledRaw !== 1) return null;

  // ── Global style tokens ───────────────────────────────────────────────────
  // bgColor falls back to bgColor field in case backgroundColor is absent
  const bgColor   = resolveVal(config.backgroundColor) || resolveVal(config.bgColor) || "#e6d7cd";
  const textColor = resolveVal(config.textColor)       || "#111111";
  const iconColor = resolveVal(config.iconColor)       || "#000000";
  const titleText = resolveVal(config.title)           || "";

  // ── Tab bar tokens ────────────────────────────────────────────────────────
  const tabs     = resolveArray(config.tabs);
  const multiTab = resolveVal(config.multiTab) === true || resolveVal(config.multiTab) === "true";
  const showTabs = multiTab && tabs.length > 0 && !hideTabs;

  // Determine whether the header background is "light" so we can pick readable defaults.
  const _isLightBg = (() => {
    const hex = (bgColor || "").replace("#", "");
    if (hex.length < 6) return true;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 140;
  })();

  const _darkFallback  = textColor;                      // use header textColor for active (always readable)
  const _mutedFallback = _isLightBg ? "rgba(0,0,0,0.38)" : "rgba(255,255,255,0.55)";

  const activeTabColor   = resolveVal(config.activeTextColor)   || _darkFallback;
  const inactiveTabColor = resolveVal(config.inactiveTextColor) || _mutedFallback;
  // Underline indicator color — separate from text color so it can be an accent
  const activeIndicatorColor = resolveVal(config.activeIndicatorColor) || resolveVal(config.activeBorderColor) || activeTabColor;

  // ── Nav helpers ───────────────────────────────────────────────────────────
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
      const id    = String(item?.id    || "").toLowerCase();
      const label = String(item?.label ?? item?.title ?? item?.name ?? item?.text ?? "").toLowerCase();
      return id.includes(normalized) || label.includes(normalized);
    });
    if (idx < 0) idx = target === "cart" ? 1 : 2;
    const item  = items[idx];
    const title = item?.label || item?.title || item?.name || (target === "cart" ? "Cart" : "Notifications");
    const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
    const link = typeof rawLink === "string" ? rawLink.replace(/^\//, "") : "";
    navigation.dispatch(
      StackActions.replace("BottomNavScreen", { title, link, activeIndex: idx, bottomNavSection: navSection })
    );
  };

  // ── Tab bar (shared between flat and array mode) ──────────────────────────
  // Tab bar uses the same bgColor as the appbar. Active/inactive colors come
  // directly from DSL activeTextColor / inactiveTextColor.
  const tabBar = showTabs ? (
    <View style={{ flexDirection: "row", backgroundColor: bgColor, borderBottomWidth: 1, borderBottomColor: _isLightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)" }}>
      {tabs.map((tab, idx) => {
        const isActive = idx === activeTabIdx;
        const label = resolveVal(tab.label) || resolveVal(tab.title) || resolveVal(tab.text) || `Tab ${idx + 1}`;
        return (
          <TouchableOpacity
            key={tab.id || String(idx)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 10,
              borderBottomWidth: 3,
              borderBottomColor: isActive ? activeIndicatorColor : "transparent",
            }}
            activeOpacity={0.75}
            onPress={() => setActiveTabIdx(idx)}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: isActive ? "700" : "500",
                color: isActive ? activeTabColor : inactiveTabColor,
                letterSpacing: 0.2,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  ) : null;

  // ── Flat DSL structure: { title, showBell, showCart, iconColor, textColor, bgColor }
  // ── Array DSL structure: { left: [...], center: [...], right: [...] }
  const leftItems   = resolveArray(config.left);
  const centerItems = resolveArray(config.center);
  const rightItems  = resolveArray(config.right);
  const useFlatMode = leftItems.length === 0 && centerItems.length === 0 && rightItems.length === 0;

  if (useFlatMode) {
    // ── FLAT MODE: render title on left, icons on right ───────────────────────
    const showBell = resolveVal(config.showBell) === true || resolveVal(config.showBell) === "true";
    const showCart = resolveVal(config.showCart) === true || resolveVal(config.showCart) === "true" || resolveVal(config.showCart) === undefined;

    return (
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: bgColor,
            paddingVertical: 10,
            paddingHorizontal: 16,
            minHeight: 48,
          }}
        >
          {/* Brand title */}
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: textColor,
              flex: 1,
            }}
            numberOfLines={1}
          >
            {titleText}
          </Text>

          {/* Right icons */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {showBell && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openNavTarget("notification")}
              >
                <Icon name="bell" size={20} color={iconColor} />
              </TouchableOpacity>
            )}
            {showCart && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openNavTarget("cart")}
                style={{ position: "relative" }}
              >
                <Icon name="cart-shopping" size={20} color={iconColor} />
                {cartCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -5,
                      right: -7,
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
            )}
          </View>
        </View>

        {/* Tab bar (shown below header when multiTab + tabs configured) */}
        {tabBar}
      </View>
    );
  }

  // ── ARRAY MODE: render left / center / right item arrays ─────────────────
  const renderItem = (item, idx) => {
    if (!item) return null;

    const itemType        = String(item.type || "").toLowerCase();
    const itemIconName    = normalizeIconName(item.icon || "");
    const itemTitle       = item.title || item.text || "";
    const itemIconSize    = item.iconSize ? Number(item.iconSize) : 18;
    const itemIconColor   = item.iconColor || iconColor;
    // Use item-level textColor first, then fall back to global textColor
    const itemTextColor   = item.textColor || textColor;
    const itemFontSize    = item.textSize   ? Number(item.textSize)  : 13;
    const itemFontWeight  = item.textBold   ? "700" : item.textWeight ? String(item.textWeight) : "600";
    const itemFontFamily  = item.textFontFamily || undefined;
    const itemFontStyle   = item.textItalic ? "italic" : "normal";
    let itemTextDecoration = "none";
    if (item.textUnderline && item.textStrikethrough) itemTextDecoration = "underline line-through";
    else if (item.textUnderline)                       itemTextDecoration = "underline";
    else if (item.textStrikethrough)                   itemTextDecoration = "line-through";

    const isCart  = itemIconName.includes("cart");
    const isBell  = itemIconName.includes("bell");
    const showBadge   = isCart && cartCount > 0;
    const isInteractive = isCart || isBell;

    const showIcon  = !!itemIconName;
    // Show title for any type except pure "icon" type
    const showTitle = itemType !== "icon" && !!itemTitle;

    if (!showIcon && !showTitle) return null;

    const iconNode = showIcon ? (
      <View key="icon" style={{ position: "relative" }}>
        <Icon name={itemIconName} size={itemIconSize} color={itemIconColor} />
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
      </View>
    ) : null;

    const textNode = showTitle ? (
      <Text
        key="text"
        style={{
          color: itemTextColor,
          fontSize: itemFontSize,
          fontWeight: itemFontWeight,
          fontStyle: itemFontStyle,
          textDecorationLine: itemTextDecoration,
          ...(itemFontFamily ? { fontFamily: itemFontFamily } : {}),
        }}
      >
        {itemTitle}
      </Text>
    ) : null;

    const inner = (
      <>
        {iconNode}
        {textNode}
      </>
    );

    if (isInteractive) {
      return (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.7}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          onPress={() => {
            if (isCart) openNavTarget("cart");
            else if (isBell) openNavTarget("notification");
          }}
        >
          {inner}
        </TouchableOpacity>
      );
    }

    return (
      <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {inner}
      </View>
    );
  };

  return (
    <View>
      {/* Main header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: bgColor,
          paddingVertical: 10,
          paddingHorizontal: 16,
          minHeight: 48,
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

      {/* Tab bar (shown below header when multiTab + tabs configured) */}
      {tabBar}
    </View>
  );
}

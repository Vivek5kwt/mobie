import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
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

  const wishlistCount = useSelector((state) => (state?.wishlist?.items || []).length);

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
    navigation.navigate("BottomNavScreen", { title, link, activeIndex: idx, bottomNavSection: navSection });
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
    const showBell     = resolveVal(config.showBell)     === true || resolveVal(config.showBell)     === "true";
    const showCart     = resolveVal(config.showCart)     === true || resolveVal(config.showCart)     === "true" || resolveVal(config.showCart) === undefined;
    const showWishlist = resolveVal(config.showWishlist) === true || resolveVal(config.showWishlist) === "true";

    // ── Title text styling (DSL-driven) ──────────────────────────────────────
    const cleanFontFamily = (family) => {
      if (!family) return undefined;
      const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
      return cleaned || undefined;
    };
    const _fsr = resolveVal(config.titleFontSize) ?? resolveVal(config.fontSize);
    const titleFontSize   = Number.isFinite(Number(_fsr)) && Number(_fsr) > 0 ? Number(_fsr) : 18;
    const titleFontFamily = cleanFontFamily(
      resolveVal(config.titleFontFamily) ??
      resolveVal(config.fontFamily) ??
      resolveVal(config.titleFamily)
    );
    const _fwr = String(
      resolveVal(config.titleFontWeight) ??
      resolveVal(config.fontWeight) ??
      resolveVal(config.titleWeight) ??
      "700"
    );
    const _fwMap = { thin: "100", extralight: "200", light: "300", regular: "400", medium: "500", semibold: "600", bold: "700", extrabold: "800", black: "900" };
    const titleFontWeight = _fwMap[_fwr.toLowerCase()] || _fwr;
    const titleColor = resolveVal(config.titleColor) ?? resolveVal(config.titleTextColor) ?? textColor;

    // ── Title box / border styling ─────────────────────────────────────────
    // Check nested sub-objects in case builder stores box style there
    const _rawSub   = resolveVal(config.raw)           || {};
    const _titleSub = resolveVal(config.titleStyle)    || resolveVal(config.titleSettings) || resolveVal(config.titleBox) || {};
    const _logoSub  = resolveVal(config.logoStyle)     || resolveVal(config.logoSettings)  || {};
    const _sub = (typeof _rawSub === "object" ? _rawSub : {});
    const _tsub = (typeof _titleSub === "object" ? _titleSub : {});
    const _lsub = (typeof _logoSub === "object" ? _logoSub : {});

    const titleBoxBg = resolveVal(
      config.titleBgColor ??
      config.titleBackgroundColor ??
      config.titleContainerBg ??
      config.titleBoxBg ??
      config.titleBoxBgColor ??
      config.logoBgColor ??
      config.logoBackgroundColor ??
      config.brandBgColor ??
      config.nameBgColor ??
      config.labelBgColor ??
      config.textBoxBgColor ??
      config.titleLabelBg ??
      _sub.titleBgColor ?? _sub.titleBoxBg ?? _sub.logoBgColor ??
      _tsub.bgColor ?? _tsub.backgroundColor ?? _tsub.bg ??
      _lsub.bgColor ?? _lsub.backgroundColor
    ) || "";

    const _borderRaw = resolveVal(
      config.titleBorder ??
      config.showTitleBorder ??
      config.titleBorderEnabled ??
      config.showBorder ??
      config.titleBoxBorder ??
      config.logoBorder ??
      config.titleBorderVisible ??
      config.hasTitleBorder ??
      _sub.titleBorder ?? _sub.showBorder ??
      _tsub.border ?? _tsub.showBorder ?? _tsub.borderEnabled ??
      _lsub.border ?? _lsub.borderEnabled
    );
    const titleBorderEnabled =
      _borderRaw === true ||
      (typeof _borderRaw === "string" &&
        _borderRaw !== "" && _borderRaw !== "false" && _borderRaw !== "0" && _borderRaw !== "none");

    const titleBorderWidth  = titleBorderEnabled ? Number(resolveVal(config.titleBorderWidth  ?? config.titleBorderSize ?? _tsub.borderWidth  ?? _sub.titleBorderWidth)  ?? 1) : 0;
    const titleBorderColor  = resolveVal(config.titleBorderColor ?? config.titleBorderColour ?? _tsub.borderColor ?? _tsub.color ?? _sub.titleBorderColor) || "#000000";
    const titleBorderRadius = Number(resolveVal(config.titleBorderRadius ?? config.titleRadius ?? config.titleCorner ?? _tsub.borderRadius ?? _tsub.radius ?? _sub.titleBorderRadius) ?? 0);
    const titleBoxPaddingH  = Number(resolveVal(config.titleBoxPaddingH ?? config.titlePaddingH ?? config.titlePadX ?? _tsub.paddingH ?? _tsub.px) ?? 10);
    const titleBoxPaddingV  = Number(resolveVal(config.titleBoxPaddingV ?? config.titlePaddingV ?? config.titlePadY ?? _tsub.paddingV ?? _tsub.py) ?? 5);
    const hasBox = !!titleBoxBg || titleBorderEnabled;

    const badgeStyle = {
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
    };
    const badgeText = { color: "#FFFFFF", fontSize: 9, fontWeight: "700" };

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
          {/* Brand title — taps navigate to home */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => navigation.navigate("LayoutScreen")}
            style={{ flex: 1 }}
          >
            <View
              style={{
                alignSelf: "flex-start",
                ...(hasBox ? {
                  borderWidth: titleBorderWidth,
                  borderColor: titleBorderColor,
                  borderRadius: titleBorderRadius,
                  backgroundColor: titleBoxBg || "transparent",
                  paddingHorizontal: titleBoxPaddingH,
                  paddingVertical: titleBoxPaddingV,
                } : {}),
              }}
            >
              <Text
                style={{
                  fontSize: titleFontSize,
                  fontWeight: titleFontWeight,
                  color: titleColor,
                  ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
                }}
                numberOfLines={1}
              >
                {titleText}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Right icons */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {showWishlist && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate("Wishlist")}
                style={{ position: "relative" }}
              >
                <Icon name="heart" size={20} color={iconColor} />
                {wishlistCount > 0 && (
                  <View style={badgeStyle}>
                    <Text style={badgeText}>{wishlistCount > 99 ? "99+" : String(wishlistCount)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            {showBell && (
              <TouchableOpacity activeOpacity={0.7} onPress={() => openNavTarget("notification")}>
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
                  <View style={badgeStyle}>
                    <Text style={badgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Text>
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
    const itemTextColor   = item.textColor || textColor;
    const itemFontSize    = item.textSize ? Number(item.textSize) : 13;
    const itemFontWeight  = item.textBold ? "700" : item.textWeight ? String(item.textWeight) : "600";
    const itemFontFamily  = item.textFontFamily || undefined;
    const itemFontStyle   = item.textItalic ? "italic" : "normal";
    let itemTextDecoration = "none";
    if (item.textUnderline && item.textStrikethrough) itemTextDecoration = "underline line-through";
    else if (item.textUnderline)                       itemTextDecoration = "underline";
    else if (item.textStrikethrough)                   itemTextDecoration = "line-through";

    // ── Per-item container box styling (bgColor, borderLine, borderRadius) ──
    const itemBgColor      = item.bgColor || item.backgroundColor || "";
    const itemBorderLine   = String(item.borderLine || item.border || "none").toLowerCase();
    const itemBorderColor  = item.borderColor || item.borderColour || itemIconColor || "#000000";
    const itemBorderWidth  = item.borderWidth != null ? Number(item.borderWidth) : 2;
    const itemBorderRadius = item.borderRadius != null ? Number(item.borderRadius) : 0;
    const hasItemBox       = !!itemBgColor || (itemBorderLine !== "none" && itemBorderLine !== "");

    // Map borderLine → React Native border-side properties
    const itemBorderStyle = (() => {
      if (!itemBorderLine || itemBorderLine === "none") return {};
      if (itemBorderLine === "all" || itemBorderLine === "full") {
        return { borderWidth: itemBorderWidth, borderColor: itemBorderColor };
      }
      const sides = {};
      if (itemBorderLine.includes("left"))   { sides.borderLeftWidth   = itemBorderWidth; sides.borderLeftColor   = itemBorderColor; }
      if (itemBorderLine.includes("right"))  { sides.borderRightWidth  = itemBorderWidth; sides.borderRightColor  = itemBorderColor; }
      if (itemBorderLine.includes("top"))    { sides.borderTopWidth    = itemBorderWidth; sides.borderTopColor    = itemBorderColor; }
      if (itemBorderLine.includes("bottom")) { sides.borderBottomWidth = itemBorderWidth; sides.borderBottomColor = itemBorderColor; }
      return sides;
    })();

    const itemBoxStyle = hasItemBox ? {
      backgroundColor: itemBgColor || "transparent",
      borderRadius: itemBorderRadius,
      paddingHorizontal: item.paddingH != null ? Number(item.paddingH) : 8,
      paddingVertical:   item.paddingV != null ? Number(item.paddingV) : 4,
      ...itemBorderStyle,
    } : {};

    const isCart     = itemIconName.includes("cart");
    const isBell     = itemIconName.includes("bell");
    const isWishlist = itemIconName.includes("heart") || itemIconName.includes("bookmark");
    const showBadge  = (isCart && cartCount > 0) || (isWishlist && wishlistCount > 0);
    const badgeCount = isCart ? cartCount : isWishlist ? wishlistCount : 0;
    const isInteractive = isCart || isBell || isWishlist;

    const showIcon  = !!itemIconName;
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
              {badgeCount > 99 ? "99+" : String(badgeCount)}
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
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 4 }, itemBoxStyle]}>
        {iconNode}
        {textNode}
      </View>
    );

    if (isInteractive) {
      return (
        <TouchableOpacity
          key={idx}
          activeOpacity={0.7}
          onPress={() => {
            if (isCart)          openNavTarget("cart");
            else if (isBell)     openNavTarget("notification");
            else if (isWishlist) navigation.navigate("Wishlist");
          }}
        >
          {inner}
        </TouchableOpacity>
      );
    }

    return <View key={idx}>{inner}</View>;
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

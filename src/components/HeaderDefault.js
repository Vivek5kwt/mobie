import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { useSideMenu } from "../services/SideMenuContext";
import { useAuth } from "../services/AuthContext";
import { getTypography, resolveFirstFont } from "../services/typographyService";
import { dedupeWishlistProducts } from "../store/slices/wishlistSlice";
import { requireLoginForAction } from "../utils/authGate";
import { navigateToDslTarget } from "../utils/navigationTarget";

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

const getHeaderTextItem = (items) =>
  (items || [])
    .map((item) => resolveVal(item) || item)
    .find((item) => {
      if (!item || typeof item !== "object") return false;
      const type = String(resolveVal(item.type) || "").toLowerCase();
      return type === "text" || resolveVal(item.title) || resolveVal(item.text);
    }) || null;

const normalizeFontWeight = (value, fallback = "400") => {
  const resolved = resolveVal(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number" && Number.isFinite(resolved)) return String(resolved);
  const normalized = String(resolved).trim().toLowerCase();
  if (!normalized) return fallback;
  if (/^\d+$/.test(normalized)) return normalized;
  const map = {
    thin: "100",
    extralight: "200",
    "extra light": "200",
    light: "300",
    regular: "400",
    normal: "400",
    medium: "500",
    semibold: "600",
    "semi bold": "600",
    "semi-bold": "600",
    bold: "700",
    extrabold: "800",
    "extra bold": "800",
    black: "900",
  };
  return map[normalized] || fallback;
};

const resolveLineHeight = (value, fontSize, multiplier = 1.25) => {
  const resolved = resolveVal(value);
  const parsed = typeof resolved === "number"
    ? resolved
    : Number.parseFloat(String(resolved ?? "").replace("px", "").trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed < 10 ? Math.ceil(parsed * fontSize) : parsed;
  }
  return Math.ceil(fontSize * multiplier);
};

const normalizeNavKey = (value) =>
  String(value || "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const isDefaultHeaderTitle = (value) => {
  const normalized = String(resolveVal(value) || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
  return normalized === "mobidrag";
};

const resolveHeaderTitleText = (config = {}, fallbackTitle = "") => {
  const candidates = [config.title, config.headerText, config.text];
  for (const candidate of candidates) {
    const text = String(resolveVal(candidate) || "").trim();
    if (!text || isDefaultHeaderTitle(text)) continue;
    return text;
  }
  const fallback = String(resolveVal(fallbackTitle) || "").trim();
  return fallback && !isDefaultHeaderTitle(fallback) ? fallback : "";
};

const isBackNavigationTarget = (navRef, navType) => {
  const typeKey = normalizeNavKey(navType);
  const refKey = normalizeNavKey(navRef);

  return (
    typeKey === "previousscreen" ||
    typeKey === "back" ||
    typeKey === "goback" ||
    refKey === "back" ||
    refKey === "__back__" ||
    refKey === "previousscreen"
  );
};

const HEADER_HEIGHT = 56;
const HEADER_HORIZONTAL_PADDING = 16;
const HEADER_TOUCH_SIZE = 44;
const HEADER_ITEM_GAP = 12;

const headerIconButtonStyle = {
  width: HEADER_TOUCH_SIZE,
  height: HEADER_TOUCH_SIZE,
  alignItems: "center",
  justifyContent: "center",
  overflow: "visible",
};

const countVisibleHeaderItems = (items = []) =>
  items.reduce((count, rawItem) => {
    const item = resolveVal(rawItem) || rawItem;
    if (!item || typeof item !== "object") return count;
    const type = String(resolveVal(item.type) || "").toLowerCase();
    const hasImage = type === "image" && !!String(resolveVal(item.imageUrl) || resolveVal(item.image) || resolveVal(item.src) || "");
    const hasIcon = !!String(resolveVal(item.icon) || "") && !hasImage && type !== "text";
    const rawText = String(resolveVal(item.title) || resolveVal(item.text) || "");
    const hasText = !!rawText && !isDefaultHeaderTitle(rawText) && !hasImage && type !== "icon";
    return hasImage || hasIcon || hasText ? count + 1 : count;
  }, 0);

const estimateHeaderSlotWidth = (items = []) => {
  const count = Math.max(1, countVisibleHeaderItems(items));
  return count * HEADER_TOUCH_SIZE + Math.max(0, count - 1) * HEADER_ITEM_GAP;
};

export default function HeaderDefault({
  config,
  bottomNavSection,
  hideTabs = false,
  showBack = false,
  fallbackTitle = "",
  disableDefaultTitlePress = false,
}) {
  const navigation = useNavigation();
  const { openSideMenu, toggleSideMenu } = useSideMenu();
  const { session, initializing } = useAuth();
  const canGoBack = navigation.canGoBack();
  const navSection = bottomNavSection || bottomNavigationStyle1Section;

  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const qty = Number(item?.quantity);
      return sum + (Number.isFinite(qty) ? qty : 1);
    }, 0)
  );

  const wishlistCount = useSelector((state) => dedupeWishlistProducts(state?.wishlist?.items || []).length);

  // Tabs active index — must be a hook (called before any early returns)
  const [activeTabIdx, setActiveTabIdx] = useState(
    Number.isFinite(Number(config?.activeTabIndex)) ? Number(config.activeTabIndex) : 0
  );

  if (!config) return null;

  // enabled check
  const enabledRaw = resolveVal(config.enabled);
  if (enabledRaw !== true && enabledRaw !== "true" && enabledRaw !== 1) return null;
  const typography = getTypography() || {};

  // ── Global style tokens ───────────────────────────────────────────────────
  // bgColor falls back to bgColor field in case backgroundColor is absent
  const bgColor   = resolveVal(config.backgroundColor) || resolveVal(config.bgColor) || "#e6d7cd";
  const textColor = resolveVal(config.textColor)       || "#111111";
  const iconColor = resolveVal(config.iconColor)       || "#000000";
  const titleText = resolveHeaderTitleText(config, fallbackTitle);

  // ── Bottom divider ───────────────────────────────────────────────────────
  const _dividerRaw = resolveVal(
    config.showDivider ??
    config.showBorder ??
    config.borderBottom ??
    config.divider ??
    config.showBottomBorder
  );
  const showDivider =
    _dividerRaw === true || _dividerRaw === "true" || _dividerRaw === 1;
  const dividerColor = resolveVal(
    config.dividerColor ??
    config.borderBottomColor ??
    config.borderColor ??
    config.dividerColour
  ) || "#E5E7EB";
  const dividerThickness = Number(
    resolveVal(config.dividerWidth ?? config.borderWidth ?? config.dividerThickness) ?? 1
  );
  const dividerStyle = showDivider
    ? { borderBottomWidth: dividerThickness, borderBottomColor: dividerColor }
    : {};

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

  // Flat header uses config.title; array header uses left/center/right items.
  const leftItems   = resolveArray(config.left);
  const centerItems = resolveArray(config.center);
  const rightItems  = resolveArray(config.right);
  const centerTextItem = getHeaderTextItem(centerItems);
  const headerFontFamily = resolveFirstFont(
    resolveVal(centerTextItem?.textFontFamily),
    resolveVal(centerTextItem?.fontFamily),
    resolveVal(centerTextItem?.titleFontFamily),
    resolveVal(centerTextItem?.headerFontFamily),
    resolveVal(centerTextItem?.family),
    resolveVal(config.textFontFamily),
    resolveVal(config.titleFontFamily),
    resolveVal(config.headerFontFamily),
    resolveVal(config.fontFamily),
    resolveVal(config.titleFamily),
    typography.headlineFontFamily,
    typography.bodyFontFamily
  ) || "";

  const titleFontSizeRaw = resolveVal(config.titleFontSize) ?? resolveVal(config.fontSize);
  const resolvedTitleFontSize =
    Number.isFinite(Number(titleFontSizeRaw)) && Number(titleFontSizeRaw) > 0 ? Number(titleFontSizeRaw) : 18;
  const resolvedTitleFontFamily = resolveFirstFont(
    resolveVal(config.titleFontFamily),
    resolveVal(config.textFontFamily),
    resolveVal(config.headerFontFamily),
    resolveVal(config.fontFamily),
    resolveVal(config.titleFamily),
    headerFontFamily
  ) || "";
  const resolvedTitleFontWeight = normalizeFontWeight(
    resolveVal(config.titleFontWeight) ??
    resolveVal(config.textWeight) ??
    resolveVal(config.headerFontWeight) ??
    resolveVal(config.fontWeight) ??
    resolveVal(config.titleWeight),
    "700"
  );
  const resolvedTitleColor = resolveVal(config.titleColor) ?? resolveVal(config.titleTextColor) ?? textColor;
  const resolvedTitleLineHeight = resolveLineHeight(
    config.titleLineHeight ?? config.textLineHeight ?? config.lineHeight,
    resolvedTitleFontSize
  );
  const centeredTitleTextStyle = {
    fontSize: resolvedTitleFontSize,
    lineHeight: resolvedTitleLineHeight,
    fontWeight: resolvedTitleFontWeight,
    color: resolvedTitleColor,
    includeFontPadding: true,
    textAlignVertical: "center",
    ...(resolvedTitleFontFamily ? { fontFamily: resolvedTitleFontFamily } : {}),
  };

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

  const openWishlist = async () => {
    const blocked = await requireLoginForAction({
      session,
      navigation,
      initializing,
      postLoginTarget: {
        name: "BottomNavScreen",
        params: {
          title: "Wishlist",
          pageName: "wishlist",
          link: "wishlist",
        },
      },
    });
    if (!blocked) {
      navigation.navigate("BottomNavScreen", {
        title: "Wishlist",
        pageName: "wishlist",
        link: "wishlist",
      });
    }
  };

  const openNavTarget = (target) => {
    const headerNavRef = String(
      resolveVal(
        target === "cart"
          ? (config?.cart?.navigateRef ?? config?.cart?.linkTo ?? config?.cart?.link ?? config?.navigateRef ?? config?.linkTo)
          : (config?.notification?.navigateRef ?? config?.notification?.linkTo ?? config?.notification?.link)
      ) || ""
    ).trim();
    const headerNavType = String(
      resolveVal(
        target === "cart"
          ? (config?.cart?.navigateType ?? config?.navigateType)
          : config?.notification?.navigateType
      ) || "Screen"
    ).trim();

    if (headerNavRef) {
      const type = headerNavType.toLowerCase();
      const key = headerNavRef.toLowerCase().replace(/[\s_-]+/g, "");
      if (type === "screen" || !type) {
        if (key === "home" || key === "layoutscreen" || key === "layout") {
          navigation.navigate("LayoutScreen");
        } else if (key === "cart" || key === "profile" || key === "account" || key === "myaccount") {
          navigation.navigate("BottomNavScreen", {
            title: headerNavRef,
            pageName: headerNavRef,
            link: headerNavRef,
            bottomNavSection: navSection,
          });
        } else if (key === "wishlist") {
          openWishlist();
        } else {
          void navigateToDslTarget(navigation, {
            target: headerNavRef,
            navigateRef: headerNavRef,
            navigateType: headerNavType,
            fallbackTitle: headerNavRef,
            extraParams: { bottomNavSection: navSection },
          });
        }
      } else if (type === "url") {
        navigation.navigate("CheckoutWebView", { url: headerNavRef, title: "" });
      } else {
        void navigateToDslTarget(navigation, {
          target: headerNavRef,
          navigateRef: headerNavRef,
          navigateType: headerNavType,
          fallbackTitle: headerNavRef,
          extraParams: { bottomNavSection: navSection },
        });
      }
      return;
    }

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
    void navigateToDslTarget(navigation, {
      target: link || title,
      link: rawLink,
      label: title,
      fallbackTitle: title,
      extraParams: { activeIndex: idx, bottomNavSection: null },
    });
  };

  // ── Tab bar (shared between flat and array mode) ──────────────────────────
  // Tab bar uses the same bgColor as the appbar. Active/inactive colors come
  // directly from DSL activeTextColor / inactiveTextColor.
  const tabFontFamily = resolveFirstFont(
    resolveVal(config.tabFontFamily),
    resolveVal(config.tabsFontFamily),
    resolveVal(config.textFontFamily),
    resolveVal(config.fontFamily),
    typography.bodyFontFamily,
    headerFontFamily
  ) || "";
  const activeTabWeight = normalizeFontWeight(resolveVal(config.activeTabFontWeight), "700");
  const inactiveTabWeight = normalizeFontWeight(resolveVal(config.inactiveTabFontWeight), "500");
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
                fontWeight: isActive ? activeTabWeight : inactiveTabWeight,
                color: isActive ? activeTabColor : inactiveTabColor,
                letterSpacing: 0.2,
                ...(tabFontFamily ? { fontFamily: tabFontFamily } : {}),
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
  const useFlatMode = leftItems.length === 0 && centerItems.length === 0 && rightItems.length === 0;

  if (useFlatMode) {
    // ── FLAT MODE: render title on left, icons on right ───────────────────────
    const showBell     = resolveVal(config.showBell)     === true || resolveVal(config.showBell)     === "true";
    const showCart     = resolveVal(config.showCart)     === true || resolveVal(config.showCart)     === "true";
    const showWishlist = resolveVal(config.showWishlist) === true || resolveVal(config.showWishlist) === "true";
    const cartConfig = resolveVal(config.cart) || {};
    const cartVisible = showCart || resolveVal(cartConfig.visible) === true || resolveVal(cartConfig.visible) === "true";
    const cartIconName = normalizeIconName(resolveVal(cartConfig.iconId) || resolveVal(cartConfig.icon) || "cart-shopping");
    const cartIconSizeRaw = Number(resolveVal(cartConfig.width) ?? resolveVal(cartConfig.iconSize));
    const cartIconSize = Number.isFinite(cartIconSizeRaw) && cartIconSizeRaw > 0 ? cartIconSizeRaw : 20;
    const cartIconColor = resolveVal(cartConfig.color) || iconColor;
    const rightIconCount = [showWishlist, showBell, cartVisible].filter(Boolean).length;
    const rightTouchSize = Math.max(HEADER_TOUCH_SIZE, cartIconSize + 16);
    const rightSlotWidth = rightIconCount > 0
      ? (rightIconCount * rightTouchSize) + ((rightIconCount - 1) * HEADER_ITEM_GAP)
      : HEADER_TOUCH_SIZE;
    const balancedSideWidth = Math.max(HEADER_TOUCH_SIZE, rightSlotWidth);
    const flatBackConfig = resolveVal(config.backIcon) || resolveVal(config.back) || {};
    const flatBackIconName = normalizeIconName(
      resolveVal(flatBackConfig.iconId) ||
      resolveVal(flatBackConfig.icon) ||
      resolveVal(config.backIconName) ||
      "arrow-left-long"
    );
    const flatBackIconSizeRaw = Number(
      resolveVal(flatBackConfig.iconSize) ??
      resolveVal(config.backIconSize) ??
      resolveVal(config.iconSize)
    );
    const flatBackIconSize = Number.isFinite(flatBackIconSizeRaw) && flatBackIconSizeRaw > 0 ? flatBackIconSizeRaw : 18;
    const flatBackIconColor = resolveVal(flatBackConfig.iconColor) || iconColor;

    // ── Title text styling (DSL-driven) ──────────────────────────────────────
    const _fsr = resolveVal(config.titleFontSize) ?? resolveVal(config.fontSize);
    const titleFontSize   = Number.isFinite(Number(_fsr)) && Number(_fsr) > 0 ? Number(_fsr) : 18;
    const titleFontFamily = resolveFirstFont(
      resolveVal(config.titleFontFamily),
      resolveVal(config.textFontFamily),
      resolveVal(config.headerFontFamily),
      resolveVal(config.fontFamily),
      resolveVal(config.titleFamily),
      headerFontFamily
    ) || "";
    const titleFontWeight = normalizeFontWeight(
      resolveVal(config.titleFontWeight) ??
      resolveVal(config.textWeight) ??
      resolveVal(config.headerFontWeight) ??
      resolveVal(config.fontWeight) ??
      resolveVal(config.titleWeight),
      "700"
    );
    const titleColor = resolveVal(config.titleColor) ?? resolveVal(config.titleTextColor) ?? textColor;
    const titleLineHeight = resolveLineHeight(
      config.titleLineHeight ?? config.textLineHeight ?? config.lineHeight,
      titleFontSize
    );

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
            paddingVertical: 6,
            paddingHorizontal: HEADER_HORIZONTAL_PADDING,
            minHeight: HEADER_HEIGHT,
            ...dividerStyle,
          }}
        >
          {/* Left slot — back button on detail screens, spacer elsewhere */}
          <View style={{ width: balancedSideWidth, alignItems: "flex-start", justifyContent: "center" }}>
            {showBack && canGoBack ? (
              <TouchableOpacity
                style={headerIconButtonStyle}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name={flatBackIconName} size={flatBackIconSize} color={flatBackIconColor} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Brand title — absolutely overlaid to guarantee true center regardless of icon count */}
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }} pointerEvents="box-none">
            <View style={{ alignItems: "center", justifyContent: "center", paddingHorizontal: balancedSideWidth + HEADER_HORIZONTAL_PADDING, maxWidth: "100%" }}>
              {!!titleText ? (
                <TouchableOpacity
                  activeOpacity={disableDefaultTitlePress ? 1 : 0.75}
                  disabled={disableDefaultTitlePress}
                  onPress={() => navigation.navigate("LayoutScreen")}
                >
                  <View
                    style={{
                      alignSelf: "center",
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
                        lineHeight: titleLineHeight,
                        fontWeight: titleFontWeight,
                        color: titleColor,
                        includeFontPadding: true,
                        textAlignVertical: "center",
                        ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
                      }}
                      numberOfLines={1}
                    >
                      {titleText}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Right slot */}
          <View style={{ width: balancedSideWidth, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: HEADER_ITEM_GAP, overflow: "visible" }}>
            {showWishlist && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={openWishlist}
                style={[headerIconButtonStyle, { position: "relative" }]}
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
              <TouchableOpacity style={headerIconButtonStyle} activeOpacity={0.7} onPress={() => openNavTarget("notification")}>
                <Icon name="bell" size={20} color={iconColor} />
              </TouchableOpacity>
            )}
            {cartVisible && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => openNavTarget("cart")}
                style={[headerIconButtonStyle, { position: "relative" }]}
              >
                <Icon name={cartIconName} size={cartIconSize} color={cartIconColor} />
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

  // ── Top-level navigation (used as fallback for left-slot items) ─────────
  const topLevelNavRef  = String(resolveVal(config.navigateRef) || resolveVal(config.linkTo) || "").trim();
  const topLevelNavType = String(resolveVal(config.navigateType) || "").trim().toLowerCase();

  const executeNavigation = (navRef, navType) => {
    const type = String(navType || "").toLowerCase().trim();
    const ref  = String(navRef  || "").trim();
    if (type === "none") return;
    if (isBackNavigationTarget(ref, type)) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate("LayoutScreen");
      return;
    }
    const key = normalizeNavKey(ref);
    const isSideNavigationTarget =
      key === "sidenavigation" ||
      key === "sidemenu" ||
      key === "drawer" ||
      type === "sidenavigation" ||
      type === "side_navigation" ||
      type === "sidemenu" ||
      type === "drawer";

    if (isSideNavigationTarget) {
      if (typeof openSideMenu === "function") {
        openSideMenu();
      } else if (typeof toggleSideMenu === "function") {
        toggleSideMenu();
      }
      return;
    }

    if (!ref) return;
    if (key === "wishlist" || key === "mywishlist" || key === "my-wishlist") {
      openWishlist();
      return;
    }

    if (type === "screen") {
      // Map common DSL screen names to actual navigator screen names
      const screenMap = {
        home:         "LayoutScreen",
        layoutscreen: "LayoutScreen",
        layout:       "LayoutScreen",
        allproducts:  "AllProducts",
        products:     "AllProducts",
        shop:         "AllProducts",
        collection:   "AllProducts",
        cart:         "BottomNavScreen",
        profile:      "BottomNavScreen",
      };
      const screen = screenMap[key];
      if (screen === "BottomNavScreen") {
        navigation.navigate("BottomNavScreen", {
          title: ref,
          pageName: ref,
          link: ref,
          bottomNavSection: navSection,
        });
      } else if (screen) {
        navigation.navigate(screen);
      } else {
        void navigateToDslTarget(navigation, {
          target: ref,
          navigateRef: ref,
          navigateType: type,
          fallbackTitle: ref,
          extraParams: { bottomNavSection: navSection },
        });
      }
    } else if (type === "url") {
      navigation.navigate("CheckoutWebView", { url: ref, title: "" });
    } else if (type === "collection") {
      const collectionHandle = ref.includes("/collections/")
        ? ref.split("/collections/")[1]?.split(/[?#/]/)[0]
        : ref.toLowerCase().replace(/\s+/g, "-");
      navigation.navigate("CollectionProducts", {
        handle: collectionHandle,
        collectionHandle,
        collectionTitle: ref,
        title: ref,
      });
    } else if (type === "product") {
      navigation.navigate("ProductDetail", { handle: ref });
    } else {
      void navigateToDslTarget(navigation, {
        target: ref,
        navigateRef: ref,
        navigateType: type,
        fallbackTitle: ref,
        extraParams: { bottomNavSection: navSection },
      });
    }
  };

  // ── ARRAY MODE: render left / center / right item arrays ─────────────────
  const renderItem = (rawItem, idx, isLeftSlot = false) => {
    if (!rawItem) return null;
    // Unwrap item itself in case it's DSL-wrapped
    const item = resolveVal(rawItem) || rawItem;
    if (!item || typeof item !== "object") return null;

    const rv = (field) => resolveVal(field);

    const itemType      = String(rv(item.type) || "").toLowerCase();
    const itemIconName  = normalizeIconName(String(rv(item.icon) || ""));
    const itemTitle     = String(rv(item.title) || rv(item.text) || "");
    const hasDefaultTitle = isDefaultHeaderTitle(itemTitle);
    const _iconSz       = rv(item.iconSize);
    const itemIconSize  = _iconSz != null ? Number(_iconSz) : 18;
    const itemIconColor = String(rv(item.iconColor) || iconColor);

    // Text styling — cover both prefixed (textColor) and unprefixed (color) DSL keys
    const itemTextColor = String(
      rv(item.textColor) || rv(item.color) || textColor
    );
    const _txtSz = rv(item.textSize) ?? rv(item.fontSize) ?? rv(item.size);
    const itemFontSize = _txtSz != null ? Number(_txtSz) : 13;
    const itemLineHeight = resolveLineHeight(
      rv(item.textLineHeight) ?? rv(item.titleLineHeight) ?? rv(item.lineHeight),
      itemFontSize
    );

    // Normalise font-weight: builder may send "Medium", "Bold", "700", etc.
    const _fwRaw = rv(item.textBold) || rv(item.bold)
      ? "700"
      : String(
          rv(item.textWeight) || rv(item.fontWeight) || rv(item.weight) || "600"
        );
    const itemFontWeight = normalizeFontWeight(_fwRaw, "600");

    // Font family — cover textFontFamily / fontFamily / family
    const itemFontFamily = resolveFirstFont(
      rv(item.textFontFamily),
      rv(item.titleFontFamily),
      rv(item.headerFontFamily),
      rv(item.fontFamily),
      rv(item.family),
      headerFontFamily
    ) || undefined;

    // Font style & decoration — cover both prefixed and unprefixed keys
    const itemFontStyle = (rv(item.textItalic) || rv(item.italic)) ? "italic" : "normal";
    const _isUnderline  = rv(item.textUnderline)     || rv(item.underline);
    const _isStrike     = rv(item.textStrikethrough) || rv(item.strikethrough);
    let itemTextDecoration = "none";
    if (_isUnderline && _isStrike) itemTextDecoration = "underline line-through";
    else if (_isUnderline)         itemTextDecoration = "underline";
    else if (_isStrike)            itemTextDecoration = "line-through";

    // ── Image type properties ─────────────────────────────────────────────
    const itemImageUrl    = String(rv(item.imageUrl) || rv(item.image) || rv(item.src) || "");
    const _imgW           = rv(item.imageWidth)  ?? rv(item.width);
    const _imgH           = rv(item.imageHeight) ?? rv(item.height);
    const _imgR           = rv(item.imageRadius) ?? rv(item.borderRadius) ?? rv(item.radius);
    const itemImageWidth  = _imgW != null ? Number(_imgW) : 32;
    const itemImageHeight = _imgH != null ? Number(_imgH) : 32;
    const itemImageRadius = _imgR != null ? Number(_imgR) : 0;

    // ── Per-item container box styling ────────────────────────────────────
    // Cover every property name the builder might emit
    const itemBgColor = String(
      rv(item.bgColor) || rv(item.backgroundColor) || rv(item.background) || rv(item.bg) || ""
    );
    const itemBorderLine = String(
      rv(item.borderLine) || rv(item.border) || rv(item.borderSide) || "none"
    ).toLowerCase();
    const itemBorderColor = String(
      rv(item.borderColor) || rv(item.borderColour) || rv(item.borderCol) || "#000000"
    );
    const _bw = rv(item.borderWidth) ?? rv(item.borderSize);
    const itemBorderWidth = _bw != null ? Number(_bw) : 1;
    const _br = rv(item.borderRadius) ?? rv(item.radius) ?? rv(item.corner) ?? rv(item.borderCorner);
    const itemBorderRadius = _br != null ? Number(_br) : 0;
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

    const _pH = rv(item.paddingH) ?? rv(item.paddingX) ?? rv(item.px);
    const _pV = rv(item.paddingV) ?? rv(item.paddingY) ?? rv(item.py);
    const _pt = rv(item.paddingTop)    ?? rv(item.pt);
    const _pb = rv(item.paddingBottom) ?? rv(item.pb);
    const _pl = rv(item.paddingLeft)   ?? rv(item.pl);
    const _pr = rv(item.paddingRight)  ?? rv(item.pr);
    const hasItemPadding =
      _pH != null || _pV != null || _pt != null || _pb != null || _pl != null || _pr != null;
    const hasItemBorder = itemBorderLine !== "none" && itemBorderLine !== "";
    const hasPositiveItemRadius = _br != null && Number(_br) > 0;
    const hasItemBox = hasItemBorder || hasItemPadding || hasPositiveItemRadius;

    const itemBoxStyle = hasItemBox ? {
      backgroundColor: itemBgColor || "transparent",
      borderRadius: itemBorderRadius,
      paddingTop:    _pt != null ? Number(_pt) : (_pV != null ? Number(_pV) : 0),
      paddingBottom: _pb != null ? Number(_pb) : (_pV != null ? Number(_pV) : 0),
      paddingLeft:   _pl != null ? Number(_pl) : (_pH != null ? Number(_pH) : 0),
      paddingRight:  _pr != null ? Number(_pr) : (_pH != null ? Number(_pH) : 0),
      ...itemBorderStyle,
    } : {};

    const isCart     = itemIconName.includes("cart");
    const isBell     = itemIconName.includes("bell");
    const isWishlist = itemIconName.includes("heart") || itemIconName.includes("bookmark");
    const showBadge  = (isCart && cartCount > 0) || (isWishlist && wishlistCount > 0);
    const badgeCount = isCart ? cartCount : isWishlist ? wishlistCount : 0;

    // Per-item navigation — falls back to top-level config nav for left-slot items
    const itemNavRef  = String(rv(item.navigateRef) || rv(item.navigateTo) || rv(item.linkTo) || rv(item.link) || rv(item.href) || "").trim();
    const itemNavType = String(rv(item.navigateType) || rv(item.linkType) || "").trim().toLowerCase();
    const effectiveNavRef  = itemNavRef  || (isLeftSlot ? topLevelNavRef  : "");
    const effectiveNavType = itemNavType || (isLeftSlot ? topLevelNavType : "");
    const hasCustomNav = !!effectiveNavRef && effectiveNavType !== "none";
    const isBackIcon = isLeftSlot && (
      showBack ||
      isBackNavigationTarget(effectiveNavRef, effectiveNavType)
    ) && (
      itemIconName.includes("arrow-left") ||
      itemIconName.includes("chevron-left") ||
      itemIconName === "angle-left"
    );

    const isInteractive = isBackIcon || isCart || isBell || isWishlist || hasCustomNav;

    // Strictly respect item type: "text" shows only text, "icon" shows only icon.
    // When type is unspecified/empty, show whatever is available (icon + text can coexist).
    const showImage = itemType === "image" && !!itemImageUrl;
    const showIcon  = !!itemIconName && !showImage && itemType !== "text";
    const showTitle = !!itemTitle && !hasDefaultTitle && !showImage && itemType !== "icon";

    if (!showIcon && !showTitle && !showImage) return null;

    const iconNode = showIcon ? (
      <View
        key="icon"
        style={{
          position: "relative",
          width: itemIconSize,
          height: itemIconSize,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
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

    const imageNode = showImage ? (
      <Image
        key="image"
        source={{ uri: itemImageUrl }}
        style={{ width: itemImageWidth, height: itemImageHeight, borderRadius: itemImageRadius }}
        resizeMode="cover"
      />
    ) : null;

    const textNode = showTitle ? (
      <Text
        key="text"
        numberOfLines={1}
        style={{
          color: itemTextColor,
          fontSize: itemFontSize,
          lineHeight: itemLineHeight,
          fontWeight: itemFontWeight,
          fontStyle: itemFontStyle,
          textDecorationLine: itemTextDecoration,
          includeFontPadding: true,
          textAlignVertical: "center",
          ...(itemFontFamily ? { fontFamily: itemFontFamily } : {}),
        }}
      >
        {itemTitle}
      </Text>
    ) : null;

    const inner = (
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: showTitle && (showIcon || showImage) ? 6 : 0,
          },
          itemBoxStyle,
        ]}
      >
        {imageNode}
        {iconNode}
        {textNode}
      </View>
    );
    const isIconOnly = (showIcon || showImage) && !showTitle;
    const touchTargetStyle = {
      minHeight: HEADER_TOUCH_SIZE,
      minWidth: isIconOnly ? HEADER_TOUCH_SIZE : undefined,
      alignItems: "center",
      justifyContent: "center",
    };

    if (isInteractive) {
      return (
        <TouchableOpacity
          key={idx}
          style={touchTargetStyle}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          onPress={() => {
            if (isBackIcon) {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate("LayoutScreen");
            } else if (hasCustomNav) executeNavigation(effectiveNavRef, effectiveNavType);
            else if (isCart)        openNavTarget("cart");
            else if (isBell)        openNavTarget("notification");
            else if (isWishlist)    openWishlist();
          }}
        >
          {inner}
        </TouchableOpacity>
      );
    }

    return <View key={idx} style={touchTargetStyle}>{inner}</View>;
  };

  const leftSlotWidth = estimateHeaderSlotWidth(leftItems);
  const rightSlotWidth = estimateHeaderSlotWidth(rightItems);
  const centerSidePadding = Math.max(leftSlotWidth, rightSlotWidth) + HEADER_HORIZONTAL_PADDING;
  const shouldRenderCenterTitle = centerItems.length === 0 && !!titleText;

  return (
    <View>
      {/* Main header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: bgColor,
          paddingVertical: 6,
          paddingHorizontal: HEADER_HORIZONTAL_PADDING,
          minHeight: HEADER_HEIGHT,
          ...dividerStyle,
        }}
      >
        {/* Left — flex:1 fills available space, pushing right slot to edge */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: HEADER_ITEM_GAP,
            flex: 1,
            minWidth: leftSlotWidth,
            minHeight: HEADER_TOUCH_SIZE,
          }}
        >
          {leftItems.map((item, idx) => renderItem(item, idx, true))}
        </View>

        {/* Center — absolutely overlaid so it is always visually centered
            regardless of how many items are in left/right slots */}
        {(centerItems.length > 0 || shouldRenderCenterTitle) && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="box-none"
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: HEADER_ITEM_GAP,
                paddingHorizontal: centerSidePadding,
                maxWidth: "100%",
              }}
            >
              {centerItems.length > 0 ? (
                centerItems.map((item, idx) => renderItem(item, idx))
              ) : (
                <Text style={centeredTitleTextStyle} numberOfLines={1}>
                  {titleText}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Right — flex:1 with flex-end keeps it at the right edge */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: HEADER_ITEM_GAP,
            justifyContent: "flex-end",
            minWidth: rightSlotWidth,
            minHeight: HEADER_TOUCH_SIZE,
          }}
        >
          {rightItems.map((item, idx) => renderItem(item, idx))}
        </View>
      </View>

      {/* Tab bar (shown below header when multiTab + tabs configured) */}
      {tabBar}
    </View>
  );
}

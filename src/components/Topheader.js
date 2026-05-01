// components/Header.js
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import { useSideMenu } from "../services/SideMenuContext";
import { convertStyles } from "../utils/convertStyles";
import { getAppLogoSync } from "../utils/appInfo";
import { getHeaderDefault } from "../services/headerDefaultService";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";

const LOCAL_LOGO_IMAGE = require("../assets/logo/mobidraglogo.png");

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

const resolveFontWeight = (value, fallback = "400") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "number") return String(resolved);
  const normalized = String(resolved || "").trim().toLowerCase();
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
    bold: "700",
    extrabold: "800",
    "extra bold": "800",
    black: "900",
  };
  return map[normalized] || fallback;
};

const resolveLogoSource = (logoImage) => {
  // If no logo from DSL, try to get from app.json (set during build)
  if (!logoImage) {
    const appLogo = getAppLogoSync();
    if (appLogo && appLogo.trim() !== "") {
      return { uri: appLogo };
    }
    return null;
  }
  if (logoImage === "/images/mobidrag.png") {
    // Default placeholder — try app.json first, otherwise show nothing
    const appLogo = getAppLogoSync();
    if (appLogo && appLogo.trim() !== "") {
      return { uri: appLogo };
    }
    return null;
  }
  return { uri: logoImage };
};

const resolveLogoAlignment = (value) => {
  const normalized = String(unwrapValue(value, "center")).trim().toLowerCase();
  if (["left", "start", "flex-start"].includes(normalized)) return "left";
  if (["right", "end", "flex-end"].includes(normalized)) return "right";
  return "center";
};

const resolveLogoSlotAlignmentStyle = (alignment, flexDirection = "column") => {
  const isRow = ["row", "row-reverse"].includes(flexDirection);
  const isRowReverse = flexDirection === "row-reverse";
  let flexAlignment = "center";
  if (alignment === "left") flexAlignment = "flex-start";
  if (alignment === "right") flexAlignment = "flex-end";
  if (isRowReverse && (alignment === "left" || alignment === "right")) {
    flexAlignment = alignment === "left" ? "flex-end" : "flex-start";
  }
  return isRow ? { justifyContent: flexAlignment } : { alignItems: flexAlignment };
};

export default function Header({ section, showBack, showNotification, onTitlePress }) {
  const { openSideMenu, hasSideNav } = useSideMenu();
  const navigation = useNavigation();
  const { session } = useAuth();
  const canGoBack = navigation.canGoBack();
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const quantity = Number(item?.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 1);
    }, 0)
  );
  const safeCartCount = Number.isFinite(cartCount) ? Math.max(0, cartCount) : 0;
  const formattedCartCount = safeCartCount > 99 ? "99+" : String(safeCartCount);

  const props =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};
  const layout = props?.layout?.properties?.css || props?.layout?.css || {};
  const normalizedLayout = {
    container: convertStyles(layout.container || {}),
    leftSlot: convertStyles(layout.leftSlot || {}),
    logoSlot: convertStyles(layout.logoSlot || {}),
    logoImage: convertStyles(layout.logoImage || {}),
    rightSlot: convertStyles(layout.rightSlot || {}),
    badge: convertStyles(layout.badge || {}),
  };
  const logoImageStyle = { ...normalizedLayout.logoImage };
  if (logoImageStyle.width === "auto") delete logoImageStyle.width;
  if (logoImageStyle.height === "auto") delete logoImageStyle.height;
  const bottomNavSection = section?.bottomNavSection || null;

  // -----------------------------------------

  // headerdefault config — applies when the header is rendered standalone
  // (i.e. no DSL section provided, as in AllProductsScreen, ProductDetailScreen, etc.)
  // IMPORTANT: must be declared before any use of defaultConfig below
  const isStandalone = !section?.component && !section?.props;
  const defaultConfig = isStandalone ? getHeaderDefault() : null;

  const sideMenuProps = props?.sideMenu?.properties || props?.sideMenu || {};
  const sideMenuVisible = resolveBoolean(sideMenuProps?.visible, true);
  const sideMenuIconName = normalizeIconName(
    unwrapValue(sideMenuProps?.iconId ?? sideMenuProps?.iconName ?? sideMenuProps?.icon, "")
  );
  const sideMenuIconSize = unwrapValue(sideMenuProps?.width, 24);
  const sideMenuIconColor = unwrapValue(
    sideMenuProps?.color,
    defaultConfig?.sideMenuIconColor ?? defaultConfig?.iconColor ?? "#111827",
  );

  // ── Logo ──────────────────────────────────────────────────────────────────
  // Standalone: fall back to defaultConfig?.logoEnabled / logoImage
  const logoEnabled = resolveBoolean(
    props?.enableLogo,
    isStandalone ? (defaultConfig?.logoEnabled ?? defaultConfig?.enableLogo ?? true) : true,
  );
  const logoImage = unwrapValue(
    props?.logoImage,
    isStandalone ? (defaultConfig?.logoImage ?? defaultConfig?.logo ?? "") : "",
  );
  const [logoSource, setLogoSource] = React.useState(() => resolveLogoSource(logoImage));

  React.useEffect(() => {
    setLogoSource(resolveLogoSource(logoImage));
  }, [logoImage]);

  // ── Header text ──────────────────────────────────────────────────────────
  // Standalone: show text when defaultConfig has a title or explicitly enabled
  const headerTextEnabled = resolveBoolean(
    props?.enableheaderText ?? props?.enableHeaderText,
    isStandalone
      ? resolveBoolean(
          defaultConfig?.enableHeaderText ?? defaultConfig?.showTitle,
          !!defaultConfig?.title,
        )
      : false,
  );
  const headerTextValue = unwrapValue(
    props?.headerText,
    isStandalone ? (defaultConfig?.title ?? defaultConfig?.headerText ?? "") : "",
  );
  const headerTextSize = unwrapValue(
    props?.headerTextSize,
    isStandalone ? (defaultConfig?.fontSize ?? defaultConfig?.titleFontSize ?? 14) : 14,
  );
  const headerTextColor = unwrapValue(
    props?.headerTextColor,
    defaultConfig?.textColor ?? defaultConfig?.titleColor ?? "#0C1C2C",
  );
  const headerTextBold = resolveBoolean(
    props?.headerTextBold,
    isStandalone ? resolveBoolean(defaultConfig?.bold ?? defaultConfig?.titleBold, false) : false,
  );
  const headerTextItalic = resolveBoolean(props?.headerTextItalic, false);
  const headerTextUnderline = resolveBoolean(props?.headerTextUnderline, false);
  const headerTextStrikethrough = resolveBoolean(props?.headerTextStrikethrough, false);
  const headerTextDecorationLine = resolveTextDecorationLine({
    underline: headerTextUnderline,
    strikethrough: headerTextStrikethrough,
  });
  const headerTextAlign = String(
    unwrapValue(
      props?.headerTextAlign,
      isStandalone ? (defaultConfig?.textAlign ?? defaultConfig?.titleAlign ?? "center") : "center",
    ),
  ).toLowerCase();
  const headerFontFamily = unwrapValue(
    props?.headerFontFamily,
    isStandalone ? (defaultConfig?.fontFamily ?? undefined) : undefined,
  );
  const headerFontWeight = resolveFontWeight(
    props?.headerFontWeight,
    isStandalone
      ? resolveFontWeight(defaultConfig?.fontWeight ?? defaultConfig?.titleFontWeight, headerTextBold ? "700" : "400")
      : headerTextBold ? "700" : "400",
  );
  const logoAlignment = resolveLogoAlignment(props?.logoAlign);
  const logoSlotFlexDirection = normalizedLayout.logoSlot?.flexDirection || "column";
  const logoSlotAlignmentStyle = resolveLogoSlotAlignmentStyle(
    logoAlignment,
    logoSlotFlexDirection,
  );

  const headerTextStyle = {
    fontSize: headerTextSize,
    color: headerTextColor,
    fontWeight: headerTextBold ? "700" : headerFontWeight,
    fontStyle: headerTextItalic ? "italic" : "normal",
    textDecorationLine: headerTextDecorationLine,
    textAlign: headerTextAlign,
    fontFamily: headerFontFamily,
  };

  const cartProps = props?.cart?.properties || props?.cart || {};
  // ── Cart ──────────────────────────────────────────────────────────────────
  const cartVisible = defaultConfig?.showCart !== undefined
    ? Boolean(defaultConfig.showCart)
    : resolveBoolean(cartProps?.visible, true);
  const cartIconName = normalizeIconName(
    unwrapValue(cartProps?.iconId, isStandalone ? (defaultConfig?.cartIcon ?? "cart-shopping") : "cart-shopping"),
  );
  const cartIconSize = unwrapValue(
    cartProps?.width,
    isStandalone ? (defaultConfig?.cartIconSize ?? defaultConfig?.iconSize ?? 18) : 18,
  );
  const cartIconColor = unwrapValue(
    cartProps?.color,
    defaultConfig?.cartIconColor ?? defaultConfig?.iconColor ?? "#016D77",
  );
  const cartShowBadge = resolveBoolean(cartProps?.showBadge, false);
  const shouldShowCartBadge = safeCartCount > 0 || cartShowBadge;

  // ── Notification / Bell ───────────────────────────────────────────────────
  const notificationProps = props?.notification?.properties || props?.notification || {};
  const notificationVisible = showNotification === false
    ? false
    : defaultConfig?.showBell !== undefined
      ? Boolean(defaultConfig.showBell)
      : resolveBoolean(notificationProps?.visible, true);
  const notificationIconName = normalizeIconName(
    unwrapValue(notificationProps?.iconId, isStandalone ? (defaultConfig?.bellIcon ?? "bell") : "bell"),
  );
  const notificationIconSize = unwrapValue(
    notificationProps?.width,
    isStandalone ? (defaultConfig?.bellIconSize ?? defaultConfig?.iconSize ?? 18) : 18,
  );
  const notificationIconColor = unwrapValue(
    notificationProps?.color,
    defaultConfig?.bellIconColor ?? defaultConfig?.iconColor ?? "#016D77",
  );
  const notificationShowBadge = resolveBoolean(notificationProps?.showBadge, false);

  const badgeStyle = normalizedLayout.badge || {};
  const badgeStyleHasSize = [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "padding",
    "paddingHorizontal",
    "paddingVertical",
  ].some((key) => badgeStyle?.[key] !== undefined);
  const badgeTextOverrides = {
    color: badgeStyle?.color,
    fontSize: badgeStyle?.fontSize,
    fontWeight: badgeStyle?.fontWeight,
    fontStyle: badgeStyle?.fontStyle,
    lineHeight: badgeStyle?.lineHeight,
    letterSpacing: badgeStyle?.letterSpacing,
    textAlign: badgeStyle?.textAlign,
    textAlignVertical: badgeStyle?.textAlignVertical,
  };

  const resolveBottomNavItems = (rawSection) => {
    if (!rawSection) return [];
    const rawProps =
      rawSection?.props || rawSection?.properties?.props?.properties || rawSection?.properties?.props || {};
    const raw = unwrapValue(rawProps?.raw, {});
    let items = unwrapValue(raw?.items, undefined);
    if (!items) {
      items = unwrapValue(rawProps?.items, []);
    }
    if (items?.value && Array.isArray(items.value)) return items.value;
    return Array.isArray(items) ? items : [];
  };

  const normalizeBottomNavTarget = (value) => String(value || "").trim().toLowerCase();

  const resolveBottomNavIndex = (items, target) => {
    const normalizedTarget = normalizeBottomNavTarget(target);
    if (!normalizedTarget) return -1;
    return items.findIndex((item) => {
      const id = normalizeBottomNavTarget(item?.id);
      const label = normalizeBottomNavTarget(
        item?.label ?? item?.title ?? item?.name ?? item?.text ?? item?.value,
      );
      return id.includes(normalizedTarget) || label.includes(normalizedTarget);
    });
  };

  const openBottomNavTarget = async (target) => {
    if (target === "cart") {
      const blocked = await requireLoginForAction({ session, navigation });
      if (blocked) return;
    }
    const items = resolveBottomNavItems(bottomNavSection);
    const fallbackIndex = target === "cart" ? 1 : 2;
    const resolvedIndex = resolveBottomNavIndex(items, target);
    const activeIndex = resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
    const item = items[activeIndex];
    const title =
      item?.label ||
      item?.title ||
      item?.name ||
      (target === "cart" ? "Cart" : "Notifications");
    const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
    const link = typeof rawLink === "string" ? rawLink.replace(/^\//, "") : "";
    const params = {
      title,
      link,
      activeIndex,
      bottomNavSection,
    };
    navigation.dispatch(StackActions.replace("BottomNavScreen", params));
  };

  const headerBorderColor = props.style?.properties?.borderColor?.value;
  const headerBorderWidth =
    props.style?.properties?.borderWidth?.value ?? (headerBorderColor ? 1 : 0);
  const headerMinHeight = resolveMinHeight(
    props.style?.properties?.minHeight?.value,
    styles.container.minHeight,
  );

  // If headerdefault.enabled is false, don't render the header at all
  if (isStandalone && defaultConfig?.enabled === false) return null;

  const shouldShowHeaderText = headerTextEnabled && headerTextValue;
  const shouldShowLogo = logoEnabled && logoSource && !shouldShowHeaderText;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
          props.style?.properties?.backgroundColor?.value ??
          defaultConfig?.backgroundColor ??
          defaultConfig?.bgColor,
          minHeight: headerMinHeight,
          padding: convertPadding(props.style?.properties?.padding?.value),
          borderColor: headerBorderColor,
          borderWidth: headerBorderWidth,
          flexDirection: "row",
          justifyContent: normalizedLayout.container?.justifyContent || "space-between",
          alignItems: normalizedLayout.container?.alignItems || "center",
        }
      ]}
    >
      {/* LEFT ICON — back arrow on detail screens, hamburger on primary screens */}
      <View style={[styles.leftSlot, normalizedLayout.leftSlot]}>
        {/* Back arrow: show when caller explicitly passes showBack={true},
            OR when standalone (no DSL section) and navigation stack allows going back.
            Suppressed when caller passes showBack={false}. */}
        {showBack !== false && (showBack === true || isStandalone) && canGoBack ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
          >
            <Icon
              name="chevron-left"
              size={22}
              color={sideMenuIconColor || defaultConfig?.iconColor || "#111827"}
            />
          </TouchableOpacity>
        ) : (
          sideMenuVisible && hasSideNav && (
            <TouchableOpacity onPress={openSideMenu} activeOpacity={0.7}>
              <Icon
                name={sideMenuIconName}
                size={sideMenuIconSize}
                color={sideMenuIconColor}
              />
            </TouchableOpacity>
          )
        )}
      </View>

      {/* LOGO */}
      <View style={[styles.logoSlot, normalizedLayout.logoSlot, logoSlotAlignmentStyle]}>
        {shouldShowHeaderText ? (
          onTitlePress ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onTitlePress}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.logoText, headerTextStyle]} numberOfLines={1}>
                {headerTextValue}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.logoText, headerTextStyle]} numberOfLines={1}>
              {headerTextValue}
            </Text>
          )
        ) : shouldShowLogo ? (
          <Image
            source={logoSource}
            style={[styles.logoImage, logoImageStyle]}
            resizeMode="contain"
            onError={() => setLogoSource(null)}
          />
        ) : null}
      </View>

      {/* RIGHT ICONS */}
      <View style={[styles.rightSlot, normalizedLayout.rightSlot]}>
        {cartVisible && (
          <TouchableOpacity
            style={styles.iconWrapper}
            activeOpacity={0.7}
            onPress={() => openBottomNavTarget("cart")}
          >
            <Icon name={cartIconName} size={cartIconSize} color={cartIconColor} />
            {shouldShowCartBadge && (
              <View style={[styles.badge, badgeStyle]}>
                <Text
                  style={[
                    styles.badgeText,
                    { color: cartIconColor },
                    badgeTextOverrides,
                  ]}
                >
                  {formattedCartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {notificationVisible && (
          <TouchableOpacity
            style={styles.iconWrapper}
            activeOpacity={0.7}
            onPress={() => openBottomNavTarget("notification")}
          >
            <Icon
              name={notificationIconName}
              size={notificationIconSize}
              color={notificationIconColor}
            />
            {notificationShowBadge && (
              <View
                style={[
                  styles.notificationBadge,
                  badgeStyle,
                  !badgeStyleHasSize && styles.notificationBadgeCompact,
                ]}
              />
            )}
          </TouchableOpacity>
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

function resolveMinHeight(rawValue, fallback) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return fallback;
  }
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return Math.max(rawValue, fallback);
  }
  if (typeof rawValue === "string") {
    const parsed = Number.parseFloat(rawValue.replace("px", "").trim());
    if (Number.isFinite(parsed)) {
      return Math.max(parsed, fallback);
    }
  }
  return fallback;
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  leftSlot: { flexDirection: "row", alignItems: "center" },
  backBtn: { paddingRight: 4 },
  logoSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    textAlign: "center",
  },
  logoImage: { height: 26, width: 120 },
  rightSlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  iconWrapper: { position: "relative" },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    borderRadius: 0,
    backgroundColor: "transparent",
    minWidth: 0,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  badgeText: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textAlign: "center",
    textAlignVertical: "center",
    includeFontPadding: false,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    borderRadius: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  notificationBadgeCompact: {
    width: 10,
    height: 10,
    minWidth: 10,
    minHeight: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});

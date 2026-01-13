// components/Header.js
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import { useSideMenu } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { convertStyles } from "../utils/convertStyles";

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
  if (!logoImage) return LOCAL_LOGO_IMAGE;
  if (logoImage === "/images/mobidrag.png") return LOCAL_LOGO_IMAGE;
  return { uri: logoImage };
};

export default function Header({ section }) {
  const { toggleSideMenu, hasSideNav } = useSideMenu();
  const navigation = useNavigation();
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const quantity = Number(item?.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 1);
    }, 0)
  );
  const safeCartCount = Number.isFinite(cartCount) ? Math.max(0, cartCount) : 0;
  const formattedCartCount = safeCartCount > 99 ? "99+" : String(safeCartCount);

  const props = section?.props || section?.properties?.props?.properties || {};
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
  const bottomNavSection = section?.bottomNavSection || bottomNavigationStyle1Section;

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
  const [logoSource, setLogoSource] = React.useState(() => resolveLogoSource(logoImage));

  React.useEffect(() => {
    setLogoSource(resolveLogoSource(logoImage));
  }, [logoImage]);

  const headerTextEnabled = resolveBoolean(
    props?.enableheaderText ?? props?.enableHeaderText,
    false,
  );
  const headerTextValue = unwrapValue(props?.headerText, "");
  const headerTextSize = unwrapValue(props?.headerTextSize, 14);
  const headerTextColor = unwrapValue(props?.headerTextColor, "#0C1C2C");
  const headerTextBold = resolveBoolean(props?.headerTextBold, false);
  const headerTextItalic = resolveBoolean(props?.headerTextItalic, false);
  const headerTextUnderline = resolveBoolean(props?.headerTextUnderline, false);
  const headerTextAlign = String(unwrapValue(props?.headerTextAlign, "center")).toLowerCase();
  const headerFontFamily = unwrapValue(props?.headerFontFamily, undefined);
  const headerFontWeight = resolveFontWeight(
    props?.headerFontWeight,
    headerTextBold ? "700" : "400",
  );

  const headerTextStyle = {
    fontSize: headerTextSize,
    color: headerTextColor,
    fontWeight: headerTextBold ? "700" : headerFontWeight,
    fontStyle: headerTextItalic ? "italic" : "normal",
    textDecorationLine: headerTextUnderline ? "underline" : "none",
    textAlign: headerTextAlign,
    fontFamily: headerFontFamily,
  };

  const cartProps = props?.cart?.properties || props?.cart || {};
  const cartVisible = resolveBoolean(cartProps?.visible, true);
  const cartIconName = normalizeIconName(unwrapValue(cartProps?.iconId, "cart-shopping"));
  const cartIconSize = unwrapValue(cartProps?.width, 18);
  const cartIconColor = unwrapValue(cartProps?.color, "#016D77");
  const cartShowBadge = resolveBoolean(cartProps?.showBadge, false);
  const shouldShowCartBadge = safeCartCount > 0 || cartShowBadge;

  const notificationProps = props?.notification?.properties || props?.notification || {};
  const notificationVisible = resolveBoolean(notificationProps?.visible, true);
  const notificationIconName = normalizeIconName(
    unwrapValue(notificationProps?.iconId, "bell"),
  );
  const notificationIconSize = unwrapValue(notificationProps?.width, 18);
  const notificationIconColor = unwrapValue(notificationProps?.color, "#016D77");
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

  const openBottomNavTarget = (target) => {
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: props.style?.properties?.backgroundColor?.value,
          minHeight: props.style?.properties?.minHeight?.value,
          padding: convertPadding(props.style?.properties?.padding?.value),
          borderColor: headerBorderColor,
          borderWidth: headerBorderWidth,
          flexDirection: "row",
          justifyContent: normalizedLayout.container?.justifyContent || "space-between",
          alignItems: normalizedLayout.container?.alignItems || "center",
        }
      ]}
    >
      {/* LEFT ICON */}
      <View style={[styles.leftSlot, normalizedLayout.leftSlot]}>
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
      <View style={[styles.logoSlot, normalizedLayout.logoSlot]}>
        {!logoEnabled && headerTextValue ? (
          <Text style={[styles.logoText, headerTextStyle]} numberOfLines={1}>
            {headerTextValue}
          </Text>
        ) : logoEnabled && logoSource ? (
          <Image
            source={logoSource}
            style={[styles.logoImage, logoImageStyle]}
            resizeMode="contain"
            onError={() => setLogoSource(LOCAL_LOGO_IMAGE)}
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

const styles = StyleSheet.create({
  container: {
    position: "relative",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  leftSlot: { flex: 1, flexDirection: "row", alignItems: "center" },
  logoSlot: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    textAlign: "center",
  },
  logoImage: { height: 26, width: 120 },
  rightSlot: {
    flex: 1,
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

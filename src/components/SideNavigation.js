import React, { useCallback, useMemo } from "react";
import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";

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

const asBoolean = (value, fallback = true) => {
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

const normalizeIconName = (name) => {
  if (!name) return "circle";
  const cleaned = String(name).replace(/^fa[srldb]?[-_]?/, "");
  return cleaned || "circle";
};

const isLogoutItem = (item) =>
  String(item?.label || item?.title || "").trim().toLowerCase() === "logout";

const resolveLogoSource = (logoUrl) => {
  if (!logoUrl) return null;
  if (logoUrl === "/images/mobidrag.png") return LOCAL_LOGO_IMAGE;
  return { uri: logoUrl };
};

const buildRawProps = (rawProps = {}) => {
  const rawBlock = unwrapValue(rawProps.raw, {});
  if (rawBlock && typeof rawBlock === "object" && rawBlock.value !== undefined) {
    return rawBlock.value;
  }
  return rawBlock || {};
};

const extractPresentation = (section = {}) => {
  const fromSection =
    section.presentation ||
    section.properties?.presentation?.properties ||
    section.properties?.presentation ||
    {};

  const css = fromSection.css?.properties || fromSection.css || {};
  return {
    drawer: convertStyles(css.drawer || {}),
    headerRow: convertStyles(css.headerRow || {}),
    itemRow: convertStyles(css.itemRow || {}),
    itemIcon: convertStyles(css.itemIcon || {}),
    itemText: convertStyles(css.itemText || {}),
  };
};

export default function SideNavigation({ section }) {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const rawProps =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section);

  const itemsArray = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.items?.items)
      ? raw.items.items
      : Array.isArray(rawProps?.items)
        ? rawProps.items
        : [];

  const visibility = raw?.visibility || {};
  const showHeader = asBoolean(visibility.header, true);
  const showItems = asBoolean(visibility.items, true);
  const showLogo = asBoolean(visibility.headerLogo ?? visibility.logo, true);
  const showItemIcons = asBoolean(visibility.itemsIcons, true);
  const showItemText = asBoolean(visibility.itemsText, true);
  const backgroundImage = unwrapValue(raw?.bgImage || raw?.backgroundImageUrl, "");
  const backgroundFit = unwrapValue(raw?.bgImageFit, "cover");

  const paddingStyles = convertStyles({
    paddingTop: raw?.pt ?? raw?.paddingTop,
    paddingBottom: raw?.pb ?? raw?.paddingBottom,
    paddingLeft: raw?.pl ?? raw?.paddingLeft,
    paddingRight: raw?.pr ?? raw?.paddingRight,
  });

  const drawerStyle = [
    styles.drawer,
    presentation.drawer,
    backgroundImage ? styles.drawerWithBackground : null,
    backgroundImage ? { backgroundColor: "transparent" } : { backgroundColor: raw?.bgColor },
  ];

  const headerTitle = unwrapValue(raw?.headerTitle, "Mobidrag");
  const subtitle = unwrapValue(raw?.subtitle, "");
  const logoUrl = unwrapValue(raw?.logoUrl, "");
  const logoSource = logoUrl ? resolveLogoSource(logoUrl) : LOCAL_LOGO_IMAGE;

  const itemIconColor = raw?.iconColor || presentation.itemIcon?.color || "#111827";
  const itemIconSize = unwrapValue(raw?.iconSize, presentation.itemIcon?.width || 18);
  const itemTextColor = raw?.itemColor || presentation.itemText?.color || "#111827";

  if (!showHeader && !showItems) return null;

  const DrawerWrapper = backgroundImage ? ImageBackground : View;
  const items = useMemo(
    () =>
      [
        ...itemsArray,
        !itemsArray.some((item) => isLogoutItem(item))
          ? { id: "logout", label: "Logout", icon: "right-from-bracket" }
          : null,
      ].filter(Boolean),
    [itemsArray]
  );

  const handleItemPress = useCallback(
    async (item) => {
      if (!isLogoutItem(item)) return;
      await logout();
      navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
    },
    [logout, navigation]
  );

  return (
    <DrawerWrapper
      source={backgroundImage ? { uri: backgroundImage } : undefined}
      style={drawerStyle}
      imageStyle={backgroundImage ? [styles.drawerImage, presentation.drawer] : undefined}
      resizeMode={backgroundImage ? backgroundFit : undefined}
    >
      <View style={[styles.drawerContent, paddingStyles]}>
        {showHeader && (
          <View style={[styles.headerRow, presentation.headerRow]}>
            {showLogo && logoSource ? <Image source={logoSource} style={styles.logoImage} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {headerTitle}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
          </View>
        )}

        {showItems &&
          items.map((item) => (
            <TouchableOpacity
              key={item.id || item.label}
              style={[styles.itemRow, presentation.itemRow]}
              onPress={() => handleItemPress(item)}
              accessibilityRole="button"
              accessibilityLabel={item.label || item.title}
              activeOpacity={0.7}
            >
              {showItemIcons && (
                <Icon
                  name={normalizeIconName(item.icon)}
                  size={itemIconSize}
                  color={itemIconColor}
                  style={[styles.itemIcon, presentation.itemIcon]}
                />
              )}
              {showItemText && (
                <Text
                  style={[styles.itemText, presentation.itemText, { color: itemTextColor }]}
                  numberOfLines={1}
                >
                  {item.label || item.title}
                </Text>
              )}
            </TouchableOpacity>
          ))}
      </View>
    </DrawerWrapper>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: "100%",
    minWidth: 260,
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
  },
  drawerWithBackground: {
    overflow: "hidden",
  },
  drawerImage: {
    width: "100%",
    height: "100%",
  },
  drawerContent: {
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  itemIcon: {
    width: 18,
    height: 18,
  },
  itemText: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
  },
});

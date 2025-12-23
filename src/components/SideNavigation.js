import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { convertStyles } from "../utils/convertStyles";

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

  const drawerStyle = [
    styles.drawer,
    presentation.drawer,
    convertStyles({
      paddingTop: raw?.pt ?? raw?.paddingTop,
      paddingBottom: raw?.pb ?? raw?.paddingBottom,
      paddingLeft: raw?.pl ?? raw?.paddingLeft,
      paddingRight: raw?.pr ?? raw?.paddingRight,
      backgroundColor: raw?.bgColor,
      backgroundImage: raw?.bgImage,
    }),
  ];

  const headerTitle = unwrapValue(raw?.headerTitle, "Side Navigation");
  const logoUrl = unwrapValue(raw?.logoUrl, "");
  const logoText = unwrapValue(raw?.logoText, "");

  const itemIconColor = raw?.iconColor || presentation.itemIcon?.color || "#111827";
  const itemIconSize = unwrapValue(raw?.iconSize, presentation.itemIcon?.width || 18);
  const itemTextColor = raw?.itemColor || presentation.itemText?.color || "#111827";

  if (!showHeader && !showItems) return null;

  return (
    <View style={drawerStyle}>
      {showHeader && (
        <View style={[styles.headerRow, presentation.headerRow]}>
          {showLogo && logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : null}
          {showLogo && !logoUrl && logoText ? (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{logoText}</Text>
            </View>
          ) : null}
          <Text style={styles.headerTitle} numberOfLines={1}>
            {headerTitle}
          </Text>
        </View>
      )}

      {showItems && itemsArray.map((item) => (
        <View key={item.id || item.label} style={[styles.itemRow, presentation.itemRow]}>
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
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: 260,
    padding: 16,
    backgroundColor: "#FFFFFF",
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
    flex: 1,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
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

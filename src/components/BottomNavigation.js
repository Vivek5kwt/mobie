import React, { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
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

const resolveItemIcon = (item = {}) => {
  if (!item) return "";
  const rawIcon = item.iconName ?? item.icon ?? item.iconId ?? item.iconKey;
  if (rawIcon && typeof rawIcon === "object") {
    return unwrapValue(rawIcon, "");
  }
  return rawIcon;
};

const resolveItemLabel = (item = {}) =>
  item?.label ?? item?.title ?? item?.name ?? item?.text ?? item?.value ?? "";

const resolveItemLink = (item = {}) => {
  if (!item) return "";
  if (typeof item.link === "string") return item.link.trim();
  if (typeof item.href === "string") return item.href.trim();
  if (typeof item.url === "string") return item.url.trim();
  return "";
};

const buildRawProps = (rawProps = {}) => {
  const rawBlock = unwrapValue(rawProps.raw, {});
  if (rawBlock && typeof rawBlock === "object" && rawBlock.value !== undefined) {
    return rawBlock.value;
  }
  return rawBlock || {};
};

const extractPresentation = (section = {}) => {
  const fromProps =
    section?.properties?.props?.properties?.presentation?.properties ||
    section?.properties?.props?.properties?.presentation ||
    section?.properties?.props?.properties?.layout?.properties ||
    section?.properties?.props?.properties?.layout ||
    {};

  const css = fromProps.css?.properties || fromProps.css || {};

  return {
    container: convertStyles(css.container || {}),
    row: convertStyles(css.row || {}),
    item: convertStyles(css.item || {}),
    icon: convertStyles(css.icon || {}),
    label: convertStyles(css.label || {}),
  };
};

const resolveItems = (rawProps = {}, raw = {}) => {
  const itemsFromRaw = unwrapValue(raw?.items, []);
  if (Array.isArray(itemsFromRaw)) return itemsFromRaw;

  const itemsFromProps = unwrapValue(rawProps.items, []);
  if (Array.isArray(itemsFromProps)) return itemsFromProps;

  if (Array.isArray(itemsFromProps?.value)) return itemsFromProps.value;

  return [];
};

const resolveActiveIndex = (items = [], rawProps = {}, raw = {}) => {
  const fromProps = unwrapValue(rawProps?.activeIndex, raw?.activeIndex);
  const parsed = Number(fromProps);
  if (!Number.isNaN(parsed)) return parsed;

  const activeItemIndex = items.findIndex(
    (item) =>
      asBoolean(item?.active, false) ||
      asBoolean(item?.isActive, false) ||
      asBoolean(item?.selected, false)
  );
  if (activeItemIndex >= 0) return activeItemIndex;

  return 0;
};

const clampIndex = (index, count) => {
  if (!count || Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(index, count - 1));
};

const resolveNavigationTarget = (item = {}) => {
  const link = resolveItemLink(item);
  const label = resolveItemLabel(item);
  const id = item?.id ? String(item.id) : "";
  const fallbackLabel = label || id || "Destination";

  if (!link) {
    if (id.toLowerCase() === "home" || label.toLowerCase() === "home") {
      return { type: "stack", name: "LayoutScreen" };
    }
    return { type: "stack", name: "BottomNavScreen", params: { title: fallbackLabel } };
  }

  if (/^https?:\/\//i.test(link)) {
    return { type: "external", url: link };
  }

  const cleaned = link.replace(/^\//, "");
  if (cleaned.toLowerCase() === "home") {
    return { type: "stack", name: "LayoutScreen" };
  }

  return {
    type: "stack",
    name: "BottomNavScreen",
    params: { title: fallbackLabel, link: cleaned },
  };
};

export default function BottomNavigation({ section, activeIndexOverride }) {
  const navigation = useNavigation();
  const componentName =
    section?.component || section?.properties?.component?.const || section?.properties?.component;
  const isStyle2 = String(componentName || "").toLowerCase() === "bottom_navigation_style_2";
  const rawProps =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section);

  const items = useMemo(() => resolveItems(rawProps, raw), [rawProps, raw]);

  const visibility = unwrapValue(rawProps.visibility, raw?.visibility || {});
  const showIcons = asBoolean(visibility?.icons ?? raw?.showIcons, true);
  const showLabels = asBoolean(visibility?.labels ?? raw?.showText, true);
  const showBg = asBoolean(visibility?.bgPadding ?? raw?.showBg, true);
  const showActiveIndicator = asBoolean(
    visibility?.activeIndicator ?? raw?.showActiveIndicator,
    isStyle2
  );

  const indicatorMode = unwrapValue(
    raw?.indicatorMode,
    rawProps?.indicator?.properties?.mode?.value
  );
  const textActiveColor =
    raw?.textActiveColor || unwrapValue(rawProps?.text?.properties?.activeColor, "#0F766E");
  const iconActiveColor =
    raw?.iconActiveColor ||
    unwrapValue(rawProps?.icons?.properties?.activeColor, textActiveColor);
  const iconPrimaryColor =
    raw?.iconPrimaryColor || unwrapValue(rawProps?.icons?.properties?.primaryColor, "#6B7280");
  const textPrimaryColor =
    raw?.textPrimaryColor || unwrapValue(rawProps?.text?.properties?.primaryColor, "#6B7280");

  const iconWidth = unwrapValue(raw?.iconWidth, raw?.iconHeight) || 20;
  const iconHeight = unwrapValue(raw?.iconHeight, iconWidth) || 20;
  const iconSize = Math.max(iconWidth, iconHeight);

  const fontSize = unwrapValue(raw?.textFontSize, rawProps?.text?.properties?.fontSize?.value) || 12;
  const fontFamily = unwrapValue(raw?.textFontFamily, rawProps?.text?.properties?.fontFamily?.value);
  const fontWeight =
    unwrapValue(raw?.textFontWeight, rawProps?.text?.properties?.fontWeight?.value) || "600";

  const itemWidth = unwrapValue(raw?.itemWidth, rawProps?.text?.properties?.itemWidth?.value);
  const itemHeight = unwrapValue(raw?.itemHeight, rawProps?.text?.properties?.itemHeight?.value) || 64;

  const paddingStyles = convertStyles({
    paddingTop: raw?.pt,
    paddingBottom: raw?.pb,
    paddingLeft: raw?.pl,
    paddingRight: raw?.pr,
  });

  const backgroundColor =
    raw?.bgColor || unwrapValue(rawProps?.backgroundAndPadding?.properties?.backgroundColor);

  const parsedActiveIndexOverride = Number(activeIndexOverride);
  const hasActiveIndexOverride = Number.isFinite(parsedActiveIndexOverride);
  const resolvedActiveIndex = clampIndex(
    hasActiveIndexOverride ? parsedActiveIndexOverride : resolveActiveIndex(items, rawProps, raw),
    items.length
  );
  const [activeIndex, setActiveIndex] = useState(resolvedActiveIndex);

  const indicatorColor = unwrapValue(raw?.indicatorColor, `${textActiveColor}22`);
  const indicatorSizeRaw = unwrapValue(raw?.indicatorSize, 24);
  const indicatorThickness = unwrapValue(raw?.indicatorThickness, 4);
  const maxIndicatorSize = Math.min(itemWidth, itemHeight) * 0.7;
  const indicatorSize = Math.min(indicatorSizeRaw, maxIndicatorSize);
  const normalizedIndicatorMode = String(indicatorMode || "").toLowerCase();
  const indicatorIsBubble = normalizedIndicatorMode === "bubble" || isStyle2;
  const indicatorIsLine = normalizedIndicatorMode === "line";
  const safeItemHeight = Number.isNaN(Number(itemHeight)) ? 0 : Number(itemHeight);
  const bubbleSize = Math.max(
    iconSize + 8,
    Math.min(
      safeItemHeight ? safeItemHeight - 12 : iconSize + 16,
      Math.max(iconSize + 14, indicatorSize || iconSize + 14)
    )
  );

  useEffect(() => {
    setActiveIndex(resolvedActiveIndex);
  }, [resolvedActiveIndex, items.length]);

  if (!items.length) return null;

  const handlePress = async (item, index) => {
    setActiveIndex(index);
    const target = resolveNavigationTarget(item);

    if (!target) return;

    if (target.type === "external") {
      try {
        const canOpen = await Linking.canOpenURL(target.url);
        if (canOpen) {
          await Linking.openURL(target.url);
        }
      } catch (error) {
        console.log("Failed to open link:", error);
      }
      return;
    }

    if (target.type === "stack" && target.name) {
      navigation.navigate(target.name, {
        ...target.params,
        activeIndex: index,
        bottomNavSection: section,
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        presentation.container,
        paddingStyles,
        showBg ? { backgroundColor } : { backgroundColor: "transparent" },
      ]}
    >
      <View style={[styles.row, presentation.row]}>
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const itemIconColor = isActive ? iconActiveColor : iconPrimaryColor;
          const itemTextColor = isActive ? textActiveColor : textPrimaryColor;

          return (
            <TouchableOpacity
              key={item.id || item.label || index}
              style={[
                styles.item,
                presentation.item,
                itemWidth ? { width: itemWidth } : styles.dynamicItem,
                { height: itemHeight },
              ]}
              activeOpacity={0.85}
              onPress={() => handlePress(item, index)}
            >
              {showIcons && (
                <View
                  style={[
                    styles.iconWrapper,
                    indicatorIsBubble && showActiveIndicator && isActive
                      ? {
                          backgroundColor: indicatorColor,
                          width: bubbleSize,
                          height: bubbleSize,
                          borderRadius: bubbleSize / 2,
                        }
                      : null,
                  ]}
                >
                  <Icon
                    name={normalizeIconName(resolveItemIcon(item))}
                    size={iconSize}
                    color={itemIconColor}
                    style={[styles.icon, presentation.icon]}
                  />
                </View>
              )}
              {showActiveIndicator && isActive && indicatorIsLine && (
                <View
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: indicatorColor,
                      width: indicatorSize,
                      height: indicatorIsLine ? indicatorThickness : indicatorSize,
                      borderRadius: indicatorIsLine ? indicatorThickness / 2 : indicatorSize / 2,
                    },
                  ]}
                />
              )}
              {showLabels && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    presentation.label,
                    {
                      color: itemTextColor,
                      fontSize,
                      fontFamily,
                      fontWeight,
                    },
                  ]}
                >
                  {resolveItemLabel(item)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.04)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
  },
  dynamicItem: {
    flex: 1,
  },
  icon: {
    lineHeight: 1,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    marginTop: 6,
    fontWeight: "600",
  },
  indicator: {
    alignSelf: "center",
    marginTop: 4,
  },
});

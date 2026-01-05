import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    (item) => item?.active === true || item?.isActive === true || item?.selected === true
  );
  if (activeItemIndex >= 0) return activeItemIndex;

  return 0;
};

const clampIndex = (index, count) => {
  if (!count || Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(index, count - 1));
};

export default function BottomNavigation({ section }) {
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
    true
  );

  const iconActiveColor =
    raw?.iconActiveColor || unwrapValue(rawProps?.icons?.properties?.activeColor, "#111827");
  const iconPrimaryColor =
    raw?.iconPrimaryColor || unwrapValue(rawProps?.icons?.properties?.primaryColor, "#6B7280");
  const textActiveColor =
    raw?.textActiveColor || unwrapValue(rawProps?.text?.properties?.activeColor, "#111827");
  const textPrimaryColor =
    raw?.textPrimaryColor || unwrapValue(rawProps?.text?.properties?.primaryColor, "#6B7280");

  const iconWidth = unwrapValue(raw?.iconWidth, raw?.iconHeight) || 20;
  const iconHeight = unwrapValue(raw?.iconHeight, iconWidth) || 20;
  const iconSize = Math.max(iconWidth, iconHeight);

  const fontSize = unwrapValue(raw?.textFontSize, rawProps?.text?.properties?.fontSize?.value) || 13;
  const fontFamily = unwrapValue(raw?.textFontFamily, rawProps?.text?.properties?.fontFamily?.value);
  const fontWeight = unwrapValue(raw?.textFontWeight, rawProps?.text?.properties?.fontWeight?.value);

  const itemWidth = unwrapValue(raw?.itemWidth, rawProps?.text?.properties?.itemWidth?.value) || 72;
  const itemHeight = unwrapValue(raw?.itemHeight, rawProps?.text?.properties?.itemHeight?.value) || 56;

  const paddingStyles = convertStyles({
    paddingTop: raw?.pt,
    paddingBottom: raw?.pb,
    paddingLeft: raw?.pl,
    paddingRight: raw?.pr,
  });

  const backgroundColor =
    raw?.bgColor || unwrapValue(rawProps?.backgroundAndPadding?.properties?.backgroundColor);

  const resolvedActiveIndex = clampIndex(resolveActiveIndex(items, rawProps, raw), items.length);
  const [activeIndex, setActiveIndex] = useState(resolvedActiveIndex);

  const indicatorColor = unwrapValue(raw?.indicatorColor, "#00000022");
  const indicatorSize = unwrapValue(raw?.indicatorSize, 36);

  useEffect(() => {
    setActiveIndex(resolvedActiveIndex);
  }, [resolvedActiveIndex, items.length]);

  if (!items.length) return null;

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
          const indicatorOffset = Math.max(0, (itemHeight - indicatorSize) / 2);

          return (
            <TouchableOpacity
              key={item.id || item.label || index}
              style={[
                styles.item,
                presentation.item,
                { width: itemWidth, height: itemHeight },
              ]}
              activeOpacity={0.85}
              onPress={() => setActiveIndex(index)}
            >
              {showActiveIndicator && isActive && (
                <View
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: indicatorColor,
                      width: indicatorSize,
                      height: indicatorSize,
                      borderRadius: indicatorSize / 2,
                      top: indicatorOffset,
                    },
                  ]}
                />
              )}
              {showIcons && (
                <Icon
                  name={normalizeIconName(item.icon)}
                  size={iconSize}
                  color={itemIconColor}
                  style={[styles.icon, presentation.icon]}
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
                  {item.label}
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
  icon: {
    lineHeight: 1,
  },
  label: {
    marginTop: 4,
    fontWeight: "700",
  },
  indicator: {
    position: "absolute",
    alignSelf: "center",
  },
});

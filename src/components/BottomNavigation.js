import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { convertStyles } from "../utils/convertStyles";
import { useSideMenu } from "../services/SideMenuContext";

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
  
  // Also check raw.layout.css structure
  const rawProps = section?.props || section?.properties?.props?.properties || section?.properties?.props || {};
  const raw = buildRawProps(rawProps);
  const rawLayoutCss = raw?.layout?.css || {};

  return {
    container: convertStyles(css.container || rawLayoutCss.container || {}),
    row: convertStyles(css.row || rawLayoutCss.row || {}),
    item: convertStyles(css.item || rawLayoutCss.item || {}),
    icon: convertStyles(css.icon || rawLayoutCss.icon || {}),
    label: convertStyles(css.label || rawLayoutCss.label || {}),
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

const resolveActiveIndex = (items = [], rawProps = {}, raw = {}, currentActiveIndex = null) => {
  // If we have a current activeIndex and it's still valid, preserve it during refresh
  if (currentActiveIndex !== null && currentActiveIndex >= 0 && currentActiveIndex < items.length) {
    return currentActiveIndex;
  }
  
  const fromProps = unwrapValue(rawProps?.activeIndex, raw?.activeIndex);
  const parsed = Number(fromProps);
  if (!Number.isNaN(parsed) && parsed >= 0 && parsed < items.length) return parsed;

  const activeItemIndex = items.findIndex(
    (item) =>
      asBoolean(item?.active, false) ||
      asBoolean(item?.isActive, false) ||
      asBoolean(item?.selected, false)
  );
  if (activeItemIndex >= 0) return activeItemIndex;

  // Check activeId from raw props
  const activeId = unwrapValue(raw?.activeId, "");
  if (activeId) {
    const idIndex = items.findIndex((item) => {
      const itemId = String(item?.id || "").toLowerCase();
      return itemId === String(activeId).toLowerCase();
    });
    if (idIndex >= 0) return idIndex;
  }

  return 0;
};

const clampIndex = (index, count) => {
  if (!count || Number.isNaN(index)) return 0;
  return Math.max(0, Math.min(index, count - 1));
};

const isHttpUrl = (url = "") => /^https?:\/\//i.test(String(url));

const slugifyPageName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveNavigationTarget = (item = {}) => {
  const link = resolveItemLink(item);
  const label = resolveItemLabel(item);
  const id = item?.id ? String(item.id) : "";
  const fallbackLabel = label || id || "Destination";
  const pageName = slugifyPageName(id || label || "");

  if (!link) {
    if (id.toLowerCase() === "home" || label.toLowerCase() === "home") {
      return { type: "stack", name: "LayoutScreen", params: { pageName: "home" } };
    }
    return {
      type: "stack",
      name: "BottomNavScreen",
      params: { title: fallbackLabel, pageName },
    };
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
    params: { title: fallbackLabel, link: cleaned, pageName: cleaned || pageName },
  };
};

function BottomNavigation({ section, activeIndexOverride }) {
  const navigation = useNavigation();
  const { closeSideMenu, isOpen: isSideMenuOpen } = useSideMenu();
  const componentName =
    section?.component || section?.properties?.component?.const || section?.properties?.component;
  const isStyle2 = String(componentName || "").toLowerCase() === "bottom_navigation_style_2";
  const rawProps =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section);
  
  // Extract raw.layout.css for additional color overrides
  const rawLayoutCss = raw?.layout?.css || {};

  const items = useMemo(() => resolveItems(rawProps, raw), [rawProps, raw]);
  
  // Memoize icon names to prevent unnecessary re-renders when clicking home
  const iconNames = useMemo(() => {
    return items.map((item) => normalizeIconName(resolveItemIcon(item)));
  }, [items]);

  const visibility = unwrapValue(rawProps.visibility, raw?.visibility || {});
  const showIcons = asBoolean(visibility?.icons ?? raw?.showIcons, true);
  // Global label visibility setting - can be overridden per item
  const globalShowLabels = asBoolean(visibility?.labels ?? raw?.showText, true);
  const showBg = asBoolean(visibility?.bgPadding ?? raw?.showBg, true);
  const showActiveIndicator = asBoolean(
    visibility?.activeIndicator ?? raw?.showActiveIndicator,
    isStyle2
  );
  
  // Helper to determine if a specific item should show its label
  const shouldShowItemLabel = (item) => {
    // Check if item has its own showText or showLabel property
    const itemShowText = item?.showText ?? item?.showLabel;
    if (itemShowText !== undefined && itemShowText !== null) {
      return asBoolean(itemShowText, true);
    }
    // Fall back to global setting
    return globalShowLabels;
  };

  const indicatorMode = unwrapValue(
    raw?.indicatorMode,
    rawProps?.indicator?.properties?.mode?.value
  );
  
  // Extract colors from schema - check multiple possible locations including layout.css
  const textActiveColor =
    raw?.textActiveColor || 
    raw?.activeColor ||
    rawLayoutCss?.label?.color || // Check layout.css.label.color for active color
    unwrapValue(rawProps?.text?.properties?.activeColor?.value, "#0F766E") ||
    unwrapValue(rawProps?.text?.properties?.activeColor, "#0F766E");
    
  const iconActiveColor =
    raw?.iconActiveColor ||
    raw?.activeColor ||
    rawLayoutCss?.icon?.color || // Check layout.css.icon.color for active color
    unwrapValue(rawProps?.icons?.properties?.activeColor?.value, textActiveColor) ||
    unwrapValue(rawProps?.icons?.properties?.activeColor, textActiveColor) ||
    textActiveColor;
    
  const iconPrimaryColor =
    raw?.iconPrimaryColor || 
    raw?.inactiveColor ||
    rawLayoutCss?.icon?.color || // Check layout.css.icon.color (may be same for both states)
    unwrapValue(rawProps?.icons?.properties?.primaryColor?.value, "#9CA3AF") ||
    unwrapValue(rawProps?.icons?.properties?.primaryColor, "#9CA3AF") ||
    "#9CA3AF";
    
  const textPrimaryColor =
    raw?.textPrimaryColor || 
    raw?.labelColor ||
    rawLayoutCss?.label?.color || // Check layout.css.label.color (may be same for both states)
    unwrapValue(rawProps?.text?.properties?.primaryColor?.value, "#6B7280") ||
    unwrapValue(rawProps?.text?.properties?.primaryColor, "#6B7280") ||
    "#6B7280";

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
  
  // Initialize with resolvedActiveIndex to prevent layout shifts
  const [activeIndex, setActiveIndex] = useState(() => {
    if (hasActiveIndexOverride) {
      return clampIndex(parsedActiveIndexOverride, items.length);
    }
    return clampIndex(resolveActiveIndex(items, rawProps, raw, null), items.length);
  });

  // Recalculate resolvedActiveIndex, but preserve current activeIndex if valid
  // Use activeIndexRef to preserve the current index during refresh
  // This prevents the index from changing when items array reference changes
  const resolvedActiveIndex = useMemo(() => {
    if (hasActiveIndexOverride) {
      return clampIndex(parsedActiveIndexOverride, items.length);
    }
    // Always preserve the current activeIndex from ref during refresh
    // Only recalculate if the current index is invalid
    const currentIndex = activeIndexRef.current;
    if (currentIndex !== null && currentIndex !== undefined && currentIndex >= 0 && currentIndex < items.length) {
      return currentIndex; // Preserve current index - don't recalculate
    }
    // Only recalculate if current index is invalid
    return clampIndex(resolveActiveIndex(items, rawProps, raw, currentIndex), items.length);
  }, [hasActiveIndexOverride, parsedActiveIndexOverride, items.length]); // Only depend on length, not items array reference

  const indicatorColor = 
    raw?.indicatorColor ||
    unwrapValue(rawProps?.indicator?.properties?.color?.value, textActiveColor) ||
    unwrapValue(rawProps?.indicator?.properties?.color, textActiveColor) ||
    textActiveColor;
  const indicatorSizeRaw = 
    raw?.indicatorSize ||
    unwrapValue(rawProps?.indicator?.properties?.size?.value, 36) ||
    unwrapValue(rawProps?.indicator?.properties?.size, 36) ||
    36;
  const indicatorThickness = 
    raw?.indicatorThickness ||
    unwrapValue(rawProps?.indicator?.properties?.thickness?.value, 6) ||
    unwrapValue(rawProps?.indicator?.properties?.thickness, 6) ||
    6;
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

  // Store the current activeIndex in a ref to preserve it across DSL refreshes
  // Initialize ref with the initial activeIndex
  const activeIndexRef = useRef(activeIndex);
  
  // Update ref whenever activeIndex changes
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  
  // Initialize ref on mount if not already set
  useEffect(() => {
    if (activeIndexRef.current === null || activeIndexRef.current === undefined) {
      activeIndexRef.current = activeIndex;
    }
  }, []);

  // Sync activeIndex with props to prevent "pop up" effect when navigating
  // Preserve activeIndex during refresh to prevent home icon from changing
  useEffect(() => {
    // Only update if activeIndexOverride is provided (from navigation)
    // This ensures that when navigating, the correct index is set
    if (hasActiveIndexOverride) {
      const newIndex = clampIndex(parsedActiveIndexOverride, items.length);
      if (newIndex !== activeIndexRef.current) {
        setActiveIndex(newIndex);
        activeIndexRef.current = newIndex; // Update ref immediately
      }
    } else {
      // During refresh, preserve the current activeIndex if it's still valid
      // Only update if current index is invalid (out of bounds)
      const currentIndex = activeIndexRef.current;
      if (currentIndex < 0 || currentIndex >= items.length) {
        const newIndex = clampIndex(resolveActiveIndex(items, rawProps, raw, currentIndex), items.length);
        if (newIndex !== currentIndex) {
          setActiveIndex(newIndex);
        }
      }
      // Otherwise, keep the current activeIndex to prevent flashing during refresh
      // This is critical - we don't want to reset activeIndex just because DSL refreshed
    }
  }, [hasActiveIndexOverride, parsedActiveIndexOverride, items.length]);

  if (!items.length) return null;

  const handlePress = async (item, index) => {
    if (isSideMenuOpen) {
      closeSideMenu();
    }
    
    // Update activeIndex immediately to prevent flash
    setActiveIndex(index);
    
    const target = resolveNavigationTarget(item);

    if (!target) return;

    if (target.type === "external") {
      try {
        if (navigation?.navigate && isHttpUrl(target.url)) {
          navigation.navigate("CheckoutWebView", {
            url: target.url,
            title: resolveItemLabel(item) || "Web View",
          });
          return;
        }
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
      // 🚫 If we're already on LayoutScreen home and user taps the home tab again,
      // don't navigate / remount the screen. Just keep the active state.
      try {
        const navState = navigation.getState?.();
        const currentRoute =
          navState?.routes && typeof navState.index === "number"
            ? navState.routes[navState.index]
            : null;

        if (currentRoute && currentRoute.name === "LayoutScreen") {
          const currentPageName =
            (currentRoute.params?.pageName || "home").toString().trim().toLowerCase();
          const targetPageName =
            (target.params?.pageName || "home").toString().trim().toLowerCase();

          // Same screen + same pageName ("home") → do nothing (no loader, no refresh)
          if (currentPageName === "home" && targetPageName === "home") {
            return;
          }
        }
      } catch (e) {
        // If anything goes wrong reading navigation state, fall through to normal navigation
        console.log("BottomNavigation handlePress state check error:", e);
      }

      const params = {
        ...target.params,
        activeIndex: index, // Ensure activeIndex is passed
        bottomNavSection: section,
      };
      
      // Use replace to maintain navigation stack, but ensure activeIndex is set before navigation
      // This prevents the flash of wrong icon/color
      navigation.dispatch(StackActions.replace(target.name, params));
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
          // Use resolvedActiveIndex to ensure stable index during refresh
          const isActive = index === resolvedActiveIndex;
          // Use iconActiveColor for active state, iconPrimaryColor for inactive
          // This ensures colors are fully dynamic from the schema
          const itemIconColor = isActive ? iconActiveColor : iconPrimaryColor;
          const itemTextColor = isActive ? textActiveColor : textPrimaryColor;
          // Check per-item label visibility - dynamic based on JSON config
          const itemShowLabel = shouldShowItemLabel(item);
          
          // Extract colors from layout.css if available (these are the dynamic colors from schema)
          // layout.css.icon.color and layout.css.label.color are the primary sources
          const cssIconColor = presentation.icon?.color || rawLayoutCss?.icon?.color;
          const cssLabelColor = presentation.label?.color || rawLayoutCss?.label?.color;
          
          // For icons: Use active/inactive colors from schema, but CSS can override
          // If CSS provides a color, it applies to both states (unless we have separate active/inactive)
          const finalIconColor = isActive 
            ? (cssIconColor || iconActiveColor || "#096d70")
            : (cssIconColor || iconPrimaryColor || "#9CA3AF");
          
          // For labels: Use active/inactive colors from schema, but CSS can override
          const finalTextColor = isActive
            ? (cssLabelColor || textActiveColor || "#096d70")
            : (cssLabelColor || textPrimaryColor || "#6B7280");

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
                    key={`icon-${index}-${iconNames[index]}`}
                    name={iconNames[index] || "circle"}
                    size={iconSize}
                    color={finalIconColor}
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
              {itemShowLabel && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    presentation.label,
                    {
                      color: finalTextColor,
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
    // Prevent layout shifts and "pop up" effects
    minHeight: 64,
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

// Memoize the component to prevent unnecessary re-renders when clicking home
export default React.memo(BottomNavigation, (prevProps, nextProps) => {
  // Only re-render if section or activeIndexOverride actually changed
  // Use JSON.stringify for deep comparison of section
  const prevSectionStr = JSON.stringify(prevProps.section);
  const nextSectionStr = JSON.stringify(nextProps.section);
  const sectionChanged = prevSectionStr !== nextSectionStr;
  const activeIndexChanged = prevProps.activeIndexOverride !== nextProps.activeIndexOverride;
  
  // Return true if props are equal (don't re-render), false if different (re-render)
  return !sectionChanged && !activeIndexChanged;
});

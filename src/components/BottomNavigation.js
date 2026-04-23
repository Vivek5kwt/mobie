import React, { useEffect, useMemo, useState, useRef } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import Icon from "react-native-vector-icons/FontAwesome6";

const BOTTOM_NAV_DEBUG = __DEV__;
import { convertStyles } from "../utils/convertStyles";
import { useSideMenu } from "../services/SideMenuContext";

export const BOTTOM_NAV_RESERVED_HEIGHT = 80;

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

/** Unwrap schema prop that may be { type, value } or a primitive */
const getSchemaValue = (node, fallback = undefined) => {
  if (node === undefined || node === null) return fallback;
  if (typeof node === "object" && node !== null && "value" in node) return node.value;
  return node;
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
  if (Array.isArray(itemsFromRaw) && itemsFromRaw.length > 0) return itemsFromRaw;

  const navItemsFromRaw = unwrapValue(raw?.navItems, []);
  if (Array.isArray(navItemsFromRaw) && navItemsFromRaw.length > 0) return navItemsFromRaw;

  const itemsFromProps = unwrapValue(rawProps.items, []);
  if (Array.isArray(itemsFromProps) && itemsFromProps.length > 0) return itemsFromProps;

  const itemsValue = rawProps.items?.value ?? rawProps.items?.properties?.value;
  if (Array.isArray(itemsValue) && itemsValue.length > 0) return itemsValue;

  return [];
};

const resolveActiveIndex = (items = [], rawProps = {}, raw = {}, currentActiveIndex = null) => {
  if (currentActiveIndex !== null && currentActiveIndex >= 0 && currentActiveIndex < items.length) {
    return currentActiveIndex;
  }
  const fromProps = getSchemaValue(rawProps?.activeIndex) ?? unwrapValue(rawProps?.activeIndex, raw?.activeIndex);
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

const SIGNIN_SLUGS = new Set(["signin", "sign-in", "login", "log-in", "auth"]);

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
    // Sign-in slugs → Auth screen
    if (SIGNIN_SLUGS.has(pageName)) {
      return { type: "stack", name: "Auth" };
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
  const cleanedSlug = slugifyPageName(cleaned);
  if (cleaned.toLowerCase() === "home") {
    return { type: "stack", name: "LayoutScreen" };
  }
  // Sign-in links → Auth screen
  if (SIGNIN_SLUGS.has(cleanedSlug)) {
    return { type: "stack", name: "Auth" };
  }

  return {
    type: "stack",
    name: "BottomNavScreen",
    params: { title: fallbackLabel, link: cleaned, pageName: cleaned || pageName },
  };
};

function BottomNavigation({ section, activeIndexOverride }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { closeSideMenu, isOpen: isSideMenuOpen } = useSideMenu();
  const componentName =
    section?.component || section?.properties?.component?.const || section?.properties?.component;
  const isStyle2 = String(componentName || "").toLowerCase() === "bottom_navigation_style_2";
  const rawProps =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section);

  const cartItems = useSelector((state) => state.cart?.items || []);
  const cartCount = cartItems.reduce((sum, i) => sum + (i.quantity || 1), 0);

  const isCartItem = (item = {}) => {
    const icon = normalizeIconName(resolveItemIcon(item));
    const id = (item?.id || "").toString().trim().toLowerCase();
    const label = (resolveItemLabel(item) || "").toString().trim().toLowerCase();
    return icon === "cart-shopping" || id === "cart" || label === "cart";
  };
  
  // Extract raw.layout.css for additional color overrides
  const rawLayoutCss = raw?.layout?.css || {};

  const items = useMemo(() => resolveItems(rawProps, raw), [rawProps, raw]);

  /** Derive active index from navigator state (route name + params) so highlight matches current screen */
  const activeIndexFromState = useMemo(() => {
    const routeName = route?.name ?? "";
    const pageName = String(route?.params?.pageName ?? route?.params?.pageName ?? "home").trim().toLowerCase();
    const paramIndex = route?.params?.activeIndex;
    if (routeName === "LayoutScreen" && (pageName === "home" || !pageName)) return 0;
    if (routeName === "BottomNavScreen" && paramIndex !== undefined && paramIndex !== null) {
      const n = Number(paramIndex);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    if (!items.length) return 0;
    const slug = (id) => String(id ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const idx = items.findIndex(
      (item) =>
        slug(item?.id) === pageName ||
        slug(item?.label) === pageName ||
        slug(item?.link) === pageName
    );
    return idx >= 0 ? idx : 0;
  }, [route?.name, route?.params?.pageName, route?.params?.activeIndex, items]);

  // Memoize icon names to prevent unnecessary re-renders when clicking home
  const iconNames = useMemo(() => {
    return items.map((item) => normalizeIconName(resolveItemIcon(item)));
  }, [items]);

  const visibilityNode = rawProps.visibility ?? raw?.visibility ?? {};
  const visibility = typeof visibilityNode === "object" && visibilityNode.properties
    ? visibilityNode.properties
    : visibilityNode;
  const showIcons = asBoolean(
    getSchemaValue(visibility?.icons) ?? getSchemaValue(visibility?.icons) ?? raw?.showIcons ?? raw?.visibility?.icons,
    true
  );
  const globalShowLabels = asBoolean(
    getSchemaValue(visibility?.labels) ?? raw?.showText ?? raw?.visibility?.labels,
    true
  );
  const showBg = asBoolean(
    getSchemaValue(visibility?.bgPadding) ?? raw?.showBg ?? raw?.visibility?.bgPadding,
    true
  );
  const showActiveIndicator = asBoolean(
    getSchemaValue(visibility?.activeIndicator) ?? raw?.showActiveIndicator ?? raw?.visibility?.activeIndicator,
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

  const indicatorNode = rawProps?.indicator?.properties ?? rawProps?.indicator ?? {};
  const indicatorMode =
    raw?.indicatorMode ??
    getSchemaValue(indicatorNode?.mode) ??
    getSchemaValue(rawProps?.indicator?.properties?.mode);

  const textNode = rawProps?.text?.properties ?? rawProps?.text ?? {};
  const iconsNode = rawProps?.icons?.properties ?? rawProps?.icons ?? {};
  const bgPaddingNode = rawProps?.backgroundAndPadding?.properties ?? rawProps?.backgroundAndPadding ?? {};

  const textActiveColor =
    raw?.textActiveColor ??
    raw?.activeColor ??
    rawLayoutCss?.label?.color ??
    getSchemaValue(textNode?.activeColor) ??
    "#0F766E";

  const iconActiveColor =
    raw?.iconActiveColor ??
    raw?.activeColor ??
    rawLayoutCss?.icon?.color ??
    getSchemaValue(iconsNode?.activeColor) ??
    textActiveColor;

  const iconPrimaryColor =
    raw?.iconPrimaryColor ??
    raw?.inactiveColor ??
    rawLayoutCss?.icon?.color ??
    getSchemaValue(iconsNode?.primaryColor) ??
    "#9CA3AF";

  const textPrimaryColor =
    raw?.textPrimaryColor ??
    raw?.labelColor ??
    rawLayoutCss?.label?.color ??
    getSchemaValue(textNode?.primaryColor) ??
    "#6B7280";

  const iconWidth =
    Number(getSchemaValue(iconsNode?.width)) ||
    Number(raw?.iconWidth ?? raw?.iconHeight ?? raw?.iconFontSize) ||
    20;
  const iconHeight =
    Number(getSchemaValue(iconsNode?.height)) ||
    Number(raw?.iconHeight ?? raw?.iconWidth ?? raw?.iconFontSize) ||
    20;
  const iconSize = Math.max(iconWidth, iconHeight);

  const fontSize =
    Number(getSchemaValue(textNode?.fontSize)) ||
    Number(raw?.textFontSize) ||
    12;
  const fontFamily =
    getSchemaValue(textNode?.fontFamily) ?? raw?.textFontFamily;
  const fontWeight =
    String(getSchemaValue(textNode?.fontWeight) ?? raw?.textFontWeight ?? "600");

  const itemWidthRaw =
    Number(getSchemaValue(textNode?.itemWidth) ?? raw?.itemWidth);
  // 0 means "auto" (flex: 1); only use a fixed width when explicitly > 0
  const itemWidth = itemWidthRaw > 0 ? itemWidthRaw : undefined;
  const itemHeight =
    Number(getSchemaValue(textNode?.itemHeight) ?? raw?.itemHeight ?? raw?.layout?.css?.item?.height) ||
    60;

  const paddingRaw = bgPaddingNode?.paddingRaw?.properties ?? bgPaddingNode?.paddingRaw ?? raw;
  const paddingStyles = convertStyles({
    paddingTop: paddingRaw?.pt ?? raw?.pt,
    paddingBottom: paddingRaw?.pb ?? raw?.pb,
    paddingLeft: paddingRaw?.pl ?? raw?.pl,
    paddingRight: paddingRaw?.pr ?? raw?.pr,
  });

  const backgroundColor =
    raw?.bgColor ??
    getSchemaValue(bgPaddingNode?.backgroundColor) ??
    getSchemaValue(rawProps?.backgroundAndPadding?.properties?.backgroundColor);

  // Resolve borderRadius from DSL — must preserve 0 (square corners).
  // Do NOT use "|| undefined" because 0 is a valid, intentional value.
  const _rawBorderRadius =
    getSchemaValue(bgPaddingNode?.borderRadius) ?? raw?.borderRadius;
  const containerBorderRadius =
    _rawBorderRadius != null && !Number.isNaN(Number(_rawBorderRadius))
      ? Number(_rawBorderRadius)
      : undefined;

  // activeIndexOverride can be 0 (Home) - must treat as valid override
  const parsedActiveIndexOverride =
    activeIndexOverride !== undefined && activeIndexOverride !== null
      ? Number(activeIndexOverride)
      : NaN;
  const hasActiveIndexOverride = Number.isFinite(parsedActiveIndexOverride);

  const [activeIndex, setActiveIndex] = useState(() => {
    if (hasActiveIndexOverride) {
      return clampIndex(parsedActiveIndexOverride, items.length);
    }
    return clampIndex(resolveActiveIndex(items, rawProps, raw, null), items.length);
  });

  // Single source of truth for which tab is active: prefer parent override (including 0 for Home)
  const resolvedActiveIndex = useMemo(() => {
    if (hasActiveIndexOverride) {
      return clampIndex(parsedActiveIndexOverride, items.length);
    }
    // Avoid accessing activeIndexRef here (declared later) — derive directly from DSL
    return clampIndex(resolveActiveIndex(items, rawProps, raw, null), items.length);
  }, [hasActiveIndexOverride, parsedActiveIndexOverride, items, rawProps, raw]);

  // Display index: parent override ALWAYS wins (no flash on navigation), then local tap, then route
  const displayActiveIndex = useMemo(() => {
    if (hasActiveIndexOverride) {
      // Override from parent (e.g. activeIndex=0 for Home) — take it immediately, no flash
      return clampIndex(parsedActiveIndexOverride, items.length);
    }
    // Local tap state (immediate feedback when user presses a tab)
    if (activeIndex >= 0 && activeIndex < items.length) return activeIndex;
    // Route-derived fallback
    if (activeIndexFromState >= 0 && activeIndexFromState < items.length) return activeIndexFromState;
    return resolvedActiveIndex;
  }, [
    hasActiveIndexOverride,
    parsedActiveIndexOverride,
    activeIndex,
    activeIndexFromState,
    resolvedActiveIndex,
    items.length,
  ]);

  const indicatorColor =
    raw?.indicatorColor ??
    getSchemaValue(indicatorNode?.color) ??
    textActiveColor;
  const indicatorSizeRaw =
    Number(getSchemaValue(indicatorNode?.size) ?? raw?.indicatorSize) || 36;
  const indicatorThickness =
    Number(getSchemaValue(indicatorNode?.thickness) ?? raw?.indicatorThickness) || 6;
  const maxIndicatorSize = Math.min(itemWidth, itemHeight) * 0.7;
  const indicatorSize = Math.min(indicatorSizeRaw, maxIndicatorSize);
  const normalizedIndicatorMode = String(indicatorMode || "").toLowerCase();
  // Never force bubble mode — respect exactly what the DSL specifies.
  // isStyle2 is a layout variant, not an indicator shape override.
  const indicatorIsBubble = normalizedIndicatorMode === "bubble";
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

    // Tap on the tab that is already active = do nothing (no navigation, no refresh)
    if (index === displayActiveIndex) {
      return;
    }

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
      // Auth screen — navigate directly without extra params
      if (target.name === "Auth") {
        try { navigation.push("Auth"); } catch (_) { navigation.navigate("Auth"); }
        return;
      }

      // Pass bottomNavSection so BottomNavScreen can render the nav bar instantly
      // (without waiting for its own DSL fetch to complete)
      const params = {
        ...target.params,
        activeIndex: index,
        bottomNavSection: section,
      };

      const isGoingToHome =
        target.name === "LayoutScreen" &&
        (target.params?.pageName || "home").toString().trim().toLowerCase() === "home";

      try {
        const navState = navigation.getState?.();
        const routes = navState?.routes ?? [];
        const stateIndex = typeof navState?.index === "number" ? navState.index : 0;
        const currentRoute = routes[stateIndex] ?? null;

        if (BOTTOM_NAV_DEBUG) {
          console.log("[BottomNav] Tab press:", {
            routeSelected: target.name,
            pageName: target.params?.pageName,
            activeIndex: index,
            stateIndex,
            isGoingToHome,
            currentRoute: currentRoute?.name,
          });
        }

        // Already on this screen + same logical page → no op
        if (currentRoute?.name === target.name) {
          const currentPage = (currentRoute.params?.pageName ?? "home")
            .toString()
            .trim()
            .toLowerCase();
          const targetPage = (target.params?.pageName ?? "home")
            .toString()
            .trim()
            .toLowerCase();
          if (currentPage === targetPage) {
            if (BOTTOM_NAV_DEBUG) {
              console.log("[BottomNav] Already on target page, skipping navigation");
            }
            return;
          }
        }

        // ── Home tab ──────────────────────────────────────────────────────────
        // popToTop() instantly returns to the existing LayoutScreen root without
        // remounting it — no blank screen, no reload.
        // Only dispatch popToTop when the stack has more than one route; when the
        // stack is flat (single route) popToTop is unhandled and logs a warning.
        if (isGoingToHome) {
          if (currentRoute?.name === "LayoutScreen") {
            if (BOTTOM_NAV_DEBUG) {
              console.log("[BottomNav] Home tab tapped on Home screen – no navigation");
            }
            return;
          }
          if (routes.length > 1) {
            navigation.dispatch(StackActions.popToTop());
          } else {
            navigation.navigate("LayoutScreen", { pageName: "home", activeIndex: 0 });
          }
          return;
        }

        // ── Non-home tabs ─────────────────────────────────────────────────────
        // If we're ALREADY on BottomNavScreen, update params in-place via setParams()
        // instead of replace() — setParams causes zero remount, zero blank screen.
        // Only push() a fresh BottomNavScreen when coming from LayoutScreen (first time).
        if (currentRoute?.name === "BottomNavScreen") {
          navigation.setParams(params);
        } else {
          navigation.push(target.name, params);
        }
      } catch (e) {
        if (BOTTOM_NAV_DEBUG) console.log("[BottomNav] Navigation error:", e);
        navigation.dispatch(StackActions.replace(target.name, params));
      }
    }
  };

  return (
    <View
      style={[
        styles.container,
        presentation.container,
        paddingStyles,
        showBg ? { backgroundColor } : { backgroundColor: "transparent" },
        containerBorderRadius != null && containerBorderRadius >= 0
          ? { borderRadius: containerBorderRadius }
          : null,
      ]}
    >
      <View style={[styles.row, presentation.row]}>
        {items.map((item, index) => {
          const isActive = index === displayActiveIndex;
          const itemShowLabel = shouldShowItemLabel(item);
          // Active tab: always use active colors so the selected tab is visibly highlighted (dynamic from schema)
          const finalIconColor = isActive
            ? (iconActiveColor || rawLayoutCss?.icon?.color || "#096d70")
            : (iconPrimaryColor || rawLayoutCss?.icon?.color || "#9CA3AF");
          const finalTextColor = isActive
            ? (textActiveColor || rawLayoutCss?.label?.color || "#096d70")
            : (textPrimaryColor || rawLayoutCss?.label?.color || "#6B7280");
          const labelFontWeight = isActive ? "700" : (fontWeight || "600");

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
                  {isCartItem(item) && cartCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {cartCount > 99 ? "99+" : String(cartCount)}
                      </Text>
                    </View>
                  )}
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
                      fontWeight: labelFontWeight,
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
    // Give the tab bar some breathing room above the screen edge.
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: BOTTOM_NAV_RESERVED_HEIGHT,
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
    textAlign: "center",
    lineHeight: 16,
  },
  indicator: {
    alignSelf: "center",
    marginTop: 4,
  },
  cartBadge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
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

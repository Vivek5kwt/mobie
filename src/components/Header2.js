import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import FontAwesome5 from "react-native-vector-icons/FontAwesome5";
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";
import { useSideMenu } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { searchShopifyProducts } from "../services/shopify";
import { getAppLogoSync } from "../utils/appInfo";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { getTypography, resolveFirstFont } from "../services/typographyService";
import { formatMoney } from "../utils/money";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const resolveBooleanSetting = (input, defaultValue = true) => {
  const normalize = (value) => {
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      if (["true", "1", "yes"].includes(lowered)) return true;
      if (["false", "0", "no"].includes(lowered)) return false;
    }
    return !!value;
  };

  if (input === undefined || input === null) return defaultValue;
  if (typeof input === "boolean") return input;

  if (typeof input === "object") {
    if (input.value !== undefined) return normalize(input.value);
    if (input.properties?.value !== undefined) return normalize(input.properties.value);
    if (input.const !== undefined) return normalize(input.const);
  }

  return normalize(input);
};

const resolveValue = (input, defaultValue = undefined) =>
  unwrapValue(input, defaultValue);

// ----- Simple header (logo bar) helpers -----
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
    thin: "100", extralight: "200", "extra light": "200", light: "300",
    regular: "400", normal: "400", medium: "500", semibold: "600",
    "semi bold": "600", bold: "700", extrabold: "800", "extra bold": "800", black: "900",
  };
  return map[normalized] || fallback;
};

const convertPadding = (str) => {
  if (!str) return undefined;
  const parts = String(str).replace(/px/g, "").trim().split(/\s+/);
  if (parts.length >= 2) {
    return { paddingVertical: parseInt(parts[0], 10) || 14, paddingHorizontal: parseInt(parts[1], 10) || 16 };
  }
  const n = parseInt(parts[0], 10);
  return { padding: Number.isFinite(n) ? n : 14 };
};

const resolveMinHeight = (rawValue, fallback) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") return fallback;
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return Math.max(rawValue, fallback);
  if (typeof rawValue === "string") {
    const parsed = Number.parseFloat(String(rawValue).replace("px", "").trim());
    if (Number.isFinite(parsed)) return Math.max(parsed, fallback);
  }
  return fallback;
};

const resolveLogoSource = (logoImage) => {
  if (!logoImage) {
    const appLogo = getAppLogoSync();
    if (appLogo && appLogo.trim() !== "") return { uri: appLogo };
    return null;
  }
  if (logoImage === "/images/mobidrag.png") {
    const appLogo = getAppLogoSync();
    if (appLogo && appLogo.trim() !== "") return { uri: appLogo };
    return null;
  }
  return { uri: logoImage };
};

const resolveLogoAlignment = (value) => {
  const normalized = String(resolveValue(value, "center")).trim().toLowerCase();
  if (["left", "start", "flex-start"].includes(normalized)) return "left";
  if (["right", "end", "flex-end"].includes(normalized)) return "right";
  return "center";
};

const resolveLogoSlotAlignmentStyle = (alignment, flexDirection = "column") => {
  const isRow = ["row", "row-reverse"].includes(flexDirection);
  let flexAlignment = "center";
  if (alignment === "left") flexAlignment = "flex-start";
  if (alignment === "right") flexAlignment = "flex-end";
  return isRow ? { justifyContent: flexAlignment } : { alignItems: flexAlignment };
};

const extractDetailSections = (rawProps) => {
  const candidates = [
    rawProps?.productDetailSections,
    rawProps?.detailSections,
    rawProps?.productDetails,
    rawProps?.detail,
    rawProps?.details,
  ];

  for (const candidate of candidates) {
    const resolved = resolveValue(candidate, undefined);
    if (Array.isArray(resolved)) return resolved;
    if (Array.isArray(resolved?.sections)) return resolved.sections;
  }

  return [];
};

const resolveSideMenuIcon = (variant) => {
  if (!variant) return "bars";
  const normalized = String(variant).trim().toLowerCase();
  if (["hamburger", "menu", "bars"].includes(normalized)) return "bars";
  if (["dots", "ellipsis"].includes(normalized)) return "ellipsis-h";
  return normalized;
};

const normalizeFa6Variant = (value, fallback = "solid") => {
  const v = String(resolveValue(value, fallback) || fallback).trim().toLowerCase();
  if (["solid", "regular", "light", "thin", "duotone", "brands"].includes(v)) return v;
  if (v === "brand") return "brands";
  return fallback;
};

export default function Header2({ section }) {
  const { openSideMenu, toggleSideMenu, hasSideNav } = useSideMenu();
  const navigation = useNavigation();
  const bottomNavSection = section?.bottomNavSection || bottomNavigationStyle1Section;
  const typography = getTypography() || {};
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const quantity = Number(item?.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 1);
    }, 0)
  );
  const formattedCartCount = cartCount > 99 ? "99+" : String(cartCount);

  const resolveBottomNavItems = (rawSection) => {
    if (!rawSection) return [];
    const rawProps =
      rawSection?.props || rawSection?.properties?.props?.properties || rawSection?.properties?.props || {};
    const raw = resolveValue(rawProps?.raw, {});
    let items = resolveValue(raw?.items, undefined);
    if (!items) {
      items = resolveValue(rawProps?.items, []);
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
    const fallbackIndex = target === "cart" ? 1 : target === "search" ? 0 : 2;
    const resolvedIndex = resolveBottomNavIndex(items, target);
    const activeIndex = resolvedIndex >= 0 ? resolvedIndex : fallbackIndex;
    const item = resolvedIndex >= 0 ? items[activeIndex] : null;
    const title =
      item?.label ||
      item?.title ||
      item?.name ||
      (target === "cart" ? "Cart" : target === "search" ? "Search" : "Notifications");
    const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
    const link = typeof rawLink === "string" && rawLink.trim()
      ? rawLink.replace(/^\//, "")
      : target;
    const params = {
      title,
      link,
      pageName: link || target,
      activeIndex,
      bottomNavSection,
    };
    navigation.dispatch(StackActions.replace("BottomNavScreen", params));
  };

  // ---------------- NORMALIZE PROPS FROM JSON SCHEMA ----------------
  const rawPropsNode =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  // Layout from Header Component Schema (logo bar: leftSlot | logoSlot | rightSlot)
  const layoutCss =
    rawPropsNode.layout?.properties?.css ||
    rawPropsNode.layout?.css ||
    rawPropsNode.layout?.properties ||
    {};
  // Greeting-mode props are exclusive to the full header (gradient + search + profile).
  // If any are present, treat this as full mode regardless of other fields.
  const hasGreetingModeProps =
    rawPropsNode.greeting != null ||
    rawPropsNode.searchAndIcons != null ||
    rawPropsNode.greetingSettingsEnabled != null ||
    rawPropsNode.searchSettingsEnabled != null ||
    rawPropsNode.profileSettingsEnabled != null;

  const isSimpleHeader =
    !hasGreetingModeProps &&
    rawPropsNode.cart != null &&
    (rawPropsNode.logoImage != null ||
      rawPropsNode.enableLogo != null ||
      !!(
        layoutCss.container ||
        layoutCss.logoSlot ||
        (rawPropsNode.layout && (rawPropsNode.layout.css || rawPropsNode.layout.properties?.css))
      ));

  // Presentation bundle (CSS + metrics) from DSL if provided
  const presentationNode =
    rawPropsNode.presentation?.properties ||
    rawPropsNode.presentation ||
    {};
  const presentationCss = presentationNode.css || {};
  const presentationMetricsRaw =
    presentationNode.metrics?.properties ||
    presentationNode.metrics?.value ||
    presentationNode.metrics ||
    {};
  const metricElements = presentationMetricsRaw?.elements || {};
  const metricNumber = (value) => {
    const resolved = resolveValue(value, undefined);
    if (resolved === undefined || resolved === null || resolved === "") return NaN;
    if (typeof resolved === "number") return resolved;
    const parsed = Number.parseFloat(String(resolved).replace("px", "").trim());
    return Number.isFinite(parsed) ? parsed : NaN;
  };
  // Derive search row marginTop from presentation metrics when available
  const metricsAvailable =
    presentationMetricsRaw?.available === true ||
    resolveValue(presentationMetricsRaw?.available, false) === true;
  const searchMarginTop = (() => {
    if (!metricsAvailable) return 8;
    const searchEl = metricElements.search;
    if (!searchEl) return 8;
    const searchY = metricNumber(searchEl.y);
    if (!Number.isFinite(searchY)) return 8;

    const precedingBottoms = ["greeting", "title", "headline", "name"]
      .map((key) => {
        const el = metricElements[key];
        if (!el) return NaN;
        const y = metricNumber(el.y);
        const height = metricNumber(el.height);
        return Number.isFinite(y) && Number.isFinite(height) ? y + height : NaN;
      })
      .filter(Number.isFinite);

    if (precedingBottoms.length > 0) {
      const gap = searchY - Math.max(...precedingBottoms);
      return Math.min(Math.max(0, gap), 24);
    }
    return 8;
  })();

  // Base style block from "style" plus presentation.css overrides
  const styleNode = rawPropsNode.style?.properties || rawPropsNode.style || {};
  const sideMenuStyle =
    styleNode.sideMenu ||
    styleNode.menu ||
    presentationCss.sideMenu ||
    presentationCss.menu ||
    presentationCss.sideMenuIcon ||
    presentationCss.hamburger;

  const styleBlock = {
    container: {
      ...(styleNode.container || {}),
      ...(presentationCss.container || {}),
    },
    topRow: {
      ...(styleNode.topRow || {}),
      ...(presentationCss.topRow || {}),
    },
    profile: {
      ...(styleNode.profile || {}),
      ...(presentationCss.profile || {}),
    },
    greeting: {
      ...(styleNode.greeting || {}),
      ...(presentationCss.greeting || {}),
    },
    search: {
      ...(styleNode.search || {}),
      ...(presentationCss.search || {}),
    },
    searchContainer: {
      ...(styleNode.searchContainer || {}),
      ...(presentationCss.searchContainer || {}),
    },
  };

  // Greeting configuration
  const greetingNode = rawPropsNode.greeting?.properties || rawPropsNode.greeting || {};
  const greeting = {
    title: resolveValue(greetingNode.title, ""),
    name: resolveValue(greetingNode.name, ""),
    color: resolveValue(greetingNode.color, "#bf6942"),
    fontSize: resolveValue(greetingNode.fontSize, 16),
    bold: resolveBooleanSetting(greetingNode.bold, true),
    italic: resolveBooleanSetting(greetingNode.italic, false),
    underline: resolveBooleanSetting(greetingNode.underline, false),
    strikethrough: resolveBooleanSetting(greetingNode.strikethrough, false),
    fontWeight: resolveValue(greetingNode.fontWeight, "bold"),
  };

  // Profile configuration (all from JSON)
  // Placeholder design: light circle fill, dark border, dark user icon outline (when no image)
  const profileNode = rawPropsNode.profile?.properties || rawPropsNode.profile || {};
  const profile = {
    show: resolveBooleanSetting(profileNode.show, true),
    size: resolveValue(profileNode.size, 40),
    image: resolveValue(profileNode.image, ""),
    borderColor: resolveValue(profileNode.borderColor, "#374151"),
    backgroundColor: resolveValue(profileNode.backgroundColor, undefined),
    borderWidth: resolveValue(profileNode.borderWidth, undefined),
    borderRadius: resolveValue(profileNode.borderRadius, undefined),
    iconColor: resolveValue(profileNode.iconColor, undefined),
  };

  // Search & icons configuration
  const searchAndIconsNode =
    rawPropsNode.searchAndIcons?.properties || rawPropsNode.searchAndIcons || {};
  const searchAndIcons = {
    showSearch: resolveBooleanSetting(searchAndIconsNode.showSearch, true),
    placeholder: resolveValue(searchAndIconsNode.placeholder, "Search products"),
    showSideMenu: resolveBooleanSetting(searchAndIconsNode.showSideMenu, false),
    searchBgColor: resolveValue(searchAndIconsNode.searchBgColor, "#FFFFFF"),
    searchIconColor: resolveValue(searchAndIconsNode.searchIconColor, "#4B5563"),
    searchTextColor: resolveValue(searchAndIconsNode.searchTextColor, "#131b28"),
    showNotification: resolveBooleanSetting(searchAndIconsNode.showNotification, false),
    notificationIcon: resolveValue(searchAndIconsNode.notificationIcon, "bell"),
    sideMenuIconColor: resolveValue(searchAndIconsNode.sideMenuIconColor, "#FFFFFF"),
    sideMenuIconWidth: resolveValue(searchAndIconsNode.sideMenuIconWidth, 16),
    sideMenuIconHeight: resolveValue(searchAndIconsNode.sideMenuIconHeight, 16),
    sideMenuIconVariant: resolveValue(searchAndIconsNode.sideMenuIconVariant, "hamburger"),
    notificationIconColor: resolveValue(
      searchAndIconsNode.notificationIconColor,
      "#FFFFFF"
    ),
    notificationIconSize: resolveValue(searchAndIconsNode.notificationIconSize, undefined),
    notificationIconWidth: resolveValue(searchAndIconsNode.notificationIconWidth, 16),
    notificationIconHeight: resolveValue(searchAndIconsNode.notificationIconHeight, 16),
    notificationIconVariant: resolveValue(
      searchAndIconsNode.notificationIconVariant,
      "solid"
    ),
    showNotificationBadge: resolveBooleanSetting(
      searchAndIconsNode.showNotificationBadge,
      true
    ),
    searchBoxHeight: resolveValue(searchAndIconsNode.searchBoxHeight, 40),
  };

  // Background gradient from JSON (bgStart, bgEnd) — takes precedence when present
  const bgStart = resolveValue(rawPropsNode.bgStart, undefined);
  const bgEnd = resolveValue(rawPropsNode.bgEnd, undefined);

  // Background & alignment settings
  const bgSettingsEnabled = resolveBooleanSetting(rawPropsNode.bgSettingsEnabled, true);
  const alignmentNode =
    rawPropsNode.alignmentAndPadding?.properties || rawPropsNode.alignmentAndPadding || {};
  const paddingRawNode = alignmentNode.paddingRaw?.properties || alignmentNode.paddingRaw || {};

  const containerPadding = {
    paddingTop: resolveValue(paddingRawNode.pt, 22),
    paddingRight: resolveValue(paddingRawNode.pr, 16),
    paddingBottom: resolveValue(paddingRawNode.pb, 26),
    paddingLeft: resolveValue(paddingRawNode.pl, 16),
  };
  const searchConsumesFullContentWidth = (() => {
    if (!metricsAvailable) return false;
    const searchEl = metricElements.search;
    const containerEl = metricElements.container || presentationMetricsRaw?.container;
    if (!searchEl || !containerEl) return false;

    const searchX = metricNumber(searchEl.x);
    const searchWidth = metricNumber(searchEl.width);
    const containerWidth = metricNumber(containerEl.width);
    if (![searchX, searchWidth, containerWidth].every(Number.isFinite)) return false;

    const leftPadding = metricNumber(containerPadding.paddingLeft) || 0;
    const rightPadding = metricNumber(containerPadding.paddingRight) || 0;
    const contentWidth = Math.max(0, containerWidth - leftPadding - rightPadding);
    return searchX <= leftPadding + 1 && searchWidth >= contentWidth - 2;
  })();

  // App bar (optional, keep existing behavior)
  const appBar =
    rawPropsNode.appBar?.properties || rawPropsNode.appBar || {};

  const containerStyle = {
    ...(styleBlock.container || {}),
    ...(bgSettingsEnabled ? {} : { background: undefined }),
    ...containerPadding,
  };
  const topRowStyle = styleBlock.topRow || {};
  const profileStyle = styleBlock.profile || {};
  const greetingTitleStyle = styleBlock.greeting || {};
  const greetingNameStyle = styleBlock.greeting || {};
  const searchContainerStyle = styleBlock.searchContainer || {};

  // Normalize styles from JSON so we can read size/spacing (convertStyles handles px, etc.)
  const normalizedProfileStyle = convertStyles(profileStyle);
  const normalizedTopRowStyle = convertStyles(topRowStyle);
  const normalizedSearchContainerStyle = convertStyles(searchContainerStyle);

  // Profile size: fully dynamic from JSON (profile.size or style.profile width/height)
  const parseSize = (v) => {
    if (v == null) return NaN;
    if (typeof v === "number" && v > 0) return v;
    const n = typeof v === "string" ? parseFloat(v.replace(/px/g, "").trim()) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };
  const profileSize =
    parseSize(profile.size) ||
    parseSize(normalizedProfileStyle.width) ||
    parseSize(normalizedProfileStyle.height) ||
    40;

  // Profile borderRadius: from props.profile.borderRadius (number) or style.profile, or circle default
  const resolveProfileBorderRadius = () => {
    const raw = profile.borderRadius ?? normalizedProfileStyle.borderRadius;
    if (raw != null && raw !== "") {
      const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/px|%/g, "").trim());
      if (Number.isFinite(n)) {
        if (n >= 99 || n === 50) return profileSize / 2;
        return n;
      }
      if (String(raw).trim() === "50%" || String(raw).includes("999")) return profileSize / 2;
    }
    return profileSize / 2;
  };
  const profileBorderRadius = resolveProfileBorderRadius();

  const searchBarStyle = styleBlock.searchBar || styleBlock.searchInput || styleBlock.search || {};
  const searchBarInputStyle = styleBlock.searchBarInput || {};
  const normalizedSearchBarStyle = convertStyles(searchBarStyle);
  const normalizedSearchBarInputStyle = convertStyles(searchBarInputStyle);
  const searchMetricHeight = metricNumber(metricElements.search?.height);
  const searchBoxHeight =
    (Number.isFinite(searchMetricHeight) && searchMetricHeight > 0 ? searchMetricHeight : NaN) ||
    parseSize(searchAndIcons.searchBoxHeight) ||
    40;
  const searchTextFontSize =
    parseSize(resolveValue(searchAndIconsNode.searchFontSize, undefined)) ||
    parseSize(resolveValue(searchAndIconsNode.searchTextFontSize, undefined)) ||
    parseSize(normalizedSearchBarInputStyle.fontSize) ||
    parseSize(normalizedSearchBarStyle.fontSize) ||
    Math.round(Math.min(14, Math.max(11, searchBoxHeight * 0.36)));
  const searchIconSize =
    parseSize(resolveValue(searchAndIconsNode.searchIconSize, undefined)) ||
    parseSize(resolveValue(searchAndIconsNode.searchIconWidth, undefined)) ||
    parseSize(resolveValue(searchAndIconsNode.searchIconHeight, undefined)) ||
    Math.round(Math.min(16, Math.max(10, searchBoxHeight * 0.38)));
  const notificationContainerStyle = styleBlock.notificationContainer || {};
  const badgeStyle = styleBlock?.badge || {};
  const normalizedBadgeStyle = convertStyles(badgeStyle);
  const badgeStyleHasSize = [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "padding",
    "paddingHorizontal",
    "paddingVertical",
  ].some((key) => normalizedBadgeStyle?.[key] !== undefined);

  // Notification bell: dynamic from JSON (props.notification or searchAndIcons)
  const notificationNode = rawPropsNode.notification?.properties || rawPropsNode.notification || {};
  const notificationBell = {
    visible:
      resolveBooleanSetting(notificationNode.visible, searchAndIcons.showNotification) &&
      resolveBooleanSetting(rawPropsNode?.notificationSettingsEnabled, false),
    iconId: normalizeIconName(
      resolveValue(
        notificationNode.iconId ??
        notificationNode.iconName ??
        searchAndIconsNode.notificationIcon ??
        searchAndIcons.notificationIcon,
        "bell"
      )
    ),
    iconVariant: normalizeFa6Variant(
      resolveValue(notificationNode.iconVariant, searchAndIcons.notificationIconVariant)
    ),
    size: Math.min(
      parseSize(resolveValue(notificationNode.width, undefined)) ||
      parseSize(searchAndIcons.notificationIconSize) ||
      22,
      24
    ),
    color:
      resolveValue(notificationNode.color, searchAndIcons.notificationIconColor) || "#FFFFFF",
    showBadge: resolveBooleanSetting(
      notificationNode.showBadge,
      searchAndIcons.showNotificationBadge
    ),
  };
  
  let gradientColors = ["#5EB7C6", "#8DD1D5"];
  let gradientAngle = 90;

  // Use explicit bgStart / bgEnd from Header 2 JSON when provided (dynamic background)
  const hasBgStart = typeof bgStart === "string" && bgStart.trim().length > 0;
  const hasBgEnd = typeof bgEnd === "string" && bgEnd.trim().length > 0;
  if (hasBgStart || hasBgEnd) {
    const start = (hasBgStart ? bgStart.trim() : null) || (hasBgEnd ? bgEnd.trim() : null);
    const end = (hasBgEnd ? bgEnd.trim() : null) || (hasBgStart ? bgStart.trim() : null);
    if (start && end) gradientColors = [start, end];
    else if (start) gradientColors = [start, start];
  } else if (typeof containerStyle?.background === "string" &&
    containerStyle.background.includes("linear-gradient")) {

    const info = extractGradientInfo({ background: containerStyle.background });
    if (info?.colors) gradientColors = info.colors;
    if (info?.angle !== undefined) gradientAngle = info.angle;

  } else if (containerStyle?.backgroundGradient) {
    gradientColors = containerStyle.backgroundGradient.colors || gradientColors;
    gradientAngle = containerStyle.backgroundGradient.angle || gradientAngle;

  } else {
    const gradientInfo = extractGradientInfo(containerStyle);
    if (gradientInfo?.colors) gradientColors = gradientInfo.colors;
    if (gradientInfo?.angle) gradientAngle = gradientInfo.angle;
  }
  
  const greetingTextStyle = {};
  if (greeting.color) greetingTextStyle.color = greeting.color;
  const rawGreetingFontSize = parseSize(greeting.fontSize) || 16;
  const greetingLineCount = [greeting?.title, greeting?.name].filter(Boolean).length || 1;
  const compactGreetingFontSize = (() => {
    if (!metricsAvailable || greetingLineCount <= 1) return rawGreetingFontSize;
    const greetingEl = metricElements.greeting;
    const searchEl = metricElements.search;
    const greetingY = metricNumber(greetingEl?.y);
    const searchY = metricNumber(searchEl?.y);
    if (!Number.isFinite(greetingY) || !Number.isFinite(searchY) || searchY <= greetingY) {
      return rawGreetingFontSize;
    }
    const availableHeight = Math.max(0, searchY - greetingY - 4);
    const currentBlockHeight = rawGreetingFontSize * 1.18 * greetingLineCount;
    if (availableHeight <= 0 || availableHeight >= currentBlockHeight) return rawGreetingFontSize;
    return Math.max(12, Math.floor(availableHeight / (greetingLineCount * 1.18)));
  })();
  greetingTextStyle.fontSize = compactGreetingFontSize;
  greetingTextStyle.lineHeight = Math.ceil(compactGreetingFontSize * 1.18);
  greetingTextStyle.includeFontPadding = false;
  greetingTextStyle.fontWeight = resolveFontWeight(
    greeting.fontWeight,
    greeting.bold ? "700" : "400"
  );
  greetingTextStyle.fontStyle = greeting.italic ? "italic" : "normal";
  if (greeting.underline || greeting.strikethrough) {
    greetingTextStyle.textDecorationLine = [
      greeting.underline ? "underline" : null,
      greeting.strikethrough ? "line-through" : null,
    ]
      .filter(Boolean)
      .join(" ");
  }
  
  const placeholderColor = searchAndIcons.searchTextColor || "#4B4B4B";
  const searchPlaceholder = searchAndIcons.placeholder || "Search products";

  const profileBorderWidth =
    Number(profile.borderWidth) ||
    Number(normalizedProfileStyle.borderWidth) ||
    (profile.borderColor ? 1 : 0);

  const appBarContainerStyle =
    appBar?.containerStyle || appBar?.style || styleBlock?.appBar || {};
  const appBarTitleStyle = appBar?.titleStyle || {};
  const appBarSubtitleStyle = appBar?.subtitleStyle || {};

  const greetingEnabled = resolveBooleanSetting(rawPropsNode?.greetingSettingsEnabled);
  const searchEnabled = resolveBooleanSetting(rawPropsNode?.searchSettingsEnabled);
  const notificationEnabled = resolveBooleanSetting(rawPropsNode?.notificationSettingsEnabled);
  const profileEnabled = resolveBooleanSetting(rawPropsNode?.profileSettingsEnabled);
  const hasGreeting = greetingEnabled && !!(greeting?.title || greeting?.name);

  const hasLeftIcon = !!appBar?.leftIcon;

  const shouldShowSearchRow =
    (searchEnabled && searchAndIcons?.showSearch) ||
    (notificationEnabled && searchAndIcons?.showNotification);
  const sideMenuMetric =
    metricElements.sideMenu ||
    metricElements.menu ||
    metricElements.hamburger ||
    metricElements.sideMenuIcon;
  const hasBuilderSideMenuSlot =
    !metricsAvailable || Boolean(sideMenuMetric || sideMenuStyle);
  const shouldShowSideMenu =
    resolveBooleanSetting(searchAndIconsNode?.showSideMenu, false) &&
    hasSideNav &&
    hasBuilderSideMenuSlot &&
    !searchConsumesFullContentWidth;
  const shouldShowSearchRowOrMenu = shouldShowSearchRow || shouldShowSideMenu;
  const shouldShowTopRow = hasGreeting || (profileEnabled && profile?.show);
  const searchLimit = resolveValue(searchAndIcons?.searchLimit, 10);
  const detailSections = useMemo(() => extractDetailSections(rawPropsNode), [rawPropsNode]);
  const topRowAlign = String(
    resolveValue(
      alignmentNode?.align ??
      alignmentNode?.horizontalAlign ??
      rawPropsNode?.topRowAlign,
      "left"
    )
  ).trim().toLowerCase();
  const isTopRowRightAligned = ["right", "end", "flex-end"].includes(topRowAlign);
  const isTopRowCenterAligned = ["center"].includes(topRowAlign);

  const handleOpenSideMenu = useCallback(() => {
    if (!hasSideNav) return;
    if (typeof openSideMenu === "function") {
      openSideMenu();
    } else if (typeof toggleSideMenu === "function") {
      toggleSideMenu();
    }
  }, [hasSideNav, openSideMenu, toggleSideMenu]);

  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchSubmittedTerm, setSearchSubmittedTerm] = useState("");
  const [isProfilePreviewVisible, setIsProfilePreviewVisible] = useState(false);
  const [simpleHeaderLogoFallback, setSimpleHeaderLogoFallback] = useState(false);

  // Reset state when section/DSL changes so component shows latest saved design
  const sectionKey = useMemo(
    () =>
      typeof section?.props === "object"
        ? JSON.stringify(section.props)
        : "",
    [section?.props]
  );
  useEffect(() => {
    setSimpleHeaderLogoFallback(false);
  }, [sectionKey]);

  const openProfilePreview = () => setIsProfilePreviewVisible(true);
  const closeProfilePreview = () => setIsProfilePreviewVisible(false);

  const shouldShowAppBar = !!(appBar?.show ?? (
    appBar && (
      appBar.title ||
      appBar.subtitle ||
      appBar.leftIcon ||
      (appBar.rightIcons && appBar.rightIcons.length > 0)
    )
  ));

  const resolveDefaultIconTarget = (iconName) => {
    const normalized = normalizeBottomNavTarget(iconName);
    if (!normalized) return null;
    if (normalized.includes("cart")) return "cart";
    if (normalized.includes("bell") || normalized.includes("notif")) return "notification";
    return null;
  };

  const renderIconButton = (icon, index, extraStyle) => {
    if (!icon) return null;

    const iconName = icon.name || icon.icon;
    if (!iconName) return null;

    const iconContainer = icon.containerStyle || {};
    const fallbackSize = icon.size || 20;

    const defaultTarget = resolveDefaultIconTarget(iconName);
    const onPress =
      icon?.onPress ||
      (defaultTarget ? () => openBottomNavTarget(defaultTarget) : undefined);
    const isPressable = !!onPress;

    const showCartBadge = cartCount > 0 && resolveDefaultIconTarget(iconName) === "cart";

    return (
      <TouchableOpacity
        key={index}
        style={[convertStyles(iconContainer), extraStyle]}
        activeOpacity={isPressable ? 0.7 : 1}
        onPress={onPress}
        disabled={!isPressable}
      >
        <View style={styles.iconBadgeWrapper}>
          <FontAwesome
            name={iconName}
            size={fallbackSize}
            color={icon.color || "#131A1D"}
          />
          {showCartBadge && (
            <View style={styles.cartBadge}>
              <Text style={[styles.cartBadgeText, { color: icon.color || "#131A1D" }]}>
                {formattedCartCount}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Avoid full-height blocks that swallow scroll gestures when a DSL
  // provides `height: "100%"` or flex styles for the header container.
  // Let the content size itself naturally so subsequent sections remain reachable.
  if (typeof containerStyle.height === "string" && containerStyle.height.includes("%")) {
    delete containerStyle.height;
  }

  if (typeof containerStyle.minHeight === "string" && containerStyle.minHeight.includes("%")) {
    delete containerStyle.minHeight;
  }

  if (containerStyle.flex != null) {
    delete containerStyle.flex;
  }

  if (containerStyle.flexGrow != null) {
    delete containerStyle.flexGrow;
  }

  if (containerStyle.borderRadius != null) {
    delete containerStyle.borderRadius;
  }
  if (containerStyle.borderTopLeftRadius != null) {
    delete containerStyle.borderTopLeftRadius;
  }
  if (containerStyle.borderTopRightRadius != null) {
    delete containerStyle.borderTopRightRadius;
  }
  if (containerStyle.borderBottomLeftRadius != null) {
    delete containerStyle.borderBottomLeftRadius;
  }
  if (containerStyle.borderBottomRightRadius != null) {
    delete containerStyle.borderBottomRightRadius;
  }

  useEffect(() => {
    const term = searchValue.trim();
    if (!term || !searchEnabled || !searchAndIcons?.showSearch) {
      setSearchResults([]);
      setSearchError("");
      setSearchLoading(false);
      setSearchSubmittedTerm("");
      return;
    }

    let isMounted = true;
    setSearchLoading(true);
    setSearchError("");

    const timeout = setTimeout(async () => {
      try {
        const matches = await searchShopifyProducts(term, searchLimit);
        if (isMounted) {
          setSearchResults(matches);
        }
      } catch (err) {
        if (isMounted) {
          setSearchError("Unable to search products right now.");
          setSearchResults([]);
        }
      } finally {
        if (isMounted) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
    };
  }, [searchEnabled, searchAndIcons?.showSearch, searchLimit, searchValue]);

  const handleHeaderSearchChange = useCallback((text) => {
    setSearchValue(text);
    setSearchSubmittedTerm("");
  }, []);

  const submitHeaderSearch = useCallback(() => {
    const term = searchValue.trim();
    if (!term || !searchEnabled || !searchAndIcons?.showSearch) {
      setSearchResults([]);
      setSearchError("");
      setSearchSubmittedTerm("");
      return;
    }

    setSearchValue(term);
    setSearchSubmittedTerm(term);
    setSearchLoading(false);
    setSearchError("");
    navigation.navigate("AllProducts", {
      title: `Search results for "${term}"`,
      query: term,
      detailSections,
    });
  }, [detailSections, navigation, searchEnabled, searchAndIcons?.showSearch, searchValue]);

  // ----- Simple Header (Header Component Schema: logo bar with leftSlot | logoSlot | rightSlot) -----
  if (isSimpleHeader) {
    const styleProps = rawPropsNode.style?.properties || rawPropsNode.style || {};
    const paddingVal = resolveValue(styleProps.padding, "14px 16px");
    const minHeightVal = resolveMinHeight(
      resolveValue(styleProps.minHeight, 60),
      60
    );
    // Use bgStart/bgEnd from JSON when provided, else style backgroundColor/borderColor
    const simpleBgStart = resolveValue(rawPropsNode.bgStart, undefined);
    const simpleBgEnd = resolveValue(rawPropsNode.bgEnd, undefined);
    const backgroundColor =
      (typeof simpleBgStart === "string" && simpleBgStart.trim()) ||
      (typeof simpleBgEnd === "string" && simpleBgEnd.trim()) ||
      resolveValue(styleProps.backgroundColor, "#E0F7F8");
    const borderColor =
      resolveValue(rawPropsNode.borderColor, undefined) ||
      resolveValue(styleProps.borderColor, "#016D77");
    const paddingStyle = convertPadding(paddingVal);

    const normalizedLayout = {
      container: convertStyles(layoutCss.container || {}),
      leftSlot: convertStyles(layoutCss.leftSlot || {}),
      logoSlot: convertStyles(layoutCss.logoSlot || {}),
      logoImage: convertStyles(layoutCss.logoImage || {}),
      rightSlot: convertStyles(layoutCss.rightSlot || {}),
      badge: convertStyles(layoutCss.badge || {}),
    };
    const logoImageStyle = { ...normalizedLayout.logoImage };
    if (logoImageStyle.width === "auto") delete logoImageStyle.width;
    if (logoImageStyle.height === "auto") delete logoImageStyle.height;

    const sideMenuProps = rawPropsNode.sideMenu?.properties || rawPropsNode.sideMenu || {};
    const sideMenuVisible = resolveBooleanSetting(sideMenuProps.visible, false);
    const sideMenuIconName = normalizeIconName(
      resolveValue(sideMenuProps.iconId ?? sideMenuProps.iconName ?? sideMenuProps.icon, "bars")
    );
    const sideMenuIconSize = resolveValue(sideMenuProps.width, 18);
    const sideMenuIconColor = resolveValue(sideMenuProps.color, "#016D77");

    const logoEnabled = resolveBooleanSetting(rawPropsNode.enableLogo, true);
    const logoImageProp = resolveValue(rawPropsNode.logoImage, "");
    const logoSource = simpleHeaderLogoFallback
      ? null
      : resolveLogoSource(logoImageProp);

    const headerTextEnabled = resolveBooleanSetting(
      rawPropsNode.enableheaderText ?? rawPropsNode.enableHeaderText,
      false
    );
    const headerTextValue = resolveValue(rawPropsNode.headerText, "");
    const headerTextSize = resolveValue(rawPropsNode.headerTextSize, 14);
    const headerTextColor = resolveValue(rawPropsNode.headerTextColor, "#0C1C2C");
    const headerTextBold = resolveBooleanSetting(rawPropsNode.headerTextBold, false);
    const headerTextItalic = resolveBooleanSetting(rawPropsNode.headerTextItalic, false);
    const headerTextUnderline = resolveBooleanSetting(rawPropsNode.headerTextUnderline, false);
    const headerTextStrikethrough = resolveBooleanSetting(rawPropsNode.headerTextStrikethrough, false);
    const headerTextDecorationLine = resolveTextDecorationLine({
      underline: headerTextUnderline,
      strikethrough: headerTextStrikethrough,
    });
    const headerTextAlign = String(resolveValue(rawPropsNode.headerTextAlign, "center")).toLowerCase();
    const headerFontFamily = resolveFirstFont(
      resolveValue(rawPropsNode.headerFontFamily, undefined),
      resolveValue(rawPropsNode.textFontFamily, undefined),
      resolveValue(rawPropsNode.titleFontFamily, undefined),
      resolveValue(rawPropsNode.fontFamily, undefined),
      typography.headlineFontFamily,
      typography.bodyFontFamily
    ) || "";
    const headerFontWeight = resolveFontWeight(
      rawPropsNode.headerFontWeight,
      headerTextBold ? "700" : "400"
    );
    const logoAlignment = resolveLogoAlignment(rawPropsNode.logoAlign);
    const logoSlotFlexDirection = normalizedLayout.logoSlot?.flexDirection || "column";
    const logoSlotAlignmentStyle = resolveLogoSlotAlignmentStyle(
      logoAlignment,
      logoSlotFlexDirection
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

    const cartProps = rawPropsNode.cart?.properties || rawPropsNode.cart || {};
    const cartVisible = resolveBooleanSetting(cartProps.visible, true);
    const cartIconName = normalizeIconName(resolveValue(cartProps.iconId, "cart-shopping"));
    const cartIconSize = resolveValue(cartProps.width, 18);
    const cartIconColor = resolveValue(cartProps.color, "#016D77");
    const cartShowBadge = resolveBooleanSetting(cartProps.showBadge, true);
    const shouldShowCartBadge = cartCount > 0 || cartShowBadge;

  const notificationProps = rawPropsNode.notification?.properties || rawPropsNode.notification || {};
  const notificationVisible = resolveBooleanSetting(notificationProps.visible, false);
  const notificationIconName = normalizeIconName(
      resolveValue(
        notificationProps.iconId ??
        notificationProps.iconName ??
        searchAndIconsNode.notificationIcon ??
        searchAndIcons.notificationIcon,
        "bell"
      )
    );
    const notificationIconVariant = normalizeFa6Variant(
      resolveValue(notificationProps.iconVariant, searchAndIcons.notificationIconVariant)
    );
    const notificationIconSize = resolveValue(notificationProps.width, 18);
    const notificationIconColor = resolveValue(notificationProps.color, "#016D77");
    const notificationShowBadge = resolveBooleanSetting(notificationProps.showBadge, true);

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
    };

    const shouldShowHeaderText = headerTextEnabled && !!headerTextValue;
    const shouldShowLogo = logoEnabled && logoSource && !shouldShowHeaderText;

    const simpleContainerStyle = {
      flexDirection: "row",
      justifyContent: normalizedLayout.container?.justifyContent || "space-between",
      alignItems: normalizedLayout.container?.alignItems || "center",
      backgroundColor,
      minHeight: minHeightVal,
      borderColor,
      borderWidth: borderColor ? 1 : 0,
      ...paddingStyle,
      ...normalizedLayout.container,
    };

    return (
      <View style={simpleContainerStyle}>
        <View style={[header2Styles.leftSlot, normalizedLayout.leftSlot]}>
          {sideMenuVisible && (
            <TouchableOpacity onPress={openSideMenu} activeOpacity={0.7}>
              <Icon
                name={sideMenuIconName}
                size={sideMenuIconSize}
                color={sideMenuIconColor}
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={[header2Styles.logoSlot, normalizedLayout.logoSlot, logoSlotAlignmentStyle]}>
          {shouldShowHeaderText ? (
            <Text style={[header2Styles.logoText, headerTextStyle]} numberOfLines={1}>
              {headerTextValue}
            </Text>
          ) : shouldShowLogo ? (
            <Image
              source={logoSource}
              style={[header2Styles.logoImage, logoImageStyle]}
              resizeMode="contain"
              onError={() => setSimpleHeaderLogoFallback(true)}
            />
          ) : null}
        </View>

        <View style={[header2Styles.rightSlot, normalizedLayout.rightSlot]}>
          {cartVisible && (
            <TouchableOpacity
              style={header2Styles.iconWrapper}
              activeOpacity={0.7}
              onPress={() => openBottomNavTarget("cart")}
            >
              <Icon name={cartIconName} size={cartIconSize} color={cartIconColor} />
              {shouldShowCartBadge && (
                <View style={[header2Styles.badge, badgeStyle]}>
                  <Text
                    style={[
                      header2Styles.badgeText,
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
              style={header2Styles.iconWrapper}
              activeOpacity={0.7}
              onPress={() => openBottomNavTarget("notification")}
            >
              <Icon
                name={notificationIconName}
                size={notificationIconSize}
                color={notificationIconColor}
                iconStyle={notificationIconVariant}
              />
              {notificationShowBadge && (
                <View
                  style={[
                    header2Styles.notificationBadge,
                    badgeStyle,
                    !badgeStyleHasSize && header2Styles.notificationBadgeCompact,
                  ]}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <LinearGradient
      style={convertStyles(containerStyle)}
      colors={gradientColors}
      angle={gradientAngle}
      useAngle={true}
    >
      {shouldShowAppBar && (
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            },
            convertStyles(appBarContainerStyle),
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {renderIconButton(appBar.leftIcon, "left")}
            {(appBar.title || appBar.subtitle) && (
              <View style={hasLeftIcon ? { marginLeft: 10 } : null}>
                {appBar.title && (
                  <Text style={[{ fontSize: 16, fontWeight: "600" }, convertStyles(appBarTitleStyle)]}>
                    {appBar.title}
                  </Text>
                )}
                {appBar.subtitle && (
                  <Text style={[{ fontSize: 12, color: "#4B4B4B" }, convertStyles(appBarSubtitleStyle)]}>
                    {appBar.subtitle}
                  </Text>
                )}
              </View>
            )}
          </View>

          {appBar?.rightIcons?.length > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {appBar.rightIcons.map((icon, idx) => renderIconButton(icon, idx, idx > 0 ? { marginLeft: 12 } : null))}
            </View>
          )}
        </View>
      )}

      {/* Top Row - layout and spacing from JSON (topRowStyle) */}
      {shouldShowTopRow && (
        <View
          style={[
            styles.topRowLayout,
            isTopRowRightAligned ? styles.topRowLayoutRight : null,
            isTopRowCenterAligned ? styles.topRowLayoutCenter : null,
            { gap: normalizedTopRowStyle.gap ?? 12 },
            normalizedTopRowStyle,
          ]}
        >
          {hasGreeting && (
            <View
              style={[
                { flex: 1, minWidth: 0 },
                isTopRowRightAligned ? { alignItems: "flex-end" } : null,
                isTopRowCenterAligned ? { alignItems: "center" } : null,
              ]}
            >
              {greeting?.title && (
                <Text
                  numberOfLines={1}
                  style={[
                    convertStyles(greetingTitleStyle),
                    greetingTextStyle,
                    isTopRowRightAligned ? { textAlign: "right" } : null,
                    isTopRowCenterAligned ? { textAlign: "center" } : null,
                  ]}
                >
                  {greeting.title}
                </Text>
              )}
              {greeting?.name && (
                <Text
                  numberOfLines={1}
                  style={[
                    convertStyles(greetingNameStyle),
                    greetingTextStyle,
                    isTopRowRightAligned ? { textAlign: "right" } : null,
                    isTopRowCenterAligned ? { textAlign: "center" } : null,
                  ]}
                >
                  {greeting.name}
                </Text>
              )}
            </View>
          )}

          {profileEnabled && profile?.show && (
            <TouchableOpacity
              style={[
                styles.profileWrapper,
                normalizedProfileStyle,
                {
                  width: profileSize,
                  height: profileSize,
                  borderRadius: profileBorderRadius,
                  borderColor: profile.borderColor || "transparent",
                  borderWidth: profile?.image
                    ? profileBorderWidth
                    : (profile.borderWidth != null ? Number(profile.borderWidth) : 2),
                  backgroundColor: profile.backgroundColor ?? (profile?.image ? "transparent" : "#FFFFFF"),
                },
              ]}
              activeOpacity={profile?.image ? 0.7 : 1}
              onPress={profile?.image ? openProfilePreview : undefined}
              disabled={!profile?.image}
            >
              {profile?.image ? (
                <Image
                  source={{ uri: profile.image }}
                  style={[
                    styles.profileImageFill,
                    {
                      width: "100%",
                      height: "100%",
                      borderRadius: profileBorderRadius,
                    },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <FontAwesome5
                  name="user"
                  solid={false}
                  size={Math.max(16, profileSize * 0.45)}
                  color={profile.iconColor ?? profile.borderColor ?? "#374151"}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {shouldShowSearchRowOrMenu ? (
        <View
          style={[
            styles.searchRowLayout,
            {
              gap: normalizedSearchContainerStyle.gap ?? 10,
              marginTop: normalizedSearchContainerStyle.marginTop ?? searchMarginTop,
            },
            normalizedSearchContainerStyle,
          ]}
        >
          {shouldShowSideMenu && (
            <TouchableOpacity
              onPress={handleOpenSideMenu}
              activeOpacity={0.7}
              style={{ alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <FontAwesome
                name={resolveSideMenuIcon(searchAndIcons?.sideMenuIconVariant)}
                size={
                  searchAndIcons?.sideMenuIconWidth ||
                  searchAndIcons?.sideMenuIconHeight ||
                  20
                }
                color={searchAndIcons?.sideMenuIconColor || "#FFFFFF"}
              />
            </TouchableOpacity>
          )}
          {searchEnabled && searchAndIcons?.showSearch && (
            <View style={[
              styles.searchBarWrapper,
              normalizedSearchBarStyle,
              {
                height: searchBoxHeight,
                minHeight: searchBoxHeight,
              },
            ]}>
              <TouchableOpacity
                style={[
                  styles.searchIconContainer,
                  {
                    paddingLeft: Math.max(8, Math.round(searchBoxHeight * 0.35)),
                    paddingRight: Math.max(6, Math.round(searchBoxHeight * 0.24)),
                  },
                ]}
                onPress={() => {
                  if (searchValue.trim()) submitHeaderSearch();
                  else openBottomNavTarget("search");
                }}
                activeOpacity={0.7}
                accessibilityLabel="Search products"
                accessibilityRole="button"
              >
                <FontAwesome
                  name="search"
                  size={searchIconSize}
                  color={searchAndIcons?.searchIconColor || "#39444D"}
                />
              </TouchableOpacity>
              <TextInput
                value={searchValue}
                onChangeText={handleHeaderSearchChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={placeholderColor}
                style={[
                  normalizedSearchBarInputStyle,
                  styles.searchInput,
                  {
                    flex: 1,
                    minWidth: 0,
                    fontSize: searchTextFontSize,
                    lineHeight: Math.round(searchTextFontSize * 1.25),
                    paddingVertical: 0,
                  },
                ]}
                underlineColorAndroid="transparent"
                selectionColor="#131A1D"
                returnKeyType="search"
                onSubmitEditing={submitHeaderSearch}
                onFocus={() => openBottomNavTarget("search")}
                onPressIn={() => openBottomNavTarget("search")}
              />
            </View>
          )}

          {notificationEnabled && notificationBell.visible && (
            <TouchableOpacity
              style={[styles.notificationWrapper, convertStyles(notificationContainerStyle)]}
              activeOpacity={0.7}
              onPress={() => openBottomNavTarget("notification")}
            >
              <View>
                <Icon
                  name={notificationBell.iconId}
                  size={notificationBell.size}
                  color={notificationBell.color}
                  iconStyle={notificationBell.iconVariant}
                />
                {notificationBell.showBadge && (
                  <View
                    style={[
                      styles.notificationBadge,
                      normalizedBadgeStyle,
                      !badgeStyleHasSize && styles.notificationBadgeCompact,
                    ]}
                  />
                )}
              </View>
              {!notificationBell.iconId && (
                <FontAwesome
                  name={resolveFA4IconName("bell") || "bell"}
                  size={notificationBell.size}
                  color={notificationBell.color}
                />
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {searchEnabled && searchAndIcons?.showSearch && searchValue.trim().length > 0 && (
        <View style={styles.resultsWrapper}>
          <View style={styles.resultsHeader}>
            <Text numberOfLines={1} style={styles.resultsTitle}>
              {searchSubmittedTerm ? `Products for "${searchSubmittedTerm}"` : "Suggestions"}
            </Text>
            {!searchSubmittedTerm && (
              <TouchableOpacity onPress={submitHeaderSearch} activeOpacity={0.75}>
                <Text style={styles.searchAllText}>Search</Text>
              </TouchableOpacity>
            )}
          </View>
          {searchLoading && <Text style={styles.statusText}>Searching products...</Text>}
          {!searchLoading && searchError.length > 0 && (
            <Text style={styles.errorText}>{searchError}</Text>
          )}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <Text style={styles.statusText}>No products found.</Text>
          )}
          {!searchLoading &&
            !searchError &&
            searchResults.map((product) => (
              <TouchableOpacity
                key={product.id}
                style={styles.resultRow}
                onPress={() =>
                  navigation.navigate("ProductDetail", {
                    product,
                    detailSections,
                  })
                }
              >
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.resultImage}
                    resizeMode={resolveProductImageResizeMode()}
                  />
                ) : (
                  <View style={styles.resultImagePlaceholder}>
                    <Text style={styles.resultPlaceholderText}>Image</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text numberOfLines={2} style={styles.resultTitle}>
                    {product.title}
                  </Text>
                  <Text style={styles.resultPrice}>
                    {formatMoney(
                      product.priceAmount ?? product.price,
                      product.priceCurrency || product.currency || product.currencySymbol
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
        </View>
      )}
      {profile?.image && (
        <Modal
          visible={isProfilePreviewVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeProfilePreview}
        >
          <View style={styles.profilePreviewBackdrop}>
            <TouchableOpacity
              style={styles.profilePreviewClose}
              onPress={closeProfilePreview}
              accessibilityRole="button"
              accessibilityLabel="Close profile image preview"
            >
              <FontAwesome name="times" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: profile.image }}
              style={styles.profilePreviewImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  topRowLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  topRowLayoutRight: {
    flexDirection: "row-reverse",
  },
  topRowLayoutCenter: {
    justifyContent: "center",
  },
  profileWrapper: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileImageFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  searchRowLayout: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginTop: 16,
  },
  searchBarWrapper: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingRight: 8,
    overflow: "hidden",
  },
  searchIconContainer: {
    paddingLeft: 16,
    paddingRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    paddingVertical: 4,
  },
  notificationWrapper: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsWrapper: {
    marginTop: 12,
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsTitle: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  searchAllText: {
    color: "#39444D",
    fontSize: 12,
    fontWeight: "700",
  },
  statusText: {
    textAlign: "center",
    color: "#6B7280",
  },
  errorText: {
    textAlign: "center",
    color: "#B91C1C",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  resultImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  resultImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  resultPlaceholderText: {
    fontSize: 10,
    color: "#9CA3AF",
  },
  resultInfo: {
    flex: 1,
    gap: 4,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  resultPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },
  iconBadgeWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 0,
    height: 18,
    borderRadius: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
  },
  cartBadgeText: {
    color: "#131A1D",
    fontSize: 10,
    fontWeight: "700",
  },
  notificationBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  notificationBadgeCompact: {
    width: 9,
    height: 9,
    minWidth: 9,
    minHeight: 9,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  profilePreviewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  profilePreviewImage: {
    width: "100%",
    height: "80%",
  },
  profilePreviewClose: {
    position: "absolute",
    top: 48,
    right: 24,
    zIndex: 2,
    padding: 8,
  },
});

// Simple header (logo bar) layout matching Header Component Schema
const header2Styles = StyleSheet.create({
  leftSlot: { flexDirection: "row", alignItems: "center" },
  logoSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { textAlign: "center" },
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
    top: -3,
    right: -3,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  notificationBadgeCompact: {
    width: 9,
    height: 9,
    minWidth: 9,
    minHeight: 9,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});

import React, { useEffect, useMemo, useState } from "react";
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
import Icon from "react-native-vector-icons/FontAwesome6";
import { useSelector } from "react-redux";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";
import { useSideMenu } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { searchShopifyProducts } from "../services/shopify";
import { getAppLogoSync } from "../utils/appInfo";

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
    return require("../assets/logo/mobidraglogo.png");
  }
  if (logoImage === "/images/mobidrag.png") {
    const appLogo = getAppLogoSync();
    if (appLogo && appLogo.trim() !== "") return { uri: appLogo };
    return require("../assets/logo/mobidraglogo.png");
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

export default function Header2({ section }) {
  const { openSideMenu, hasSideNav } = useSideMenu();
  const navigation = useNavigation();
  const bottomNavSection = section?.bottomNavSection || bottomNavigationStyle1Section;
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

  // ---------------- NORMALIZE PROPS FROM JSON SCHEMA ----------------
  const rawPropsNode =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  // Layout from Header Component Schema (logo bar: leftSlot | logoSlot | rightSlot)
  const layoutCss =
    rawPropsNode.layout?.properties?.css ||
    rawPropsNode.layout?.css ||
    rawPropsNode.layout?.properties ||
    {};
  const isSimpleHeader =
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

  // Base style block from "style" plus presentation.css overrides
  const styleNode = rawPropsNode.style?.properties || rawPropsNode.style || {};

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
  const profileNode = rawPropsNode.profile?.properties || rawPropsNode.profile || {};
  const profile = {
    show: resolveBooleanSetting(profileNode.show, true),
    size: resolveValue(profileNode.size, 40),
    image: resolveValue(profileNode.image, ""),
    borderColor: resolveValue(profileNode.borderColor, "#016D77"),
    backgroundColor: resolveValue(profileNode.backgroundColor, undefined),
    borderWidth: resolveValue(profileNode.borderWidth, undefined),
  };

  // Search & icons configuration
  const searchAndIconsNode =
    rawPropsNode.searchAndIcons?.properties || rawPropsNode.searchAndIcons || {};
  const searchAndIcons = {
    showSearch: resolveBooleanSetting(searchAndIconsNode.showSearch, true),
    placeholder: resolveValue(searchAndIconsNode.placeholder, "Search products"),
    showSideMenu: resolveBooleanSetting(searchAndIconsNode.showSideMenu, true),
    searchBgColor: resolveValue(searchAndIconsNode.searchBgColor, "#FFFFFF"),
    searchIconColor: resolveValue(searchAndIconsNode.searchIconColor, "#4B5563"),
    searchTextColor: resolveValue(searchAndIconsNode.searchTextColor, "#131b28"),
    showNotification: resolveBooleanSetting(searchAndIconsNode.showNotification, true),
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
  };

  // Background & alignment settings
  const bgSettingsEnabled = resolveBooleanSetting(rawPropsNode.bgSettingsEnabled, true);
  const alignmentNode =
    rawPropsNode.alignmentAndPadding?.properties || rawPropsNode.alignmentAndPadding || {};
  const paddingRawNode = alignmentNode.paddingRaw?.properties || alignmentNode.paddingRaw || {};

  const containerPadding = {
    paddingTop: resolveValue(paddingRawNode.pt, 16),
    paddingRight: resolveValue(paddingRawNode.pr, 16),
    paddingBottom: resolveValue(paddingRawNode.pb, 16),
    paddingLeft: resolveValue(paddingRawNode.pl, 16),
  };

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

  const searchBarStyle = styleBlock.searchBar || styleBlock.searchInput || styleBlock.search || {};
  const searchBarInputStyle = styleBlock.searchBarInput || {};
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
      resolveBooleanSetting(rawPropsNode?.notificationSettingsEnabled, true),
    iconId: normalizeIconName(
      resolveValue(notificationNode.iconId ?? notificationNode.iconName, "bell")
    ),
    size:
      parseSize(resolveValue(notificationNode.width, undefined)) ||
      searchAndIcons.notificationIconSize ||
      searchAndIcons.notificationIconWidth ||
      searchAndIcons.notificationIconHeight ||
      24,
    color:
      resolveValue(notificationNode.color, searchAndIcons.notificationIconColor) || "#FFFFFF",
    showBadge: resolveBooleanSetting(
      notificationNode.showBadge,
      searchAndIcons.showNotificationBadge
    ),
  };
  
  let gradientColors = ["#5EB7C6", "#8DD1D5"];
  let gradientAngle = 90;
  
  if (typeof containerStyle?.background === "string" &&
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
  if (greeting.fontSize) greetingTextStyle.fontSize = greeting.fontSize;
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
  const shouldShowSideMenu = false;
  const shouldShowSearchRowOrMenu = shouldShowSearchRow || shouldShowSideMenu;
  const shouldShowTopRow = hasGreeting || (profileEnabled && profile?.show);
  const searchLimit = resolveValue(searchAndIcons?.searchLimit, 10);
  const detailSections = useMemo(() => extractDetailSections(rawPropsNode), [rawPropsNode]);

  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
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

  // ----- Simple Header (Header Component Schema: logo bar with leftSlot | logoSlot | rightSlot) -----
  if (isSimpleHeader) {
    const styleProps = rawPropsNode.style?.properties || rawPropsNode.style || {};
    const paddingVal = resolveValue(styleProps.padding, "14px 16px");
    const minHeightVal = resolveMinHeight(
      resolveValue(styleProps.minHeight, 60),
      60
    );
    const backgroundColor = resolveValue(styleProps.backgroundColor, "#E0F7F8");
    const borderColor = resolveValue(styleProps.borderColor, "#016D77");
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
    const sideMenuVisible = resolveBooleanSetting(sideMenuProps.visible, true);
    const sideMenuIconName = normalizeIconName(
      resolveValue(sideMenuProps.iconId ?? sideMenuProps.iconName ?? sideMenuProps.icon, "bars")
    );
    const sideMenuIconSize = resolveValue(sideMenuProps.width, 18);
    const sideMenuIconColor = resolveValue(sideMenuProps.color, "#016D77");

    const logoEnabled = resolveBooleanSetting(rawPropsNode.enableLogo, true);
    const logoImageProp = resolveValue(rawPropsNode.logoImage, "");
    const logoSource = simpleHeaderLogoFallback
      ? require("../assets/logo/mobidraglogo.png")
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
    const headerTextAlign = String(resolveValue(rawPropsNode.headerTextAlign, "center")).toLowerCase();
    const headerFontFamily = resolveValue(rawPropsNode.headerFontFamily, undefined);
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
      textDecorationLine: headerTextUnderline ? "underline" : "none",
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
    const notificationVisible = resolveBooleanSetting(notificationProps.visible, true);
    const notificationIconName = normalizeIconName(
      resolveValue(notificationProps.iconId, "bell")
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
          {sideMenuVisible && hasSideNav && (
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
            { gap: normalizedTopRowStyle.gap ?? 12 },
            normalizedTopRowStyle,
          ]}
        >
          {hasGreeting && (
            <View style={{ flex: 1, minWidth: 0 }}>
              {greeting?.title && (
                <Text style={[convertStyles(greetingTitleStyle), greetingTextStyle]}>
                  {greeting.title}
                </Text>
              )}
              {greeting?.name && (
                <Text style={[convertStyles(greetingNameStyle), greetingTextStyle]}>
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
                  borderRadius: profileSize / 2,
                  borderColor: profile.borderColor || "transparent",
                  borderWidth: profileBorderWidth,
                  backgroundColor: profile.backgroundColor || "transparent",
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
                      borderRadius: 9999,
                    },
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <FontAwesome
                  name="user"
                  size={Math.max(16, profileSize * 0.5)}
                  color={profile?.borderColor || "#0E6A70"}
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
              marginTop: normalizedSearchContainerStyle.marginTop ?? 16,
            },
            normalizedSearchContainerStyle,
          ]}
        >
          {shouldShowSideMenu && (
            <TouchableOpacity
              onPress={openSideMenu}
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
            <View style={[styles.searchBarWrapper, convertStyles(searchBarStyle)]}>
              <View style={styles.searchIconContainer}>
                <FontAwesome
                  name="search"
                  size={18}
                  color={searchAndIcons?.searchIconColor || "#39444D"}
                />
              </View>
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder={searchPlaceholder}
                placeholderTextColor={placeholderColor}
                style={[convertStyles(searchBarInputStyle), styles.searchInput, { flex: 1, minWidth: 0 }]}
                underlineColorAndroid="transparent"
                selectionColor="#131A1D"
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
                <FontAwesome
                  name={notificationBell.iconId}
                  size={notificationBell.size}
                  color={notificationBell.color}
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
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {searchEnabled && searchAndIcons?.showSearch && searchValue.trim().length > 0 && (
        <View style={styles.resultsWrapper}>
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
                  <Image source={{ uri: product.imageUrl }} style={styles.resultImage} />
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
                    {product.priceCurrency} {product.priceAmount}
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
    borderRadius: 10,
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 44,
  },
  searchIconContainer: {
    paddingLeft: 14,
    paddingRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  searchInput: {
    paddingVertical: 0,
  },
  notificationWrapper: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsWrapper: {
    marginTop: 12,
    gap: 10,
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
    backgroundColor: "#F3F4F6",
  },
  resultImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
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

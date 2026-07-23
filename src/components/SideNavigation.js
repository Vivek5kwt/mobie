import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import Icon from "react-native-vector-icons/FontAwesome6";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";
import { isAuthenticatedSession } from "../utils/authGate";
import { getAppLogoSync } from "../utils/appInfo";
import { resolveFont } from "../services/typographyService";
import { navigateToDslTarget } from "../utils/navigationTarget";
import { useSideMenu } from "../services/SideMenuContext";

const DEFAULT_DRAWER_WIDTH = 260;

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (isObject(value)) {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
};

const unwrapDeep = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (Array.isArray(value)) return value.map((item) => unwrapDeep(item));
  if (!isObject(value)) return value;
  if (value.value !== undefined) return unwrapDeep(value.value, fallback);
  if (value.const !== undefined) return unwrapDeep(value.const, fallback);
  if (value.properties !== undefined) return unwrapDeep(value.properties, fallback);

  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = unwrapDeep(next);
    return acc;
  }, {});
};

const firstDefined = (...values) => {
  for (const value of values) {
    const resolved = unwrapValue(value);
    if (resolved !== undefined && resolved !== null && resolved !== "") return resolved;
  }
  return undefined;
};

const toNumber = (value, fallback = undefined) => {
  const resolved = unwrapValue(value);
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  if (typeof resolved === "string") {
    const trimmed = resolved.trim();
    if (!trimmed || trimmed.endsWith("%")) return fallback;
    const parsed = parseFloat(trimmed.replace(/px$/i, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const toStringValue = (value, fallback = "") => {
  const resolved = unwrapValue(value);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
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
  const cleaned = String(name)
    .trim()
    .replace(/^fa-(solid|regular|brands)\s+/i, "")
    .replace(/^fa[srldb]?[-_]?/i, "");
  return cleaned || "circle";
};

const isImageUrlValue = (value) => /^(https?:\/\/|data:image\/|\/)/i.test(String(value || "").trim());

const getCustomIconUrlFromValue = (value) => {
  const str = String(value || "").trim();
  return isImageUrlValue(str) ? str : null;
};

// Header row and item rows only support Left/Center in the builder UI —
// "Right" is hidden there, so a stored "Right" value is treated as "Left".
const alignTextLeftOrCenter = (align) =>
  String(align || "").trim().toLowerCase() === "center" ? "center" : "left";

const alignJustifyLeftOrCenter = (align) =>
  String(align || "").trim().toLowerCase() === "center" ? "center" : "flex-start";

const normalizeWeight = (value, fallback = undefined) => {
  const converted = convertStyles({ fontWeight: value || fallback });
  return converted.fontWeight || fallback;
};

const resolveFontFamily = (...values) => {
  for (const value of values) {
    const resolved = resolveFont(toStringValue(value, ""));
    if (resolved) return resolved;
  }
  return undefined;
};

const textDecorationFor = ({ underline, strikethrough }, fallback = "none") => {
  const next = [];
  if (asBoolean(underline, false)) next.push("underline");
  if (asBoolean(strikethrough, false)) next.push("line-through");
  return next.length ? next.join(" ") : fallback;
};

const isLogoutItem = (item) => {
  const label = String(item?.title || item?.label || item?.text || "").trim().toLowerCase();
  return ["logout", "log out"].includes(label);
};

const isAuthToggleItem = (item) => {
  const label = String(item?.title || item?.label || item?.text || "").trim().toLowerCase();
  return ["logout", "log out", "login", "log in", "signin", "sign in"].includes(label);
};

const SIGNIN_SLUGS = new Set(["signin", "sign-in", "login", "log-in", "auth"]);
const SIGNUP_SLUGS = new Set(["create-user", "create-account", "signup", "sign-up"]);

const labelToSlug = (label) =>
  String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const resolveLogoSource = (logoUrl, brandKitLogoUrl) => {
  const appLogo = getAppLogoSync();
  const resolvedLogo =
    (logoUrl && logoUrl !== "/images/mobidrag.png" && logoUrl) ||
    (brandKitLogoUrl && brandKitLogoUrl !== "/images/mobidrag.png" && brandKitLogoUrl) ||
    appLogo;
  return resolvedLogo ? { uri: resolvedLogo } : null;
};

const getPropsNode = (section = {}) =>
  section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

const buildRawProps = (rawProps = {}) => {
  const flatProps = unwrapDeep(rawProps, {});
  const rawBlock = unwrapDeep(flatProps?.raw, {});
  if (rawBlock && typeof rawBlock === "object") {
    return { ...flatProps, ...rawBlock };
  }
  return flatProps || {};
};

const splitPaddingStyles = (style = {}) => {
  const root = { ...style };
  const content = {};
  [
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "paddingHorizontal",
    "paddingVertical",
  ].forEach((key) => {
    if (root[key] !== undefined) {
      content[key] = root[key];
      delete root[key];
    }
  });
  ["position", "top", "right", "bottom", "left"].forEach((key) => {
    delete root[key];
  });
  return { root, content };
};

const extractPresentation = (section = {}, rawProps = {}) => {
  const candidates = [
    section?.presentation,
    section?.properties?.presentation,
    section?.properties?.presentation?.properties,
    rawProps?.presentation,
    rawProps?.presentation?.value,
    rawProps?.presentation?.properties,
  ];

  const source =
    candidates
      .map((candidate) => unwrapDeep(candidate, null))
      .find((candidate) => candidate && typeof candidate === "object" && (candidate.css || candidate.metrics)) || {};

  const css = unwrapDeep(source.css, {});
  const drawerSplit = splitPaddingStyles(convertStyles(css.drawer || {}));

  return {
    drawer: drawerSplit.root,
    drawerPadding: drawerSplit.content,
    headerRow: convertStyles(css.headerRow || {}),
    itemRow: convertStyles(css.itemRow || {}),
    itemIcon: convertStyles(css.itemIcon || {}),
    itemText: convertStyles(css.itemText || {}),
    metrics: unwrapDeep(source.metrics, {}),
  };
};

export const getSideNavigationWidth = (section = {}, fallback = DEFAULT_DRAWER_WIDTH) => {
  const rawProps = getPropsNode(section);
  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section, rawProps);
  return toNumber(
    firstDefined(raw.drawerWidth, raw.width, presentation.drawer?.width),
    fallback
  );
};

// "Fit" logoScale: box auto-sizes to the logo's natural aspect ratio,
// bounded by maxWidth/maxHeight (logoWidth/logoHeight), without upscaling.
const useContainLogoSize = (uri, maxWidth, maxHeight) => {
  const [size, setSize] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      setSize(null);
      return undefined;
    }
    Image.getSize(
      uri,
      (naturalWidth, naturalHeight) => {
        if (cancelled || !naturalWidth || !naturalHeight) return;
        const ratio = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
        setSize({ width: naturalWidth * ratio, height: naturalHeight * ratio });
      },
      () => {
        if (!cancelled) setSize(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri, maxWidth, maxHeight]);

  return size;
};

const getItems = (raw, rawProps) => {
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.items?.items)) return raw.items.items;
  if (Array.isArray(rawProps?.items)) return unwrapDeep(rawProps.items, []);
  return [];
};

export default function SideNavigation({ section }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { closeSideMenu } = useSideMenu();
  const { logout, session, initializing } = useAuth();
  const isLoggedIn = isAuthenticatedSession(session);
  const rawProps = getPropsNode(section);
  const raw = buildRawProps(rawProps);
  const presentation = extractPresentation(section, rawProps);
  const metrics = presentation.metrics || {};
  const itemsArray = getItems(raw, rawProps);

  const visibility = raw?.visibility || {};
  const showHeader = asBoolean(visibility.header, true);
  const showHeaderText = asBoolean(visibility.headerText, true);
  const showItems = asBoolean(visibility.items, true);
  const showItemIcons = asBoolean(visibility.itemsIcons, true);
  const showItemText = asBoolean(visibility.itemsText, true);
  const showBgAndPadding = asBoolean(visibility.bgAndPadding, true);
  const showBgColor = showBgAndPadding && asBoolean(visibility.bgColor, true);
  const showBgImage = showBgAndPadding && asBoolean(visibility.bgImage, true);

  const backgroundImage = showBgImage
    ? toStringValue(firstDefined(raw?.backgroundImageUrl, raw?.bgImage), "")
    : "";
  const backgroundFit = toStringValue(raw?.bgImageScale, "Fill").trim().toLowerCase() === "fit" ? "contain" : "cover";
  const drawerWidth = getSideNavigationWidth(section);

  const showGradient = showBgAndPadding && asBoolean(visibility.gradient, true);
  const gradientFrom = showGradient ? toStringValue(raw?.gradientFrom, "") : "";
  const gradientTo = showGradient ? toStringValue(raw?.gradientTo, "") : "";
  const hasGradient = showGradient && !backgroundImage && Boolean(gradientFrom || gradientTo);
  const gradientColors = hasGradient ? [gradientFrom || "#00000000", gradientTo || "#ffffff"] : null;

  const drawerBgColor = !showBgAndPadding
    ? "#FFFFFF"
    : hasGradient
      ? undefined
      : showBgColor
        ? firstDefined(
          raw?.sideNavBgColor,
          raw?.drawerBgColor,
          raw?.sidebarBgColor,
          raw?.bgColor,
          presentation.drawer?.backgroundColor,
          "#FFFFFF"
        )
        : "transparent";

  const contentPadding = showBgAndPadding
    ? {
      paddingTop: toNumber(firstDefined(raw?.paddingTop, presentation.drawerPadding?.paddingTop), 0),
      paddingRight: toNumber(firstDefined(raw?.paddingRight, presentation.drawerPadding?.paddingRight), 0),
      paddingBottom: toNumber(firstDefined(raw?.paddingBottom, presentation.drawerPadding?.paddingBottom), 0),
      paddingLeft: toNumber(firstDefined(raw?.paddingLeft, presentation.drawerPadding?.paddingLeft), 0),
    }
    : { paddingTop: 30, paddingRight: 10, paddingBottom: 30, paddingLeft: 10 };

  const headerMetrics = metrics?.header || metrics?.elements?.header || {};
  const headerHeight = toNumber(firstDefined(raw?.headerHeight, headerMetrics?.height, presentation.headerRow?.height), undefined);

  // headerTextValue is the field the Inspector's rich-text editor actually
  // writes to; headerTitle/headerText are legacy keys that can linger stale
  // in an export after the title's been edited, so prefer the live one.
  const headerTitle = toStringValue(
    firstDefined(raw?.headerTextValue, raw?.headerTitle, raw?.headerText),
    "Mobidrag"
  );
  const subtitle = toStringValue(raw?.subtitle, "");
  const logoUrl = toStringValue(raw?.logoUrl, "");
  const brandKitLogoUrl = toStringValue(raw?._brandKitAssets?.logoUrl, "");
  const logoSource = resolveLogoSource(logoUrl, brandKitLogoUrl);
  // Inspector writes headerLogo + the legacy `uploadLogo` alias together —
  // the logo only shows when neither has been explicitly turned off.
  const showLogo =
    asBoolean(visibility.headerLogo, true) &&
    asBoolean(visibility.uploadLogo, true) &&
    Boolean(logoSource);
  const logoWidth = toNumber(raw?.logoWidth, 92);
  const logoHeight = toNumber(raw?.logoHeight, 36);
  const logoScale = toStringValue(raw?.logoScale, "Fit").trim().toLowerCase();
  const isLogoFit = logoScale === "fit";
  const fitLogoSize = useContainLogoSize(isLogoFit ? logoSource?.uri : null, logoWidth, logoHeight);
  const logoBoxStyle = isLogoFit
    ? {
      width: fitLogoSize?.width ?? logoWidth,
      height: fitLogoSize?.height ?? logoHeight,
      maxWidth: logoWidth,
      maxHeight: logoHeight,
    }
    : { width: logoWidth, height: logoHeight };

  const isHeaderCentered = String(raw?.headerAlign || "").trim().toLowerCase() === "center";

  const headerFontSize = toNumber(firstDefined(raw?.headerFontSize, raw?.fontSize), 24);
  const headerTextStyle = {
    color: firstDefined(raw?.headerColor, raw?.headerTextColor, "#000000"),
    fontSize: headerFontSize,
    fontWeight: asBoolean(raw?.headerBold, false)
      ? "700"
      : normalizeWeight(firstDefined(raw?.headerFontWeight, raw?.fontWeight), "700"),
    fontStyle: asBoolean(raw?.headerItalic, false) ? "italic" : "normal",
    textAlign: alignTextLeftOrCenter(raw?.headerAlign),
    textDecorationLine: textDecorationFor({
      underline: raw?.headerUnderline,
      strikethrough: raw?.headerStrikethrough,
    }),
    fontFamily: resolveFontFamily(raw?.headerFontFamily, raw?.fontFamily, "Inter"),
  };

  const itemsAlign = toStringValue(raw?.itemsAlign, "Left").trim().toLowerCase();
  const itemsIndent = toNumber(raw?.itemsIndent, 14);
  const isItemsCentered = itemsAlign === "center";

  // Measure each row's natural (unforced) content width so the whole list can
  // be centered as one straight-column block — the widest label sets the
  // shared row width, every row (and therefore every icon) aligns to it, and
  // that uniform block is centered. Purely dynamic: adapts to any labels,
  // icon sizes, or fonts the DSL sends, no hardcoded widths.
  const itemContentWidths = useRef({});
  const [maxItemContentWidth, setMaxItemContentWidth] = useState(0);
  const measureItemContent = useCallback(
    (key, width) => {
      if (!isItemsCentered || !width) return;
      if (itemContentWidths.current[key] === width) return;
      itemContentWidths.current[key] = width;
      const widest = Math.max(0, ...Object.values(itemContentWidths.current));
      setMaxItemContentWidth((prev) => (prev !== widest ? widest : prev));
    },
    [isItemsCentered]
  );

  const rowHeight = toNumber(firstDefined(raw?.itemRowHeight, presentation.itemRow?.height), 44);
  const rowGap = toNumber(firstDefined(raw?.itemGap, presentation.itemRow?.gap), 14);
  const iconBoxWidth = toNumber(firstDefined(presentation.itemIcon?.width, raw?.iconSize, raw?.iconWidth), 24);
  const iconBoxHeight = toNumber(firstDefined(presentation.itemIcon?.height, raw?.iconSize, raw?.iconHeight), iconBoxWidth);
  const itemIconSize = Math.max(10, Math.round(Math.min(iconBoxWidth, iconBoxHeight) * 0.85));
  const itemIconColor = firstDefined(raw?.itemsIconColor, raw?.itemIconColor, raw?.iconColor, presentation.itemIcon?.color, "#111827");
  const itemTextColor = firstDefined(raw?.itemsTextColor, raw?.itemTextColor, raw?.itemColor, presentation.itemText?.color, "#111827");
  const itemFontFamily = resolveFontFamily(raw?.itemFontFamily, raw?.itemsFontFamily, raw?.fontFamily, presentation.itemText?.fontFamily, "Inter");
  const itemFontSize = toNumber(
    firstDefined(raw?.itemFontSize, raw?.itemsFontSize, presentation.itemText?.fontSize, raw?.fontSize),
    14
  );
  const itemFontWeight = normalizeWeight(
    firstDefined(raw?.itemFontWeight, raw?.itemsFontWeight, presentation.itemText?.fontWeight, raw?.fontWeight),
    "700"
  );

  const showDivider = asBoolean(raw?.dividerLine, true) && showHeader;
  const dividerStyle = {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginTop: 6,
    marginBottom: 8,
  };

  const DrawerWrapper = backgroundImage ? ImageBackground : hasGradient ? LinearGradient : View;
  const drawerWrapperExtraProps = backgroundImage
    ? { source: { uri: backgroundImage }, imageStyle: styles.drawerImage, resizeMode: backgroundFit }
    : hasGradient
      ? { colors: gradientColors, angle: 180, useAngle: true }
      : {};

  const currentPageSlug = useMemo(() => {
    const routeName = route?.name ?? "";
    const pageName = route?.params?.pageName;
    if (pageName) return labelToSlug(String(pageName));
    if (routeName === "LayoutScreen") return "home";
    return "";
  }, [route?.name, route?.params?.pageName]);

  const isItemActive = useCallback(
    (item) => {
      if (!currentPageSlug || item.__authToggle) return false;
      const candidates = [item.id, item.title, item.label, item.link]
        .filter((value) => value !== undefined && value !== null && value !== "")
        .map((value) => labelToSlug(String(value).replace(/^\//, "")));
      return candidates.includes(currentPageSlug);
    },
    [currentPageSlug]
  );

  const items = useMemo(
    () => {
      const hasAuthToggle = itemsArray.some((item) => isAuthToggleItem(item));
      const authToggle = hasAuthToggle
        ? null
        : initializing
          ? null
          : isLoggedIn
            ? {
              id: "logout",
              label: toStringValue(firstDefined(raw?.logoutText, raw?.logoutLabel), "Logout"),
              icon: toStringValue(firstDefined(raw?.logoutIcon, "right-from-bracket"), "right-from-bracket"),
              __authToggle: true,
            }
            : {
              id: "login",
              label: toStringValue(firstDefined(raw?.loginText, raw?.loginLabel), "Login"),
              icon: toStringValue(firstDefined(raw?.loginIcon, "right-to-bracket"), "right-to-bracket"),
              link: "signin",
              __authToggle: true,
            };

      return [...itemsArray, authToggle].filter(Boolean);
    },
    [initializing, isLoggedIn, itemsArray, raw?.loginIcon, raw?.loginLabel, raw?.loginText, raw?.logoutIcon, raw?.logoutLabel, raw?.logoutText]
  );

  const handleItemPress = useCallback(
    (item) => {
      closeSideMenu?.();

      if (isLogoutItem(item)) {
        if (!isLoggedIn) {
          if (initializing) return;
          navigation.navigate("Auth", { initialMode: "login" });
          return;
        }
        Alert.alert(
          "Log Out",
          "Are you sure you want to log out?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Log Out",
              style: "destructive",
              onPress: async () => {
                await logout();
                navigation.reset({ index: 0, routes: [{ name: "Auth", params: { initialMode: "login" } }] });
              },
            },
          ],
          { cancelable: true }
        );
        return;
      }

      const itemLabelForNav = String(item?.title || item?.label || item?.text || "");
      const navigateType = String(item?.navigateType ?? item?.linkType ?? "").trim().toLowerCase();

      if (navigateType === "screen" && item?.navigateRef) {
        navigation.navigate(item.navigateRef);
        return;
      }

      const link = String(
        item?.link ?? item?.href ?? item?.url ?? item?.page ?? item?.navigateTo ?? ""
      ).trim();

      if (link === "/") {
        navigation.navigate("LayoutScreen");
        return;
      }

      const slug = link
        ? link.replace(/^\//, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-")
        : labelToSlug(itemLabelForNav);

      if (!slug) return;

      if (/^https?:\/\//i.test(link)) {
        navigation.navigate("CheckoutWebView", {
          url: link,
          title: itemLabelForNav || "Page",
        });
        return;
      }

      if (SIGNUP_SLUGS.has(slug)) {
        navigation.navigate("Auth", { initialMode: "signup" });
        return;
      }

      if (SIGNIN_SLUGS.has(slug)) {
        if (isLoggedIn) {
          navigation.navigate("BottomNavScreen", { pageName: "my-account", title: "My Account", link: "my-account" });
          return;
        }
        if (initializing) return;
        navigation.navigate("Auth", { initialMode: "login" });
        return;
      }

      if (slug === "home" || slug === "index") {
        navigation.navigate("LayoutScreen");
        return;
      }

      if (slug === "settings" || slug === "setting") {
        navigation.navigate("Settings", {
          pageName: "settings",
          title: itemLabelForNav || "Settings",
        });
        return;
      }

      navigateToDslTarget(navigation, {
        target: link || item?.navigateRef || item?.linkTo || slug,
        link: item?.link,
        href: item?.href,
        url: item?.url,
        linkTo: item?.linkTo,
        navigateRef: item?.navigateRef ?? item?.page ?? item?.screen,
        navigateType: item?.navigateType ?? item?.linkType,
        id: item?.id,
        label: itemLabelForNav,
        fallbackTitle: itemLabelForNav || slug,
        preferPush: true,
      });
    },
    [closeSideMenu, initializing, isLoggedIn, logout, navigation]
  );

  const itemTextOverrides = useCallback(
    (item) => ({
      fontWeight: asBoolean(item?.titleBold, false) ? "700" : itemFontWeight,
      fontStyle: asBoolean(item?.titleItalic, false) ? "italic" : "normal",
      textDecorationLine: textDecorationFor({
        underline: item?.titleUnderline,
        strikethrough: item?.titleStrikethrough,
      }),
    }),
    [itemFontWeight]
  );

  if (!showHeader && !showItems) return null;

  return (
    <DrawerWrapper
      {...drawerWrapperExtraProps}
      style={[
        styles.drawer,
        presentation.drawer,
        {
          width: drawerWidth,
          minWidth: drawerWidth,
          ...(drawerBgColor !== undefined ? { backgroundColor: drawerBgColor } : null),
        },
        backgroundImage ? styles.drawerWithBackground : null,
      ]}
    >
      <View style={[styles.drawerContent, contentPadding]}>
        {showHeader && (
          <>
            <View
              style={[
                styles.headerRow,
                presentation.headerRow,
                {
                  minHeight: headerHeight,
                  justifyContent: alignJustifyLeftOrCenter(raw?.headerAlign),
                },
              ]}
            >
              {showLogo ? (
                <Image
                  source={logoSource}
                  style={logoBoxStyle}
                  resizeMode="contain"
                />
              ) : null}
              {showHeaderText && !!headerTitle && (
                <View style={isHeaderCentered ? styles.headerTextWrapCentered : styles.headerTextWrap}>
                  <Text style={[styles.headerTitle, headerTextStyle]} numberOfLines={1}>
                    {headerTitle}
                  </Text>
                  {!!subtitle && (
                    <Text
                      style={[
                        styles.subtitle,
                        {
                          color: firstDefined(raw?.subtextColor, raw?.headerTextColor, raw?.headerColor, "#6B7280"),
                          ...(resolveFontFamily(raw?.subtextFontFamily, raw?.fontFamily) ? {
                            fontFamily: resolveFontFamily(raw?.subtextFontFamily, raw?.fontFamily),
                          } : {}),
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {showDivider && <View style={dividerStyle} />}
          </>
        )}

        {showItems && (
          <View
            style={
              isItemsCentered
                ? { alignItems: "center" }
                : { paddingLeft: itemsIndent }
            }
          >
            {items.map((item) => {
              const itemLabel =
                isLogoutItem(item) && !isLoggedIn && !initializing
                  ? toStringValue(firstDefined(raw?.loginText, raw?.loginLabel), "Login")
                  : (item.title || item.label || item.text || "Untitled");
              const hideAuthIcon = item.__authToggle && asBoolean(raw?.showLogoutIcon, true) === false;
              const customIconUrl = getCustomIconUrlFromValue(item.icon);
              const active = isItemActive(item);
              const itemKey = item.id || itemLabel;

              return (
                <TouchableOpacity
                  key={itemKey}
                  onLayout={
                    isItemsCentered
                      ? (event) => measureItemContent(itemKey, event.nativeEvent.layout.width)
                      : undefined
                  }
                  style={[
                    styles.itemRow,
                    presentation.itemRow,
                    {
                      minHeight: rowHeight,
                      gap: rowGap,
                      justifyContent: "flex-start",
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: active ? "rgba(9, 109, 112, 0.1)" : "transparent",
                    },
                    isItemsCentered && maxItemContentWidth > 0 ? { width: maxItemContentWidth } : null,
                  ]}
                  onPress={() => handleItemPress(item)}
                  accessibilityRole="button"
                  accessibilityLabel={itemLabel}
                  activeOpacity={0.7}
                >
                  {showItemIcons && !hideAuthIcon && (
                    <View style={[styles.itemIconWrap, { width: iconBoxWidth, height: iconBoxHeight }]}>
                      {customIconUrl ? (
                        <Image
                          source={{ uri: customIconUrl }}
                          style={{ width: itemIconSize, height: itemIconSize }}
                          resizeMode="contain"
                        />
                      ) : (
                        <Icon
                          name={normalizeIconName(item.icon)}
                          size={itemIconSize}
                          color={itemIconColor}
                        />
                      )}
                    </View>
                  )}
                  {showItemText && (
                    <Text
                      style={[
                        styles.itemText,
                        presentation.itemText,
                        {
                          color: itemTextColor,
                          fontSize: itemFontSize,
                          fontWeight: itemFontWeight,
                          ...(itemFontFamily ? { fontFamily: itemFontFamily } : {}),
                        },
                        itemTextOverrides(item),
                      ]}
                      numberOfLines={1}
                    >
                      {itemLabel}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </DrawerWrapper>
  );
}

const styles = StyleSheet.create({
  drawer: {
    height: "100%",
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
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTextWrapCentered: {
    flexShrink: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: "#111827",
  },
  subtitle: {
    marginTop: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
});

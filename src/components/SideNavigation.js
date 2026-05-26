import React, { useCallback, useMemo } from "react";
import { Alert, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome6";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";
import { isAuthenticatedSession } from "../utils/authGate";
import { getAppLogoSync, getAppNameSync } from "../utils/appInfo";
import { resolveFont } from "../services/typographyService";

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

const normalizeTextAlign = (align, fallback = "left") => {
  const lowered = String(align || "").trim().toLowerCase();
  if (lowered === "center") return "center";
  if (lowered === "right" || lowered === "end") return "right";
  return fallback;
};

const alignToJustify = (align, fallback = "flex-start") => {
  const lowered = String(align || "").trim().toLowerCase();
  if (lowered === "center") return "center";
  if (lowered === "right" || lowered === "end") return "flex-end";
  return fallback;
};

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
  const label = String(item?.label || item?.title || item?.text || "").trim().toLowerCase();
  return ["logout", "log out"].includes(label);
};

const isAuthToggleItem = (item) => {
  const label = String(item?.label || item?.title || item?.text || "").trim().toLowerCase();
  return ["logout", "log out", "login", "log in", "signin", "sign in"].includes(label);
};

const SIGNIN_SLUGS = new Set(["signin", "sign-in", "login", "log-in", "auth"]);

const labelToSlug = (label) =>
  String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const resolveLogoSource = (logoUrl) => {
  const appLogo = getAppLogoSync();
  const resolvedLogo = logoUrl && logoUrl !== "/images/mobidrag.png" ? logoUrl : appLogo;
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

const getItems = (raw, rawProps) => {
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.items?.items)) return raw.items.items;
  if (Array.isArray(rawProps?.items)) return unwrapDeep(rawProps.items, []);
  return [];
};

export default function SideNavigation({ section }) {
  const navigation = useNavigation();
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

  const backgroundImage = toStringValue(firstDefined(raw?.backgroundImageUrl, raw?.bgImage), "");
  const backgroundFit = toStringValue(firstDefined(raw?.bgImageFit, raw?.bgImageScale), "cover");
  const drawerWidth = getSideNavigationWidth(section);
  const drawerBgColor = firstDefined(raw?.backgroundColor, raw?.bgColor, presentation.drawer?.backgroundColor, "#FFFFFF");

  const contentPadding = {
    paddingTop: toNumber(firstDefined(raw?.paddingTop, presentation.drawerPadding?.paddingTop, raw?.pt), 0),
    paddingRight: toNumber(firstDefined(raw?.paddingRight, presentation.drawerPadding?.paddingRight, raw?.pr), 0),
    paddingBottom: toNumber(firstDefined(raw?.paddingBottom, presentation.drawerPadding?.paddingBottom, raw?.pb), 0),
    paddingLeft: toNumber(firstDefined(raw?.paddingLeft, presentation.drawerPadding?.paddingLeft, raw?.pl), 0),
  };

  const headerMetrics = metrics?.header || metrics?.elements?.header || {};
  const firstItemMetrics = Array.isArray(metrics?.items)
    ? metrics.items[0]?.row
    : metrics?.elements?.items?.[0]?.row;
  const headerHeight = toNumber(firstDefined(raw?.headerHeight, headerMetrics?.height, presentation.headerRow?.height), undefined);
  const dividerHeight = toNumber(firstDefined(raw?.dividerSize, raw?.dividerHeight), 1);
  const measuredDividerGap =
    toNumber(firstItemMetrics?.y, undefined) !== undefined &&
    toNumber(headerMetrics?.y, undefined) !== undefined &&
    headerHeight !== undefined
      ? Math.max(0, toNumber(firstItemMetrics.y, 0) - (toNumber(headerMetrics.y, 0) + headerHeight) - dividerHeight)
      : undefined;

  const headerTitle = toStringValue(
    firstDefined(raw?.headerTextValue, raw?.headerTitle, raw?.logoText),
    getAppNameSync()
  );
  const subtitle = toStringValue(raw?.subtitle, "");
  const logoUrl = toStringValue(raw?.logoUrl, "");
  const logoSource = resolveLogoSource(logoUrl);
  const showLogo = asBoolean(visibility.headerLogo ?? visibility.logo, Boolean(logoSource));

  const headerFontSize = toNumber(firstDefined(raw?.headerFontSize, raw?.fontSize), 18);
  const headerTextStyle = {
    color: firstDefined(raw?.headerTextColor, raw?.headerColor, "#111827"),
    fontSize: headerFontSize,
    fontWeight: asBoolean(raw?.headerBold, false)
      ? "700"
      : normalizeWeight(firstDefined(raw?.headerFontWeight, raw?.fontWeight), "400"),
    fontStyle: asBoolean(raw?.headerItalic, false) ? "italic" : "normal",
    textAlign: normalizeTextAlign(raw?.headerAlign, "left"),
    textDecorationLine: textDecorationFor({
      underline: raw?.headerUnderline,
      strikethrough: raw?.headerStrikethrough,
    }),
    ...(resolveFontFamily(raw?.headerFontFamily, raw?.fontFamily) ? {
      fontFamily: resolveFontFamily(raw?.headerFontFamily, raw?.fontFamily),
    } : {}),
  };

  const rowHeight = toNumber(firstDefined(raw?.itemRowHeight, presentation.itemRow?.height), 44);
  const rowGap = toNumber(firstDefined(raw?.itemGap, presentation.itemRow?.gap), 12);
  const iconBoxWidth = toNumber(firstDefined(presentation.itemIcon?.width, raw?.iconSize, raw?.iconWidth), 24);
  const iconBoxHeight = toNumber(firstDefined(presentation.itemIcon?.height, raw?.iconSize, raw?.iconHeight), iconBoxWidth);
  const itemIconSize = toNumber(firstDefined(raw?.iconWidth, raw?.iconHeight, raw?.iconSize, presentation.itemIcon?.width), Math.min(iconBoxWidth, iconBoxHeight));
  const itemIconColor = firstDefined(raw?.iconColor, presentation.itemIcon?.color, "#111827");
  const itemTextColor = firstDefined(raw?.itemColor, presentation.itemText?.color, "#111827");
  const itemFontFamily = resolveFontFamily(raw?.itemFontFamily, raw?.itemsFontFamily, raw?.fontFamily, presentation.itemText?.fontFamily);
  const itemFontSize = toNumber(
    firstDefined(raw?.itemFontSize, raw?.itemsFontSize, presentation.itemText?.fontSize, raw?.fontSize),
    14
  );
  const itemFontWeight = normalizeWeight(
    firstDefined(raw?.itemFontWeight, raw?.itemsFontWeight, presentation.itemText?.fontWeight, raw?.fontWeight),
    "400"
  );

  const showDivider = asBoolean(raw?.dividerLine, false) && showHeader && showItems;
  const dividerColor = firstDefined(raw?.dividerColor, raw?.headerColor, "#E5E7EB");
  const dividerStyle = {
    height: dividerHeight,
    backgroundColor: dividerColor,
    marginBottom: toNumber(firstDefined(raw?.dividerGap, raw?.dividerSpacing, measuredDividerGap), 0),
  };

  const DrawerWrapper = backgroundImage ? ImageBackground : View;
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

      const link = String(
        item?.link ?? item?.href ?? item?.url ?? item?.page ?? item?.navigateTo ?? ""
      ).trim();

      const slug = link
        ? link.replace(/^\//, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-")
        : labelToSlug(item?.label || item?.title || item?.text || "");

      if (!slug) return;

      if (/^https?:\/\//i.test(link)) {
        navigation.navigate("CheckoutWebView", {
          url: link,
          title: String(item?.label || item?.title || item?.text || "Page"),
        });
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
        navigation.navigate("Settings");
        return;
      }

      navigation.push("BottomNavScreen", {
        pageName: slug,
        title: String(item?.label || item?.title || item?.text || slug),
        hideBottomNav: true,
      });
    },
    [initializing, isLoggedIn, logout, navigation]
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
      source={backgroundImage ? { uri: backgroundImage } : undefined}
      style={[
        styles.drawer,
        presentation.drawer,
        {
          width: drawerWidth,
          minWidth: drawerWidth,
          backgroundColor: backgroundImage ? "transparent" : drawerBgColor,
        },
        backgroundImage ? styles.drawerWithBackground : null,
      ]}
      imageStyle={backgroundImage ? styles.drawerImage : undefined}
      resizeMode={backgroundImage ? backgroundFit : undefined}
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
                  justifyContent: alignToJustify(raw?.headerAlign, "flex-start"),
                },
              ]}
            >
              {showLogo && logoSource ? <Image source={logoSource} style={styles.logoImage} /> : null}
              {showHeaderText && (
                <View style={styles.headerTextWrap}>
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

        {showItems &&
          items.map((item) => {
            const itemLabel =
              isLogoutItem(item) && !isLoggedIn && !initializing
                ? toStringValue(firstDefined(raw?.loginText, raw?.loginLabel), "Login")
                : (item.label || item.title || item.text);
            const hideAuthIcon = item.__authToggle && asBoolean(raw?.showLogoutIcon, true) === false;

            return (
              <TouchableOpacity
                key={item.id || itemLabel}
                style={[
                  styles.itemRow,
                  presentation.itemRow,
                  {
                    minHeight: rowHeight,
                    gap: rowGap,
                    justifyContent: alignToJustify(raw?.itemsAlign, "flex-start"),
                  },
                ]}
                onPress={() => handleItemPress(item)}
                accessibilityRole="button"
                accessibilityLabel={itemLabel}
                activeOpacity={0.7}
              >
                {showItemIcons && !hideAuthIcon && (
                  <View style={[styles.itemIconWrap, { width: iconBoxWidth, height: iconBoxHeight }]}>
                    <Icon
                      name={normalizeIconName(item.icon)}
                      size={itemIconSize}
                      color={itemIconColor}
                    />
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
  headerTitle: {
    color: "#111827",
  },
  subtitle: {
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

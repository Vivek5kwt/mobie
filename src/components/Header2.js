import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StackActions, useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useSelector } from "react-redux";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";
import { useSideMenu } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { searchShopifyProducts } from "../services/shopify";

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

const resolveValue = (input, defaultValue = undefined) => {
  if (input === undefined || input === null) return defaultValue;

  if (typeof input === "object") {
    if (input.value !== undefined) return input.value;
    if (input.properties?.value !== undefined) return input.properties.value;
    if (input.const !== undefined) return input.const;
  }

  return input;
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
  console.log("🔍 Header2 section:", JSON.stringify(section, null, 2));

  const { toggleSideMenu, hasSideNav } = useSideMenu();
  const navigation = useNavigation();
  const bottomNavSection = section?.bottomNavSection || bottomNavigationStyle1Section;
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => {
      const quantity = Number(item?.quantity);
      return sum + (Number.isFinite(quantity) ? quantity : 1);
    }, 0)
  );
  const formattedCartCount = cartCount > 99 ? "99+" : String(cartCount);

  let props, styleBlock, greeting, profile, searchAndIcons, appBar;
  
  if (section?.props) {
    props = section.props;
    styleBlock = props.styles || {};  
    greeting = props.greeting || {};
    profile = props.profile || {};
    searchAndIcons = props.searchAndIcons || {};
    appBar = props.appBar || {};
    console.log("✅ Using LIVE format");
  } 
  else if (section?.properties?.props?.properties) {
    props = section.properties.props.properties;
    styleBlock = props.style?.properties || {};  
    greeting = props.greeting || {};
    profile = props.profile || {};
    searchAndIcons = props.searchAndIcons || {};
    appBar = props.appBar || {};
    console.log("✅ Using DUMMY format");
  } else {
    console.log("❌ No valid format found");
    return null;
  }
  
  console.log("📊 Style keys:", Object.keys(styleBlock));
  console.log("👋 Greeting:", greeting);
  console.log("🔍 Profile:", profile);
  
  const containerStyle = { ...(styleBlock?.container || {}) };
  const topRowStyle = styleBlock?.topRow || {};
  const profileStyle = styleBlock?.profile || {};
  const greetingTitleStyle = styleBlock?.greetingTitle || styleBlock?.greeting || {};
  const greetingNameStyle = styleBlock?.greetingName || styleBlock?.greeting || {};
  const searchContainerStyle = styleBlock?.searchContainer || {};
  
  const searchBarStyle = styleBlock?.searchBar || styleBlock?.searchInput || {};
  const searchBarInputStyle = styleBlock?.searchBarInput || {};
  const notificationContainerStyle = styleBlock?.notificationContainer || {};
  const badgeStyle = styleBlock?.badge || {};
  
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
  if (greeting.fontWeight) greetingTextStyle.fontWeight = greeting.fontWeight;
  if (greeting.fontStyle) greetingTextStyle.fontStyle = greeting.fontStyle;
  if (greeting.textDecoration) greetingTextStyle.textDecorationLine = greeting.textDecoration;
  
  const placeholderColor = searchAndIcons?.placeholderColor || "#4B4B4B";
  const searchPlaceholder = resolveValue(
    searchAndIcons?.searchPlaceholder,
    resolveValue(searchAndIcons?.placeholder, "Search products"),
  );

  const profileBorderWidth = profile?.borderWidth ||
                            (profileStyle.borderWidth ? parseFloat(profileStyle.borderWidth) : 4);

  const appBarContainerStyle = appBar?.containerStyle || appBar?.style || styleBlock?.appBar || {};
  const appBarTitleStyle = appBar?.titleStyle || {};
  const appBarSubtitleStyle = appBar?.subtitleStyle || {};

  const greetingEnabled = resolveBooleanSetting(props?.greetingSettingsEnabled);
  const searchEnabled = resolveBooleanSetting(props?.searchSettingsEnabled);
  const notificationEnabled = resolveBooleanSetting(props?.notificationSettingsEnabled);
  const profileEnabled = resolveBooleanSetting(props?.profileSettingsEnabled);
  const hasGreeting = greetingEnabled && !!(greeting?.title || greeting?.name);

  const hasLeftIcon = !!appBar?.leftIcon;

  const shouldShowSearchRow =
    (searchEnabled && searchAndIcons?.showSearch) ||
    (notificationEnabled && searchAndIcons?.showNotification);
  const shouldShowSideMenu = false;
  const shouldShowSearchRowOrMenu = shouldShowSearchRow || shouldShowSideMenu;
  const shouldShowTopRow = hasGreeting || (profileEnabled && profile?.show);
  const searchLimit = resolveValue(searchAndIcons?.searchLimit, 10);
  const detailSections = useMemo(() => extractDetailSections(props), [props]);

  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const shouldShowAppBar = !!(appBar?.show ?? (
    appBar && (
      appBar.title ||
      appBar.subtitle ||
      appBar.leftIcon ||
      (appBar.rightIcons && appBar.rightIcons.length > 0)
    )
  ));

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
              <Text style={styles.cartBadgeText}>{formattedCartCount}</Text>
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

      {/* Top Row */}
      {shouldShowTopRow && (
        <View style={convertStyles(topRowStyle)}>
          {hasGreeting && (
            <View>
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
            <View
              style={[
                convertStyles(profileStyle),
                profile.borderColor && { borderColor: profile.borderColor },
                profileBorderWidth && { borderWidth: profileBorderWidth },
                profile.backgroundColor && { backgroundColor: profile.backgroundColor },
                { overflow: "hidden" },
              ]}
            >
              {profile?.image ? (
                <Image
                  source={{ uri: profile.image }}
                  style={{
                    width: profile?.size || 30,
                    height: profile?.size || 30,
                    borderRadius: (profile?.size || 30) / 2,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <FontAwesome
                  name="user"
                  size={profile?.size || 30}
                  color={profile?.borderColor || "#0E6A70"}
                />
              )}
            </View>
          )}
        </View>
      )}

      {shouldShowSearchRowOrMenu ? (
        <View style={convertStyles(searchContainerStyle)}>
          {shouldShowSideMenu && (
            <TouchableOpacity
              onPress={toggleSideMenu}
              activeOpacity={0.7}
              style={{ alignItems: "center", justifyContent: "center" }}
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
            <View style={convertStyles(searchBarStyle)}>
              <FontAwesome
                name="search"
                size={18}
                color={searchAndIcons?.searchIconColor || "#39444D"}
              />
              <TextInput
                value={searchValue}
                onChangeText={setSearchValue}
                placeholder={searchPlaceholder}
                placeholderTextColor={placeholderColor}
                style={convertStyles(searchBarInputStyle)}
                underlineColorAndroid="transparent"
                selectionColor="#131A1D"
              />
            </View>
          )}

          {notificationEnabled && searchAndIcons?.showNotification && (
            <TouchableOpacity
              style={convertStyles(notificationContainerStyle)}
              activeOpacity={0.7}
              onPress={() => openBottomNavTarget("notification")}
            >
              <View>
                <FontAwesome
                  name="bell"
                  size={searchAndIcons?.notificationIconSize || 36}
                  color={searchAndIcons?.notificationIconColor || "#FFFFFF"}
                />
                {searchAndIcons?.showBadge && <View style={convertStyles(badgeStyle)} />}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});

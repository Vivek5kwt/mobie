import React from "react";
import { View, Text, TextInput, Image, TouchableOpacity } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";

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

export default function Header2({ section }) {
  console.log("🔍 Header2 section:", JSON.stringify(section, null, 2));

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

  const shouldShowAppBar = !!(appBar?.show ?? (
    appBar && (
      appBar.title ||
      appBar.subtitle ||
      appBar.leftIcon ||
      (appBar.rightIcons && appBar.rightIcons.length > 0)
    )
  ));

  const renderIconButton = (icon, index, extraStyle) => {
    if (!icon) return null;

    const iconContainer = icon.containerStyle || {};
    const fallbackSize = icon.size || 20;

    return (
      <TouchableOpacity
        key={index}
        style={[convertStyles(iconContainer), extraStyle]}
        activeOpacity={icon?.onPress ? 0.7 : 1}
        onPress={icon?.onPress}
        disabled={!icon?.onPress}
      >
        <FontAwesome
          name={icon.name || icon.icon || "circle"}
          size={fallbackSize}
          color={icon.color || "#131A1D"}
        />
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

      {shouldShowSearchRow ? (
        <View style={convertStyles(searchContainerStyle)}>
          {searchEnabled && searchAndIcons?.showSearch && (
            <View style={convertStyles(searchBarStyle)}>
              <FontAwesome
                name="search"
                size={18}
                color={searchAndIcons?.searchIconColor || "#39444D"}
              />
              <TextInput
                placeholder={searchPlaceholder}
                placeholderTextColor={placeholderColor}
                style={convertStyles(searchBarInputStyle)}
                underlineColorAndroid="transparent"
                selectionColor="#131A1D"
              />
            </View>
          )}

          {notificationEnabled && searchAndIcons?.showNotification && (
            <View style={convertStyles(notificationContainerStyle)}>
              <FontAwesome
                name="bell"
                size={searchAndIcons?.notificationIconSize || 36}
                color={searchAndIcons?.notificationIconColor || "#FFFFFF"}
              />
              {searchAndIcons?.showBadge && <View style={convertStyles(badgeStyle)} />}
            </View>
          )}
        </View>
      ) : null}
    </LinearGradient>
  );
}

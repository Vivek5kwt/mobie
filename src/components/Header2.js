import React from "react";
import { View, Text, TextInput, useWindowDimensions } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";

export default function Header2({ section }) {
  const { width } = useWindowDimensions();
  const isCompact = width < 400;
  const isTablet = width >= 768;
  const baseSpacing = isTablet ? 20 : isCompact ? 12 : 16;

  console.log("🔍 Header2 section:", JSON.stringify(section, null, 2));
  
  let props, styleBlock, greeting, profile, searchAndIcons;
  
  if (section?.props) {
    props = section.props;
    styleBlock = props.styles || {};  
    greeting = props.greeting || {};
    profile = props.profile || {};
    searchAndIcons = props.searchAndIcons || {};
    console.log("✅ Using LIVE format");
  } 
  else if (section?.properties?.props?.properties) {
    props = section.properties.props.properties;
    styleBlock = props.style?.properties || {};  
    greeting = props.greeting || {};
    profile = props.profile || {};
    searchAndIcons = props.searchAndIcons || {};
    console.log("✅ Using DUMMY format");
  } else {
    console.log("❌ No valid format found");
    return null;
  }
  
  console.log("📊 Style keys:", Object.keys(styleBlock));
  console.log("👋 Greeting:", greeting);
  console.log("🔍 Profile:", profile);
  
  const containerStyle = styleBlock?.container || {};
  const topRowStyle = styleBlock?.topRow || {};
  const profileStyle = styleBlock?.profile || {};
  const greetingTitleStyle = styleBlock?.greetingTitle || styleBlock?.greeting || {};
  const greetingNameStyle = styleBlock?.greetingName || styleBlock?.greeting || {};
  const searchContainerStyle = styleBlock?.searchContainer || {};
  
  const searchBarStyle = styleBlock?.searchBar || styleBlock?.searchInput || {};
  const searchBarInputStyle = styleBlock?.searchBarInput || {};
  const notificationContainerStyle = styleBlock?.notificationContainer || {};
  const badgeStyle = styleBlock?.badge || {};

  const containerStyles = {
    ...convertStyles(containerStyle),
    paddingHorizontal: containerStyle?.paddingHorizontal ?? baseSpacing,
    paddingVertical: containerStyle?.paddingVertical ?? baseSpacing,
    borderRadius: containerStyle?.borderRadius ?? 18,
  };

  const topRowStyles = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: isCompact ? 10 : 14,
    rowGap: 6,
    ...convertStyles(topRowStyle),
  };

  const profileContainerStyle = {
    ...convertStyles(profileStyle),
    justifyContent: "center",
    alignItems: "center",
  };

  const searchContainerStyles = {
    ...convertStyles(searchContainerStyle),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: isCompact ? 10 : 14,
    flexWrap: isCompact ? "wrap" : "nowrap",
  };

  const searchWrapperStyle = {
    ...convertStyles(searchBarStyle),
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    paddingHorizontal:
      searchBarStyle?.paddingHorizontal ?? (isCompact ? 10 : 12),
    paddingVertical:
      searchBarStyle?.paddingVertical ?? (isCompact ? 6 : 8),
    borderRadius: searchBarStyle?.borderRadius ?? 14,
    flex: 1,
    width: isCompact ? "100%" : undefined,
  };

  const notificationWrapperStyle = {
    ...convertStyles(notificationContainerStyle),
    marginLeft: isCompact ? 10 : 14,
    alignItems: "center",
    justifyContent: "center",
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
}
  else {
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
  
  const placeholderColor = searchAndIcons?.placeholderColor ||
    searchBarInputStyle?.color ||
    "#4B4B4B";

  const searchIconSize = searchAndIcons?.searchIconSize || 18;

  const searchInputColor = searchAndIcons?.inputTextColor || searchBarInputStyle?.color;
  const searchSelectionColor = searchAndIcons?.selectionColor || searchInputColor || "#131A1D";

  const searchInputStyle = [
    convertStyles(searchBarInputStyle),
    { flex: 1, minWidth: isCompact ? 160 : 0 },
    searchInputColor ? { color: searchInputColor } : null
  ];
  
  const profileBorderWidth = profile?.borderWidth || 
                            (profileStyle.borderWidth ? parseFloat(profileStyle.borderWidth) : 4);
  
  return (
    <LinearGradient
      style={containerStyles}
      colors={gradientColors}
      angle={gradientAngle}
      useAngle={true}
    >
      {/* Top Row */}
      <View style={topRowStyles}>
        <View>
          <Text style={[convertStyles(greetingTitleStyle), greetingTextStyle]}>
            {greeting?.title || "Welcome"}
          </Text>
          <Text style={[convertStyles(greetingNameStyle), greetingTextStyle]}>
            {greeting?.name || "User"}
          </Text>
        </View>

        {profile?.show && (
          <View style={[
            profileContainerStyle,
            profile.borderColor && { borderColor: profile.borderColor },
            profileBorderWidth && { borderWidth: profileBorderWidth },
            profile.backgroundColor && { backgroundColor: profile.backgroundColor }
          ]}>
            <FontAwesome
              name="user"
              size={profile?.size || 30}
              color={profile?.borderColor || "#0E6A70"}
            />
          </View>
        )}
      </View>

      <View style={searchContainerStyles}>
        {searchAndIcons?.showSearch && (
          <View style={searchWrapperStyle}>
            <FontAwesome
              name="search"
              size={searchIconSize}
              color={searchAndIcons?.searchIconColor || "#39444D"}
            />
            <TextInput
              placeholder={searchAndIcons?.placeholder || "Search products"}
              placeholderTextColor={placeholderColor}
              style={searchInputStyle}
              underlineColorAndroid="transparent"
              selectionColor={searchSelectionColor}
            />
          </View>
        )}

        {searchAndIcons?.showNotification && (
          <View style={notificationWrapperStyle}>
            <FontAwesome
              name="bell"
              size={searchAndIcons?.notificationIconSize || 36}
              color={searchAndIcons?.notificationIconColor || "#FFFFFF"}
            />
            {searchAndIcons?.showBadge && <View style={convertStyles(badgeStyle)} />}
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

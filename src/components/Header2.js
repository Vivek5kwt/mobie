import React from "react";
import { View, Text, TextInput, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";

export default function Header2({ section }) {
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
  
  const placeholderColor = searchAndIcons?.placeholderColor || "#4B4B4B";
  
  const profileBorderWidth = profile?.borderWidth || 
                            (profileStyle.borderWidth ? parseFloat(profileStyle.borderWidth) : 4);
  
  return (
    <LinearGradient
      style={convertStyles(containerStyle)}
      colors={gradientColors}
      angle={gradientAngle}
      useAngle={true}
    >
      {/* Top Row */}
      <View style={convertStyles(topRowStyle)}>
        <View>
          <Text style={[convertStyles(greetingTitleStyle), greetingTextStyle]}>
            {greeting?.title || "Welcome"}
          </Text>
          <Text style={[convertStyles(greetingNameStyle), greetingTextStyle]}>
            {greeting?.name || "User"}
          </Text>
        </View>

        {profile?.show && (
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

      <View style={convertStyles(searchContainerStyle)}>
        {searchAndIcons?.showSearch && (
          <View style={convertStyles(searchBarStyle)}>
            <FontAwesome 
              name="search" 
              size={18} 
              color={searchAndIcons?.searchIconColor || "#39444D"} 
            />
            <TextInput
              placeholder={searchAndIcons?.placeholder || "Search products"}
              placeholderTextColor={placeholderColor}
              style={convertStyles(searchBarInputStyle)}
              underlineColorAndroid="transparent"
              selectionColor="#131A1D"
            />
          </View>
        )}

        {searchAndIcons?.showNotification && (
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
    </LinearGradient>
  );
}

import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";

const unwrap = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return unwrap(value.value, fallback);
    if (value.const !== undefined) return unwrap(value.const, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrap(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(String(resolved));
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrap(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

export const buildFavoriteToggleConfig = (raw = {}, styleNode = {}) => {
  const favoriteIconId = firstDefined(
    raw.favoriteIconId,
    raw.favoriteIcon,
    raw.favIcon,
    styleNode?.icon?.active,
    styleNode?.activeIcon,
    "fa-heart"
  );
  const unfavoriteIconId = firstDefined(
    raw.unfavoriteIconId,
    raw.unfavoriteIcon,
    raw.unfavIcon,
    styleNode?.icon?.inactive,
    styleNode?.inactiveIcon,
    "fa-heart-o"
  );
  const favoriteIconSize = toNumber(
    firstDefined(raw.favIconSize, raw.favoriteIconSize, raw.favoriteSize, styleNode?.fontSize, styleNode?.icon?.size),
    18
  );
  const unfavoriteIconSize = toNumber(
    firstDefined(raw.unfavoriteIconSize, raw.unfavIconSize, raw.favoriteInactiveSize),
    favoriteIconSize
  );

  return {
    favoriteIconName: resolveFA4IconName(toString(favoriteIconId, "fa-heart")) || "heart",
    unfavoriteIconName: resolveFA4IconName(toString(unfavoriteIconId, "fa-heart-o")) || "heart-o",
    favoriteIconSize,
    unfavoriteIconSize,
    favoriteIconColor: toString(
      firstDefined(
        raw.favoriteIconColor,
        raw.favoriteColor,
        raw.likedIconColor,
        raw.likedFavoriteIconColor,
        raw.wishlistActiveIconColor,
        styleNode?.activeColor
      ),
      "#EF4444"
    ),
    unfavoriteIconColor: toString(
      firstDefined(
        raw.unfavoriteIconColor,
        raw.unfavoriteColor,
        raw.favIconInactiveColor,
        raw.favIconColor,
        raw.favColor,
        styleNode?.inactiveColor,
        styleNode?.color
      ),
      "#9CA3AF"
    ),
    bubbleColor: toString(
      firstDefined(raw.favBubbleBgColor, raw.favoriteBackgroundColor, raw.favoriteBgColor, raw.favBgColor, styleNode?.backgroundColor),
      "#FFFFFF"
    ),
    position: toString(firstDefined(raw.favPosition, raw.favoritePosition), "top-right").toLowerCase(),
    inset: toNumber(firstDefined(raw.favBubbleInset, raw.favBubbleOffset, raw.favoriteInset), 12),
    paddingTop: toNumber(firstDefined(raw.favBubblePadT, raw.favoritePaddingTop), 0),
    paddingRight: toNumber(firstDefined(raw.favBubblePadR, raw.favoritePaddingRight), 0),
    paddingBottom: toNumber(firstDefined(raw.favBubblePadB, raw.favoritePaddingBottom), 0),
    paddingLeft: toNumber(firstDefined(raw.favBubblePadL, raw.favoritePaddingLeft), 0),
  };
};

const resolvePositionStyle = (position, inset) => {
  const normalized = String(position || "top-right").toLowerCase();
  const style = {};
  if (normalized.includes("top")) style.top = inset;
  if (normalized.includes("bottom")) style.bottom = inset;
  if (normalized.includes("left")) style.left = inset;
  if (normalized.includes("right")) style.right = inset;
  if (style.top === undefined && style.bottom === undefined) style.top = inset;
  if (style.left === undefined && style.right === undefined) style.right = inset;
  return style;
};

export default function FavoriteToggleButton({
  isFavorite,
  onPress,
  config,
  style,
  accessibilityLabel,
  hitSlop = { top: 12, bottom: 12, left: 12, right: 12 },
}) {
  const resolvedConfig = config || buildFavoriteToggleConfig();
  const iconSize = isFavorite
    ? resolvedConfig.favoriteIconSize
    : resolvedConfig.unfavoriteIconSize || resolvedConfig.favoriteIconSize;
  const iconColor = isFavorite ? resolvedConfig.favoriteIconColor : resolvedConfig.unfavoriteIconColor;
  const iconName = isFavorite ? resolvedConfig.favoriteIconName : resolvedConfig.unfavoriteIconName;
  const bubblePadding = Math.max(
    resolvedConfig.paddingTop || 0,
    resolvedConfig.paddingRight || 0,
    resolvedConfig.paddingBottom || 0,
    resolvedConfig.paddingLeft || 0,
    0
  );
  const bubbleSize = Math.max(30, iconSize + bubblePadding * 2);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        resolvePositionStyle(resolvedConfig.position, resolvedConfig.inset),
        {
          width: bubbleSize,
          height: bubbleSize,
          borderRadius: bubbleSize / 2,
          backgroundColor: resolvedConfig.bubbleColor,
        },
        style,
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      onPressIn={(event) => event?.stopPropagation?.()}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (isFavorite ? "Remove from wishlist" : "Add to wishlist")
      }
    >
      <FontAwesome name={iconName} size={iconSize} color={iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    zIndex: 10,
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
});

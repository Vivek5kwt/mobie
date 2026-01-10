import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";

const resolveValue = (input, fallback) => {
  if (input === undefined || input === null) return fallback;
  if (typeof input === "object") {
    if (input.value !== undefined) return input.value;
    if (input.properties?.value !== undefined) return input.properties.value;
    if (input.const !== undefined) return input.const;
  }
  return input;
};

const resolveObject = (input, fallback = {}) => {
  const resolved = resolveValue(input, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved !== "object") return resolved;
  if (resolved.value !== undefined) {
    return resolveValue(resolved.value, resolved) || fallback;
  }
  return resolved;
};

const resolveBoolean = (input, fallback = true) => {
  const value = resolveValue(input, fallback);
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
};

const parseIconName = (iconClass) => {
  if (!iconClass || typeof iconClass !== "string") return "user";
  const tokens = iconClass.split(" ").filter(Boolean);
  const styleTokens = new Set(["fa-solid", "fa-regular", "fa-light", "fa-thin", "fa-brands"]);
  const faToken =
    tokens.find((token) => token.startsWith("fa-") && !styleTokens.has(token)) ||
    tokens.find((token) => token.startsWith("fa-"));
  if (!faToken) return "user";
  const name = faToken.replace(/^fa-/, "").replace(/^fa-/, "");
  return name || "user";
};

const resolveBorderStyle = (borderLine, borderColor) => {
  const line = String(borderLine || "").toLowerCase();
  const color = borderColor || "#000";

  if (!line) return {};

  if (line === "all" || line === "full") {
    return { borderWidth: 1, borderColor: color };
  }

  const style = { borderColor: color };
  if (line === "left") style.borderLeftWidth = 1;
  if (line === "right") style.borderRightWidth = 1;
  if (line === "top") style.borderTopWidth = 1;
  if (line === "bottom") style.borderBottomWidth = 1;
  return style;
};

export default function AccountProfile({ section }) {
  const propsRoot =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const rawProps = resolveObject(propsRoot?.raw, {});
  const presentation = resolveObject(propsRoot?.presentation, {});
  const css = resolveObject(presentation?.css, {});

  const name = resolveValue(rawProps?.name, "");
  const email = resolveValue(rawProps?.email, "");
  const avatarUrl = resolveValue(rawProps?.avatarUrl, "");

  const containerStyle = convertStyles(css?.container || {});
  const nameStyle = convertStyles(css?.name || {});
  const emailStyle = convertStyles(css?.email || {});
  const avatarStyle = css?.avatar || {};
  const visibility = css?.visibility || {};
  const placeholder = css?.placeholder || {};

  const showName = resolveBoolean(visibility?.profileName, true);
  const showEmail = resolveBoolean(visibility?.email, true);
  const showAvatar = resolveBoolean(visibility?.image, true);
  const showBackgroundPadding = resolveBoolean(visibility?.bgPadding, true);

  const bgColor = resolveValue(rawProps?.bgColor, containerStyle?.backgroundColor);
  const borderColor = resolveValue(rawProps?.borderColor, css?.container?.borderColor);
  const borderLine = resolveValue(rawProps?.borderLine, css?.container?.borderLine);

  const resolvedContainerStyle = {
    ...containerStyle,
    backgroundColor: bgColor || containerStyle?.backgroundColor,
    ...(showBackgroundPadding ? {} : { padding: 0, paddingHorizontal: 0, paddingVertical: 0 }),
    ...resolveBorderStyle(borderLine, borderColor),
  };

  const resolvedNameStyle = {
    ...nameStyle,
    color: resolveValue(rawProps?.nameColor, nameStyle?.color),
    fontSize: resolveValue(rawProps?.nameFontSize, nameStyle?.fontSize),
  };

  const resolvedEmailStyle = {
    ...emailStyle,
    color: resolveValue(rawProps?.emailColor, emailStyle?.color),
    fontSize: resolveValue(rawProps?.emailFontSize, emailStyle?.fontSize),
  };

  const avatarSize = resolveValue(avatarStyle?.baseSize, 56);
  const avatarCorner = resolveValue(avatarStyle?.corner, 0);
  const avatarScale = String(resolveValue(avatarStyle?.scale, "fill")).toLowerCase();
  const resizeMode = avatarScale === "fit" ? "contain" : "cover";

  const placeholderIcon = parseIconName(placeholder?.iconClass);
  const placeholderIconSize = resolveValue(placeholder?.iconSize, 22);
  const placeholderColor = resolveValue(placeholder?.iconColor, "#016D77");
  const placeholderBg = resolveValue(placeholder?.background, "#D9F0F2");

  if (!showName && !showEmail && !showAvatar) {
    return null;
  }

  return (
    <View style={[styles.container, resolvedContainerStyle]}>
      {showAvatar && (
        <View
          style={[
            styles.avatarWrap,
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarCorner,
            },
          ]}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: avatarSize, height: avatarSize, borderRadius: avatarCorner }}
              resizeMode={resizeMode}
            />
          ) : (
            <View
              style={[
                styles.placeholder,
                {
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarCorner,
                  backgroundColor: placeholderBg,
                },
              ]}
            >
              <FontAwesome name={placeholderIcon} size={placeholderIconSize} color={placeholderColor} />
            </View>
          )}
        </View>
      )}

      <View style={styles.textBlock}>
        {showName && !!name && (
          <Text numberOfLines={1} style={[styles.name, resolvedNameStyle]}>
            {name}
          </Text>
        )}
        {showEmail && !!email && (
          <Text numberOfLines={1} style={[styles.email, resolvedEmailStyle]}>
            {email}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 12,
  },
  avatarWrap: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111111",
  },
  email: {
    fontSize: 14,
    color: "#4B5563",
  },
});

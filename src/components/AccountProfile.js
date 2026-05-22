import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { useAuth } from "../services/AuthContext";
import { resolveFont } from "../services/typographyService";

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

const resolveFontWeight = (value, fallback = "400") => {
  const resolved = resolveValue(value, fallback);
  if (typeof resolved === "number") return String(resolved);
  const normalized = String(resolved || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (/^\d+$/.test(normalized)) return normalized;
  if (normalized === "bold") return "700";
  if (normalized === "semibold" || normalized === "semi bold") return "600";
  if (normalized === "medium") return "500";
  if (normalized === "regular" || normalized === "normal") return "400";
  return fallback;
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const toNumber = (value, fallback) => {
  const resolved = resolveValue(value, fallback);
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const parsed = Number.parseFloat(String(resolved ?? "").replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveAvatarCorner = (value, size) => {
  const resolved = resolveValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return size / 2;
  if (typeof resolved === "number") return resolved >= 99 ? size / 2 : resolved;
  const normalized = String(resolved).trim().toLowerCase();
  if (normalized === "circle" || normalized === "50%" || normalized.includes("999")) return size / 2;
  if (normalized === "rounded") return Math.min(8, size / 2);
  const parsed = Number.parseFloat(normalized.replace("px", ""));
  return Number.isFinite(parsed) ? parsed : size / 2;
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
  const { session } = useAuth();
  const propsRoot =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const rawProps = resolveObject(propsRoot?.raw, {});
  // DSL uses two patterns:
  //   pattern A: presentation.value.css          (account_menu)
  //   pattern B: presentation.properties.css.value (account_profile)
  // Try .properties first so pattern B is found, fall back to root for pattern A
  const presentation = resolveObject(
    propsRoot?.presentation?.properties || propsRoot?.presentation, {}
  );
  const css = resolveObject(presentation?.css, {});
  const metrics = resolveObject(presentation?.metrics, {});
  const metricElements = resolveObject(metrics?.elements, {});
  const avatarMetrics = resolveObject(metricElements?.avatar, null);
  const nameMetrics = resolveObject(metricElements?.name, null);
  const containerMetrics = resolveObject(metricElements?.container ?? metrics?.container, null);
  const hasMetrics = resolveBoolean(metrics?.available, false) && avatarMetrics && containerMetrics;

  // Logged-in session must win; DSL values are fallback placeholders only.
  const name  = resolveValue(session?.user?.name,  "") || resolveValue(rawProps?.name,  "");
  const email = resolveValue(session?.user?.email, "") || resolveValue(rawProps?.email, "");
  const avatarUrl =
    resolveValue(session?.user?.avatarUrl, "") ||
    resolveValue(session?.user?.avatar, "") ||
    resolveValue(session?.user?.profilePictureUrl, "") ||
    resolveValue(rawProps?.avatarUrl ?? rawProps?.imageUrl ?? rawProps?.profileImage, "");

  const containerStyle = convertStyles(css?.container || {});
  const nameStyle = convertStyles(css?.name || {});
  const emailStyle = convertStyles(css?.email || {});
  const avatarStyle = css?.avatar || {};
  const visibility = { ...(css?.visibility || {}), ...(resolveObject(rawProps?.visibility, {}) || {}) };
  const placeholder = css?.placeholder || {};

  const showName = resolveBoolean(visibility?.profileName, true);
  const showEmail = resolveBoolean(visibility?.email, true);
  const showAvatar = resolveBoolean(visibility?.image, true);
  const showBackgroundPadding = resolveBoolean(visibility?.bgPadding, true);

  const bgColor = resolveValue(rawProps?.bgColor, containerStyle?.backgroundColor);
  const borderColor = resolveValue(rawProps?.borderColor, css?.container?.borderColor);
  const borderLine = resolveValue(rawProps?.borderLine, css?.container?.borderLine);
  const metricPaddingLeft = hasMetrics ? toNumber(avatarMetrics?.x, undefined) : undefined;
  const metricPaddingTop = hasMetrics ? toNumber(avatarMetrics?.y, undefined) : undefined;
  const metricPaddingBottom = hasMetrics
    ? Math.max(
        0,
        toNumber(containerMetrics?.height, 0) -
          toNumber(avatarMetrics?.y, 0) -
          toNumber(avatarMetrics?.height, 0)
      )
    : undefined;

  const resolvedContainerStyle = {
    ...containerStyle,
    backgroundColor: bgColor || containerStyle?.backgroundColor,
    gap: 0,
    ...(metricPaddingLeft !== undefined ? { paddingLeft: metricPaddingLeft } : {}),
    ...(metricPaddingTop !== undefined ? { paddingTop: metricPaddingTop } : {}),
    ...(metricPaddingBottom !== undefined ? { paddingBottom: metricPaddingBottom } : {}),
    ...(showBackgroundPadding ? {} : { padding: 0, paddingHorizontal: 0, paddingVertical: 0 }),
    ...resolveBorderStyle(borderLine, borderColor),
  };

  const nameFontFamily = cleanFontFamily(resolveValue(rawProps?.nameFontFamily ?? rawProps?.headlineFontFamily ?? rawProps?.fontFamily, ""));
  const emailFontFamily = cleanFontFamily(resolveValue(rawProps?.emailFontFamily ?? rawProps?.subtextFontFamily ?? rawProps?.fontFamily, ""));
  const resolvedNameStyle = {
    ...nameStyle,
    color: resolveValue(rawProps?.nameColor, nameStyle?.color),
    fontSize: resolveValue(rawProps?.nameFontSize ?? rawProps?.headlineSize ?? rawProps?.fontSize, nameStyle?.fontSize),
    fontWeight: resolveFontWeight(rawProps?.nameFontWeight ?? rawProps?.headlineWeight ?? rawProps?.fontWeight, nameStyle?.fontWeight || "700"),
    ...(nameFontFamily ? { fontFamily: nameFontFamily } : {}),
  };

  const resolvedEmailStyle = {
    ...emailStyle,
    color: resolveValue(rawProps?.emailColor, emailStyle?.color),
    fontSize: resolveValue(rawProps?.emailFontSize ?? rawProps?.subtextSize, emailStyle?.fontSize),
    fontWeight: resolveFontWeight(rawProps?.emailFontWeight ?? rawProps?.subtextWeight ?? rawProps?.fontWeight, emailStyle?.fontWeight || "400"),
    ...(emailFontFamily ? { fontFamily: emailFontFamily } : {}),
  };

  const avatarSize = toNumber(
    rawProps?.avatarSize ?? rawProps?.imageSize ?? rawProps?.profilePictureSize ?? avatarStyle?.baseSize ?? avatarMetrics?.width,
    56
  );
  const avatarCorner = resolveAvatarCorner(
    rawProps?.avatarCorner ?? rawProps?.imageCorner ?? rawProps?.borderRadius ?? avatarStyle?.corner ?? rawProps?.imageShape,
    avatarSize
  );
  const avatarScale = String(resolveValue(rawProps?.imageScale ?? avatarStyle?.scale, "fill")).toLowerCase();
  const resizeMode = avatarScale === "fit" ? "contain" : "cover";
  const textGap = hasMetrics
    ? Math.max(0, toNumber(nameMetrics?.x, 0) - toNumber(avatarMetrics?.x, 0) - avatarSize)
    : 12;

  const placeholderIcon = parseIconName(placeholder?.iconClass);
  const placeholderIconSize = resolveValue(placeholder?.iconSize, 22);
  const placeholderColor = resolveValue(rawProps?.iconColor, resolveValue(placeholder?.iconColor, "#016D77"));
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
              backgroundColor: placeholderBg,
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

      <View style={[styles.textBlock, { marginLeft: textGap }]}>
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

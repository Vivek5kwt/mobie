import React from "react";
import { StyleSheet, Text, View } from "react-native";
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

  if (!line) return { borderWidth: 0 };

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

const resolveFontWeight = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "number") return String(value);
  const normalized = String(value).trim().toLowerCase();
  if (["bold", "700"].includes(normalized)) return "700";
  if (["semibold", "600"].includes(normalized)) return "600";
  if (["medium", "500"].includes(normalized)) return "500";
  if (["regular", "normal", "400"].includes(normalized)) return "400";
  return value;
};

export default function AccountMenu({ section }) {
  const propsRoot =
    section?.props || section?.properties?.props?.properties || section?.properties?.props || {};

  const rawProps = resolveValue(propsRoot?.raw, {}) || {};
  const presentation = propsRoot?.presentation?.properties || propsRoot?.presentation || {};
  const css = resolveValue(presentation?.css, {}) || {};

  const containerStyle = convertStyles(css?.container || {});
  const rowStyle = convertStyles(css?.row || {});
  const iconStyle = convertStyles(css?.icon || {});
  const labelStyle = convertStyles(css?.label || {});
  const chevronStyle = convertStyles(css?.chevron || {});
  const iconWrapStyle = convertStyles(css?.iconWrap || {});

  const visibility = css?.visibility || rawProps?.visibility || {};
  const showIcons = resolveBoolean(visibility?.icons, true);
  const showHeader = resolveBoolean(visibility?.header, true);
  const showBgPadding = resolveBoolean(visibility?.bgPadding, true);
  const showIconBgPadding = resolveBoolean(visibility?.iconBgPadding, true);

  const text = resolveValue(rawProps?.text, "");
  const textColor = resolveValue(rawProps?.textColor, labelStyle?.color);
  const textFontSize = resolveValue(rawProps?.textFontSize, labelStyle?.fontSize);
  const textFontFamily = resolveValue(rawProps?.textFontFamily, labelStyle?.fontFamily);
  const textFontWeight = resolveFontWeight(
    resolveValue(rawProps?.textFontWeight, labelStyle?.fontWeight),
    labelStyle?.fontWeight
  );

  const textBold = resolveBoolean(rawProps?.textBold, false);
  const textItalic = resolveBoolean(rawProps?.textItalic, false);
  const textUnderline = resolveBoolean(rawProps?.textUnderline, false);
  const textUppercase = resolveBoolean(rawProps?.textUppercase, false);

  const iconName = parseIconName(resolveValue(rawProps?.iconName, ""));
  const iconColor = resolveValue(rawProps?.iconColor, iconStyle?.color);
  const iconSize = resolveValue(rawProps?.iconSize, iconStyle?.fontSize) || 20;
  const iconBgColor = resolveValue(rawProps?.iconBgColor, iconWrapStyle?.backgroundColor);

  const rowBackground = resolveValue(rawProps?.bgColor, rowStyle?.backgroundColor);
  const borderCorners = resolveValue(rawProps?.borderCorners, rowStyle?.borderRadius);
  const borderColor = resolveValue(rawProps?.borderColor, rowStyle?.borderColor);
  const borderLine = resolveValue(rawProps?.borderLine, css?.row?.borderLine);

  const paddingStyles = convertStyles({
    paddingTop: rawProps?.pt,
    paddingBottom: rawProps?.pb,
    paddingLeft: rawProps?.pl,
    paddingRight: rawProps?.pr,
  });

  const iconAlign = String(resolveValue(rawProps?.iconAlign, "left")).trim().toLowerCase();

  const { numberOfLines, ...labelStyleProps } = labelStyle;

  if (!showIcons && !showHeader) {
    return null;
  }

  const resolvedRowStyle = {
    ...rowStyle,
    backgroundColor: rowBackground || rowStyle?.backgroundColor,
    borderRadius: borderCorners ?? rowStyle?.borderRadius,
    ...resolveBorderStyle(borderLine, borderColor),
    ...(showBgPadding ? {} : { padding: 0, paddingHorizontal: 0, paddingVertical: 0 }),
  };

  const resolvedIconWrapStyle = {
    ...iconWrapStyle,
    backgroundColor: showIconBgPadding ? iconBgColor : "transparent",
    ...(showIconBgPadding ? {} : { padding: 0, width: undefined, height: undefined }),
  };

  const resolvedLabelStyle = {
    ...labelStyleProps,
    color: textColor ?? labelStyleProps?.color,
    fontSize: textFontSize ?? labelStyleProps?.fontSize,
    fontFamily: textFontFamily ?? labelStyleProps?.fontFamily,
    fontWeight: textBold ? "700" : textFontWeight ?? labelStyleProps?.fontWeight,
    fontStyle: textItalic ? "italic" : labelStyleProps?.fontStyle,
    textDecorationLine: textUnderline ? "underline" : "none",
    textTransform: textUppercase ? "uppercase" : labelStyleProps?.textTransform,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={[styles.row, resolvedRowStyle, paddingStyles]}>
        {showIcons && iconAlign !== "right" && (
          <View style={[styles.iconWrap, resolvedIconWrapStyle]}>
            <FontAwesome
              name={iconName}
              size={iconSize}
              color={iconColor}
              style={[styles.icon, iconStyle]}
            />
          </View>
        )}
        {showHeader && (
          <Text
            numberOfLines={numberOfLines || 1}
            style={[styles.label, resolvedLabelStyle]}
          >
            {text}
          </Text>
        )}
        {showIcons && iconAlign === "right" && (
          <View style={[styles.iconWrap, resolvedIconWrapStyle]}>
            <FontAwesome
              name={iconName}
              size={iconSize}
              color={iconColor}
              style={[styles.icon, iconStyle]}
            />
          </View>
        )}
        <FontAwesome
          name="chevron-right"
          size={resolveValue(chevronStyle?.fontSize, 16)}
          color={resolveValue(chevronStyle?.color, "#111827")}
          style={[styles.chevron, chevronStyle]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    alignSelf: "center",
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  chevron: {
    flexShrink: 0,
  },
});

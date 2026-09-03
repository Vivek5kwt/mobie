import React, { useMemo } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSelector } from "react-redux";
import Icon6 from "react-native-vector-icons/FontAwesome6";
import FA6GlyphMap from "react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import { resolveFont } from "../services/typographyService";
import { formatMoney } from "../utils/money";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback = 0) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const cleanFontFamily = (family) => resolveFont(family) || "";

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const normalized = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return fallback;
};

const toFontWeight = (value, fallback = "400") => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved) return fallback;
  const w = String(resolved).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium") return "500";
  if (w === "regular" || w === "normal") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

const CUSTOM_ICON_PREFIX = "custom-icon::";
const getCustomIconUrlFromValue = (value) => {
  const raw = String(value || "");
  if (!raw.startsWith(CUSTOM_ICON_PREFIX)) return null;
  const encoded = raw.slice(CUSTOM_ICON_PREFIX.length);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
};

const normalizeIconId = (value) => {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  const withoutStyle = trimmed.replace(/^fa-(solid|regular|light|brands|brand|thin|duotone|sharp)\s+/, "");
  return withoutStyle.replace(/^fa-/, "");
};

const buildBorderStyle = (side, color, radius) => {
  const style = { borderRadius: radius };
  const s = String(side || "").toLowerCase();
  if (!s || s === "none") return style;
  if (s === "all") {
    style.borderWidth = 1;
    style.borderColor = color;
    return style;
  }
  const sideKey = {
    top: "borderTopWidth",
    right: "borderRightWidth",
    bottom: "borderBottomWidth",
    left: "borderLeftWidth",
  }[s];
  if (sideKey) {
    style[sideKey] = 1;
    style.borderColor = color;
  }
  return style;
};

const textDecorationLine = (underline, strikethrough) => {
  if (underline && strikethrough) return "underline line-through";
  if (underline) return "underline";
  if (strikethrough) return "line-through";
  return "none";
};

const textAlignOf = (value) => {
  const v = String(value || "").toLowerCase();
  if (v === "center") return "center";
  if (v === "right") return "right";
  return "left";
};

const normalizeUrl = (url) => {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
};

const LinkableText = ({ href, children }) => {
  const url = normalizeUrl(href);
  if (!url) return children;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => Linking.openURL(url).catch(() => {})}>
      {children}
    </TouchableOpacity>
  );
};

export default function FreeShipping({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const rawProps = propsNode;
  const raw = unwrapValue(rawProps?.raw, {}) || rawProps || {};

  // Cart total from Redux — used to compute real progress toward the
  // merchant-configured "Qualifying Amount", since the Builder Preview has
  // no real cart and can only demo a static value.
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + toNumber(item?.price, 0) * toNumber(item?.quantity, 1),
        0
      ),
    [cartItems]
  );

  // ── Qualifying Amount ───────────────────────────────────────────────────────
  const qualifyingAmountVisible = toBoolean(raw?.qualifyingAmount, true);
  const threshold = toNumber(raw?.amount, 120);
  const remaining = Math.max(0, threshold - cartTotal);
  const isQualified = remaining <= 0;

  // ── Header (shown once the threshold is reached) ───────────────────────────
  const headerVisible = toBoolean(raw?.headerVisible, true);
  const headerTemplate = toString(raw?.header, "You're {{amount}} away from free shipping");
  const headerSize = toNumber(raw?.headerSize, 16);
  const headerFontFamily = cleanFontFamily(toString(raw?.headerFontFamily, "Inter"));
  const headerBold = toBoolean(raw?.headerBold, false);
  const headerFontWeight = headerBold ? "700" : toFontWeight(raw?.headerFontWeight, "400");
  const headerColor = toString(raw?.headerColor, "#111111");
  const headerAlign = textAlignOf(toString(raw?.headerAlign, "Left"));
  const headerItalic = toBoolean(raw?.headerItalic, false);
  const headerUnderline = toBoolean(raw?.headerUnderline, false);
  const headerStrikethrough = toBoolean(raw?.headerStrikethrough, false);
  const headerLinkHref = toString(raw?.headerLinkHref, "");

  const remainingAmountText = formatMoney(remaining);
  const headerText = headerTemplate.replace(
    "{{amount}}",
    qualifyingAmountVisible ? remainingAmountText : ""
  );

  // ── UnQualified (shown while still short of the threshold) ─────────────────
  const unQualifiedVisible = toBoolean(raw?.unQualifiedVisible, true);
  const unQualifiedText = toString(raw?.unQualified, "You are UnQualified for free Shipping!");
  const unQualifiedSize = toNumber(raw?.unQualifiedSize, 14);
  const unQualifiedFontFamily = cleanFontFamily(toString(raw?.unQualifiedFontFamily, "Inter"));
  const unQualifiedBold = toBoolean(raw?.unQualifiedBold, false);
  const unQualifiedFontWeight = unQualifiedBold ? "700" : toFontWeight(raw?.unQualifiedFontWeight, "400");
  const unQualifiedColor = toString(raw?.unQualifiedColor, "#111111");
  const unQualifiedAlign = textAlignOf(toString(raw?.unQualifiedAlign, "Left"));
  const unQualifiedLinkHref = toString(raw?.unQualifiedLinkHref, "");
  const unQualifiedItalic = toBoolean(raw?.unQualifiedItalic, false);
  const unQualifiedUnderline = toBoolean(raw?.unQualifiedUnderline, false);
  const unQualifiedStrikethrough = toBoolean(raw?.unQualifiedStrikethrough, false);

  // ── Icon ─────────────────────────────────────────────────────────────────────
  // Builder's FreeShippingPreviewLive.tsx renders an icon ONLY when
  // `buttonIcon` explicitly resolves to a real dropdown value (a custom
  // upload URL or a known fa-* id) — its own default ("Lightning") is not in
  // that map, so nothing shows. The APK was defaulting to "fa-bolt-lightning"
  // and always drawing a lightning bolt the Builder never displays.
  const rawIconValue = toString(raw?.buttonIcon, "");
  const iconImageUrl = getCustomIconUrlFromValue(rawIconValue);
  const iconNameRaw = normalizeIconId(rawIconValue);
  const iconHasGlyph =
    !!iconNameRaw && Object.prototype.hasOwnProperty.call(FA6GlyphMap, iconNameRaw);
  const showIcon =
    !!rawIconValue &&
    rawIconValue.trim().toLowerCase() !== "none" &&
    (!!iconImageUrl || iconHasGlyph);
  const iconName = iconHasGlyph ? iconNameRaw : "bolt-lightning";
  const iconSize = toNumber(raw?.buttonIconSize, 15);
  const iconColor = toString(raw?.buttonIconColor, "#000000");

  // ── Progress bar ─────────────────────────────────────────────────────────────
  const progressBarVisible = toBoolean(raw?.progressBar, true);
  const progressFillColor = toString(raw?.progressFillColor, "#000000");
  const emptyFillColor = toString(raw?.emptyFillColor, "#d1d5db");
  const progress = threshold > 0 ? Math.min(1, cartTotal / threshold) : 1;
  const inputSide = toString(raw?.inputSide, "all");
  const inputBorderRadius = toNumber(raw?.inputBorderRadius, 8);
  const inputBorderColor = toString(raw?.inputBorderColor, "#E5E7EB");
  const trackBorderStyle = buildBorderStyle(inputSide, inputBorderColor, inputBorderRadius);

  // ── Card background, border and padding ─────────────────────────────────────
  const cardBgPaddingVisible = toBoolean(raw?.cardBgPadding, true);
  const cardSide = toString(raw?.cardSide, "all");
  const cardBorderRadius = toNumber(raw?.cardBorderRadius, 8);
  const cardBorderColor = toString(raw?.cardBorderColor, "#E5E7EB");
  const cardBgColor = toString(raw?.cardBgColor, "#ffffff");
  const cardPt = toNumber(raw?.cardPt, 4);
  const cardPb = toNumber(raw?.cardPb, 4);
  const cardPl = toNumber(raw?.cardPl, 2);
  const cardPr = toNumber(raw?.cardPr, 2);

  const cardStyle = cardBgPaddingVisible
    ? {
        backgroundColor: cardBgColor,
        paddingTop: cardPt,
        paddingBottom: cardPb,
        paddingLeft: cardPl,
        paddingRight: cardPr,
        ...buildBorderStyle(cardSide, cardBorderColor, cardBorderRadius),
      }
    : { backgroundColor: "transparent", padding: 0 };

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.row}>
        {showIcon &&
          (iconImageUrl ? (
            <Image
              source={{ uri: iconImageUrl }}
              style={{ width: iconSize, height: iconSize, resizeMode: "contain", marginRight: 8 }}
            />
          ) : (
            <Icon6 name={iconName} size={iconSize} color={iconColor} style={styles.icon} />
          ))}

        <View style={styles.textCol}>
          {isQualified ? (
            headerVisible && (
              <LinkableText href={headerLinkHref}>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: headerSize,
                    fontWeight: headerFontWeight,
                    color: headerColor,
                    textAlign: headerAlign,
                    fontStyle: headerItalic ? "italic" : "normal",
                    textDecorationLine: textDecorationLine(headerUnderline, headerStrikethrough),
                    marginBottom: 6,
                    ...(headerFontFamily ? { fontFamily: headerFontFamily } : {}),
                  }}
                >
                  {headerText}
                </Text>
              </LinkableText>
            )
          ) : (
            unQualifiedVisible && (
              <LinkableText href={unQualifiedLinkHref}>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: unQualifiedSize,
                    fontWeight: unQualifiedFontWeight,
                    color: unQualifiedColor,
                    textAlign: unQualifiedAlign,
                    fontStyle: unQualifiedItalic ? "italic" : "normal",
                    textDecorationLine: textDecorationLine(unQualifiedUnderline, unQualifiedStrikethrough),
                    marginBottom: 6,
                    ...(unQualifiedFontFamily ? { fontFamily: unQualifiedFontFamily } : {}),
                  }}
                >
                  {unQualifiedText}
                </Text>
              </LinkableText>
            )
          )}

          {progressBarVisible && (
            <View
              style={[
                styles.track,
                { backgroundColor: emptyFillColor, overflow: "hidden" },
                trackBorderStyle,
              ]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.round(progress * 100)}%`,
                    backgroundColor: progressFillColor,
                    borderRadius: inputBorderRadius,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 8,
  },
  textCol: {
    flex: 1,
  },
  track: {
    width: "95%",
    height: 6,
  },
  fill: {
    height: "100%",
  },
});

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

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

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

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

export default function FreeShipping({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const rawProps = propsNode;
  const raw = unwrapValue(rawProps?.raw, {}) || rawProps || {};

  // Cart total from Redux
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

  // DSL config
  const enabled = toBoolean(raw?.enabled ?? raw?.active, true);
  const threshold = toNumber(raw?.threshold ?? raw?.freeShippingThreshold ?? raw?.minAmount, 500);
  const currencySymbol = toString(raw?.currencySymbol ?? raw?.currency ?? raw?.symbol, "$");

  // Text templates — use {amount} placeholder
  const progressText = toString(
    raw?.progressText ?? raw?.messageText ?? raw?.text,
    "You're {symbol}{amount} away from free shipping"
  );
  const completedText = toString(
    raw?.completedText ?? raw?.successText ?? raw?.reachedText,
    "You've unlocked free shipping!"
  );

  // Colors
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "transparent");
  const textColor = toString(raw?.textColor ?? raw?.messageColor, "#111827");
  const textSize = toNumber(raw?.textSize ?? raw?.fontSize, 13);
  const textWeight = toFontWeight(raw?.textWeight ?? raw?.fontWeight, "500");

  const trackColor = toString(raw?.trackColor ?? raw?.barBgColor ?? raw?.progressBgColor, "#E5E7EB");
  const fillColor = toString(raw?.fillColor ?? raw?.barColor ?? raw?.barFillColor ?? raw?.progressColor, "#111827");
  const barHeight = toNumber(raw?.barHeight ?? raw?.progressHeight, 6);
  const barRadius = toNumber(raw?.barRadius ?? raw?.progressRadius, 999);

  const padT = toNumber(raw?.padT ?? raw?.pt, 12);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 12);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);
  const textFontFamily = cleanFontFamily(toString(raw?.fontFamily ?? raw?.textFontFamily, ""));

  if (!enabled) return null;

  // Progress calculation
  const remaining = Math.max(0, threshold - cartTotal);
  const progress = threshold > 0 ? Math.min(1, cartTotal / threshold) : 1;
  const isReached = remaining === 0;

  // Build message
  const formattedRemaining = remaining % 1 === 0
    ? remaining.toFixed(0)
    : remaining.toFixed(2);

  const message = isReached
    ? completedText
    : progressText
        .replace("{symbol}", currencySymbol)
        .replace("{amount}", `${currencySymbol}${formattedRemaining}`)
        .replace("{remaining}", `${currencySymbol}${formattedRemaining}`)
        .replace("{currency}", currencySymbol);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: padT,
          paddingRight: padR,
          paddingBottom: padB,
          paddingLeft: padL,
        },
      ]}
    >
      <Text
        style={[
          styles.message,
          {
            color: isReached ? fillColor : textColor,
            fontSize: textSize,
            fontWeight: textWeight,
            ...(textFontFamily ? { fontFamily: textFontFamily } : {}),
          },
        ]}
        numberOfLines={2}
      >
        {message}
      </Text>

      {/* Progress bar */}
      <View
        style={[
          styles.track,
          {
            height: barHeight,
            borderRadius: barRadius,
            backgroundColor: trackColor,
            marginTop: 8,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(progress * 100)}%`,
              height: barHeight,
              borderRadius: barRadius,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  message: {
    lineHeight: 20,
  },
  track: {
    width: "100%",
    overflow: "hidden",
  },
  fill: {},
});

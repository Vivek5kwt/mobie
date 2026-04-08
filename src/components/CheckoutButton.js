import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { createShopifyCartCheckout } from "../services/shopify";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
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

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

const toFontWeight = (value, fallback = "600") => {
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

export default function CheckoutButton({ section }) {
  const navigation = useNavigation();

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // deepUnwrap raw sub-object and merge it in so all DSL paths are readable
  const rawNode = deepUnwrap(propsNode?.raw);
  const raw = (rawNode && typeof rawNode === "object")
    ? { ...propsNode, ...rawNode }
    : (propsNode || {});

  // Read presentation.css for button styling fallback
  const presUnwrapped = deepUnwrap(propsNode?.presentation) || {};
  const presentationCss = presUnwrapped?.properties?.css || presUnwrapped?.css || {};
  const buttonCss = deepUnwrap(presentationCss?.button) || deepUnwrap(presentationCss?.checkout) || {};

  const cartItems = useSelector((state) => state?.cart?.items || []);
  const appliedDiscounts = useSelector((state) => state?.cart?.discounts || []);
  const hasCartItems = cartItems.length > 0;

  // Label
  const label = toString(raw?.label ?? raw?.text ?? raw?.buttonText, "Checkout");

  // Container padding — read DSL first, fallback to outer padding defaults
  const padT = toNumber(raw?.padT ?? raw?.pt ?? raw?.paddingTop, 12);
  const padR = toNumber(raw?.padR ?? raw?.pr ?? raw?.paddingRight, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb ?? raw?.paddingBottom, 12);
  const padL = toNumber(raw?.padL ?? raw?.pl ?? raw?.paddingLeft, 16);

  // Button size
  const height = toNumber(raw?.height ?? raw?.btnHeight, 52);
  const fullWidth = toBoolean(raw?.fullWidth ?? raw?.isFullWidth, true);

  // Button appearance — read from raw props first, then presentation.css
  const bgColor = toString(
    raw?.bgColor ?? raw?.backgroundColor ?? raw?.buttonBg ?? buttonCss?.backgroundColor,
    "#111827"
  );
  const borderRadius = toNumber(raw?.borderRadius ?? raw?.cornerRadius ?? raw?.corner, 10);

  // Border — only show when DSL explicitly sets borderColor or borderWidth
  const borderColorVal = toString(raw?.borderColor, "");
  const borderWidthVal = toNumber(raw?.borderWidth ?? raw?.borderSize, 0);
  const showBorder = borderWidthVal > 0 || !!borderColorVal;

  // Text style — also check presentation.css button
  const textColor = toString(raw?.textColor ?? raw?.labelColor ?? raw?.color ?? buttonCss?.color, "#FFFFFF");
  const fontSize = toNumber(raw?.fontSize ?? raw?.textSize ?? raw?.labelSize, 16);
  const fontWeight = toFontWeight(raw?.fontWeight ?? raw?.textWeight ?? raw?.labelWeight, "600");
  const fontFamily = toString(raw?.fontFamily ?? raw?.labelFamily, "");
  const italic = toBoolean(raw?.italic, false);
  const underline = toBoolean(raw?.underline, false);
  const letterSpacing = toNumber(raw?.letterSpacing, 0.3);

  // Disabled state styling
  const disabledBg = toString(raw?.disabledBg ?? raw?.disabledBackground, "#6B7280");
  const disabledTextColor = toString(raw?.disabledTextColor, "#D1D5DB");

  // All cart items — createShopifyCartCheckout handles variantId/id fallback internally
  const checkoutLines = useMemo(
    () =>
      cartItems.map((item) => ({
        id: item?.id,
        variantId: item?.variantId,
        quantity: item?.quantity,
      })),
    [cartItems]
  );

  const handleCheckout = async () => {
    if (!hasCartItems) return;
    try {
      // Pass no options — createShopifyCartCheckout uses async credentials internally
      const checkoutUrl = await createShopifyCartCheckout({
        items: checkoutLines,
      });
      if (checkoutUrl && navigation?.navigate) {
        navigation.navigate("CheckoutWebView", { url: checkoutUrl, title: "Checkout" });
      }
    } catch (error) {
      console.log("Checkout error:", error);
    }
  };

  const activeBg = hasCartItems ? bgColor : disabledBg;
  const activeTextColor = hasCartItems ? textColor : disabledTextColor;

  const textStyle = {
    fontSize,
    color: activeTextColor,
    fontWeight,
    fontStyle: italic ? "italic" : "normal",
    letterSpacing,
    textDecorationLine: underline ? "underline" : "none",
    ...(fontFamily ? { fontFamily } : {}),
  };

  const buttonStyle = {
    height,
    borderRadius,
    backgroundColor: activeBg,
    width: fullWidth ? "100%" : undefined,
    ...(showBorder
      ? {
          borderWidth: borderWidthVal || 1,
          borderColor: borderColorVal || bgColor,
        }
      : { borderWidth: 0 }),
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: padT,
          paddingRight: padR,
          paddingBottom: padB,
          paddingLeft: padL,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, buttonStyle]}
        activeOpacity={hasCartItems ? 0.8 : 1}
        onPress={handleCheckout}
        disabled={!hasCartItems}
      >
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {},
});

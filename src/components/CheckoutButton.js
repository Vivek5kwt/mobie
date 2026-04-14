import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { createShopifyCartCheckout } from "../services/shopify";
import Snackbar from "./Snackbar";

// ── DSL helpers ────────────────────────────────────────────────────────────────

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

const toStr = (value, fallback = "") => {
  const v = deepUnwrap(value);
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s && s !== "undefined" && s !== "null" ? s : fallback;
};

const toNum = (value, fallback = 0) => {
  const v = deepUnwrap(value);
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const p = parseFloat(String(v));
  return Number.isNaN(p) ? fallback : p;
};

const toBool = (value, fallback = false) => {
  const v = deepUnwrap(value);
  if (v === undefined || v === null) return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
};

// Pick first non-empty value from a list of DSL candidates (handles "" and "undefined")
const pick = (candidates, fallback) => {
  for (const c of candidates) {
    const v = toStr(c, "");
    if (v) return v;
  }
  return fallback;
};

const pickNum = (candidates, fallback) => {
  for (const c of candidates) {
    const raw = deepUnwrap(c);
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw));
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
};

const toFontWeight = (value, fallback = "600") => {
  const v = deepUnwrap(value);
  if (!v) return fallback;
  const w = String(v).toLowerCase().trim();
  if (w === "bold") return "700";
  if (w === "semibold" || w === "semi bold") return "600";
  if (w === "medium") return "500";
  if (w === "regular" || w === "normal") return "400";
  if (/^\d+$/.test(w)) return w;
  return fallback;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckoutButton({ section }) {
  const navigation = useNavigation();
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const hasCartItems = cartItems.length > 0;

  // ── Resolve props node (handles both schema and flat DSL structures) ─────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // Unwrap raw sub-object — handles { type, value: {...} } AND plain { key: value }
  const rawUnwrapped = deepUnwrap(propsNode?.raw);
  const raw = (rawUnwrapped && typeof rawUnwrapped === "object")
    ? rawUnwrapped
    : {};

  // Also check presentation.css for layout/style fallbacks
  const pressCss = deepUnwrap(propsNode?.presentation)?.css || {};
  const btnCss   = deepUnwrap(pressCss?.button ?? pressCss?.checkout) || {};

  // ── Button label ─────────────────────────────────────────────────────────────
  const label = pick([raw?.label, raw?.text, raw?.buttonText, propsNode?.label], "Checkout");

  // ── Background colour (priority: raw.backgroundColor → raw.bgColor → …) ─────
  const bgColor = pick(
    [raw?.backgroundColor, raw?.bgColor, raw?.background, raw?.buttonBg, raw?.btn_bg, btnCss?.backgroundColor],
    "#111827"
  );

  // ── Text colour ──────────────────────────────────────────────────────────────
  const textColor = pick(
    [raw?.textColor, raw?.labelColor, raw?.color, raw?.text_color, btnCss?.color],
    "#FFFFFF"
  );

  // ── Border ───────────────────────────────────────────────────────────────────
  const borderColorVal = pick(
    [raw?.borderColor, raw?.border_color, raw?.strokeColor, btnCss?.borderColor],
    ""
  );
  const borderWidthVal = pickNum(
    [raw?.borderWidth, raw?.borderSize, raw?.border_width, btnCss?.borderWidth],
    0
  );
  // Show border whenever DSL provides a borderColor, even without explicit borderWidth
  const showBorder   = !!borderColorVal || borderWidthVal > 0;
  const borderWidth  = showBorder ? (borderWidthVal > 0 ? borderWidthVal : 1) : 0;

  // ── Dimensions & shape ───────────────────────────────────────────────────────
  const height       = pickNum([raw?.height, raw?.btnHeight, raw?.buttonHeight, btnCss?.height], 52);
  const borderRadius = pickNum([raw?.borderRadius, raw?.cornerRadius, raw?.corner, raw?.rounded, btnCss?.borderRadius], 10);
  const fullWidth    = toBool(raw?.fullWidth ?? raw?.isFullWidth, true);

  // ── Typography ───────────────────────────────────────────────────────────────
  const fontSize     = pickNum([raw?.fontSize, raw?.textSize, raw?.labelSize, btnCss?.fontSize], 16);
  const fontWeight   = toFontWeight(raw?.fontWeight ?? raw?.textWeight ?? raw?.labelWeight ?? btnCss?.fontWeight, "600");
  const fontFamily   = toStr(raw?.fontFamily ?? raw?.labelFamily ?? btnCss?.fontFamily, "");
  const italic       = toBool(raw?.italic, false);
  const underline    = toBool(raw?.underline, false);
  const letterSpacing = pickNum([raw?.letterSpacing, btnCss?.letterSpacing], 0.3);

  // ── Outer container padding ───────────────────────────────────────────────────
  const padT = pickNum([raw?.paddingTop,    raw?.padT, raw?.pt, btnCss?.paddingTop],    12);
  const padB = pickNum([raw?.paddingBottom, raw?.padB, raw?.pb, btnCss?.paddingBottom], 12);
  const padL = pickNum([raw?.paddingLeft,   raw?.padL, raw?.pl, btnCss?.paddingLeft],   16);
  const padR = pickNum([raw?.paddingRight,  raw?.padR, raw?.pr, btnCss?.paddingRight],  16);
  const gap  = pickNum([raw?.gap, raw?.marginTop, raw?.mt], 0);

  // ── Outer container background ───────────────────────────────────────────────
  const containerBg = pick(
    [raw?.containerBg, raw?.outerBg, raw?.wrapperBg, raw?.sectionBg],
    "#FFFFFF"
  );

  // ── Disabled state ───────────────────────────────────────────────────────────
  const disabledBg        = pick([raw?.disabledBg,        raw?.disabledBackground], "#9CA3AF");
  const disabledTextColor = pick([raw?.disabledTextColor, raw?.disabledColor],      "#E5E7EB");

  // ── Checkout lines from Redux cart ──────────────────────────────────────────
  const checkoutLines = useMemo(
    () => cartItems.map((item) => ({
      id: item?.id,
      variantId: item?.variantId,
      quantity: item?.quantity,
    })),
    [cartItems]
  );

  const [emptySnackbar, setEmptySnackbar] = useState(false);

  const handleCheckout = async () => {
    if (!hasCartItems) {
      setEmptySnackbar(true);
      return;
    }
    try {
      const checkoutUrl = await createShopifyCartCheckout({ items: checkoutLines });
      if (checkoutUrl && navigation?.navigate) {
        navigation.navigate("CheckoutWebView", { url: checkoutUrl, title: "Checkout" });
      }
    } catch (error) {
      console.log("Checkout error:", error);
    }
  };

  // Active vs disabled styling
  const activeBg        = hasCartItems ? bgColor       : disabledBg;
  const activeTextColor = hasCartItems ? textColor      : disabledTextColor;
  const activeBorderClr = hasCartItems ? borderColorVal : disabledBg;

  const buttonStyle = {
    height,
    borderRadius,
    backgroundColor: activeBg,
    width: fullWidth ? "100%" : undefined,
    borderWidth,
    borderColor: showBorder ? activeBorderClr : undefined,
  };

  const textStyle = {
    fontSize,
    color: activeTextColor,
    fontWeight,
    fontStyle:          italic    ? "italic"    : "normal",
    letterSpacing,
    textDecorationLine: underline ? "underline" : "none",
    ...(fontFamily ? { fontFamily } : {}),
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          paddingTop:    padT,
          paddingBottom: padB,
          paddingLeft:   padL,
          paddingRight:  padR,
          marginTop:     gap,
        },
      ]}
    >
      <TouchableOpacity
        style={[styles.button, buttonStyle]}
        activeOpacity={0.8}
        onPress={handleCheckout}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </TouchableOpacity>

      <Snackbar
        visible={emptySnackbar}
        message="Your cart is empty. Add items to continue."
        actionLabel="Browse"
        onAction={() => navigation.navigate("LayoutScreen")}
        onDismiss={() => setEmptySnackbar(false)}
        duration={3000}
        type="info"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  button: {
    alignItems:     "center",
    justifyContent: "center",
    width:          "100%",
  },
  label: {},
});

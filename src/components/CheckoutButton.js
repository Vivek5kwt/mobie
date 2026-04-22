import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

// ── Gradient text helpers ──────────────────────────────────────────────────────

// Default rainbow gradient matching the design shown in the image
const DEFAULT_TEXT_GRADIENT = ["#60A5FA", "#A78BFA", "#F472B6", "#FBBF24", "#34D399"];

const hexToRgb = (hex) => {
  const h = String(hex || "").trim().replace("#", "");
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

// Smoothly interpolates a colour at `ratio` (0–1) across an array of hex stops
const interpolateGradientColor = (colors, ratio) => {
  if (!colors || colors.length === 0) return "#FFFFFF";
  if (colors.length === 1) return colors[0];
  const scaled = Math.max(0, Math.min(1, ratio)) * (colors.length - 1);
  const idx = Math.min(Math.floor(scaled), colors.length - 2);
  const t = scaled - idx;
  const c1 = hexToRgb(colors[idx]);
  const c2 = hexToRgb(colors[idx + 1]);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  return `rgb(${r},${g},${b})`;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckoutButton({ section }) {
  const navigation = useNavigation();
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const hasCartItems = cartItems.length > 0;

  // ── Resolve props node ───────────────────────────────────────────────────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const rawUnwrapped = deepUnwrap(propsNode?.raw);
  const raw = rawUnwrapped && typeof rawUnwrapped === "object" ? rawUnwrapped : {};

  const pressCss = deepUnwrap(propsNode?.presentation)?.css || {};
  const btnCss   = deepUnwrap(pressCss?.button ?? pressCss?.checkout) || {};

  // ── Label ────────────────────────────────────────────────────────────────────
  const label = pick([raw?.label, raw?.text, raw?.buttonText, propsNode?.label], "Checkout");

  // ── Background colour ────────────────────────────────────────────────────────
  // NOTE: btnCss.backgroundColor intentionally excluded — DSL's presentation CSS
  // may carry a legacy/builder colour that differs from raw. raw props are the
  // single source of truth for the button background.
  const bgColor = pick(
    [raw?.backgroundColor, raw?.bgColor, raw?.background, raw?.buttonBg, raw?.btn_bg],
    "#111827"
  );

  // ── Solid text colour (used when gradient is disabled) ───────────────────────
  // NOTE: btnCss.color excluded for the same reason — only raw props disable the
  // default rainbow gradient.
  const hasExplicitTextColor = !!(
    deepUnwrap(raw?.textColor) ||
    deepUnwrap(raw?.labelColor) ||
    deepUnwrap(raw?.color) ||
    deepUnwrap(raw?.text_color)
  );
  const textColor = pick(
    [raw?.textColor, raw?.labelColor, raw?.color, raw?.text_color],
    "#FFFFFF"
  );

  // ── Gradient text colours ────────────────────────────────────────────────────
  // DSL can supply: gradientColors (array or comma-separated string)
  // When no explicit solid textColor is set → falls back to DEFAULT_TEXT_GRADIENT
  const gradientColorsRaw = deepUnwrap(
    raw?.gradientColors ?? raw?.textGradient ?? raw?.labelGradient ?? raw?.textGradientColors
  );
  const dslGradient = useMemo(() => {
    if (Array.isArray(gradientColorsRaw)) {
      const arr = gradientColorsRaw.map((c) => toStr(c, "")).filter(Boolean);
      return arr.length >= 2 ? arr : null;
    }
    if (typeof gradientColorsRaw === "string" && gradientColorsRaw.includes(",")) {
      const arr = gradientColorsRaw.split(",").map((c) => c.trim()).filter(Boolean);
      return arr.length >= 2 ? arr : null;
    }
    return null;
  }, [gradientColorsRaw]);

  // Effective gradient: explicit DSL gradient > default (when no solid override) > null (solid)
  const textGradient = dslGradient ?? (hasExplicitTextColor ? null : DEFAULT_TEXT_GRADIENT);

  // ── Border ───────────────────────────────────────────────────────────────────
  const borderColorVal = pick(
    [raw?.borderColor, raw?.border_color, raw?.strokeColor, btnCss?.borderColor],
    ""
  );
  const borderWidthVal = pickNum(
    [raw?.borderWidth, raw?.borderSize, raw?.border_width, btnCss?.borderWidth],
    0
  );
  const showBorder  = !!borderColorVal || borderWidthVal > 0;
  const borderWidth = showBorder ? (borderWidthVal > 0 ? borderWidthVal : 1) : 0;

  // ── Dimensions & shape ───────────────────────────────────────────────────────
  const height       = pickNum([raw?.height, raw?.btnHeight, raw?.buttonHeight, btnCss?.height], 52);
  const borderRadius = pickNum([raw?.borderRadius, raw?.cornerRadius, raw?.corner, raw?.rounded, btnCss?.borderRadius], 10);
  const fullWidth    = toBool(raw?.fullWidth ?? raw?.isFullWidth, true);

  // ── Typography ───────────────────────────────────────────────────────────────
  const fontSize      = pickNum([raw?.fontSize, raw?.textSize, raw?.labelSize, btnCss?.fontSize], 16);
  const fontWeight    = toFontWeight(raw?.fontWeight ?? raw?.textWeight ?? raw?.labelWeight ?? btnCss?.fontWeight, "600");
  const fontFamily    = toStr(raw?.fontFamily ?? raw?.labelFamily ?? btnCss?.fontFamily, "");
  const italic        = toBool(raw?.italic, false);
  const underline     = toBool(raw?.underline, false);
  const letterSpacing = pickNum([raw?.letterSpacing, btnCss?.letterSpacing], 0.3);

  // ── Outer container ──────────────────────────────────────────────────────────
  const padT = pickNum([raw?.paddingTop,    raw?.padT, raw?.pt, btnCss?.paddingTop],    12);
  const padB = pickNum([raw?.paddingBottom, raw?.padB, raw?.pb, btnCss?.paddingBottom], 12);
  const padL = pickNum([raw?.paddingLeft,   raw?.padL, raw?.pl, btnCss?.paddingLeft],   16);
  const padR = pickNum([raw?.paddingRight,  raw?.padR, raw?.pr, btnCss?.paddingRight],  16);
  const gap  = pickNum([raw?.gap, raw?.marginTop, raw?.mt], 0);
  const containerBg = pick(
    [raw?.containerBg, raw?.outerBg, raw?.wrapperBg, raw?.sectionBg],
    "#FFFFFF"
  );

  // ── Disabled state ───────────────────────────────────────────────────────────
  const disabledBg        = pick([raw?.disabledBg,        raw?.disabledBackground], "#9CA3AF");
  const disabledTextColor = pick([raw?.disabledTextColor, raw?.disabledColor],      "#E5E7EB");

  // ── Checkout lines ───────────────────────────────────────────────────────────
  const checkoutLines = useMemo(
    () => cartItems.map((item) => ({
      id:        item?.id,
      variantId: item?.variantId,
      quantity:  item?.quantity,
    })),
    [cartItems]
  );

  const [emptySnackbar, setEmptySnackbar] = useState(false);
  const [errorSnackbar, setErrorSnackbar] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!hasCartItems) {
      setEmptySnackbar(true);
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const checkoutUrl = await createShopifyCartCheckout({ items: checkoutLines });
      if (checkoutUrl && navigation?.navigate) {
        navigation.navigate("CheckoutWebView", { url: checkoutUrl, title: "Checkout" });
      } else {
        setErrorSnackbar(true);
      }
    } catch (error) {
      console.log("Checkout error:", error);
      setErrorSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed styles ──────────────────────────────────────────────────────────
  const activeBg        = hasCartItems ? bgColor       : disabledBg;
  const activeTextColor = hasCartItems ? textColor      : disabledTextColor;
  const activeBorderClr = hasCartItems ? borderColorVal : disabledBg;

  const buttonStyle = {
    height,
    borderRadius,
    backgroundColor: activeBg,
    width:       fullWidth ? "100%" : undefined,
    borderWidth,
    borderColor: showBorder ? activeBorderClr : undefined,
  };

  // Base text style (colour overridden per-character for gradient mode)
  const textStyle = {
    fontSize,
    fontWeight,
    fontStyle:          italic    ? "italic"    : "normal",
    letterSpacing,
    textDecorationLine: underline ? "underline" : "none",
    ...(fontFamily ? { fontFamily } : {}),
  };

  // ── Render button label ──────────────────────────────────────────────────────
  const renderLabel = () => {
    // Loading state
    if (loading) {
      return <ActivityIndicator color={activeTextColor} size="small" />;
    }

    // Disabled state: always solid
    if (!hasCartItems) {
      return (
        <Text style={[styles.label, textStyle, { color: disabledTextColor }]}>
          {label}
        </Text>
      );
    }

    // Active with gradient: colour each character across the gradient stops
    if (textGradient) {
      const chars = [...label];
      return (
        <View style={styles.gradientRow}>
          {chars.map((char, i) => {
            const ratio = chars.length <= 1 ? 0.5 : i / (chars.length - 1);
            const color = interpolateGradientColor(textGradient, ratio);
            return (
              <Text key={i} style={[styles.label, textStyle, { color }]}>
                {char}
              </Text>
            );
          })}
        </View>
      );
    }

    // Active with solid colour
    return (
      <Text style={[styles.label, textStyle, { color: activeTextColor }]}>
        {label}
      </Text>
    );
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
        {renderLabel()}
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
      <Snackbar
        visible={errorSnackbar}
        message="Checkout failed. Please try again."
        actionLabel="Dismiss"
        onAction={() => setErrorSnackbar(false)}
        onDismiss={() => setErrorSnackbar(false)}
        duration={4000}
        type="error"
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
  gradientRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  label: {},
});

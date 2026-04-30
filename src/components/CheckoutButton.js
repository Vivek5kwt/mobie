import React, { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { createShopifyCartCheckout } from "../services/shopify";
import Snackbar from "./Snackbar";
import { resolveFA4IconName } from "../utils/faIconAlias";

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

const cleanFontFamily = (family) => {
  if (!family) return undefined;
  const cleaned = String(family).split(",")[0].trim().replace(/['"]/g, "");
  return cleaned || undefined;
};

// First non-empty string wins
const pickStr = (candidates, fallback) => {
  for (const c of candidates) {
    const v = toStr(c, "");
    if (v) return v;
  }
  return fallback;
};

// First valid number wins
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

const interpolateGradientColor = (colors, ratio) => {
  if (!colors || colors.length === 0) return "#FFFFFF";
  if (colors.length === 1) return colors[0];
  const scaled = Math.max(0, Math.min(1, ratio)) * (colors.length - 1);
  const idx    = Math.min(Math.floor(scaled), colors.length - 2);
  const t      = scaled - idx;
  const c1     = hexToRgb(colors[idx]);
  const c2     = hexToRgb(colors[idx + 1]);
  return `rgb(${Math.round(c1.r + (c2.r - c1.r) * t)},${Math.round(c1.g + (c2.g - c1.g) * t)},${Math.round(c1.b + (c2.b - c1.b) * t)})`;
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function CheckoutButton({ section }) {
  const navigation = useNavigation();
  const cartItems  = useSelector((state) => state?.cart?.items || []);
  const hasCartItems = cartItems.length > 0;

  // ── Resolve props node ───────────────────────────────────────────────────────
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  // Unwrap the raw sub-object — handles { value:{} }, { const:{} }, and { properties:{} } envelopes
  const rawNode = propsNode?.raw;
  const rawUnwrapped = (() => {
    if (!rawNode || typeof rawNode !== "object") return rawNode;
    if (rawNode.value      !== undefined) return rawNode.value;
    if (rawNode.const      !== undefined) return rawNode.const;
    if (rawNode.properties !== undefined) return rawNode.properties;
    return rawNode;
  })();
  // Merge propsNode into raw so top-level DSL keys (outside the raw block) are also reachable
  const raw = {
    ...(typeof propsNode === "object" ? propsNode : {}),
    ...(rawUnwrapped && typeof rawUnwrapped === "object" ? rawUnwrapped : {}),
  };

  const pressCss = deepUnwrap(propsNode?.presentation)?.css || {};
  const btnCss   = deepUnwrap(pressCss?.button ?? pressCss?.checkout) || {};

  // ── Label ────────────────────────────────────────────────────────────────────
  // buttonShowText controls visibility; label/buttonText is the text
  const buttonShowText = toBool(raw?.buttonShowText, true);
  const label = buttonShowText
    ? pickStr([raw?.label, raw?.buttonText, raw?.text, raw?.buttonLabel, propsNode?.label], "Checkout")
    : "";

  // ── Button variant: "filled" | "outlined" | "ghost" ──────────────────────────
  const buttonVariant = toStr(raw?.buttonVariant ?? raw?.variant, "filled").toLowerCase();
  const isOutlined    = buttonVariant === "outlined";
  const isGhost       = buttonVariant === "ghost";

  // ── Background colour ─────────────────────────────────────────────────────────
  // buttonBgColor is the primary builder key; fall back through all known aliases.
  // Default is black so the button is always visible before DSL loads.
  const bgColor = pickStr(
    [
      raw?.buttonBgColor, raw?.btnBgColor,
      raw?.buttonBackground, raw?.btnBackground,
      raw?.backgroundColor, raw?.bgColor,
      raw?.background, raw?.buttonBg, raw?.btn_bg,
      raw?.color_bg, raw?.bgcolour,
      btnCss?.backgroundColor, btnCss?.background,
    ],
    isOutlined || isGhost ? "transparent" : "#000000"
  );

  // ── Text colour ───────────────────────────────────────────────────────────────
  const hasExplicitTextColor = !!(
    deepUnwrap(raw?.buttonTextColor) ||
    deepUnwrap(raw?.textColor)       ||
    deepUnwrap(raw?.labelColor)      ||
    deepUnwrap(raw?.color)           ||
    deepUnwrap(raw?.text_color)      ||
    deepUnwrap(btnCss?.color)
  );
  const textColor = pickStr(
    [
      raw?.buttonTextColor, raw?.textColor,
      raw?.labelColor, raw?.color, raw?.text_color,
      raw?.buttonLabelColor, raw?.btnTextColor,
      btnCss?.color,
    ],
    "#FFFFFF"
  );

  // ── Gradient text colours ─────────────────────────────────────────────────────
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

  const textGradient = dslGradient ?? (hasExplicitTextColor ? null : DEFAULT_TEXT_GRADIENT);

  // ── Border ────────────────────────────────────────────────────────────────────
  // buttonBorderColor is primary; for "outlined" variant always show border
  const borderColorVal = pickStr(
    [
      raw?.buttonBorderColor, raw?.borderColor,
      raw?.border_color, raw?.strokeColor,
      raw?.buttonStrokeColor, raw?.btnBorderColor,
      btnCss?.borderColor, btnCss?.border,
    ],
    isOutlined ? textColor : ""
  );
  const borderWidthRaw = pickNum(
    [raw?.buttonBorderWidth, raw?.borderWidth, raw?.borderSize, raw?.border_width, btnCss?.borderWidth],
    0
  );
  const showBorder  = isOutlined || !!borderColorVal || borderWidthRaw > 0;
  const borderWidth = showBorder ? (borderWidthRaw > 0 ? borderWidthRaw : 1) : 0;

  // ── Dimensions & shape ────────────────────────────────────────────────────────
  // buttonRadius is the primary DSL field for corner radius
  const height = pickNum(
    [raw?.height, raw?.btnHeight, raw?.buttonHeight, btnCss?.height],
    52
  );
  const borderRadius = pickNum(
    [raw?.buttonRadius, raw?.borderRadius, raw?.cornerRadius, raw?.corner, raw?.rounded, btnCss?.borderRadius],
    10
  );
  const fullWidth = toBool(raw?.fullWidth ?? raw?.isFullWidth, true);

  // ── Typography ────────────────────────────────────────────────────────────────
  // buttonFontSize / buttonFontWeight / buttonFontFamily are primary DSL fields
  const fontSize   = pickNum(
    [raw?.buttonFontSize, raw?.fontSize, raw?.textSize, raw?.labelSize, btnCss?.fontSize],
    16
  );
  const isBold     = toBool(raw?.buttonBold ?? raw?.bold, false);
  const fontWeight = toFontWeight(
    isBold ? "700" : (raw?.buttonFontWeight ?? raw?.fontWeight ?? raw?.textWeight ?? raw?.labelWeight ?? btnCss?.fontWeight),
    "600"
  );
  const fontFamily    = cleanFontFamily(toStr(raw?.buttonFontFamily ?? raw?.fontFamily ?? raw?.labelFamily ?? btnCss?.fontFamily, ""));
  const italic        = toBool(raw?.buttonItalic   ?? raw?.italic,    false);
  const underline     = toBool(raw?.buttonUnderline ?? raw?.underline, false);
  const strikethrough = toBool(raw?.buttonStrikethrough ?? raw?.strikethrough, false);
  const letterSpacing = pickNum([raw?.letterSpacing, btnCss?.letterSpacing], 0.3);

  const textDecorationLine = (() => {
    if (underline && strikethrough) return "underline line-through";
    if (underline)                   return "underline";
    if (strikethrough)               return "line-through";
    return "none";
  })();

  // ── Button padding (buttonPadding* fields take priority) ──────────────────────
  const padT = pickNum([raw?.buttonPaddingTop,    raw?.paddingTop,    raw?.padT, raw?.pt, btnCss?.paddingTop],    12);
  const padB = pickNum([raw?.buttonPaddingBottom, raw?.paddingBottom, raw?.padB, raw?.pb, btnCss?.paddingBottom], 12);
  const padL = pickNum([raw?.buttonPaddingLeft,   raw?.paddingLeft,   raw?.padL, raw?.pl, btnCss?.paddingLeft],   16);
  const padR = pickNum([raw?.buttonPaddingRight,  raw?.paddingRight,  raw?.padR, raw?.pr, btnCss?.paddingRight],  16);

  // ── Outer container ───────────────────────────────────────────────────────────
  // Container uses its own keys — NOT backgroundColor (that belongs to the button)
  const showBgPadding = toBool(raw?.buttonShowBackgroundPadding, true);
  const containerBg   = pickStr(
    [raw?.containerBg, raw?.outerBg, raw?.wrapperBg, raw?.sectionBg],
    "transparent"
  );
  const gap = pickNum([raw?.gap, raw?.marginTop, raw?.mt], 0);

  // ── Disabled state ────────────────────────────────────────────────────────────
  const disabledBg        = pickStr([raw?.disabledBg,        raw?.disabledBackground], "#9CA3AF");
  const disabledTextColor = pickStr([raw?.disabledTextColor, raw?.disabledColor],      "#E5E7EB");

  // ── Checkout lines ────────────────────────────────────────────────────────────
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
  const [loading,       setLoading]       = useState(false);

  const handleCheckout = async () => {
    if (!hasCartItems) { setEmptySnackbar(true); return; }
    if (loading) return;
    setLoading(true);
    try {
      const checkoutUrl = await createShopifyCartCheckout({ items: checkoutLines });
      if (checkoutUrl && navigation?.navigate) {
        navigation.navigate("CheckoutWebView", { url: checkoutUrl, title: "Checkout" });
      } else {
        setErrorSnackbar(true);
      }
    } catch {
      setErrorSnackbar(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed active / disabled values ────────────────────────────────────────
  const activeBg        = hasCartItems ? bgColor       : disabledBg;
  const activeTextColor = hasCartItems ? textColor      : disabledTextColor;
  const activeBorderClr = hasCartItems ? borderColorVal : disabledBg;

  // Mirror the existing DSL button-icon pattern used by BannerSlider / HeroBanner / SignUp.
  const rawButtonIcon = pickStr(
    [raw?.buttonIcon, raw?.buttonIconName, raw?.iconName, raw?.iconType, raw?.icon],
    ""
  );
  const buttonIconName = resolveFA4IconName(rawButtonIcon);
  const buttonIconAlignment = pickStr(
    [raw?.buttonIconAlignment, raw?.buttonIconPosition, raw?.buttonIconAlign, raw?.iconAlign, raw?.iconPosition],
    "left"
  ).toLowerCase() === "right"
    ? "right"
    : "left";
  const buttonIconVisible = toBool(
    raw?.buttonIconsVisible ??
      raw?.buttonIconVisible ??
      raw?.showButtonIcon ??
      raw?.showIcon ??
      raw?.iconActive,
    true
  );
  const buttonIconSize = pickNum([raw?.buttonIconSize, raw?.iconSize], 14);
  const buttonIconColor = pickStr([raw?.buttonIconColor, raw?.iconColor], activeTextColor);
  const buttonIconGap = pickNum([raw?.buttonIconGap, raw?.iconGap], 6);
  const showButtonIcon = buttonIconVisible && !!buttonIconName;

  const buttonStyle = {
    height,
    borderRadius,
    backgroundColor: activeBg,
    width:           fullWidth ? "100%" : undefined,
    borderWidth,
    borderColor:     showBorder ? activeBorderClr : undefined,
    minHeight:       height,
  };

  const baseTextStyle = {
    fontSize,
    fontWeight,
    fontStyle:          italic        ? "italic"    : "normal",
    letterSpacing,
    textDecorationLine,
    ...(fontFamily ? { fontFamily } : {}),
  };

  // ── Render label ──────────────────────────────────────────────────────────────
  const renderLabel = () => {
    if (loading) {
      return <ActivityIndicator color={activeTextColor} size="small" />;
    }
    if (!hasCartItems) {
      return (
        <Text style={[styles.label, baseTextStyle, { color: disabledTextColor }]}>
          {label}
        </Text>
      );
    }
    // Gradient mode
    if (textGradient && label) {
      const chars = [...label];
      return (
        <View style={styles.gradientRow}>
          {chars.map((char, i) => {
            const ratio = chars.length <= 1 ? 0.5 : i / (chars.length - 1);
            return (
              <Text key={i} style={[styles.label, baseTextStyle, { color: interpolateGradientColor(textGradient, ratio) }]}>
                {char}
              </Text>
            );
          })}
        </View>
      );
    }
    // Solid colour
    return (
      <Text style={[styles.label, baseTextStyle, { color: activeTextColor }]}>
        {label}
      </Text>
    );
  };

  const renderButtonContent = () => {
    const iconStyle =
      buttonIconAlignment === "right"
        ? { marginLeft: buttonIconGap }
        : { marginRight: buttonIconGap };

    return (
      <View style={styles.buttonContent}>
        {showButtonIcon && buttonIconAlignment !== "right" ? (
          <FontAwesome name={buttonIconName} size={buttonIconSize} color={buttonIconColor} style={iconStyle} />
        ) : null}
        {renderLabel()}
        {showButtonIcon && buttonIconAlignment === "right" ? (
          <FontAwesome name={buttonIconName} size={buttonIconSize} color={buttonIconColor} style={iconStyle} />
        ) : null}
      </View>
    );
  };

  // ── Outer container padding ───────────────────────────────────────────────────
  const containerPadding = showBgPadding
    ? { paddingTop: padT, paddingBottom: padB, paddingLeft: padL, paddingRight: padR }
    : { paddingTop: 0,   paddingBottom: 0,    paddingLeft: 0,    paddingRight: 0 };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: containerBg, marginTop: gap },
        containerPadding,
      ]}
    >
      <TouchableOpacity
        style={[styles.button, buttonStyle]}
        activeOpacity={0.8}
        onPress={handleCheckout}
        accessibilityRole="button"
        accessibilityLabel={label || "Checkout"}
      >
        {renderButtonContent()}
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
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  gradientRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  label: {},
});

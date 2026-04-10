import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { StackActions, useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { addItem } from "../store/slices/cartSlice";
import Snackbar from "./Snackbar";
import {
  createShopifyCheckout,
  getShopifyDomain,
  getShopifyToken,
} from "../services/shopify";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

// Deep unwrap — keeps traversing value/const wrappers until a plain value
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
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

const alignToJustify = (align) => {
  switch (align?.toLowerCase?.()) {
    case "left":
      return "flex-start";
    case "right":
      return "flex-end";
    case "center":
      return "center";
    default:
      return "center";
  }
};

const buildPadding = (config) => ({
  paddingTop: toNumber(config?.pt, 0),
  paddingBottom: toNumber(config?.pb, 0),
  paddingLeft: toNumber(config?.pl, 0),
  paddingRight: toNumber(config?.pr, 0),
});

const buildButtonStyles = (config, defaultBg = "#F9A8D4") => {
  const borderColor = toString(config?.borderColor, "");
  const borderWidth = config?.borderLine || borderColor ? 1 : 0;

  return {
    ...buildPadding(config),
    backgroundColor: toString(config?.bgColor, defaultBg),
    borderRadius: toNumber(config?.borderRadius, 8),
    borderColor: borderColor || undefined,
    borderWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: alignToJustify(config?.align),
  };
};

const resolveIconName = (iconName) => {
  if (!iconName) return "";
  const trimmed = iconName.trim();
  return trimmed.startsWith("fa-") ? trimmed.slice(3) : trimmed;
};

const extractVariantIdentifiers = (value) => {
  if (!value) return { gid: "", numeric: "" };
  const raw = String(value);
  if (raw.startsWith("gid://")) {
    const match = raw.match(/ProductVariant\/(\d+)/);
    return { gid: raw, numeric: match ? match[1] : "" };
  }
  const match = raw.match(/(\d+)/);
  if (match) {
    return {
      gid: `gid://shopify/ProductVariant/${match[1]}`,
      numeric: match[1],
    };
  }
  return { gid: raw, numeric: "" };
};

const buildCheckoutUrl = ({ shopifyDomain, variantNumericId, quantity, handle }) => {
  if (variantNumericId) {
    return `https://${shopifyDomain}/cart/${variantNumericId}:${Math.max(1, quantity)}`;
  }

  if (handle) {
    return `https://${shopifyDomain}/products/${handle}`;
  }

  return "";
};

export default function AddToCart({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  // Merge the .raw sub-object into the top-level props (same pattern as Countdown/AccountMenu)
  const rawWrapped = deepUnwrap(propsNode?.raw);
  const raw = (rawWrapped && typeof rawWrapped === "object") ? { ...propsNode, ...rawWrapped } : (propsNode || {});

  const presentation = deepUnwrap(propsNode?.presentation) || {};
  const css = deepUnwrap(presentation?.css) || deepUnwrap(presentation?.properties?.css) || {};

  const addToCartConfig = deepUnwrap(raw?.addToCart) || deepUnwrap(css?.addToCart) || {};
  const buyNowConfig    = deepUnwrap(raw?.buyNow)    || deepUnwrap(css?.buyNow)    || {};
  const quantityConfig  = deepUnwrap(raw?.quantityPicker) || deepUnwrap(css?.quantityPicker) || {};
  const visibility      = deepUnwrap(raw?.visibility) || deepUnwrap(css?.visibility) || {};

  const showAddToCart      = toBoolean(deepUnwrap(visibility?.addToCart),           true);
  const showAddToCartIcon  = toBoolean(deepUnwrap(visibility?.addToCartIcon),       false);
  const showAddToCartText  = toBoolean(deepUnwrap(visibility?.addToCartText),       true);
  const showBuyNow         = toBoolean(deepUnwrap(visibility?.buyNow),              true);
  const showBuyNowIcon     = toBoolean(deepUnwrap(visibility?.buyNowIcon),          false);
  const showBuyNowText     = toBoolean(deepUnwrap(visibility?.buyNowText),          true);
  const showQuantityPicker = toBoolean(deepUnwrap(visibility?.quantityPicker),      true);
  const showQuantityText   = toBoolean(deepUnwrap(visibility?.quantityPickerText),  true);
  const showQuantityIcons  = toBoolean(deepUnwrap(visibility?.quantityPickerIcons), true);

  const addToCartText = toString(raw?.buttonText ?? addToCartConfig?.text, "Add to Cart");
  const buyNowText = toString(raw?.buyNowText ?? buyNowConfig?.text, "Buy Now");
  const quantityLabel = toString(raw?.quantityLabel ?? quantityConfig?.label, "Quantity");
  const shopifyDomain = toString(raw?.shopifyDomain, getShopifyDomain());
  const shopifyToken = toString(raw?.storefrontToken, getShopifyToken());
  const productHandle = toString(raw?.handle, "");
  const productTitle = toString(raw?.title, "Product Name");
  const productImage = toString(raw?.imageUrl, "");
  const productPrice = toNumber(raw?.salePrice ?? raw?.standardPrice, 0);
  const productCompareAtPrice = toNumber(raw?.compareAtPrice ?? raw?.originalPrice ?? raw?.regularPrice, 0);
  const productVendor = toString(raw?.vendor ?? raw?.vendorName, "");
  const productVariantText = toString(raw?.variantText, "");
  const productCurrency = toString(raw?.currencySymbol, "");
  const { gid: productVariantGid, numeric: productVariantNumericId } = extractVariantIdentifiers(
    toString(raw?.variantId || raw?.defaultVariantId, "")
  );

  const [quantity, setQuantity] = useState(1);
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const addToCartButtonStyle = useMemo(() => buildButtonStyles(addToCartConfig), [addToCartConfig]);
  const buyNowButtonStyle = useMemo(() => buildButtonStyles(buyNowConfig), [buyNowConfig]);
  const addToCartUrl = useMemo(
    () =>
      buildCheckoutUrl({
        shopifyDomain,
        variantNumericId: productVariantNumericId,
        quantity,
        handle: productHandle,
      }),
    [shopifyDomain, productVariantNumericId, quantity, productHandle]
  );
  const buyNowUrl = useMemo(
    () =>
      buildCheckoutUrl({
        shopifyDomain,
        variantNumericId: productVariantNumericId,
        quantity,
        handle: productHandle,
      }),
    [shopifyDomain, productVariantNumericId, quantity, productHandle]
  );

  const addToCartTextStyle = {
    color: toString(addToCartConfig?.textColor, "#111827"),
    fontSize: toNumber(addToCartConfig?.textSize, 15),
    fontWeight: toString(addToCartConfig?.textWeight, "600"),
    marginLeft: showAddToCartIcon ? 6 : 0,
  };

  const buyNowTextStyle = {
    color: toString(buyNowConfig?.textColor, "#ffffff"),
    fontSize: toNumber(buyNowConfig?.textSize, 12),
    fontWeight: toString(buyNowConfig?.textWeight, "700"),
    marginLeft: showBuyNowIcon ? 6 : 0,
  };

  const quantityContainerStyle = {
    ...buildPadding(quantityConfig),
    backgroundColor: toString(quantityConfig?.bgColor, "#ffffff"),
    borderColor: toString(quantityConfig?.borderColor, "#E5E7EB"),
    borderWidth: quantityConfig?.borderLine || quantityConfig?.borderColor ? 1 : 0,
    borderRadius: toNumber(quantityConfig?.borderRadius, 6),
  };

  const quantityTextStyle = {
    color: toString(quantityConfig?.textColor, "#111827"),
    fontSize: toNumber(quantityConfig?.textSize, 12),
    fontWeight: toString(quantityConfig?.textWeight, "700"),
  };

  const decrement = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increment = () => setQuantity((prev) => prev + 1);

  const minusIconName = resolveIconName(quantityConfig?.minusIcon);
  const plusIconName = resolveIconName(quantityConfig?.plusIcon);
  const addToCartIconName = resolveIconName(addToCartConfig?.icon);
  const buyNowIconName = resolveIconName(buyNowConfig?.icon);

  const resolveBottomNavItems = (rawSection) => {
    if (!rawSection) return [];
    const rawProps =
      rawSection?.props || rawSection?.properties?.props?.properties || rawSection?.properties?.props || {};
    const rawValue = unwrapValue(rawProps?.raw, {});
    let items = unwrapValue(rawValue?.items, undefined);
    if (!items) {
      items = unwrapValue(rawProps?.items, []);
    }
    if (items?.value && Array.isArray(items.value)) return items.value;
    return Array.isArray(items) ? items : [];
  };

  const normalizeBottomNavTarget = (value) => String(value || "").trim().toLowerCase();

  const resolveBottomNavIndex = (items, target) => {
    const normalizedTarget = normalizeBottomNavTarget(target);
    if (!normalizedTarget) return -1;
    return items.findIndex((item) => {
      const id = normalizeBottomNavTarget(item?.id);
      const label = normalizeBottomNavTarget(
        item?.label ?? item?.title ?? item?.name ?? item?.text ?? item?.value,
      );
      return id.includes(normalizedTarget) || label.includes(normalizedTarget);
    });
  };

  const openCartScreen = () => {
    // Only use the real DSL-provided bottom nav — never fall back to hardcoded defaults.
    // If the app has no bottom navigation, the cart page should not show one either.
    const navSection = section?.bottomNavSection || null;
    const items = resolveBottomNavItems(navSection);
    const resolvedIndex = resolveBottomNavIndex(items, "cart");
    const activeIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
    const item = items[activeIndex];
    const title = item?.label || item?.title || item?.name || "Cart";
    const rawLink = item?.link ?? item?.href ?? item?.url ?? "";
    const link = typeof rawLink === "string" ? rawLink.replace(/^\//, "") : "cart";
    const params = {
      title: title || "Cart",
      link: link || "cart",
      activeIndex,
      ...(navSection ? { bottomNavSection: navSection } : {}),
    };
    navigation.dispatch(StackActions.replace("BottomNavScreen", params));
  };

  const openCheckoutUrl = async (url, title = "Checkout") => {
    if (!url) return false;
    if (navigation?.navigate) {
      navigation.navigate("CheckoutWebView", { url, title });
      return true;
    }
    console.log("Checkout webview navigation not available.");
    return false;
  };

  const canAddLocally =
    productTitle || productHandle || productVariantGid || productVariantNumericId;

  const handleAddToCart = async () => {
    if (!addToCartUrl && !productVariantGid && !canAddLocally) return;

    dispatch(
      addItem({
        item: {
          id: productVariantGid || productVariantNumericId || productHandle || productTitle,
          variantId: productVariantGid || "",
          title: productTitle,
          image: productImage,
          price: productPrice,
          compareAtPrice: productCompareAtPrice,
          vendor: productVendor,
          variant: productVariantText,
          currency: productCurrency,
          quantity,
        },
      })
    );

    setSnackbarVisible(true);
  };

  const handleBuyNow = async () => {
    if (!buyNowUrl && !productVariantGid) return;

    if (buyNowUrl) {
      const opened = await openCheckoutUrl(buyNowUrl, "Checkout");
      if (opened) return;
    }

    if (!productVariantGid) return;

    try {
      const checkoutUrl = await createShopifyCheckout({
        variantId: productVariantGid,
        quantity,
        options: { shop: shopifyDomain, token: shopifyToken },
      });
      await openCheckoutUrl(checkoutUrl, "Checkout");
    } catch (error) {
      console.log("Unable to open Shopify checkout:", error);
    }
  };

  const containerBg = toString(
    raw?.bgColor ?? css?.bgColor ?? propsNode?.backgroundAndPadding?.bgColor,
    "#FFFFFF"
  );
  const containerPT = toNumber(raw?.pt ?? css?.pt ?? propsNode?.backgroundAndPadding?.paddingTop, 12);
  const containerPB = toNumber(raw?.pb ?? css?.pb ?? propsNode?.backgroundAndPadding?.paddingBottom, 12);
  const containerPL = toNumber(raw?.pl ?? css?.pl ?? propsNode?.backgroundAndPadding?.paddingLeft, 16);
  const containerPR = toNumber(raw?.pr ?? css?.pr ?? propsNode?.backgroundAndPadding?.paddingRight, 16);

  const quantityLabelColor  = toString(quantityConfig?.labelColor, "#111827");
  const quantityLabelSize   = toNumber(quantityConfig?.labelFontSize, 14);
  const quantityLabelWeight = toString(quantityConfig?.labelFontWeight, "500");

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: containerBg,
        paddingTop:      containerPT,
        paddingBottom:   containerPB,
        paddingLeft:     containerPL,
        paddingRight:    containerPR,
      },
    ]}>

      {/* ── Quantity row: label left, controls right ── */}
      {showQuantityPicker && (
        <View style={styles.quantityRow}>
          {/* Label */}
          <Text style={{
            fontSize:   quantityLabelSize,
            color:      quantityLabelColor,
            fontWeight: quantityLabelWeight,
          }}>
            {quantityLabel}
          </Text>

          {/* – count + controls */}
          <View style={[styles.quantityControls, quantityContainerStyle]}>
            {showQuantityIcons && (
              <TouchableOpacity onPress={decrement} style={styles.quantityButton}>
                {minusIconName ? (
                  <FontAwesome
                    name={minusIconName}
                    size={toNumber(quantityConfig?.minusIconSize, 14)}
                    color={toString(quantityConfig?.minusIconColor, quantityTextStyle.color)}
                  />
                ) : (
                  <Text style={[quantityTextStyle, styles.quantitySymbol]}>−</Text>
                )}
              </TouchableOpacity>
            )}
            {showQuantityText && (
              <Text style={[styles.quantityText, quantityTextStyle]}>{quantity}</Text>
            )}
            {showQuantityIcons && (
              <TouchableOpacity onPress={increment} style={styles.quantityButton}>
                {plusIconName ? (
                  <FontAwesome
                    name={plusIconName}
                    size={toNumber(quantityConfig?.plusIconSize, 14)}
                    color={toString(quantityConfig?.plusIconColor, quantityTextStyle.color)}
                  />
                ) : (
                  <Text style={[quantityTextStyle, styles.quantitySymbol]}>+</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Add to Cart button (full-width) ── */}
      {showAddToCart && (
        <TouchableOpacity
          style={[styles.fullButton, addToCartButtonStyle]}
          onPress={handleAddToCart}
          disabled={!addToCartUrl && !productVariantGid && !canAddLocally}
          activeOpacity={0.8}
        >
          {showAddToCartIcon && !!addToCartIconName && (
            <FontAwesome
              name={addToCartIconName}
              size={toNumber(addToCartConfig?.iconSize, 14)}
              color={toString(addToCartConfig?.iconColor, addToCartTextStyle.color)}
              style={{ marginRight: 6 }}
            />
          )}
          {showAddToCartText && (
            <Text style={addToCartTextStyle}>{addToCartText}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Buy Now button (full-width) ── */}
      {showBuyNow && (
        <TouchableOpacity
          style={[styles.fullButton, buyNowButtonStyle, showAddToCart && { marginTop: 8 }]}
          onPress={handleBuyNow}
          activeOpacity={0.8}
        >
          {showBuyNowIcon && !!buyNowIconName && (
            <FontAwesome
              name={buyNowIconName}
              size={toNumber(buyNowConfig?.iconSize, 14)}
              color={toString(buyNowConfig?.iconColor, buyNowTextStyle.color)}
              style={{ marginRight: 6 }}
            />
          )}
          {showBuyNowText && (
            <Text style={buyNowTextStyle}>{buyNowText}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Add to Cart snackbar ── */}
      <Snackbar
        visible={snackbarVisible}
        message={`${productTitle || "Item"} added to cart`}
        actionLabel="View Cart"
        onAction={openCartScreen}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2500}
        type="success"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "column",
  },
  // Quantity row: label left, controls right
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 6,
    paddingHorizontal: 4,
    gap: 4,
  },
  quantityButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 28,
  },
  quantitySymbol: {
    fontSize: 16,
    lineHeight: 20,
  },
  quantityText: {
    minWidth: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  // Full-width buttons
  fullButton: {
    width: "100%",
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
});

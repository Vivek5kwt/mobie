import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { addItem } from "../store/slices/cartSlice";
import { useToast } from "./ToastProvider";
import {
  getShopifyDomain,
  createShopifyCheckout,
} from "../services/shopify";
import { resolveFirstFont } from "../services/typographyService";
import { ADD_TO_CART_SUCCESS_MESSAGE, resolveCartNavigationParams } from "../utils/cartFeedback";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { parseMoneyAmount } from "../utils/money";
import { getVariantSelection, subscribeVariantSelection } from "../utils/variantSelectionStore";

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

const asObject = (value) => {
  const resolved = deepUnwrap(value);
  return resolved && typeof resolved === "object" && !Array.isArray(resolved) ? resolved : {};
};

const mergeConfig = (...configs) =>
  configs.reduce((acc, config) => ({ ...acc, ...asObject(config) }), {});

const toNumber = (value, fallback = 0) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  const parsed = parseMoneyAmount(resolved);
  return parsed === null ? fallback : parsed;
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

const hasValue = (value) => {
  const resolved = unwrapValue(value, undefined);
  return resolved !== undefined && resolved !== null && resolved !== "";
};


const buildPadding = (config) => ({
  paddingTop: toNumber(config?.pt, 0),
  paddingBottom: toNumber(config?.pb, 0),
  paddingLeft: toNumber(config?.pl, 0),
  paddingRight: toNumber(config?.pr, 0),
});

const resolveJustifyContent = (config) => {
  const alignRaw = toString(
    config?.textAlign ?? config?.contentAlign ?? config?.justifyContent,
    "center"
  ).toLowerCase();

  return (
    alignRaw === "left" || alignRaw === "start" || alignRaw === "flex-start" ? "flex-start" :
    alignRaw === "right" || alignRaw === "end" || alignRaw === "flex-end" ? "flex-end" :
    "center"
  );
};

const resolveTextAlign = (config, raw) => {
  const alignRaw = toString(
    config?.textAlign ?? config?.contentAlign ?? raw?.atcTextAlign ?? raw?.buttonTextAlign,
    "center"
  ).toLowerCase();

  return alignRaw === "left" ? "left" : alignRaw === "right" ? "right" : "center";
};

const buildButtonStyles = (config, defaultBg = "#1F2937") => {
  const borderColor = toString(config?.borderColor, "");
  const borderWidth = config?.borderLine || borderColor ? 1 : 0;

  return {
    paddingTop: hasValue(config?.pt) ? toNumber(config?.pt, 0) : 8,
    paddingBottom: hasValue(config?.pb) ? toNumber(config?.pb, 0) : 8,
    paddingLeft: hasValue(config?.pl) ? toNumber(config?.pl, 0) : 18,
    paddingRight: hasValue(config?.pr) ? toNumber(config?.pr, 0) : 18,
    backgroundColor: toString(config?.bgColor, defaultBg),
    borderRadius: toNumber(config?.borderRadius ?? config?.corner ?? config?.radius, 999),
    borderColor: borderColor || undefined,
    borderWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: resolveJustifyContent(config),
  };
};

const resolveIconName = (iconName) => {
  if (!iconName) return "";
  return resolveFA4IconName(iconName);
};

const firstDefined = (...values) => values.find((value) => hasValue(value));

const normalizeVariants = (value) => {
  const resolved = deepUnwrap(value);
  return Array.isArray(resolved) ? resolved.filter(Boolean) : [];
};

const isVariantAvailable = (variant) =>
  variant?.availableForSale !== false &&
  String(variant?.availableForSale).trim().toLowerCase() !== "false";

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
  const showToast = useToast();
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  // Merge the .raw sub-object into the top-level props (same pattern as Countdown/AccountMenu)
  const rawWrapped = deepUnwrap(propsNode?.raw);
  const raw = (rawWrapped && typeof rawWrapped === "object") ? { ...propsNode, ...rawWrapped } : (propsNode || {});

  const presentation = deepUnwrap(propsNode?.presentation) || {};
  const css = deepUnwrap(presentation?.css) || deepUnwrap(presentation?.properties?.css) || {};

  const addToCartConfig = mergeConfig(css?.addToCart, raw?.addToCart);
  const quantityConfig  = mergeConfig(css?.quantityPicker, raw?.quantityPicker);
  const buyNowConfig    = mergeConfig(css?.buyNow, raw?.buyNow);

  // Visibility
  const rawWrappedVis = (rawWrapped && typeof rawWrapped === "object") ? rawWrapped : {};
  const visibility    = mergeConfig(css?.visibility, rawWrappedVis?.visibility, raw?.visibility);

  const showAddToCart      = toBoolean(deepUnwrap(visibility?.addToCart),           true);
  const showAddToCartIconSetting = firstDefined(
    deepUnwrap(visibility?.addToCartIcon),
    deepUnwrap(visibility?.icon),
    raw?.showAddToCartIcon,
    raw?.showButtonIcon,
    raw?.buttonIconVisible,
    raw?.buttonIconsVisible,
    raw?.showIcon,
    raw?.iconActive
  );
  const showAddToCartText  = toBoolean(deepUnwrap(visibility?.addToCartText),       true);
  const showQuantityPicker = toBoolean(deepUnwrap(visibility?.quantityPicker),      true);
  const showQuantityText   = toBoolean(deepUnwrap(visibility?.quantityPickerText),  true);
  const showQuantityIcons  = toBoolean(deepUnwrap(visibility?.quantityPickerIcons), true);
  const showBuyNow         = toBoolean(deepUnwrap(visibility?.buyNow),              true);
  const showBuyNowText     = toBoolean(deepUnwrap(visibility?.buyNowText),         true);

  const addToCartText = toString(
    addToCartConfig?.text ?? addToCartConfig?.label ?? raw?.buttonText ?? raw?.addToCartText,
    "Add to Cart"
  );
  const quantityLabel = toString(raw?.quantityLabel ?? quantityConfig?.label, "Quantity");
  const shopifyDomain = toString(raw?.shopifyDomain, getShopifyDomain());
  const productHandle = toString(raw?.handle, "");
  const productTitle = toString(raw?.title, "Product Name");
  const productVendor = toString(raw?.vendor ?? raw?.vendorName, "");
  const productVariants = normalizeVariants(raw?.variants);

  // Live variant resolved by the (sibling, prop-disconnected) VariantSelector
  // block — see utils/variantSelectionStore.js. Falls back to the DSL-baked
  // defaults below when no VariantSelector is on this screen, or before its
  // first publish.
  const productKey = toString(raw?.id) || productHandle;
  const [variantVersion, setVariantVersion] = useState(0);
  useEffect(() => {
    if (!productKey) return undefined;
    return subscribeVariantSelection((changedKey) => {
      if (!changedKey || changedKey === productKey) setVariantVersion((v) => v + 1);
    });
  }, [productKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedVariant = useMemo(() => getVariantSelection(productKey), [productKey, variantVersion]);

  const productImage = selectedVariant?.image?.url || toString(raw?.imageUrl, "");
  const productPrice = selectedVariant?.price != null
    ? toNumber(selectedVariant.price, 0)
    : toNumber(raw?.salePrice ?? raw?.standardPrice, 0);
  const productCompareAtPrice = selectedVariant?.compareAtPrice != null
    ? toNumber(selectedVariant.compareAtPrice, 0)
    : toNumber(raw?.compareAtPrice ?? raw?.originalPrice ?? raw?.regularPrice, 0);
  const productVariantText = selectedVariant?.title && selectedVariant.title !== "Default Title"
    ? selectedVariant.title
    : toString(raw?.variantText, "");
  const productCurrency = toString(
    selectedVariant?.price?.currencyCode || raw?.currency || raw?.priceCurrency || raw?.currencySymbol,
    ""
  ).trim();
  const rawAvailableForSale = unwrapValue(raw?.availableForSale, undefined);
  const productExplicitlyUnavailable =
    rawAvailableForSale === false ||
    String(rawAvailableForSale).trim().toLowerCase() === "false";
  const productAvailable = productExplicitlyUnavailable
    ? false
    : selectedVariant
      ? isVariantAvailable(selectedVariant)
      : productVariants.length
        ? productVariants.some(isVariantAvailable)
        : true;
  const unavailableText = toString(
    addToCartConfig?.unavailableText ?? raw?.unavailableText ?? raw?.soldOutText,
    "Item Not Available"
  );
  const unavailableBgColor = toString(
    addToCartConfig?.unavailableBgColor ?? raw?.unavailableBgColor ?? raw?.soldOutBgColor,
    "#7A7A7A"
  );
  const unavailableTextColor = toString(
    addToCartConfig?.unavailableTextColor ?? raw?.unavailableTextColor ?? raw?.soldOutTextColor,
    "#FFFFFF"
  );
  const { gid: productVariantGid, numeric: productVariantNumericId } = extractVariantIdentifiers(
    toString(selectedVariant?.id || raw?.variantId || raw?.defaultVariantId, "")
  );

  const [quantity, setQuantity] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);

  const addToCartButtonStyle = useMemo(
    () => ({
      ...buildButtonStyles(addToCartConfig, "#1F2937"),
      ...(!productAvailable ? { backgroundColor: unavailableBgColor } : null),
    }),
    [addToCartConfig, productAvailable, unavailableBgColor]
  );
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

  const addToCartBg = toString(addToCartConfig?.bgColor, "#1F2937");
  const addToCartFgRaw = toString(addToCartConfig?.textColor, "");
  const addToCartFg = addToCartFgRaw && addToCartFgRaw !== addToCartBg
    ? addToCartFgRaw
    : addToCartBg.toLowerCase() === "#ffffff" || addToCartBg.toLowerCase() === "#fff" ? "#111827" : "#ffffff";

  const atcTextAlign = resolveTextAlign(addToCartConfig, raw);

  const addToCartTextStyle = {
    color: productAvailable ? addToCartFg : unavailableTextColor,
    fontSize: toNumber(addToCartConfig?.textSize, 15),
    fontWeight: toString(addToCartConfig?.textWeight, "600"),
    fontFamily: resolveFirstFont(addToCartConfig?.textFamily, addToCartConfig?.fontFamily, raw?.buttonFontFamily, raw?.fontFamily) || undefined,
    textAlign: atcTextAlign,
  };

  // borderWidth derives from borderLine/borderColor, matching buildButtonStyles()'s
  // rule for the Add to Cart / Buy Now buttons — `quantityConfig.borderWidth` isn't
  // a key the Inspector (or its defaults) ever produces, so reading it directly
  // always fell back to a hardcoded 1 regardless of the merchant's border setting.
  const quantityBorderColor = toString(quantityConfig?.borderColor, "#E5E7EB");
  const quantityContainerStyle = {
    ...buildPadding(quantityConfig),
    backgroundColor: toString(quantityConfig?.bgColor, "#FFFFFF"),
    borderColor: quantityBorderColor,
    borderWidth: quantityConfig?.borderLine || quantityBorderColor ? 1 : 0,
    borderRadius: toNumber(quantityConfig?.borderRadius, 6),
  };

  const quantityTextStyle = {
    color: toString(quantityConfig?.textColor, "#111827"),
    fontSize: toNumber(quantityConfig?.textSize, 12),
    fontWeight: toString(quantityConfig?.textWeight, "700"),
    fontFamily: resolveFirstFont(quantityConfig?.textFamily, quantityConfig?.fontFamily, raw?.fontFamily) || undefined,
  };

  const decrement = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increment = () => setQuantity((prev) => prev + 1);

  const minusIconName = resolveIconName(quantityConfig?.minusIcon);
  const plusIconName = resolveIconName(quantityConfig?.plusIcon);
  const addToCartIconRaw = firstDefined(
    addToCartConfig?.icon?.value,
    addToCartConfig?.icon,
    addToCartConfig?.iconName,
    addToCartConfig?.iconId,
    addToCartConfig?.cartIcon,
    addToCartConfig?.buttonIcon,
    raw?.buttonIcon,
    raw?.buttonIconName,
    raw?.iconName,
    raw?.iconId,
    raw?.icon,
    raw?.addToCartIcon,
    raw?.atcIcon
  );
  const addToCartIconName = resolveIconName(addToCartIconRaw);
  const showAddToCartIcon = toBoolean(showAddToCartIconSetting, !!addToCartIconRaw);
  const addToCartIconAlign = toString(addToCartConfig?.iconAlign ?? addToCartConfig?.align, "left").toLowerCase();
  const addToCartIconOnRight = addToCartIconAlign === "right" || addToCartIconAlign === "end";
  const addToCartIcon = showAddToCartIcon && !!addToCartIconName ? (
    <FontAwesome
      name={addToCartIconName}
      size={toNumber(addToCartConfig?.iconSize, 14)}
      color={toString(addToCartConfig?.iconColor, addToCartTextStyle.color)}
      style={addToCartIconOnRight ? { marginLeft: 6 } : { marginRight: 6 }}
    />
  ) : null;

  // ── Buy Now button — fully configured/saved by the Builder (buyNow.* + the
  // buyNow/buyNowText/buyNowIcon/buyNowBgPadding visibility flags) but never
  // rendered here until now.
  const buyNowButtonStyle = buildButtonStyles(buyNowConfig, "#FFFFFF");
  const buyNowTextAlign = resolveTextAlign(buyNowConfig, raw);
  const buyNowTextStyle = {
    color: toString(buyNowConfig?.textColor, "#FFFFFF"),
    fontSize: toNumber(buyNowConfig?.textSize, 12),
    fontWeight: toString(buyNowConfig?.textWeight, "700"),
    fontFamily: resolveFirstFont(buyNowConfig?.textFamily, buyNowConfig?.fontFamily) || undefined,
    textAlign: buyNowTextAlign,
  };
  const buyNowIconRaw = firstDefined(
    buyNowConfig?.icon?.value,
    buyNowConfig?.icon,
    buyNowConfig?.iconName,
    buyNowConfig?.iconId
  );
  const buyNowIconName = resolveIconName(buyNowIconRaw);
  const showBuyNowIconSetting = deepUnwrap(visibility?.buyNowIcon);
  const showBuyNowIcon = toBoolean(showBuyNowIconSetting, !!buyNowIconRaw);
  const buyNowIconAlign = toString(buyNowConfig?.iconAlign ?? buyNowConfig?.align, "right").toLowerCase();
  const buyNowIconOnRight = buyNowIconAlign === "right" || buyNowIconAlign === "end";
  const buyNowIcon = showBuyNowIcon && !!buyNowIconName ? (
    <FontAwesome
      name={buyNowIconName}
      size={toNumber(buyNowConfig?.iconSize, 14)}
      color={toString(buyNowConfig?.iconColor, buyNowTextStyle.color)}
      style={buyNowIconOnRight ? { marginLeft: 6 } : { marginRight: 6 }}
    />
  ) : null;

  const openCartScreen = () => {
    navigation.navigate("BottomNavScreen", resolveCartNavigationParams(section));
  };

  const canAddLocally =
    productTitle || productHandle || productVariantGid || productVariantNumericId;

  const handleAddToCart = async () => {
    if (!productAvailable) return;
    if (!addToCartUrl && !productVariantGid && !canAddLocally) return;

    dispatch(
      addItem({
        item: {
          id: productVariantGid || productVariantNumericId || productHandle || productTitle,
          variantId: productVariantGid || "",
          handle: productHandle,
          title: productTitle,
          image: productImage,
          price: productPrice,
          compareAtPrice: productCompareAtPrice,
          vendor: productVendor,
          variant: productVariantText,
          currency: productCurrency,
          availableForSale: productAvailable,
          quantity,
        },
      })
    );

    showToast({
      message: ADD_TO_CART_SUCCESS_MESSAGE,
      actionLabel: "View Cart",
      onAction: openCartScreen,
      type: "success",
      duration: 2500,
    });
  };

  // Buy Now skips the local cart and goes straight to checkout for just this
  // variant/quantity. This used to navigate straight to a raw, unchecked
  // cart permalink (addToCartUrl) — if the product had since been deleted
  // or unpublished (the DSL's embedded availableForSale can go stale), the
  // user landed on Shopify's own dead-end "Cart Error" page with no way to
  // recover. Routes through createShopifyCheckout instead, which
  // re-validates availability right before checkout and uses
  // draftOrderCreate (falling back to the same permalink) instead.
  const handleBuyNow = async () => {
    if (!productAvailable || buyNowLoading) return;
    if (!productVariantGid && !addToCartUrl) return;
    setBuyNowLoading(true);
    try {
      const checkoutUrl = await createShopifyCheckout({
        variantId: productVariantGid || productVariantNumericId,
        quantity,
        options: { handle: productHandle },
      });
      navigation.navigate("CheckoutWebView", { url: checkoutUrl });
    } catch (error) {
      console.warn("[AddToCart] Buy Now failed:", error?.message || error);
      if (addToCartUrl && !error?.unavailableItems) {
        navigation.navigate("CheckoutWebView", { url: addToCartUrl });
      } else {
        showToast({
          message: error?.message || "This item is no longer available.",
          actionLabel: "Dismiss",
          type: "error",
          duration: 4000,
        });
      }
    } finally {
      setBuyNowLoading(false);
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

  // "Quantity" label — DSL may use a `label` sub-object or top-level label* fields
  const quantityLabelSub    = deepUnwrap(quantityConfig?.label) || {};
  const quantityLabelColor  = toString(
    quantityLabelSub?.textColor  ?? quantityConfig?.labelTextColor  ?? raw?.quantityLabelColor,
    "#111827"
  );
  const quantityLabelSize   = toNumber(
    quantityLabelSub?.textSize   ?? quantityConfig?.labelTextSize   ?? raw?.quantityLabelSize,
    14
  );
  const quantityLabelWeight = toString(
    quantityLabelSub?.textWeight ?? quantityConfig?.labelTextWeight ?? raw?.quantityLabelWeight,
    "500"
  );

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
      {(showAddToCart || !productAvailable) && (
        <TouchableOpacity
          style={[styles.fullButton, addToCartButtonStyle]}
          onPress={handleAddToCart}
          disabled={!productAvailable || (!addToCartUrl && !productVariantGid && !canAddLocally)}
          activeOpacity={productAvailable ? 0.8 : 1}
        >
          {productAvailable && !addToCartIconOnRight && addToCartIcon}
          {(showAddToCartText || !productAvailable) && (
            <Text style={addToCartTextStyle}>{productAvailable ? addToCartText : unavailableText}</Text>
          )}
          {productAvailable && addToCartIconOnRight && addToCartIcon}
        </TouchableOpacity>
      )}

      {/* ── Buy Now button (full-width) ── */}
      {showBuyNow && productAvailable && (
        <TouchableOpacity
          style={[styles.fullButton, styles.buyNowButton, buyNowButtonStyle, buyNowLoading && styles.buttonDisabled]}
          onPress={handleBuyNow}
          disabled={(!addToCartUrl && !productVariantGid) || buyNowLoading}
          activeOpacity={0.8}
        >
          {!buyNowIconOnRight && buyNowIcon}
          {showBuyNowText && <Text style={buyNowTextStyle}>{buyNowLoading ? "Please wait…" : "Buy Now"}</Text>}
          {buyNowIconOnRight && buyNowIcon}
        </TouchableOpacity>
      )}
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
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  buyNowButton: {
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

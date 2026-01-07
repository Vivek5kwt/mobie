import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

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

const buildButtonStyles = (config) => {
  const borderColor = toString(config?.borderColor, "");
  const borderWidth = config?.borderLine || borderColor ? 1 : 0;

  return {
    ...buildPadding(config),
    backgroundColor: toString(config?.bgColor, "#ffffff"),
    borderRadius: toNumber(config?.borderRadius, 6),
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

export default function AddToCart({ section }) {
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const presentation = unwrapValue(propsNode?.presentation, {});
  const css = unwrapValue(presentation?.css, {});

  const addToCartConfig = raw?.addToCart || css?.addToCart || {};
  const buyNowConfig = raw?.buyNow || css?.buyNow || {};
  const quantityConfig = raw?.quantityPicker || css?.quantityPicker || {};
  const visibility = raw?.visibility || css?.visibility || {};

  const showAddToCart = toBoolean(visibility?.addToCart, true);
  const showAddToCartIcon = toBoolean(visibility?.addToCartIcon, false);
  const showAddToCartText = toBoolean(visibility?.addToCartText, true);
  const showBuyNow = toBoolean(visibility?.buyNow, true);
  const showBuyNowIcon = toBoolean(visibility?.buyNowIcon, false);
  const showBuyNowText = toBoolean(visibility?.buyNowText, true);
  const showQuantityPicker = toBoolean(visibility?.quantityPicker, true);
  const showQuantityText = toBoolean(visibility?.quantityPickerText, true);
  const showQuantityIcons = toBoolean(visibility?.quantityPickerIcons, true);

  const addToCartText = toString(raw?.buttonText, "ADD TO CART");
  const buyNowText = toString(raw?.buyNowText, "BUY NOW");

  const [quantity, setQuantity] = useState(1);

  const addToCartButtonStyle = useMemo(() => buildButtonStyles(addToCartConfig), [addToCartConfig]);
  const buyNowButtonStyle = useMemo(() => buildButtonStyles(buyNowConfig), [buyNowConfig]);

  const addToCartTextStyle = {
    color: toString(addToCartConfig?.textColor, "#111827"),
    fontSize: toNumber(addToCartConfig?.textSize, 12),
    fontWeight: toString(addToCartConfig?.textWeight, "700"),
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

  return (
    <View style={styles.container}>
      {showAddToCart && (
        <TouchableOpacity style={[styles.button, addToCartButtonStyle]}>
          {showAddToCartIcon && !!addToCartIconName && (
            <FontAwesome
              name={addToCartIconName}
              size={toNumber(addToCartConfig?.iconSize, 14)}
              color={toString(addToCartConfig?.iconColor, addToCartTextStyle.color)}
            />
          )}
          {showAddToCartText && <Text style={addToCartTextStyle}>{addToCartText}</Text>}
        </TouchableOpacity>
      )}

      {showQuantityPicker && (
        <View style={[styles.quantityContainer, quantityContainerStyle]}>
          {showQuantityIcons && (
            <TouchableOpacity onPress={decrement} style={styles.quantityButton}>
              {minusIconName ? (
                <FontAwesome
                  name={minusIconName}
                  size={toNumber(quantityConfig?.minusIconSize, 14)}
                  color={toString(quantityConfig?.minusIconColor, quantityTextStyle.color)}
                />
              ) : (
                <Text style={quantityTextStyle}>-</Text>
              )}
            </TouchableOpacity>
          )}
          {showQuantityText && <Text style={[styles.quantityText, quantityTextStyle]}>{quantity}</Text>}
          {showQuantityIcons && (
            <TouchableOpacity onPress={increment} style={styles.quantityButton}>
              {plusIconName ? (
                <FontAwesome
                  name={plusIconName}
                  size={toNumber(quantityConfig?.plusIconSize, 14)}
                  color={toString(quantityConfig?.plusIconColor, quantityTextStyle.color)}
                />
              ) : (
                <Text style={quantityTextStyle}>+</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {showBuyNow && (
        <TouchableOpacity style={[styles.button, buyNowButtonStyle]}>
          {showBuyNowIcon && !!buyNowIconName && (
            <FontAwesome
              name={buyNowIconName}
              size={toNumber(buyNowConfig?.iconSize, 14)}
              color={toString(buyNowConfig?.iconColor, buyNowTextStyle.color)}
            />
          )}
          {showBuyNowText && <Text style={buyNowTextStyle}>{buyNowText}</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 6,
    gap: 8,
  },
  quantityButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quantityText: {
    minWidth: 16,
    textAlign: "center",
  },
});

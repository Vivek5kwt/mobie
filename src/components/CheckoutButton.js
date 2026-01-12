import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  createShopifyCartCheckout,
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

export default function CheckoutButton({ section }) {
  const navigation = useNavigation();
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});
  const cartItems = useSelector((state) => state?.cart?.items || []);

  const label = toString(raw?.label, "Checkout");
  const height = toNumber(raw?.height, 56);
  const fontSize = toNumber(raw?.fontSize, 16);
  const textColor = toString(raw?.textColor, "#0F766E");
  const fontWeight = toString(raw?.fontWeight, "500");
  const borderColor = toString(raw?.borderColor, "#0FB9B1");
  const borderRadius = toNumber(raw?.borderRadius, 12);
  const backgroundColor = toString(raw?.backgroundColor, "#CFF1F4");
  const shopifyDomain = toString(raw?.shopifyDomain, getShopifyDomain());
  const shopifyToken = toString(raw?.storefrontToken, getShopifyToken());

  const checkoutLines = useMemo(
    () =>
      cartItems.map((item) => ({
        id: item?.id,
        variantId: item?.variantId,
        quantity: item?.quantity,
      })),
    [cartItems]
  );

  const openCheckoutUrl = async (url, title = "Checkout") => {
    if (!url) return false;
    if (navigation?.navigate) {
      navigation.navigate("CheckoutWebView", { url, title });
      return true;
    }
    console.log("Checkout webview navigation not available.");
    return false;
  };

  const handleCheckout = async () => {
    if (!checkoutLines.length) return;
    try {
      const checkoutUrl = await createShopifyCartCheckout({
        items: checkoutLines,
        options: { shop: shopifyDomain, token: shopifyToken },
      });
      await openCheckoutUrl(checkoutUrl, "Checkout");
    } catch (error) {
      console.log("Unable to open Shopify checkout:", error);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          {
            height,
            borderColor,
            borderRadius,
            backgroundColor,
          },
        ]}
        activeOpacity={0.8}
        onPress={handleCheckout}
        disabled={!checkoutLines.length}
      >
        <Text style={[styles.label, { fontSize, color: textColor, fontWeight }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    width: "100%",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    letterSpacing: 0.2,
  },
});

import React, { useMemo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { updateQuantity } from "../store/slices/cartSlice";

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

export default function CartLineItems({ section }) {
  const dispatch = useDispatch();
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = unwrapValue(propsNode?.raw, {});

  const paddingTop = toNumber(raw?.pt, 12);
  const paddingBottom = toNumber(raw?.pb, 12);
  const paddingLeft = toNumber(raw?.pl, 16);
  const paddingRight = toNumber(raw?.pr, 16);
  const backgroundColor = toString(raw?.bgColor, "#FFFFFF");
  const cardBgColor = toString(raw?.cardBgColor, "#F9FAFB");
  const borderRadius = toNumber(raw?.borderRadius, 12);
  const currencySymbol = toString(raw?.currency, "₹");
  const showTotal = Boolean(unwrapValue(raw?.showTotal, true));
  const showQuantityControls = Boolean(unwrapValue(raw?.showQuantityControls, true));

  const cartItems = useSelector((state) => state?.cart?.items || []);
  const items = cartItems;

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + toNumber(item?.price, 0) * toNumber(item?.quantity, 1),
        0
      ),
    [items]
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
          backgroundColor,
        },
      ]}
    >
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No products added.</Text>
      ) : (
        items.map((item) => {
          const quantity = toNumber(item?.quantity, 1);
          const price = toNumber(item?.price, 0);
          return (
            <View
              key={String(item?.id || item?.title)}
              style={[
                styles.card,
                {
                  backgroundColor: cardBgColor,
                  borderRadius,
                },
              ]}
            >
              {item?.image ? (
                <Image source={{ uri: item.image }} style={styles.image} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>Image</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>
                  {item?.title}
                </Text>
                {!!item?.variant && <Text style={styles.variant}>{item.variant}</Text>}
                <Text style={styles.price}>
                  {item?.currency || currencySymbol} {price}
                </Text>
                {showQuantityControls && (
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() =>
                        dispatch(updateQuantity({ id: item?.id, quantity: quantity - 1 }))
                      }
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() =>
                        dispatch(updateQuantity({ id: item?.id, quantity: quantity + 1 }))
                      }
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}
      {showTotal && items.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {currencySymbol} {total.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  emptyText: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
  },
  imagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  imagePlaceholderText: {
    fontSize: 10,
    color: "#6B7280",
  },
  info: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  variant: {
    fontSize: 12,
    color: "#6B7280",
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  quantityText: {
    minWidth: 18,
    textAlign: "center",
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
});

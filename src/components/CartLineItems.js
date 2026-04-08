import React, { useMemo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { updateQuantity, removeItem } from "../store/slices/cartSlice";

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
  if (typeof resolved === "number") return resolved !== 0;
  const s = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
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

const fmtPrice = (amount, symbol) =>
  `${symbol}${Math.abs(toNumber(amount, 0)).toFixed(2)}`;

export default function CartLineItems({ section }) {
  const dispatch = useDispatch();
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const appliedDiscounts = useSelector((state) => state?.cart?.discounts || []);

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const raw = unwrapValue(propsNode?.raw, null) || propsNode || {};

  // Container
  const bgColor = toString(raw?.bgColor ?? raw?.backgroundColor, "#FFFFFF");
  const padT = toNumber(raw?.padT ?? raw?.pt, 12);
  const padR = toNumber(raw?.padR ?? raw?.pr, 16);
  const padB = toNumber(raw?.padB ?? raw?.pb, 12);
  const padL = toNumber(raw?.padL ?? raw?.pl, 16);

  // Card
  const cardBgColor = toString(raw?.cardBgColor, "#FFFFFF");
  const cardBorderColor = toString(raw?.cardBorderColor ?? raw?.borderColor, "#F3F4F6");
  const cardBorderRadius = toNumber(raw?.cardBorderRadius ?? raw?.borderRadius, 12);
  const cardBorderWidth = toNumber(raw?.cardBorderWidth ?? raw?.borderSize, 1);
  const cardGap = toNumber(raw?.cardGap ?? raw?.gap, 12);

  // Image
  const imageSize = toNumber(raw?.imageSize ?? raw?.imageWidth, 88);
  const imageRadius = toNumber(raw?.imageRadius ?? raw?.imageCorner, 10);
  const imageBg = toString(raw?.imageBg, "#F3F4F6");

  // Variant row
  const showVariant = toBoolean(raw?.showVariant, true);
  const variantColor = toString(raw?.variantColor, "#0D9488");
  const variantSize = toNumber(raw?.variantSize ?? raw?.variantFontSize, 12);
  const variantSeparator = toString(raw?.variantSeparator, " | ");

  // Vendor
  const showVendor = toBoolean(raw?.showVendor, true);
  const vendorColor = toString(raw?.vendorColor, "#111827");
  const vendorSize = toNumber(raw?.vendorSize, 14);
  const vendorWeight = toFontWeight(raw?.vendorWeight, "600");

  // Title
  const showTitle = toBoolean(raw?.showTitle, true);
  const titleColor = toString(raw?.titleColor, "#111827");
  const titleSize = toNumber(raw?.titleSize, 14);
  const titleWeight = toFontWeight(raw?.titleWeight, "600");

  // Price
  const showPrice = toBoolean(raw?.showPrice, true);
  const priceColor = toString(raw?.priceColor, "#111827");
  const priceSize = toNumber(raw?.priceSize, 14);
  const priceWeight = toFontWeight(raw?.priceWeight, "700");
  const currencySymbol = toString(raw?.currencySymbol ?? raw?.currency, "₹");

  // Compare-at (original) price
  const showCompareAt = toBoolean(raw?.showCompareAt ?? raw?.showOriginalPrice, true);
  const compareAtColor = toString(raw?.compareAtColor ?? raw?.strikeColor, "#9CA3AF");
  const compareAtSize = toNumber(raw?.compareAtSize, 13);

  // Savings badge
  const showSavings = toBoolean(raw?.showSavings, true);
  const savingsLabel = toString(raw?.savingsLabel, "Savings");
  const savingsBg = toString(raw?.savingsBg, "#FFFFFF");
  const savingsColor = toString(raw?.savingsColor, "#16A34A");
  const savingsBorderColor = toString(raw?.savingsBorderColor, "#16A34A");
  const savingsBorderRadius = toNumber(raw?.savingsBorderRadius, 20);
  const savingsFontSize = toNumber(raw?.savingsFontSize, 12);
  const savingsFontWeight = toFontWeight(raw?.savingsFontWeight, "600");

  // Discounts applied badge
  const showDiscountBadge = toBoolean(raw?.showDiscountBadge, true);
  const discountBadgeBg = toString(raw?.discountBadgeBg, "#DBEAFE");
  const discountBadgeColor = toString(raw?.discountBadgeColor, "#1D4ED8");
  const discountBadgeRadius = toNumber(raw?.discountBadgeRadius, 20);
  const discountBadgeFontSize = toNumber(raw?.discountBadgeFontSize, 11);
  const discountBadgeFontWeight = toFontWeight(raw?.discountBadgeFontWeight, "700");
  const discountBadgeSuffix = toString(raw?.discountBadgeSuffix, "DISCOUNTS APPLIED");

  // Quantity controls
  const showQuantityControls = toBoolean(raw?.showQuantityControls, true);
  const qtyBorderColor = toString(raw?.qtyBorderColor, "#E5E7EB");
  const qtyBtnSize = toNumber(raw?.qtyBtnSize, 32);
  const qtyBtnRadius = toNumber(raw?.qtyBtnRadius, 8);
  const qtyTextColor = toString(raw?.qtyTextColor, "#111827");
  const qtyTextSize = toNumber(raw?.qtyTextSize, 14);
  const qtyIconSize = toNumber(raw?.qtyIconSize, 12);
  const qtyIconColor = toString(raw?.qtyIconColor, "#111827");

  // Delete button
  const showDelete = toBoolean(raw?.showDelete ?? raw?.showDeleteButton, true);
  const deleteIconColor = toString(raw?.deleteIconColor, "#9CA3AF");
  const deleteIconSize = toNumber(raw?.deleteIconSize, 16);

  // Divider between items
  const showDivider = toBoolean(raw?.showDivider, false);
  const dividerColor = toString(raw?.dividerColor, "#F3F4F6");

  const discountCount = appliedDiscounts.length;

  // Total (shown if DSL enables it)
  const showTotal = toBoolean(raw?.showTotal, false);
  const totalLabel = toString(raw?.totalLabel, "Total");
  const totalColor = toString(raw?.totalLabelColor, "#111827");
  const totalValueColor = toString(raw?.totalValueColor, "#111827");

  const total = useMemo(
    () => cartItems.reduce((sum, item) => sum + toNumber(item?.price, 0) * toNumber(item?.quantity, 1), 0),
    [cartItems]
  );

  if (cartItems.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: bgColor, paddingHorizontal: padL }]}>
        <Text style={styles.emptyText}>Your cart is empty</Text>
      </View>
    );
  }

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
          gap: cardGap,
        },
      ]}
    >
      {cartItems.map((item, index) => {
        const quantity = toNumber(item?.quantity, 1);
        const price = toNumber(item?.price, 0);
        const compareAt = toNumber(item?.compareAtPrice, 0);
        const savings = compareAt > price ? (compareAt - price) * quantity : 0;

        // Parse variant string into parts for "Size: M | Color: Blue" display
        const variantText = String(item?.variant || "").trim();
        const variantParts = variantText
          ? variantText.split("/").map((v) => v.trim()).filter(Boolean)
          : [];

        return (
          <View key={String(item?.id || index)}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBgColor,
                  borderRadius: cardBorderRadius,
                  borderWidth: cardBorderWidth,
                  borderColor: cardBorderColor,
                },
              ]}
            >
              {/* Image */}
              <View
                style={[
                  styles.imageWrap,
                  {
                    width: imageSize,
                    height: imageSize,
                    borderRadius: imageRadius,
                    backgroundColor: imageBg,
                  },
                ]}
              >
                {item?.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={[styles.image, { borderRadius: imageRadius }]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.imagePlaceholder, { backgroundColor: imageBg }]} />
                )}
              </View>

              {/* Right content */}
              <View style={styles.info}>

                {/* Variant row: Size: M | Color: Blue */}
                {showVariant && variantParts.length > 0 && (
                  <Text
                    style={[styles.variant, { color: variantColor, fontSize: variantSize }]}
                    numberOfLines={1}
                  >
                    {variantParts.join(variantSeparator)}
                  </Text>
                )}

                {/* Vendor */}
                {showVendor && !!item?.vendor && (
                  <Text
                    style={[styles.vendor, { color: vendorColor, fontSize: vendorSize, fontWeight: vendorWeight }]}
                    numberOfLines={1}
                  >
                    {item.vendor}
                  </Text>
                )}

                {/* Title */}
                {showTitle && !!item?.title && (
                  <Text
                    style={[styles.title, { color: titleColor, fontSize: titleSize, fontWeight: titleWeight }]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                )}

                {/* Price row */}
                {showPrice && (
                  <View style={styles.priceRow}>
                    <Text style={[styles.price, { color: priceColor, fontSize: priceSize, fontWeight: priceWeight }]}>
                      {fmtPrice(price, currencySymbol)}
                    </Text>
                    {showCompareAt && compareAt > 0 && (
                      <Text style={[styles.compareAt, { color: compareAtColor, fontSize: compareAtSize }]}>
                        {fmtPrice(compareAt, currencySymbol)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Savings badge */}
                {showSavings && (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: savingsBg,
                        borderColor: savingsBorderColor,
                        borderRadius: savingsBorderRadius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        { color: savingsColor, fontSize: savingsFontSize, fontWeight: savingsFontWeight },
                      ]}
                    >
                      {savingsLabel} : {fmtPrice(savings, currencySymbol)}
                    </Text>
                  </View>
                )}

                {/* Discounts applied badge */}
                {showDiscountBadge && discountCount > 0 && (
                  <View
                    style={[
                      styles.discountBadge,
                      {
                        backgroundColor: discountBadgeBg,
                        borderRadius: discountBadgeRadius,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: discountBadgeColor,
                          fontSize: discountBadgeFontSize,
                          fontWeight: discountBadgeFontWeight,
                        },
                      ]}
                    >
                      {discountCount} {discountBadgeSuffix}
                    </Text>
                  </View>
                )}

                {/* Quantity + Delete row */}
                {showQuantityControls && (
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyControls}>
                      {/* Minus */}
                      <TouchableOpacity
                        style={[
                          styles.qtyBtn,
                          {
                            width: qtyBtnSize,
                            height: qtyBtnSize,
                            borderRadius: qtyBtnRadius,
                            borderColor: qtyBorderColor,
                          },
                        ]}
                        onPress={() =>
                          dispatch(updateQuantity({ id: item?.id, quantity: quantity - 1 }))
                        }
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <FontAwesome name="minus" size={qtyIconSize} color={qtyIconColor} />
                      </TouchableOpacity>

                      {/* Count */}
                      <Text style={[styles.qtyText, { color: qtyTextColor, fontSize: qtyTextSize }]}>
                        {quantity}
                      </Text>

                      {/* Plus */}
                      <TouchableOpacity
                        style={[
                          styles.qtyBtn,
                          {
                            width: qtyBtnSize,
                            height: qtyBtnSize,
                            borderRadius: qtyBtnRadius,
                            borderColor: qtyBorderColor,
                          },
                        ]}
                        onPress={() =>
                          dispatch(updateQuantity({ id: item?.id, quantity: quantity + 1 }))
                        }
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <FontAwesome name="plus" size={qtyIconSize} color={qtyIconColor} />
                      </TouchableOpacity>
                    </View>

                    {/* Delete */}
                    {showDelete && (
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => dispatch(removeItem({ id: item?.id }))}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesome name="trash-o" size={deleteIconSize} color={deleteIconColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {showDivider && index < cartItems.length - 1 && (
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            )}
          </View>
        );
      })}

      {/* Cart total */}
      {showTotal && cartItems.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: totalColor }]}>{totalLabel}</Text>
          <Text style={[styles.totalValue, { color: totalValueColor }]}>
            {fmtPrice(total, currencySymbol)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#6B7280",
    fontSize: 14,
  },
  card: {
    flexDirection: "row",
    padding: 12,
    gap: 12,
    overflow: "hidden",
  },
  imageWrap: {
    overflow: "hidden",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 5,
  },
  variant: {
    lineHeight: 16,
  },
  vendor: {
    lineHeight: 18,
  },
  title: {
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {},
  compareAt: {
    textDecorationLine: "line-through",
  },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    letterSpacing: 0.2,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    minWidth: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  deleteBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
  },
});

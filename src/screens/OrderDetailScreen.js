import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { clearCart } from "../store/slices/cartSlice";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useAuth } from "../services/AuthContext";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";

// ─── DSL helpers ─────────────────────────────────────────────────────────────

const unwrap = (v, fb) => {
  if (v === undefined || v === null) return fb;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
  }
  return v !== undefined ? v : fb;
};

const toNum = (v, fb = 0) => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === null || r === "") return fb;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fb : p;
};

const toStr = (v, fb = "") => {
  const r = unwrap(v, fb);
  if (r === null || r === undefined) return fb;
  const s = String(r).trim();
  return s && s !== "undefined" && s !== "null" ? s : fb;
};

// Returns a border style object only when DSL explicitly provides a borderColor
const dslBorder = (propsNode, defaultWidth = 1) => {
  const color = toStr(
    propsNode?.borderColor ?? propsNode?.cardBorderColor ?? propsNode?.strokeColor,
    ""
  );
  if (!color) return {};
  const width = toNum(propsNode?.borderWidth ?? propsNode?.strokeWidth, defaultWidth);
  return { borderWidth: width, borderColor: color };
};

const getComponent = (section) => {
  const c =
    section?.component?.const ||
    section?.properties?.component?.const ||
    section?.component ||
    "";
  return String(c).trim().toLowerCase().replace(/[\s-]+/g, "_");
};

const getProps = (section) =>
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  section?.props ||
  {};

const fmt = (n, symbol = "$") =>
  `${symbol}${Math.abs(toNum(n, 0)).toFixed(2)}`;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { session } = useAuth();
  const { order } = route.params || {};
  const appId = resolveAppId();
  const userId = session?.user?.id ?? null;

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const versionRef = useRef(null);
  const fpRef = useRef(null);

  // Clear cart when order is confirmed
  useEffect(() => {
    dispatch(clearCart());
  }, [dispatch]);

  const getSectionsFp = (dsl) =>
    (dsl?.sections || []).map(getComponent).filter(Boolean).join(",");

  const loadDsl = useCallback(async () => {
    try {
      const dslData = await fetchDSL(appId, "order-details");
      const dsl = dslData?.dsl;
      if (dsl?.sections?.length) {
        setSections(dsl.sections);
        versionRef.current = dslData.versionNumber ?? null;
        fpRef.current = getSectionsFp(dsl);
      }
    } catch (_) {
      // keep existing sections on error
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    loadDsl();
  }, [loadDsl]);

  // 3-second auto-refresh
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, "order-details");
        if (!latest?.dsl) return;
        const incomingVersion = latest.versionNumber ?? null;
        const incomingFp = getSectionsFp(latest.dsl);
        const versionChanged =
          incomingVersion !== null && incomingVersion !== versionRef.current;
        const contentChanged = incomingFp !== fpRef.current;
        if (versionChanged || contentChanged) {
          setSections(latest.dsl.sections || []);
          versionRef.current = incomingVersion;
          fpRef.current = incomingFp;
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(id);
  }, [appId]);

  const findSection = (name) =>
    sections.find((s) => getComponent(s) === name);

  const orderInfoSection = findSection("order_info");
  const priceInfoSection = findSection("price_info");
  const cancelOrderSection = findSection("cancel_order");
  const itemsSection = findSection("order_detail_page");

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Confirmation header */}
            <View style={styles.confirmHeader}>
              <View style={styles.confirmIcon}>
                <FontAwesome name="check" size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.confirmTitle}>Order Confirmed!</Text>
              {order?.orderNumber ? (
                <Text style={styles.confirmSubtitle}>Order {order.orderNumber}</Text>
              ) : null}
            </View>

            {/* Items at the top — matching the design */}
            {order?.lineItems?.length > 0 && (
              <OrderItemsSection section={itemsSection} items={order.lineItems} />
            )}

            {/* Order info card */}
            <OrderInfoSection section={orderInfoSection} order={order} />

            {/* Price breakdown */}
            <PriceInfoSection section={priceInfoSection} order={order} />

            {/* Cancel button */}
            {cancelOrderSection && (
              <CancelOrderSection
                section={cancelOrderSection}
                navigation={navigation}
                order={order}
                appId={appId}
                userId={userId}
              />
            )}

            {/* Continue shopping */}
            <TouchableOpacity
              style={styles.continueBtn}
              activeOpacity={0.85}
              onPress={() =>
                navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] })
              }
            >
              <FontAwesome name="shopping-bag" size={15} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.continueBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </SafeArea>
  );
}

// ─── Order Info Section ───────────────────────────────────────────────────────

function OrderInfoSection({ section, order }) {
  const propsNode = section ? getProps(section) : {};
  const dslInfo = unwrap(propsNode?.orderInfo, {}) || {};

  // ── Card styling — only from DSL, no hardcoded defaults ──────────────────
  const cardBg     = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const cardRadius = toNum(propsNode?.borderRadius ?? propsNode?.radius ?? propsNode?.cornerRadius, 12);
  const rowDividerColor = toStr(propsNode?.dividerColor ?? propsNode?.rowBorderColor, "#F3F4F6");
  const labelColor = toStr(propsNode?.labelColor ?? propsNode?.subtitleColor, "#6B7280");
  const valueColor = toStr(propsNode?.valueColor ?? propsNode?.textColor, "#111827");
  const labelSize  = toNum(propsNode?.labelFontSize ?? propsNode?.fontSize, 13);
  const valueSize  = toNum(propsNode?.valueFontSize ?? propsNode?.fontSize, 13);

  const info = {
    orderDate:      order?.orderDate      || toStr(dslInfo.orderDate,      ""),
    orderNumber:    order?.orderNumber    || toStr(dslInfo.orderNumber,     ""),
    status:         order?.status         || toStr(dslInfo.status,          ""),
    deliveryMethod: order?.deliveryMethod || toStr(dslInfo.deliveryMethod,  ""),
    address:        order?.address        || toStr(dslInfo.address,         ""),
    arrival:        order?.arrival        || toStr(dslInfo.arrival,         ""),
    billing:        order?.billing        || toStr(dslInfo.billing,         ""),
    payment:        order?.payment        || toStr(dslInfo.payment,         ""),
  };

  const rows = [
    { label: "Order date",       value: info.orderDate },
    { label: "Order number",     value: info.orderNumber },
    { label: "Status",           value: info.status },
    { label: "Delivery method",  value: info.deliveryMethod },
    { label: "Delivery address", value: info.address },
    { label: "Estimated arrival",value: info.arrival },
    { label: "Billing details",  value: info.billing },
    { label: "Payment method",   value: info.payment },
  ].filter((r) => r.value);

  if (!rows.length) return null;

  const border = dslBorder(propsNode);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderRadius: cardRadius }, border]}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.infoRow,
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: rowDividerColor },
          ]}
        >
          <Text style={[styles.infoLabel, { color: labelColor, fontSize: labelSize }]}>{row.label}</Text>
          <Text style={[styles.infoValue, { color: valueColor, fontSize: valueSize }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Price Info Section ───────────────────────────────────────────────────────

function PriceInfoSection({ section, order }) {
  const propsNode = section ? getProps(section) : {};

  // ── Card styling — only from DSL ─────────────────────────────────────────
  const cardBg       = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const cardRadius   = toNum(propsNode?.borderRadius ?? propsNode?.radius, 12);
  const dividerColor = toStr(propsNode?.dividerColor ?? propsNode?.rowBorderColor, "#F3F4F6");
  const labelColor   = toStr(propsNode?.labelColor, "#374151");
  const valueColor   = toStr(propsNode?.valueColor ?? propsNode?.textColor, "#111827");
  const totalColor   = toStr(propsNode?.totalColor ?? propsNode?.boldColor, "#111827");
  const rowFontSize  = toNum(propsNode?.fontSize, 14);
  const totalSize    = toNum(propsNode?.totalFontSize ?? propsNode?.boldFontSize, 15);
  const currSymbol   = toStr(propsNode?.currencySymbol ?? propsNode?.currency, "$");

  const delivery = order?.delivery !== undefined ? order.delivery : toNum(propsNode?.delivery, 0);
  const tax      = order?.tax      !== undefined ? order.tax      : toNum(propsNode?.tax,      0);
  const total    = order?.total    !== undefined ? order.total    : toNum(propsNode?.total,    0);

  const rows = [
    { label: "Delivery", value: fmt(delivery, currSymbol), bold: false },
    { label: "Tax",      value: fmt(tax,      currSymbol), bold: false },
    { label: "Total",    value: fmt(total,    currSymbol), bold: true  },
  ];

  const border = dslBorder(propsNode);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderRadius: cardRadius }, border]}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.priceRow,
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: dividerColor },
          ]}
        >
          <Text style={[
            styles.priceLabel,
            { color: labelColor, fontSize: row.bold ? totalSize : rowFontSize },
            row.bold && { fontWeight: "700", color: totalColor },
          ]}>
            {row.label}
          </Text>
          <Text style={[
            styles.priceValue,
            { color: valueColor, fontSize: row.bold ? totalSize : rowFontSize },
            row.bold && { fontWeight: "700", color: totalColor },
          ]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Cancel Order Section ─────────────────────────────────────────────────────

function CancelOrderSection({ section, navigation, order, appId, userId }) {
  const propsNode = getProps(section);
  const raw = unwrap(propsNode?.raw, {}) || {};

  const label = toStr(raw.label, "Cancel order");
  const textStyle = raw.textStyle || {};
  const bg = raw.backgroundPadding || {};

  const textColor   = toStr(textStyle.color,      "#FFFFFF");
  const fontSize    = Math.min(toNum(textStyle.fontSize, 14), 18);
  const fontWeight  = toStr(textStyle.fontWeight, "600");
  const bgColor     = toStr(bg.backgroundColor,  "#0D9488");
  const borderColor = toStr(bg.borderColor,       "");          // no border unless DSL provides one
  const borderRadius = Math.max(toNum(bg.borderRadius, 2) * 4, 8);

  const handleCancel = () => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: () => {
            // Notify backend → backend pushes FCM cancellation notification
            triggerOrderNotification({
              type: ORDER_EVENTS.ORDER_CANCELED,
              orderNumber: order?.orderNumber || '',
              orderId: order?.id ? String(order.id) : null,
              appId,
              userId,
            }).catch(() => {});

            navigation.goBack();
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.cancelContainer}>
      <TouchableOpacity
        style={[
          styles.cancelButton,
          {
            backgroundColor: bgColor,
            borderRadius,
            ...(borderColor ? { borderColor, borderWidth: 1 } : { borderWidth: 0 }),
          },
        ]}
        onPress={handleCancel}
        activeOpacity={0.85}
      >
        <Text style={{ color: textColor, fontSize, fontWeight }}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Order Items Section ──────────────────────────────────────────────────────

function OrderItemsSection({ section, items }) {
  const propsNode = section ? getProps(section) : {};

  const bgColor     = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const borderColor = toStr(propsNode?.borderColor ?? propsNode?.strokeColor, "");  // no border unless DSL provides
  const radius      = toNum(propsNode?.radius ?? propsNode?.borderRadius ?? propsNode?.cornerRadius, 14);
  const titleColor = toStr(propsNode?.titleColor, "#000000");
  const priceColor = toStr(propsNode?.priceColor, "#000000");
  const titleFontSize = Math.min(toNum(propsNode?.titleFontSize, 14), 18);
  const priceFontSize = Math.min(toNum(propsNode?.priceFontSize, 13), 16);
  const titleFontWeight = toStr(propsNode?.titleFontWeight, "600");
  const priceFontWeight = toStr(propsNode?.priceFontWeight, "500");
  const padTop = toNum(propsNode?.paddingTop, 12);
  const padLeft = toNum(propsNode?.paddingLeft, 12);
  const padRight = toNum(propsNode?.paddingRight, 12);
  const padBottom = toNum(propsNode?.paddingBottom, 12);

  return (
    <View style={styles.itemsContainer}>
      {items.map((item, i) => (
        <View
          key={item.id || i}
          style={[
            styles.itemCard,
            {
              backgroundColor: bgColor,
              borderRadius: radius,
              paddingTop: padTop,
              paddingLeft: padLeft,
              paddingRight: padRight,
              paddingBottom: padBottom,
              ...(borderColor ? { borderWidth: 1, borderColor } : { borderWidth: 0 }),
            },
          ]}
        >
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <Text style={styles.itemImagePlaceholderText}>No image</Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text
              style={[
                styles.itemTitle,
                { color: titleColor, fontSize: titleFontSize, fontWeight: titleFontWeight },
              ]}
              numberOfLines={3}
            >
              {item.title}
            </Text>
            {item.variant ? (
              <Text style={styles.itemMeta}>Variant: {item.variant}</Text>
            ) : null}
            {item.deliveryDate ? (
              <Text style={styles.itemMeta}>Delivery Date: {item.deliveryDate}</Text>
            ) : null}
            {item.price ? (
              <Text
                style={[
                  styles.itemPrice,
                  { color: priceColor, fontSize: priceFontSize, fontWeight: priceFontWeight },
                ]}
              >
                Price: {item.price}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },

  // ── Confirmation header
  confirmHeader: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#0D9488",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  confirmSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },

  // ── Continue Shopping button
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D9488",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  continueBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Card shared
  card: {
    overflow: "hidden",
  },

  // ── Order Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontWeight: "400",
  },
  infoValue: {
    fontWeight: "500",
    textAlign: "right",
    flex: 1.4,
  },

  // ── Price Info
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "400",
  },
  priceValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "400",
  },
  priceBold: {
    fontWeight: "700",
  },

  // ── Cancel Button
  cancelContainer: {
    paddingVertical: 4,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },

  // ── Order Items
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    overflow: "hidden",
    gap: 12,
  },
  itemImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    flexShrink: 0,
  },
  itemImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemImagePlaceholderText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  itemTitle: {
    lineHeight: 20,
  },
  itemMeta: {
    fontSize: 12,
    color: "#6B7280",
  },
  itemPrice: {
    marginTop: 4,
  },
});

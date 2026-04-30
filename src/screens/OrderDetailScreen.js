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
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useAuth } from "../services/AuthContext";
import { fetchCustomerOrders } from "../services/shopify";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";

// ─── DSL helpers ──────────────────────────────────────────────────────────────

const unwrap = (v, fb) => {
  if (v === undefined || v === null) return fb;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
    if (v.properties !== undefined) return v.properties;
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

const dslBorder = (propsNode, defaultWidth = 1) => {
  const color = toStr(propsNode?.borderColor ?? propsNode?.strokeColor, "");
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
  const { session } = useAuth();

  // Order may be passed via route params (from checkout flow or orders list)
  const routeOrder = route?.params?.order ?? null;
  const appId = resolveAppId();

  const [sections,        setSections]        = useState([]);
  const [dslLoading,      setDslLoading]      = useState(true);
  const [order,           setOrder]           = useState(routeOrder);
  const [fetchingOrders,  setFetchingOrders]  = useState(!routeOrder);
  const [noOrders,        setNoOrders]        = useState(false);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight,  setBottomNavHeight]  = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const versionRef = useRef(null);

  // ── Load DSL ──────────────────────────────────────────────────────────────
  const loadDsl = useCallback(async () => {
    try {
      const dslData = await fetchDSL(appId, "order-details");
      if (dslData?.dsl?.sections?.length) {
        setSections(dslData.dsl.sections);
        versionRef.current = dslData.versionNumber ?? null;
      }
    } catch (_) {}
    finally { setDslLoading(false); }
  }, [appId]);

  useEffect(() => { loadDsl(); }, [loadDsl]);

  // 3-second DSL auto-refresh
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, "order-details");
        if (!latest?.dsl?.sections?.length) return;
        const v = latest.versionNumber ?? null;
        if (v !== versionRef.current) {
          setSections(latest.dsl.sections);
          versionRef.current = v;
        }
      } catch (_) {}
    }, 3000);
    return () => clearInterval(id);
  }, [appId]);

  // ── Fetch orders from Shopify if no order was passed ─────────────────────
  useEffect(() => {
    if (routeOrder) return;           // already have data — skip Shopify fetch
    const token =
      session?.user?.customerAccessToken ||
      session?.user?.userToken ||
      session?.customerAccessToken ||
      session?.accessToken ||
      session?.token ||
      null;

    if (!token) {
      setFetchingOrders(false);
      setNoOrders(true);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { orders } = await fetchCustomerOrders({ customerAccessToken: token, first: 1 });
        if (!mounted) return;
        if (orders.length > 0) {
          setOrder(orders[0]);
          setNoOrders(false);
        } else {
          setNoOrders(true);
        }
      } catch (_) {
        if (mounted) setNoOrders(true);
      } finally {
        if (mounted) setFetchingOrders(false);
      }
    })();
    return () => { mounted = false; };
  }, [routeOrder, session]);

  // ── Bottom nav from home DSL ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    fetchDSL(appId, "home").then((data) => {
      if (!mounted) return;
      const nav = (data?.dsl?.sections || []).find((s) => {
        const c = (
          s?.component?.const || s?.component ||
          s?.properties?.component?.const || s?.properties?.component || ""
        ).toLowerCase();
        return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(c);
      });
      if (nav) setBottomNavSection(nav);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [appId]);

  const findSection = (name) => sections.find((s) => getComponent(s) === name);

  const orderInfoSection   = findSection("order_info");
  const priceInfoSection   = findSection("price_info");
  const cancelOrderSection = findSection("cancel_order");
  const itemsSection       = findSection("order_detail_page");

  const isLoading = dslLoading || fetchingOrders;

  return (
    <SafeArea>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate("LayoutScreen")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome name="angle-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={styles.backBtn} />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
        ) : noOrders || !order ? (
          /* ── Empty state ──────────────────────────────────────────────── */
          <View style={styles.emptyState}>
            <FontAwesome name="shopping-bag" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Orders Placed</Text>
            <Text style={styles.emptySubtitle}>
              You haven't placed any orders yet.{"\n"}Start shopping to see your orders here.
            </Text>
            <TouchableOpacity
              style={styles.shopNowBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate("LayoutScreen")}
            >
              <Text style={styles.shopNowText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Order detail content ─────────────────────────────────────── */
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 32 },
            ]}
            showsVerticalScrollIndicator={false}
          >
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
                userId={session?.user?.id ?? null}
              />
            )}

            {/* Order items */}
            {order?.lineItems?.length > 0 && (
              <OrderItemsSection section={itemsSection} items={order.lineItems} />
            )}
          </ScrollView>
        )}

        {/* Bottom Navigation */}
        {bottomNavSection && (
          <View
            style={styles.bottomNav}
            onLayout={(e) => setBottomNavHeight(e.nativeEvent.layout.height)}
          >
            <BottomNavigation section={bottomNavSection} />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

// ─── Order Info Section ───────────────────────────────────────────────────────

function OrderInfoSection({ section, order }) {
  const propsNode = section ? getProps(section) : {};
  const dslInfo   = unwrap(propsNode?.orderInfo, {}) || {};

  const cardBg          = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const cardRadius      = toNum(propsNode?.borderRadius ?? propsNode?.radius ?? propsNode?.cornerRadius, 12);
  const rowDividerColor = toStr(propsNode?.dividerColor ?? propsNode?.rowBorderColor, "#F3F4F6");
  const labelColor      = toStr(propsNode?.labelColor ?? propsNode?.subtitleColor, "#6B7280");
  const valueColor      = toStr(propsNode?.valueColor ?? propsNode?.textColor, "#111827");
  const labelSize       = toNum(propsNode?.labelFontSize ?? propsNode?.fontSize, 13);
  const valueSize       = toNum(propsNode?.valueFontSize ?? propsNode?.fontSize, 13);

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
    { label: "Order date",        value: info.orderDate },
    { label: "Order number",      value: info.orderNumber },
    { label: "Status",            value: info.status },
    { label: "Delivery method",   value: info.deliveryMethod },
    { label: "Delivery address",  value: info.address },
    { label: "Estimated arrival", value: info.arrival },
    { label: "Billing details",   value: info.billing },
    { label: "Payment method",    value: info.payment },
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
          <Text style={[styles.infoLabel, { color: labelColor, fontSize: labelSize }]}>
            {row.label}
          </Text>
          <Text style={[styles.infoValue, { color: valueColor, fontSize: valueSize }]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Price Info Section ───────────────────────────────────────────────────────

function PriceInfoSection({ section, order }) {
  const propsNode = section ? getProps(section) : {};

  const cardBg       = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const cardRadius   = toNum(propsNode?.borderRadius ?? propsNode?.radius, 12);
  const dividerColor = toStr(propsNode?.dividerColor ?? propsNode?.rowBorderColor, "#F3F4F6");
  const labelColor   = toStr(propsNode?.labelColor, "#374151");
  const valueColor   = toStr(propsNode?.valueColor ?? propsNode?.textColor, "#111827");
  const totalColor   = toStr(propsNode?.totalColor ?? propsNode?.boldColor, "#111827");
  const rowFontSize  = toNum(propsNode?.fontSize, 14);
  const totalSize    = toNum(propsNode?.totalFontSize ?? propsNode?.boldFontSize, 15);
  const currSymbol   = toStr(propsNode?.currencySymbol ?? propsNode?.currency, order?.currencySymbol || "$");

  const delivery = order?.delivery !== undefined ? order.delivery : toNum(propsNode?.delivery, 0);
  const tax      = order?.tax      !== undefined ? order.tax      : toNum(propsNode?.tax,      0);
  const total    = order?.total    !== undefined ? order.total    : toNum(propsNode?.total,     0);

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
            { color: row.bold ? totalColor : labelColor, fontSize: row.bold ? totalSize : rowFontSize },
            row.bold && { fontWeight: "700" },
          ]}>
            {row.label}
          </Text>
          <Text style={[
            styles.priceValue,
            { color: row.bold ? totalColor : valueColor, fontSize: row.bold ? totalSize : rowFontSize },
            row.bold && { fontWeight: "700" },
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
  const raw       = unwrap(propsNode?.raw, {}) || {};

  const label      = toStr(raw.label,                    "Cancel order");
  const textStyle  = raw.textStyle || {};
  const bg         = raw.backgroundPadding || {};

  const textColor    = toStr(textStyle.color,       "#FFFFFF");
  const fontSize     = Math.min(toNum(textStyle.fontSize, 14), 18);
  const fontWeight   = toStr(textStyle.fontWeight,  "600");
  const bgColor      = toStr(bg.backgroundColor,   "#0D9488");
  const borderColor  = toStr(bg.borderColor,        "");
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
            triggerOrderNotification({
              type: ORDER_EVENTS.ORDER_CANCELED,
              orderNumber: order?.orderNumber || "",
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

  const bgColor        = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const borderColor    = toStr(propsNode?.borderColor ?? propsNode?.strokeColor, "#EAEAEA");
  const radius         = toNum(propsNode?.radius ?? propsNode?.borderRadius ?? propsNode?.cornerRadius, 14);
  const titleColor     = toStr(propsNode?.titleColor, "#000000");
  const priceColor     = toStr(propsNode?.priceColor, "#000000");
  const titleFontSize  = Math.min(toNum(propsNode?.titleFontSize, 14), 18);
  const priceFontSize  = Math.min(toNum(propsNode?.priceFontSize, 13), 16);
  const titleFontWeight = toStr(propsNode?.titleFontWeight, "600");
  const priceFontWeight = toStr(propsNode?.priceFontWeight, "500");
  const padTop    = toNum(propsNode?.paddingTop,    12);
  const padLeft   = toNum(propsNode?.paddingLeft,   12);
  const padRight  = toNum(propsNode?.paddingRight,  12);
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
              paddingTop:    padTop,
              paddingLeft:   padLeft,
              paddingRight:  padRight,
              paddingBottom: padBottom,
              borderWidth: 1,
              borderColor,
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
              <FontAwesome name="image" size={28} color="#D1D5DB" />
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemTitle, { color: titleColor, fontSize: titleFontSize, fontWeight: titleFontWeight }]}
              numberOfLines={3}
            >
              {item.title}
            </Text>
            {item.variant ? (
              <Text style={styles.itemMeta}>Variant: {item.variant}</Text>
            ) : null}
            {item.quantity ? (
              <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
            ) : null}
            {item.deliveryDate ? (
              <Text style={styles.itemMeta}>Delivery Date: {item.deliveryDate}</Text>
            ) : null}
            {item.price ? (
              <Text style={[styles.itemPrice, { color: priceColor, fontSize: priceFontSize, fontWeight: priceFontWeight }]}>
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

  // ── Header
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor:   "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width:      36,
    alignItems: "center",
  },
  headerTitle: {
    flex:       1,
    textAlign:  "center",
    fontSize:   17,
    fontWeight: "700",
    color:      "#111827",
  },

  // ── Loading / empty
  center: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  emptyState: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize:   20,
    fontWeight: "700",
    color:      "#111827",
    marginTop:  8,
  },
  emptySubtitle: {
    fontSize:  14,
    color:     "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },
  shopNowBtn: {
    marginTop:       8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius:    12,
    backgroundColor: "#0D9488",
  },
  shopNowText: {
    color:      "#FFFFFF",
    fontSize:   16,
    fontWeight: "700",
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap:     12,
  },

  // ── Card shared
  card: { overflow: "hidden" },

  // ── Order Info
  infoRow: {
    flexDirection:    "row",
    justifyContent:   "space-between",
    alignItems:       "flex-start",
    paddingHorizontal: 16,
    paddingVertical:  12,
    gap: 12,
  },
  infoLabel: {
    flex:       1,
    fontWeight: "400",
    color:      "#6B7280",
  },
  infoValue: {
    fontWeight: "500",
    textAlign:  "right",
    flex:       1.4,
    color:      "#111827",
  },

  // ── Price Info
  priceRow: {
    flexDirection:    "row",
    justifyContent:   "space-between",
    alignItems:       "center",
    paddingHorizontal: 16,
    paddingVertical:  12,
  },
  priceLabel: {
    fontSize:   14,
    color:      "#374151",
    fontWeight: "400",
  },
  priceValue: {
    fontSize:   14,
    color:      "#111827",
    fontWeight: "400",
  },

  // ── Cancel Button
  cancelContainer: { paddingVertical: 4 },
  cancelButton: {
    alignItems:     "center",
    justifyContent: "center",
    paddingVertical: 16,
  },

  // ── Order Items
  itemsContainer: { gap: 12 },
  itemCard: {
    flexDirection: "row",
    overflow:      "hidden",
    gap:           12,
  },
  itemImage: {
    width:           90,
    height:          90,
    borderRadius:    8,
    backgroundColor: "#F3F4F6",
    flexShrink:      0,
  },
  itemImagePlaceholder: {
    alignItems:     "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex:           1,
    justifyContent: "center",
    gap:            4,
  },
  itemTitle:  { lineHeight: 20 },
  itemMeta:   { fontSize: 12, color: "#6B7280" },
  itemPrice:  { marginTop: 4 },

  // ── Bottom nav
  bottomNav: {
    position: "absolute",
    left:     0,
    right:    0,
    bottom:   0,
  },
});

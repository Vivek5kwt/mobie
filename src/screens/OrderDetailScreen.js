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
import { cancelShopifyOrder, fetchCustomerOrders, fetchShopifyOrderDetails } from "../services/shopify";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";
import { saveCompletedOrder } from "../services/orderHistoryService";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { resolveFont } from "../services/typographyService";
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
} from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";

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
const cleanFontFamily = (family) => resolveFont(family) || "";
const toBool = (v, fb = false) => {
  const r = unwrap(v, fb);
  if (typeof r === "boolean") return r;
  if (typeof r === "number") return r !== 0;
  const s = String(r || "").trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return fb;
};
const toFontWeight = (v, fb = "400") => {
  const r = unwrap(v, fb);
  if (typeof r === "number") return String(r);
  const s = String(r || "").trim().toLowerCase();
  if (!s) return fb;
  if (/^\d+$/.test(s)) return s;
  if (s === "bold") return "700";
  if (s === "semibold" || s === "semi bold") return "600";
  if (s === "medium") return "500";
  if (s === "regular" || s === "normal") return "400";
  return fb;
};

const hasOrderValue = (value) =>
  value !== undefined && value !== null && value !== "";

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

const fmt = (n, currency = "") =>
  formatSharedMoney(Math.abs(toNum(n, 0)), currency);

const formatAddressForDisplay = (address) => {
  if (!address || typeof address !== "object") return "";
  if (Array.isArray(address.formatted) && address.formatted.length) {
    return address.formatted.filter(Boolean).join("\n");
  }
  return [
    address.name,
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.country,
    address.zip,
    address.phone,
  ].filter(Boolean).join("\n");
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function OrderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { session } = useAuth();

  // Order may be passed via route params (from checkout flow or orders list)
  const routeOrder =
    route?.params?.order ??
    (route?.params?.orderId ? { id: route.params.orderId, adminOrderId: route.params.orderId } : null);
  const appId = resolveAppId();

  const [sections,        setSections]        = useState([]);
  const [dslLoading,      setDslLoading]      = useState(true);
  const [order,           setOrder]           = useState(routeOrder);
  const [fetchingOrders,  setFetchingOrders]  = useState(!routeOrder);
  const [detailsRefreshing, setDetailsRefreshing] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [noOrders,        setNoOrders]        = useState(false);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight,  setBottomNavHeight]  = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const versionRef = useRef(null);
  const enrichedOrderRef = useRef("");
  const customerAccessToken =
    session?.user?.customerAccessToken ||
    session?.user?.shopifyCustomerAccessToken ||
    session?.user?.customer_access_token ||
    session?.customerAccessToken ||
    session?.shopifyCustomerAccessToken ||
    session?.user?.userToken ||
    session?.accessToken ||
    session?.token ||
    "";

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
    const token = customerAccessToken || null;

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
  }, [customerAccessToken, routeOrder]);

  useEffect(() => {
    if (!order) return;
    const key = String(
      order.adminOrderId ||
      order.id ||
      order.orderNumber ||
      order.name ||
      order.statusUrl ||
      (order.needsStoreRefresh ? `${order.total || ""}:${order.placedAt || order.orderDate || ""}` : "")
    );
    if (!key || enrichedOrderRef.current === key) return;

    let mounted = true;
    enrichedOrderRef.current = key;
    setDetailsRefreshing(true);
    setDetailsError("");

    (async () => {
      try {
        const latest = await fetchShopifyOrderDetails({ order, customerAccessToken });
        if (!mounted || !latest) return;
        setOrder((current) => ({ ...(current || {}), ...latest }));
      } catch (_) {
        if (mounted) {
          setDetailsError("Some order details could not be refreshed from the store.");
        }
      } finally {
        if (mounted) setDetailsRefreshing(false);
      }
    })();

    return () => { mounted = false; };
  }, [customerAccessToken, order]);

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
  const emptyStateSection  = orderInfoSection || sections[0] || null;
  const emptyProps         = emptyStateSection ? getProps(emptyStateSection) : {};
  const emptyTitleText     = toStr(emptyProps?.emptyTitle ?? emptyProps?.noOrderTitle, "No orders yet");
  const emptySubtitleText  = toStr(
    emptyProps?.emptySubtitle ?? emptyProps?.noOrderSubtitle,
    "When you place an order it will\nappear here."
  );
  const emptyIconColor     = toStr(emptyProps?.emptyIconColor, "#4A90E2");
  const emptyTagColor      = toStr(emptyProps?.emptyTagColor, "#F59E0B");

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
          <View
            style={[
              styles.emptyState,
              { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 32 },
            ]}
          >
            {/* Shopping bag icon matching the screenshot */}
            <View style={styles.emptyIconWrap}>
              <FontAwesome name="shopping-bag" size={52} color={emptyIconColor} />
              <View style={[styles.emptyTagDot, { backgroundColor: emptyTagColor }]} />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitleText}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtitleText}</Text>
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
            {(detailsRefreshing || detailsError) && (
              <View style={[
                styles.detailNotice,
                detailsError ? styles.detailNoticeError : null,
              ]}>
                {detailsRefreshing ? (
                  <ActivityIndicator size="small" color="#0EA5E9" />
                ) : null}
                <Text style={[
                  styles.detailNoticeText,
                  detailsError ? styles.detailNoticeErrorText : null,
                ]}>
                  {detailsError || "Refreshing latest order details..."}
                </Text>
              </View>
            )}

            {/* Order info card */}
            <OrderInfoSection section={orderInfoSection} order={order} />

            {/* Price breakdown */}
            <PriceInfoSection section={priceInfoSection} order={order} />

            {/* Cancel button */}
            {cancelOrderSection && (
              <CancelOrderSection
                section={cancelOrderSection}
                order={order}
                appId={appId}
                userId={session?.user?.id ?? null}
                email={session?.user?.email || ""}
                customerAccessToken={customerAccessToken}
                onCanceled={(updatedOrder) => {
                  setOrder((current) => ({ ...(current || {}), ...(updatedOrder || {}) }));
                  setDetailsError("");
                }}
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

  const cardBg          = toStr(propsNode?.bgColor ?? propsNode?.backgroundColor ?? propsNode?.cardBg, "#FFFFFF");
  const cardRadius      = toNum(propsNode?.borderRadius ?? propsNode?.radius ?? propsNode?.cornerRadius, 12);
  const rowDividerColor = toStr(propsNode?.dividerColor ?? propsNode?.rowBorderColor, "#F3F4F6");
  const labelColor      = toStr(propsNode?.labelColor ?? propsNode?.subtitleColor, "#6B7280");
  const valueColor      = toStr(propsNode?.valueColor ?? propsNode?.textColor, "#111827");
  const labelSize       = toNum(propsNode?.labelFontSize ?? propsNode?.fontSize, 13);
  const valueSize       = toNum(propsNode?.valueFontSize ?? propsNode?.fontSize, 13);
  const labelWeight     = toFontWeight(propsNode?.labelFontWeight, "400");
  const valueWeight     = toFontWeight(propsNode?.valueFontWeight, "500");
  const textFontFamily  = cleanFontFamily(toStr(propsNode?.fontFamily, ""));
  const rowPt           = toNum(propsNode?.rowPaddingTop ?? propsNode?.paddingTop, 12);
  const rowPb           = toNum(propsNode?.rowPaddingBottom ?? propsNode?.paddingBottom, 12);
  const rowPl           = toNum(propsNode?.rowPaddingLeft ?? propsNode?.paddingLeft, 16);
  const rowPr           = toNum(propsNode?.rowPaddingRight ?? propsNode?.paddingRight, 16);

  const info = {
    orderDate:      order?.orderDate || order?.placedOn || order?.processedAt || "",
    orderNumber:    order?.orderNumber || order?.name || "",
    status:         order?.status || "",
    deliveryMethod: order?.deliveryMethod || order?.shippingMethod || "",
    address:        order?.address || formatAddressForDisplay(order?.shippingAddress),
    arrival:        order?.arrival || order?.estimatedDelivery || "",
    billing:        order?.billing || formatAddressForDisplay(order?.billingAddress),
    payment:        order?.payment || order?.paymentMethod || (Array.isArray(order?.paymentGatewayNames) ? order.paymentGatewayNames.join(", ") : ""),
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
            {
              paddingTop: rowPt,
              paddingBottom: rowPb,
              paddingLeft: rowPl,
              paddingRight: rowPr,
            },
            i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: rowDividerColor },
          ]}
        >
          <Text style={[styles.infoLabel, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight, ...(textFontFamily ? { fontFamily: textFontFamily } : {}) }]}>
            {row.label}
          </Text>
          <Text style={[styles.infoValue, { color: valueColor, fontSize: valueSize, fontWeight: valueWeight, ...(textFontFamily ? { fontFamily: textFontFamily } : {}) }]}>
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
  const orderCurrencyCode = toStr(order?.currencyCode ?? order?.priceCurrency, "");
  const orderCurrencySymbol = toStr(order?.currencySymbol, "");
  const normalizedOrderSymbol = orderCurrencySymbol === "$" && orderCurrencyCode
    ? ""
    : orderCurrencySymbol;
  const currSymbol =
    normalizedOrderSymbol ||
    sharedCurrencySymbolForCode(orderCurrencyCode);
  const currLabel = orderCurrencyCode || currSymbol;
  const rowFontFamily = cleanFontFamily(toStr(propsNode?.fontFamily, ""));
  const labelWeight = toFontWeight(propsNode?.labelFontWeight, "400");
  const valueWeight = toFontWeight(propsNode?.valueFontWeight, "400");
  const totalWeight = toFontWeight(propsNode?.totalFontWeight ?? propsNode?.boldFontWeight, "700");
  const showSubtotal = toBool(propsNode?.showSubtotal ?? propsNode?.showSubTotal, true);
  const showDelivery = toBool(propsNode?.showDelivery, true);
  const showTax = toBool(propsNode?.showTax, true);
  const showTotal = toBool(propsNode?.showTotal, true);

  const delivery = hasOrderValue(order?.delivery) ? order.delivery : undefined;
  const tax      = hasOrderValue(order?.tax) ? order.tax : undefined;
  const total    = hasOrderValue(order?.total) ? order.total : undefined;
  const subtotal = hasOrderValue(order?.subtotal) ? order.subtotal : undefined;

  const rows = [
    showSubtotal && hasOrderValue(subtotal) ? { label: toStr(propsNode?.subtotalLabel ?? propsNode?.subTotalLabel, "Subtotal"), value: fmt(subtotal, currLabel), bold: false } : null,
    showDelivery && hasOrderValue(delivery) ? { label: toStr(propsNode?.deliveryLabel, "Delivery"), value: fmt(delivery, currLabel), bold: false } : null,
    showTax && hasOrderValue(tax) ? { label: toStr(propsNode?.taxLabel, "Tax"), value: fmt(tax, currLabel), bold: false } : null,
    showTotal && hasOrderValue(total) ? { label: toStr(propsNode?.totalLabel, "Total"), value: fmt(total, currLabel), bold: true } : null,
  ].filter(Boolean);

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
            { fontWeight: row.bold ? totalWeight : labelWeight },
            rowFontFamily ? { fontFamily: rowFontFamily } : null,
          ]}>
            {row.label}
          </Text>
          <Text style={[
            styles.priceValue,
            { color: row.bold ? totalColor : valueColor, fontSize: row.bold ? totalSize : rowFontSize },
            { fontWeight: row.bold ? totalWeight : valueWeight },
            rowFontFamily ? { fontFamily: rowFontFamily } : null,
          ]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Cancel Order Section ─────────────────────────────────────────────────────

function CancelOrderSection({ section, order, appId, userId, email, customerAccessToken, onCanceled }) {
  const propsNode = getProps(section);
  const raw       = unwrap(propsNode?.raw, {}) || {};
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  const label      = toStr(raw.label,                    "Cancel order");
  const visibility = raw.visibility || {};
  const textStyle  = (toBool(visibility?.textStyle, true) ? raw.textStyle : {}) || {};
  const bg         = (toBool(visibility?.backgroundPadding, true) ? raw.backgroundPadding : {}) || {};
  const boxBg      = (toBool(visibility?.boxBackgroundPadding, true) ? raw.boxBackgroundPadding : {}) || {};

  const textColor    = toStr(textStyle.color,       "#FFFFFF");
  const fontSize     = toNum(textStyle.fontSize ?? raw?.fontSize, 14);
  const fontWeight   = toFontWeight(textStyle.fontWeight ?? raw?.fontWeight, "600");
  const fontFamily   = cleanFontFamily(toStr(raw?.fontFamily, ""));
  const bgColor      = toStr(bg.backgroundColor,   "#0D9488");
  const borderColor  = toStr(bg.borderColor,        "");
  const borderRadius = Math.max(toNum(raw?.buttonRadius ?? bg.borderRadius, 8), 0);
  const outerBgColor = toStr(boxBg.backgroundColor, "transparent");
  const outerRadius = Math.max(toNum(boxBg.borderRadius, 0), 0);
  const outerPt = toNum(boxBg.paddingTop, 0);
  const outerPb = toNum(boxBg.paddingBottom, 0);
  const outerPl = toNum(boxBg.paddingLeft, 0);
  const outerPr = toNum(boxBg.paddingRight, 0);
  const status = String(order?.status || order?.financialStatus || "").trim().toLowerCase();
  const alreadyCanceled = !!order?.cancelledAt || status === "canceled" || status === "cancelled" || status === "voided";
  const canCancel = !alreadyCanceled && order?.cancellable !== false;
  const disabled = submitting || !canCancel;

  const performCancel = async () => {
    setSubmitting(true);
    setErrorText("");
    try {
      const result = await cancelShopifyOrder({
        order,
        reason: toStr(raw.cancelReason, "customer"),
        notifyCustomer: toBool(raw.notifyCustomer, true),
        customerAccessToken,
      });
      const updatedOrder = {
        ...(order || {}),
        ...(result?.order || {}),
        status: result?.order?.status || "Canceled",
        cancellable: false,
      };

      onCanceled?.(updatedOrder);

      saveCompletedOrder({
        appId,
        userId,
        email,
        order: updatedOrder,
      }).catch(() => {});

      triggerOrderNotification({
        type: ORDER_EVENTS.ORDER_CANCELED,
        orderNumber: updatedOrder?.orderNumber || "",
        orderId: updatedOrder?.id ? String(updatedOrder.id) : null,
        appId,
        userId,
      }).catch(() => {});

      Alert.alert(
        result?.alreadyCanceled ? "Order already canceled" : "Order canceled",
        result?.alreadyCanceled
          ? "This order was already canceled in the store."
          : "Your order has been canceled successfully."
      );
    } catch (error) {
      const message =
        error?.message ||
        "Unable to cancel this order right now. Please try again.";
      setErrorText(message);
      Alert.alert("Cancel order failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (disabled) return;
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "Keep Order", style: "cancel" },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: performCancel,
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={[styles.cancelContainer, { backgroundColor: outerBgColor, borderRadius: outerRadius, paddingTop: outerPt, paddingBottom: outerPb, paddingLeft: outerPl, paddingRight: outerPr }]}>
      <TouchableOpacity
        style={[
          styles.cancelButton,
          {
            backgroundColor: disabled ? "#E5E7EB" : bgColor,
            borderRadius,
            ...(borderColor ? { borderColor, borderWidth: 1 } : { borderWidth: 0 }),
          },
        ]}
        onPress={handleCancel}
        disabled={disabled}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Text style={{ color: disabled ? "#6B7280" : textColor, fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}) }}>
            {alreadyCanceled ? "Order canceled" : label}
          </Text>
        )}
      </TouchableOpacity>
      {errorText ? <Text style={styles.cancelErrorText}>{errorText}</Text> : null}
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
  const titleFontSize  = toNum(propsNode?.titleFontSize, 14);
  const priceFontSize  = toNum(propsNode?.priceFontSize, 13);
  const titleFontWeight = toFontWeight(propsNode?.titleFontWeight, "600");
  const priceFontWeight = toFontWeight(propsNode?.priceFontWeight, "500");
  const titleUppercase = toBool(propsNode?.titleUppercase, false);
  const priceAlign = toStr(propsNode?.priceAlign, "left").toLowerCase();
  const titleFontFamily = cleanFontFamily(toStr(propsNode?.titleFontFamily, ""));
  const priceFontFamily = cleanFontFamily(toStr(propsNode?.priceFontFamily ?? propsNode?.titleFontFamily, ""));
  const metaColor = toStr(propsNode?.metaColor, "#6B7280");
  const imageBgColor = toStr(
    propsNode?.imageBg ??
      propsNode?.imageBgColor ??
      propsNode?.imageBackgroundColor ??
      propsNode?.productImageBgColor ??
      propsNode?.productImageBackgroundColor,
    "#FFFFFF"
  );
  const metaFontSize = toNum(propsNode?.metaFontSize, 12);
  const padTop    = toNum(propsNode?.paddingTop,    12);
  const padLeft   = toNum(propsNode?.paddingLeft,   12);
  const padRight  = toNum(propsNode?.paddingRight,  12);
  const padBottom = toNum(propsNode?.paddingBottom, 12);
  const itemPriceText = (item = {}) => {
    const amount = item.priceAmount ?? item.price;
    if (amount === undefined || amount === null || amount === "") return "";
    const currency = item.priceCurrency || item.currencyCode || item.currency || item.currencySymbol;
    return formatSharedMoney(amount, currency);
  };

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
              style={[styles.itemImage, { backgroundColor: imageBgColor }]}
              resizeMode={resolveProductImageResizeMode(
                propsNode?.imageScale,
                propsNode?.scale,
                propsNode?.imageResizeMode
              )}
            />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder, { backgroundColor: imageBgColor }]}>
              <FontAwesome name="image" size={28} color="#D1D5DB" />
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text
              style={[styles.itemTitle, { color: titleColor, fontSize: titleFontSize, fontWeight: titleFontWeight, textTransform: titleUppercase ? "uppercase" : "none", ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}) }]}
              numberOfLines={3}
            >
              {item.title}
            </Text>
            {item.variant ? (
              <Text style={[styles.itemMeta, { color: metaColor, fontSize: metaFontSize }]}>Variant: {item.variant}</Text>
            ) : null}
            {item.quantity ? (
              <Text style={[styles.itemMeta, { color: metaColor, fontSize: metaFontSize }]}>Qty: {item.quantity}</Text>
            ) : null}
            {item.deliveryDate ? (
              <Text style={[styles.itemMeta, { color: metaColor, fontSize: metaFontSize }]}>Delivery Date: {item.deliveryDate}</Text>
            ) : null}
            {itemPriceText(item) ? (
              <Text style={[styles.itemPrice, { color: priceColor, fontSize: priceFontSize, fontWeight: priceFontWeight, textAlign: priceAlign, ...(priceFontFamily ? { fontFamily: priceFontFamily } : {}) }]}>
                Price: {itemPriceText(item)}
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
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 40,
    gap:               10,
    backgroundColor:   "#F8F8F8",
  },
  emptyIconWrap: {
    width:           90,
    height:          90,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    8,
  },
  emptyTagDot: {
    position:        "absolute",
    top:             12,
    right:           12,
    width:           16,
    height:          16,
    borderRadius:    8,
    backgroundColor: "#F59E0B",
    borderWidth:     2,
    borderColor:     "#FFFFFF",
  },
  emptyTitle: {
    fontSize:   18,
    fontWeight: "700",
    color:      "#111827",
    marginTop:  4,
    textAlign:  "center",
  },
  emptySubtitle: {
    fontSize:   13,
    color:      "#9CA3AF",
    textAlign:  "center",
    lineHeight: 20,
  },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap:     12,
  },

  // ── Card shared
  detailNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
  },
  detailNoticeError: {
    backgroundColor: "#FEF2F2",
  },
  detailNoticeText: {
    flex: 1,
    color: "#1D4ED8",
    fontSize: 12,
    lineHeight: 17,
  },
  detailNoticeErrorText: {
    color: "#B91C1C",
  },

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
  cancelErrorText: {
    marginTop: 8,
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

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
    backgroundColor: "#FFFFFF",
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

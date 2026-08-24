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
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import HeaderDefault from "../components/HeaderDefault";
import { useAuth } from "../services/AuthContext";
import { cancelShopifyOrder, fetchCustomerOrders, fetchShopifyOrderDetails } from "../services/shopify";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";
import { saveCompletedOrder } from "../services/orderHistoryService";
import { addItem } from "../store/slices/cartSlice";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { resolveFont } from "../services/typographyService";
import {
  currencySymbolForCode as sharedCurrencySymbolForCode,
  formatMoney as formatSharedMoney,
  parseMoneyAmount,
} from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";

const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

const getDslFingerprint = (incomingDsl) => {
  try {
    return JSON.stringify({
      headerdefault: incomingDsl?.headerdefault ?? null,
      brandKit: incomingDsl?.brandKit ?? null,
      sections: incomingDsl?.sections || [],
    });
  } catch (_) {
    return (incomingDsl?.sections || []).map((section) => section?.component?.const || section?.component || "").join(",");
  }
};

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

const firstValue = (...values) => {
  for (const value of values) {
    const resolved = unwrap(value, undefined);
    if (hasOrderValue(resolved)) return resolved;
  }
  return undefined;
};

const humanizeKey = (key = "") =>
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const dslBorder = (propsNode, defaultWidth = 1) => {
  const borderLine = toStr(
    propsNode?.borderLine ?? propsNode?.borderAlign ?? propsNode?.borderStyle,
    ""
  ).toLowerCase();
  if (["none", "no", "off", "0", "false"].includes(borderLine)) return {};

  const color = toStr(propsNode?.borderColor ?? propsNode?.strokeColor, "");
  if (!color) return {};
  const explicitWidth = firstValue(
    propsNode?.borderWidth,
    propsNode?.strokeWidth,
    propsNode?.borderSize
  );
  const width = toNum(explicitWidth, defaultWidth);
  if (width <= 0) return {};
  return { borderWidth: width, borderColor: color };
};

// Mirrors Builder's OrderInfoPreview.tsx/PriceInfoPreview.tsx border-side
// logic for the new unified "order_details" block (see below) — its
// background/padding shape differs from the legacy blocks' `dslBorder`.
const borderSideStyleFromLine = (line, color, width) => {
  const w = Math.max(0, toNum(width, 0));
  const normalized = String(line || "").trim().toLowerCase();
  if (!normalized || normalized === "none" || w <= 0) return {};
  if (normalized === "all" || normalized === "center") return { borderWidth: w, borderColor: color };
  return {
    borderTopWidth: normalized === "top" ? w : 0,
    borderBottomWidth: normalized === "bottom" ? w : 0,
    borderLeftWidth: normalized === "left" ? w : 0,
    borderRightWidth: normalized === "right" ? w : 0,
    borderColor: color,
  };
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

const getRawProps = (section) => {
  const props = getProps(section);
  const raw = unwrap(props?.raw, {});
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...props, ...raw };
  }
  return props || {};
};

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

// order.id falls back to the completed checkout URL (buildOrderFromCart in
// CheckoutWebViewScreen.js) when no real order number could be detected yet
// — never a value fit to show a shopper as "their order number", so it's
// excluded here even though the other candidates are genuinely usable IDs.
const getOrderDisplayName = (order = {}) => {
  const candidates = [order?.orderNumber, order?.name, order?.adminOrderId, order?.id];
  return candidates
    .map((value) => toStr(value, ""))
    .find((value) => value && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) || "";
};

const fillOrderCopy = (template, order = {}, fallback = "") => {
  const orderNumber = getOrderDisplayName(order);
  const status = toStr(order?.status || order?.financialStatus, "");
  return toStr(template, fallback)
    .replace(/\{order_number\}/gi, orderNumber)
    .replace(/\{orderNumber\}/gi, orderNumber)
    .replace(/\{order\}/gi, orderNumber)
    .replace(/\{status\}/gi, status);
};

const resolveLocalCancelBlockReason = (order = {}) => {
  if (order?.cancellationBlockReason) return toStr(order.cancellationBlockReason, "");
  const status = String(order?.status || order?.financialStatus || "").trim().toLowerCase();
  if (order?.cancelledAt || status === "canceled" || status === "cancelled") {
    return getOrderDisplayName(order)
      ? `Order ${getOrderDisplayName(order)} is already canceled.`
      : "This order is already canceled.";
  }
  if (status === "voided" || status === "refunded") {
    return getOrderDisplayName(order)
      ? `Order ${getOrderDisplayName(order)} cannot be canceled because its payment status is ${status}.`
      : `This order cannot be canceled because its payment status is ${status}.`;
  }
  return "";
};

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
  const [headerConfig,    setHeaderConfig]    = useState(null);
  const [brandKit,        setBrandKit]        = useState(null);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight,  setBottomNavHeight]  = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const versionRef = useRef(null);
  const dslFingerprintRef = useRef(null);
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
  // The real Shopify customer GID (captured at login/registration, see
  // authService.ts) — fetchCustomerOrders/findAdminOrderWithCustomerFallback
  // need this for the Admin API's customer(id:) lookup; customerAccessToken
  // was never a usable Shopify Storefront token (this app has no reliable
  // Storefront Access Token — see the PROXY_ENDPOINT comment in
  // services/shopify.js).
  const shopifyCustomerId =
    session?.user?.shopifyCustomerId ||
    session?.shopifyCustomerId ||
    "";
  const customerEmail = session?.user?.email || "";

  // ── Load DSL ──────────────────────────────────────────────────────────────
  const loadDsl = useCallback(async () => {
    try {
      const dslData = await fetchDSL(appId, "order-details");
      if (dslData?.dsl) {
        setSections(Array.isArray(dslData.dsl.sections) ? dslData.dsl.sections : []);
        setHeaderConfig(dslData.dsl.headerdefault ?? null);
        setBrandKit(dslData.dsl.brandKit ?? null);
        versionRef.current = dslData.versionNumber ?? null;
        dslFingerprintRef.current = getDslFingerprint(dslData.dsl);
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
        if (!latest?.dsl) return;
        const v = latest.versionNumber ?? null;
        const fp = getDslFingerprint(latest.dsl);
        if (v !== versionRef.current || fp !== dslFingerprintRef.current) {
          setSections(Array.isArray(latest.dsl.sections) ? latest.dsl.sections : []);
          setHeaderConfig(latest.dsl.headerdefault ?? null);
          setBrandKit(latest.dsl.brandKit ?? null);
          versionRef.current = v;
          dslFingerprintRef.current = fp;
        }
      } catch (_) {}
    }, LIVE_DSL_REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [appId]);

  // ── Fetch orders from Shopify if no order was passed ─────────────────────
  useEffect(() => {
    if (routeOrder) return;           // already have data — skip Shopify fetch

    if (!shopifyCustomerId && !customerEmail) {
      setFetchingOrders(false);
      setNoOrders(true);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const { orders } = await fetchCustomerOrders({ customerId: shopifyCustomerId, email: customerEmail, first: 1 });
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
  }, [shopifyCustomerId, customerEmail, routeOrder]);

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
        const latest = await fetchShopifyOrderDetails({ order, customerId: shopifyCustomerId, customerAccessToken });
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
  }, [customerAccessToken, shopifyCustomerId, order]);

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
  const itemsSection       = findSection("order_detail_page");
  const emptyStateSection  = orderInfoSection || sections[0] || null;
  const pageProps          = getRawProps(itemsSection || sections[0]);
  // Whole-page background is Brand Kit's "Page Background" (colors.pageBg)
  // — same source LayoutScreen.js already uses for the Home/main screen —
  // not any individual block's own bgColor. Each of the 4 order-detail
  // blocks (Order Details/Order Info/Price Info/Cancel Order) has its own,
  // independent card background; reading the page-level color from
  // whichever one happened to be `itemsSection || sections[0]` picked an
  // arbitrary block's card color as the whole screen's background instead
  // of the page-level Brand Kit setting.
  const pageBackground     = toStr(brandKit?.colors?.pageBg, "#FFFFFF");
  const pagePt             = toNum(pageProps?.pt ?? pageProps?.paddingTop, 16);
  // No page-level left/right padding — Builder's canvas has none either
  // (preview/PreviewLive.tsx's screenScroll wrapper is unpadded; every block
  // manages its own horizontal spacing via its own card padding, which is
  // already applied per-block above). This used to default to 16px and was
  // borrowed from whichever block happened to be `itemsSection ||
  // sections[0]`'s own card-padding field (pl/paddingLeft) — a block's own
  // padding, not a real page-level setting — so every block rendered
  // narrower than it does in Builder/centerLive/the Publish page preview.
  const pagePl             = 0;
  const pagePr             = 0;
  const pagePb             = toNum(pageProps?.pb ?? pageProps?.paddingBottom, 16);
  const pageGap            = toNum(pageProps?.sectionGap ?? pageProps?.componentGap ?? pageProps?.gap, 0);
  const emptyProps         = emptyStateSection ? getRawProps(emptyStateSection) : {};
  const emptyTitleText     = toStr(emptyProps?.emptyTitle ?? emptyProps?.noOrderTitle, "You haven't placed any orders yet");
  const emptySubtitleText  = toStr(
    emptyProps?.emptySubtitle ?? emptyProps?.noOrderSubtitle,
    "Start exploring our collection and place your first order!"
  );
  const emptyIconColor     = toStr(emptyProps?.emptyIconColor, "#4A90E2");
  const emptyTagColor      = toStr(emptyProps?.emptyTagColor, "#F59E0B");

  const isLoading = dslLoading || fetchingOrders;
  const renderOrderSection = (section, index) => {
    const component = getComponent(section);
    const key = `${component || "section"}-${section?.id || index}`;

    if (component === "order_detail_page") {
      if (!order?.lineItems?.length) return null;
      return <OrderItemsSection key={key} section={section} items={order.lineItems} order={order} />;
    }

    if (component === "order_info") {
      return <OrderInfoSection key={key} section={section} order={order} />;
    }

    if (component === "price_info") {
      return <PriceInfoSection key={key} section={section} order={order} />;
    }

    if (component === "cancel_order") {
      return (
        <CancelOrderSection
          key={key}
          section={section}
          order={order}
          appId={appId}
          userId={session?.user?.id ?? null}
          email={session?.user?.email || ""}
          customerAccessToken={customerAccessToken}
          customerId={shopifyCustomerId}
          onCanceled={(updatedOrder) => {
            setOrder((current) => ({ ...(current || {}), ...(updatedOrder || {}) }));
            setDetailsError("");
          }}
        />
      );
    }

    // Builder's newer "Order Details" block (Order_details/ folder) bundles
    // product/order/price/cancel into one section instead of 4 separate
    // ones — order_info/order_detail_page/price_info/cancel_order above
    // only ever fire for the older, still-supported separate blocks.
    if (component === "order_details") {
      return (
        <OrderDetailsUnifiedSection
          key={key}
          section={section}
          order={order}
          appId={appId}
          userId={session?.user?.id ?? null}
          email={session?.user?.email || ""}
          customerAccessToken={customerAccessToken}
          customerId={shopifyCustomerId}
          onCanceled={(updatedOrder) => {
            setOrder((current) => ({ ...(current || {}), ...(updatedOrder || {}) }));
            setDetailsError("");
          }}
        />
      );
    }

    return null;
  };

  return (
    <SafeArea edges={["top", "left", "right"]}>
      <View style={[styles.container, { backgroundColor: pageBackground }]}>
        {headerConfig ? (
          <HeaderDefault
            config={headerConfig}
            bottomNavSection={bottomNavSection}
            hideTabs={true}
            showBack={true}
          />
        ) : null}

        {isLoading ? (
          <View style={[styles.center, { backgroundColor: pageBackground }]}>
            <ActivityIndicator size="large" color="#0EA5E9" />
          </View>
        ) : noOrders || !order ? (
          /* ── Empty state ──────────────────────────────────────────────── */
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: pageBackground,
                paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 32,
              },
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
            style={[styles.scroll, { backgroundColor: pageBackground }]}
            contentContainerStyle={[
              styles.scrollContent,
              {
                backgroundColor: pageBackground,
                paddingTop: pagePt,
                paddingLeft: pagePl,
                paddingRight: pagePr,
                paddingBottom: (bottomNavSection ? bottomNavHeight + 16 : 32) + pagePb,
                gap: pageGap,
              },
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

            {sections.map(renderOrderSection)}
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
  const propsNode = section ? getRawProps(section) : {};
  const orderInfo = propsNode?.orderInfo || {};
  const labelStyle = propsNode?.labelStyle || {};
  const valuesStyle = propsNode?.valuesStyle || propsNode?.valueStyle || {};
  const valuesVisibility = valuesStyle?.visibility || propsNode?.visibility || {};

  // Builder's order_info block (Order_details/Preview/OrderInfoPreview.tsx)
  // gates its whole card behind a "backgroundActive" toggle and uses its own
  // distinct field names — orderInfoBgColor (falling back to bgColor),
  // outerCorners (not borderRadius/radius/cornerRadius), and bgPadLL/RR/TT/BB
  // for padding (not read here at all previously) — matching exactly what
  // OrderInfoInspector/BackgroundPaddingPanel.tsx actually writes.
  const backgroundActive = toBool(propsNode?.backgroundActive, true);
  const cardBg          = backgroundActive ? toStr(propsNode?.orderInfoBgColor ?? propsNode?.bgColor, "#FFFFFF") : "transparent";
  const cardRadius      = backgroundActive ? toNum(propsNode?.outerCorners, 0) : 0;
  const cardPadT        = backgroundActive ? toNum(propsNode?.bgPadTT, 0) : 0;
  const cardPadB        = backgroundActive ? toNum(propsNode?.bgPadBB, 0) : 0;
  const cardPadL        = backgroundActive ? toNum(propsNode?.bgPadLL, 16) : 0;
  const cardPadR        = backgroundActive ? toNum(propsNode?.bgPadRR, 16) : 0;
  // Font settings below all now match DEFAULT_ORDER_INFO
  // (Order_details/defaultProps.ts) exactly: labelStyle { fontSize: 12,
  // fontFamily: "Inter", fontWeight: "Medium" (-> 500), color: "#6B7280" },
  // valuesStyle { fontSize: 14, fontFamily: "Inter", fontWeight: "Bold"
  // (-> 700), color: "#000000" }. labelColor already matched; valueColor/
  // labelSize/valueSize/labelWeight/valueWeight/both fontFamilies were all
  // wrong here — same class of bug as PriceInfoSection (fontFamily silently
  // defaulted to "" instead of "Inter", omitting the style and falling back
  // to the OS system font).
  const labelColor      = toStr(labelStyle?.color ?? propsNode?.labelColor ?? propsNode?.labelLabelColor ?? propsNode?.subtitleColor, "#6B7280");
  const valueColor      = toStr(valuesStyle?.color ?? propsNode?.valueColor ?? propsNode?.textColor, "#000000");
  const labelSize       = toNum(labelStyle?.fontSize ?? propsNode?.labelFontSize ?? propsNode?.fontSize, 12);
  const valueSize       = toNum(valuesStyle?.fontSize ?? propsNode?.valueFontSize, 14);
  const labelWeight     = toFontWeight(labelStyle?.fontWeight ?? propsNode?.labelFontWeight, "500");
  const valueWeight     = toFontWeight(valuesStyle?.fontWeight ?? propsNode?.valueFontWeight, "700");
  const labelFontFamily = cleanFontFamily(toStr(labelStyle?.fontFamily ?? propsNode?.labelFontFamily ?? propsNode?.fontFamily, "Inter"));
  const valueFontFamily = cleanFontFamily(toStr(valuesStyle?.fontFamily ?? propsNode?.valueFontFamily ?? propsNode?.fontFamily, "Inter"));
  const labelUppercase  = toBool(labelStyle?.uppercase ?? propsNode?.labelUppercase, false);
  const valueUppercase  = toBool(valuesStyle?.uppercase ?? propsNode?.valueUppercase, false);
  const rowPt           = toNum(propsNode?.rowPaddingTop ?? propsNode?.paddingTop, 12);
  const rowPb           = toNum(propsNode?.rowPaddingBottom ?? propsNode?.paddingBottom, 12);
  const rowPl           = toNum(propsNode?.rowPaddingLeft ?? propsNode?.paddingLeft, 16);
  const rowPr           = toNum(propsNode?.rowPaddingRight ?? propsNode?.paddingRight, 16);

  const info = {
    orderDate:       firstValue(order?.orderDate, order?.placedOn, order?.processedAt, orderInfo?.orderDate, propsNode?.orderDate),
    orderNumber:     firstValue(order?.orderNumber, order?.name, orderInfo?.orderNumber, propsNode?.orderNumber),
    status:          firstValue(order?.status, order?.fulfillmentStatus, order?.financialStatus, orderInfo?.status, propsNode?.status),
    deliveryMethod:  firstValue(order?.deliveryMethod, order?.shippingMethod, orderInfo?.deliveryMethod, propsNode?.deliveryMethod),
    deliveryAddress: firstValue(order?.address, formatAddressForDisplay(order?.shippingAddress), orderInfo?.address, propsNode?.address),
    estimatedArrival:firstValue(order?.arrival, order?.estimatedDelivery, orderInfo?.arrival, propsNode?.arrival),
    billingDetails:  firstValue(order?.billing, formatAddressForDisplay(order?.billingAddress), orderInfo?.billing, propsNode?.billing),
    paymentMethod:   firstValue(
      order?.payment,
      order?.paymentMethod,
      Array.isArray(order?.paymentGatewayNames) ? order.paymentGatewayNames.join(", ") : "",
      orderInfo?.payment,
      propsNode?.payment
    ),
  };

  const labelFor = (key) =>
    toStr(
      firstValue(
        propsNode?.[`${key}Label`],
        propsNode?.labels?.[key],
        orderInfo?.[`${key}Label`]
      ),
      humanizeKey(key)
    );

  const rowDefs = [
    { key: "orderDate", visibleKey: "orderDate" },
    { key: "orderNumber", visibleKey: "orderNumber" },
    { key: "status", visibleKey: "status" },
    { key: "deliveryMethod", visibleKey: "deliveryMethod" },
    { key: "deliveryAddress", visibleKey: "deliveryAddress" },
    { key: "estimatedArrival", visibleKey: "estimatedArrival" },
    { key: "billingDetails", visibleKey: "billingDetail" },
    { key: "paymentMethod", visibleKey: "paymentMethod" },
  ];

  const rows = rowDefs
    .filter((row) => toBool(valuesVisibility?.[row.visibleKey] ?? valuesVisibility?.[row.key], true))
    .map((row) => ({ label: labelFor(row.key), value: info[row.key] }))
    .filter((row) => hasOrderValue(row.value));

  if (!rows.length) return null;

  // borderSideStyleFromLine (not dslBorder) — matches OrderInfoPreview.tsx's
  // own borderStyleFromSide(borderLine, borderColor, borderSize) exactly,
  // including its default borderSize of 2 (dslBorder's default was 1).
  const border = backgroundActive
    ? borderSideStyleFromLine(propsNode?.borderLine ?? "none", toStr(propsNode?.borderColor, ""), toNum(propsNode?.borderSize, 2))
    : {};

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardBg, borderRadius: cardRadius, paddingTop: cardPadT, paddingBottom: cardPadB, paddingLeft: cardPadL, paddingRight: cardPadR },
        border,
      ]}
    >
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
          ]}
        >
          <Text style={[
            styles.infoLabel,
            {
              color: labelColor,
              fontSize: labelSize,
              fontWeight: labelWeight,
              textTransform: labelUppercase ? "uppercase" : "none",
              ...(labelFontFamily ? { fontFamily: labelFontFamily } : {}),
            },
          ]}>
            {row.label}
          </Text>
          <Text style={[
            styles.infoValue,
            {
              color: valueColor,
              fontSize: valueSize,
              fontWeight: valueWeight,
              textTransform: valueUppercase ? "uppercase" : "none",
              ...(valueFontFamily ? { fontFamily: valueFontFamily } : {}),
            },
          ]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Price Info Section ───────────────────────────────────────────────────────

function PriceInfoSection({ section, order }) {
  const propsNode = section ? getRawProps(section) : {};
  const labelStyle = propsNode?.labelStyle || {};
  const numberStyle = propsNode?.numberStyle || propsNode?.valueStyle || {};
  const numberVisibility = numberStyle?.visibility || propsNode?.visibility || {};

  // Builder's price_info block (Order_details/Preview/PriceInfoPreview.tsx)
  // has no visibility toggle for its box (always applied) and uses its own
  // field names — outerCorners (not borderRadius/radius), and bgPadL/R/T/B
  // (not read here at all previously). Also its actual defaults differ from
  // what was hardcoded here: a visible teal border by default (borderLine
  // "all", color "#0EA5A8"), not no border.
  const cardBg       = toStr(propsNode?.bgColor, "#ffffff");
  const cardRadius   = toNum(propsNode?.outerCorners, 0);
  const cardPadT     = toNum(propsNode?.bgPadT, 16);
  const cardPadB     = toNum(propsNode?.bgPadB, 16);
  const cardPadL     = toNum(propsNode?.bgPadL, 16);
  const cardPadR     = toNum(propsNode?.bgPadR, 16);
  // Font settings below all now match DEFAULT_PRICE_INFO
  // (Order_details/defaultProps.ts) exactly: labelStyle { fontSize: 12,
  // fontFamily: "Inter", fontWeight: "Medium" (-> 500), color: "#6B7280" },
  // numberStyle { fontSize: 14, fontFamily: "Inter", fontWeight: "700",
  // color: "#000000" }. Every one of these six defaults was previously
  // wrong here (color/size on both label and number, and fontFamily on both
  // silently defaulted to "" — omitting the style entirely and falling back
  // to the OS system font instead of Inter — and fontWeight defaulted to
  // "400" for both instead of the real 500/700).
  const labelColor   = toStr(labelStyle?.color ?? propsNode?.labelColor, "#6B7280");
  const valueColor   = toStr(numberStyle?.color ?? propsNode?.valueColor ?? propsNode?.textColor, "#000000");
  const rowFontSize  = toNum(labelStyle?.fontSize ?? propsNode?.fontSize, 12);
  const valueFontSize = toNum(numberStyle?.fontSize ?? propsNode?.valueFontSize, 14);
  const orderCurrencyCode = toStr(order?.currencyCode ?? order?.priceCurrency, "");
  const orderCurrencySymbol = toStr(order?.currencySymbol, "");
  const normalizedOrderSymbol = orderCurrencySymbol === "$" && orderCurrencyCode
    ? ""
    : orderCurrencySymbol;
  const currSymbol =
    normalizedOrderSymbol ||
    sharedCurrencySymbolForCode(orderCurrencyCode);
  const currLabel = orderCurrencyCode || currSymbol;
  const labelFontFamily = cleanFontFamily(toStr(labelStyle?.fontFamily ?? propsNode?.labelFontFamily ?? propsNode?.fontFamily, "Inter"));
  const valueFontFamily = cleanFontFamily(toStr(numberStyle?.fontFamily ?? propsNode?.valueFontFamily ?? propsNode?.fontFamily, "Inter"));
  const labelWeight = toFontWeight(labelStyle?.fontWeight ?? propsNode?.labelFontWeight, "500");
  const valueWeight = toFontWeight(numberStyle?.fontWeight ?? propsNode?.valueFontWeight, "700");
  const showDelivery = toBool(numberVisibility?.delivery ?? propsNode?.showDelivery, true);
  const showTax = toBool(numberVisibility?.tax ?? propsNode?.showTax, true);
  const showTotal = toBool(numberVisibility?.total ?? propsNode?.showTotal, true);
  const labelUppercase = toBool(labelStyle?.uppercase ?? propsNode?.labelUppercase, false);
  const valueUppercase = toBool(numberStyle?.uppercase ?? propsNode?.valueUppercase, false);

  // No Subtotal — Builder's PriceInfoPreview.tsx only ever renders three rows
  // (Delivery, Tax, Total); Subtotal was never part of that block's DSL or
  // canvas render, so showing it here was showing text that doesn't exist
  // in the builder.
  const delivery = firstValue(order?.delivery, order?.shippingPrice, order?.shippingAmount, propsNode?.delivery);
  const tax      = firstValue(order?.tax, order?.totalTax, propsNode?.tax);
  const total    = firstValue(order?.total, order?.totalPrice, order?.currentTotalPrice, propsNode?.total);
  const labelFor = (key) =>
    toStr(
      firstValue(propsNode?.[`${key}Label`], propsNode?.labels?.[key]),
      humanizeKey(key)
    );

  const rows = [
    showDelivery && hasOrderValue(delivery) ? { label: labelFor("delivery"), value: fmt(delivery, currLabel) } : null,
    showTax && hasOrderValue(tax) ? { label: labelFor("tax"), value: fmt(tax, currLabel) } : null,
    // Total uses the exact same label/value styling as every other row below
    // (labelColor/rowFontSize/labelWeight, valueColor/valueFontSize/
    // valueWeight) — Builder's Total row reuses the identical labelSX/
    // numberSX as Delivery/Tax, no separate bold/color treatment. isTotal is
    // only used for the extra top spacing below (Builder's Total row has its
    // own mt={1}, on top of the row above's own mb={0.75} — flexbox doesn't
    // collapse margins, so the two add together).
    showTotal && hasOrderValue(total) ? { label: labelFor("total"), value: fmt(total, currLabel), isTotal: true } : null,
  ].filter(Boolean);

  // borderSideStyleFromLine (not dslBorder) — matches PriceInfoPreview.tsx's
  // own borderStyleFromSide exactly, including its defaults (a visible "all"
  // border in teal by default, not dslBorder's no-border-unless-configured).
  const border = borderSideStyleFromLine(
    toStr(propsNode?.borderLine, "all"),
    toStr(propsNode?.borderColor, "#0EA5A8"),
    toNum(propsNode?.borderSize, 1)
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: cardBg, borderRadius: cardRadius, paddingTop: cardPadT, paddingBottom: cardPadB, paddingLeft: cardPadL, paddingRight: cardPadR },
        border,
      ]}
    >
      {rows.map((row, i) => (
        <View
          key={i}
          style={[
            styles.priceRow,
            // styles.priceRow's own paddingHorizontal/paddingVertical are
            // zeroed out here rather than changed at the source — that base
            // style is shared with PriceInfoCardUnified below. Builder's Row
            // has no per-row padding at all (the card's own bgPadL/R/T/B,
            // already applied to the card container above, is the only
            // horizontal/vertical inset) — the row-level paddingHorizontal
            // here used to double up with the card's padding, and
            // paddingVertical produced a 24px gap between rows (12+12) where
            // Builder only shows 6px (mb={0.75}, MUI's 8px spacing unit).
            // Total gets an additional marginTop: 8 (mt={1}), matching
            // Builder's Total row exactly — flexbox doesn't collapse
            // adjacent margins, so it adds on top of the row above's own
            // marginBottom.
            { paddingHorizontal: 0, paddingVertical: 0, marginBottom: 6 },
            row.isTotal ? { marginTop: 8 } : null,
          ]}
        >
          <Text style={[
            styles.priceLabel,
            { color: labelColor, fontSize: rowFontSize, fontWeight: labelWeight },
            labelUppercase ? { textTransform: "uppercase" } : null,
            labelFontFamily ? { fontFamily: labelFontFamily } : null,
          ]}>
            {row.label}
          </Text>
          <Text style={[
            styles.priceValue,
            { color: valueColor, fontSize: valueFontSize, fontWeight: valueWeight },
            valueUppercase ? { textTransform: "uppercase" } : null,
            valueFontFamily ? { fontFamily: valueFontFamily } : null,
          ]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Unified Order Details block (Builder's newer Order_details/ folder) ──────
// Bundles what used to be 4 separate blocks (order_info/order_detail_page/
// price_info/cancel_order) into one section with nested productInfo/
// orderInfo/priceInfo/cancelOrder objects. Builder's own
// Order_details/defaultProps.ts ships pure sample text for canvas design
// only ("April 3, 2023", "FlexFit Pro Jacket", order "46578295", etc.) —
// each card below follows the same rule as every section above: DSL only
// drives styling, real `order` data drives content.

function ProductInfoCard({ data, order }) {
  if (!data) return null;
  const item = Array.isArray(order?.lineItems) ? order.lineItems[0] : null;
  if (!item) return null;

  const headingStyle = data.headingStyle || {};
  const variantsStyle = data.variantsStyle || {};
  const imageStyle = data.imageStyle || {};

  const title = toStr(item?.title, "Product");
  const variantText = toStr(item?.variant, "");
  const lineTotal = toNum(item?.priceAmount ?? item?.price, 0) * toNum(item?.quantity, 1);
  const currency = toStr(item?.priceCurrency ?? item?.currency, order?.currencyCode || "");
  const image = toStr(item?.image ?? item?.imageUrl, "");

  const ratio = toStr(imageStyle?.ratio, "auto").toLowerCase();
  const aspectRatio = ratio === "2:3" ? 2 / 3 : ratio === "4:5" ? 4 / 5 : 1;
  const imageWidth = 72;
  const imageHeight = Math.round(imageWidth / aspectRatio);
  const scaleFill = toStr(imageStyle?.scale, "fill").toLowerCase() === "fill";

  const border = dslBorder(data) || {};
  const cardRadius = toNum(data?.borderRadius, 8);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: "#FFFFFF",
          borderRadius: cardRadius,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 16,
        },
        Object.keys(border).length ? border : { borderWidth: 1, borderColor: toStr(data?.borderColor, "#E5E7EB") },
      ]}
    >
      <View
        style={{
          width: imageWidth,
          height: imageHeight,
          borderRadius: toNum(imageStyle?.corners, 8),
          overflow: "hidden",
          backgroundColor: "#EAFBFC",
          flexShrink: 0,
        }}
      >
        {!!image && (
          <Image
            source={{ uri: image }}
            style={{ width: "100%", height: "100%" }}
            resizeMode={scaleFill ? "cover" : "contain"}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: toNum(headingStyle?.fontSize, 14),
            fontWeight: toFontWeight(headingStyle?.fontWeight, "700"),
            color: toStr(headingStyle?.color, "#111827"),
            textTransform: toBool(headingStyle?.uppercase, false) ? "uppercase" : "none",
            marginBottom: 4,
            ...(cleanFontFamily(toStr(headingStyle?.fontFamily, "")) ? { fontFamily: cleanFontFamily(toStr(headingStyle?.fontFamily, "")) } : {}),
          }}
        >
          {title}
        </Text>
        {!!variantText && (
          <Text
            numberOfLines={1}
            style={{
              fontSize: toNum(variantsStyle?.fontSize, 13),
              fontWeight: toFontWeight(variantsStyle?.fontWeight, "400"),
              color: toStr(variantsStyle?.color, "#6B7280"),
              textTransform: toBool(variantsStyle?.uppercase, false) ? "uppercase" : "none",
              marginBottom: 6,
              ...(cleanFontFamily(toStr(variantsStyle?.fontFamily, "")) ? { fontFamily: cleanFontFamily(toStr(variantsStyle?.fontFamily, "")) } : {}),
            }}
          >
            {variantText}
          </Text>
        )}
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
          {fmt(lineTotal, currency)}
        </Text>
      </View>
    </View>
  );
}

function OrderInfoCardUnified({ data, order }) {
  if (!data) return null;
  const labelStyle = data.labelStyle || {};
  const valuesStyle = data.valuesStyle || {};
  const visibility = valuesStyle?.visibility || {};

  const backgroundActive = toBool(data?.backgroundActive, true);
  const bgColor = backgroundActive ? toStr(data?.orderInfoBgColor || data?.bgColor, "transparent") : "transparent";
  const border = backgroundActive
    ? borderSideStyleFromLine(data?.borderLine, toStr(data?.borderColor, "#000000"), toNum(data?.borderSize, 2))
    : {};
  const outerCorners = backgroundActive ? toNum(data?.outerCorners, 0) : 0;
  const padL = backgroundActive ? toNum(data?.bgPadLL, 16) : 0;
  const padR = backgroundActive ? toNum(data?.bgPadRR, 16) : 0;
  const padT = backgroundActive ? toNum(data?.bgPadTT, 0) : 0;
  const padB = backgroundActive ? toNum(data?.bgPadBB, 0) : 0;

  const info = {
    orderDate: firstValue(order?.orderDate, order?.placedOn, order?.processedAt),
    orderNumber: firstValue(order?.orderNumber, order?.name),
    status: firstValue(order?.status, order?.fulfillmentStatus, order?.financialStatus),
    deliveryMethod: firstValue(order?.deliveryMethod, order?.shippingMethod),
    deliveryAddress: firstValue(order?.address, formatAddressForDisplay(order?.shippingAddress)),
    estimatedArrival: firstValue(order?.arrival, order?.estimatedDelivery),
    billingDetails: firstValue(order?.billing, formatAddressForDisplay(order?.billingAddress)),
    paymentMethod: firstValue(
      order?.payment,
      order?.paymentMethod,
      Array.isArray(order?.paymentGatewayNames) ? order.paymentGatewayNames.join(", ") : ""
    ),
  };

  const rowDefs = [
    { key: "orderDate", label: "Order date", always: true },
    { key: "orderNumber", label: "Order number", visKey: "orderNumber" },
    { key: "status", label: "Status", visKey: "status" },
    { key: "deliveryMethod", label: "Delivery method", visKey: "deliveryMethod" },
    { key: "deliveryAddress", label: "Delivery address", visKey: "deliveryAddress" },
    { key: "estimatedArrival", label: "Estimated arrival", visKey: "estimatedArrival" },
    { key: "billingDetails", label: "Billing details", visKey: "billingDetail" },
    { key: "paymentMethod", label: "Payment method", visKey: "paymentMethod" },
  ];

  const rows = rowDefs
    .filter((row) => row.always || toBool(visibility?.[row.visKey], true))
    .map((row) => ({ label: row.label, value: info[row.key] }))
    .filter((row) => hasOrderValue(row.value));

  if (!rows.length) return null;

  // Same DEFAULT_ORDER_INFO defaults as OrderInfoSection above (fontSize 12/
  // 14, fontWeight Medium/Bold -> 500/700, color #6B7280/#000000, fontFamily
  // Inter/Inter) — this unified-block variant had the identical mismatches.
  const labelSx = {
    fontSize: toNum(labelStyle?.fontSize, 12),
    fontWeight: toFontWeight(labelStyle?.fontWeight, "500"),
    color: toStr(labelStyle?.color, "#6B7280"),
    textTransform: toBool(labelStyle?.uppercase, false) ? "uppercase" : "none",
    fontFamily: cleanFontFamily(toStr(labelStyle?.fontFamily, "Inter")) || undefined,
  };
  const valueSx = {
    fontWeight: toFontWeight(valuesStyle?.fontWeight, "700"),
    color: toStr(valuesStyle?.color, "#000000"),
    fontSize: toNum(valuesStyle?.fontSize, 14),
    textTransform: toBool(valuesStyle?.uppercase, false) ? "uppercase" : "none",
    fontFamily: cleanFontFamily(toStr(valuesStyle?.fontFamily, "Inter")) || undefined,
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor, borderRadius: outerCorners, paddingLeft: padL, paddingRight: padR, paddingTop: padT, paddingBottom: padB },
        border,
      ]}
    >
      {rows.map((row, i) => (
        <View
          key={i}
          style={styles.infoRow}
        >
          <Text style={[styles.infoLabel, labelSx]}>{row.label}</Text>
          <Text style={[styles.infoValue, valueSx]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function PriceInfoCardUnified({ data, order }) {
  if (!data) return null;
  const labelStyle = data.labelStyle || {};
  const numberStyle = data.numberStyle || {};
  const visibility = numberStyle?.visibility || {};

  const bgColor = toStr(data?.bgColor, "#FFFFFF");
  const border = borderSideStyleFromLine(
    toStr(data?.borderLine, "all"),
    toStr(data?.borderColor, "#E5E7EB"),
    toNum(data?.borderSize, 1)
  );
  const outerCorners = toNum(data?.outerCorners, 0);
  const padL = toNum(data?.bgPadL, 16);
  const padR = toNum(data?.bgPadR, 16);
  const padT = toNum(data?.bgPadT, 16);
  const padB = toNum(data?.bgPadB, 16);

  const orderCurrencyCode = toStr(order?.currencyCode ?? order?.priceCurrency, "");
  const orderCurrencySymbol = toStr(order?.currencySymbol, "");
  const normalizedOrderSymbol = orderCurrencySymbol === "$" && orderCurrencyCode ? "" : orderCurrencySymbol;
  const currLabel = orderCurrencyCode || normalizedOrderSymbol || sharedCurrencySymbolForCode(orderCurrencyCode);

  const delivery = firstValue(order?.delivery, order?.shippingPrice, order?.shippingAmount);
  const tax = firstValue(order?.tax, order?.totalTax);
  const total = firstValue(order?.total, order?.totalPrice, order?.currentTotalPrice);

  const showDelivery = toBool(visibility?.delivery, true) && hasOrderValue(delivery);
  const showTax = toBool(visibility?.tax, true) && hasOrderValue(tax);
  const showTotal = toBool(visibility?.total, true) && hasOrderValue(total);

  if (!showDelivery && !showTax && !showTotal) return null;

  const labelSx = {
    fontSize: toNum(labelStyle?.fontSize, 12),
    fontWeight: toFontWeight(labelStyle?.fontWeight, "400"),
    color: toStr(labelStyle?.color, "#6B7280"),
    textTransform: toBool(labelStyle?.uppercase, false) ? "uppercase" : "none",
    ...(cleanFontFamily(toStr(labelStyle?.fontFamily, "")) ? { fontFamily: cleanFontFamily(toStr(labelStyle?.fontFamily, "")) } : {}),
  };
  const numberSx = {
    fontSize: toNum(numberStyle?.fontSize, 14),
    fontWeight: toFontWeight(numberStyle?.fontWeight, "700"),
    color: toStr(numberStyle?.color, "#111827"),
    ...(cleanFontFamily(toStr(numberStyle?.fontFamily, "")) ? { fontFamily: cleanFontFamily(toStr(numberStyle?.fontFamily, "")) } : {}),
  };

  const rows = [
    showDelivery ? { label: "Delivery", value: fmt(delivery, currLabel) } : null,
    showTax ? { label: "Tax", value: fmt(tax, currLabel) } : null,
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor, borderRadius: outerCorners, paddingLeft: padL, paddingRight: padR, paddingTop: padT, paddingBottom: padB },
        border,
      ]}
    >
      {rows.map((row, i) => (
        <View key={i} style={styles.priceRow}>
          <Text style={[styles.priceLabel, labelSx]}>{row.label}</Text>
          <Text style={[styles.priceValue, numberSx, { textAlign: "right" }]}>{row.value}</Text>
        </View>
      ))}
      {showTotal && (
        <View style={styles.priceRow}>
          <Text style={[styles.priceLabel, labelSx]}>Total</Text>
          <Text style={[styles.priceValue, numberSx, { textAlign: "right" }]}>{fmt(total, currLabel)}</Text>
        </View>
      )}
    </View>
  );
}

function OrderDetailsUnifiedSection({ section, order, appId, userId, email, customerAccessToken, customerId, onCanceled }) {
  const raw = getRawProps(section);
  const productInfo = raw?.productInfo;
  const orderInfo = raw?.orderInfo;
  const priceInfo = raw?.priceInfo;
  const cancelOrder = raw?.cancelOrder;

  return (
    <>
      <ProductInfoCard data={productInfo} order={order} />
      <OrderInfoCardUnified data={orderInfo} order={order} />
      <PriceInfoCardUnified data={priceInfo} order={order} />
      {cancelOrder ? (
        <CancelOrderSection
          rawOverride={cancelOrder}
          order={order}
          appId={appId}
          userId={userId}
          email={email}
          customerAccessToken={customerAccessToken}
          customerId={customerId}
          onCanceled={onCanceled}
        />
      ) : null}
    </>
  );
}

// ─── Cancel Order Section ─────────────────────────────────────────────────────

function CancelOrderSection({ section, order, appId, userId, email, customerAccessToken, customerId, onCanceled, rawOverride }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  // rawOverride: used by OrderDetailsUnifiedSection to reuse this same
  // cancel-eligibility + cancel-action logic for the new unified
  // "order_details" block's nested `cancelOrder` object, which already
  // uses this exact same field shape (label/textStyle/backgroundPadding/
  // boxBackgroundPadding/visibility) — no section/getProps lookup needed.
  const propsNode = rawOverride ? null : getProps(section);
  const raw       = rawOverride || unwrap(propsNode?.raw, {}) || {};
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
  const fontFamily   = cleanFontFamily(toStr(textStyle?.fontFamily ?? raw?.fontFamily, ""));
  // Matches DEFAULT_CANCEL_ORDER (Order_details/defaultProps.ts) exactly —
  // the button ships with a visible 2px teal border on all sides by default
  // (borderAlign: "center" — CancelOrderPreview.tsx's getBorderStyle maps
  // "center"/"all" to a border on every side), not borderColor: "" (no
  // border) and not a fabricated "buttonRadius" field the Inspector never
  // actually writes.
  const bgColor      = toStr(bg.backgroundColor,   "#0D9488");
  const borderAlign  = toStr(bg.borderAlign, "center");
  const borderColor  = toStr(bg.borderColor, "#0EA5A8");
  const borderRadius = Math.max(toNum(bg.borderRadius, 2), 0);
  const disabledBgColor = toStr(raw?.disabledBgColor ?? raw?.disabledBackgroundColor, bgColor);
  const disabledTextColor = toStr(raw?.disabledTextColor ?? raw?.disabledColor, textColor);
  // Outer box — same defaults as boxBackgroundPadding in
  // DEFAULT_CANCEL_ORDER: white background, and (per the same
  // borderAlign:"center" default) a border on every side too — previously
  // not applied here at all.
  const outerBgColor = toStr(boxBg.backgroundColor, "#ffffff");
  const outerBorderAlign = toStr(boxBg.borderAlign, "center");
  const outerBorderColor = toStr(boxBg.borderColor, "#ffffff");
  const outerRadius = Math.max(toNum(boxBg.borderRadius, 0), 0);
  const outerPt = toNum(boxBg.paddingTop, 0);
  const outerPb = toNum(boxBg.paddingBottom, 0);
  const outerPl = toNum(boxBg.paddingLeft, 0);
  const outerPr = toNum(boxBg.paddingRight, 0);
  // Mirrors CancelOrderPreview.tsx's getBorderStyle(borderAlign, borderColor)
  // exactly, including its hardcoded 2px width — "left/right/top/bottom" is
  // one side, "all"/"center" is every side, anything else (incl. "none") is
  // no border. Neither borderAlign's per-side selection nor a border on the
  // outer box existed here before — the app only ever showed a generic 1px
  // border on the button (and never on the box) when a color happened to be
  // configured.
  const cancelBorderStyle = (align, color) => {
    if (!color) return {};
    const v = String(align || "").toLowerCase();
    const w = 2;
    if (v === "left") return { borderLeftWidth: w, borderColor: color };
    if (v === "right") return { borderRightWidth: w, borderColor: color };
    if (v === "top") return { borderTopWidth: w, borderColor: color };
    if (v === "bottom") return { borderBottomWidth: w, borderColor: color };
    if (v === "all" || v === "center") return { borderWidth: w, borderColor: color };
    return {};
  };
  const buttonBorder = cancelBorderStyle(borderAlign, borderColor);
  const outerBorder = cancelBorderStyle(outerBorderAlign, outerBorderColor);
  const status = String(order?.status || order?.financialStatus || "").trim().toLowerCase();
  const orderName = getOrderDisplayName(order);
  const alreadyCanceled = !!order?.cancelledAt || status === "canceled" || status === "cancelled";
  const localBlockReason = resolveLocalCancelBlockReason(order);
  const nonCancellableReason = localBlockReason || (!alreadyCanceled && order?.cancellable === false
    ? (orderName ? `Order ${orderName} cannot be canceled from Shopify right now.` : "This order cannot be canceled from Shopify right now.")
    : "");
  const canCancel = !alreadyCanceled && order?.cancellable !== false && !nonCancellableReason;
  const disabled = submitting || !canCancel;
  const cancelReason = toStr(raw.cancelReason, "customer");
  const confirmTitle = fillOrderCopy(
    raw.confirmTitle ?? raw.cancelConfirmTitle,
    order,
    orderName ? `Cancel ${orderName}` : "Cancel order"
  );
  const confirmMessage = fillOrderCopy(
    raw.confirmMessage ?? raw.cancelConfirmMessage,
    order,
    orderName
      ? `Please confirm that you want to cancel order ${orderName}.`
      : "Please confirm that you want to cancel this order."
  );
  const keepOrderLabel = fillOrderCopy(raw.keepOrderLabel ?? raw.cancelDismissLabel, order, "Keep order");
  const confirmActionLabel = fillOrderCopy(raw.confirmActionLabel ?? raw.cancelActionLabel, order, label);

  const performCancel = async () => {
    setSubmitting(true);
    setErrorText("");
    try {
      const result = await cancelShopifyOrder({
        order,
        reason: cancelReason,
        notifyCustomer: toBool(raw.notifyCustomer, true),
        customerId,
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
        fillOrderCopy(
          result?.alreadyCanceled ? raw.alreadyCanceledTitle : raw.successTitle,
          updatedOrder,
          result?.alreadyCanceled
            ? (getOrderDisplayName(updatedOrder) ? `${getOrderDisplayName(updatedOrder)} already canceled` : "Order already canceled")
            : (getOrderDisplayName(updatedOrder) ? `${getOrderDisplayName(updatedOrder)} canceled` : "Order canceled")
        ),
        fillOrderCopy(
          result?.alreadyCanceled ? raw.alreadyCanceledMessage : raw.successMessage,
          updatedOrder,
          result?.message ||
            (getOrderDisplayName(updatedOrder)
              ? `Order ${getOrderDisplayName(updatedOrder)} has been canceled in Shopify.`
              : "This order has been canceled in Shopify.")
        )
      );
    } catch (error) {
      const message = fillOrderCopy(
        raw.errorMessage ?? raw.failureMessage,
        order,
        error?.userMessage || error?.message || nonCancellableReason ||
          (orderName
            ? `Order ${orderName} could not be canceled.`
            : "This order could not be canceled.")
      );
      setErrorText(message);
      Alert.alert(
        fillOrderCopy(
          raw.errorTitle ?? raw.failureTitle,
          order,
          orderName ? `Could not cancel ${orderName}` : "Could not cancel order"
        ),
        message
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (disabled) return;
    Alert.alert(
      confirmTitle,
      confirmMessage,
      [
        { text: keepOrderLabel, style: "cancel" },
        {
          text: confirmActionLabel,
          style: "destructive",
          onPress: performCancel,
        },
      ],
      { cancelable: true }
    );
  };

  // Once an order is canceled there's nothing left to cancel — swap the
  // button for Reorder (same add-everything-to-cart-and-go-to-Cart action
  // OrderHistory.js's list uses) instead of leaving a dead "Order canceled"
  // button in place.
  const handleReorder = () => {
    const items = Array.isArray(order?.lineItems) ? order.lineItems : [];
    items.forEach((item) => {
      dispatch(
        addItem({
          item: {
            id: item.variantId || item.id || item.handle || item.title,
            variantId: item.variantId || item.id || "",
            handle: item.handle || "",
            title: item.title || "Product",
            image: item.image || item.imageUrl || "",
            price: parseMoneyAmount(item.priceAmount ?? item.price) || 0,
            vendor: item.vendor || "",
            variant: item.variant || "",
            currency: item.priceCurrency || order?.currencyCode || order?.currencySymbol || "",
            quantity: Math.max(1, Number(item.quantity) || 1),
          },
        })
      );
    });
    navigation.navigate("BottomNavScreen", { title: "Cart", pageName: "cart", link: "cart" });
  };

  // Only hide the section for OTHER cancel-ineligibility reasons (voided,
  // refunded, Shopify-blocked) — a disabled button with a "why not" caption
  // there invites a tap that was always going to fail. An already-canceled
  // order instead falls through to the Reorder button below.
  if (!alreadyCanceled && !canCancel && !submitting) return null;

  return (
    <View
      style={[
        styles.cancelContainer,
        { backgroundColor: outerBgColor, borderRadius: outerRadius, paddingTop: outerPt, paddingBottom: outerPb, paddingLeft: outerPl, paddingRight: outerPr },
        outerBorder,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.cancelButton,
          {
            backgroundColor: disabled && !alreadyCanceled ? disabledBgColor : bgColor,
            borderRadius,
            opacity: disabled && !alreadyCanceled ? toNum(raw?.disabledOpacity, 0.55) : 1,
          },
          buttonBorder,
        ]}
        onPress={alreadyCanceled ? handleReorder : handleCancel}
        disabled={alreadyCanceled ? false : disabled}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Text style={{ color: disabled && !alreadyCanceled ? disabledTextColor : textColor, fontSize, fontWeight, ...(fontFamily ? { fontFamily } : {}) }}>
            {alreadyCanceled ? "Reorder" : label}
          </Text>
        )}
      </TouchableOpacity>
      {!submitting && nonCancellableReason && !alreadyCanceled ? (
        <Text style={styles.cancelHelpText}>{nonCancellableReason}</Text>
      ) : null}
      {errorText ? <Text style={styles.cancelErrorText}>{errorText}</Text> : null}
    </View>
  );
}

// ─── Order Items Section ──────────────────────────────────────────────────────

function OrderItemsSection({ section, items, order }) {
  const propsNode = section ? getRawProps(section) : {};

  // Builder's order_detail_page block (OrderInfo/PreviewLive.tsx) gates its
  // whole card — background, padding, radius, border — behind a single
  // "orderCard" visibility toggle, and its actual DSL field names are
  // bgColor/pt/pr/pb/pl (not paddingTop/Left/Right/Bottom, which were never
  // written by that block's Inspector at all — so this card's configured
  // padding never reached the app previously).
  const showOrderCard  = toBool(propsNode?.visibility?.orderCard, true);
  const bgColor        = showOrderCard ? toStr(propsNode?.bgColor, "#F5F5F5") : "transparent";
  // Per-field visibility toggles — none of these were read at all before, so
  // every line always showed regardless of what was actually enabled/
  // disabled in the Inspector. Builder's own naming is confusing (the
  // "orderNumber" toggle actually gates the Variant line, and "orderDelivery"
  // gates the Price line — not what the names suggest) but this mirrors
  // OrderInfo/PreviewLive.tsx's showImage/showTitle/showLabel/
  // showOrderNumber/showOrderDate/showOrderDelivery exactly, including that
  // showLabel is the outer gate for all three of Variant/Date/Price (if it's
  // off, none of the three show even if individually enabled).
  const vis = propsNode?.visibility || {};
  const showImage = toBool(vis?.cardImage, true);
  const showTitle = toBool(vis?.cardTitle, true);
  const showLabel = toBool(vis?.orderLabel, true);
  const showVariant = showLabel && toBool(vis?.orderNumber, true);
  const showDate = showLabel && toBool(vis?.orderDate, true);
  const showPrice = showLabel && toBool(vis?.orderDelivery, true);
  // borderRadius — the only real field (see OrderInfo/InspectorLive.tsx's
  // "Border Radius" control, which writes exactly this key with a default of
  // 0). "radius"/"cornerRadius" were guessed names nothing ever writes, so
  // they never masked the real value in practice — but the default of 14
  // here meant an *unconfigured* card looked rounded in the app while the
  // Inspector's own default is a square 0, which is what "not working
  // dynamically" showed up as: whatever the merchant actually set the field
  // to was correctly read, but the moment it was still at its default (most
  // merchants never touch it), the app showed a completely different corner
  // radius than Builder's default (and, separately, OrderInfo/PreviewLive.tsx's
  // own canvas render hardcodes "20px" regardless of this prop — a Builder
  // canvas bug, fixed alongside this one so the saved value is at least
  // visible and correct in both places going forward).
  const radius         = showOrderCard ? toNum(propsNode?.borderRadius, 0) : 0;
  // Text colors/fonts below all now read Builder's actual field names —
  // titleColor/titleFontSize/titleFontFamily were already close, but the
  // "Variant"/"Delivery Date"/"Price" lines were reading fabricated field
  // names (metaColor/metaFontSize/priceColor/priceFontSize/priceFontWeight/
  // priceFontFamily) that OrderInfo/InspectorLive.tsx never actually writes
  // — Builder's real, independently-configurable fields for those three
  // lines are labelLabelColor/labelFontSize/labelFontWeight/labelFontFamily
  // (Variant), dateColor/dateFontSize/dateFontWeight/dateFontFamily
  // (Delivery Date), and deliveryColor/deliveryFontSize/deliveryFontWeight/
  // deliveryFontFamily (Price) — so customizing any of those three lines'
  // color/size/weight/family in the Inspector had zero effect here before.
  const titleColor     = toStr(propsNode?.titleColor, "#000000");
  const titleFontSize  = toNum(propsNode?.titleFontSize, 12);
  const titleFontWeight = toFontWeight(propsNode?.titleFontWeight, "600");
  const titleFontFamily = cleanFontFamily(toStr(propsNode?.titleFontFamily, "Inter"));
  const titleUppercase = toBool(propsNode?.titleUppercase, false);

  const labelColor = toStr(propsNode?.labelLabelColor, "#666666");
  const labelSize = toNum(propsNode?.labelFontSize, 12);
  const labelWeight = toFontWeight(propsNode?.labelFontWeight, "400");
  const labelFontFamily = cleanFontFamily(toStr(propsNode?.labelFontFamily, "Inter"));

  const dateColor = toStr(propsNode?.dateColor, "#666666");
  const dateSize = toNum(propsNode?.dateFontSize, 11);
  const dateWeight = toFontWeight(propsNode?.dateFontWeight, "400");
  const dateFontFamily = cleanFontFamily(toStr(propsNode?.dateFontFamily, "Inter"));

  const priceColor     = toStr(propsNode?.deliveryColor, "#000000");
  const priceFontSize  = toNum(propsNode?.deliveryFontSize, 12);
  const priceFontWeight = toFontWeight(propsNode?.deliveryFontWeight, "600");
  const priceFontFamily = cleanFontFamily(toStr(propsNode?.deliveryFontFamily, "Inter"));
  const priceAlign = toStr(propsNode?.priceAlign, "left").toLowerCase();
  // Shopify has no per-line-item delivery date — none of the order-fetching
  // code in services/shopify.js ever sets item.deliveryDate, so this line
  // never had anything to show. Fall back to the order-level estimate (the
  // same value OrderInfoSection's own "Estimated arrival" row already uses)
  // and show it on every item, since delivery date is order-wide in
  // Shopify's model, not per line item.
  const orderDeliveryDate = firstValue(order?.arrival, order?.estimatedDelivery);
  const imageBgColor = toStr(
    propsNode?.imageBg ??
      propsNode?.imageBgColor ??
      propsNode?.imageBackgroundColor ??
      propsNode?.productImageBgColor ??
      propsNode?.productImageBackgroundColor,
    "#FFFFFF"
  );
  // pt/pr/pb/pl — Builder's actual field names for this block's padding
  // (see the "showOrderCard" comment above). Kept paddingTop/etc. as a
  // fallback in case any older saved DSL used those instead.
  const padTop    = showOrderCard ? toNum(propsNode?.pt ?? propsNode?.paddingTop,    0) : 0;
  const padLeft   = showOrderCard ? toNum(propsNode?.pl ?? propsNode?.paddingLeft,   0) : 0;
  const padRight  = showOrderCard ? toNum(propsNode?.pr ?? propsNode?.paddingRight,  0) : 0;
  const padBottom = showOrderCard ? toNum(propsNode?.pb ?? propsNode?.paddingBottom, 0) : 0;
  const imageWidth = toNum(propsNode?.imageWidth, 90);
  const imageRatio = toStr(propsNode?.imageRatio ?? propsNode?.ratio, "");
  const ratioParts = imageRatio.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  const imageHeight = ratioParts
    ? Math.max(1, Math.round(imageWidth * (Number(ratioParts[2]) / Number(ratioParts[1]))))
    : imageWidth;
  const imageRadius = toNum(propsNode?.imageRadius ?? propsNode?.imageCorner, 0);
  const border = showOrderCard ? dslBorder(propsNode) : {};
  const labelFor = (key) =>
    toStr(firstValue(propsNode?.[`${key}Label`], propsNode?.labels?.[key]), humanizeKey(key));
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
            },
            border,
          ]}
        >
          {showImage ? (
            item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={[
                  styles.itemImage,
                  {
                    width: imageWidth,
                    height: imageHeight,
                    borderRadius: imageRadius,
                    backgroundColor: imageBgColor,
                  },
                ]}
                resizeMode={resolveProductImageResizeMode(
                  propsNode?.imageScale,
                  propsNode?.scale,
                  propsNode?.imageResizeMode
                )}
              />
            ) : (
              <View
                style={[
                  styles.itemImage,
                  styles.itemImagePlaceholder,
                  {
                    width: imageWidth,
                    height: imageHeight,
                    borderRadius: imageRadius,
                    backgroundColor: imageBgColor,
                  },
                ]}
              >
                <FontAwesome name="image" size={28} color="#D1D5DB" />
              </View>
            )
          ) : null}
          <View style={styles.itemInfo}>
            {showTitle ? (
              <Text
                style={[styles.itemTitle, { color: titleColor, fontSize: titleFontSize, fontWeight: titleFontWeight, textTransform: titleUppercase ? "uppercase" : "none", ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}) }]}
                numberOfLines={3}
              >
                {item.title}
              </Text>
            ) : null}
            {showVariant && item.variant ? (
              <Text style={[styles.itemMeta, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight, ...(labelFontFamily ? { fontFamily: labelFontFamily } : {}) }]}>
                {labelFor("variant")}: {item.variant}
              </Text>
            ) : null}
            {showVariant && item.quantity ? (
              <Text style={[styles.itemMeta, { color: labelColor, fontSize: labelSize, fontWeight: labelWeight, ...(labelFontFamily ? { fontFamily: labelFontFamily } : {}) }]}>
                {labelFor("quantity")}: {item.quantity}
              </Text>
            ) : null}
            {showDate && (item.deliveryDate || orderDeliveryDate) ? (
              <Text style={[styles.itemMeta, { color: dateColor, fontSize: dateSize, fontWeight: dateWeight, ...(dateFontFamily ? { fontFamily: dateFontFamily } : {}) }]}>
                {labelFor("deliveryDate")}: {item.deliveryDate || orderDeliveryDate}
              </Text>
            ) : null}
            {showPrice && itemPriceText(item) ? (
              <Text style={[styles.itemPrice, { color: priceColor, fontSize: priceFontSize, fontWeight: priceFontWeight, textAlign: priceAlign, ...(priceFontFamily ? { fontFamily: priceFontFamily } : {}) }]}>
                {labelFor("price")}: {itemPriceText(item)}
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
    minHeight:         56,
    paddingHorizontal: 16,
    paddingVertical:   6,
    backgroundColor:   "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex:       1,
    textAlign:  "center",
    fontSize:   17,
    fontWeight: "700",
    color:      "#111827",
    includeFontPadding: false,
    textAlignVertical: "center",
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
  cancelHelpText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
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

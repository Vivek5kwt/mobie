import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { SafeArea } from "../utils/SafeAreaHandler";
import DynamicRenderer from "../engine/DynamicRenderer";
import Header from "../components/Topheader";
import Snackbar from "../components/Snackbar";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { clearCart } from "../store/slices/cartSlice";
import { fetchShopifyOrderDetails } from "../services/shopify";
import { saveCompletedOrder } from "../services/orderHistoryService";

const PAGE_HANDLE = "post-purchase";
const REFRESH_INTERVAL_MS = 30000;

const fingerprint = (dsl) => JSON.stringify({
  headerdefault: dsl?.headerdefault ?? null,
  brandKit: dsl?.brandKit ?? null,
  sections: dsl?.sections || [],
});

const CONFIRMATION_TEXT_KEYS = [
  "title",
  "titleText",
  "headline",
  "heading",
  "subtext",
  "subtextText",
  "subtitle",
  "description",
  "message",
  "body",
  "orderText",
  "orderNumberText",
];

const unwrapDslValue = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value === "object") {
    if (value.value !== undefined) return unwrapDslValue(value.value);
    if (value.const !== undefined) return unwrapDslValue(value.const);
    if (value.properties !== undefined) return unwrapDslValue(value.properties);
  }
  return value;
};

const assignDslValue = (target, key, nextValue) => {
  if (!target || typeof target !== "object") return;
  const current = target[key];
  if (current && typeof current === "object") {
    if (current.value !== undefined) {
      current.value = nextValue;
      return;
    }
    if (current.properties && typeof current.properties === "object") {
      if (current.properties.value !== undefined) {
        current.properties.value = nextValue;
        return;
      }
      current.value = nextValue;
      return;
    }
  }
  target[key] = nextValue;
};

const stripStaticOrderNumber = (text) => {
  if (!text) return text;
  const raw = String(text);
  const cleaned = raw
    .replace(/\{order_number\}|\{orderNumber\}|\{order\}/gi, "")
    .replace(/\b(order\s*(?:number|no\.?)?)\s*[:#]?\s*[A-Za-z0-9-]+/gi, "order")
    .replace(/\border\s*#\s*[A-Za-z0-9-]+/gi, "order")
    .replace(/#\s*[A-Za-z0-9-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.!?,])/g, "$1")
    .trim();
  return cleaned || "Your order is confirmed.";
};

// Replace {order_number} / {orderNumber} placeholders and stale sample values.
const fillPlaceholders = (text, orderNumber) => {
  if (!text) return text;
  if (!orderNumber) return stripStaticOrderNumber(text);
  const displayNumber = normalizeOrderNumber(orderNumber);
  return String(text)
    .replace(/\{order_number\}/gi, displayNumber)
    .replace(/\{orderNumber\}/gi, displayNumber)
    .replace(/\{order\}/gi, displayNumber)
    .replace(/(order\s*(?:number|no\.?)\s*)#?\s*[A-Za-z0-9-]+/gi, `$1${displayNumber}`)
    .replace(/(order\s*#\s*)[A-Za-z0-9-]+/gi, `Order ${displayNumber}`)
    .replace(/#\s*[A-Za-z0-9-]+/g, displayNumber);
};

const normalizeOrderNumber = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const orderPhrase =
    raw.match(/order\s*(?:number|no\.?)?\s*#\s*([A-Za-z0-9-]+)/i) ||
    raw.match(/order\s*(?:number|no\.?)\s+([A-Za-z0-9-]+)/i);
  const hash = raw.match(/#\s*([A-Za-z0-9-]+)/);
  const plain = raw.match(/^#?\s*([A-Za-z0-9-]+)\s*$/);
  const valuePart = orderPhrase?.[1] || hash?.[1] || plain?.[1] || "";
  return valuePart ? `#${valuePart}` : "";
};

const updateConfirmationTextTarget = (target, orderNumber) => {
  if (!target || typeof target !== "object") return false;
  let changed = false;
  CONFIRMATION_TEXT_KEYS.forEach((key) => {
    if (target[key] === undefined) return;
    const rawText = unwrapDslValue(target[key]);
    if (rawText === undefined || rawText === null) return;
    const nextText = fillPlaceholders(rawText, orderNumber);
    assignDslValue(target, key, nextText);
    changed = true;
  });
  if (orderNumber) {
    assignDslValue(target, "orderNumber", orderNumber);
    assignDslValue(target, "order_number", orderNumber);
  } else if (target.orderNumber !== undefined || target.order_number !== undefined) {
    assignDslValue(target, "orderNumber", "");
    assignDslValue(target, "order_number", "");
  }
  return changed;
};

const textTargetIncludesOrderNumber = (target, orderNumber) => {
  if (!target || typeof target !== "object" || !orderNumber) return false;
  return CONFIRMATION_TEXT_KEYS.some((key) => {
    if (target[key] === undefined) return false;
    return String(unwrapDslValue(target[key]) || "").includes(orderNumber);
  });
};

const pickSessionCustomerAccessToken = (session) => {
  const candidates = [
    session?.user?.customerAccessToken,
    session?.user?.shopifyCustomerAccessToken,
    session?.user?.customer_access_token,
    session?.customerAccessToken,
    session?.shopifyCustomerAccessToken,
    session?.user?.userToken,
    session?.accessToken,
    session?.token,
  ];
  return candidates.map((value) => String(value || "").trim()).find(Boolean) || "";
};

// Inject real cart items into order_summary and real order number into confirmation_header
const injectOrderData = (sections = [], capturedItems = [], orderNumber = "", orderTotal = 0, orderState = {}) => {
  return sections.map((section) => {
    const comp = String(
      section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      ""
    ).toLowerCase();

    // ── order_summary — inject purchased line items ──────────────────────────
    if (
      comp === "order_summary" ||
      comp === "price_line"    ||
      comp === "cart_summary"  ||
      comp === "cart_total"
    ) {
      if (!capturedItems.length) return section;
      const cloned = JSON.parse(JSON.stringify(section));
      const propsNode =
        cloned?.properties?.props?.properties ||
        cloned?.properties?.props ||
        cloned?.props ||
        {};

      const mapped = capturedItems.map((item, idx) => ({
        id:      String(item.id || idx + 1),
        qty:     item.quantity || 1,
        image:   item.image || "",
        price:   item.price || 0,
        title:   item.title || "Product",
        variant: item.variant || "",
      }));
      const derivedCurrency =
        capturedItems[0]?.currency ||
        capturedItems[0]?.priceCurrency ||
        capturedItems[0]?.currencySymbol ||
        "$";
      const computedTotal = mapped.reduce(
        (sum, line) => sum + (Number(line.price) || 0) * (Number(line.qty) || 1),
        0
      );
      const resolvedOrderTotal = Number(orderTotal) > 0 ? Number(orderTotal) : computedTotal;

      if (propsNode?.raw?.value !== undefined) {
        propsNode.raw.value = {
          ...(propsNode.raw.value || {}),
          items: mapped,
          currency: propsNode.raw.value?.currency || derivedCurrency,
          cartTotal: resolvedOrderTotal,
          subTotal: resolvedOrderTotal,
          showCartTotal: true,
          showSubTotal: true,
          showSavings: propsNode.raw.value?.showSavings ?? false,
          showTax: propsNode.raw.value?.showTax ?? false,
          showDiscount: propsNode.raw.value?.showDiscount ?? false,
        };
      } else if (propsNode?.raw !== undefined) {
        propsNode.raw = {
          ...(propsNode.raw || {}),
          items: mapped,
          currency: propsNode.raw?.currency || derivedCurrency,
          cartTotal: resolvedOrderTotal,
          subTotal: resolvedOrderTotal,
          showCartTotal: true,
          showSubTotal: true,
          showSavings: propsNode.raw?.showSavings ?? false,
          showTax: propsNode.raw?.showTax ?? false,
          showDiscount: propsNode.raw?.showDiscount ?? false,
        };
      }
      return cloned;
    }

    // ── confirmation_header — fill real order number ─────────────────────────
    if (
      comp === "confirmation_header"  ||
      comp === "order_confirmation"   ||
      comp === "confirmation-header"
    ) {
      const cloned = JSON.parse(JSON.stringify(section));
      const propsNode =
        cloned?.properties?.props?.properties ||
        cloned?.properties?.props ||
        cloned?.props ||
        {};

      let rawValue = {};
      if (propsNode?.raw?.value !== undefined) {
        rawValue = propsNode.raw.value || {};
      } else if (propsNode?.raw !== undefined) {
        rawValue = propsNode.raw || {};
      }

      const touchedRaw = updateConfirmationTextTarget(rawValue, orderNumber);
      const touchedProps = updateConfirmationTextTarget(propsNode, orderNumber);
      const hasRenderedOrderNumber =
        !!orderNumber &&
        (
          textTargetIncludesOrderNumber(rawValue, orderNumber) ||
          textTargetIncludesOrderNumber(propsNode, orderNumber)
        );
      if (orderNumber && !hasRenderedOrderNumber) {
        rawValue.subtext = `Your order ${orderNumber} is confirmed.`;
        rawValue.showSubtext = true;
      } else if (!touchedRaw && !touchedProps) {
        rawValue.subtext = orderNumber
          ? `Your order ${orderNumber} is confirmed.`
          : orderState.syncing
            ? "Your order is confirmed. Syncing order details..."
            : "Your order is confirmed.";
        rawValue.showSubtext = true;
      }

      if (propsNode?.raw?.value !== undefined) {
        propsNode.raw.value = rawValue;
      } else {
        propsNode.raw = rawValue;
      }
      return cloned;
    }

    return section;
  });
};

export default function PostPurchaseScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const dispatch   = useDispatch();
  const { session } = useAuth();

  const capturedItems = useMemo(
    () => route?.params?.capturedItems || [],
    [route?.params?.capturedItems]
  );

  const routeOrder = route?.params?.order || null;
  const authenticatedCheckout = route?.params?.authenticatedCheckout === true;
  const [syncedOrder, setSyncedOrder] = useState(routeOrder);
  const orderNumber = normalizeOrderNumber(
    syncedOrder?.orderNumber ||
      syncedOrder?.name ||
      route?.params?.orderNumber ||
      ""
  );
  const orderTotal  = route?.params?.orderTotal || syncedOrder?.total || 0;
  const customerAccessToken = useMemo(
    () => pickSessionCustomerAccessToken(session),
    [session]
  );

  const appId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  const [sections, setSections] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [orderSyncing, setOrderSyncing] = useState(false);
  const [orderSyncError, setOrderSyncError] = useState("");
  const [snackbarVisible, setSnackbarVisible] = useState(true);
  const fingerprintRef = useRef(null);
  const timerRef       = useRef(null);
  const isNavigatingHomeRef = useRef(false);
  const syncedOrderKeyRef = useRef("");

  const snackbarMessage = "Your order has been placed successfully.";

  const snackbarNode = (
    <Snackbar
      visible={snackbarVisible}
      message={snackbarMessage}
      onDismiss={() => setSnackbarVisible(false)}
      duration={3000}
      type="success"
    />
  );

  const goHome = useCallback(() => {
    isNavigatingHomeRef.current = true;
    navigation.reset({
      index: 0,
      routes: [{ name: "LayoutScreen" }],
    });
  }, [navigation]);

  // Clear cart the moment the purchase confirmation screen mounts
  useEffect(() => {
    dispatch(clearCart());
  }, [dispatch]);

  useEffect(() => {
    setSyncedOrder(routeOrder);
  }, [routeOrder]);

  useEffect(() => {
    const candidate =
      syncedOrder ||
      (orderNumber
        ? {
            orderNumber,
            name: orderNumber,
            total: orderTotal,
            lineItems: capturedItems,
            needsStoreRefresh: true,
          }
        : null);
    if (!candidate) return undefined;

    const syncKey = String(
      candidate.adminOrderId ||
        candidate.adminGraphqlApiId ||
        candidate.id ||
        candidate.orderNumber ||
        candidate.name ||
        `${candidate.total || ""}:${candidate.placedAt || candidate.orderDate || ""}`
    );
    if (!syncKey || syncedOrderKeyRef.current === syncKey) return undefined;
    if (
      candidate.needsStoreRefresh === false &&
      (candidate.adminOrderId || candidate.adminGraphqlApiId) &&
      normalizeOrderNumber(candidate.orderNumber || candidate.name)
    ) {
      syncedOrderKeyRef.current = syncKey;
      return undefined;
    }

    let mounted = true;
    syncedOrderKeyRef.current = syncKey;
    (async () => {
      try {
        setOrderSyncing(true);
        setOrderSyncError("");
        const latest = await fetchShopifyOrderDetails({
          order: candidate,
          customerAccessToken,
        });
        if (!mounted || !latest) return;
        const latestOrderNumber = normalizeOrderNumber(latest.orderNumber || latest.name);
        const nextOrder = {
          ...candidate,
          ...latest,
          orderNumber: latestOrderNumber || normalizeOrderNumber(candidate.orderNumber || candidate.name),
          needsStoreRefresh: !latestOrderNumber && !latest.adminOrderId && !latest.adminGraphqlApiId,
        };
        setSyncedOrder(nextOrder);
        if (authenticatedCheckout) {
          saveCompletedOrder({
            appId,
            userId: session?.user?.id ?? null,
            email: session?.user?.email || "",
            order: nextOrder,
          }).catch(() => {});
        }
      } catch (lookupError) {
        if (mounted) {
          setOrderSyncError(lookupError?.message || "Unable to sync order details.");
        }
      } finally {
        if (mounted) setOrderSyncing(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [appId, authenticatedCheckout, capturedItems, customerAccessToken, orderNumber, orderTotal, session?.user?.email, session?.user?.id, syncedOrder]);

  const loadPage = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(false);
      }
      // fetchDSL returns { dsl: <page-dsl>, versionNumber } — extract sections from dsl.sections
      const result   = await fetchDSL(appId, PAGE_HANDLE);
      const incomingDsl = result?.dsl || {};
      const incoming = incomingDsl?.sections || [];
      const fp       = fingerprint(incomingDsl);
      if (fp !== fingerprintRef.current) {
        fingerprintRef.current = fp;
        setSections(incoming);
      }
    } catch (_) {
      if (!silent) setError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(false);
    timerRef.current = setInterval(() => loadPage(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [appId]);

  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
      if (isNavigatingHomeRef.current) {
        return;
      }
      event.preventDefault();
      goHome();
    });

    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true;
    });

    return () => {
      unsubscribeBeforeRemove();
      backHandler.remove();
    };
  }, [navigation, goHome]);

  // Merge DSL layout with real order data before rendering
  const resolvedSections = useMemo(
    () => injectOrderData(sections, capturedItems, orderNumber, orderTotal, {
      syncing: orderSyncing,
      error: orderSyncError,
    }),
    [sections, capturedItems, orderNumber, orderTotal, orderSyncError, orderSyncing]
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeArea>
        <View style={styles.container}>
          <Header showBack={false} onTitlePress={goHome} />
          <View style={styles.centreWrap}>
            <ActivityIndicator size="large" color="#0D9488" />
            <Text style={styles.loadingText}>Loading your order…</Text>
          </View>
        </View>
        {snackbarNode}
      </SafeArea>
    );
  }

  // ── Error / empty state ───────────────────────────────────────────────────
  if (error || resolvedSections.length === 0) {
    return (
      <SafeArea>
        <View style={styles.container}>
          <Header showBack={false} onTitlePress={goHome} />
          <View style={styles.centreWrap}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Order Placed Successfully!</Text>
            {!!orderNumber && (
              <Text style={styles.successSubtext}>Order {orderNumber}</Text>
            )}
            {!orderNumber && orderSyncing && (
              <Text style={styles.successSubtext}>Syncing order details...</Text>
            )}
            {!orderNumber && !orderSyncing && !!orderSyncError && (
              <Text style={styles.successSubtext}>Order details will be available shortly.</Text>
            )}
            <Text style={styles.successSubtext}>
              Thank you for your purchase. You will receive a confirmation shortly.
            </Text>
          </View>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.shopBtn}
              activeOpacity={0.85}
              onPress={goHome}
            >
              <Text style={styles.shopBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
        {snackbarNode}
      </SafeArea>
    );
  }

  // ── Normal DSL-driven render ──────────────────────────────────────────────
  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} onTitlePress={goHome} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {resolvedSections.map((section, idx) => (
            <DynamicRenderer key={idx} section={section} />
          ))}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.shopBtn}
            activeOpacity={0.85}
            onPress={goHome}
          >
            <Text style={styles.shopBtnText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
        </View>
        {snackbarNode}
      </SafeArea>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#F5F5F5",
  },
  scroll: {
    flexGrow:      1,
    paddingBottom: 104,
  },
  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 16,
    alignItems: "center",
  },
  centreWrap: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               16,
  },
  loadingText: {
    color:     "#374151",
    fontSize:  15,
    textAlign: "center",
  },
  successIcon: {
    fontSize:   56,
    color:      "#20D380",
    fontWeight: "700",
  },
  successTitle: {
    fontSize:   22,
    fontWeight: "700",
    color:      "#111827",
    textAlign:  "center",
  },
  successSubtext: {
    fontSize:  14,
    color:     "#6B7280",
    textAlign: "center",
  },
  shopBtn: {
    marginTop:         8,
    paddingVertical:   14,
    paddingHorizontal: 32,
    borderRadius:      12,
    backgroundColor:   "#0D9488",
    alignSelf:         "center",
    alignItems:        "center",
    justifyContent:    "center",
  },
  shopBtnText: {
    color:      "#FFFFFF",
    fontSize:   16,
    fontWeight: "700",
    textAlign:  "center",
  },
});

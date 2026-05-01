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

const PAGE_HANDLE = "post-purchase";
const REFRESH_INTERVAL_MS = 5000;

const fingerprint = (sections) => JSON.stringify(sections);

// Replace {order_number} / {orderNumber} placeholders in any string
const fillPlaceholders = (text, orderNumber) => {
  if (!text || !orderNumber) return text;
  return String(text)
    .replace(/\{order_number\}/gi, orderNumber)
    .replace(/\{orderNumber\}/gi, orderNumber)
    .replace(/\{order\}/gi, orderNumber);
};

// Inject real cart items into order_summary and real order number into confirmation_header
const injectOrderData = (sections = [], capturedItems = [], orderNumber = "", orderTotal = 0) => {
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
      if (!orderNumber) return section;
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

      // Fill placeholder in existing subtext, or inject a default one
      const subtextKey = rawValue.subtext !== undefined
        ? "subtext"
        : rawValue.subtextText !== undefined
        ? "subtextText"
        : null;

      if (subtextKey) {
        rawValue[subtextKey] = fillPlaceholders(rawValue[subtextKey], orderNumber);
      } else {
        rawValue.subtext     = `Your Order ${orderNumber} Is Confirmed`;
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

  const orderNumber = route?.params?.orderNumber || "";
  const orderTotal  = route?.params?.orderTotal  || 0;

  const appId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  const [sections, setSections] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(true);
  const fingerprintRef = useRef(null);
  const timerRef       = useRef(null);
  const isNavigatingHomeRef = useRef(false);

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

  const loadPage = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(false);
      }
      // fetchDSL returns { dsl: <page-dsl>, versionNumber } — extract sections from dsl.sections
      const result   = await fetchDSL(appId, PAGE_HANDLE);
      const incoming = result?.dsl?.sections || [];
      const fp       = fingerprint(incoming);
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
    () => injectOrderData(sections, capturedItems, orderNumber, orderTotal),
    [sections, capturedItems, orderNumber, orderTotal]
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

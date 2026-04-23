import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { WebView } from "react-native-webview";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";
import { useAuth } from "../services/AuthContext";
import { resolveAppId } from "../utils/appId";
import { triggerOrderNotification, ORDER_EVENTS } from "../services/notificationService";

// ── Helpers ───────────────────────────────────────────────────────────────────

const extractOrderNumber = (url) => {
  if (!url) return "";
  const longMatch = url.match(/\/(\d{6,})\/orders\//);
  if (longMatch) return `#${longMatch[1].slice(-6)}`;
  const simpleMatch = url.match(/\/orders\/(\d+)/);
  if (simpleMatch) return `#${simpleMatch[1]}`;
  try {
    const u = new URL(url);
    const n = u.searchParams.get("order_number") || u.searchParams.get("order");
    if (n) return `#${n}`;
  } catch (_) {}
  return `#${Math.floor(1000 + Math.random() * 9000)}`;
};

const buildOrderFromCart = (capturedItems, url) => {
  const today   = new Date();
  const fmt     = (d) => d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const arrival = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const lineItems = (capturedItems || []).map((item) => ({
    id:       String(item.id || item.variantId || ""),
    title:    item.title || "Product",
    variant:  item.variant || "",
    imageUrl: item.image || item.imageUrl || "",
    price:    item.price ? `$${parseFloat(item.price).toFixed(2)}` : "",
    quantity: item.quantity || 1,
  }));

  const subtotal = (capturedItems || []).reduce(
    (sum, item) => sum + parseFloat(item.price || 0) * (item.quantity || 1),
    0
  );
  const tax   = parseFloat((subtotal * 0.08).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));

  return {
    orderNumber:    extractOrderNumber(url),
    orderDate:      fmt(today),
    status:         "Order Placed",
    deliveryMethod: "Standard Shipping",
    arrival:        fmt(arrival),
    delivery:       0,
    tax,
    total,
    lineItems,
  };
};

// Returns true only on the final Shopify thank-you / order-status page.
// Must NOT match intermediate checkout steps like /checkouts/.../contact etc.
const isOrderCompleteUrl = (url) => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("thank_you") ||
    lower.includes("thankyou") ||
    lower.includes("order_status") ||
    // Shopify thank-you path pattern: /orders/<id>/authenticate or /orders/<id> at the end
    /\/orders\/[a-z0-9]+(\?|$)/.test(lower)
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutWebViewScreen() {
  const navigation        = useNavigation();
  const route             = useRoute();
  const { session }       = useAuth();
  const cartItems         = useSelector((state) => state.cart?.items || []);

  const checkoutUrl = route?.params?.url;
  const headerTitle = route?.params?.title || "Checkout";

  const [isLoading,  setIsLoading]  = useState(true);
  const [loadError,  setLoadError]  = useState(false);
  const [canGoBack,  setCanGoBack]  = useState(false);

  const webViewRef           = useRef(null);
  const hasCompletedOrderRef = useRef(false);
  const capturedItemsRef     = useRef(cartItems);

  const resolvedAppId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const userId = session?.user?.id ?? null;

  // ── Back handling ─────────────────────────────────────────────────────────
  // Priority: 1) navigate back inside WebView  2) go back in nav stack
  const handleBack = useCallback(() => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true; // consumed — don't propagate to nav
    }
    navigation.goBack();
    return true;
  }, [canGoBack, navigation]);

  // Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // ── Order complete detection ───────────────────────────────────────────────
  const handleNavigationStateChange = useCallback(
    (navState) => {
      // Track WebView back-history so our back button knows what to do
      setCanGoBack(!!navState?.canGoBack);

      if (!navState?.url || hasCompletedOrderRef.current) return;
      if (!isOrderCompleteUrl(navState.url)) return;

      hasCompletedOrderRef.current = true;

      const capturedItems = capturedItemsRef.current || [];
      const order         = buildOrderFromCart(capturedItems, navState.url);

      triggerOrderNotification({
        type:        ORDER_EVENTS.ORDER_PLACED,
        orderNumber: order.orderNumber,
        appId:       resolvedAppId,
        userId,
      }).catch(() => {});

      // Small delay so WebView finishes rendering the thank-you page visually
      // before we replace the stack with PostPurchase
      setTimeout(() => {
        navigation.reset({
          index:  0,
          routes: [{
            name: "PostPurchase",
            params: {
              capturedItems: capturedItemsRef.current || [],
              appId: resolvedAppId,
            },
          }],
        });
      }, 600);
    },
    [navigation, resolvedAppId, userId]
  );

  // ── WebView loading states ────────────────────────────────────────────────
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setLoadError(false);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setLoadError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} />

        {/* Custom header with smart back button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome name="angle-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {headerTitle}
          </Text>
          {/* Placeholder to keep title centred */}
          <View style={styles.backButton} />
        </View>

        {!checkoutUrl ? (
          <View style={styles.centreWrap}>
            <FontAwesome name="exclamation-circle" size={40} color="#EF4444" />
            <Text style={styles.errorText}>Checkout link unavailable.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.retryBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : loadError ? (
          <View style={styles.centreWrap}>
            <FontAwesome name="wifi" size={40} color="#9CA3AF" />
            <Text style={styles.errorText}>Failed to load checkout page.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            <WebView
              ref={webViewRef}
              source={{ uri: checkoutUrl }}
              onLoadStart={handleLoadStart}
              onLoadEnd={handleLoadEnd}
              onError={handleError}
              onHttpError={handleError}
              onNavigationStateChange={handleNavigationStateChange}
              startInLoadingState={false}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              allowsBackForwardNavigationGestures
              style={styles.webView}
            />

            {/* Loading overlay — shown between Shopify checkout steps */}
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#0EA5E9" size="large" />
                <Text style={styles.loadingText}>Loading…</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: 16,
    paddingVertical:  12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    width:      36,
    alignItems: "center",
  },
  title: {
    flex:       1,
    textAlign:  "center",
    fontSize:   16,
    fontWeight: "600",
    color:      "#111827",
  },
  webViewContainer: {
    flex:            1,
    backgroundColor: "#ffffff",
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex:          10,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             12,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  loadingText: {
    textAlign: "center",
    color:     "#374151",
    fontSize:  15,
  },
  centreWrap: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap:            16,
  },
  errorText: {
    color:     "#374151",
    fontSize:  15,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical:   10,
    paddingHorizontal: 28,
    borderRadius:      8,
    backgroundColor:   "#111827",
  },
  retryBtnText: {
    color:      "#FFFFFF",
    fontWeight: "600",
    fontSize:   14,
  },
});

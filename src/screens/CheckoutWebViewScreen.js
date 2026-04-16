import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { WebView } from "react-native-webview";
import { SafeArea } from "../utils/SafeAreaHandler";
import Header from "../components/Topheader";

// ── Helpers ───────────────────────────────────────────────────────────────────

const extractOrderNumber = (url) => {
  if (!url) return "";
  // /59376534593/orders/abc123  → use last 6 digits of the numeric ID
  const longMatch = url.match(/\/(\d{6,})\/orders\//);
  if (longMatch) return `#${longMatch[1].slice(-6)}`;
  // /orders/12345 or order_number=1234
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
  const today = new Date();
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const arrival = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const lineItems = (capturedItems || []).map((item) => ({
    id: String(item.id || item.variantId || ""),
    title: item.title || "Product",
    variant: item.variant || "",
    imageUrl: item.image || item.imageUrl || "",
    price: item.price ? `$${parseFloat(item.price).toFixed(2)}` : "",
    quantity: item.quantity || 1,
  }));

  const subtotal = (capturedItems || []).reduce(
    (sum, item) => sum + parseFloat(item.price || 0) * (item.quantity || 1),
    0
  );
  const tax = parseFloat((subtotal * 0.08).toFixed(2));
  const total = parseFloat((subtotal + tax).toFixed(2));

  return {
    orderNumber: extractOrderNumber(url),
    orderDate: fmt(today),
    status: "Order Placed",
    deliveryMethod: "Standard Shipping",
    arrival: fmt(arrival),
    delivery: 0,
    tax,
    total,
    lineItems,
  };
};

export default function CheckoutWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const cartItems = useSelector((state) => state.cart?.items || []);
  const checkoutUrl = route?.params?.url;
  const headerTitle = route?.params?.title || "Web View";
  const [isLoading, setIsLoading] = useState(true);
  const hasReturnedHomeRef = useRef(false);
  // Capture cart snapshot at mount time (before cart gets cleared)
  const capturedItemsRef = useRef(cartItems);

  const isOrderCompleteUrl = useCallback((url) => {
    if (!url) return false;
    const normalized = url.toLowerCase();
    return (
      normalized.includes("thank_you") ||
      normalized.includes("thankyou") ||
      normalized.includes("order_status") ||
      normalized.includes("/orders/")
    );
  }, []);

  const handleNavigationStateChange = useCallback(
    (navState) => {
      if (!navState?.url || hasReturnedHomeRef.current) return;
      if (!isOrderCompleteUrl(navState.url)) return;
      hasReturnedHomeRef.current = true;

      const capturedItems = capturedItemsRef.current || [];
      const order = buildOrderFromCart(capturedItems, navState.url);

      if (navigation?.reset) {
        navigation.reset({
          index: 0,
          routes: [{ name: "OrderDetail", params: { order } }],
        });
        return;
      }
      navigation?.navigate?.("OrderDetail", { order });
    },
    [isOrderCompleteUrl, navigation],
  );

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header showBack={false} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="angle-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>{headerTitle}</Text>
        </View>
        {!checkoutUrl ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Checkout link unavailable.</Text>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            {isLoading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator color="#0EA5E9" size="large" />
                <Text style={styles.helperText}>Loading checkout…</Text>
              </View>
            )}
            <WebView
              source={{ uri: checkoutUrl }}
              onLoadEnd={() => setIsLoading(false)}
              onNavigationStateChange={handleNavigationStateChange}
              startInLoadingState
            />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    paddingRight: 12,
    paddingVertical: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  helperText: {
    textAlign: "center",
    color: "#374151",
    fontSize: 15,
  },
  loadingOverlay: {
    position: "absolute",
    zIndex: 2,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#b91c1c",
  },
});

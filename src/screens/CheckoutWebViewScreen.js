import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { SafeArea } from "../utils/SafeAreaHandler";

export default function CheckoutWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [loading, setLoading] = useState(true);
  const checkoutUrl = route?.params?.url;

  return (
    <SafeArea>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <FontAwesome name="angle-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Checkout</Text>
        </View>
        {!checkoutUrl ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Checkout link unavailable.</Text>
          </View>
        ) : (
          <View style={styles.webviewContainer}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#111827" />
                <Text style={styles.loadingText}>Loading checkout...</Text>
              </View>
            )}
            <WebView
              source={{ uri: checkoutUrl }}
              onLoadEnd={() => setLoading(false)}
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
  webviewContainer: {
    flex: 1,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    zIndex: 1,
  },
  loadingText: {
    marginTop: 12,
    color: "#111827",
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

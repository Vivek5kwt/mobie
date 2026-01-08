import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { WebView } from "react-native-webview";
import { SafeArea } from "../utils/SafeAreaHandler";

export default function CheckoutWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const checkoutUrl = route?.params?.url;
  const headerTitle = route?.params?.title || "Web View";
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SafeArea>
      <View style={styles.container}>
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

import React, { useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { SafeArea } from "../utils/SafeAreaHandler";

export default function CheckoutWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const checkoutUrl = route?.params?.url;
  const headerTitle = route?.params?.title || "Web View";
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenCheckout = async () => {
    if (!checkoutUrl) {
      return;
    }

    setIsOpening(true);
    try {
      await Linking.openURL(checkoutUrl);
    } finally {
      setIsOpening(false);
    }
  };

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
            <Text style={styles.helperText}>
              Tap below to open the checkout link in your browser.
            </Text>
            <TouchableOpacity
              style={styles.openButton}
              onPress={handleOpenCheckout}
              disabled={isOpening}
            >
              {isOpening ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.openButtonText}>Open checkout</Text>
              )}
            </TouchableOpacity>
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  helperText: {
    textAlign: "center",
    color: "#374151",
    fontSize: 15,
  },
  openButton: {
    minWidth: 200,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
  },
  openButtonText: {
    color: "#ffffff",
    fontWeight: "600",
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

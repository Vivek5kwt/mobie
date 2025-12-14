import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View, StyleSheet, TouchableOpacity, Button } from "react-native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchDSL } from "../engine/dslHandler";
import { SafeArea } from "../utils/SafeAreaHandler";
import tokenLogger from "../utils/tokenLogger";

export default function LayoutScreen() {
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Reload DSL
  const refreshDSL = async () => {
    try {
      const dslData = await fetchDSL();
      setDsl(dslData);
    } catch (e) {
      console.log("❌ Refresh error:", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDSL();
    setRefreshing(false);
  };

  // Load DSL on mount
  const loadDSL = async () => {
    try {
      setLoading(true);
      setErr(null);

      const dslData = await fetchDSL();
      setDsl(dslData);

      console.log(
        `================ LIVE DSL OUTPUT ================\n`,
        JSON.stringify(dslData, null, 2),
        "\n================================================="
      );

      if (!dslData) {
        setErr("No live DSL returned from server");
      }
    } catch (e) {
      setErr(e.message);
      console.log("❌ DSL LOAD ERROR >>>", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDSL();
  }, []);

  // Print token for debugging
  const printDeviceToken = async () => {
    console.log("\n" + "=".repeat(60));
    console.log("🔄 MANUAL TOKEN PRINT REQUESTED");
    console.log("=".repeat(60));

    try {
      await tokenLogger.getTokenFromAnySource();
    } catch (error) {
      console.log("❌ Error:", error.message);
    }
  };

  // LOADING SCREEN
  if (loading)
    return (
      <SafeArea>
        <View style={styles.centerContainer}>
          <Text style={styles.loading}>Loading Live Data...</Text>
          <TouchableOpacity style={styles.tokenButton} onPress={printDeviceToken}>
            <Text style={styles.tokenButtonText}>📱 Print Device Token</Text>
          </TouchableOpacity>
        </View>
      </SafeArea>
    );

  // ERROR SCREEN
  if (err || !dsl)
    return (
      <SafeArea>
        <View style={styles.centerContainer}>
          <Text style={styles.error}>Error loading: {err || "No DSL found"}</Text>
          <Button title="Retry" onPress={loadDSL} />
          <TouchableOpacity style={styles.tokenButton} onPress={printDeviceToken}>
            <Text style={styles.tokenButtonText}>📱 Print Device Token</Text>
          </TouchableOpacity>
        </View>
      </SafeArea>
    );

  // ---------------------------------------------------------
  // ⭐ IMPORTANT FIX: SORT HEADERS IN CORRECT ORDER
  // ---------------------------------------------------------
  const sortedSections = [...(dsl.sections || [])].sort((a, b) => {
    const A = a?.properties?.component?.const || "";
    const B = b?.properties?.component?.const || "";

    // 1️⃣ Top Header
    if (A === "header") return -1;
    if (B === "header") return 1;

    // 2️⃣ Header 2 (mobile variant)
    if (A === "header_2" || A === "header_2_mobile") return -1;
    if (B === "header_2" || B === "header_2_mobile") return 1;

    return 0;
  });

  // --------------------------------------------------------------------

  return (
    <SafeArea>
      <View style={{ flex: 1 }}>
        {/* DEV HEADER */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            Currently using: <Text style={{ fontWeight: "bold" }}>LIVE DATA</Text>
          </Text>

          <TouchableOpacity style={styles.tokenButton} onPress={printDeviceToken}>
            <Text style={styles.tokenButtonText}>📱 Print Device Token</Text>
          </TouchableOpacity>
        </View>

        {/* RENDER SORTED DSL COMPONENTS */}
        <ScrollView
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {sortedSections.map((s, i) => (
            <DynamicRenderer key={i} section={s} />
          ))}
        </ScrollView>
      </View>
    </SafeArea>
  );
}

// -----------------------------------------------------

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  toggleContainer: {
    padding: 15,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
    alignItems: "center",
  },
  tokenButton: {
    backgroundColor: "#6c757d",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
    width: "80%",
  },
  tokenButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  toggleText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 14,
    color: "#6c757d",
  },
  loading: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
  },
  error: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
    color: "red",
  },
});


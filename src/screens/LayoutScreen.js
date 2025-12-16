import React, { useEffect, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, View, StyleSheet, Button } from "react-native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";

export default function LayoutScreen() {
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const versionRef = useRef(null);

  // Reload DSL
  const refreshDSL = async () => {
    try {
      const dslData = await fetchDSL();
      if (dslData?.dsl) {
        setDsl(dslData.dsl);
        versionRef.current = dslData.versionNumber ?? null;
      }
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
      if (!dslData?.dsl) {
        setErr("No live DSL returned from server");
        return;
      }

      setDsl(dslData.dsl);
      versionRef.current = dslData.versionNumber ?? null;

      console.log(
        `================ LIVE DSL OUTPUT ================\n`,
        JSON.stringify(dslData.dsl, null, 2),
        "\n================================================="
      );

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

  // Auto-refresh DSL periodically to pick up newly published versions
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL();
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;

        if (incomingVersion !== versionRef.current) {
          setDsl(latest.dsl);
          versionRef.current = incomingVersion;
        }
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  // LOADING SCREEN
  if (loading)
    return (
      <SafeArea>
        <View style={styles.centerContainer}>
          <Text style={styles.loading}>Loading Live Data...</Text>
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
        </View>
      </SafeArea>
    );

  // ---------------------------------------------------------
  // ⭐ IMPORTANT FIX: SORT HEADERS IN CORRECT ORDER
  // ---------------------------------------------------------
  const mobileSections = (dsl?.sections || []).filter(shouldRenderSectionOnMobile);

  const sortedSections = [...mobileSections].sort((a, b) => {
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


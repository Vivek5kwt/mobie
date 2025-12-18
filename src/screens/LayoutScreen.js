import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, StyleSheet, Button, TouchableOpacity } from "react-native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";

export default function LayoutScreen() {
  const navigation = useNavigation();
  const { session, logout } = useAuth();
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

  const handleLogout = async () => {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Auth" }] });
  };

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
        <View style={styles.loaderBackdrop}>
          <View style={styles.loaderCard}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loaderText}>Preparing your experience…</Text>
          </View>
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
      <View style={styles.screen}>
        {/* RENDER SORTED DSL COMPONENTS */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.topBar}>
            <View>
              <Text style={styles.welcomeTitle}>Workspace</Text>
              <Text style={styles.welcomeSubtitle}>
                Signed in as {session?.user?.name || session?.user?.email || "Guest"}
              </Text>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {sortedSections.length ? (
            sortedSections.map((s, i) => (
              <View key={i} style={styles.sectionWrapper}>
                <DynamicRenderer section={s} />
              </View>
            ))
          ) : (
            <View style={styles.centerContainer}>
              <Text style={styles.subtle}>No content available right now.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeArea>
  );
}

// -----------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  welcomeSubtitle: {
    color: "#6B7280",
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "700",
  },
  sectionWrapper: {
    marginBottom: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loaderBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0E1023",
  },
  loaderCard: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 20,
    alignItems: "center",
    gap: 12,
  },
  loaderText: {
    color: "#E5E7EB",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  error: {
    textAlign: "center",
    marginBottom: 20,
    fontSize: 16,
    color: "red",
  },
  subtle: {
    fontSize: 14,
    color: "#666",
  },
});


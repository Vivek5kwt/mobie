import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View, StyleSheet, Button } from "react-native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";
import SideNavigation from "../components/SideNavigation";
import { SideMenuProvider } from "../services/SideMenuContext";

export default function LayoutScreen() {
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", type: "info" });
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const versionRef = useRef(null);
  const snackbarTimer = useRef(null);

  const mobileSections = useMemo(
    () => (dsl?.sections || []).filter(shouldRenderSectionOnMobile),
    [dsl]
  );

  const sortedSections = useMemo(() => {
    const sectionsCopy = [...mobileSections];

    return sectionsCopy.sort((a, b) => {
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
  }, [mobileSections]);

  const sideNavSection = useMemo(
    () =>
      sortedSections.find(
        (section) => section?.properties?.component?.const?.toLowerCase() === "side_navigation"
      ) || null,
    [sortedSections]
  );

  const visibleSections = useMemo(
    () =>
      sortedSections.filter(
        (section) => section?.properties?.component?.const?.toLowerCase() !== "side_navigation"
      ),
    [sortedSections]
  );

  const showSnackbar = (message, type = "info") => {
    setSnackbar({ visible: true, message, type });

    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);

    snackbarTimer.current = setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  useEffect(() => {
    return () => {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    };
  }, []);

  // Reload DSL
  const refreshDSL = async (withFeedback = false) => {
    try {
      const dslData = await fetchDSL();
      if (dslData?.dsl) {
        setDsl(dslData.dsl);
        versionRef.current = dslData.versionNumber ?? null;
        if (withFeedback) showSnackbar("Live layout refreshed", "success");
      }
    } catch (e) {
      console.log("❌ Refresh error:", e);
      if (withFeedback) showSnackbar("Couldn't refresh right now", "error");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDSL(true);
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
      showSnackbar("We hit a snag loading your workspace", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDSL();
  }, []);

  const closeSideMenu = () => setIsSideMenuOpen(false);

  const openSideMenu = () => {
    if (sideNavSection) {
      setIsSideMenuOpen(true);
    }
  };

  const toggleSideMenu = () => {
    if (!sideNavSection) return;
    setIsSideMenuOpen((prev) => !prev);
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

  return (
    <SafeArea>
      <SideMenuProvider
        value={{
          isOpen: isSideMenuOpen,
          hasSideNav: !!sideNavSection,
          toggleSideMenu,
          openSideMenu,
          closeSideMenu,
        }}
      >
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
            {visibleSections.length ? (
              visibleSections.map((s, i) => (
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

          {sideNavSection && isSideMenuOpen && (
            <View style={styles.sideMenuOverlay}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeSideMenu} />
              <View style={styles.sideMenuContainer}>
                <SideNavigation section={sideNavSection} />
              </View>
            </View>
          )}

          {snackbar.visible && (
            <View
              style={[
                styles.snackbar,
                snackbar.type === "success" ? styles.snackbarSuccess : styles.snackbarError,
              ]}
            >
              <Text style={styles.snackbarText}>{snackbar.message}</Text>
              <TouchableOpacity onPress={() => setSnackbar((prev) => ({ ...prev, visible: false }))}>
                <Text style={styles.snackbarAction}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SideMenuProvider>
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
  sectionWrapper: {
    marginBottom: 10,
  },
  sideMenuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  sideMenuContainer: {
    width: 280,
    maxWidth: "80%",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 8,
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
  snackbar: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 8,
  },
  snackbarSuccess: {
    backgroundColor: "#0F172A",
    borderColor: "#22C55E",
    borderWidth: 1,
  },
  snackbarError: {
    backgroundColor: "#0F172A",
    borderColor: "#F87171",
    borderWidth: 1,
  },
  snackbarText: {
    color: "#E5E7EB",
    fontWeight: "600",
    flex: 1,
    marginRight: 16,
  },
  snackbarAction: {
    color: "#A5B4FC",
    fontWeight: "700",
  },
});


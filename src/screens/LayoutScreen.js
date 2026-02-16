import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  StyleSheet,
  Button,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DynamicRenderer from "../engine/DynamicRenderer";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";
import SideNavigation from "../components/SideNavigation";
import { SideMenuProvider } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";

export default function LayoutScreen({ route }) {
  const { session } = useAuth();
  const pageName = route?.params?.pageName || "home";
  const appId = useMemo(
    () =>
      resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeHeaderSections, setHomeHeaderSections] = useState([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", type: "info" });
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const versionRef = useRef(null);
  const snackbarTimer = useRef(null);
  const SIDE_MENU_WIDTH = 280;
  const sideMenuTranslateX = useRef(new Animated.Value(-SIDE_MENU_WIDTH)).current;

  const getComponentName = (section) =>
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    "";
  const isHeader2Section = (section) => getComponentName(section).toLowerCase() === "header_2";
  const normalizedPageName =
    typeof pageName === "string"
      ? pageName.trim().toLowerCase()
      : String(pageName ?? "").trim().toLowerCase();
  const isHomePage = normalizedPageName === "home";

  const mobileSections = useMemo(
    () => (dsl?.sections || []).filter(shouldRenderSectionOnMobile),
    [dsl]
  );

  const headerComponentNames = useMemo(
    () => new Set(["header", "header_2", "header_mobile"]),
    []
  );

  const extractHeaderSections = useCallback(
    (incomingDsl) =>
      (incomingDsl?.sections || []).filter((section) =>
        headerComponentNames.has(getComponentName(section).toLowerCase())
      ),
    [headerComponentNames]
  );

  const ensureHeaderSections = useCallback(
    (incomingDsl, fallbackHeaders) => {
      if (!incomingDsl || !Array.isArray(incomingDsl.sections)) return incomingDsl;
      const existingHeaders = extractHeaderSections(incomingDsl);
      if (existingHeaders.length) return incomingDsl;
      if (!fallbackHeaders || !fallbackHeaders.length) return incomingDsl;
      return {
        ...incomingDsl,
        sections: [...fallbackHeaders, ...incomingDsl.sections],
      };
    },
    [extractHeaderSections]
  );

  const hasPrimaryHeader = useMemo(
    () =>
      mobileSections.some((section) => {
        const component = getComponentName(section).toLowerCase();
        return component === "header" || component === "header_mobile";
      }),
    [mobileSections]
  );
  const hasHeader2 = useMemo(
    () =>
      mobileSections.some(
        (section) => getComponentName(section).toLowerCase() === "header_2"
      ),
    [mobileSections]
  );

  const sortedSections = useMemo(() => {
    const sectionsCopy = mobileSections.filter((section) => {
      const component = getComponentName(section).toLowerCase();
      if (!isHomePage && component === "header_2") return false;
      if (component !== "header_2") return true;
      return isHomePage || !hasPrimaryHeader;
    });

    return sectionsCopy.sort((a, b) => {
      const A = getComponentName(a);
      const B = getComponentName(b);

      // 1️⃣ Top Header
      if (A === "header") return -1;
      if (B === "header") return 1;

      // 2️⃣ Header 2
      if (A === "header_2") return -1;
      if (B === "header_2") return 1;

      return 0;
    });
  }, [hasHeader2, hasPrimaryHeader, isHomePage, mobileSections]);

  const sideNavSection = useMemo(
    () =>
      (dsl?.sections || []).find(
        (section) => getComponentName(section).toLowerCase() === "side_navigation"
      ) || null,
    [dsl]
  );

  const bottomNavSection = useMemo(
    () =>
      sortedSections.find(
        (section) => {
          const component = getComponentName(section).toLowerCase();
          return [
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component);
        }
      ) || null,
    [sortedSections]
  );

  const visibleSections = useMemo(
    () =>
      sortedSections.filter(
        (section) => {
          const component = getComponentName(section).toLowerCase();
          return ![
            "side_navigation",
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component);
        }
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

  const ensureBottomNavigationSection = (incomingDsl) => {
    if (!incomingDsl || !Array.isArray(incomingDsl.sections)) return incomingDsl;

    const hasBottomNavigation = incomingDsl.sections.some(
      (section) => {
        const component = section?.properties?.component?.const?.toLowerCase();
        return [
          "bottom_navigation",
          "bottom_navigation_style_1",
          "bottom_navigation_style_2",
        ].includes(component);
      }
    );

    if (hasBottomNavigation) return incomingDsl;

    return {
      ...incomingDsl,
      sections: [...incomingDsl.sections, bottomNavigationStyle1Section],
    };
  };

  const loadHomeHeaderSections = useCallback(async () => {
    if (isHomePage) {
      setHomeHeaderSections([]);
      return;
    }

    try {
      const homeDslData = await fetchDSL(appId, "home");
      const headers = extractHeaderSections(homeDslData?.dsl || {}).filter(
        (section) => !isHeader2Section(section)
      );
      setHomeHeaderSections(headers);
    } catch (e) {
      console.log("❌ Failed to fetch home header sections:", e);
      setHomeHeaderSections([]);
    }
  }, [appId, extractHeaderSections, isHomePage]);

  useEffect(() => {
    loadHomeHeaderSections();
  }, [loadHomeHeaderSections]);

  useEffect(() => {
    return () => {
      if (snackbarTimer.current) clearTimeout(snackbarTimer.current);
    };
  }, []);

  // Reload DSL
  const refreshDSL = async (withFeedback = false) => {
    try {
      const dslData = await fetchDSL(appId, pageName);
      if (dslData?.dsl) {
        const baseDsl = ensureBottomNavigationSection(dslData.dsl);
        const nextDsl = isHomePage
          ? baseDsl
          : ensureHeaderSections(baseDsl, homeHeaderSections);
        setDsl(nextDsl);
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

      const dslData = await fetchDSL(appId, pageName);
      if (!dslData?.dsl) {
        setErr("No live DSL returned from server");
        return;
      }

      const baseDsl = ensureBottomNavigationSection(dslData.dsl);
      const nextDsl = isHomePage
        ? baseDsl
        : ensureHeaderSections(baseDsl, homeHeaderSections);
      setDsl(nextDsl);
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
  }, [appId, pageName]);

  useEffect(() => {
    setIsSideMenuOpen(false);
    sideMenuTranslateX.setValue(-SIDE_MENU_WIDTH);
  }, [SIDE_MENU_WIDTH, pageName, sideMenuTranslateX]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setIsSideMenuOpen(false);
        sideMenuTranslateX.setValue(-SIDE_MENU_WIDTH);
      };
    }, [SIDE_MENU_WIDTH, sideMenuTranslateX])
  );

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

  useEffect(() => {
    Animated.spring(sideMenuTranslateX, {
      toValue: isSideMenuOpen ? 0 : -SIDE_MENU_WIDTH,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [SIDE_MENU_WIDTH, isSideMenuOpen, sideMenuTranslateX]);

  const overlayOpacity = sideMenuTranslateX.interpolate({
    inputRange: [-SIDE_MENU_WIDTH, 0],
    outputRange: [0, 0.35],
    extrapolate: "clamp",
  });

  const showOverlay = isSideMenuOpen;

  // Auto-refresh DSL periodically to pick up newly published versions
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, pageName);
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;

        if (incomingVersion !== versionRef.current) {
          const baseDsl = ensureBottomNavigationSection(latest.dsl);
          const nextDsl = isHomePage
            ? baseDsl
            : ensureHeaderSections(baseDsl, homeHeaderSections);
          setDsl(nextDsl);
          versionRef.current = incomingVersion;
        }
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName]);

  const fallbackBottomNavSection = bottomNavSection || bottomNavigationStyle1Section;

  // LOADING SCREEN
  if (loading)
    return (
      <SafeArea>
        <View style={styles.screen}>
          <View style={[styles.loaderBackdrop, styles.loaderOverlay]}>
            <View style={styles.loaderCard}>
              <ActivityIndicator size="large" color="#4F46E5" />
              <Text style={styles.loaderText}>Preparing your experience…</Text>
            </View>
          </View>
          {fallbackBottomNavSection && (
            <View style={styles.bottomNav}>
              <DynamicRenderer section={fallbackBottomNavSection} />
            </View>
          )}
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
            contentContainerStyle={[
              styles.scrollContent,
              { flexGrow: 1, paddingBottom: bottomNavSection ? 88 : 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {visibleSections.length ? (
              visibleSections.map((s, i) => {
                const componentName = getComponentName(s).toLowerCase();
                const nextComponentName = visibleSections[i + 1]
                  ? getComponentName(visibleSections[i + 1]).toLowerCase()
                  : null;
                const collapseHeaderGap =
                  componentName === "header" && nextComponentName === "header_2";
                const shouldAttachBottomNav =
                  componentName === "header" ||
                  componentName === "header_2" ||
                  componentName === "header_mobile";
                const sectionWithNav = shouldAttachBottomNav
                  ? { ...s, bottomNavSection }
                  : s;

                return (
                  <View
                    key={i}
                    style={[
                      styles.sectionWrapper,
                      (componentName === "header_2" || collapseHeaderGap) &&
                        styles.sectionWrapperTight,
                    ]}
                  >
                    <DynamicRenderer section={sectionWithNav} />
                  </View>
                );
              })
            ) : (
              <View style={styles.centerContainer}>
                <Text style={styles.subtle}>No content available right now.</Text>
              </View>
            )}
          </ScrollView>

          {sideNavSection && showOverlay && (
            <View style={StyleSheet.absoluteFill} pointerEvents={showOverlay ? "auto" : "none"}>
              <Animated.View
                style={[StyleSheet.absoluteFill, styles.sideMenuOverlay, { opacity: overlayOpacity }]}
                pointerEvents="none"
              />
              <View style={{ flex: 1, flexDirection: "row" }}>
                <Animated.View
                  style={[
                    styles.sideMenuContainer,
                    { transform: [{ translateX: sideMenuTranslateX }] },
                  ]}
                >
                  <SideNavigation section={sideNavSection} />
                </Animated.View>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSideMenu} />
              </View>
            </View>
          )}

          {bottomNavSection && (
            <View style={styles.bottomNav}>
              <DynamicRenderer section={bottomNavSection} />
            </View>
          )}

          {snackbar.visible && (
            <View
              style={[
                styles.snackbar,
                snackbar.type === "success"
                  ? styles.snackbarSuccess
                  : snackbar.type === "info"
                    ? styles.snackbarInfo
                    : styles.snackbarError,
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
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionWrapper: {
    marginBottom: 10,
  },
  sectionWrapperTight: {
    marginBottom: 0,
  },
  sideMenuOverlay: {
    backgroundColor: "rgba(0,0,0,0.3)",
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
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  snackbarInfo: {
    backgroundColor: "#0F172A",
    borderColor: "#60A5FA",
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

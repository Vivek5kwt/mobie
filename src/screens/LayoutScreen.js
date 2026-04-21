import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import SkeletonLoader from "../components/SkeletonLoader";
import HeaderDefault from "../components/HeaderDefault";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";
import SideNavigation from "../components/SideNavigation";
import { SideMenuProvider } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import header2Section from "../data/header2Section";
import BottomNavigation from "../components/BottomNavigation";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { setHeaderDefault } from "../services/headerDefaultService";

// ── Module-level cache ────────────────────────────────────────────────────────
// Survives re-mounts within the same JS session.
// Key: "<appId>:<pageName>"  Value: { dsl, bottomNavSection, headerDefaultConfig }
// This prevents a blank screen + missing bottom nav when LayoutScreen remounts
// (e.g. tapping Home tab causes navigate() to push a new instance on some paths).
const _pageCache = {};

function _cacheKey(appId, pageName) {
  return `${appId}:${String(pageName || "home").trim().toLowerCase()}`;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function LayoutScreen({ route }) {
  const { session } = useAuth();
  const pageName = route?.params?.pageName || "home";
  const normalizedPageName =
    typeof pageName === "string"
      ? pageName.trim().toLowerCase()
      : String(pageName ?? "").trim().toLowerCase();
  const isHomePage = normalizedPageName === "home";
  
  // Bottom nav active tab: home = 0, others from params so bar highlights the right tab
  const activeIndexFromRoute = route?.params?.activeIndex;
  const activeIndex =
    isHomePage ? 0 : (activeIndexFromRoute !== undefined && activeIndexFromRoute !== null ? Number(activeIndexFromRoute) : undefined);
  
  const appId = useMemo(
    () =>
      resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  // Read from module-level cache so remounts show content instantly (no blank screen)
  const cacheKey = _cacheKey(appId, normalizedPageName);
  const cached = _pageCache[cacheKey] ?? null;

  const [dsl, setDsl] = useState(() => cached?.dsl ?? null);
  const [headerDefaultConfig, setHeaderDefaultConfig] = useState(() => cached?.headerDefaultConfig ?? null);
  // Only show loading spinner on first mount when there is no cached content
  const [loading, setLoading] = useState(() => !cached?.dsl);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeHeaderSections, setHomeHeaderSections] = useState([]);
  const [snackbar, setSnackbar] = useState({ visible: false, message: "", type: "info" });
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const versionRef = useRef(null);
  const snackbarTimer = useRef(null);
  const SIDE_MENU_WIDTH = 280;
  const sideMenuTranslateX = useRef(new Animated.Value(-SIDE_MENU_WIDTH)).current;
  // Store bottom navigation section separately to prevent it from refreshing
  const bottomNavSectionRef = useRef(null);
  // Initialize bottom nav from cache immediately — never shows blank on remount
  const [stableBottomNavSection, setStableBottomNavSection] = useState(() => cached?.bottomNavSection ?? null);

  useEffect(() => {
    if (__DEV__) {
      console.log("[LayoutScreen] mount (home). No remount expected when tapping Home tab.");
      return () => console.log("[LayoutScreen] unmount");
    }
  }, []);

  const getComponentName = (section) =>
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    "";
  const isHeader2Section = (section) => getComponentName(section).toLowerCase() === "header_2";

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

  // Helper function to deep compare two objects (simple JSON stringify comparison)
  const deepEqual = (obj1, obj2) => {
    try {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch {
      return false;
    }
  };

  // Initialize bottom nav section on first load only - never recalculate
  useEffect(() => {
    if (!bottomNavSectionRef.current && sortedSections.length > 0) {
      const found = sortedSections.find(
        (section) => {
          const component = getComponentName(section).toLowerCase();
          return [
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component);
        }
      );
      if (found) {
        bottomNavSectionRef.current = found;
      }
    }
  }, []); // Only run once on mount - never recalculate

  // Check if headerdefault config is enabled (same logic as HeaderDefault component)
  const isHeaderDefaultEnabled = useMemo(() => {
    if (!headerDefaultConfig) return false;
    const cfg = headerDefaultConfig;
    const raw = cfg?.enabled;
    const v = (raw && typeof raw === "object")
      ? (raw.value ?? raw.const ?? raw)
      : raw;
    return v === true || v === "true" || v === 1;
  }, [headerDefaultConfig]);

  const visibleSections = useMemo(
    () =>
      sortedSections.filter(
        (section) => {
          const component = getComponentName(section).toLowerCase();
          if ([
            "side_navigation",
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component)) return false;
          // When HeaderDefault is active on home page, suppress plain DSL header to avoid double bar
          // header_2 is a different widget (greeting + search + profile) — keep it visible
          if (isHomePage && isHeaderDefaultEnabled && ["header", "header_mobile"].includes(component)) return false;
          return true;
        }
      ),
    [sortedSections, isHomePage, isHeaderDefaultEnabled]
  );

  const showSnackbar = (message, type = "info") => {
    setSnackbar({ visible: true, message, type });

    if (snackbarTimer.current) clearTimeout(snackbarTimer.current);

    snackbarTimer.current = setTimeout(() => {
      setSnackbar((prev) => ({ ...prev, visible: false }));
    }, 3200);
  };

  // Keep DSL exactly as returned from the server.
  // Do NOT inject a local default bottom navigation; the bar should only come from live JSON.
  const ensureBottomNavigationSection = (incomingDsl) => incomingDsl;

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
      // When home has no headers, use Header 2 (logo bar) so mobile still shows a header
      setHomeHeaderSections(headers.length ? headers : [header2Section]);
    } catch (e) {
      console.log("❌ Failed to fetch home header sections:", e);
      setHomeHeaderSections([header2Section]);
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

  // Reload DSL - bottom navigation will update dynamically if JSON changes
  const refreshDSL = async (withFeedback = false) => {
    try {
      const dslData = await fetchDSL(appId, pageName);
      if (dslData?.dsl) {
        // Check if bottom navigation section has changed
        const incomingBottomNav = (dslData.dsl.sections || []).find(
          (section) => {
            const component = getComponentName(section).toLowerCase();
            return [
              "bottom_navigation",
              "bottom_navigation_style_1",
              "bottom_navigation_style_2",
            ].includes(component);
          }
        );
        
        // If bottom nav section exists and is different, update the cache and state
        // But DON'T update DSL to prevent home screen refresh
        let bottomNavUpdated = false;
        if (incomingBottomNav) {
          if (!bottomNavSectionRef.current || !deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
            bottomNavSectionRef.current = incomingBottomNav;
            setStableBottomNavSection(incomingBottomNav); // Update state to trigger re-render of bottom nav only
            bottomNavUpdated = true;
            console.log("🔄 Bottom navigation updated from JSON");
            // Don't update DSL here - only update the cache and state
            // The bottom nav will update via state, but home screen won't refresh
          }
        }
        
        // Only update DSL if bottom nav didn't change
        // This prevents home screen from refreshing when only bottom nav updates
        if (!bottomNavUpdated) {
          // Remove bottom nav from sections to prevent it from affecting the refresh
          const sectionsWithoutBottomNav = (dslData.dsl.sections || []).filter(
            (section) => {
              const component = getComponentName(section).toLowerCase();
              return ![
                "bottom_navigation",
                "bottom_navigation_style_1",
                "bottom_navigation_style_2",
              ].includes(component);
            }
          );
          
          const dslWithoutBottomNav = {
            ...dslData.dsl,
            sections: sectionsWithoutBottomNav,
          };
          
          const baseDsl = ensureBottomNavigationSection(dslWithoutBottomNav);
          const nextDsl = isHomePage
            ? baseDsl
            : ensureHeaderSections(baseDsl, homeHeaderSections);
          setDsl(nextDsl);
          if (dslData.dsl?.headerdefault !== undefined) {
            setHeaderDefault(dslData.dsl.headerdefault);
            setHeaderDefaultConfig(dslData.dsl.headerdefault);
          }
        }
        versionRef.current = dslData.versionNumber ?? null;

        // Keep module-level cache in sync so future remounts are instant
        _pageCache[cacheKey] = {
          ..._pageCache[cacheKey],
          dsl: _pageCache[cacheKey]?.dsl ?? null,
          bottomNavSection: bottomNavUpdated
            ? bottomNavSectionRef.current
            : (_pageCache[cacheKey]?.bottomNavSection ?? null),
        };
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
      // Only show spinner if there is no cached content to show yet
      if (!_pageCache[cacheKey]?.dsl) {
        setLoading(true);
      }
      setErr(null);

      const dslData = await fetchDSL(appId, pageName);
      if (!dslData?.dsl) {
        const graphqlUrl = "https://app.mobidrag.com/graphql";
        setErr(`No live DSL returned from server\nApp ID: ${appId}\nURL: ${graphqlUrl}`);
        return;
      }

      const baseDsl = ensureBottomNavigationSection(dslData.dsl);
      const nextDsl = isHomePage
        ? baseDsl
        : ensureHeaderSections(baseDsl, homeHeaderSections);
      setDsl(nextDsl);
      const hdrDefault = dslData.dsl?.headerdefault;
      if (hdrDefault !== undefined) {
        setHeaderDefault(hdrDefault);
        setHeaderDefaultConfig(hdrDefault);
      }
      versionRef.current = dslData.versionNumber ?? null;
      // Seed the fingerprint so the first interval poll doesn't falsely detect a change
      sectionsFpRef.current = (nextDsl.sections || [])
        .map((s) => getComponentName(s))
        .filter(Boolean)
        .join(",");

      // Cache the bottom navigation section on initial load
      const bottomNav = (nextDsl.sections || []).find(
        (section) => {
          const component = getComponentName(section).toLowerCase();
          return [
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component);
        }
      );
      if (bottomNav) {
        bottomNavSectionRef.current = bottomNav;
        setStableBottomNavSection(bottomNav);
      }

      // ── Persist to module-level cache so remounts show instantly ──
      _pageCache[cacheKey] = {
        dsl: nextDsl,
        bottomNavSection: bottomNav ?? _pageCache[cacheKey]?.bottomNavSection ?? null,
        headerDefaultConfig: hdrDefault !== undefined ? hdrDefault : (_pageCache[cacheKey]?.headerDefaultConfig ?? null),
      };

      if (__DEV__) {
        console.log(`================ LIVE DSL OUTPUT ================`);
      }

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

  // ── Single auto-refresh interval ─────────────────────────────────────────
  // Polls every 3 seconds. Detects changes via version number OR section
  // fingerprint (component list) so updates fire even when versionNumber is null.
  const sectionsFpRef = useRef(null);

  useEffect(() => {
    const getSectionsFp = (dsl) =>
      (dsl?.sections || [])
        .map((s) => getComponentName(s))
        .filter(Boolean)
        .join(",");

    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, pageName);
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;
        const incomingFp = getSectionsFp(latest.dsl);

        // Detect change: version differs OR section fingerprint differs
        const versionChanged = incomingVersion !== null && incomingVersion !== versionRef.current;
        const contentChanged = incomingFp !== sectionsFpRef.current;

        // 1) Always check bottom nav — update independently of content change
        const incomingBottomNav = (latest.dsl.sections || []).find((section) => {
          const component = getComponentName(section).toLowerCase();
          return [
            "bottom_navigation",
            "bottom_navigation_style_1",
            "bottom_navigation_style_2",
          ].includes(component);
        });

        if (incomingBottomNav && !deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
          bottomNavSectionRef.current = incomingBottomNav;
          setStableBottomNavSection(incomingBottomNav);
          console.log("🔄 Bottom navigation updated from JSON");
        }

        // 2) Refresh page DSL when anything changed
        if (versionChanged || contentChanged) {
          const sectionsWithoutBottomNav = (latest.dsl.sections || []).filter((section) => {
            const component = getComponentName(section).toLowerCase();
            return ![
              "bottom_navigation",
              "bottom_navigation_style_1",
              "bottom_navigation_style_2",
            ].includes(component);
          });
          const nextDsl = isHomePage
            ? { ...latest.dsl, sections: sectionsWithoutBottomNav }
            : ensureHeaderSections(
                { ...latest.dsl, sections: sectionsWithoutBottomNav },
                homeHeaderSections
              );
          setDsl(nextDsl);
          if (latest.dsl?.headerdefault !== undefined) {
            setHeaderDefault(latest.dsl.headerdefault);
            setHeaderDefaultConfig(latest.dsl.headerdefault);
          }
          versionRef.current = incomingVersion;
          sectionsFpRef.current = incomingFp;
          console.log("🔄 DSL auto-refreshed (version:", incomingVersion, ")");
        }
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      }
    }, 30000); // 30s — aggressive 3s polling caused infinite re-render loop

    return () => clearInterval(intervalId);
  }, [appId, pageName, isHomePage, ensureHeaderSections, homeHeaderSections]);

  // Keep a ref to the latest refreshDSL so useFocusEffect doesn't re-subscribe on every render
  const refreshDSLRef = useRef(null);
  refreshDSLRef.current = refreshDSL;

  useFocusEffect(
    useCallback(() => {
      // Auto-refresh layout when screen gains focus (e.g. after saving on web)
      refreshDSLRef.current?.(false);
      // Do not forcibly close side menu here; let user control it
      return undefined;
    }, []) // Empty deps — only re-runs when screen gains focus, not on every render
  );

  const closeSideMenu = () => {
    if (__DEV__) console.log("[SideMenu] close (LayoutScreen)");
    setIsSideMenuOpen(false);
  };

  const openSideMenu = () => {
    if (__DEV__) console.log("[SideMenu] open (LayoutScreen)");
    setIsSideMenuOpen(true);
  };

  const toggleSideMenu = () => {
    setIsSideMenuOpen((prev) => {
      const next = !prev;
      if (__DEV__) console.log("[SideMenu] toggle (LayoutScreen) ->", next);
      return next;
    });
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

  // (duplicate interval removed — single interval above handles all refresh logic)

  // Use only server-provided bottom navigation; never show local default.
  // This ensures the bottom bar design always matches the live JSON.
  const fallbackBottomNavSection = stableBottomNavSection;

  // Decide what to render in the main content area (above the bottom nav)
  let mainContent = null;

  if (loading) {
    mainContent = <SkeletonLoader />;
  } else if (err || !dsl) {
    // Error state: keep bottom nav, just show error in content area
    mainContent = (
      <View style={styles.centerContainer}>
        <Text style={styles.error}>
          Error loading: {err || "No DSL found"}
        </Text>
        <Button title="Retry" onPress={loadDSL} />
      </View>
    );
  } else {
    // Normal content with scroll + side menu overlay
    mainContent = (
      <>
        {/* RENDER SORTED DSL COMPONENTS */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          showsVerticalScrollIndicator
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: stableBottomNavSection ? 70 : 0 },
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {isHomePage && headerDefaultConfig && (
            <HeaderDefault
              config={headerDefaultConfig}
              bottomNavSection={stableBottomNavSection}
            />
          )}
          {visibleSections.length ? (
            visibleSections.map((s, i) => {
              const componentName = getComponentName(s).toLowerCase();
              const nextComponentName = visibleSections[i + 1]
                ? getComponentName(visibleSections[i + 1]).toLowerCase()
                : null;
              const collapseHeaderGap =
                componentName === "header" && nextComponentName === "header_2";
              const isBannerSlider = componentName === "banner_slider" || componentName === "hero_banner";
              const nextIsBannerSlider = nextComponentName === "banner_slider" || nextComponentName === "hero_banner";
              const collapseBannerGap = isBannerSlider || nextIsBannerSlider;
              const shouldAttachBottomNav =
                componentName === "header" ||
                componentName === "header_2" ||
                componentName === "header_mobile";
              const sectionWithNav = shouldAttachBottomNav
                ? { ...s, bottomNavSection: stableBottomNavSection }
                : s;

              return (
                <View
                  key={i}
                  style={[
                    styles.sectionWrapper,
                    (componentName === "header_2" || collapseHeaderGap || collapseBannerGap) &&
                      styles.sectionWrapperTight,
                    isBannerSlider && styles.sectionWrapperBanner,
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

        {showOverlay && (
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
                <SideNavigation section={sideNavSection || {}} />
              </Animated.View>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSideMenu} />
            </View>
          </View>
        )}
      </>
    );
  }

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
          {mainContent}

          {fallbackBottomNavSection && (
            <View style={styles.bottomNav}>
              <BottomNavigation
                section={fallbackBottomNavSection}
                activeIndexOverride={activeIndex}
              />
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
    paddingBottom: 0,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionWrapper: {
    marginBottom: 0,
  },
  sectionWrapperTight: {
    marginBottom: 0,
  },
  sectionWrapperBanner: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
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
    // Match the main screen background so Home doesn't flash a dark/black screen
    backgroundColor: "#F7F7F7",
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

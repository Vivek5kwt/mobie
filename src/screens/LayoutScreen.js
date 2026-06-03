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
  InteractionManager,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import DynamicRenderer from "../engine/DynamicRenderer";
import SkeletonLoader from "../components/SkeletonLoader";
import HeaderDefault from "../components/HeaderDefault";
import Snackbar from "../components/Snackbar";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import { SafeArea } from "../utils/SafeAreaHandler";
import SideNavigation, { getSideNavigationWidth } from "../components/SideNavigation";
import { SideMenuProvider } from "../services/SideMenuContext";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import header2Section from "../data/header2Section";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { setHeaderDefault } from "../services/headerDefaultService";
import { getHomeSectionMarginBottom } from "../utils/sectionSpacing";

// ── Module-level cache ────────────────────────────────────────────────────────
// Survives re-mounts within the same JS session.
// Key: "<appId>:<pageName>"  Value: { dsl, bottomNavSection, headerDefaultConfig }
// This prevents a blank screen + missing bottom nav when LayoutScreen remounts
// (e.g. tapping Home tab causes navigate() to push a new instance on some paths).
const _pageCache = {};
const LIVE_DSL_REFRESH_INTERVAL_MS = 3000;

function _cacheKey(appId, pageName) {
  return `${appId}:${String(pageName || "home").trim().toLowerCase()}`;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function LayoutScreen({ route, navigation }) {
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
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const versionRef = useRef(null);
  const lastLoginToastKeyRef = useRef(null);
  const dslRef = useRef(cached?.dsl ?? null);
  const loadingRef = useRef(!cached?.dsl);
  const dslRequestInFlightRef = useRef(false);
  const lastDslFetchAtRef = useRef(cached?.dsl ? Date.now() : 0);
  const DEFAULT_SIDE_MENU_WIDTH = 280;
  const sideMenuTranslateX = useRef(new Animated.Value(-DEFAULT_SIDE_MENU_WIDTH)).current;
  // Store bottom navigation section separately to prevent it from refreshing
  const bottomNavSectionRef = useRef(null);
  // Initialize bottom nav from cache immediately — never shows blank on remount
  const [stableBottomNavSection, setStableBottomNavSection] = useState(() => cached?.bottomNavSection ?? null);
  const [heavySectionsReady, setHeavySectionsReady] = useState(() => !isHomePage);

  useEffect(() => {
    dslRef.current = dsl;
    loadingRef.current = loading;
  }, [dsl, loading]);

  useEffect(() => {
    if (!isHomePage) {
      setHeavySectionsReady(true);
      return undefined;
    }

    let active = true;
    setHeavySectionsReady(false);
    const fallbackTimer = setTimeout(() => {
      if (active) setHeavySectionsReady(true);
    }, 650);
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      if (!active) return;
      clearTimeout(fallbackTimer);
      setHeavySectionsReady(true);
    });

    return () => {
      active = false;
      clearTimeout(fallbackTimer);
      interactionTask?.cancel?.();
    };
  }, [cacheKey, isHomePage]);

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
  const sideMenuWidth = useMemo(
    () => getSideNavigationWidth(sideNavSection, DEFAULT_SIDE_MENU_WIDTH),
    [sideNavSection]
  );

  // Helper function to deep compare two objects (simple JSON stringify comparison)
  const deepEqual = (obj1, obj2) => {
    try {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch {
      return false;
    }
  };

  const getDslFingerprint = useCallback((incomingDsl) => {
    try {
      return JSON.stringify({
        headerdefault: incomingDsl?.headerdefault ?? null,
        brandKit: incomingDsl?.brandKit ?? null,
        sections: incomingDsl?.sections || [],
      });
    } catch (_) {
      return [
        incomingDsl?.headerdefault ? "headerdefault" : "no-headerdefault",
        incomingDsl?.brandKit ? "brandKit" : "no-brandKit",
        (incomingDsl?.sections || []).map((section) => getComponentName(section)).join(","),
      ].join("|");
    }
  }, []);

  const isBottomNavigationSection = useCallback((section) => {
    const component = getComponentName(section).toLowerCase();
    return [
      "bottom_navigation",
      "bottom_navigation_style_1",
      "bottom_navigation_style_2",
    ].includes(component);
  }, []);

  const extractBottomNavigationSection = useCallback(
    (incomingDsl) => (incomingDsl?.sections || []).find(isBottomNavigationSection) || null,
    [isBottomNavigationSection]
  );

  const stripBottomNavigationSections = useCallback(
    (incomingDsl) => ({
      ...incomingDsl,
      sections: (incomingDsl?.sections || []).filter(
        (section) => !isBottomNavigationSection(section)
      ),
    }),
    [isBottomNavigationSection]
  );

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
  };

  useEffect(() => {
    const payload = route?.params?.loginSuccessToast;
    if (!payload) return;

    const message =
      (typeof payload === "string" ? payload : payload?.message) || "";
    const key =
      (typeof payload === "object" && payload?.key) ||
      message;
    if (!message || !key) return;
    if (lastLoginToastKeyRef.current === key) return;

    lastLoginToastKeyRef.current = key;
    showSnackbar(message, "success");

    if (navigation?.setParams) {
      try {
        navigation.setParams({ loginSuccessToast: undefined });
      } catch (_) {}
    }
  }, [route?.params?.loginSuccessToast, navigation]);

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

  // Reload DSL from the live Builder payload.
  const refreshDSL = async (withFeedback = false) => {
    if (dslRequestInFlightRef.current) return;
    dslRequestInFlightRef.current = true;
    lastDslFetchAtRef.current = Date.now();

    try {
      const dslData = await fetchDSL(appId, pageName);
      if (dslData?.dsl) {
        const incomingBottomNav = extractBottomNavigationSection(dslData.dsl);
        if (!deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
          bottomNavSectionRef.current = incomingBottomNav;
          setStableBottomNavSection(incomingBottomNav);
          console.log("Bottom navigation synced from JSON");
        }

        const baseDsl = ensureBottomNavigationSection(
          stripBottomNavigationSections(dslData.dsl)
        );
        const nextDsl = isHomePage
          ? baseDsl
          : ensureHeaderSections(baseDsl, homeHeaderSections);
        const hdrDefault = dslData.dsl?.headerdefault ?? null;

        setDsl(nextDsl);
        setHeaderDefault(hdrDefault);
        setHeaderDefaultConfig(hdrDefault);
        versionRef.current = dslData.versionNumber ?? null;
        sectionsFpRef.current = getDslFingerprint(dslData.dsl);

        _pageCache[cacheKey] = {
          dsl: nextDsl,
          bottomNavSection: incomingBottomNav,
          headerDefaultConfig: hdrDefault,
        };
      }
    } catch (e) {
      console.log("❌ Refresh error:", e);
      if (withFeedback) showSnackbar("Couldn't refresh right now", "error");
    } finally {
      dslRequestInFlightRef.current = false;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDSL(true);
    setRefreshing(false);
  };

  // Load DSL on mount
  const loadDSL = async () => {
    if (dslRequestInFlightRef.current) return;
    dslRequestInFlightRef.current = true;
    lastDslFetchAtRef.current = Date.now();

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

      const bottomNav = extractBottomNavigationSection(dslData.dsl);
      const baseDsl = ensureBottomNavigationSection(
        stripBottomNavigationSections(dslData.dsl)
      );
      const nextDsl = isHomePage
        ? baseDsl
        : ensureHeaderSections(baseDsl, homeHeaderSections);
      setDsl(nextDsl);
      const hdrDefault = dslData.dsl?.headerdefault ?? null;
      setHeaderDefault(hdrDefault);
      setHeaderDefaultConfig(hdrDefault);
      versionRef.current = dslData.versionNumber ?? null;
      // Seed the fingerprint so the first interval poll doesn't falsely detect a change
      sectionsFpRef.current = getDslFingerprint(dslData.dsl);

      if (!deepEqual(bottomNav, bottomNavSectionRef.current)) {
        bottomNavSectionRef.current = bottomNav;
        setStableBottomNavSection(bottomNav);
      }

      // ── Persist to module-level cache so remounts show instantly ──
      _pageCache[cacheKey] = {
        dsl: nextDsl,
        bottomNavSection: bottomNav,
        headerDefaultConfig: hdrDefault,
      };

      if (__DEV__) {
        console.log(`================ LIVE DSL OUTPUT ================`);
      }

    } catch (e) {
      setErr(e.message);
      console.log("❌ DSL LOAD ERROR >>>", e);
      showSnackbar("We hit a snag loading your workspace", "error");
    } finally {
      dslRequestInFlightRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDSL();
  }, [appId, pageName]);

  // ── Single auto-refresh interval ─────────────────────────────────────────
  // Polls the live Builder payload and compares the full DSL surface, so same-section
  // edits like spacing, images, product data, typography, and settings update too.
  const sectionsFpRef = useRef(null);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (dslRequestInFlightRef.current) return;
      dslRequestInFlightRef.current = true;
      lastDslFetchAtRef.current = Date.now();

      try {
        const latest = await fetchDSL(appId, pageName);
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;
        const incomingFp = getDslFingerprint(latest.dsl);

        // Detect change: version differs OR the actual DSL payload differs.
        const versionChanged = incomingVersion !== null && incomingVersion !== versionRef.current;
        const contentChanged = incomingFp !== sectionsFpRef.current;

        if (!versionChanged && !contentChanged) return;

        const incomingBottomNav = extractBottomNavigationSection(latest.dsl);
        if (!deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
          bottomNavSectionRef.current = incomingBottomNav;
          setStableBottomNavSection(incomingBottomNav);
          console.log("Bottom navigation synced from JSON");
        }

        const baseDsl = ensureBottomNavigationSection(
          stripBottomNavigationSections(latest.dsl)
        );
        const nextDsl = isHomePage
          ? baseDsl
          : ensureHeaderSections(baseDsl, homeHeaderSections);
        const hdrDefault = latest.dsl?.headerdefault ?? null;

        setDsl(nextDsl);
        setHeaderDefault(hdrDefault);
        setHeaderDefaultConfig(hdrDefault);
        versionRef.current = incomingVersion;
        sectionsFpRef.current = incomingFp;

        _pageCache[cacheKey] = {
          dsl: nextDsl,
          bottomNavSection: incomingBottomNav,
          headerDefaultConfig: hdrDefault,
        };

        console.log("DSL auto-refreshed (version:", incomingVersion, ")");
      } catch (e) {
        console.log("❌ Auto-refresh error:", e);
      } finally {
        dslRequestInFlightRef.current = false;
      }
    }, LIVE_DSL_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [
    appId,
    cacheKey,
    extractBottomNavigationSection,
    getDslFingerprint,
    homeHeaderSections,
    isHomePage,
    pageName,
    stripBottomNavigationSections,
    ensureHeaderSections,
  ]);

  // Keep a ref to the latest refreshDSL so useFocusEffect doesn't re-subscribe on every render
  const refreshDSLRef = useRef(null);
  refreshDSLRef.current = refreshDSL;

  useFocusEffect(
    useCallback(() => {
      // Auto-refresh layout when screen gains focus (e.g. after saving on web)
      if (
        !dslRef.current ||
        loadingRef.current ||
        Date.now() - lastDslFetchAtRef.current < LIVE_DSL_REFRESH_INTERVAL_MS
      ) {
        return undefined;
      }
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
      toValue: isSideMenuOpen ? 0 : -sideMenuWidth,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [isSideMenuOpen, sideMenuTranslateX, sideMenuWidth]);

  const overlayOpacity = sideMenuTranslateX.interpolate({
    inputRange: [-sideMenuWidth, 0],
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
        {/* HeaderDefault is rendered OUTSIDE the ScrollView so it stays
            fixed at the top while the rest of the page scrolls beneath it */}
        {isHomePage && headerDefaultConfig && (
          <HeaderDefault
            config={headerDefaultConfig}
            bottomNavSection={stableBottomNavSection}
          />
        )}

        {/* RENDER SORTED DSL COMPONENTS */}
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}
          showsVerticalScrollIndicator
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: stableBottomNavSection ? bottomNavHeight : 0 },
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
              const nextSection = visibleSections[i + 1] || null;
              const collapseHeaderGap =
                componentName === "header" && nextComponentName === "header_2";
              const isBannerSlider = componentName === "banner_slider" || componentName === "hero_banner";
              const nextIsBannerSlider = nextComponentName === "banner_slider" || nextComponentName === "hero_banner";
              const collapseBannerGap = isBannerSlider || nextIsBannerSlider;
              const isProductSection = [
                "product_grid", "product_carousel",
                "tab_product_grid", "tab_product_carousel",
              ].includes(componentName);
              const isHeavyHomeSection = [
                "product_grid", "product_carousel",
                "tab_product_grid", "tab_product_carousel",
                "recent_products",
              ].includes(componentName);
              if (isHomePage && !heavySectionsReady && i > 3 && isHeavyHomeSection) {
                return null;
              }
              const shouldAttachBottomNav =
                componentName === "header" ||
                componentName === "header_2" ||
                componentName === "header_mobile";
              const sectionWithNav = shouldAttachBottomNav
                ? { ...s, bottomNavSection: stableBottomNavSection }
                : s;
              const homeSectionMarginBottom = isHomePage
                ? getHomeSectionMarginBottom({
                    section: s,
                    componentName,
                    nextComponentName,
                    nextSection,
                  })
                : undefined;

              return (
                <View
                  key={i}
                  style={[
                    styles.sectionWrapper,
                    !isHomePage && (componentName === "header_2" || collapseHeaderGap || collapseBannerGap) &&
                      styles.sectionWrapperTight,
                    !isHomePage && isBannerSlider && styles.sectionWrapperBanner,
                    !isHomePage && isProductSection && styles.sectionWrapperProduct,
                    isHomePage && { marginBottom: homeSectionMarginBottom },
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
                  { width: sideMenuWidth, maxWidth: sideMenuWidth, transform: [{ translateX: sideMenuTranslateX }] },
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
    <SafeArea edges={["top", "left", "right"]}>
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
            <View
              style={styles.bottomNav}
              onLayout={(event) => setBottomNavHeight(event.nativeEvent.layout.height)}
            >
              <BottomNavigation
                section={fallbackBottomNavSection}
                activeIndexOverride={activeIndex}
              />
            </View>
          )}

          <Snackbar
            visible={snackbar.visible}
            message={snackbar.message}
            type={snackbar.type}
            actionLabel="Dismiss"
            onAction={() => setSnackbar((prev) => ({ ...prev, visible: false }))}
            onDismiss={() => setSnackbar((prev) => ({ ...prev, visible: false }))}
          />
        </View>
      </SideMenuProvider>
    </SafeArea>
  );
}

// -----------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 0,
    paddingBottom: 0,
    backgroundColor: "#FFFFFF",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionWrapper: {
    width: "100%",
    alignSelf: "stretch",
    marginBottom: 0,
  },
  sectionWrapperTight: {
    marginBottom: 0,
  },
  sectionWrapperProduct: {
    marginBottom: 0,
  },
  sectionWrapperBanner: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: "transparent",
  },
  sideMenuOverlay: {
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sideMenuContainer: {
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
});

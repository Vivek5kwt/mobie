import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Animated, TouchableOpacity } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { SafeArea } from "../utils/SafeAreaHandler";
import BottomNavigation from "../components/BottomNavigation";
import SideNavigation from "../components/SideNavigation";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";
import SkeletonLoader from "../components/SkeletonLoader";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { SideMenuProvider } from "../services/SideMenuContext";
import { setHeaderDefault } from "../services/headerDefaultService";

export default function BottomNavScreen() {
  const route = useRoute();
  const { session } = useAuth();
  const title = route?.params?.title || "Page";
  const link = route?.params?.link || "";
  const pageName = route?.params?.pageName || link || title;
  // Only use the DSL-provided section — never fall back to hardcoded defaults
  // This ensures only tabs that exist in the JSON are shown
  const bottomNavSectionProp = route?.params?.bottomNavSection || null;
  const activeIndexFromParams = route?.params?.activeIndex;
  const appId = useMemo(
    () =>
      resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );
  const normalizedPageName =
    typeof pageName === "string"
      ? pageName.trim().toLowerCase()
      : String(pageName ?? "").trim().toLowerCase();
  const normalizedTitle =
    typeof title === "string"
      ? title.trim().toLowerCase()
      : String(title ?? "").trim().toLowerCase();
  const isCartPage = normalizedPageName.includes("cart") || normalizedTitle.includes("cart");
  const isNotificationPage =
    normalizedPageName.includes("notification") || normalizedTitle.includes("notification");
  const isSearchPage = normalizedPageName.includes("search") || normalizedTitle.includes("search");
  const isProfilePage =
    normalizedPageName.includes("profile") ||
    normalizedPageName.includes("account") ||
    normalizedTitle.includes("profile") ||
    normalizedTitle.includes("account");
  const isAutoRefreshPage = isCartPage || isNotificationPage || isSearchPage || isProfilePage;
  const isHomePage = normalizedPageName === "home";
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeHeaderSections, setHomeHeaderSections] = useState([]);
  // Mirror state in a ref so callbacks always read the latest value (no stale closures)
  const homeHeaderSectionsRef = useRef([]);
  const versionRef = useRef(null);
  // Store bottom navigation section separately to update dynamically
  const [bottomNavSection, setBottomNavSection] = useState(bottomNavSectionProp);
  const bottomNavSectionRef = useRef(bottomNavSectionProp);
  // Side menu state (same pattern as LayoutScreen)
  const SIDE_MENU_WIDTH = 280;
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const sideMenuTranslateX = useRef(new Animated.Value(-SIDE_MENU_WIDTH)).current;

  const getComponentName = (section) =>
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    "";

  // Helper function to deep compare two objects
  const deepEqual = (obj1, obj2) => {
    try {
      return JSON.stringify(obj1) === JSON.stringify(obj2);
    } catch {
      return false;
    }
  };

  // Function to check and update bottom navigation from DSL
  const checkAndUpdateBottomNav = useCallback(async () => {
    try {
      // First check current page DSL, then fallback to home page DSL
      let incomingBottomNav = null;
      
      // Try current page first
      const currentPageDslData = await fetchDSL(appId, pageName);
      if (currentPageDslData?.dsl) {
        incomingBottomNav = (currentPageDslData.dsl.sections || []).find(
          (section) => {
            const component = getComponentName(section).toLowerCase();
            return [
              "bottom_navigation",
              "bottom_navigation_style_1",
              "bottom_navigation_style_2",
            ].includes(component);
          }
        );
      }
      
      // If not found in current page, check home page
      if (!incomingBottomNav) {
        const homeDslData = await fetchDSL(appId, "home");
        if (homeDslData?.dsl) {
          incomingBottomNav = (homeDslData.dsl.sections || []).find(
            (section) => {
              const component = getComponentName(section).toLowerCase();
              return [
                "bottom_navigation",
                "bottom_navigation_style_1",
                "bottom_navigation_style_2",
              ].includes(component);
            }
          );
        }
      }

      // If bottom nav section exists and is different, update it
      if (incomingBottomNav) {
        if (!bottomNavSectionRef.current || !deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
          bottomNavSectionRef.current = incomingBottomNav;
          setBottomNavSection(incomingBottomNav);
          console.log("🔄 Bottom navigation updated dynamically on", pageName, "page");
        }
      }
    } catch (error) {
      console.log("❌ Error checking bottom nav update:", error);
    }
  }, [appId, pageName]);
  // Only true header components — header_2 is excluded so it never gets
  // injected on non-home pages. Non-home pages get a synthetic standalone
  // header built from headerdefault instead.
  const primaryHeaderNames = useMemo(
    () => new Set(["header", "header_mobile"]),
    []
  );

  // Synthetic standalone header section — triggers Topheader's defaultConfig
  // path which reads getHeaderDefault() for title/colors/cart icon.
  const STANDALONE_HEADER_SECTION = useMemo(() => ({
    component: { const: "header" },
    _synthetic: true,
  }), []);

  const extractHeaderSections = useCallback(
    (incomingDsl) =>
      (incomingDsl?.sections || []).filter((section) =>
        primaryHeaderNames.has(getComponentName(section).toLowerCase())
      ),
    [primaryHeaderNames]
  );

  // On non-home pages: ALWAYS strip the page's own header and replace it
  // with the home-page header so every tab shows the identical header.
  const ensureHeaderSections = useCallback(
    (incomingDsl, fallbackHeaders) => {
      if (!incomingDsl || !Array.isArray(incomingDsl.sections)) return incomingDsl;
      if (!fallbackHeaders || !fallbackHeaders.length) return incomingDsl;
      // Remove any header that belongs to this page's own DSL
      const sectionsWithoutHeader = incomingDsl.sections.filter(
        (section) => !primaryHeaderNames.has(getComponentName(section).toLowerCase())
      );
      // Prepend the home-page header
      return {
        ...incomingDsl,
        sections: [...fallbackHeaders, ...sectionsWithoutHeader],
      };
    },
    [primaryHeaderNames]
  );

  const mobileSections = useMemo(
    () => (dsl?.sections || []).filter(shouldRenderSectionOnMobile),
    [dsl]
  );

  // Locate side navigation section for this page
  const sideNavSection = useMemo(
    () =>
      (dsl?.sections || []).find(
        (section) => getComponentName(section).toLowerCase() === "side_navigation"
      ) || null,
    [dsl]
  );

  // Components that must appear at most once per page.
  // If the DSL accidentally includes multiples, only the first is kept.
  const SINGLETON_COMPONENTS = new Set([
    "header",
    "header_mobile",
    "header_2",
    "search_bar",
    "trending_searches",
    "trending_collections",
    "bottom_navigation",
    "bottom_navigation_style_1",
    "bottom_navigation_style_2",
    "side_navigation",
    "free_shipping",
    "discount_code",
    "order_summary",
    "checkout_button",
    "account_profile",
    "account_menu",
    "profile_header",
    "account_profile_header",
    "sign_up",
    "signup",
  ]);

  const sortedSections = useMemo(() => {
    // Step 1: filter by mobile visibility
    const filtered = mobileSections.filter((section) => {
      const component = getComponentName(section).toLowerCase();
      // header_2 only shows on home page — other tabs get the synthetic standalone header
      if (component === "header_2") return isHomePage;
      // side_navigation is rendered separately (slide-out drawer), not inline
      if (component === "side_navigation") return false;
      return true;
    });

    // Step 2: deduplicate singletons — keep only the FIRST occurrence
    // of each singleton component. Non-singleton components (carousels,
    // banners, text blocks, etc.) are kept even if repeated.
    const seenSingletons = new Set();
    const deduped = filtered.filter((section) => {
      const component = getComponentName(section).toLowerCase();
      if (!SINGLETON_COMPONENTS.has(component)) return true;
      if (seenSingletons.has(component)) return false;
      seenSingletons.add(component);
      return true;
    });

    // Step 3: sort — any header variant always floats to the top
    const isHeaderComponent = (name) =>
      name === "header" || name === "header_mobile" || name === "header_2";

    return deduped.sort((a, b) => {
      const A = getComponentName(a).toLowerCase();
      const B = getComponentName(b).toLowerCase();
      if (isHeaderComponent(A)) return -1;
      if (isHeaderComponent(B)) return 1;
      return 0;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHomePage, mobileSections]);

  // Use state-based bottomNavSection that can be updated dynamically
  // Fallback to sortedSections or bottomNavSectionProp if state is not set
  const resolvedBottomNavSection = useMemo(() => {
    // First check if we have a dynamically updated bottom nav section
    if (bottomNavSection) {
      return bottomNavSection;
    }
    // Then check sortedSections (from current page DSL)
    const fromSections = sortedSections.find((section) => {
      const component = getComponentName(section).toLowerCase();
      return [
        "bottom_navigation",
        "bottom_navigation_style_1",
        "bottom_navigation_style_2",
      ].includes(component);
    });
    // Finally fallback to prop
    return fromSections || bottomNavSectionProp;
  }, [bottomNavSection, sortedSections, bottomNavSectionProp]);

  const activeIndex = useMemo(() => {
    if (activeIndexFromParams !== undefined && activeIndexFromParams !== null) {
      const n = Number(activeIndexFromParams);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const section = resolvedBottomNavSection;
    const rawProps = section?.props || section?.properties?.props?.properties || section?.properties?.props || {};
    const raw = rawProps?.raw?.value ?? rawProps?.raw ?? {};
    const items = raw?.items ?? raw?.navItems ?? rawProps?.items?.value ?? rawProps?.items ?? [];
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;
    const slug = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const page = slug(normalizedPageName || route?.params?.pageName);
    const idx = list.findIndex(
      (item) =>
        slug(item?.id) === page ||
        slug(item?.label) === page ||
        slug(item?.link) === page
    );
    return idx >= 0 ? idx : 0;
  }, [activeIndexFromParams, normalizedPageName, route?.params?.pageName, resolvedBottomNavSection]);

  const visibleSections = useMemo(
    () =>
      sortedSections.filter((section) => {
        const component = getComponentName(section).toLowerCase();
        return ![
          "bottom_navigation",
          "bottom_navigation_style_1",
          "bottom_navigation_style_2",
        ].includes(component);
      }),
    [sortedSections]
  );

  // Side menu helpers
  const closeSideMenu = () => setIsSideMenuOpen(false);

  const openSideMenu = () => {
    // Always allow opening the side menu from the app bar
    setIsSideMenuOpen(true);
  };

  const toggleSideMenu = () => {
    // Always toggle, even if DSL has no explicit side_navigation section
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

  // Single sequential load: home headers first → then page DSL.
  // This eliminates the race condition where loadDSL ran before
  // homeHeaderSectionsRef was populated.
  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      try {
        setLoading(true);
        setErr(null);

        // Step 1: fetch home DSL to get headerdefault + real header sections.
        // Skip on home page itself.
        let headers = homeHeaderSectionsRef.current;
        if (!isHomePage && headers.length === 0) {
          try {
            const homeDslData = await fetchDSL(appId, "home");
            // Store headerdefault globally so Topheader standalone mode can read it
            if (homeDslData?.dsl?.headerdefault) {
              setHeaderDefault(homeDslData.dsl.headerdefault);
            }
            // Try real header sections first (header / header_mobile)
            headers = extractHeaderSections(homeDslData?.dsl || {});
            // If home page only has header_2, fall back to synthetic standalone header
            if (headers.length === 0) {
              headers = [STANDALONE_HEADER_SECTION];
            }
            homeHeaderSectionsRef.current = headers;
            if (isMounted) setHomeHeaderSections(headers);
          } catch (err) {
            console.log("❌ Failed to fetch home header sections:", err);
            // Even on error, inject a synthetic header
            headers = [STANDALONE_HEADER_SECTION];
            homeHeaderSectionsRef.current = headers;
          }
        }

        // Step 2: fetch the current page DSL
        console.log(`📱 Loading DSL — page: "${pageName}", appId: ${appId}`);
        const dslData = await fetchDSL(appId, pageName);

        if (!isMounted) return;

        if (!dslData?.dsl) {
          // Page not found — show home header with empty body
          setDsl({ sections: headers });
          return;
        }

        const nextDsl = isHomePage
          ? dslData.dsl
          : ensureHeaderSections(dslData.dsl, headers);
        setDsl(nextDsl);
        versionRef.current = dslData.versionNumber ?? null;
      } catch (error) {
        if (isMounted) setErr(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    return () => { isMounted = false; };
  }, [appId, ensureHeaderSections, extractHeaderSections, isHomePage, pageName]);

  const refreshDSL = useCallback(async () => {
    try {
      // Re-fetch home headers if not loaded yet
      let headers = homeHeaderSectionsRef.current;
      if (!isHomePage && headers.length === 0) {
        try {
          const homeDslData = await fetchDSL(appId, "home");
          if (homeDslData?.dsl?.headerdefault) {
            setHeaderDefault(homeDslData.dsl.headerdefault);
          }
          headers = extractHeaderSections(homeDslData?.dsl || {});
          if (headers.length === 0) {
            headers = [STANDALONE_HEADER_SECTION];
          }
          homeHeaderSectionsRef.current = headers;
          setHomeHeaderSections(headers);
        } catch (_) {
          headers = [STANDALONE_HEADER_SECTION];
          homeHeaderSectionsRef.current = headers;
        }
      }

      const dslData = await fetchDSL(appId, pageName);
      if (dslData?.dsl) {
        const nextDsl = isHomePage
          ? dslData.dsl
          : ensureHeaderSections(dslData.dsl, headers);
        setDsl(nextDsl);
        versionRef.current = dslData.versionNumber ?? null;
      }
      await checkAndUpdateBottomNav();
    } catch (error) {
      console.log("❌ Refresh error:", error);
    }
  }, [appId, ensureHeaderSections, extractHeaderSections, isHomePage, pageName, checkAndUpdateBottomNav]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDSL();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      if (!isAutoRefreshPage) return undefined;
      refreshDSL();
      return undefined;
    }, [isAutoRefreshPage, refreshDSL])
  );

  useEffect(() => {
    // Check for bottom navigation updates on mount
    checkAndUpdateBottomNav();
  }, [checkAndUpdateBottomNav]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const latest = await fetchDSL(appId, pageName);
        if (!latest?.dsl) return;

        const incomingVersion = latest.versionNumber ?? null;
        if (incomingVersion !== versionRef.current) {
          const headers = homeHeaderSectionsRef.current;
          const nextDsl = isHomePage
            ? latest.dsl
            : ensureHeaderSections(latest.dsl, headers);
          setDsl(nextDsl);
          versionRef.current = incomingVersion;
        }
        await checkAndUpdateBottomNav();
      } catch (error) {
        console.log("❌ Auto-refresh error:", error);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [appId, ensureHeaderSections, isHomePage, pageName, checkAndUpdateBottomNav]);

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
        <View style={styles.container}>
        {loading ? (
          <SkeletonLoader />
        ) : err ? (
          <View style={styles.content}>
            <Text style={styles.error}>Error loading: {err}</Text>
            <Text style={styles.linkText}>Please try again.</Text>
          </View>
        ) : (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: resolvedBottomNavSection ? 70 : 0 },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {visibleSections.length ? (
              visibleSections.map((section, index) => (
                <View
                  key={index}
                  style={styles.sectionWrapper}
                >
                  <DynamicRenderer section={section} />
                </View>
              ))
            ) : (
              <View style={styles.content}>
                <Text style={styles.subtitleText}>
                  {isNotificationPage ? "You're all caught up!" : "No content available yet."}
                </Text>
                <Text style={styles.linkText}>
                  {isNotificationPage
                    ? "No new notifications right now. We'll let you know when something arrives."
                    : "Please check back soon."}
                </Text>
              </View>
            )}
          </ScrollView>
        )}

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

        {resolvedBottomNavSection && (
          <View style={styles.bottomNav}>
            <BottomNavigation section={resolvedBottomNavSection} activeIndexOverride={activeIndex} />
          </View>
        )}
      </View>
      </SideMenuProvider>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  subtitleText: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginBottom: 12,
  },
  linkText: {
    fontSize: 14,
    color: "#64748B",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  error: {
    fontSize: 16,
    color: "#DC2626",
    textAlign: "center",
    marginBottom: 8,
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
    elevation: 5,
  },
});

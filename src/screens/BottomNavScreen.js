import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { SideMenuProvider } from "../services/SideMenuContext";

export default function BottomNavScreen() {
  const route = useRoute();
  const { session } = useAuth();
  const title = route?.params?.title || "Page";
  const link = route?.params?.link || "";
  const pageName = route?.params?.pageName || link || title;
  const bottomNavSectionProp = route?.params?.bottomNavSection || bottomNavigationStyle1Section;
  const activeIndex = route?.params?.activeIndex;
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
  const isAutoRefreshPage = isCartPage || isNotificationPage;
  const isHomePage = normalizedPageName === "home";
  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeHeaderSections, setHomeHeaderSections] = useState([]);
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
      if (component !== "header_2") return true;
      return isHomePage || !hasPrimaryHeader;
    });

    return sectionsCopy.sort((a, b) => {
      const A = getComponentName(a);
      const B = getComponentName(b);

      if (A === "header") return -1;
      if (B === "header") return 1;

      if (A === "header_2") return -1;
      if (B === "header_2") return 1;

      return 0;
    });
  }, [hasHeader2, hasPrimaryHeader, isHomePage, mobileSections]);

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

  useEffect(() => {
    let isMounted = true;

    const loadDSL = async () => {
      try {
        setLoading(true);
        setErr(null);
        const dslData = await fetchDSL(appId, pageName);
        if (!dslData?.dsl) {
          const graphqlUrl = "https://mobidrag.ampleteck.com/graphql";
          setErr(`No live DSL returned from server\nApp ID: ${appId}\nURL: ${graphqlUrl}`);
          return;
        }
        if (isMounted) {
          const nextDsl = isHomePage
            ? dslData.dsl
            : ensureHeaderSections(dslData.dsl, homeHeaderSections);
          setDsl(nextDsl);
          versionRef.current = dslData.versionNumber ?? null;
        }
      } catch (error) {
        if (isMounted) setErr(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDSL();

    return () => {
      isMounted = false;
    };
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName]);

  const loadHomeHeaderSections = useCallback(async () => {
    if (isHomePage) {
      setHomeHeaderSections([]);
      return;
    }

    try {
      const homeDslData = await fetchDSL(appId, "home");
      const headers = extractHeaderSections(homeDslData?.dsl || {});
      setHomeHeaderSections(headers);
    } catch (error) {
      console.log("❌ Failed to fetch home header sections:", error);
      setHomeHeaderSections([]);
    }
  }, [appId, extractHeaderSections, isHomePage]);

  useEffect(() => {
    loadHomeHeaderSections();
  }, [loadHomeHeaderSections]);

  useEffect(() => {
    if (!isHomePage && dsl) {
      setDsl(ensureHeaderSections(dsl, homeHeaderSections));
    }
  }, [dsl, ensureHeaderSections, homeHeaderSections, isHomePage]);

  const refreshDSL = useCallback(async () => {
    try {
      const dslData = await fetchDSL(appId, pageName);
      if (dslData?.dsl) {
        const nextDsl = isHomePage
          ? dslData.dsl
          : ensureHeaderSections(dslData.dsl, homeHeaderSections);
        setDsl(nextDsl);
        versionRef.current = dslData.versionNumber ?? null;
      }
      // Also check for bottom navigation updates from home page
      await checkAndUpdateBottomNav();
    } catch (error) {
      console.log("❌ Bottom nav refresh error:", error);
    }
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName, checkAndUpdateBottomNav]);

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
          const nextDsl = isHomePage
            ? latest.dsl
            : ensureHeaderSections(latest.dsl, homeHeaderSections);
          setDsl(nextDsl);
          versionRef.current = incomingVersion;
        }
        // Also check for bottom navigation updates from home page
        await checkAndUpdateBottomNav();
      } catch (error) {
        console.log("❌ Bottom nav auto-refresh error:", error);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName, checkAndUpdateBottomNav]);

  return (
    <SafeArea>
      <SideMenuProvider
        value={{
          isOpen: isSideMenuOpen,
          hasSideNav: true, // always allow side menu icon in header
          toggleSideMenu,
          openSideMenu,
          closeSideMenu,
        }}
      >
        <View style={styles.container}>
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loaderText}>Loading {title}...</Text>
          </View>
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
              { flexGrow: 1, paddingBottom: resolvedBottomNavSection ? 88 : 24 },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {visibleSections.length ? (
              visibleSections.map((section, index) => {
                const componentName = getComponentName(section).toLowerCase();
                const nextComponentName = visibleSections[index + 1]
                  ? getComponentName(visibleSections[index + 1]).toLowerCase()
                  : null;
                const collapseHeaderGap =
                  componentName === "header" && nextComponentName === "header_2";

                return (
                  <View
                    key={index}
                    style={[
                      styles.sectionWrapper,
                      collapseHeaderGap && styles.sectionWrapperTight,
                    ]}
                  >
                    <DynamicRenderer section={section} />
                  </View>
                );
              })
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
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 96,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
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

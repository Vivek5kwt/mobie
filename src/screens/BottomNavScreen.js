import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { SafeArea } from "../utils/SafeAreaHandler";
import BottomNavigation from "../components/BottomNavigation";
import bottomNavigationStyle1Section from "../data/bottomNavigationStyle1";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";

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

  const getComponentName = (section) =>
    section?.component?.const ||
    section?.component ||
    section?.properties?.component?.const ||
    section?.properties?.component ||
    "";
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

  const bottomNavSection = useMemo(
    () =>
      sortedSections.find((section) => {
        const component = getComponentName(section).toLowerCase();
        return [
          "bottom_navigation",
          "bottom_navigation_style_1",
          "bottom_navigation_style_2",
        ].includes(component);
      }) || bottomNavSectionProp,
    [bottomNavSectionProp, sortedSections]
  );

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

  useEffect(() => {
    let isMounted = true;

    const loadDSL = async () => {
      try {
        setLoading(true);
        setErr(null);
        const dslData = await fetchDSL(appId, pageName);
        if (!dslData?.dsl) {
          setErr("No live DSL returned from server");
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
    } catch (error) {
      console.log("❌ Bottom nav refresh error:", error);
    }
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName]);

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
      } catch (error) {
        console.log("❌ Bottom nav auto-refresh error:", error);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [appId, ensureHeaderSections, homeHeaderSections, isHomePage, pageName]);

  return (
    <SafeArea>
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
              { flexGrow: 1, paddingBottom: bottomNavSection ? 88 : 24 },
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

        {bottomNavSection && (
          <View style={styles.bottomNav}>
            <BottomNavigation section={bottomNavSection} activeIndexOverride={activeIndex} />
          </View>
        )}
      </View>
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
});

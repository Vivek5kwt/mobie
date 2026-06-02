import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import HeaderIcon from "react-native-vector-icons/FontAwesome6";
import { SafeArea } from "../utils/SafeAreaHandler";
import { useAuth } from "../services/AuthContext";
import { resolveAppId } from "../utils/appId";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";
import HeaderDefault from "../components/HeaderDefault";
import SkeletonLoader from "../components/SkeletonLoader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";

const normalizeSlug = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getComponentName = (section) =>
  section?.component?.const ||
  section?.component ||
  section?.properties?.component?.const ||
  section?.properties?.component ||
  "";

const LIVE_DSL_REFRESH_INTERVAL_MS = 3000;

const getDslFingerprint = (incomingDsl) => {
  try {
    return JSON.stringify({
      headerdefault: incomingDsl?.headerdefault ?? null,
      brandKit: incomingDsl?.brandKit ?? null,
      sections: incomingDsl?.sections || [],
    });
  } catch (_) {
    return (incomingDsl?.sections || []).map(getComponentName).join(",");
  }
};

const hasRenderableSections = (dsl) => Array.isArray(dsl?.sections) && dsl.sections.length > 0;

const isHeaderDefaultEnabled = (config) => {
  if (!config) return false;
  const raw = config?.enabled;
  const value = raw && typeof raw === "object" ? (raw.value ?? raw.const ?? raw) : raw;
  return value === true || value === "true" || value === 1;
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { session } = useAuth();
  const appId = useMemo(
    () => resolveAppId(route?.params?.appId ?? session?.user?.appId ?? session?.user?.app_id),
    [route?.params?.appId, session?.user?.appId, session?.user?.app_id]
  );

  const routePageName = route?.params?.pageName || route?.params?.link || "settings";
  const routeTitle = route?.params?.title || "Settings";

  const [dsl, setDsl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [bottomNavSection, setBottomNavSection] = useState(route?.params?.bottomNavSection || null);
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const dslFingerprintRef = useRef(null);

  const pageCandidates = useMemo(() => {
    const names = [routePageName, "settings", "my-account"];
    const seen = new Set();
    return names
      .map(normalizeSlug)
      .filter((name) => {
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
  }, [routePageName]);

  const loadSettingsDsl = useCallback(
    async ({ asRefresh = false, silent = false } = {}) => {
      if (asRefresh) {
        setRefreshing(true);
      } else if (!silent) {
        setLoading(true);
      }
      if (!silent) setError("");

      try {
        let selected = null;
        for (const pageName of pageCandidates) {
          const result = await fetchDSL(appId, pageName);
          if (hasRenderableSections(result?.dsl)) {
            selected = result.dsl;
            break;
          }
        }
        const nextDsl = selected || { sections: [] };
        const fp = getDslFingerprint(nextDsl);
        if (fp !== dslFingerprintRef.current) {
          dslFingerprintRef.current = fp;
          setDsl(nextDsl);
        }
      } catch (err) {
        if (!silent) {
          setError(err?.message || "Unable to load settings.");
          setDsl({ sections: [] });
        }
      } finally {
        if (!silent) setLoading(false);
        if (asRefresh) setRefreshing(false);
      }
    },
    [appId, pageCandidates]
  );

  useEffect(() => {
    loadSettingsDsl();
  }, [loadSettingsDsl]);

  useEffect(() => {
    let mounted = true;
    fetchDSL(appId, "home")
      .then((result) => {
        if (!mounted) return;
        const sections = result?.dsl?.sections || [];
        const nav = sections.find((section) => {
          const component = getComponentName(section).toLowerCase();
          return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(component);
        });
        if (nav) setBottomNavSection(nav);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [appId]);

  useEffect(() => {
    const id = setInterval(
      () => loadSettingsDsl({ silent: true }),
      LIVE_DSL_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [loadSettingsDsl]);

  const headerDefaultConfig = dsl?.headerdefault || null;
  const useHeaderDefault = isHeaderDefaultEnabled(headerDefaultConfig);

  const visibleSections = useMemo(
    () =>
      (dsl?.sections || [])
        .filter(Boolean)
        .filter(shouldRenderSectionOnMobile)
        .filter((section) => {
          const component = getComponentName(section).toLowerCase();
          if (["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2", "side_navigation"].includes(component)) {
            return false;
          }
          if (useHeaderDefault && (component === "header" || component === "header_mobile")) {
            return false;
          }
          return true;
        }),
    [dsl, useHeaderDefault]
  );

  const pageTitle = dsl?.page?.name || dsl?.page?.handle || routeTitle;

  return (
    <SafeArea edges={["top", "left", "right"]}>
      <View style={styles.container}>
        {loading ? (
          <SkeletonLoader />
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 24 },
            ]}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadSettingsDsl({ asRefresh: true })} />
            }
          >
            {useHeaderDefault ? (
              <HeaderDefault config={headerDefaultConfig} bottomNavSection={bottomNavSection} hideTabs showBack />
            ) : (
              <View style={styles.fallbackHeader}>
                <TouchableOpacity
                  onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("BottomNavScreen", { pageName: "my-account", title: "My Account" }))}
                  style={styles.fallbackBack}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <HeaderIcon name="arrow-left-long" size={18} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.fallbackTitle} numberOfLines={1}>
                  {pageTitle}
                </Text>
                <View style={styles.fallbackBack} />
              </View>
            )}

            {visibleSections.length ? (
              visibleSections.map((section, index) => {
                const component = getComponentName(section).toLowerCase();
                const isAccountSection = [
                  "account_profile",
                  "account_menu",
                  "profile_header",
                  "account_profile_header",
                  "text_block",
                  "currency_switcher",
                  "logout",
                ].includes(component);
                return (
                  <View
                    key={`${component || "section"}-${index}`}
                    style={[styles.sectionWrapper, isAccountSection && styles.sectionWrapperTight]}
                  >
                    <DynamicRenderer section={section} />
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>{error || "No settings available yet."}</Text>
              </View>
            )}
          </ScrollView>
        )}
        {bottomNavSection && (
          <View
            style={styles.bottomNav}
            onLayout={(event) => setBottomNavHeight(event.nativeEvent.layout.height)}
          >
            <BottomNavigation section={bottomNavSection} />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContent: {
    paddingBottom: 24,
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  sectionWrapper: {
    width: "100%",
  },
  sectionWrapperTight: {
    marginBottom: 0,
  },
  fallbackHeader: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fallbackBack: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackTitle: {
    flex: 1,
    textAlign: "center",
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  emptyState: {
    padding: 24,
  },
  emptyTitle: {
    color: "#4B5563",
    fontSize: 14,
  },
});

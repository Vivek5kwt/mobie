import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { StackActions, useFocusEffect, useNavigation } from "@react-navigation/native";
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import HeaderDefault from "../components/HeaderDefault";
import DynamicRenderer from "../engine/DynamicRenderer";
import BottomNavigation from "../components/BottomNavigation";
import { isAuthenticatedSession } from "../utils/authGate";

const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

const normalizeComp = (s) =>
  String(
    s?.component?.const || s?.component || s?.properties?.component?.const || ""
  ).trim().toLowerCase().replace(/[\s-]+/g, "_");

const getDslFingerprint = (incomingDsl) => {
  try {
    return JSON.stringify({
      headerdefault: incomingDsl?.headerdefault ?? null,
      brandKit: incomingDsl?.brandKit ?? null,
      sections: incomingDsl?.sections || [],
    });
  } catch (_) {
    return (incomingDsl?.sections || []).map(normalizeComp).join(",");
  }
};

// Header and bottom nav are rendered at fixed positions in this screen's own
// layout below, not inline with the rest of the page's DSL sections. The
// wishlist_item section itself is rendered through DynamicRenderer like any
// other block — this screen used to hand-rebuild that card grid separately,
// which is exactly why it drifted from the design shown via My Account
// (BottomNavScreen.js), which already rendered it generically. One shared
// component (WishlistItem.js) now backs both entry points.
const SKIP_COMPS = new Set([
  "bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2",
  "header", "header_2", "header_mobile",
]);

const NAV_COMPS = ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"];

// ── Component ─────────────────────────────────────────────────────────────────
export default function WishlistScreen() {
  const navigation = useNavigation();
  const { session, initializing } = useAuth();
  const isLoggedIn = isAuthenticatedSession(session);

  // Auth gate
  useFocusEffect(
    useCallback(() => {
      if (!initializing && !isLoggedIn) {
        navigation.dispatch(StackActions.replace("Auth", {
          initialMode: "login",
          requireAuth: true,
          postLoginTarget: { name: "Wishlist", params: { title: "Wishlist", pageName: "wishlist" } },
        }));
      }
    }, [initializing, isLoggedIn, navigation])
  );

  const appId = useMemo(
    () => resolveAppId(session?.user?.appId ?? session?.user?.app_id),
    [session]
  );

  // ── DSL state ─────────────────────────────────────────────────────────────
  const [dslLoading, setDslLoading] = useState(true);
  const [headerConfig, setHeaderConfig] = useState(null);
  const [sections, setSections] = useState([]);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(56);
  const dslFingerprintRef = useRef(null);

  const loadDSL = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setDslLoading(true);

      // Bottom navigation is only ever saved into Home's own DSL — Builder
      // shows it on every non-auth page via a client-side splice from Home,
      // it's never duplicated into other pages' saved sections. Fetching it
      // from "wishlist" itself (as this used to) always resolves to nothing,
      // matching the pattern already used correctly in
      // CollectionProductsScreen/AllProductsScreen/ProductDetailScreen.
      const [wishlistResult, homeResult] = await Promise.all([
        fetchDSL(appId, "wishlist").catch(() => null),
        fetchDSL(appId, "home").catch(() => null),
      ]);
      const dsl = wishlistResult?.dsl || wishlistResult;
      const homeDsl = homeResult?.dsl || homeResult;
      const fp = getDslFingerprint(dsl);
      if (fp !== dslFingerprintRef.current) {
        dslFingerprintRef.current = fp;
        setHeaderConfig(dsl?.headerdefault || null);

        const allSections = dsl?.sections || [];
        setSections(
          allSections.filter((s) => {
            const c = normalizeComp(s);
            return c !== "" && !SKIP_COMPS.has(c);
          })
        );
      }

      const homeNavSection =
        (homeDsl?.sections || []).find((s) => NAV_COMPS.includes(normalizeComp(s))) || null;
      setBottomNavSection(homeNavSection);
    } catch (_) {
      // DSL fetch failed — renders with defaults
    } finally {
      if (!silent) setDslLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadDSL(); }, [loadDSL]);

  useEffect(() => {
    const id = setInterval(
      () => loadDSL({ silent: true }),
      LIVE_DSL_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [loadDSL]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (initializing || !isLoggedIn) return null;

  return (
    <SafeArea>
      {headerConfig ? (
        <HeaderDefault config={headerConfig} hideTabs={true} showBack={true} />
      ) : null}

      {dslLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color="#016D77" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomNavSection ? bottomNavHeight : 0 }}
        >
          {sections.map((section, i) => (
            <DynamicRenderer key={i} section={section} />
          ))}
        </ScrollView>
      )}

      {bottomNavSection && (
        <View
          style={styles.bottomNav}
          onLayout={(e) => setBottomNavHeight(e.nativeEvent.layout.height)}
        >
          <BottomNavigation section={bottomNavSection} />
        </View>
      )}
    </SafeArea>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});

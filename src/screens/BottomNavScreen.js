import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Animated, InteractionManager, TouchableOpacity } from "react-native";
import HeaderIcon from "react-native-vector-icons/FontAwesome6";
import { StackActions, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { SafeArea } from "../utils/SafeAreaHandler";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import SideNavigation, { getSideNavigationWidth } from "../components/SideNavigation";
import { fetchDSL } from "../engine/dslHandler";
import { shouldRenderSectionOnMobile } from "../engine/visibility";
import DynamicRenderer from "../engine/DynamicRenderer";
import SkeletonLoader from "../components/SkeletonLoader";
import HeaderDefault from "../components/HeaderDefault";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import { isAuthenticatedSession } from "../utils/authGate";
import { SideMenuProvider } from "../services/SideMenuContext";
import { setHeaderDefault } from "../services/headerDefaultService";
import NotificationList from "../components/NotificationList";
import { fetchNotifications } from "../services/notificationFetchService";
import { getHomeSectionMarginBottom } from "../utils/sectionSpacing";
import { PageEmptyStateProvider } from "../services/PageEmptyStateContext";
import { trackScreenView } from "../services/analyticsService";

// Slugs that should redirect to the Auth screen instead of rendering empty DSL content
const SIGNIN_SLUGS = new Set(["signin", "sign-in", "login", "log-in", "auth"]);
const CART_EMPTY_VISIBLE_COMPONENTS = new Set(["cart_line_items"]);
const ORDERS_EMPTY_VISIBLE_COMPONENTS = new Set(["order_history", "orderhistory", "orders", "my_orders"]);
const WISHLIST_EMPTY_VISIBLE_COMPONENTS = new Set(["text_block", "wishlist", "wishlist_item", "wishlist-item"]);
const LIVE_DSL_REFRESH_INTERVAL_MS = 30000;

const getSectionCount = (incomingDsl) =>
  Array.isArray(incomingDsl?.sections) ? incomingDsl.sections.filter(Boolean).length : 0;

// ── Default profile menu items shown when DSL has no account_menu sections ───
const DEFAULT_PROFILE_MENU = [
  { id: "orders",   label: "My Orders",   icon: "📦", link: "orders" },
  { id: "wishlist", label: "Wishlist",     icon: "🤍", link: "wishlist" },
  { id: "settings", label: "Settings",    icon: "⚙️", link: "settings" },
];

function FallbackProfile({ session, logout, navigation }) {
  const user = session?.user || {};
  const name  = String(user.name  || user.email || "").trim();
  const email = String(user.email || "").trim();
  const avatarUrl = user.avatarUrl || user.avatar || "";
  const initial = name ? name[0].toUpperCase() : "?";

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: "Auth", params: { initialMode: "login" } }] });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleMenuPress = (item) => {
    if (item.link === "wishlist") {
      if (!isAuthenticatedSession(session)) {
        navigation.dispatch(StackActions.replace("Auth", {
          initialMode: "login",
          requireAuth: true,
          postLoginTarget: {
            name: "BottomNavScreen",
            params: { pageName: "wishlist", title: "Wishlist", link: "wishlist" },
          },
        }));
        return;
      }
      navigation.setParams({ pageName: "wishlist", title: "Wishlist", link: "wishlist" });
      return;
    }
    if (item.link === "settings") {
      navigation.setParams({ pageName: "settings", title: "Settings", link: "settings" });
      return;
    }
    if (item.link === "orders") {
      // Update the current BottomNavScreen in-place so the same nav bar is preserved.
      navigation.setParams({ pageName: "orders", title: "My Orders", link: "orders" });
      return;
    }
  };

  return (
    <View>
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.profileAvatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.profileAvatarInitial}>{initial}</Text>
          )}
        </View>
        <View style={styles.profileInfo}>
          {!!name && <Text style={styles.profileName} numberOfLines={1}>{name}</Text>}
          {!!email && <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>}
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.profileMenuContainer}>
        {DEFAULT_PROFILE_MENU.map((item, idx) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.profileMenuItem,
              idx === DEFAULT_PROFILE_MENU.length - 1 && styles.profileMenuItemLast,
            ]}
            onPress={() => handleMenuPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.profileMenuIcon}>
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
            </View>
            <Text style={styles.profileMenuLabel}>{item.label}</Text>
            <Text style={styles.profileMenuChevron}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity
          style={[styles.profileMenuItem, styles.profileMenuItemLast]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.profileMenuIcon, { backgroundColor: "#FEF2F2" }]}>
            <Text style={{ fontSize: 16 }}>🚪</Text>
          </View>
          <Text style={styles.profileMenuLabelLogout}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function BottomNavScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { session, logout, initializing } = useAuth();
  const cartItems = useSelector((state) => state?.cart?.items || []);
  const isLoggedIn = isAuthenticatedSession(session);
  const title = route?.params?.title || "Page";
  const link = route?.params?.link || "";
  const pageName = route?.params?.pageName || link || title;
  // Only use the DSL-provided section — never fall back to hardcoded defaults
  // This ensures only tabs that exist in the JSON are shown
  const bottomNavSectionProp = route?.params?.bottomNavSection || null;
  const activeIndexFromParams = route?.params?.activeIndex;
  // When true: suppress bottom nav bar and show a back-button header row
  const hideBottomNav = route?.params?.hideBottomNav === true;
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
  const isWishlistPage =
    normalizedPageName.includes("wishlist") || normalizedTitle.includes("wishlist");
  const isOrdersPage =
    normalizedPageName === "orders" ||
    normalizedPageName === "order" ||
    normalizedPageName === "my-orders" ||
    normalizedPageName === "order-history" ||
    normalizedTitle === "orders" ||
    normalizedTitle === "my orders";
  const isProtectedPage = isProfilePage || isWishlistPage || isOrdersPage;
  const isHomePage = normalizedPageName === "home";
  const isCartEmpty = cartItems.length === 0;
  const [dsl, setDsl] = useState(null);
  const [pageTitleFromDsl, setPageTitleFromDsl] = useState(title);
  const [loading, setLoading] = useState(true);
  const [heavySectionsReady, setHeavySectionsReady] = useState(() => !isHomePage);
  const [err, setErr] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Notification-page data
  const [notifications, setNotifications]           = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [headerDefaultConfig, setHeaderDefaultConfig] = useState(null);
  // Mirror state in a ref so callbacks always read the latest value (no stale closures)
  const homeHeaderSectionsRef = useRef([]);
  const homeHeaderDefaultRef = useRef(null);
  const versionRef = useRef(null);
  const dslRequestInFlightRef = useRef(false);
  // Store bottom navigation section separately to update dynamically
  const [bottomNavSection, setBottomNavSection] = useState(bottomNavSectionProp);
  const bottomNavSectionRef = useRef(bottomNavSectionProp);
  // Measured height of the rendered bottom nav — used to pad the scroll content
  // so the last section is never hidden behind the nav bar.
  const [bottomNavHeight, setBottomNavHeight] = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [pageEmptyState, setPageEmptyState] = useState({});
  const trackedPageRef = useRef("");
  // Side menu state (same pattern as LayoutScreen)
  const DEFAULT_SIDE_MENU_WIDTH = 280;
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const sideMenuTranslateX = useRef(new Animated.Value(-DEFAULT_SIDE_MENU_WIDTH)).current;

  useEffect(() => {
    const analyticsPageName = String(pageTitleFromDsl || title || pageName || "").trim();
    const analyticsPageKey = `${appId}:${normalizedPageName}:${analyticsPageName}`;
    if (!analyticsPageName || trackedPageRef.current === analyticsPageKey) return;
    trackedPageRef.current = analyticsPageKey;
    trackScreenView(analyticsPageName, {
      route_name: "BottomNavScreen",
      page_name: pageName,
      page_handle: normalizedPageName,
    }, { session }).catch(() => {});
  }, [appId, normalizedPageName, pageName, pageTitleFromDsl, session, title]);

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
  }, [isHomePage, normalizedPageName]);

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

  // True when this screen was opened with an explicit bottom nav section (bottom nav tab
  // navigation). False when opened from a header icon (cart / notification).
  const hasInitialBottomNav = bottomNavSectionProp !== null;

  // Function to check and update bottom navigation from DSL
  const checkAndUpdateBottomNav = useCallback(async () => {
    try {
      let incomingBottomNav = null;

      const NAV_COMPONENTS = [
        "bottom_navigation",
        "bottom_navigation_style_1",
        "bottom_navigation_style_2",
      ];

      const findNav = (dsl) =>
        (dsl?.sections || []).find((s) =>
          NAV_COMPONENTS.includes(getComponentName(s).toLowerCase())
        ) || null;

      if (hasInitialBottomNav) {
        // Tab navigation already passed a real nav section; keep it synced from Home.
        const homeDslData = await fetchDSL(appId, "home");
        if (homeDslData?.dsl) {
          incomingBottomNav = findNav(homeDslData.dsl);
        }
      } else {
        // Standalone pages should only show bottom nav when their own DSL defines it.
        const currentPageDslData = await fetchDSL(appId, pageName);
        if (currentPageDslData?.dsl) {
          incomingBottomNav = findNav(currentPageDslData.dsl);
        }
      }

      if (incomingBottomNav) {
        // DSL has a bottom nav — update state only if it actually changed
        if (!bottomNavSectionRef.current || !deepEqual(incomingBottomNav, bottomNavSectionRef.current)) {
          bottomNavSectionRef.current = incomingBottomNav;
          setBottomNavSection(incomingBottomNav);
          console.log("🔄 Bottom navigation updated dynamically on", pageName, "page");
        }
      } else {
        // DSL has NO bottom nav — explicitly clear so no nav is shown
        if (bottomNavSectionRef.current !== null) {
          bottomNavSectionRef.current = null;
          setBottomNavSection(null);
          console.log("🚫 No bottom navigation in DSL — hiding nav on", pageName, "page");
        }
      }
    } catch (error) {
      console.log("❌ Error checking bottom nav update:", error);
    }
  }, [appId, pageName, hasInitialBottomNav]);
  // Reuse Home's drawer DSL on child pages. Visible headers stay page-specific
  // through each page's own headerdefault config.
  const reusableChromeNames = useMemo(
    () => new Set(["side_navigation"]),
    []
  );

  const extractHeaderSections = useCallback(
    (incomingDsl) =>
      (incomingDsl?.sections || []).filter((section) =>
        reusableChromeNames.has(getComponentName(section).toLowerCase())
      ),
    [reusableChromeNames]
  );

  const ensureHeaderSections = useCallback((incomingDsl, fallbackSections = []) => {
    if (!incomingDsl || !Array.isArray(incomingDsl.sections)) return incomingDsl;
    if (!Array.isArray(fallbackSections) || fallbackSections.length === 0) return incomingDsl;

    const existingNames = new Set(
      incomingDsl.sections.map((section) => getComponentName(section).toLowerCase())
    );
    const missingSections = fallbackSections.filter((section) => {
      const component = getComponentName(section).toLowerCase();
      return component && !existingNames.has(component);
    });

    if (missingSections.length === 0) return incomingDsl;

    return {
      ...incomingDsl,
      sections: [...missingSections, ...incomingDsl.sections],
    };
  }, []);

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
  const sideMenuWidth = useMemo(
    () => getSideNavigationWidth(sideNavSection, DEFAULT_SIDE_MENU_WIDTH),
    [sideNavSection]
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
    "free_shipping_banner",
    "discount_code",
    "discount_coupons",
    "order_summary",
    "checkout_button",
    "account_profile",
    "profile_header",
    "account_profile_header",
    "currency_switcher",
    "logout",
    "notification_inbox",
    "notification_list",
    "sign_up",
    "signup",
  ]);

  const sortedSections = useMemo(() => {
    // Step 1: filter by mobile visibility
    const filtered = mobileSections.filter((section) => {
      const component = getComponentName(section).toLowerCase();
      // header_2 only shows on Home; child pages use their page-level headerdefault.
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

    return deduped;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHomePage, mobileSections]);

  // Bottom nav is DSL-authoritative — never show a hardcoded fallback.
  // State starts from the route param (real section or null). checkAndUpdateBottomNav
  // will explicitly set null when DSL has no nav, so hardcoded props never persist.
  const resolvedBottomNavSection = useMemo(() => {
    if (bottomNavSection) return bottomNavSection;
    // Before async check: use current page's DSL sections if they contain a nav
    return sortedSections.find((section) => {
      const component = getComponentName(section).toLowerCase();
      return [
        "bottom_navigation",
        "bottom_navigation_style_1",
        "bottom_navigation_style_2",
      ].includes(component);
    }) || null;
  }, [bottomNavSection, sortedSections]);

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

  const isHeaderDefaultEnabled = useMemo(() => {
    if (!headerDefaultConfig) return false;
    const raw = headerDefaultConfig?.enabled;
    const v = raw && typeof raw === "object" ? (raw.value ?? raw.const ?? raw) : raw;
    return v === true || v === "true" || v === 1;
  }, [headerDefaultConfig]);

  const headerTitleFallback = useMemo(
    () => pageTitleFromDsl || title || pageName || "",
    [pageName, pageTitleFromDsl, title]
  );

  const bottomNavItems = useMemo(() => {
    const section = resolvedBottomNavSection;
    const rawProps = section?.props || section?.properties?.props?.properties || section?.properties?.props || {};
    const raw = rawProps?.raw?.value ?? rawProps?.raw ?? {};
    const items = raw?.items ?? raw?.navItems ?? rawProps?.items?.value ?? rawProps?.items ?? [];
    return Array.isArray(items) ? items : [];
  }, [resolvedBottomNavSection]);

  const standaloneBackFallback = useMemo(() => {
    const firstItem = bottomNavItems[0] || {};
    const firstPage = firstItem?.link || firstItem?.id || firstItem?.pageName || firstItem?.label || "home";
    const firstTitle = firstItem?.label || firstItem?.title || firstItem?.name || "Home";
    return {
      title: firstTitle,
      link: firstPage,
      pageName: firstPage,
      activeIndex: 0,
      bottomNavSection: resolvedBottomNavSection,
    };
  }, [bottomNavItems, resolvedBottomNavSection]);

  const handleStandaloneBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("BottomNavScreen", standaloneBackFallback);
  }, [navigation, standaloneBackFallback]);

  const visibleSections = useMemo(
    () =>
      sortedSections.filter((section) => {
        const component = getComponentName(section).toLowerCase();
        if (["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(component)) return false;
        // When HeaderDefault is active, suppress injected header sections to avoid double header
        if (isHeaderDefaultEnabled && (component === "header" || component === "header_mobile")) return false;
        return true;
      }),
    [sortedSections, isHeaderDefaultEnabled]
  );

  const notificationInboxSection = useMemo(
    () =>
      visibleSections.find((section) => {
        const component = getComponentName(section).toLowerCase();
        return component === "notification_inbox" || component === "notification_list" || component === "notifications";
      }) || null,
    [visibleSections]
  );

  const requestedPageLabel = pageTitleFromDsl || title || pageName || "this page";
  const dslMissing = Boolean(dsl?.__dslMissing);
  const emptyStateTitle = isSearchPage
    ? "No Search Page Found"
    : isCartPage && isCartEmpty
    ? "Your Cart is Empty"
    : isOrdersPage
    ? "No Orders Yet"
    : isNotificationPage
    ? "No Notifications"
    : dslMissing
    ? "No content available."
    : "No content configured for this page.";
  const emptyStateMessage = isSearchPage
    ? "Search functionality has not been set up yet."
    : isCartPage && isCartEmpty
    ? "Add items to your cart to see them here."
    : isOrdersPage
    ? "Your orders will appear here once you place one."
    : isNotificationPage
    ? "You have no notifications right now."
    : dslMissing
    ? "This page has no content yet."
    : "Please add components in the builder and refresh.";

  const reportPageEmptyState = useCallback((key, isEmpty) => {
    setPageEmptyState((prev) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) return prev;
      const next = { ...prev };
      if (isEmpty === undefined || isEmpty === null) {
        delete next[normalizedKey];
      } else {
        next[normalizedKey] = Boolean(isEmpty);
      }
      return next;
    });
  }, []);

  const isOrdersEmpty = pageEmptyState.order_history === true;
  const isWishlistEmpty = pageEmptyState.wishlist === true;

  // Side menu helpers
  const closeSideMenu = () => setIsSideMenuOpen(false);

  const openSideMenu = () => {
    if (!sideNavSection) return;
    setIsSideMenuOpen(true);
  };

  const toggleSideMenu = () => {
    if (!sideNavSection) return;
    setIsSideMenuOpen((prev) => !prev);
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

  const showOverlay = isSideMenuOpen && !!sideNavSection;

  // Single sequential load: reusable Home chrome first → then page DSL.
  // This eliminates the race condition where loadDSL ran before
  // homeHeaderSectionsRef was populated.
  useEffect(() => {
    let isMounted = true;

    const loadAll = async () => {
      try {
        setLoading(true);
        setErr(null);
        setHeaderDefaultConfig(null);

        if (SIGNIN_SLUGS.has(normalizedPageName)) {
          console.log(`🔑 Sign-in page detected ("${pageName}") — redirecting to Auth screen`);
          if (isLoggedIn) {
            if (isMounted) {
              navigation.setParams({ pageName: "my-account", title: "My Account", link: "my-account" });
            }
          } else if (!initializing) {
            if (isMounted) navigation.navigate("Auth", { initialMode: "login" });
          }
          return;
        }

        // Step 1: fetch Home DSL to reuse the real drawer section on child pages.
        // Visible headers come from the current page's own headerdefault.
        let headers = homeHeaderSectionsRef.current;
        if (!isHomePage && headers.length === 0) {
          try {
            const homeDslData = await fetchDSL(appId, "home");
            headers = extractHeaderSections(homeDslData?.dsl || {});
            homeHeaderSectionsRef.current = headers;
            // Cache home's headerdefault so child pages can show the header even
            // when the child page has no DSL or its own headerdefault is missing.
            homeHeaderDefaultRef.current = homeDslData?.dsl?.headerdefault ?? null;
          } catch (err) {
            console.log("❌ Failed to fetch home drawer section:", err);
            headers = [];
            homeHeaderSectionsRef.current = headers;
          }
        }

        // Step 2: fetch the current page DSL
        console.log(`📱 Loading DSL — page: "${pageName}", appId: ${appId}`);
        const dslData = await fetchDSL(appId, pageName);

        if (!isMounted) return;

        if (!dslData?.dsl) {
          // Page not found — show the header chrome from home DSL, no error message.
          const hdrFallback = null;
          setHeaderDefault(hdrFallback);
          setHeaderDefaultConfig(hdrFallback);
          setDsl({ page: { name: pageName }, sections: headers, __dslMissing: true });
          return;
        }

        // If DSL was fetched but sections are empty and page is a signin slug, redirect
        const dslSections = dslData.dsl?.sections || [];
        if (dslData.dsl?.__dslMissing && dslSections.length === 0) {
          const hdrFallback = null;
          setHeaderDefault(hdrFallback);
          setHeaderDefaultConfig(hdrFallback);
          setDsl({ ...dslData.dsl, sections: headers, __dslMissing: true });
          return;
        }

        if (SIGNIN_SLUGS.has(normalizedPageName) && dslSections.length === 0) {
          console.log(`🔑 Empty signin page — redirecting to Auth screen`);
          if (isLoggedIn) {
            if (isMounted) {
              navigation.setParams({ pageName: "my-account", title: "My Account", link: "my-account" });
            }
          } else if (!initializing) {
            if (isMounted) navigation.navigate("Auth", { initialMode: "login" });
          }
          return;
        }

        const nextDsl = isHomePage
          ? dslData.dsl
          : ensureHeaderSections(dslData.dsl, headers);
        // Fall back to home's headerdefault when the page has no headerdefault of its own.
        const hdrDefault = dslData.dsl?.headerdefault ?? null;
        setPageTitleFromDsl(dslData.dsl?.page?.name || dslData.dsl?.page?.handle || title);
        setHeaderDefault(hdrDefault);
        setHeaderDefaultConfig(hdrDefault);
        setDsl(nextDsl);
        versionRef.current = dslData.versionNumber ?? null;
        // Seed fingerprint so the first interval poll doesn't falsely trigger an update
        sectionsFpRef.current = getDslFingerprint(dslData.dsl);
      } catch (error) {
        if (isMounted) setErr(error.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    return () => { isMounted = false; };
  }, [appId, ensureHeaderSections, extractHeaderSections, getDslFingerprint, initializing, isHomePage, isLoggedIn, navigation, pageName]);

  const refreshDSL = useCallback(async ({ forceRefresh = false } = {}) => {
    if (dslRequestInFlightRef.current) return;
    dslRequestInFlightRef.current = true;

    try {
      // Re-fetch reusable Home drawer chrome if not loaded yet.
      let headers = homeHeaderSectionsRef.current;
      if (!isHomePage && headers.length === 0) {
        try {
          const homeDslData = await fetchDSL(appId, "home", { forceRefresh });
          headers = extractHeaderSections(homeDslData?.dsl || {});
          homeHeaderSectionsRef.current = headers;
          homeHeaderDefaultRef.current = homeDslData?.dsl?.headerdefault ?? null;
        } catch (_) {
          headers = [];
          homeHeaderSectionsRef.current = headers;
        }
      }

      const dslData = await fetchDSL(appId, pageName, { forceRefresh });
      if (dslData?.dsl) {
        if (dslData.dsl?.__dslMissing && getSectionCount(dslData.dsl) === 0) {
          const hdrFallback = null;
          setHeaderDefault(hdrFallback);
          setHeaderDefaultConfig(hdrFallback);
          setDsl({ ...dslData.dsl, sections: headers, __dslMissing: true });
          setErr(null);
          return;
        }

        const nextDsl = isHomePage
          ? dslData.dsl
          : ensureHeaderSections(dslData.dsl, headers);
        const hdrDefault = dslData.dsl?.headerdefault ?? null;
        setPageTitleFromDsl(dslData.dsl?.page?.name || dslData.dsl?.page?.handle || title);
        setHeaderDefault(hdrDefault);
        setHeaderDefaultConfig(hdrDefault);
        setDsl(nextDsl);
        setErr(null);
        versionRef.current = dslData.versionNumber ?? null;
        sectionsFpRef.current = getDslFingerprint(dslData.dsl);
      } else {
        // Page DSL not available — restore home header and clear any lingering error.
        const hdrFallback = null;
        setHeaderDefault(hdrFallback);
        setHeaderDefaultConfig(hdrFallback);
        setErr(null);
      }
      await checkAndUpdateBottomNav();
    } catch (error) {
      console.log("❌ Refresh error:", error);
    } finally {
      dslRequestInFlightRef.current = false;
    }
  }, [appId, ensureHeaderSections, extractHeaderSections, getDslFingerprint, isHomePage, pageName, checkAndUpdateBottomNav]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (isNotificationPage) {
      await loadNotifications();
    }
    await refreshDSL({ forceRefresh: true });
    setRefreshing(false);
  };

  // ── Notification fetch ────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!isNotificationPage || !appId) return;
    setNotificationsLoading(true);
    try {
      const userId = session?.user?.id ?? session?.user?.userId ?? null;
      const items = await fetchNotifications({ appId, userId });
      setNotifications(items);
    } catch (_) {
      // Errors already logged in service — just show empty list
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [appId, isNotificationPage, session]);

  useFocusEffect(
    useCallback(() => {
      refreshDSL();
      if (isNotificationPage) loadNotifications();
      return undefined;
    }, [isNotificationPage, loadNotifications, refreshDSL])
  );

  // Load notifications once on mount when this is the notification page
  useEffect(() => {
    if (isNotificationPage) loadNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNotificationPage, appId]);

  // Auth gate — redirect to login when a protected page is opened without a session.
  // Wait until the loading state clears so we don't redirect during session restore.
  useEffect(() => {
    if (!loading && !initializing && isProtectedPage && !isLoggedIn) {
      navigation.dispatch(StackActions.replace("Auth", {
        initialMode: "login",
        requireAuth: true,
        postLoginTarget: {
          name: "BottomNavScreen",
          params: route.params,
        },
      }));
    }
  }, [initializing, isLoggedIn, loading, isProtectedPage, navigation, route.params]);

  useEffect(() => {
    // Check for bottom navigation updates on mount
    if (loading) return;
    if (isSearchPage && hasInitialBottomNav) return;
    checkAndUpdateBottomNav();
  }, [checkAndUpdateBottomNav, hasInitialBottomNav, isSearchPage, loading]);

  // Auto-refresh: polls live Builder DSL and updates when any page data changes.
  const sectionsFpRef = useRef(null);

  useEffect(() => {
    const intervalId = setInterval(async () => {
      if (dslRequestInFlightRef.current) return;
      dslRequestInFlightRef.current = true;

      try {
        const latest = await fetchDSL(appId, pageName);
        if (!latest?.dsl) return;
        if (latest.dsl?.__dslMissing && getSectionCount(latest.dsl) === 0) {
          const hdrFallback = null;
          setHeaderDefault(hdrFallback);
          setHeaderDefaultConfig(hdrFallback);
          setDsl({ ...latest.dsl, sections: homeHeaderSectionsRef.current, __dslMissing: true });
          setErr(null);
          return;
        }

        const incomingVersion = latest.versionNumber ?? null;
        const incomingFp = getDslFingerprint(latest.dsl);

        const versionChanged = incomingVersion !== null && incomingVersion !== versionRef.current;
        const contentChanged = incomingFp !== sectionsFpRef.current;

        if (versionChanged || contentChanged) {
          const headers = homeHeaderSectionsRef.current;
          const nextDsl = isHomePage
            ? latest.dsl
            : ensureHeaderSections(latest.dsl, headers);
          const hdrDefault = latest.dsl?.headerdefault ?? null;
          setPageTitleFromDsl(latest.dsl?.page?.name || latest.dsl?.page?.handle || title);
          setHeaderDefault(hdrDefault);
          setHeaderDefaultConfig(hdrDefault);
          setDsl(nextDsl);
          setErr(null);
          versionRef.current = incomingVersion;
          sectionsFpRef.current = incomingFp;
          console.log("DSL auto-refreshed on", pageName);
        }
        await checkAndUpdateBottomNav();
      } catch (error) {
        console.log("❌ Auto-refresh error:", error);
      } finally {
        dslRequestInFlightRef.current = false;
      }
    }, LIVE_DSL_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [appId, ensureHeaderSections, getDslFingerprint, isHomePage, pageName, checkAndUpdateBottomNav]);

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
        <PageEmptyStateProvider reportEmptyState={reportPageEmptyState}>
          <View
            style={[
              styles.container,
              (isCartPage || isProfilePage) ? styles.cartContainer : null,
            ]}
          >
          {/* Single standalone header for pages opened without the bottom nav. */}
          {hideBottomNav && !loading && !isHeaderDefaultEnabled && !isNotificationPage && (
            <View style={styles.standaloneHeader}>
              <TouchableOpacity
                onPress={handleStandaloneBack}
                style={styles.standaloneBackBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <HeaderIcon name="arrow-left-long" size={18} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.standaloneHeaderTitle} numberOfLines={1}>
                {pageTitleFromDsl || title}
              </Text>
              <View style={styles.standaloneBackBtn} />
            </View>
          )}
        {loading ? (
          <SkeletonLoader />
        ) : (
          /* DSL-driven page content — ScrollView always renders so pull-to-refresh works */
          <View style={{ flex: 1 }}>

          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={styles.scrollView}
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.scrollContent,
              (isCartPage || isProfilePage) ? styles.cartScrollContent : null,
              { paddingBottom: resolvedBottomNavSection && !hideBottomNav ? bottomNavHeight : 0 },
            ]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {isHeaderDefaultEnabled && (
              <HeaderDefault
                config={headerDefaultConfig}
                bottomNavSection={resolvedBottomNavSection}
                hideTabs={isProfilePage || isNotificationPage || isSearchPage || isCartPage}
                fallbackTitle=""
                disableDefaultTitlePress={isNotificationPage}
                showBack={hideBottomNav}
              />
            )}
            {err ? (
              <View style={styles.content}>
                <Text style={styles.error}>{err}</Text>
                <Text style={styles.linkText}>Pull down to refresh or reopen the page.</Text>
              </View>
            ) : visibleSections.length ? (
              visibleSections.map((section, index) => {
                const compName = getComponentName(section).toLowerCase();
                const nextSection = visibleSections[index + 1] || null;
                const nextCompName = nextSection ? getComponentName(nextSection).toLowerCase() : null;
                const isBannerSection = compName === "banner_slider" || compName === "hero_banner";
                const isProductSection = [
                  "product_grid", "product_carousel",
                  "tab_product_grid", "tab_product_carousel",
                ].includes(compName);
                const isNotificationSection = [
                  "notification_inbox",
                  "notification_list",
                  "notifications",
                ].includes(compName);
                const isAccountDslPage = isProfilePage && [
                  "account_profile",
                  "account_menu",
                  "profile_header",
                  "account_profile_header",
                  "text_block",
                  "currency_switcher",
                  "logout",
                ].includes(compName);
                const isHeavyHomeSection = [
                  "product_grid", "product_carousel",
                  "tab_product_grid", "tab_product_carousel",
                  "recent_products",
                ].includes(compName);
                if (isHomePage && !heavySectionsReady && index > 3 && isHeavyHomeSection) {
                  return null;
                }
                if (isCartPage && isCartEmpty && !CART_EMPTY_VISIBLE_COMPONENTS.has(compName)) {
                  return null;
                }
                if (isOrdersPage && isOrdersEmpty && !ORDERS_EMPTY_VISIBLE_COMPONENTS.has(compName)) {
                  return null;
                }
                if (isWishlistPage && isWishlistEmpty && !WISHLIST_EMPTY_VISIBLE_COMPONENTS.has(compName)) {
                  return null;
                }
                const homeSectionMarginBottom = isHomePage
                  ? getHomeSectionMarginBottom({
                      section,
                      componentName: compName,
                      nextComponentName: nextCompName,
                      nextSection,
                    })
                  : undefined;
                return (
                  <View
                    key={index}
                    style={[
                      styles.sectionWrapper,
                      !isHomePage && isSearchPage && styles.sectionWrapperTight,
                      !isHomePage && isAccountDslPage && styles.sectionWrapperTight,
                      !isHomePage && isBannerSection && styles.sectionWrapperBanner,
                      !isHomePage && isProductSection && !isSearchPage && styles.sectionWrapperProduct,
                      isHomePage && { marginBottom: homeSectionMarginBottom },
                    ]}
                  >
                    {isNotificationSection ? (
                      <NotificationList
                        section={section}
                        notifications={notifications}
                        loading={notificationsLoading}
                      />
                    ) : (
                      <DynamicRenderer section={section} />
                    )}
                  </View>
                );
              })
            ) : isNotificationPage ? (
              <NotificationList
                section={notificationInboxSection}
                notifications={notifications}
                loading={notificationsLoading}
              />
            ) : isProfilePage && !loading ? (
              session ? (
                <FallbackProfile session={session} logout={logout} navigation={navigation} />
              ) : null
            ) : (
              <View style={styles.content}>
                <Text style={styles.subtitleText}>{emptyStateTitle}</Text>
                <Text style={styles.linkText}>{emptyStateMessage}</Text>
              </View>
            )}
          </ScrollView>
          </View>
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
                  { width: sideMenuWidth, maxWidth: sideMenuWidth, transform: [{ translateX: sideMenuTranslateX }] },
                ]}
              >
                <SideNavigation section={sideNavSection || {}} />
              </Animated.View>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSideMenu} />
            </View>
          </View>
        )}

          {resolvedBottomNavSection && !hideBottomNav && (
            <View
              style={styles.bottomNav}
              onLayout={(e) => setBottomNavHeight(e.nativeEvent.layout.height)}
            >
              <BottomNavigation section={resolvedBottomNavSection} activeIndexOverride={activeIndex} />
            </View>
          )}
          </View>
        </PageEmptyStateProvider>
      </SideMenuProvider>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
  },
  cartContainer: {
    backgroundColor: "#FFFFFF",
  },
  standaloneHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  standaloneBackBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  standaloneHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  scrollView: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 0,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  cartScrollContent: {
    backgroundColor: "#FFFFFF",
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
    width: "100%",
    alignSelf: "stretch",
    marginBottom: 0,
  },
  sectionWrapperProduct: {
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
    elevation: 5,
  },
  // ── Fallback profile styles ────────────────────────────────────────────────
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#D9F0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarInitial: {
    fontSize: 24,
    fontWeight: "700",
    color: "#016D77",
  },
  profileAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 13,
    color: "#6B7280",
  },
  profileMenuContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  profileMenuItemLast: {
    borderBottomWidth: 0,
  },
  profileMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F0FDFD",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  profileMenuLabelLogout: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#EF4444",
  },
  profileMenuChevron: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  loginPromptBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 80,
    paddingTop: 40,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  loginPromptSub: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 20,
  },
  loginPromptBtn: {
    backgroundColor: "#016D77",
    borderRadius: 10,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  loginPromptBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});

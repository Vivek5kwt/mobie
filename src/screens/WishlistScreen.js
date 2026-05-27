import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { StackActions, useFocusEffect, useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Icon from "react-native-vector-icons/FontAwesome6";
import { dedupeWishlistProducts, toggleWishlist } from "../store/slices/wishlistSlice";
import Snackbar from "../components/Snackbar";
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";
import HeaderDefault from "../components/HeaderDefault";
import DynamicRenderer from "../engine/DynamicRenderer";
import { resolveFont } from "../services/typographyService";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "../components/FavoriteToggleButton";
import { formatMoney } from "../utils/money";
import { isAuthenticatedSession } from "../utils/authGate";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { getResponsiveColumns } from "../utils/responsiveLayout";

const LIVE_DSL_REFRESH_INTERVAL_MS = 3000;

// ── DSL helpers ───────────────────────────────────────────────────────────────
const unwrap = (v, fallback) => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
  }
  return v ?? fallback;
};
const toStr = (v, fb = "")  => { const r = unwrap(v, fb); return (r === undefined || r === null) ? fb : String(r); };
const toNum = (v, fb = 0)   => { const r = unwrap(v, fb); const n = parseFloat(r); return Number.isNaN(n) ? fb : n; };
const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");
const toAlign = (value, fallback = "left") => {
  const normalized = toStr(value, fallback).trim().toLowerCase();
  if (normalized === "center") return "center";
  if (normalized === "right" || normalized === "flex-end") return "right";
  return "left";
};

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

// Components that should NOT be rendered as free DSL sections on this screen
const SKIP_COMPS = new Set([
  "wishlist_item", "wishlist", "wishlist-item",
  "bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2",
  "header", "header_2", "header_mobile",
]);

// ── Component ─────────────────────────────────────────────────────────────────
export default function WishlistScreen() {
  const navigation    = useNavigation();
  const dispatch      = useDispatch();
  const { width: screenWidth } = useWindowDimensions();
  const { session, initializing } = useAuth();
  const isLoggedIn = isAuthenticatedSession(session);
  const wishlistItems = useSelector((state) => dedupeWishlistProducts(state.wishlist?.items || []));

  // Auth gate
  useFocusEffect(
    useCallback(() => {
      if (!initializing && !isLoggedIn) {
        navigation.dispatch(StackActions.replace("Auth", {
          initialMode: "login",
          requireAuth: true,
          postLoginTarget: { name: "Wishlist" },
        }));
      }
    }, [initializing, isLoggedIn, navigation])
  );

  const appId = useMemo(
    () => resolveAppId(session?.user?.appId ?? session?.user?.app_id),
    [session]
  );

  // ── DSL state ─────────────────────────────────────────────────────────────
  const [dslLoading,    setDslLoading]    = useState(true);
  const [wishlistProps, setWishlistProps] = useState(null);
  const [headerConfig,  setHeaderConfig]  = useState(null);
  const [otherSections, setOtherSections] = useState([]);
  const [snackVisible,  setSnackVisible]  = useState(false);
  const dslFingerprintRef = useRef(null);

  const loadDSL = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setDslLoading(true);
      const result = await fetchDSL(appId, "wishlist");
      const dsl    = result?.dsl || result;
      const fp = getDslFingerprint(dsl);
      if (fp === dslFingerprintRef.current) return;

      dslFingerprintRef.current = fp;
      setHeaderConfig(dsl?.headerdefault || null);

      const sections = dsl?.sections || [];

      // wishlist_item section → extract card styling props only
      const wishlistSection = sections.find((s) => {
        const c = normalizeComp(s);
        return c === "wishlist_item" || c === "wishlist";
      });

      const propsNode = wishlistSection
        ? (
            wishlistSection?.properties?.props?.properties ||
            wishlistSection?.properties?.props ||
            wishlistSection?.props ||
            {}
          )
        : null;
      setWishlistProps(propsNode);

      // All other renderable sections (text blocks, banners, spacers, etc.)
      setOtherSections(
        sections.filter((s) => {
          const c = normalizeComp(s);
          return c !== "" && !SKIP_COMPS.has(c);
        })
      );
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

  // ── Resolve DSL card-styling tokens ──────────────────────────────────────
  const p = wishlistProps || {};

  const pt          = toNum(p?.pt,          12);
  const pb          = toNum(p?.pb,          12);
  const pl          = toNum(p?.pl,          12);
  const pr          = toNum(p?.pr,          12);
  const outerPL     = toNum(p?.pl2 ?? p?.outerPl ?? p?.containerPl ?? p?.gridPl, pl);
  const outerPR     = toNum(p?.pr2 ?? p?.outerPr ?? p?.containerPr ?? p?.gridPr, pr);
  const radius      = toNum(p?.radius,      12);
  const bgColor     = toStr(p?.bgColor,     "#FFFFFF");
  const borderColor = toStr(p?.borderColor, "#E5E7EB");
  const borderSide  = toStr(p?.borderSide, "all").trim().toLowerCase();
  const borderWidth = toNum(p?.borderWidth ?? p?.borderSize, borderSide === "none" ? 0 : 1);
  const imageRadius = toNum(p?.imageRadius, 8);
  const imageBgColor = toStr(
    p?.imageBg ??
      p?.imageBgColor ??
      p?.imageBackgroundColor ??
      p?.productImageBgColor ??
      p?.productImageBackgroundColor,
    "#FFFFFF"
  );

  const imageResizeMode = resolveProductImageResizeMode(
    p?.imageScale,
    p?.scale,
    p?.imageResizeMode,
    p?.objectFit
  );

  const imageRatioStr = toStr(p?.imageRatio, "1:1");
  const imageAspect   = (() => {
    const parts = imageRatioStr.split(":");
    if (parts.length === 2) {
      const w = parseFloat(parts[0]); const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) return h / w;
    }
    return 1;
  })();

  const iconSize  = toNum(p?.iconSize,  18);
  const iconColor = toStr(p?.iconColor, "#EF4444");
  const favoriteToggleConfig = useMemo(
    () => buildFavoriteToggleConfig({ favIconSize: iconSize, favoriteIconColor: iconColor }),
    [iconSize, iconColor]
  );

  const titleColor      = toStr(p?.titleColor,      "#111827");
  const titleFontSize   = toNum(p?.titleFontSize,   14);
  const titleFontWeight = toStr(p?.titleFontWeight, "600");
  const titleFontFamily = resolveFont(toStr(p?.titleFontFamily ?? p?.fontFamily, ""));

  const priceColor      = toStr(p?.priceColor,      "#16A34A");
  const priceFontSize   = toNum(p?.priceFontSize,   14);
  const priceFontWeight = toStr(p?.priceFontWeight, "500");
  const priceAlign      = toAlign(p?.priceAlign,      "left");
  const priceFontFamily = resolveFont(toStr(p?.priceFontFamily ?? p?.fontFamily, ""));
  const countColor = toStr(p?.countColor ?? p?.labelColor ?? p?.titleColor, titleColor);
  const countFontSize = toNum(p?.countFontSize ?? p?.labelFontSize, titleFontSize);
  const countFontWeight = toStr(p?.countFontWeight ?? p?.labelFontWeight, titleFontWeight);
  const countFontFamily = resolveFont(toStr(p?.countFontFamily ?? p?.labelFontFamily ?? p?.titleFontFamily ?? p?.fontFamily, ""));
  const emptyBgColor = toStr(firstDefined(p?.emptyBgColor, p?.emptyBackgroundColor, p?.bgColor), "#FFFFFF");
  const emptyTitle = toStr(firstDefined(p?.emptyTitle, p?.emptyWishlistTitle), "Personal Collection");
  const emptySubtitle = toStr(
    firstDefined(p?.emptySubtitle, p?.emptyWishlistSubtitle),
    "Save your favorite products here."
  );
  const removeSnackbarMessage = toStr(
    firstDefined(p?.removeSnackbarMessage, p?.wishlistRemoveSnackbarMessage, p?.snackbarRemoveMessage),
    "Removed from Personal Collection"
  );

  const strikeColor           = toStr(p?.strikeColor,           "#9CA3AF");
  const strikeFontSize        = toNum(p?.strikeFontSize,        12);
  const strikepriceFontWeight = toStr(p?.strikepriceFontWeight, "400");

  // ── Layout math ───────────────────────────────────────────────────────────
  const requestedColumns = Math.max(1, Math.floor(toNum(p?.columns ?? p?.itemsPerRow, 2)));
  const gridGap = toNum(
    p?.gap ?? p?.gridGap ?? p?.itemGap ?? p?.columnGap,
    Math.max(0, Math.round((outerPL + outerPR) / 3))
  );
  const viewportWidth = Math.max(1, screenWidth);
  const columns = getResponsiveColumns({
    screenWidth: viewportWidth,
    requestedColumns,
    horizontalPadding: outerPL + outerPR,
    gap: gridGap,
    minCardWidth: 180,
    maxColumns: 6,
  });
  const rowGap = toNum(p?.rowGap ?? p?.verticalGap, gridGap);
  const contentGap = toNum(p?.contentGap ?? p?.textGap, Math.max(0, Math.round(gridGap / 3)));
  const countMarginBottom = toNum(p?.countMarginBottom ?? p?.labelMarginBottom, gridGap);
  const titleLineHeight = toNum(p?.titleLineHeight, Math.ceil(titleFontSize * 1.35));
  const priceLineHeight = toNum(p?.priceLineHeight, Math.ceil(priceFontSize * 1.25));
  const cardW = (viewportWidth - outerPL - outerPR - gridGap * (columns - 1)) / columns;
  const imgH  = cardW * imageAspect;

  // ── Single product card ───────────────────────────────────────────────────
  const renderCard = useCallback((item) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          width: cardW,
          borderRadius: radius,
          backgroundColor: bgColor,
          borderColor,
          borderWidth,
        },
      ]}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("ProductDetail", { product: item })}
    >
      <View style={{ position: "relative" }}>
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            style={{
              width:                "100%",
              height:               imgH,
              borderTopLeftRadius:  imageRadius,
              borderTopRightRadius: imageRadius,
              backgroundColor:      imageBgColor,
            }}
            resizeMode={imageResizeMode}
          />
        ) : (
          <View
            style={[
              styles.imgPlaceholder,
              { height: imgH, borderTopLeftRadius: imageRadius, borderTopRightRadius: imageRadius, backgroundColor: imageBgColor },
            ]}
          >
            <Text style={styles.placeholderLetter}>
              {(item.title || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <FavoriteToggleButton
          isFavorite
          config={favoriteToggleConfig}
          onPress={(e) => {
            e?.stopPropagation?.();
            e?.preventDefault?.();
            dispatch(toggleWishlist({ product: item }));
            setSnackVisible(true);
          }}
          accessibilityLabel="Remove from wishlist"
        />
      </View>

      <View
        style={[
          styles.cardBody,
          {
            paddingTop: pt,
            paddingBottom: pb,
            paddingLeft: pl,
            paddingRight: pr,
            gap: contentGap,
          },
        ]}
      >
        <Text
          numberOfLines={2}
          style={{
            fontSize:   titleFontSize,
            fontWeight: titleFontWeight,
            color:      titleColor,
            lineHeight:  titleLineHeight,
            ...(titleFontFamily ? { fontFamily: titleFontFamily } : null),
          }}
        >
          {item.title}
        </Text>

        <View
          style={[
            styles.priceRow,
            {
              justifyContent:
                priceAlign === "center"
                  ? "center"
                  : priceAlign === "right"
                    ? "flex-end"
                    : "flex-start",
              gap: contentGap,
            },
          ]}
        >
          <Text
            style={{
              color: priceColor,
              fontSize: priceFontSize,
              fontWeight: priceFontWeight,
              lineHeight: priceLineHeight,
              textAlign: priceAlign,
              ...(priceFontFamily ? { fontFamily: priceFontFamily } : null),
            }}
          >
            {formatMoney(item.price, item.currency || item.priceCurrency || item.currencySymbol)}
          </Text>
          {!!item.compareAtPrice && parseFloat(item.compareAtPrice) > parseFloat(item.price || 0) && (
            <Text
              style={{
                color:              strikeColor,
                fontSize:           strikeFontSize,
                fontWeight:         strikepriceFontWeight,
                textDecorationLine: "line-through",
                lineHeight:         priceLineHeight,
              }}
            >
              {formatMoney(item.compareAtPrice, item.currency || item.priceCurrency || item.currencySymbol)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ), [
    cardW, radius, bgColor, borderColor, borderWidth, imgH, imageRadius, imageResizeMode,
    favoriteToggleConfig, titleFontSize, titleFontWeight, titleColor, titleFontFamily,
    titleLineHeight, priceColor, priceFontSize, priceFontWeight, priceAlign, priceFontFamily,
    priceLineHeight, pt, pb, pl, pr, contentGap,
    strikeColor, strikeFontSize, strikepriceFontWeight,
    dispatch, navigation,
  ]);

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
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {wishlistItems.length > 0 && otherSections.map((section, i) => (
            <DynamicRenderer key={i} section={section} />
          ))}

          {wishlistItems.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────────────── */
            <View style={[styles.emptyWrap, { backgroundColor: emptyBgColor }]}>
              <Icon name="heart" size={52} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
            </View>
          ) : (
            /* ── Product grid ────────────────────────────────────────────── */
            <View style={{ paddingTop: pt, paddingBottom: pb + rowGap, paddingLeft: outerPL, paddingRight: outerPR }}>
              <Text
                style={[
                  styles.countLabel,
                  {
                    color: countColor,
                    fontSize: countFontSize,
                    fontWeight: countFontWeight,
                    marginBottom: countMarginBottom,
                    ...(countFontFamily ? { fontFamily: countFontFamily } : null),
                  },
                ]}
              >
                {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"} saved
              </Text>
              <View style={[styles.gridRow, { columnGap: gridGap, rowGap }]}>
                {wishlistItems.map((item, idx) => (
                  <React.Fragment key={String(item.id ?? idx)}>
                    {renderCard(item)}
                  </React.Fragment>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <Snackbar
        visible={snackVisible}
        message={removeSnackbarMessage}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        type="info"
      />
    </SafeArea>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centre: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },
  card: {
    overflow:    "hidden",
  },
  imgPlaceholder: {
    width:           "100%",
    backgroundColor: "#FFFFFF",
    alignItems:      "center",
    justifyContent:  "center",
  },
  placeholderLetter: {
    fontSize:   28,
    fontWeight: "700",
    color:      "#9CA3AF",
  },
  cardBody: {
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
  },
  countLabel: {
  },
  gridRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
  },
  emptyWrap: {
    flex:              1,
    minHeight:         360,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    paddingVertical:   48,
    gap:               12,
  },
  emptyTitle: {
    fontSize:   18,
    fontWeight: "700",
    color:      "#111827",
    marginTop:  8,
  },
  emptySubtitle: {
    fontSize:  14,
    color:     "#6B7280",
    textAlign: "center",
  },
  browseBtn: {
    marginTop:         16,
    backgroundColor:   "#111827",
    paddingVertical:   12,
    paddingHorizontal: 28,
    borderRadius:      8,
  },
  browseBtnText: {
    color:      "#FFFFFF",
    fontWeight: "600",
    fontSize:   14,
  },
});

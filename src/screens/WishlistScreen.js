import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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

const { width: SCREEN_W } = Dimensions.get("window");

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

const normalizeComp = (s) =>
  String(
    s?.component?.const || s?.component || s?.properties?.component?.const || ""
  ).trim().toLowerCase().replace(/[\s-]+/g, "_");

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
  const { session }   = useAuth();
  const wishlistItems = useSelector((state) => dedupeWishlistProducts(state.wishlist?.items || []));

  // Auth gate
  useFocusEffect(
    useCallback(() => {
      if (!session) {
        navigation.navigate("Auth", {
          initialMode: "login",
          requireAuth: true,
          postLoginTarget: { name: "Wishlist" },
        });
      }
    }, [session, navigation])
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

  const loadDSL = useCallback(async () => {
    try {
      setDslLoading(true);
      const result = await fetchDSL(appId, "wishlist");
      const dsl    = result?.dsl || result;

      if (dsl?.headerdefault) setHeaderConfig(dsl.headerdefault);

      const sections = dsl?.sections || [];

      // wishlist_item section → extract card styling props only
      const wishlistSection = sections.find((s) => {
        const c = normalizeComp(s);
        return c === "wishlist_item" || c === "wishlist";
      });

      if (wishlistSection) {
        const propsNode =
          wishlistSection?.properties?.props?.properties ||
          wishlistSection?.properties?.props ||
          wishlistSection?.props ||
          {};
        setWishlistProps(propsNode);
      }

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
      setDslLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadDSL(); }, [loadDSL]);

  // ── Resolve DSL card-styling tokens ──────────────────────────────────────
  const p = wishlistProps || {};

  const pt          = toNum(p?.pt,          12);
  const pb          = toNum(p?.pb,          12);
  const pl          = toNum(p?.pl,          12);
  const pr          = toNum(p?.pr,          12);
  const radius      = toNum(p?.radius,      12);
  const bgColor     = toStr(p?.bgColor,     "#FFFFFF");
  const borderColor = toStr(p?.borderColor, "#E5E7EB");
  const imageRadius = toNum(p?.imageRadius, 8);

  const imageScale      = toStr(p?.imageScale, "Fill").toLowerCase();
  const imageResizeMode = imageScale === "fit" || imageScale === "contain"
    ? "contain" : imageScale === "stretch" ? "stretch" : "cover";

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
  const priceAlign      = toStr(p?.priceAlign,      "left");

  const strikeColor           = toStr(p?.strikeColor,           "#9CA3AF");
  const strikeFontSize        = toNum(p?.strikeFontSize,        12);
  const strikepriceFontWeight = toStr(p?.strikepriceFontWeight, "400");

  // ── Layout math ───────────────────────────────────────────────────────────
  const GAP   = 12;
  const cardW = (SCREEN_W - pl - pr - GAP) / 2;
  const imgH  = cardW * imageAspect;

  // ── Single product card ───────────────────────────────────────────────────
  const renderCard = useCallback((item) => (
    <TouchableOpacity
      style={[
        styles.card,
        { width: cardW, borderRadius: radius, backgroundColor: bgColor, borderColor },
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
              backgroundColor:      "#F3F4F6",
            }}
            resizeMode={imageResizeMode}
          />
        ) : (
          <View
            style={[
              styles.imgPlaceholder,
              { height: imgH, borderTopLeftRadius: imageRadius, borderTopRightRadius: imageRadius },
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

      <View style={styles.cardBody}>
        <Text
          numberOfLines={2}
          style={{
            fontSize:   titleFontSize,
            fontWeight: titleFontWeight,
            color:      titleColor,
            ...(titleFontFamily ? { fontFamily: titleFontFamily } : null),
          }}
        >
          {item.title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={{ color: priceColor, fontSize: priceFontSize, fontWeight: priceFontWeight, textAlign: priceAlign }}>
            {item.currency} {parseFloat(item.price || 0).toFixed(2)}
          </Text>
          {!!item.compareAtPrice && parseFloat(item.compareAtPrice) > parseFloat(item.price || 0) && (
            <Text
              style={{
                color:              strikeColor,
                fontSize:           strikeFontSize,
                fontWeight:         strikepriceFontWeight,
                textDecorationLine: "line-through",
                marginLeft:         6,
              }}
            >
              {item.currency} {parseFloat(item.compareAtPrice).toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  ), [
    cardW, radius, bgColor, borderColor, imgH, imageRadius, imageResizeMode,
    favoriteToggleConfig, titleFontSize, titleFontWeight, titleColor, titleFontFamily,
    priceColor, priceFontSize, priceFontWeight, priceAlign,
    strikeColor, strikeFontSize, strikepriceFontWeight,
    dispatch, navigation,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!session) return null;

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
          {/* All non-wishlist DSL sections (text blocks, banners, spacers, etc.) */}
          {otherSections.map((section, i) => (
            <DynamicRenderer key={i} section={section} />
          ))}

          {wishlistItems.length === 0 ? (
            /* ── Empty state ──────────────────────────────────────────────── */
            <View style={styles.emptyWrap}>
              <Icon name="heart" size={52} color="#E5E7EB" />
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptySubtitle}>Save items you love and find them here.</Text>
              <TouchableOpacity
                style={styles.browseBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("LayoutScreen")}
              >
                <Text style={styles.browseBtnText}>Browse Products</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Product grid ────────────────────────────────────────────── */
            <View style={{ paddingTop: pt, paddingBottom: pb + 24, paddingLeft: pl, paddingRight: pr }}>
              <Text style={styles.countLabel}>
                {wishlistItems.length} {wishlistItems.length === 1 ? "item" : "items"} saved
              </Text>
              <View style={styles.gridRow}>
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
        message="Product removed from wishlist successfully."
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
    borderWidth: 1,
    overflow:    "hidden",
  },
  imgPlaceholder: {
    width:           "100%",
    backgroundColor: "#F3F4F6",
    alignItems:      "center",
    justifyContent:  "center",
  },
  placeholderLetter: {
    fontSize:   28,
    fontWeight: "700",
    color:      "#9CA3AF",
  },
  cardBody: {
    padding: 10,
    gap:     4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems:    "center",
    flexWrap:      "wrap",
  },
  countLabel: {
    fontSize:     13,
    color:        "#6B7280",
    marginBottom: 12,
    fontWeight:   "500",
  },
  gridRow: {
    flexDirection: "row",
    flexWrap:      "wrap",
    gap:           12,
  },
  emptyWrap: {
    flex:              1,
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

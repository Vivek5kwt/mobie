import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import Icon from "react-native-vector-icons/FontAwesome6";
import { toggleWishlist } from "../store/slices/wishlistSlice";
import Snackbar from "../components/Snackbar";
import { SafeArea } from "../utils/SafeAreaHandler";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { useAuth } from "../services/AuthContext";

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
const toStr  = (v, fb = "")    => { const r = unwrap(v, fb); return (r === undefined || r === null) ? fb : String(r); };
const toNum  = (v, fb = 0)     => { const r = unwrap(v, fb); const n = parseFloat(r); return Number.isNaN(n) ? fb : n; };

// ── Component ─────────────────────────────────────────────────────────────────
export default function WishlistScreen() {
  const navigation  = useNavigation();
  const dispatch    = useDispatch();
  const { session } = useAuth();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);

  const appId = useMemo(
    () => resolveAppId(session?.user?.appId ?? session?.user?.app_id),
    [session]
  );

  // ── DSL state ─────────────────────────────────────────────────────────────
  const [dslLoading,    setDslLoading]    = useState(true);
  const [wishlistProps, setWishlistProps] = useState(null);
  const [headerConfig,  setHeaderConfig]  = useState(null);
  const [snackVisible,  setSnackVisible]  = useState(false);

  const loadDSL = useCallback(async () => {
    try {
      setDslLoading(true);
      const result = await fetchDSL(appId, "wishlist");
      const dsl    = result?.dsl || result;

      // Extract headerdefault for header bar styling
      if (dsl?.headerdefault) setHeaderConfig(dsl.headerdefault);

      // Find the wishlist_item section
      const sections = dsl?.sections || [];
      const section  = sections.find((s) => {
        const comp = String(
          s?.component?.const || s?.component || s?.properties?.component?.const || ""
        ).toLowerCase();
        return comp === "wishlist_item";
      });

      if (section) {
        // Extract props node (handles both flat and nested DSL shapes)
        const propsNode =
          section?.properties?.props?.properties ||
          section?.properties?.props ||
          section?.props ||
          {};
        setWishlistProps(propsNode);
      }
    } catch (_) {
      // DSL fetch failed — component renders with defaults
    } finally {
      setDslLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadDSL(); }, [loadDSL]);

  // ── Resolve DSL tokens (with sensible defaults) ───────────────────────────
  const p = wishlistProps || {};   // shorthand — empty object = all defaults

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

  const titleColor      = toStr(p?.titleColor,      "#111827");
  const titleFontSize   = toNum(p?.titleFontSize,   14);
  const titleFontWeight = toStr(p?.titleFontWeight, "600");
  const titleFontFamily = toStr(p?.titleFontFamily, "");

  const priceColor      = toStr(p?.priceColor,      "#16A34A");
  const priceFontSize   = toNum(p?.priceFontSize,   14);
  const priceFontWeight = toStr(p?.priceFontWeight, "500");
  const priceAlign      = toStr(p?.priceAlign,      "left");

  const strikeColor           = toStr(p?.strikeColor,           "#9CA3AF");
  const strikeFontSize        = toNum(p?.strikeFontSize,        12);
  const strikepriceFontWeight = toStr(p?.strikepriceFontWeight, "400");

  // ── Header bar tokens from headerdefault DSL ──────────────────────────────
  const hd          = headerConfig || {};
  const headerBg    = toStr(hd?.backgroundColor ?? hd?.bgColor, "#FFFFFF");
  const headerText  = toStr(hd?.textColor,  "#111827");
  const headerIcon  = toStr(hd?.iconColor,  "#111827");
  const pageTitle   = toStr(hd?.title,      "Wishlist");

  // ── Layout math ───────────────────────────────────────────────────────────
  const GAP   = 12;
  const cardW = (SCREEN_W - pl - pr - GAP) / 2;
  const imgH  = cardW * imageAspect;

  // ── Back navigation ───────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("LayoutScreen");
    }
  }, [navigation]);

  // ── Render a single wishlist card ─────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { width: cardW, borderRadius: radius, backgroundColor: bgColor, borderColor },
      ]}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("ProductDetail", { product: item })}
    >
      {/* Product image */}
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

        {/* Remove-from-wishlist heart */}
        <TouchableOpacity
          style={styles.heartBtn}
          activeOpacity={0.8}
          onPress={() => {
            dispatch(toggleWishlist({ product: item }));
            setSnackVisible(true);
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Icon name="heart" size={iconSize} color={iconColor} solid />
        </TouchableOpacity>
      </View>

      {/* Card body */}
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
    iconSize, iconColor, titleFontSize, titleFontWeight, titleColor, titleFontFamily,
    priceColor, priceFontSize, priceFontWeight, priceAlign,
    strikeColor, strikeFontSize, strikepriceFontWeight,
    dispatch, navigation,
  ]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeArea>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: headerBg === "#FFFFFF" ? "#F3F4F6" : "transparent" }]}>
        <TouchableOpacity
          style={styles.headerSide}
          activeOpacity={0.7}
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-left" size={18} color={headerIcon} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: headerText }]} numberOfLines={1}>
          {pageTitle}
        </Text>

        {/* Spacer keeps title centred */}
        <View style={styles.headerSide} />
      </View>

      {/* ── DSL loading spinner ──────────────────────────────────────────── */}
      {dslLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator size="large" color="#016D77" />
        </View>

      ) : wishlistItems.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────────── */
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
        /* ── Wishlist grid ────────────────────────────────────────────────── */
        <FlatList
          data={wishlistItems}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{
            paddingTop:        pt,
            paddingBottom:     pb + 24,
            paddingHorizontal: pl,
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          renderItem={renderItem}
        />
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
  header: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 16,
    paddingVertical:   12,
    backgroundColor:   "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerSide: {
    width:      36,
    alignItems: "center",
  },
  headerTitle: {
    flex:       1,
    textAlign:  "center",
    fontSize:   17,
    fontWeight: "700",
    color:      "#111827",
  },
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
  heartBtn: {
    position:        "absolute",
    top:             8,
    right:           8,
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems:      "center",
    justifyContent:  "center",
    elevation:       2,
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
  emptyWrap: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
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

import React, { useCallback, useEffect, useState } from "react";
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
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import { fetchShopifyCollectionProducts, fetchShopifyProductsPage } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import { addItem } from "../store/slices/cartSlice";
import Header from "../components/Topheader";
import FilterSortHeader from "../components/FilterSortHeader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";

const PAGE_SIZE = 20;
const GAP = 12;
const H_PAD = 16;
const { width: SCREEN_W } = Dimensions.get("window");

function sortProducts(products, sortKey) {
  const copy = [...products];
  switch (sortKey) {
    case "Price: Low":
      return copy.sort((a, b) => parseFloat(a.priceAmount || 0) - parseFloat(b.priceAmount || 0));
    case "Price: High":
      return copy.sort((a, b) => parseFloat(b.priceAmount || 0) - parseFloat(a.priceAmount || 0));
    case "Newest":
      return copy.reverse();
    default:
      return copy;
  }
}

function isProductAvailable(product) {
  if (!product || typeof product !== "object") return true;
  if (product.availableForSale === false) return false;
  const inventory =
    product.inventoryQuantity ??
    product.totalInventory ??
    product.stockQuantity ??
    product.quantityAvailable;
  if (typeof inventory === "number" && inventory <= 0) return false;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const anyVariantAvailable = product.variants.some((variant) => variant?.availableForSale !== false);
    if (!anyVariantAvailable) return false;
  }
  return true;
}

export default function CollectionProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { collectionHandle, collectionTitle } = route?.params || {};

  const [products, setProducts]       = useState([]);
  const [pageInfo, setPageInfo]       = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState("");
  const [isFallback, setIsFallback]   = useState(false);
  const [favorites, setFavorites]     = useState({});
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight]   = useState(BOTTOM_NAV_RESERVED_HEIGHT);

  // FilterSortHeader state
  const [sortKey, setSortKey]       = useState("Popular");
  const [viewMode, setViewMode]     = useState("grid"); // "grid" | "list"
  const [activeFilter, setActiveFilter] = useState(null);

  const numColumns = viewMode === "list" ? 1 : 2;
  const CARD_W = viewMode === "list"
    ? SCREEN_W - H_PAD * 2
    : (SCREEN_W - H_PAD * 2 - GAP) / 2;

  const loadProducts = useCallback(
    async ({ after = null, append = false } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        // Try collection-specific products first
        if (collectionHandle) {
          const payload = await fetchShopifyCollectionProducts({
            handle: collectionHandle,
            first: PAGE_SIZE,
            after,
          });
          const next     = payload?.products || [];
          const nextPage = payload?.pageInfo || { hasNextPage: false, endCursor: null };

          if (next.length > 0 || after) {
            // Has real collection data (or paginating through it)
            setIsFallback(false);
            setProducts((prev) => (append ? [...prev, ...next] : next));
            setPageInfo(nextPage);
            return;
          }
        }

        // Collection empty or handle missing — fall back to all products
        if (!append) {
          setIsFallback(true);
          const fallback = await fetchShopifyProductsPage({ first: PAGE_SIZE });
          const next     = fallback?.products || [];
          const nextPage = fallback?.pageInfo || { hasNextPage: false, endCursor: null };
          setProducts(next);
          setPageInfo(nextPage);
        }
      } catch (_) {
        setError("Unable to load products right now.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionHandle]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAddToCart = (product) => {
    dispatch(
      addItem({
        item: {
          id: product.variantId || product.id,
          variantId: product.variantId || "",
          handle: product.handle || "",
          title: product.title || "",
          image: product.imageUrl || "",
          price: parseFloat(product.priceAmount) || 0,
          variant: "",
          currency: product.priceCurrency || "",
          quantity: 1,
        },
      })
    );
  };

  const toggleFav = (id) =>
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));

  // Apply sort + optional filter
  const displayProducts = React.useMemo(() => {
    let list = sortProducts(products, sortKey);
    if (activeFilter) {
      list = list.filter((p) =>
        (p.title || "").toLowerCase().includes(activeFilter.toLowerCase())
      );
    }
    return list;
  }, [products, sortKey, activeFilter]);

  const renderItem = ({ item }) => {
    const inStock = isProductAvailable(item);
    const isFav   = !!favorites[item.id];
    const isListMode = viewMode === "list";

    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_W }, isListMode && styles.cardList]}
        activeOpacity={0.88}
        onPress={() =>
          navigation.navigate("ProductDetail", { product: item })
        }
      >
        {/* Product image */}
        <View style={[styles.imageWrap, isListMode && styles.imageWrapList]}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[styles.image, isListMode && styles.imageList]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.image, isListMode && styles.imageList, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {(item.title || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Favourite toggle */}
          <TouchableOpacity
            style={styles.favBtn}
            activeOpacity={0.8}
            onPress={() => toggleFav(item.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={[styles.favIcon, isFav && styles.favActive]}>
              {isFav ? "♥" : "♡"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text numberOfLines={isListMode ? 1 : 2} style={styles.productName}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {parseFloat(item.priceAmount || 0).toFixed(2)}
          </Text>
          <TouchableOpacity
            style={inStock ? styles.cartBtnActive : styles.cartBtnSoldOut}
            activeOpacity={inStock ? 0.8 : 1}
            disabled={!inStock}
            onPress={() => inStock && handleAddToCart(item)}
          >
            <Text style={inStock ? styles.cartBtnTextActive : styles.cartBtnTextSoldOut}>
              {inStock ? "Add To Cart" : "Unavailable"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    const appId = resolveAppId();
    let mounted = true;
    fetchDSL(appId, "home").then((data) => {
      if (!mounted) return;
      const nav = (data?.dsl?.sections || []).find((s) => {
        const c = (
          s?.component?.const || s?.component ||
          s?.properties?.component?.const || s?.properties?.component || ""
        ).toLowerCase();
        return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(c);
      });
      if (nav) setBottomNavSection(nav);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <SafeArea>
      <View style={styles.container}>
        <Header />

        {/* Section title row */}
        <View style={styles.sectionRow}>
          <View style={styles.titleColumn}>
            <Text style={styles.sectionTitle}>
              {collectionTitle || "Products"}
            </Text>
            {isFallback && (
              <Text style={styles.fallbackNote}>
                Showing all products
              </Text>
            )}
          </View>
          {pageInfo.hasNextPage && (
            <TouchableOpacity
              onPress={() => loadProducts({ after: pageInfo.endCursor, append: true })}
            >
              <Text style={styles.viewAll}>View all &gt;</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter + Sort header bar */}
        <FilterSortHeader
          section={{}}
          onSortChange={(opt) => setSortKey(opt)}
          onViewModeChange={(mode) => setViewMode(mode)}
          onFilterChange={(filter) => setActiveFilter(filter)}
        />

        <View style={styles.body}>
          {loading && (
            <ActivityIndicator style={styles.loader} size="small" color="#016D77" />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}

          {!loading && !error && (
            <FlatList
              key={`cols-${numColumns}`}
              data={displayProducts}
              keyExtractor={(item) => String(item.id)}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? { gap: GAP } : undefined}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.list,
                { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 32 },
              ]}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.empty}>No products in this collection.</Text>
              }
              ListFooterComponent={
                pageInfo.hasNextPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={() => loadProducts({ after: pageInfo.endCursor, append: true })}
                    disabled={loadingMore}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.loadMoreText}>
                      {loadingMore ? "Loading…" : "Load more"}
                    </Text>
                  </TouchableOpacity>
                ) : null
              }
            />
          )}
        </View>

        {bottomNavSection && (
          <View
            style={styles.bottomNav}
            onLayout={(e) => setBottomNavHeight(e.nativeEvent.layout.height)}
          >
            <BottomNavigation section={bottomNavSection} />
          </View>
        )}
      </View>
    </SafeArea>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingTop: 14,
    paddingBottom: 8,
  },
  titleColumn: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#016D77",
  },
  fallbackNote: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    color: "#016D77",
  },

  body: {
    flex: 1,
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },

  list: {
    paddingBottom: 32,
    rowGap: GAP,
  },

  // ── Card (grid) ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardList: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageWrap: {
    position: "relative",
  },
  imageWrapList: {
    width: 100,
    flexShrink: 0,
  },
  image: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#F3F4F6",
  },
  imageList: {
    width: 100,
    height: 100,
    aspectRatio: undefined,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  favBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  favIcon: {
    fontSize: 13,
    color: "#9CA3AF",
    lineHeight: 15,
  },
  favActive: {
    color: "#EF4444",
  },
  cardBody: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#016D77",
    lineHeight: 16,
  },
  price: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
  },
  cartBtnActive: {
    marginTop: 4,
    backgroundColor: "#111111",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  cartBtnSoldOut: {
    marginTop: 4,
    backgroundColor: "#7A7A7A",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  cartBtnTextActive: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cartBtnTextSoldOut: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  loader: { marginTop: 32 },
  error: { textAlign: "center", color: "#B91C1C", paddingVertical: 12 },
  empty: { textAlign: "center", color: "#6B7280", paddingVertical: 32, fontSize: 14 },
  loadMoreBtn: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: "#111111",
    marginTop: 12,
    marginBottom: 8,
  },
  loadMoreText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
});

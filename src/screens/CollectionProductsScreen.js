import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { fetchShopifyCollectionProducts, fetchShopifyProductsPage } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import { addItem } from "../store/slices/cartSlice";
import { isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import HeaderDefault from "../components/HeaderDefault";
import FilterSortHeader from "../components/FilterSortHeader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import Snackbar from "../components/Snackbar";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { buildProductFilterOptions, productMatchesFilter } from "../utils/productFilters";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "../components/FavoriteToggleButton";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { formatMoney } from "../utils/money";
import { getResponsiveColumns } from "../utils/responsiveLayout";
import { ADD_TO_CART_SUCCESS_MESSAGE } from "../utils/cartFeedback";

const PAGE_SIZE = 20;
const GAP = 12;
const H_PAD = 16;

const getComponentName = (section = {}) =>
  String(
    section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      section?.properties?.component ||
      ""
  ).toLowerCase();

const findFilterSortSection = (dsl = {}) =>
  (dsl?.sections || []).find((section) => {
    const component = getComponentName(section);
    return component === "filter_sort_header" || component === "filter_sort";
  }) || null;

const productCurrency = (product = {}) =>
  product.priceCurrency ||
  product.currency ||
  product.currencySymbol ||
  product.priceAmount?.currencyCode ||
  product.priceAmount?.currency ||
  product.price?.currencyCode ||
  product.price?.currency ||
  "";

const moneyAmount = (value) => {
  if (value && typeof value === "object") return value.amount ?? value.value ?? "";
  return value;
};

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

const normalizePageInfo = (info, products = []) => {
  const endCursor = info?.endCursor || null;
  return {
    hasNextPage: Boolean(info?.hasNextPage && endCursor && products.length > 0),
    endCursor,
  };
};

function isProductAvailable(product) {
  if (!product || typeof product !== "object") return true;
  if (product.availableForSale === false || String(product.availableForSale).trim().toLowerCase() === "false") return false;
  const inventory =
    product.inventoryQuantity ??
    product.totalInventory ??
    product.stockQuantity ??
    product.quantityAvailable;
  if (typeof inventory === "number" && inventory <= 0) return false;
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const anyVariantAvailable = product.variants.some(isVariantAvailable);
    if (!anyVariantAvailable) return false;
  }
  return true;
}

function isVariantAvailable(variant) {
  return (
    variant?.availableForSale !== false &&
    String(variant?.availableForSale).trim().toLowerCase() !== "false"
  );
}

export default function CollectionProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const { width: screenWidth } = useWindowDimensions();
  const { session, initializing } = useAuth();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const {
    collectionHandle,
    handle,
    collectionTitle,
    title,
    label,
    sourcePageName,
  } = route?.params || {};
  const resolvedCollectionHandle = collectionHandle || handle || "";
  const resolvedCollectionTitle = collectionTitle || title || label || "Products";

  const [products, setProducts]       = useState([]);
  const [pageInfo, setPageInfo]       = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState("");
  const [isFallback, setIsFallback]   = useState(false);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight]   = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [homeHeaderConfig, setHomeHeaderConfig] = useState(null);
  const [productListHeaderConfig, setProductListHeaderConfig] = useState(null);
  const [productListFilterSortSection, setProductListFilterSortSection] = useState(null);
  const [filterOptions, setFilterOptions] = useState([]);
  const [cartSnackbarVisible, setCartSnackbarVisible] = useState(false);
  const [cartSnackbarMessage, setCartSnackbarMessage] = useState("");
  const favoriteTapRef = useRef(false);
  const cartSnackbarTimerRef = useRef(null);

  // FilterSortHeader state
  const [sortKey, setSortKey]       = useState("Popular");
  const [viewMode, setViewMode]     = useState("grid"); // "grid" | "list"
  const [activeFilter, setActiveFilter] = useState(null);

  const viewportWidth = Math.max(1, screenWidth);
  const numColumns = viewMode === "list"
    ? 1
    : getResponsiveColumns({
        screenWidth: viewportWidth,
        requestedColumns: 2,
        horizontalPadding: H_PAD * 2,
        gap: GAP,
        minCardWidth: 190,
        maxColumns: 6,
      });
  const CARD_W = viewMode === "list"
    ? viewportWidth - H_PAD * 2
    : (viewportWidth - H_PAD * 2 - GAP * (numColumns - 1)) / numColumns;
  const favoriteToggleConfig = buildFavoriteToggleConfig();

  useEffect(() => () => {
    if (cartSnackbarTimerRef.current) clearTimeout(cartSnackbarTimerRef.current);
  }, []);

  const loadProducts = useCallback(
    async ({ after = null, append = false } = {}) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        // Try collection-specific products first.
        if (resolvedCollectionHandle) {
          const payload = await fetchShopifyCollectionProducts({
            handle: resolvedCollectionHandle,
            first: PAGE_SIZE,
            after,
          });
          const next     = payload?.products || [];
          const nextPage = normalizePageInfo(payload?.pageInfo, next);

          setIsFallback(false);
          setProducts((prev) => (append ? [...prev, ...next] : next));
          if (!append) setFilterOptions(buildProductFilterOptions(next));
          setPageInfo(nextPage);
          return;
        }

        // Only the generic product-list route falls back to all products.
        setIsFallback(true);
        const fallback = await fetchShopifyProductsPage({ first: PAGE_SIZE, after });
        const next     = fallback?.products || [];
        const nextPage = normalizePageInfo(fallback?.pageInfo, next);
        setProducts((prev) => (append ? [...prev, ...next] : next));
        if (!append) setFilterOptions(buildProductFilterOptions(next));
        setPageInfo(nextPage);
      } catch (_) {
        setError("Unable to load products right now.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [resolvedCollectionHandle]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let mounted = true;
    const loadStoreFilters = async () => {
      try {
        const payload = resolvedCollectionHandle
          ? await fetchShopifyCollectionProducts({ handle: resolvedCollectionHandle, first: 100 })
          : await fetchShopifyProductsPage({ first: 100 });
        if (!mounted) return;
        const nextOptions = buildProductFilterOptions(payload?.products || []);
        if (nextOptions.length) setFilterOptions(nextOptions);
      } catch (_) {}
    };
    loadStoreFilters();
    return () => { mounted = false; };
  }, [resolvedCollectionHandle]);

  const handleAddToCart = (product) => {
    const availableVariant =
      product?.variants?.find(isVariantAvailable) ||
      product?.variants?.[0];
    const variantId = product.variantId || availableVariant?.id || "";
    dispatch(
      addItem({
        item: {
          id: variantId || product.id,
          variantId,
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
    if (cartSnackbarTimerRef.current) clearTimeout(cartSnackbarTimerRef.current);
    setCartSnackbarVisible(false);
    setCartSnackbarMessage(ADD_TO_CART_SUCCESS_MESSAGE);
    cartSnackbarTimerRef.current = setTimeout(() => setCartSnackbarVisible(true), 0);
  };

  // Apply sort + optional filter
  const displayProducts = React.useMemo(() => {
    let list = sortProducts(products, sortKey);
    if (activeFilter) {
      list = list.filter((p) => productMatchesFilter(p, activeFilter));
    }
    return list;
  }, [products, sortKey, activeFilter]);

  const hasNextProductPage = Boolean(pageInfo?.hasNextPage && pageInfo?.endCursor);
  const handleLoadMore = useCallback(() => {
    if (!hasNextProductPage || loading || loadingMore) return;
    loadProducts({ after: pageInfo.endCursor, append: true });
  }, [hasNextProductPage, loadProducts, loading, loadingMore, pageInfo?.endCursor]);

  const renderItem = ({ item }) => {
    const inStock = isProductAvailable(item);
    const isFav   = isWishlistProduct(wishlistItems, item);
    const isListMode = viewMode === "list";

    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_W }, isListMode && styles.cardList]}
        activeOpacity={0.88}
        onPress={() => {
          if (favoriteTapRef.current) {
            favoriteTapRef.current = false;
            return;
          }
          navigation.navigate("ProductDetail", { product: item });
        }}
      >
        {/* Product image */}
        <View style={[styles.imageWrap, isListMode && styles.imageWrapList]}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={[styles.image, isListMode && styles.imageList]}
              resizeMode={resolveProductImageResizeMode()}
            />
          ) : (
            <View style={[styles.image, isListMode && styles.imageList, styles.placeholder]}>
              <Text style={styles.placeholderText}>
                {(item.title || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {/* Favourite toggle */}
          <FavoriteToggleButton
            isFavorite={isFav}
            config={favoriteToggleConfig}
            onPress={async (e) => {
              e?.stopPropagation?.();
              e?.preventDefault?.();
              const blocked = await requireLoginForAction({ session, navigation, initializing });
              if (blocked) return;
              favoriteTapRef.current = true;
              setTimeout(() => {
                favoriteTapRef.current = false;
              }, 0);
              dispatch(toggleWishlist({ product: item }));
            }}
          />
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text numberOfLines={isListMode ? 1 : 2} style={styles.productName}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {formatMoney(
              moneyAmount(item.priceAmount ?? item.price),
              productCurrency(item)
            )}
          </Text>
          <TouchableOpacity
            style={inStock ? styles.cartBtnActive : styles.cartBtnSoldOut}
            activeOpacity={inStock ? 0.8 : 1}
            disabled={!inStock}
            onPress={(e) => {
              e?.stopPropagation?.();
              e?.preventDefault?.();
              if (inStock) handleAddToCart(item);
            }}
          >
            <Text style={inStock ? styles.cartBtnTextActive : styles.cartBtnTextSoldOut}>
              {inStock ? "Add To Cart" : "Item Not Available"}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    const appId = resolveAppId();
    let mounted = true;
    const pageCandidates = Array.from(new Set([
      sourcePageName,
      resolvedCollectionHandle,
      resolvedCollectionTitle,
      "collections",
      "collection",
      "product-list",
    ].filter(Boolean)));
    Promise.all([
      fetchDSL(appId, "home").catch(() => null),
      fetchDSL(appId, "product-list").catch(() => null),
      Promise.all(pageCandidates.map((page) => fetchDSL(appId, page).catch(() => null))),
    ]).then(([data, productListData, pageResults]) => {
      if (!mounted) return;
      const productListDsl = productListData?.dsl || productListData || {};
      const matchedPageHeaderConfig = (pageResults || [])
        .map((pageData) => (pageData?.dsl || pageData || {})?.headerdefault)
        .find(Boolean);
      setHomeHeaderConfig(data?.dsl?.headerdefault || null);
      setProductListHeaderConfig(matchedPageHeaderConfig || productListDsl?.headerdefault || null);
      setProductListFilterSortSection(findFilterSortSection(productListDsl));
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
  }, [resolvedCollectionHandle, resolvedCollectionTitle, sourcePageName]);

  const resultHeaderConfig = productListHeaderConfig || homeHeaderConfig;
  const resolvedTitleColor = String(
    resultHeaderConfig?.pageTitleColor ?? resultHeaderConfig?.textColor ?? "#111827"
  );
  const resolvedTitleSize = (() => {
    const candidates = [
      resultHeaderConfig?.pageTitleFontSize,
      resultHeaderConfig?.pageTitleSize,
    ];
    for (const v of candidates) {
      if (v === undefined || v === null || v === "") continue;
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 18;
  })();

  return (
    <SafeArea edges={["top", "left", "right"]}>
      <View style={styles.container}>
        {resultHeaderConfig ? (
          <HeaderDefault
            config={resultHeaderConfig}
            bottomNavSection={bottomNavSection}
            hideTabs
            showBack
          />
        ) : null}

        {/* Section title row */}
        <View style={styles.sectionRow}>
          <View style={styles.titleColumn}>
            <Text style={[styles.sectionTitle, { color: resolvedTitleColor, fontSize: resolvedTitleSize }]}>
              {resolvedCollectionTitle}
            </Text>
            {isFallback && (
              <Text style={styles.fallbackNote}>
                Showing all products
              </Text>
            )}
          </View>
        </View>

        {/* Filter + Sort header bar */}
        <FilterSortHeader
          section={productListFilterSortSection || {}}
          filterItems={filterOptions}
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
                hasNextProductPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreBtn}
                    onPress={handleLoadMore}
                    disabled={loading || loadingMore}
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

        <Snackbar
          visible={cartSnackbarVisible}
          message={cartSnackbarMessage}
          onDismiss={() => setCartSnackbarVisible(false)}
          duration={2500}
          type="success"
        />
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
    fontWeight: "700",
  },
  fallbackNote: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
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
    backgroundColor: "#FFFFFF",
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

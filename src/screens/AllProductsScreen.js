import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { fetchShopifyProductsPage, searchShopifyProducts } from "../services/shopify";
import { SafeArea } from "../utils/SafeAreaHandler";
import HeaderDefault from "../components/HeaderDefault";
import FilterSortHeader from "../components/FilterSortHeader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { buildProductFilterOptions, productMatchesFilter } from "../utils/productFilters";
import { formatMoney } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";

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

const COLOR_ALIASES = {
  black: "#050505",
  white: "#FFFFFF",
  blue: "#2F6DF6",
  navy: "#1F3A5F",
  purple: "#B25AD8",
  pink: "#F48FB1",
  green: "#9BE36D",
  teal: "#25C7D9",
  aqua: "#55DDE0",
  red: "#EF4444",
  orange: "#F97316",
  yellow: "#FACC15",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
};

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const moneyAmount = (value) => {
  if (value && typeof value === "object") return value.amount ?? value.value ?? "";
  return value;
};

const priceValue = (product) =>
  toNumber(moneyAmount(product?.priceAmount ?? product?.price ?? product?.minPrice));

const comparePriceValue = (product) =>
  toNumber(moneyAmount(product?.compareAtPrice ?? product?.originalPrice ?? product?.compareAt));

const discountLabel = (product) => {
  const price = priceValue(product);
  const compare = comparePriceValue(product);
  if (!price || !compare || compare <= price) return "";
  return `${Math.round(((compare - price) / compare) * 100)}% OFF`;
};

const optionValues = (product) => {
  const options = Array.isArray(product?.options) ? product.options : [];
  const colorOption = options.find((option) =>
    /color|colour|style|print|pattern/i.test(String(option?.name || ""))
  );
  const values = colorOption?.values || options.flatMap((option) => option?.values || []);
  return Array.from(new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean)));
};

const swatchColor = (value, index) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) return normalized;
  const key = Object.keys(COLOR_ALIASES).find((name) => normalized.includes(name));
  if (key) return COLOR_ALIASES[key];
  const palette = ["#050505", "#B25AD8", "#4469D9", "#55DDE0", "#9BE36D", "#F48FB1"];
  return palette[index % palette.length];
};

const productRating = (product) => {
  const raw = product?.rating ?? product?.reviewRating ?? product?.ratingValue;
  const parsed = toNumber(typeof raw === "object" ? raw?.value : raw);
  return parsed && parsed > 0 ? Math.min(5, parsed) : 0;
};

const productReviewCount = (product) => {
  const raw = product?.ratingCount ?? product?.reviewCount ?? product?.reviewsCount;
  const parsed = parseInt(typeof raw === "object" ? raw?.value : raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const PAGE_SIZE = 20;

export default function AllProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { title, detailSections } = route?.params || {};
  const searchTerm = String(route?.params?.query ?? route?.params?.searchQuery ?? "").trim();
  const isSearchMode = searchTerm.length > 0;
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0)
  );

  const [products, setProducts]       = useState([]);
  const [pageInfo, setPageInfo]       = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState("");
  const [sortKey, setSortKey]         = useState("Popular");
  const [viewMode, setViewMode]       = useState("grid");
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [filterOptions, setFilterOptions] = useState([]);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight]   = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [homeHeaderConfig, setHomeHeaderConfig] = useState(null);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const updateSearchParams = useCallback(
    (nextSearchTerm) => {
      const next = String(nextSearchTerm ?? "").trim();
      if (!next || next === searchTerm) {
        return;
      }
      setActiveFilter(null);
      navigation.setParams?.({
        query: next,
        searchQuery: next,
        title: `Search results for "${next}"`,
      });
    },
    [navigation, searchTerm]
  );

  useEffect(() => {
    if (!isSearchMode) {
      return undefined;
    }
    const next = searchInput.trim();
    if (!next || next === searchTerm) {
      return undefined;
    }
    const timeout = setTimeout(() => updateSearchParams(next), 450);
    return () => clearTimeout(timeout);
  }, [isSearchMode, searchInput, searchTerm, updateSearchParams]);

  const submitSearch = useCallback(() => {
    updateSearchParams(searchInput);
  }, [searchInput, updateSearchParams]);

  const numColumns = viewMode === "list" ? 1 : 2;
  const CARD_W = viewMode === "list"
    ? SCREEN_W - H_PAD * 2
    : (SCREEN_W - H_PAD * 2 - GAP) / 2;
  const searchImageHeight = viewMode === "list" ? 112 : Math.round(CARD_W * 1.42);

  const loadProducts = useCallback(async ({ after = null, append = false } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      let nextProducts = [];
      let nextPageInfo = { hasNextPage: false, endCursor: null };

      if (isSearchMode) {
        if (append) return;
        nextProducts = await searchShopifyProducts(searchTerm, 250);
      } else {
        const payload = await fetchShopifyProductsPage({
          first: PAGE_SIZE,
          after,
        });
        nextProducts = payload?.products || [];
        nextPageInfo = payload?.pageInfo || { hasNextPage: false, endCursor: null };
      }

      setProducts((prev) => (append ? [...prev, ...nextProducts] : nextProducts));
      if (!append) setFilterOptions(buildProductFilterOptions(nextProducts));
      setPageInfo(nextPageInfo);
    } catch (err) {
      setError(
        isSearchMode
          ? "Unable to search products right now. Please try again later."
          : "Unable to load products right now. Please try again later."
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isSearchMode, searchTerm]);

  useEffect(() => {
    loadProducts({ after: null, append: false });
  }, [loadProducts]);

  useEffect(() => {
    let mounted = true;
    if (isSearchMode) {
      return () => { mounted = false; };
    }
    fetchShopifyProductsPage({ first: 100 })
      .then((payload) => {
        if (!mounted) return;
        const nextOptions = buildProductFilterOptions(payload?.products || []);
        if (nextOptions.length) setFilterOptions(nextOptions);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [isSearchMode]);

  useEffect(() => {
    const appId = resolveAppId();
    let mounted = true;
    fetchDSL(appId, "home").then((data) => {
      if (!mounted) return;
      setHomeHeaderConfig(data?.dsl?.headerdefault || null);
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

  const handleLoadMore = () => {
    if (loadingMore || !pageInfo?.hasNextPage) return;
    loadProducts({ after: pageInfo?.endCursor, append: true });
  };

  const displayProducts = useMemo(() => {
    const filtered = activeFilter
      ? products.filter((product) => productMatchesFilter(product, activeFilter))
      : products;
    return sortProducts(filtered, sortKey);
  }, [products, sortKey, activeFilter]);

  const openCart = () => {
    navigation.navigate("BottomNavScreen", {
      title: "Cart",
      pageName: "cart",
      link: "cart",
      bottomNavSection,
    });
  };

  const openSearchPage = () => {
    navigation.navigate("BottomNavScreen", {
      title: "Search",
      pageName: "search",
      link: "search",
      bottomNavSection,
      query: searchTerm,
    });
  };

  const goBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    openSearchPage();
  };

  const renderItem = ({ item }) => {
    const isListMode = viewMode === "list";
    if (isSearchMode) {
      const swatches = optionValues(item);
      const extraSwatches = Math.max(0, swatches.length - 4);
      const price = formatMoney(
        moneyAmount(item.priceAmount ?? item.price),
        item.priceCurrency || item.currency || item.currencySymbol
      );
      const compare = formatMoney(
        moneyAmount(item.compareAtPrice ?? item.originalPrice),
        item.priceCurrency || item.currency || item.currencySymbol
      );
      const rating = productRating(item);
      const reviewCount = productReviewCount(item);
      const subtitle = item?.vendor || item?.productType || "";
      const bundleLabel = (Array.isArray(item?.tags) ? item.tags : []).find((tag) =>
        /bundle|save/i.test(String(tag || ""))
      );
      const discount = discountLabel(item);

      return (
        <TouchableOpacity
          style={[styles.searchCard, { width: CARD_W }, isListMode && styles.searchCardList]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ProductDetail", { product: item, detailSections })}
        >
          <View style={[styles.searchImageWrap, isListMode && styles.searchImageWrapList]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={[
                  styles.searchImage,
                  { height: searchImageHeight },
                  isListMode && styles.searchImageList,
                ]}
                resizeMode={resolveProductImageResizeMode()}
              />
            ) : (
              <View
                style={[
                  styles.searchImage,
                  styles.searchPlaceholder,
                  { height: searchImageHeight },
                  isListMode && styles.searchImageList,
                ]}
              />
            )}
            <TouchableOpacity
              style={styles.searchHeart}
              activeOpacity={0.75}
              onPress={() => navigation.navigate("Wishlist")}
            >
              <FontAwesome name="heart-o" size={18} color="#111827" />
            </TouchableOpacity>
            {!!discount && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discount}</Text>
              </View>
            )}
          </View>

          <View style={[styles.searchInfoColumn, isListMode && styles.searchInfoColumnList]}>
            <View style={styles.swatchRow}>
              {swatches.slice(0, 4).map((value, index) => (
                <View
                  key={`${item.id}-swatch-${value}-${index}`}
                  style={[styles.swatch, { backgroundColor: swatchColor(value, index) }]}
                />
              ))}
              {extraSwatches > 0 ? <Text style={styles.swatchMore}>+{extraSwatches}</Text> : null}
            </View>

            <View style={styles.searchCardBody}>
              <Text numberOfLines={1} style={styles.searchProductTitle}>
                {String(item.title || "").toUpperCase()}
              </Text>
              {!!subtitle && (
                <Text numberOfLines={1} style={styles.searchProductVendor}>
                  {subtitle}
                </Text>
              )}
              {!!price && (
                <Text style={styles.searchPrice}>
                  {!!compare && compare !== price ? `${compare}  |  ${price}` : price}
                </Text>
              )}
              {!!bundleLabel && (
                <Text numberOfLines={1} style={styles.bundleText}>
                  {bundleLabel}
                </Text>
              )}
              {rating > 0 ? (
                <View style={styles.ratingRow}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <FontAwesome
                      key={`rating-${item.id}-${index}`}
                      name={index < Math.round(rating) ? "star" : "star-o"}
                      size={13}
                      color="#111827"
                    />
                  ))}
                  {reviewCount > 0 ? (
                    <Text style={styles.reviewCount}>{reviewCount.toLocaleString()}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.card, { width: CARD_W }, isListMode && styles.cardList]}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate("ProductDetail", { product: item, detailSections })
        }
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.image, isListMode && styles.imageList]}
            resizeMode={resolveProductImageResizeMode()}
          />
        ) : (
          <View style={[styles.image, isListMode && styles.imageList, styles.placeholder]}>
            <Text style={styles.placeholderText}>No image</Text>
          </View>
        )}
        <View style={styles.content}>
          <Text numberOfLines={isListMode ? 1 : 2} style={styles.name}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {formatMoney(
              item.priceAmount ?? item.price,
              item.priceCurrency || item.currency || item.currencySymbol
            )}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchSkeleton = () => (
    <View style={styles.searchSkeletonGrid}>
      {Array.from({ length: 4 }).map((_, index) => (
        <View key={`search-result-skeleton-${index}`} style={[styles.searchSkeletonCard, { width: CARD_W }]}>
          <View style={[styles.searchSkeletonImage, { height: searchImageHeight }]} />
          <View style={styles.searchSkeletonLineWide} />
          <View style={styles.searchSkeletonLine} />
          <View style={styles.searchSkeletonLineShort} />
        </View>
      ))}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.noResults}>
      <FontAwesome name="frown-o" size={24} color="#9CA3AF" />
      <Text style={styles.noResultsTitle}>NO RESULTS</Text>
      <Text style={styles.noResultsText}>
        We were unable to find the product you were looking for
      </Text>
      <TouchableOpacity
        style={styles.tryAgainButton}
        activeOpacity={0.85}
        onPress={() => loadProducts({ after: null, append: false })}
      >
        <Text style={styles.tryAgainText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeArea>
      <View style={styles.container}>
        {isSearchMode ? (
          <View style={styles.searchTop}>
            <View style={styles.searchHeader}>
              <TouchableOpacity
                style={styles.headerIconButton}
                activeOpacity={0.75}
                onPress={goBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <FontAwesome name="angle-left" size={28} color="#111827" />
              </TouchableOpacity>
              <View style={styles.searchHeaderSpacer} />
              <TouchableOpacity
                style={styles.headerIconButton}
                activeOpacity={0.75}
                onPress={openCart}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View>
                  <FontAwesome name="shopping-bag" size={21} color="#111827" />
                  {cartCount > 0 ? (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            </View>
            <View
              style={styles.resultSearchBox}
            >
              <FontAwesome name="search" size={16} color="#9CA3AF" />
              <TextInput
                value={searchInput}
                onChangeText={setSearchInput}
                onSubmitEditing={submitSearch}
                returnKeyType="search"
                blurOnSubmit={false}
                placeholder="Search"
                placeholderTextColor="#9CA3AF"
                selectionColor="#111827"
                underlineColorAndroid="transparent"
                style={styles.resultSearchInput}
              />
              {searchInput.length > 0 ? (
                <TouchableOpacity
                  style={styles.resultSearchClear}
                  activeOpacity={0.75}
                  onPress={() => setSearchInput("")}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome name="times-circle" size={16} color="#B8BDC7" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : homeHeaderConfig ? (
          <HeaderDefault config={homeHeaderConfig} bottomNavSection={bottomNavSection} hideTabs showBack />
        ) : null}
        {!isSearchMode && (
          <View style={styles.headerSection}>
            <Text style={styles.heading}>
              {title || "Products"}
            </Text>
          </View>
        )}

        {/* Filter + Sort bar */}
        <FilterSortHeader
          section={isSearchMode ? { props: { variant: "searchResults", compactSearchControls: true, pt: 6, pb: 8 } } : {}}
          filterItems={filterOptions}
          onSortChange={(opt) => setSortKey(opt)}
          onViewModeChange={(mode) => setViewMode(mode)}
          onFilterChange={(filter) => setActiveFilter(filter)}
        />

        <View style={styles.listArea}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading && isSearchMode ? renderSearchSkeleton() : null}
          {loading && !isSearchMode ? <ActivityIndicator size="small" color="#111827" /> : null}

          {!loading && !error && (
            <FlatList
              key={`cols-${numColumns}`}
              data={displayProducts}
              keyExtractor={(item, index) => String(item?.id || item?.variantId || item?.handle || index)}
              numColumns={numColumns}
              columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 24 },
              ]}
              ListEmptyComponent={
                isSearchMode ? renderEmptyState : (
                  <Text style={styles.status}>No products available yet.</Text>
                )
              }
              ListFooterComponent={
                pageInfo?.hasNextPage ? (
                  <TouchableOpacity
                    style={styles.loadMoreButton}
                    onPress={handleLoadMore}
                    activeOpacity={0.85}
                    disabled={loadingMore}
                  >
                    <Text style={styles.loadMoreText}>
                      {loadingMore ? "Loading..." : "Load more"}
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
    backgroundColor: "#ffffff",
  },
  searchTop: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHeaderSpacer: {
    flex: 1,
  },
  cartBadge: {
    position: "absolute",
    right: -9,
    top: -8,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  resultSearchBox: {
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  resultSearchInput: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 0,
    color: "#111827",
    fontSize: 15,
  },
  resultSearchClear: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchSkeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 24,
  },
  searchSkeletonCard: {
    marginBottom: 20,
  },
  searchSkeletonImage: {
    width: "100%",
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  searchSkeletonLineWide: {
    height: 15,
    marginTop: 10,
    borderRadius: 4,
    backgroundColor: "#EEEEEE",
  },
  searchSkeletonLine: {
    width: "88%",
    height: 9,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: "#EEEEEE",
  },
  searchSkeletonLineShort: {
    width: "50%",
    height: 8,
    marginTop: 8,
    borderRadius: 4,
    backgroundColor: "#EEEEEE",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  row: {
    justifyContent: "space-between",
  },
  listContent: {
    paddingBottom: 24,
  },
  searchCard: {
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
  },
  searchCardList: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  searchImageWrap: {
    position: "relative",
    width: "100%",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderRadius: 4,
  },
  searchImageWrapList: {
    width: 112,
    marginRight: 12,
  },
  searchImage: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  searchImageList: {
    width: 112,
    height: 112,
  },
  searchPlaceholder: {
    backgroundColor: "#FFFFFF",
  },
  searchInfoColumn: {
    width: "100%",
  },
  searchInfoColumnList: {
    flex: 1,
    minWidth: 0,
  },
  searchHeart: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  discountBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "#8FEA8F",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  discountText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  swatchRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    marginRight: -2,
  },
  swatchMore: {
    marginLeft: 6,
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "500",
  },
  searchCardBody: {
    paddingTop: 6,
    gap: 5,
  },
  searchProductTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
  },
  searchProductVendor: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "400",
  },
  searchPrice: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  bundleText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  reviewCount: {
    marginLeft: 4,
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "400",
  },
  noResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 36,
    paddingHorizontal: 28,
  },
  noResultsTitle: {
    marginTop: 8,
    color: "#111827",
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0,
  },
  noResultsText: {
    marginTop: 10,
    color: "#9CA3AF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  tryAgainButton: {
    marginTop: 18,
    backgroundColor: "#050505",
    borderRadius: 4,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  tryAgainText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  card: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  cardList: {
    flexDirection: "row",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: 160,
    backgroundColor: "#FFFFFF",
  },
  imageList: {
    width: 100,
    height: 100,
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#9ca3af",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  price: {
    marginTop: 6,
    color: "#111827",
    fontWeight: "600",
  },
  status: {
    textAlign: "center",
    color: "#6b7280",
    paddingVertical: 16,
  },
  error: {
    textAlign: "center",
    color: "#b91c1c",
    paddingVertical: 12,
  },
  loadMoreButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#111827",
    marginTop: 8,
  },
  loadMoreText: {
    color: "#111827",
    fontWeight: "600",
  },
});

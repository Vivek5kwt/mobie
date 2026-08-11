import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useToast } from "../components/ToastProvider";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import {
  getSortFilterSnapshot,
  hydrateSortFilterFromStorage,
  subscribeSortFilter,
} from "../utils/sortFilterStore";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "../components/FavoriteToggleButton";
import ProductImage from "../components/ProductImage";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { formatMoney, parseMoneyAmount } from "../utils/money";
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

const unwrapDslValue = (value) => {
  if (value && typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.default !== undefined) return value.default;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
};

const getSectionProps = (section = {}) =>
  section?.properties?.props?.properties ||
  section?.properties?.props ||
  section?.props?.properties ||
  section?.props ||
  {};

const toExplicitBoolean = (value) => {
  const resolved = unwrapDslValue(value);
  if (resolved === undefined || resolved === null || resolved === "") return undefined;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const normalized = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return undefined;
};

const toNumberOr = (value, fallback) => {
  const resolved = unwrapDslValue(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  const parsed = typeof resolved === "number" ? resolved : parseFloat(String(resolved));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringOr = (value, fallback = "") => {
  const resolved = unwrapDslValue(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  return String(resolved);
};

const firstDefinedDsl = (...values) => {
  for (const value of values) {
    const resolved = unwrapDslValue(value);
    if (resolved !== undefined && resolved !== null && resolved !== "") return resolved;
  }
  return undefined;
};

const getLayoutCss = (raw = {}, props = {}) => {
  const layout = unwrapDslValue(raw?.layout) || unwrapDslValue(props?.layout) || {};
  const css = unwrapDslValue(layout?.css) || {};
  const presentation = unwrapDslValue(raw?.presentation) || unwrapDslValue(props?.presentation) || {};
  const presentationCss = unwrapDslValue(presentation?.css) || unwrapDslValue(presentation?.cssSnapshot) || {};
  return {
    card: unwrapDslValue(css?.card) || unwrapDslValue(presentationCss?.card) || {},
    image: unwrapDslValue(css?.image) || unwrapDslValue(css?.imageWrap) || unwrapDslValue(presentationCss?.image) || {},
    title: unwrapDslValue(css?.cardTitle) || unwrapDslValue(css?.title) || unwrapDslValue(presentationCss?.title) || {},
    price: unwrapDslValue(css?.cardPrice) || unwrapDslValue(css?.price) || unwrapDslValue(presentationCss?.price) || {},
    button: unwrapDslValue(css?.addToCart) || unwrapDslValue(css?.button) || unwrapDslValue(presentationCss?.button) || {},
  };
};

const DEFAULT_PRODUCT_CARD_CONFIG = {
  cardBgColor: "#FFFFFF",
  cardBorderColor: "#E5E7EB",
  cardBorderWidth: 1,
  cardBorderRadius: 8,
  imageBgColor: "#FFFFFF",
  imageHeight: undefined,
  imageScale: "Fill",
  titleColor: "#111827",
  titleSize: 12,
  titleWeight: "600",
  priceColor: "#111827",
  priceSize: 13,
  priceWeight: "700",
  buttonBgColor: "#111111",
  buttonTextColor: "#FFFFFF",
  buttonRadius: 6,
  buttonTextSize: 11,
  buttonTextWeight: "700",
  unavailableBgColor: "#7A7A7A",
  unavailableTextColor: "#FFFFFF",
  showAddToCart: true,
  showFavorite: false,
};

const resolveProductCardConfig = (...dsls) => {
  const productComponents = new Set([
    "product_grid",
    "product_carousel",
    "tab_product_grid",
    "tab_product_carousel",
    "collection_products",
  ]);

  for (const dsl of dsls) {
    const section = (dsl?.sections || []).find((candidate) =>
      productComponents.has(getComponentName(candidate))
    );
    if (!section) continue;

    const props = getSectionProps(section);
    const raw = {
      ...props,
      ...((unwrapDslValue(props?.raw) && typeof unwrapDslValue(props?.raw) === "object")
        ? unwrapDslValue(props?.raw)
        : {}),
    };
    const css = getLayoutCss(raw, props);
    // Resolve the card's own background first so imageBgColor can fall back
    // to it (matching the "Background & Padding" section's color) instead
    // of an independent hardcoded white — keeps any letterbox space around
    // a Fit-scaled image blended with the card.
    const cardBgColorResolved = toStringOr(firstDefinedDsl(raw?.cardBackgroundColor, raw?.cardBgColor, css.card?.backgroundColor), DEFAULT_PRODUCT_CARD_CONFIG.cardBgColor);
    // Matches ProductGrid.js/AllProductsScreen.js's own Add to Cart
    // visibility candidates exactly — this screen previously read none of
    // them at all, so the button always showed regardless of the merchant
    // turning it off in Builder.
    const cardVisibility = {
      ...(unwrapDslValue(raw?.visibility) || {}),
      ...(unwrapDslValue(props?.visibility) || {}),
    };
    let showAddToCart = DEFAULT_PRODUCT_CARD_CONFIG.showAddToCart;
    for (const candidate of [
      raw?.atcActive,
      raw?.addToCartActive,
      raw?.showAddToCart,
      raw?.showCartButton,
      raw?.addToCartVisible,
      raw?.addToCartEnabled,
      cardVisibility?.addToCart,
      cardVisibility?.atc,
      cardVisibility?.button,
    ]) {
      const explicit = toExplicitBoolean(candidate);
      if (explicit !== undefined) {
        showAddToCart = explicit;
        break;
      }
    }
    // Matches AllProductsScreen.js's own favorite/wishlist visibility
    // candidates exactly — defaults to HIDDEN unless explicitly enabled,
    // same as there. This screen was rendering the heart unconditionally.
    let showFavorite = DEFAULT_PRODUCT_CARD_CONFIG.showFavorite;
    for (const candidate of [
      raw?.favoriteIconEnabled,
      raw?.showFavorite,
      raw?.showWishlist,
      raw?.addToFavorite,
      raw?.addToFavoriteActive,
      cardVisibility?.favorite,
      cardVisibility?.addToFavorite,
      cardVisibility?.wishlist,
    ]) {
      const explicit = toExplicitBoolean(candidate);
      if (explicit !== undefined) {
        showFavorite = explicit;
        break;
      }
    }
    return {
      showAddToCart,
      showFavorite,
      cardBgColor: cardBgColorResolved,
      cardBorderColor: toStringOr(firstDefinedDsl(raw?.cardBorderColor, css.card?.borderColor), DEFAULT_PRODUCT_CARD_CONFIG.cardBorderColor),
      cardBorderWidth: toNumberOr(firstDefinedDsl(raw?.cardBorderWidth, css.card?.borderWidth), DEFAULT_PRODUCT_CARD_CONFIG.cardBorderWidth),
      cardBorderRadius: toNumberOr(firstDefinedDsl(raw?.cardCorner, raw?.cardRadius, raw?.cardBorderRadius, css.card?.borderRadius), DEFAULT_PRODUCT_CARD_CONFIG.cardBorderRadius),
      imageBgColor: toStringOr(firstDefinedDsl(raw?.imageBackgroundColor, raw?.productImageBackgroundColor, raw?.imageBgColor, raw?.productImageBgColor, css.image?.backgroundColor), cardBgColorResolved),
      imageHeight: toNumberOr(firstDefinedDsl(raw?.imageHeight, raw?.productImageHeight, css.image?.height), DEFAULT_PRODUCT_CARD_CONFIG.imageHeight),
      imageScale: toStringOr(firstDefinedDsl(raw?.imageScale, raw?.scale, raw?.imageResizeMode, css.image?.objectFit), DEFAULT_PRODUCT_CARD_CONFIG.imageScale),
      titleColor: toStringOr(firstDefinedDsl(raw?.productTitleColor, raw?.itemTitleColor, raw?.cardTitleColor, raw?.titleColor, css.title?.color), DEFAULT_PRODUCT_CARD_CONFIG.titleColor),
      titleSize: toNumberOr(firstDefinedDsl(raw?.productTitleSize, raw?.itemTitleSize, raw?.cardTitleSize, raw?.titleSize, css.title?.fontSize), DEFAULT_PRODUCT_CARD_CONFIG.titleSize),
      titleWeight: toStringOr(firstDefinedDsl(raw?.productTitleWeight, raw?.itemTitleWeight, raw?.cardTitleWeight, raw?.titleWeight, css.title?.fontWeight), DEFAULT_PRODUCT_CARD_CONFIG.titleWeight),
      priceColor: toStringOr(firstDefinedDsl(raw?.priceColor, raw?.productPriceColor, css.price?.color), DEFAULT_PRODUCT_CARD_CONFIG.priceColor),
      priceSize: toNumberOr(firstDefinedDsl(raw?.priceSize, raw?.productPriceSize, raw?.cardPriceSize, css.price?.fontSize), DEFAULT_PRODUCT_CARD_CONFIG.priceSize),
      priceWeight: toStringOr(firstDefinedDsl(raw?.priceWeight, raw?.productPriceWeight, css.price?.fontWeight), DEFAULT_PRODUCT_CARD_CONFIG.priceWeight),
      buttonBgColor: toStringOr(firstDefinedDsl(raw?.addToCartBgColor, raw?.cartBtnBgColor, raw?.buttonBgColor, css.button?.backgroundColor), DEFAULT_PRODUCT_CARD_CONFIG.buttonBgColor),
      buttonTextColor: toStringOr(firstDefinedDsl(raw?.addToCartTextColor, raw?.cartBtnTextColor, raw?.buttonTextColor, css.button?.color), DEFAULT_PRODUCT_CARD_CONFIG.buttonTextColor),
      buttonRadius: toNumberOr(firstDefinedDsl(raw?.addToCartBorderRadius, raw?.cartBtnRadius, raw?.buttonRadius, css.button?.borderRadius), DEFAULT_PRODUCT_CARD_CONFIG.buttonRadius),
      buttonTextSize: toNumberOr(firstDefinedDsl(raw?.addToCartFontSize, raw?.cartBtnFontSize, raw?.buttonFontSize, css.button?.fontSize), DEFAULT_PRODUCT_CARD_CONFIG.buttonTextSize),
      buttonTextWeight: toStringOr(firstDefinedDsl(raw?.addToCartFontWeight, raw?.cartBtnFontWeight, raw?.buttonFontWeight, css.button?.fontWeight), DEFAULT_PRODUCT_CARD_CONFIG.buttonTextWeight),
      unavailableBgColor: toStringOr(firstDefinedDsl(raw?.unavailableBgColor, raw?.soldOutBgColor), DEFAULT_PRODUCT_CARD_CONFIG.unavailableBgColor),
      unavailableTextColor: toStringOr(firstDefinedDsl(raw?.unavailableTextColor, raw?.soldOutTextColor), DEFAULT_PRODUCT_CARD_CONFIG.unavailableTextColor),
    };
  }

  return DEFAULT_PRODUCT_CARD_CONFIG;
};

const resolveCollectionTitleVisible = (...dsls) => {
  const titleComponents = new Set([
    "collection",
    "collections",
    "collection_image",
    "collection_slider",
    "collection_products",
    "product_grid",
    "product_carousel",
  ]);

  for (const dsl of dsls) {
    const sections = dsl?.sections || [];
    for (const section of sections) {
      const component = getComponentName(section);
      if (!titleComponents.has(component)) continue;

      const props = getSectionProps(section);
      const raw = unwrapDslValue(props?.raw) || {};
      const visibility = {
        ...(unwrapDslValue(raw?.visibility) || {}),
        ...(unwrapDslValue(props?.visibility) || {}),
      };
      const candidates = [
        raw?.collectionTitleActive,
        raw?.collectionTitleVisible,
        raw?.showCollectionTitle,
        raw?.sectionTitleActive,
        raw?.sectionTitleVisible,
        raw?.headerTitleActive,
        raw?.headerTitleVisible,
        raw?.gridTitleActive,
        raw?.titleActive,
        raw?.titleVisible,
        raw?.showTitle,
        visibility?.collectionTitle,
        visibility?.sectionTitle,
        visibility?.headerTitle,
        visibility?.gridTitle,
        visibility?.title,
      ];

      for (const candidate of candidates) {
        const explicit = toExplicitBoolean(candidate);
        if (explicit !== undefined) return explicit;
      }
    }
  }

  return false;
};

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

// Sort keys must match FilterSortHeader's actual SORT_OPTIONS labels verbatim
// ("Recommended", "What's New", "Best Selling", "Price: Low to High",
// "Price: High to Low") — this used to switch on shorthand labels ("Price:
// Low", "Newest") that onSortChange never actually sends, so every sort
// selection silently fell through to the no-op default (this is why changing
// the sort drawer here appeared to do nothing).
function sortProducts(products, sortKey) {
  const copy = [...products];
  switch (sortKey) {
    case "Price: Low to High":
      return copy.sort((a, b) => parseMoneyAmount(a.priceAmount ?? a.price) - parseMoneyAmount(b.priceAmount ?? b.price));
    case "Price: High to Low":
      return copy.sort((a, b) => parseMoneyAmount(b.priceAmount ?? b.price) - parseMoneyAmount(a.priceAmount ?? a.price));
    case "What's New":
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

// FilterSortHeader's non-legacy filter drawer is Builder's actual, fixed
// "Availability" list (In stock / Out of stock / Available soon) — the only
// filter Builder itself has. selectedFilters is an array of those labels,
// OR'd together.
function productMatchesAvailabilityFilter(product, selectedLabels) {
  if (!Array.isArray(selectedLabels) || !selectedLabels.length) return true;
  const inStock = isProductAvailable(product);
  if (selectedLabels.includes("In stock") && inStock) return true;
  // Matches ProductGrid.js's own logic: "Available soon" has no distinct
  // Shopify signal, so it's treated as a synonym for "Out of stock" here too
  // (this was missing entirely before, so selecting only "Available soon"
  // matched nothing despite its count showing real out-of-stock products).
  if ((selectedLabels.includes("Out of stock") || selectedLabels.includes("Available soon")) && !inStock) return true;
  return false;
}

export default function CollectionProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const showToast = useToast();
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
  const [productListDslReady, setProductListDslReady] = useState(false);
  const [collectionTitleVisible, setCollectionTitleVisible] = useState(false);
  const [productCardConfig, setProductCardConfig] = useState(DEFAULT_PRODUCT_CARD_CONFIG);
  const favoriteTapRef = useRef(false);
  const cartSnackbarTimerRef = useRef(null);

  // FilterSortHeader state — initialized from the shared sortFilterStore
  // (not a hardcoded default) so a sort/filter already selected on another
  // product-list page actually applies here too, instead of just showing as
  // "selected" in the header while the list itself stays unsorted/unfiltered.
  const [sortKey, setSortKey]       = useState(() => getSortFilterSnapshot().sortOption);
  const [viewMode, setViewMode]     = useState("grid"); // "grid" | "list"
  const [activeFilter, setActiveFilter] = useState(() => getSortFilterSnapshot().selectedFilters);
  // A separate, larger one-time fetch (independent of the small PAGE_SIZE
  // pages the grid paginates through) used only for (a) the Availability
  // filter's real in-stock/out-of-stock counts and (b) as the source list
  // once a filter is actually applied — so both are correct immediately on
  // arrival and applying a filter shows its full (capped) result in one shot
  // instead of trickling in page-by-page.
  const [filterSourceProducts, setFilterSourceProducts] = useState([]);

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
          setPageInfo(nextPage);
          return;
        }

        // Only the generic product-list route falls back to all products.
        setIsFallback(true);
        const fallback = await fetchShopifyProductsPage({ first: PAGE_SIZE, after });
        const next     = fallback?.products || [];
        const nextPage = normalizePageInfo(fallback?.pageInfo, next);
        setProducts((prev) => (append ? [...prev, ...next] : next));
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
    setViewMode("grid");
  }, [resolvedCollectionHandle, resolvedCollectionTitle, sourcePageName]);

  // Fetches once immediately on arrival (not reactively when a filter is
  // applied) so the Availability filter shows correct in-stock/out-of-stock
  // counts right away, and so applying a filter can show its full result
  // instantly from data that's already loaded instead of paginating page by
  // page while the filter is active.
  useEffect(() => {
    let mounted = true;
    const loadFilterSource = async () => {
      try {
        const payload = resolvedCollectionHandle
          ? await fetchShopifyCollectionProducts({ handle: resolvedCollectionHandle, first: 100 })
          : await fetchShopifyProductsPage({ first: 100 });
        if (!mounted) return;
        setFilterSourceProducts(payload?.products || []);
      } catch (_) {
        if (mounted) setFilterSourceProducts([]);
      }
    };
    loadFilterSource();
    return () => { mounted = false; };
  }, [resolvedCollectionHandle]);

  // Keep sortKey/activeFilter in sync with the shared store (same store
  // FilterSortHeader itself hydrates from/writes to) so a sort or filter
  // picked on another product-list page is actually applied here on mount,
  // not just shown as "selected" in the header.
  useEffect(() => {
    let mounted = true;
    const applySnapshot = () => {
      if (!mounted) return;
      const snap = getSortFilterSnapshot();
      setSortKey(snap.sortOption);
      setActiveFilter(snap.selectedFilters);
    };
    hydrateSortFilterFromStorage().then(applySnapshot);
    const unsub = subscribeSortFilter(applySnapshot);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

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
          price: parseMoneyAmount(product.priceAmount ?? product.price) || 0,
          variant: "",
          currency: product.priceCurrency || "",
          availableForSale: isProductAvailable(product),
          quantity: 1,
        },
      })
    );
    if (cartSnackbarTimerRef.current) clearTimeout(cartSnackbarTimerRef.current);
    cartSnackbarTimerRef.current = setTimeout(() => {
      showToast({ message: ADD_TO_CART_SUCCESS_MESSAGE, type: "success", duration: 2500 });
    }, 0);
  };

  // A price/newest sort needs the same full batch a filter does — sorting
  // just the incrementally-paginated `products` only ever reorders whatever
  // page has loaded so far, so the true lowest-priced product doesn't show
  // on top until pagination happens to reach the page it's on. Without a
  // filter active this fell back to `products`, so the sort silently went
  // back to being partial — it only looked correct because a filter being
  // active also happened to force the same fix.
  const sortNeedsFullCatalog =
    sortKey === "Price: Low to High" || sortKey === "Price: High to Low" || sortKey === "What's New";

  // Apply sort + optional filter. An active filter (or a sort that needs the
  // full catalog) switches the source from the incrementally-paginated
  // `products` to `filterSourceProducts` — a larger batch already fully
  // loaded before the user ever opened the filter drawer — so the result
  // appears complete and correctly ordered in one shot instead of trickling
  // in page-by-page as more raw pages are fetched to catch up.
  const displayProducts = React.useMemo(() => {
    const source = (activeFilter?.length || sortNeedsFullCatalog) ? filterSourceProducts : products;
    let list = sortProducts(source, sortKey);
    if (activeFilter?.length) {
      list = list.filter((p) => productMatchesAvailabilityFilter(p, activeFilter));
    }
    return list;
  }, [products, filterSourceProducts, sortKey, sortNeedsFullCatalog, activeFilter]);

  // "Load more" only paginates the unfiltered, unsorted browse view — the
  // filtered/sorted view already shows its full (capped-at-100) result
  // immediately.
  const hasNextProductPage =
    !activeFilter?.length && !sortNeedsFullCatalog && Boolean(pageInfo?.hasNextPage && pageInfo?.endCursor);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (!hasNextProductPage) return;
    loadProducts({ after: pageInfo.endCursor, append: true });
  }, [hasNextProductPage, loadProducts, loading, loadingMore, pageInfo?.endCursor]);

  const renderItem = ({ item }) => {
    const inStock = isProductAvailable(item);
    const isFav   = isWishlistProduct(wishlistItems, item);
    const isListMode = viewMode === "list";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            width: CARD_W,
            backgroundColor: productCardConfig.cardBgColor,
            borderColor: productCardConfig.cardBorderColor,
            borderWidth: productCardConfig.cardBorderWidth,
            borderRadius: productCardConfig.cardBorderRadius,
          },
          isListMode && styles.cardList,
        ]}
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
          <ProductImage
            uri={item.imageUrl}
            style={[
              styles.image,
              productCardConfig.imageHeight ? { height: productCardConfig.imageHeight, aspectRatio: undefined } : null,
              { backgroundColor: productCardConfig.imageBgColor },
              isListMode && styles.imageList,
            ]}
            resizeMode={resolveProductImageResizeMode(productCardConfig.imageScale)}
            placeholderBg={productCardConfig.imageBgColor}
          />
          {/* Favourite toggle */}
          {productCardConfig.showFavorite && (
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
          )}
        </View>

        {/* Card body */}
        <View style={styles.cardBody}>
          <Text
            numberOfLines={isListMode ? 1 : 2}
            style={[
              styles.productName,
              {
                color: productCardConfig.titleColor,
                fontSize: productCardConfig.titleSize,
                fontWeight: String(productCardConfig.titleWeight),
                lineHeight: Math.ceil(productCardConfig.titleSize * 1.35),
              },
            ]}
          >
            {item.title}
          </Text>
          <Text
            style={[
              styles.price,
              {
                color: productCardConfig.priceColor,
                fontSize: productCardConfig.priceSize,
                fontWeight: String(productCardConfig.priceWeight),
              },
            ]}
          >
            {formatMoney(
              moneyAmount(item.priceAmount ?? item.price),
              productCurrency(item)
            )}
          </Text>
          {(productCardConfig.showAddToCart || !inStock) && (
            <TouchableOpacity
              style={[
                inStock ? styles.cartBtnActive : styles.cartBtnSoldOut,
                {
                  backgroundColor: inStock ? productCardConfig.buttonBgColor : productCardConfig.unavailableBgColor,
                  borderRadius: productCardConfig.buttonRadius,
                },
              ]}
              activeOpacity={inStock ? 0.8 : 1}
              disabled={!inStock}
              onPress={(e) => {
                e?.stopPropagation?.();
                e?.preventDefault?.();
                if (inStock) handleAddToCart(item);
              }}
            >
              <Text
                style={[
                  inStock ? styles.cartBtnTextActive : styles.cartBtnTextSoldOut,
                  {
                    color: inStock ? productCardConfig.buttonTextColor : productCardConfig.unavailableTextColor,
                    fontSize: productCardConfig.buttonTextSize,
                    fontWeight: String(productCardConfig.buttonTextWeight),
                  },
                ]}
              >
                {inStock ? "Add To Cart" : "Item Not Available"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    const appId = resolveAppId();
    let mounted = true;
    setProductListDslReady(false);
    setProductListHeaderConfig(null);
    setProductListFilterSortSection(null);
    setCollectionTitleVisible(false);
    setProductCardConfig(DEFAULT_PRODUCT_CARD_CONFIG);
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
      const matchedPageDsls = (pageResults || []).map((pageData) => pageData?.dsl || pageData || {});
      setHomeHeaderConfig(data?.dsl?.headerdefault || null);
      setProductListHeaderConfig(matchedPageHeaderConfig || productListDsl?.headerdefault || null);
      setProductListFilterSortSection(findFilterSortSection(productListDsl));
      setCollectionTitleVisible(resolveCollectionTitleVisible(...matchedPageDsls, productListDsl));
      setProductCardConfig(resolveProductCardConfig(...matchedPageDsls, productListDsl));
      setProductListDslReady(true);
      const nav = (data?.dsl?.sections || []).find((s) => {
        const c = (
          s?.component?.const || s?.component ||
          s?.properties?.component?.const || s?.properties?.component || ""
        ).toLowerCase();
        return ["bottom_navigation", "bottom_navigation_style_1", "bottom_navigation_style_2"].includes(c);
      });
      if (nav) setBottomNavSection(nav);
    }).catch(() => {
      if (mounted) setProductListDslReady(true);
    });
    return () => { mounted = false; };
  }, [resolvedCollectionHandle, resolvedCollectionTitle, sourcePageName]);

  const resultHeaderConfig = productListHeaderConfig;
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

        {collectionTitleVisible && !!resolvedCollectionTitle ? (
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
        ) : null}

        {/* Filter + Sort header bar — no filterItems passed, so this always
            shows Builder's actual static "Availability" filter labels (In
            stock / Out of stock / Available soon) instead of categories
            derived from the fetched products; `products` feeds it real
            counts for those labels instead of Builder's hardcoded mockup
            numbers. */}
        {productListDslReady && productListFilterSortSection ? (
          <FilterSortHeader
            section={productListFilterSortSection}
            products={filterSourceProducts}
            onSortChange={(opt) => setSortKey(opt)}
            onViewModeChange={(mode) => setViewMode(mode)}
            onFilterChange={(filter) => setActiveFilter(filter)}
          />
        ) : null}

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

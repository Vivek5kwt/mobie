import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import HeaderIcon from "react-native-vector-icons/FontAwesome6";
import { fetchShopifyProductsPage, searchShopifyProducts } from "../services/shopify";
import { recordUserSearchTerm } from "../services/searchHistoryService";
import { SafeArea } from "../utils/SafeAreaHandler";
import HeaderDefault from "../components/HeaderDefault";
import FilterSortHeader from "../components/FilterSortHeader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import { useToast } from "../components/ToastProvider";
import { fetchDSL } from "../engine/dslHandler";
import DynamicRenderer from "../engine/DynamicRenderer";
import { resolveAppId } from "../utils/appId";
import { usePageBgColor } from "../hooks/useBrandColors";
import { getPageBgColorSync } from "../services/brandKitService";
import {
  getSortFilterSnapshot,
  hydrateSortFilterFromStorage,
  subscribeSortFilter,
} from "../utils/sortFilterStore";
import { formatMoney, parseMoneyAmount } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { resolveFont } from "../services/typographyService";
import { addItem } from "../store/slices/cartSlice";
import { isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "../components/FavoriteToggleButton";
import ProductImage from "../components/ProductImage";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";
import { getResponsiveColumns } from "../utils/responsiveLayout";
import { ADD_TO_CART_SUCCESS_MESSAGE } from "../utils/cartFeedback";

const GAP = 12;
const H_PAD = 16;

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  return value;
};

const getComponentName = (section = {}) =>
  String(
    section?.component?.const ||
      section?.component ||
      section?.properties?.component?.const ||
      section?.properties?.component ||
      ""
  ).toLowerCase();

const getRawProps = (section) => {
  const root =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};
  const rawUnwrapped = deepUnwrap(root?.raw);
  return rawUnwrapped && typeof rawUnwrapped === "object"
    ? { ...root, ...rawUnwrapped }
    : root;
};

const findProductGridSection = (dsl = {}) =>
  (dsl?.sections || []).find((section) => getComponentName(section) === "product_grid") || null;

const findFilterSortSection = (dsl = {}) =>
  (dsl?.sections || []).find((section) => {
    const component = getComponentName(section);
    return component === "filter_sort_header" || component === "filter_sort";
  }) || null;

const findProductListHeadingSection = (dsl = {}) =>
  (dsl?.sections || []).find((section) => {
    const component = getComponentName(section);
    return component === "text_block" || component === "collection_heading" || component === "page_heading";
  }) || null;

const resolveString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const resolveNumber = (values, fallback) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved === undefined || resolved === null || resolved === "") continue;
    const parsed = typeof resolved === "number" ? resolved : parseFloat(resolved);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const resolveBoolean = (values, fallback = false) => {
  for (const value of values) {
    const resolved = unwrapValue(value, undefined);
    if (resolved === undefined || resolved === null || resolved === "") continue;
    if (typeof resolved === "boolean") return resolved;
    if (typeof resolved === "number") return resolved !== 0;
    const normalized = String(resolved).trim().toLowerCase();
    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }
  return fallback;
};

const resolveWeight = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return String(resolved);
  const normalized = String(resolved).trim().toLowerCase();
  if (normalized === "bold") return "700";
  if (normalized === "semi bold" || normalized === "semibold") return "600";
  if (normalized === "medium") return "500";
  if (normalized === "regular" || normalized === "normal") return "400";
  if (/^\d+$/.test(normalized)) return normalized;
  return fallback;
};

const parseAspectRatio = (value) => {
  const raw = resolveString(value, "").trim().toLowerCase();
  if (!raw || raw === "auto") return null;
  const parts = raw.split(":");
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (w > 0 && h > 0) return w / h;
  }
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const findCartHeaderItem = (header = {}) => {
  const items = Array.isArray(header?.right) ? header.right : [];
  return items.find((item) => {
    const haystack = [
      item?.id,
      item?.title,
      item?.label,
      item?.icon,
      item?.iconId,
      item?.linkTo,
      item?.navigateRef,
      item?.navigateType,
    ]
      .map((entry) => resolveString(entry, "").toLowerCase())
      .join(" ");
    return haystack.includes("cart");
  }) || null;
};

const findBackHeaderItem = (header = {}) => {
  const items = Array.isArray(header?.left) ? header.left : [];
  return items.find((item) => {
    const haystack = [
      item?.id,
      item?.title,
      item?.label,
      item?.icon,
      item?.iconId,
      item?.linkTo,
      item?.navigateRef,
      item?.navigateType,
    ]
      .map((entry) => resolveString(entry, "").toLowerCase())
      .join(" ");
    return haystack.includes("__back__") || haystack.includes("previousscreen") || haystack.includes("arrow-left") || haystack.includes("back");
  }) || null;
};

const normalizeHeaderIconName = (value, fallback = "") => {
  const raw = resolveString(value, "").trim();
  if (!raw) return fallback;
  const cleaned = raw
    .replace(/^fa-(solid|regular|brands)\s+/i, "")
    .replace(/^fa[srldb]?[-_]?/i, "");
  return cleaned || fallback;
};

// Sort keys must match FilterSortHeader's actual SORT_OPTIONS labels verbatim
// ("Recommended", "What's New", "Best Selling", "Price: Low to High",
// "Price: High to Low") — this used to switch on shorthand labels ("Price:
// Low", "Newest") that onSortChange never actually sends, so every sort
// selection silently fell through to the no-op default.
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

const moneyAmount = (value) => {
  if (value && typeof value === "object") return value.amount ?? value.value ?? "";
  return value;
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
    return product.variants.some(isVariantAvailable);
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
// "Availability" list (In stock / Out of stock / Available soon — see
// AVAILABILITY_FILTERS in FilterSortHeader.js) — the only filter Builder
// itself has. selectedFilters is an array of those labels, OR'd together.
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

const PAGE_SIZE = 20;

export default function AllProductsScreen() {
  const pageBg = usePageBgColor("#ffffff");
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const showToast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const { session, initializing } = useAuth();
  const { title, detailSections } = route?.params || {};
  const searchTerm = String(route?.params?.query ?? route?.params?.searchQuery ?? "").trim();
  const isSearchMode = searchTerm.length > 0;
  const cartCount = useSelector((state) =>
    (state?.cart?.items || []).reduce((sum, item) => sum + (Number(item?.quantity) || 1), 0)
  );
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const favoriteTapRef = useRef(false);

  const [products, setProducts]       = useState([]);
  const [pageInfo, setPageInfo]       = useState({ hasNextPage: false, endCursor: null });
  const [loading, setLoading]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState("");
  // Initialized from the shared sortFilterStore (not a hardcoded default) so
  // a sort/filter already selected on another product-list page actually
  // applies here too, instead of just showing as "selected" in the header
  // while the list itself stays unsorted/unfiltered.
  const [sortKey, setSortKey]         = useState(() => getSortFilterSnapshot().sortOption);
  const [viewMode, setViewMode]       = useState("grid");
  const [activeFilter, setActiveFilter] = useState(() => getSortFilterSnapshot().selectedFilters);
  // A separate, larger one-time fetch (independent of the small PAGE_SIZE
  // pages the grid paginates through) used only for (a) the Availability
  // filter's real in-stock/out-of-stock counts and (b) as the source list
  // once a filter is actually applied in browse mode — so both are correct
  // immediately on arrival and applying a filter shows its full (capped)
  // result in one shot instead of trickling in page-by-page. Not needed in
  // search mode, which already fetches up to 250 results in one go.
  const [filterSourceProducts, setFilterSourceProducts] = useState([]);
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight]   = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [homeHeaderConfig, setHomeHeaderConfig] = useState(null);
  const [productListHeaderConfig, setProductListHeaderConfig] = useState(null);
  const [commonBackHeaderConfig, setCommonBackHeaderConfig] = useState(null);
  const [productListHeadingSection, setProductListHeadingSection] = useState(null);
  const [productListGridSection, setProductListGridSection] = useState(null);
  const [productListFilterSortSection, setProductListFilterSortSection] = useState(null);
  const [productListDslReady, setProductListDslReady] = useState(false);
  const favoriteToggleConfig = useMemo(() => buildFavoriteToggleConfig(), []);
  const cartSnackbarTimerRef = useRef(null);

  useEffect(() => () => {
    if (cartSnackbarTimerRef.current) clearTimeout(cartSnackbarTimerRef.current);
  }, []);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    if (!isSearchMode || !searchTerm) return;
    recordUserSearchTerm(searchTerm).catch(() => {});
  }, [isSearchMode, searchTerm]);

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

  useEffect(() => {
    setSortKey("Popular");
    setViewMode("grid");
    setActiveFilter(null);
  }, [isSearchMode, searchTerm, route?.params?.collectionHandle, route?.params?.handle, route?.params?.title]);

  const submitSearch = useCallback(() => {
    updateSearchParams(searchInput);
  }, [searchInput, updateSearchParams]);

  const searchGridConfig = useMemo(() => {
    const raw = getRawProps(productListGridSection);
    const gridObj = deepUnwrap(raw?.grid) || {};
    const presentation = deepUnwrap(raw?.presentation) || {};
    const presentationCss = deepUnwrap(presentation?.properties?.css || presentation?.css) || {};
    const cardCss = deepUnwrap(presentationCss?.card) || {};
    const imageCss = deepUnwrap(cardCss?.image) || {};
    const titleCss = deepUnwrap(cardCss?.title) || {};
    const priceCss = deepUnwrap(cardCss?.price) || {};
    const containerCss = deepUnwrap(presentationCss?.container) || {};
    const visibility = deepUnwrap(raw?.visibility) || deepUnwrap(presentationCss?.visibility) || {};

    const columns = Math.max(1, Math.round(resolveNumber([raw?.columns, gridObj?.columns], 2)));
    const colGap = resolveNumber([raw?.colGap, raw?.columnGap, raw?.gapX], GAP);
    const rowGap = resolveNumber([raw?.rowGap, raw?.gapY], 12);
    const padTop = resolveNumber([raw?.bgPadT, raw?.pt, containerCss?.paddingTop], 0);
    const padBottom = resolveNumber([raw?.bgPadB, raw?.pb, containerCss?.paddingBottom], 0);
    const padLeft = resolveNumber([raw?.bgPadL, raw?.pl, containerCss?.paddingLeft], H_PAD);
    const padRight = resolveNumber([raw?.bgPadR, raw?.pr, containerCss?.paddingRight], H_PAD);
    const imageRatio = parseAspectRatio(raw?.imageRatio ?? raw?.ratio ?? imageCss?.aspectRatio);
    const imageCorner = resolveNumber([raw?.imageCorner, raw?.corner, imageCss?.borderRadius], 0);
    const imageBgColor = resolveString(
      raw?.imageBgColor ?? raw?.imageBackgroundColor ?? imageCss?.backgroundColor ?? imageCss?.background,
      getPageBgColorSync() || "#FFFFFF"
    );
    const imageScale = resolveProductImageResizeMode(
      raw?.imageScale,
      raw?.scale,
      raw?.imageResizeMode,
      imageCss?.objectFit
    );
    const cardRadius = resolveNumber([raw?.cardCorner, raw?.cardRadius, raw?.outerCorners], 10);
    const cardBgColor = resolveString(raw?.cardBgColor ?? raw?.cardBackgroundColor ?? cardCss?.backgroundColor, "#FFFFFF");
    const cardBorderColor = resolveString(raw?.cardBorderColor ?? raw?.borderColor ?? cardCss?.borderColor, "#E5E7EB");
    const cardBorderWidth = resolveNumber([raw?.cardBorderWidth, raw?.borderSize, cardCss?.borderWidth], 1);
    const titleSize = resolveNumber([raw?.titleSize, raw?.cardTitleSize, titleCss?.fontSize], 14);
    const titleColor = resolveString(raw?.titleColor ?? titleCss?.color, "#111827");
    const titleWeight = resolveWeight(raw?.titleWeight ?? titleCss?.fontWeight, "600");
    const titleFamily = resolveFont(resolveString(
      raw?.titleFamily ?? raw?.titleFontFamily ?? raw?.productTitleFontFamily ?? raw?.fontFamily ?? titleCss?.fontFamily,
      ""
    ));
    const titleAlign = resolveString(raw?.titleAlign ?? raw?.alignText ?? titleCss?.textAlign, "left").toLowerCase();
    const titleWrap = resolveBoolean([raw?.titleWrap, raw?.cardTitleWrap], true);
    const priceSize = resolveNumber([raw?.priceSize, raw?.productPriceSize, raw?.cardPriceSize, priceCss?.fontSize], 14);
    const priceColor = resolveString(raw?.priceColor ?? raw?.productPriceColor ?? priceCss?.color, "#111827");
    const priceWeight = resolveWeight(raw?.priceWeight ?? raw?.productPriceWeight ?? priceCss?.fontWeight, "600");
    const priceFamily = resolveFont(resolveString(
      raw?.priceFamily ?? raw?.priceFontFamily ?? raw?.productPriceFontFamily ?? raw?.fontFamily ?? priceCss?.fontFamily,
      ""
    ));
    const showAddToCart = resolveBoolean(
      [
        raw?.atcActive,
        raw?.addToCartActive,
        raw?.showAddToCart,
        raw?.showCartButton,
        raw?.addToCartVisible,
        raw?.addToCartEnabled,
        visibility?.addToCart,
        visibility?.atc,
        visibility?.button,
      ],
      true
    );
    const showFavorite = resolveBoolean(
      [
        raw?.favoriteIconEnabled,
        raw?.showFavorite,
        raw?.showWishlist,
        raw?.addToFavorite,
        raw?.addToFavoriteActive,
        visibility?.favorite,
        visibility?.addToFavorite,
        visibility?.wishlist,
      ],
      false
    );
    return {
      columns,
      colGap,
      rowGap,
      padTop,
      padBottom,
      padLeft,
      padRight,
      imageRatio,
      imageCorner,
      imageBgColor,
      imageScale,
      cardRadius,
      cardBgColor,
      cardBorderColor,
      cardBorderWidth,
      titleSize,
      titleColor,
      titleWeight,
      titleFamily,
      titleAlign: titleAlign === "center" || titleAlign === "right" ? titleAlign : "left",
      titleWrap,
      priceSize,
      priceColor,
      priceWeight,
      priceFamily,
      showAddToCart,
      showFavorite,
      bgColor: resolveString(raw?.bgColor ?? containerCss?.backgroundColor, getPageBgColorSync() || "#FFFFFF"),
    };
  }, [productListGridSection]);

  const viewportWidth = Math.max(1, screenWidth);
  const useProductListDslLayout = isSearchMode || !!productListGridSection;
  const horizontalPadding = useProductListDslLayout
    ? searchGridConfig.padLeft + searchGridConfig.padRight
    : H_PAD * 2;
  const columnGap = useProductListDslLayout ? searchGridConfig.colGap : GAP;
  const requestedColumns = useProductListDslLayout ? searchGridConfig.columns : 2;
  const numColumns = viewMode === "list"
    ? 1
    : getResponsiveColumns({
        screenWidth: viewportWidth,
        requestedColumns,
        horizontalPadding,
        gap: columnGap,
        minCardWidth: 180,
        maxColumns: 6,
      });
  const CARD_W = viewMode === "list"
    ? viewportWidth - horizontalPadding
    : useProductListDslLayout
    ? (viewportWidth - searchGridConfig.padLeft - searchGridConfig.padRight - searchGridConfig.colGap * (numColumns - 1)) / numColumns
    : (viewportWidth - H_PAD * 2 - GAP * (numColumns - 1)) / numColumns;
  const searchImageHeight = viewMode === "list" ? 100 : Math.round(CARD_W);

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

  // Fetches once immediately on arrival (not reactively when a filter is
  // applied) so the Availability filter shows correct in-stock/out-of-stock
  // counts right away, and so applying a filter can show its full result
  // instantly instead of paginating page by page while the filter is active.
  // Search mode skips this — searchShopifyProducts already returns its full
  // (up to 250) result set in one go via `products`.
  useEffect(() => {
    if (isSearchMode) return;
    let mounted = true;
    fetchShopifyProductsPage({ first: 100 })
      .then((payload) => {
        if (mounted) setFilterSourceProducts(payload?.products || []);
      })
      .catch(() => {
        if (mounted) setFilterSourceProducts([]);
      });
    return () => { mounted = false; };
  }, [isSearchMode]);

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

  useEffect(() => {
    const appId = resolveAppId();
    let mounted = true;
    setProductListDslReady(false);
    setProductListHeaderConfig(null);
    setCommonBackHeaderConfig(null);
    setProductListHeadingSection(null);
    setProductListGridSection(null);
    setProductListFilterSortSection(null);
    Promise.all([
      fetchDSL(appId, "home").catch(() => null),
      fetchDSL(appId, "product-list").catch(() => null),
      fetchDSL(appId, "product-detail").catch(() => null),
    ]).then(([homeData, productListData, productDetailData]) => {
      if (!mounted) return;
      const homeDsl = homeData?.dsl || homeData || {};
      const productListDsl = productListData?.dsl || productListData || {};
      const productDetailDsl = productDetailData?.dsl || productDetailData || {};
      setHomeHeaderConfig(homeDsl?.headerdefault || null);
      setProductListHeaderConfig(productListDsl?.headerdefault || null);
      setCommonBackHeaderConfig(productDetailDsl?.headerdefault || null);
      setProductListHeadingSection(findProductListHeadingSection(productListDsl));
      setProductListGridSection(findProductGridSection(productListDsl));
      setProductListFilterSortSection(findFilterSortSection(productListDsl));
      setProductListDslReady(true);
      const nav = (homeDsl?.sections || []).find((s) => {
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
  }, [isSearchMode, searchTerm, route?.params?.collectionHandle, route?.params?.handle, route?.params?.title]);

  // A price/newest sort needs the same full batch a filter does — sorting
  // just the incrementally-paginated `products` only ever reorders whatever
  // page has loaded so far, so the true lowest-priced product doesn't show
  // on top until pagination happens to reach the page it's on. Once the
  // filter was removed this fell back to `products`, and the client-side
  // sort silently went back to being partial — this was working "by
  // accident" only because a filter was also active, forcing the same fix.
  const sortNeedsFullCatalog =
    sortKey === "Price: Low to High" || sortKey === "Price: High to Low" || sortKey === "What's New";

  // Apply sort + optional filter. In browse mode, an active filter (or a
  // sort that needs the full catalog) switches the source from the
  // incrementally-paginated `products` to `filterSourceProducts` — a larger
  // batch already fully loaded before the user ever opened the filter
  // drawer — so the result appears complete and correctly ordered in one
  // shot instead of trickling in page-by-page as more raw pages are fetched
  // to catch up. Search mode's `products` is already the full result set,
  // so it's used directly either way.
  const displayProducts = useMemo(() => {
    const source = isSearchMode
      ? products
      : ((activeFilter?.length || sortNeedsFullCatalog) ? filterSourceProducts : products);
    const filtered = activeFilter?.length
      ? source.filter((product) => productMatchesAvailabilityFilter(product, activeFilter))
      : source;
    return sortProducts(filtered, sortKey);
  }, [products, filterSourceProducts, sortKey, sortNeedsFullCatalog, activeFilter, isSearchMode]);

  // "Load more" only paginates the unfiltered browse view — the filtered
  // view already shows its full (capped-at-100) result immediately, and
  // search mode already fetched everything up front.
  const hasNextProductPage =
    !activeFilter?.length && !sortNeedsFullCatalog && Boolean(pageInfo?.hasNextPage);

  const handleLoadMore = () => {
    if (loadingMore) return;
    if (!hasNextProductPage) return;
    loadProducts({ after: pageInfo?.endCursor, append: true });
  };

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
          currency: productCurrency(product),
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

  const resultHeaderConfig = productListHeaderConfig || homeHeaderConfig;
  const resolvedHeadingColor = resolveString(
    resultHeaderConfig?.pageTitleColor ?? resultHeaderConfig?.textColor,
    "#111827"
  );
  const resolvedHeadingSize = resolveNumber(
    [
      getRawProps(productListGridSection || null)?.pageTitleFontSize,
      getRawProps(productListGridSection || null)?.titleFontSize,
      getRawProps(productListGridSection || null)?.titleSize,
    ],
    18
  );
  const searchHeaderConfig = resultHeaderConfig || {};
  const searchCommonHeaderConfig = productListHeaderConfig || commonBackHeaderConfig || homeHeaderConfig || {};
  const searchBackConfig =
    findBackHeaderItem(productListHeaderConfig) ||
    findBackHeaderItem(commonBackHeaderConfig) ||
    findBackHeaderItem(homeHeaderConfig);
  const searchBackIconName = normalizeHeaderIconName(
    searchBackConfig?.iconId ?? searchBackConfig?.icon,
    "arrow-left-long"
  );
  const searchBackIconSize = resolveNumber([searchBackConfig?.iconSize], 16);
  const searchBackIconColor = resolveString(
    searchBackConfig?.iconColor ?? searchCommonHeaderConfig?.iconColor ?? searchHeaderConfig?.iconColor,
    "#111827"
  );
  const searchCartConfig =
    findCartHeaderItem(productListHeaderConfig) ||
    findCartHeaderItem(commonBackHeaderConfig) ||
    findCartHeaderItem(homeHeaderConfig);
  const searchCartIconName = normalizeHeaderIconName(
    searchCartConfig?.iconId ?? searchCartConfig?.icon,
    "cart-shopping"
  );
  const searchCartIconSize = resolveNumber([searchCartConfig?.iconSize], 16);
  const searchCartIconColor = resolveString(
    searchCartConfig?.iconColor ?? searchCommonHeaderConfig?.iconColor ?? searchHeaderConfig?.iconColor,
    "#111827"
  );

  const renderItem = ({ item }) => {
    const isListMode = viewMode === "list";
    if (useProductListDslLayout) {
      const inStock = isProductAvailable(item);
      const isFav = isWishlistProduct(wishlistItems, item);
      const price = formatMoney(
        moneyAmount(item.priceAmount ?? item.price),
        productCurrency(item)
      );

      return (
        <TouchableOpacity
          style={[
            styles.searchCard,
            {
              width: CARD_W,
              marginBottom: searchGridConfig.rowGap,
              borderRadius: searchGridConfig.cardRadius,
              backgroundColor: searchGridConfig.cardBgColor,
              borderColor: searchGridConfig.cardBorderColor,
              borderWidth: searchGridConfig.cardBorderWidth,
            },
            isListMode && styles.searchCardList,
          ]}
          activeOpacity={0.85}
          onPress={() => {
            if (favoriteTapRef.current) {
              favoriteTapRef.current = false;
              return;
            }
            navigation.navigate("ProductDetail", { product: item, detailSections });
          }}
        >
          <View
            style={[
              styles.productResultImageWrap,
              { backgroundColor: searchGridConfig.imageBgColor },
              isListMode && styles.productResultImageWrapList,
            ]}
          >
            <ProductImage
              uri={item.imageUrl}
              style={[
                styles.productResultImage,
                {
                  height: searchImageHeight,
                  borderRadius: searchGridConfig.imageCorner,
                  backgroundColor: searchGridConfig.imageBgColor,
                },
                isListMode && styles.productResultImageList,
              ]}
              resizeMode={searchGridConfig.imageScale || resolveProductImageResizeMode()}
              placeholderBg={searchGridConfig.imageBgColor}
            />
            {searchGridConfig.showFavorite ? (
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
            ) : null}
          </View>

          <View style={[styles.searchInfoColumn, isListMode && styles.searchInfoColumnList]}>
            <View style={styles.productResultCardBody}>
              <Text
                numberOfLines={searchGridConfig.titleWrap ? 2 : 1}
                style={[
                  styles.productResultTitle,
                  {
                    textAlign: searchGridConfig.titleAlign,
                    color: searchGridConfig.titleColor,
                    fontSize: searchGridConfig.titleSize,
                    fontWeight: searchGridConfig.titleWeight,
                    ...(searchGridConfig.titleFamily ? { fontFamily: searchGridConfig.titleFamily } : null),
                  },
                ]}
              >
                {item.title}
              </Text>
              {!!price && (
                <Text
                  style={[
                    styles.productResultPrice,
                    {
                      textAlign: searchGridConfig.titleAlign,
                      color: searchGridConfig.priceColor,
                      fontSize: searchGridConfig.priceSize,
                      fontWeight: searchGridConfig.priceWeight,
                      ...(searchGridConfig.priceFamily ? { fontFamily: searchGridConfig.priceFamily } : null),
                    },
                  ]}
                >
                  {price}
                </Text>
              )}
              {(searchGridConfig.showAddToCart || !inStock) && (
                <TouchableOpacity
                  style={inStock ? styles.productResultCartBtnActive : styles.productResultCartBtnSoldOut}
                  activeOpacity={inStock ? 0.8 : 1}
                  disabled={!inStock}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    e?.preventDefault?.();
                    if (inStock) handleAddToCart(item);
                  }}
                >
                  <Text style={styles.productResultCartBtnText}>
                    {inStock ? "Add To Cart" : "Item Not Available"}
                  </Text>
                </TouchableOpacity>
              )}
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
        <ProductImage
          uri={item.imageUrl}
          style={[styles.image, isListMode && styles.imageList]}
          resizeMode={resolveProductImageResizeMode()}
        />
        <View style={styles.content}>
          <Text numberOfLines={isListMode ? 1 : 2} style={styles.name}>
            {item.title}
          </Text>
          <Text style={styles.price}>
            {formatMoney(
              moneyAmount(item.priceAmount ?? item.price),
              productCurrency(item)
            )}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchSkeleton = () => (
    <View
      style={[
        styles.searchSkeletonGrid,
        {
          paddingTop: searchGridConfig.padTop,
          paddingLeft: searchGridConfig.padLeft,
          paddingRight: searchGridConfig.padRight,
          backgroundColor: searchGridConfig.bgColor,
        },
      ]}
    >
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
    <SafeArea edges={["top", "left", "right"]} backgroundColor={pageBg}>
      <View style={[styles.container, { backgroundColor: pageBg }]}>
        {isSearchMode ? (
          <View style={[styles.searchTop, { backgroundColor: pageBg }]}>
            <View style={styles.searchHeader}>
              <TouchableOpacity
                style={styles.headerIconButton}
                activeOpacity={0.75}
                onPress={goBack}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {searchBackIconName ? (
                  <HeaderIcon
                    name={searchBackIconName}
                    size={searchBackIconSize}
                    color={searchBackIconColor}
                  />
                ) : null}
              </TouchableOpacity>
              <View style={styles.searchHeaderSpacer} />
              <TouchableOpacity
                style={styles.headerIconButton}
                activeOpacity={0.75}
                onPress={openCart}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {searchCartIconName ? (
                  <View style={styles.headerIconBadgeWrap}>
                    <HeaderIcon
                      name={searchCartIconName}
                      size={searchCartIconSize}
                      color={searchCartIconColor}
                    />
                    {cartCount > 0 ? (
                      <View style={styles.cartBadge}>
                        <Text style={styles.cartBadgeText}>{cartCount > 99 ? "99+" : String(cartCount)}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
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
        ) : resultHeaderConfig ? (
          <HeaderDefault config={resultHeaderConfig} bottomNavSection={bottomNavSection} hideTabs showBack />
        ) : null}
        {!isSearchMode && productListHeadingSection ? (
          <DynamicRenderer section={productListHeadingSection} />
        ) : !isSearchMode ? (
          <View style={styles.headerSection}>
            <Text style={[styles.heading, { color: resolvedHeadingColor, fontSize: resolvedHeadingSize }]}>
              {title || "Products"}
            </Text>
          </View>
        ) : null}

        {/* Filter + Sort bar — no filterItems passed, so this always shows
            Builder's actual static "Availability" filter labels (In stock /
            Out of stock / Available soon) instead of categories derived from
            the fetched products; `products` feeds it real counts for those
            labels instead of Builder's hardcoded mockup numbers. */}
        {productListDslReady && productListFilterSortSection ? (
          <FilterSortHeader
            section={productListFilterSortSection}
            products={isSearchMode ? products : filterSourceProducts}
            onSortChange={(opt) => setSortKey(opt)}
            onViewModeChange={(mode) => setViewMode(mode)}
            onFilterChange={(filter) => setActiveFilter(filter)}
          />
        ) : null}

        <View style={[styles.listArea, useProductListDslLayout && styles.searchListArea]}>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {loading && useProductListDslLayout ? renderSearchSkeleton() : null}
          {loading && !useProductListDslLayout ? <ActivityIndicator size="small" color="#111827" /> : null}

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
                useProductListDslLayout && {
                  paddingTop: searchGridConfig.padTop,
                  paddingBottom: searchGridConfig.padBottom + (bottomNavSection ? bottomNavHeight + 16 : 24),
                  paddingLeft: searchGridConfig.padLeft,
                  paddingRight: searchGridConfig.padRight,
                  backgroundColor: searchGridConfig.bgColor,
                },
                !useProductListDslLayout && { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 24 },
              ]}
              ListEmptyComponent={
                isSearchMode ? renderEmptyState : (
                  <Text style={styles.status}>No products available yet.</Text>
                )
              }
              ListFooterComponent={
                hasNextProductPage ? (
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
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
  },
  searchHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchHeaderSpacer: {
    flex: 1,
  },
  headerIconBadgeWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#EF4444",
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
    includeFontPadding: false,
    textAlignVertical: "center",
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
  searchListArea: {
    paddingHorizontal: 0,
    paddingTop: 0,
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
    fontWeight: "700",
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
    overflow: "hidden",
  },
  searchCardList: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  productResultImageWrap: {
    position: "relative",
    width: "100%",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  productResultImageWrapList: {
    width: 100,
    flexShrink: 0,
  },
  productResultImage: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  productResultImageList: {
    width: 100,
    height: 100,
  },
  productResultPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  productResultPlaceholderText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#9CA3AF",
  },
  productResultCardBody: {
    padding: 10,
    gap: 4,
  },
  productResultTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  productResultPrice: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },
  productResultCartBtnActive: {
    marginTop: 4,
    backgroundColor: "#111111",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  productResultCartBtnSoldOut: {
    marginTop: 4,
    backgroundColor: "#7A7A7A",
    borderRadius: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  productResultCartBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
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
  searchCardBody: {
    paddingTop: 6,
    gap: 5,
  },
  searchProductTitle: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
  },
  searchPrice: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import { fetchShopifyProductsPage, searchShopifyProducts } from "../services/shopify";
import { recordUserSearchTerm } from "../services/searchHistoryService";
import { SafeArea } from "../utils/SafeAreaHandler";
import HeaderDefault from "../components/HeaderDefault";
import FilterSortHeader from "../components/FilterSortHeader";
import BottomNavigation, { BOTTOM_NAV_RESERVED_HEIGHT } from "../components/BottomNavigation";
import Snackbar from "../components/Snackbar";
import { fetchDSL } from "../engine/dslHandler";
import { resolveAppId } from "../utils/appId";
import { buildProductFilterOptions, productMatchesFilter } from "../utils/productFilters";
import { formatMoney } from "../utils/money";
import { resolveProductImageResizeMode } from "../utils/productImageFit";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveFont } from "../services/typographyService";
import { addItem } from "../store/slices/cartSlice";
import { isWishlistProduct, toggleWishlist } from "../store/slices/wishlistSlice";
import FavoriteToggleButton, { buildFavoriteToggleConfig } from "../components/FavoriteToggleButton";
import { useAuth } from "../services/AuthContext";
import { requireLoginForAction } from "../utils/authGate";

const GAP = 12;
const H_PAD = 16;
const { width: SCREEN_W } = Dimensions.get("window");

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

const PAGE_SIZE = 20;

export default function AllProductsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
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
  const [sortKey, setSortKey]         = useState("Popular");
  const [viewMode, setViewMode]       = useState("grid");
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [filterOptions, setFilterOptions] = useState([]);
  const [bottomNavSection, setBottomNavSection] = useState(null);
  const [bottomNavHeight, setBottomNavHeight]   = useState(BOTTOM_NAV_RESERVED_HEIGHT);
  const [homeHeaderConfig, setHomeHeaderConfig] = useState(null);
  const [productListHeaderConfig, setProductListHeaderConfig] = useState(null);
  const [productListGridSection, setProductListGridSection] = useState(null);
  const [productListFilterSortSection, setProductListFilterSortSection] = useState(null);
  const [cartSnackbarVisible, setCartSnackbarVisible] = useState(false);
  const [cartSnackbarMessage, setCartSnackbarMessage] = useState("");
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
      "#FFFFFF"
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
      bgColor: resolveString(raw?.bgColor ?? containerCss?.backgroundColor, "#FFFFFF"),
    };
  }, [productListGridSection]);

  const numColumns = isSearchMode
    ? (viewMode === "list" ? 1 : searchGridConfig.columns)
    : (viewMode === "list" ? 1 : 2);
  const CARD_W = viewMode === "list"
    ? SCREEN_W - (isSearchMode ? searchGridConfig.padLeft + searchGridConfig.padRight : H_PAD * 2)
    : isSearchMode
    ? (SCREEN_W - searchGridConfig.padLeft - searchGridConfig.padRight - searchGridConfig.colGap * (numColumns - 1)) / numColumns
    : (SCREEN_W - H_PAD * 2 - GAP) / 2;
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
    Promise.all([
      fetchDSL(appId, "home").catch(() => null),
      fetchDSL(appId, "product-list").catch(() => null),
    ]).then(([homeData, productListData]) => {
      if (!mounted) return;
      const homeDsl = homeData?.dsl || homeData || {};
      const productListDsl = productListData?.dsl || productListData || {};
      setHomeHeaderConfig(homeDsl?.headerdefault || null);
      setProductListHeaderConfig(productListDsl?.headerdefault || null);
      setProductListGridSection(findProductGridSection(productListDsl));
      setProductListFilterSortSection(findFilterSortSection(productListDsl));
      const nav = (homeDsl?.sections || []).find((s) => {
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
          price: parseFloat(product.priceAmount ?? product.price) || 0,
          variant: "",
          currency: productCurrency(product),
          quantity: 1,
        },
      })
    );
    if (cartSnackbarTimerRef.current) clearTimeout(cartSnackbarTimerRef.current);
    setCartSnackbarVisible(false);
    setCartSnackbarMessage(`${product?.title || "Product"} added to cart successfully.`);
    cartSnackbarTimerRef.current = setTimeout(() => setCartSnackbarVisible(true), 0);
  };

  const resultHeaderConfig = productListHeaderConfig || homeHeaderConfig;
  const searchHeaderConfig = resultHeaderConfig || {};
  const searchBackConfig = findBackHeaderItem(searchHeaderConfig);
  const searchBackIconName = resolveFA4IconName(
    resolveString(searchBackConfig?.iconId ?? searchBackConfig?.icon, "")
  ) || "long-arrow-left";
  const searchBackIconSize = resolveNumber([searchBackConfig?.iconSize], 16);
  const searchBackIconColor = resolveString(
    searchBackConfig?.iconColor ?? searchHeaderConfig?.iconColor,
    "#111827"
  );
  const searchCartConfig = findCartHeaderItem(searchHeaderConfig);
  const searchCartIconName = resolveFA4IconName(
    resolveString(searchCartConfig?.iconId ?? searchCartConfig?.icon, "")
  ) || "shopping-cart";
  const searchCartIconSize = resolveNumber([searchCartConfig?.iconSize], 16);
  const searchCartIconColor = resolveString(
    searchCartConfig?.iconColor ?? searchHeaderConfig?.iconColor,
    "#111827"
  );

  const renderItem = ({ item }) => {
    const isListMode = viewMode === "list";
    if (isSearchMode) {
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
              backgroundColor: "#FFFFFF",
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
              isListMode && styles.productResultImageWrapList,
            ]}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={[
                  styles.productResultImage,
                  {
                    height: searchImageHeight,
                    borderRadius: searchGridConfig.imageCorner,
                  },
                  isListMode && styles.productResultImageList,
                ]}
                resizeMode={searchGridConfig.imageScale || resolveProductImageResizeMode()}
              />
            ) : (
              <View
                style={[
                  styles.productResultImage,
                  styles.productResultPlaceholder,
                  {
                    height: searchImageHeight,
                    borderRadius: searchGridConfig.imageCorner,
                  },
                  isListMode && styles.productResultImageList,
                ]}
              >
                <Text style={styles.productResultPlaceholderText}>
                  {(item.title || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
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

  const productListFilterSortProps = getRawProps(productListFilterSortSection);
  const resultFilterSortSection = isSearchMode
    ? {
        props: {
          ...productListFilterSortProps,
          variant: "searchResults",
          compactSearchControls: true,
          pt: productListFilterSortProps?.pt ?? 6,
          pb: productListFilterSortProps?.pb ?? 8,
        },
      }
    : (productListFilterSortSection || {});

  return (
    <SafeArea edges={["top", "left", "right"]}>
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
                {searchBackIconName ? (
                  <FontAwesome
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
                  <View>
                    <FontAwesome
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
        {!isSearchMode && (
          <View style={styles.headerSection}>
            <Text style={styles.heading}>
              {title || "Products"}
            </Text>
          </View>
        )}

        {/* Filter + Sort bar */}
        <FilterSortHeader
          section={resultFilterSortSection}
          filterItems={filterOptions}
          onSortChange={(opt) => setSortKey(opt)}
          onViewModeChange={(mode) => setViewMode(mode)}
          onFilterChange={(filter) => setActiveFilter(filter)}
        />

        <View style={[styles.listArea, isSearchMode && styles.searchListArea]}>
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
                isSearchMode && {
                  paddingTop: searchGridConfig.padTop,
                  paddingBottom: searchGridConfig.padBottom + (bottomNavSection ? bottomNavHeight + 16 : 24),
                  paddingLeft: searchGridConfig.padLeft,
                  paddingRight: searchGridConfig.padRight,
                  backgroundColor: "#FFFFFF",
                },
                !isSearchMode && { paddingBottom: bottomNavSection ? bottomNavHeight + 16 : 24 },
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

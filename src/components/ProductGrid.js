import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { addItem } from "../store/slices/cartSlice";
import { toggleWishlist } from "../store/slices/wishlistSlice";
import { fetchShopifyProductsPage, fetchShopifyCollectionProducts } from "../services/shopify";
import Snackbar from "./Snackbar";

// ── DSL helpers ───────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

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

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const resolveFirstNumber = (values, fallback) => {
  for (const entry of values) {
    const resolved = toNumber(entry, undefined);
    if (resolved !== undefined) return resolved;
  }
  return fallback;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  const normalized = String(resolved).trim().toLowerCase();
  if (["true", "yes", "1"].includes(normalized)) return true;
  if (["false", "no", "0"].includes(normalized)) return false;
  return fallback;
};

const toTextAlign = (value, fallback = "left") => {
  const resolved = toString(value, fallback).toLowerCase();
  if (resolved === "center") return "center";
  if (resolved === "right") return "right";
  return "left";
};

const toFontWeight = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "number") return String(resolved);
  const normalized = String(resolved).trim().toLowerCase();
  if (normalized === "bold") return "700";
  if (normalized === "semibold" || normalized === "semi bold") return "600";
  if (normalized === "medium") return "500";
  if (normalized === "regular" || normalized === "normal") return "400";
  if (/^\d+$/.test(normalized)) return normalized;
  return fallback;
};

// Strip web CSS fallback fonts ("Poppins, sans-serif" → "Poppins")
const cleanFontFamily = (family) => {
  if (!family) return "";
  return family.split(",")[0].trim().replace(/['"]/g, "");
};


// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductGrid({ section, limit = 8, title = "Products" }) {
  const navigation = useNavigation();
  const dispatch   = useDispatch();
  const wishlistItems = useSelector((state) => state.wishlist?.items || []);
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [hasMore,      setHasMore]      = useState(false);
  const [snackVisible, setSnackVisible] = useState(false);
  const [snackMessage, setSnackMessage] = useState("");

  // ── Merge raw sub-object ──────────────────────────────────────────────────
  const rawProps = getRawProps(section);
  const gridObj  = deepUnwrap(rawProps?.grid);

  // ── Presentation CSS nodes ────────────────────────────────────────────────
  const presentation    = unwrapValue(rawProps?.presentation, {});
  const presentationCss = unwrapValue(presentation?.css, {});
  const headerCss       = presentationCss?.header  ?? {};
  const cardCss         = presentationCss?.card    ?? {};
  const cardTitleCss    = cardCss?.title  ?? {};
  const cardPriceCss    = cardCss?.price  ?? {};
  const cardImageCss    = cardCss?.image  ?? {};
  const viewAllCss      = presentationCss?.viewAll ?? {};

  // ── Items / columns ───────────────────────────────────────────────────────
  const resolvedLimit = resolveFirstNumber(
    [rawProps?.itemsShown, gridObj?.itemsShown, rawProps?.productsToShow, rawProps?.productCount, rawProps?.limit],
    limit
  );
  const resolvedColumns = Math.max(1, Math.round(resolveFirstNumber(
    [rawProps?.columns, gridObj?.columns],
    2
  )));

  // ── Visibility flags ──────────────────────────────────────────────────────
  const resolvedShowGridTitle = toBoolean(
    rawProps?.gridTitleActive ?? rawProps?.headerGroupActive ?? rawProps?.showTitle,
    true
  );
  const resolvedShowCardTitle = toBoolean(
    rawProps?.cardTitleActive ?? rawProps?.showTitle,
    true
  );
  const resolvedShowPrice = toBoolean(
    rawProps?.cardPriceActive ?? rawProps?.showPrice,
    true
  );
  const resolvedFavMode = toString(rawProps?.favMode, "").toLowerCase();
  // Explicit DSL flags always win. "always show" mode is used only as the default fallback
  // when no explicit flag is present — it cannot override an explicit false.
  const resolvedShowFavorite = toBoolean(
    rawProps?.favoriteIconEnabled ??
    rawProps?.favActive ??
    rawProps?.showFavorite ??
    rawProps?.showFavoriteIcon ??
    rawProps?.favEnabled,
    resolvedFavMode === "always show" // fallback: true only when favMode="always show"
  );
  const resolvedViewAllActive = toBoolean(
    rawProps?.viewAllActive ?? rawProps?.showViewAll,
    true
  );
  const resolvedTitleWrap = toBoolean(
    rawProps?.titleWrap ?? rawProps?.textWrap ?? rawProps?.productTitleWrap ?? rawProps?.cardTitleWrap,
    false
  );

  // ── Shopify credentials ───────────────────────────────────────────────────
  const shopifyDomain = toString(rawProps?.shopifyDomain, "");
  const shopifyToken  = toString(rawProps?.storefrontToken, "");

  // ── Collection handle ─────────────────────────────────────────────────────
  // DSL places dataSource as sibling of props under section.properties (same as ProductCarousel)
  const gridDataSourceRaw =
    section?.properties?.dataSource ||   // primary: builder puts it here
    section?.dataSource ||               // flat / legacy
    rawProps?.dataSource ||              // inside props (rare)
    {};
  const gridDataSource = gridDataSourceRaw?.properties || gridDataSourceRaw;
  const gridDataSourceMode = unwrapValue(gridDataSource?.mode, "");

  // Builder may use "collection" OR "collectionHandle" as the DSL key — check both.
  // Also fall back to raw-level keys (rawProps.collection / rawProps.collectionHandle).
  const collectionHandleRaw = (
    toString(gridDataSource?.collection, "") ||
    toString(gridDataSource?.collectionHandle, "") ||
    toString(gridDataSource?.collectionId, "") ||
    toString(rawProps?.collection, "") ||
    toString(rawProps?.collectionHandle, "") ||
    toString(rawProps?.collectionId, "")
  );

  // Normalize title → slug ("Co-ord Sets Women" → "co-ord-sets-women")
  const collectionHandle = collectionHandleRaw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Fetch collection products when: a handle exists AND mode is not explicitly "all_products"
  const useCollectionFetch =
    !!collectionHandle && gridDataSourceMode !== "all_products";

  // ── Section header typography ─────────────────────────────────────────────
  const resolvedTitle         = toString(rawProps?.header ?? rawProps?.title, title);
  const resolvedTitleAlign    = toTextAlign(
    rawProps?.alignText ?? rawProps?.headerAlign ?? rawProps?.layoutAlign ?? headerCss?.textAlign,
    "left"
  );
  const resolvedAlignText     = toTextAlign(rawProps?.alignText, "left");
  const resolvedTitleFontSize = resolveFirstNumber(
    [rawProps?.headerSize, rawProps?.headerFontSize, rawProps?.titleSize, rawProps?.headerTextSize, headerCss?.fontSize],
    18
  );
  // DSL key: headerColor (primary) → titleColor → presentation.css.header.color
  const resolvedTitleColor = toString(
    rawProps?.headerColor ?? rawProps?.titleColor ?? rawProps?.headerTextColor ?? headerCss?.color,
    "#111827"
  );
  // DSL key: headerWeight (primary) → titleWeight → presentation.css.header.fontWeight
  const resolvedTitleWeight = toFontWeight(
    rawProps?.headerWeight ?? rawProps?.titleWeight ?? rawProps?.headerFontWeight ?? headerCss?.fontWeight,
    "700"
  );
  // DSL key: headerFamily (primary) → titleFontFamily → headerFontFamily → presentation.css.header.fontFamily
  const resolvedTitleFontFamily = cleanFontFamily(toString(
    rawProps?.headerFamily ?? rawProps?.titleFontFamily ?? rawProps?.headerFontFamily ?? rawProps?.titleFamily ?? headerCss?.fontFamily,
    ""
  ));

  // ── View All ──────────────────────────────────────────────────────────────
  const viewAllTypography       = unwrapValue(rawProps?.viewAllTypography ?? rawProps?.viewAllStyle ?? rawProps?.viewAllTextStyle, {});
  const resolvedViewAllText     = toString(rawProps?.viewAllText, "View all");
  const resolvedViewAllFontSize = resolveFirstNumber(
    [viewAllTypography?.size, rawProps?.viewAllTextSize, rawProps?.viewAllFontSize, rawProps?.viewAllSize, viewAllCss?.fontSize],
    14
  );
  const resolvedViewAllColor      = toString(viewAllTypography?.color ?? rawProps?.viewAllTextColor ?? rawProps?.viewAllColor ?? viewAllCss?.color, "#111827");
  const resolvedViewAllWeight     = toFontWeight(viewAllTypography?.weightNum ?? viewAllTypography?.weight ?? rawProps?.viewAllFontWeightNum ?? rawProps?.viewAllFontWeight ?? rawProps?.viewAllWeight ?? viewAllCss?.fontWeight, "600");
  const resolvedViewAllFontFamily = cleanFontFamily(toString(viewAllTypography?.fontFamily ?? rawProps?.viewAllFontFamily ?? viewAllCss?.fontFamily, ""));

  // ── Image ─────────────────────────────────────────────────────────────────
  const resolvedImageCorner = resolveFirstNumber(
    [rawProps?.imageCorner, rawProps?.imageCornerRadius, rawProps?.imageRadius, cardImageCss?.borderRadius],
    undefined
  );
  const resolvedImageHeight    = resolveFirstNumber([rawProps?.imageHeight, rawProps?.productImageHeight], 180);
  const resolvedImageRatioStr  = toString(rawProps?.imageRatio ?? rawProps?.ratio, "");
  const imageAspectMultiplier  = (() => {
    if (!resolvedImageRatioStr) return null;
    const parts = resolvedImageRatioStr.split(":");
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) return h / w;
    }
    return null;
  })();
  const resolvedImageScaleRaw = toString(rawProps?.imageScale ?? rawProps?.scale ?? rawProps?.imageResizeMode, "fill").toLowerCase();
  const imageResizeMode = (() => {
    if (resolvedImageScaleRaw === "fit" || resolvedImageScaleRaw === "contain") return "contain";
    if (resolvedImageScaleRaw === "stretch") return "stretch";
    if (resolvedImageScaleRaw === "center") return "center";
    return "cover";
  })();
  const resolvedImageBgColor = toString(rawProps?.imageBackgroundColor ?? rawProps?.imageBgColor ?? cardImageCss?.backgroundColor, "#f3f4f6");
  const imagePad             = resolveFirstNumber([rawProps?.imagePad, rawProps?.imagePadding, rawProps?.imageWrapperPad], 0);

  // ── Card ──────────────────────────────────────────────────────────────────
  const resolvedCardCorner     = resolveFirstNumber([rawProps?.cardCorner, rawProps?.cardRadius, rawProps?.cardBorderRadius], 8);
  const resolvedCardBgColor    = toString(rawProps?.cardBackgroundColor ?? rawProps?.cardBgColor ?? cardCss?.backgroundColor, "#ffffff");
  const resolvedCardBorderColor = toString(rawProps?.cardBorderColor ?? cardCss?.borderColor, "#e5e7eb");
  const resolvedCardBorderWidth = resolveFirstNumber([rawProps?.cardBorderWidth, cardCss?.borderWidth], 1);
  const cardCorner             = resolvedImageCorner ?? resolvedCardCorner;
  const cardPadX               = resolveFirstNumber([rawProps?.cardPadX, rawProps?.cardPaddingX, rawProps?.cardPaddingH, rawProps?.contentPadX], 10);
  const cardPadY               = resolveFirstNumber([rawProps?.cardPadY, rawProps?.cardPaddingY, rawProps?.cardPaddingV, rawProps?.contentPadY], 8);

  // ── Product title (inside card) ───────────────────────────────────────────
  const resolvedProductTitleSize       = resolveFirstNumber([rawProps?.productTitleSize, rawProps?.itemTitleSize, rawProps?.cardTitleSize, cardTitleCss?.fontSize], 14);
  const resolvedProductTitleColor      = toString(rawProps?.productTitleColor ?? rawProps?.itemTitleColor ?? cardTitleCss?.color, "#111827");
  const resolvedProductTitleWeight     = toFontWeight(rawProps?.productTitleWeight ?? rawProps?.itemTitleWeight ?? cardTitleCss?.fontWeight, "600");
  const resolvedProductTitleFontFamily = cleanFontFamily(toString(rawProps?.productTitleFontFamily ?? cardTitleCss?.fontFamily, ""));

  // ── Price ─────────────────────────────────────────────────────────────────
  const resolvedPriceSize       = resolveFirstNumber([rawProps?.priceSize, rawProps?.productPriceSize, rawProps?.cardPriceSize, cardPriceCss?.fontSize], 14);
  const resolvedPriceColor      = toString(rawProps?.priceColor ?? rawProps?.productPriceColor ?? cardPriceCss?.color, "#111827");
  const resolvedPriceWeight     = toFontWeight(rawProps?.priceWeight ?? rawProps?.productPriceWeight ?? cardPriceCss?.fontWeight, "600");
  const resolvedPriceFontFamily = cleanFontFamily(toString(rawProps?.priceFontFamily ?? rawProps?.productPriceFontFamily ?? cardPriceCss?.fontFamily, ""));
  const resolvedPriceMarginTop  = resolveFirstNumber([rawProps?.priceMarginTop, rawProps?.priceMt], 4);

  // ── Status / Error text ───────────────────────────────────────────────────
  const resolvedStatusColor      = toString(rawProps?.statusColor ?? presentationCss?.status?.color, "#6b7280");
  const resolvedStatusFontSize   = resolveFirstNumber([rawProps?.statusFontSize, rawProps?.statusSize, presentationCss?.status?.fontSize], 14);
  const resolvedStatusWeight     = toFontWeight(rawProps?.statusFontWeight ?? rawProps?.statusWeight ?? presentationCss?.status?.fontWeight, "500");
  const resolvedStatusFontFamily = cleanFontFamily(toString(rawProps?.statusFontFamily ?? presentationCss?.status?.fontFamily, ""));
  const resolvedErrorColor       = toString(rawProps?.errorColor ?? presentationCss?.error?.color, "#b91c1c");
  const resolvedErrorFontSize    = resolveFirstNumber([rawProps?.errorFontSize, rawProps?.errorSize, presentationCss?.error?.fontSize], 14);
  const resolvedErrorWeight      = toFontWeight(rawProps?.errorFontWeight ?? rawProps?.errorWeight ?? presentationCss?.error?.fontWeight, "500");
  const resolvedErrorFontFamily  = cleanFontFamily(toString(rawProps?.errorFontFamily ?? presentationCss?.error?.fontFamily, ""));

  // ── Favorite badge ────────────────────────────────────────────────────────
  const resolvedFavBgColor        = toString(rawProps?.favoriteBackgroundColor ?? rawProps?.favoriteBgColor ?? presentationCss?.favorite?.backgroundColor, "rgba(255,255,255,0.9)");
  const resolvedFavIconColor      = toString(rawProps?.favoriteColor ?? rawProps?.favoriteIconColor ?? presentationCss?.favorite?.color, "#e11d48");
  const resolvedFavIconSize       = resolveFirstNumber([rawProps?.favoriteIconSize, rawProps?.favoriteSize, presentationCss?.favorite?.fontSize], 14);
  const resolvedFavIconWeight     = toFontWeight(rawProps?.favoriteIconWeight ?? rawProps?.favoriteWeight ?? presentationCss?.favorite?.fontWeight, "700");
  const resolvedFavIconFontFamily = cleanFontFamily(toString(rawProps?.favoriteIconFontFamily ?? presentationCss?.favorite?.fontFamily, ""));

  // ── Add-to-Cart button ────────────────────────────────────────────────────
  const cardAddToCartCss    = deepUnwrap(cardCss?.addToCart) || deepUnwrap(presentationCss?.addToCart) || deepUnwrap(presentationCss?.button) || {};
  const showAddToCart       = toBoolean(rawProps?.atcActive ?? rawProps?.showAddToCart ?? rawProps?.showCartButton ?? rawProps?.addToCartEnabled ?? rawProps?.cartBtnEnabled, true);
  const addToCartLabel      = toString(rawProps?.addToCartText ?? rawProps?.cartBtnText ?? rawProps?.addToCartLabel ?? rawProps?.cartButtonText ?? cardAddToCartCss?.label, "Add to Cart");
  const addToCartBgColor    = toString(rawProps?.addToCartBgColor ?? rawProps?.cartBtnBgColor ?? rawProps?.buttonBgColor ?? rawProps?.btnBgColor ?? cardAddToCartCss?.backgroundColor, "#0D9488");
  const addToCartTextColor  = toString(rawProps?.addToCartTextColor ?? rawProps?.cartBtnTextColor ?? rawProps?.buttonTextColor ?? rawProps?.btnTextColor ?? cardAddToCartCss?.color, "#FFFFFF");
  const addToCartBorderRadius = resolveFirstNumber([rawProps?.addToCartBorderRadius, rawProps?.cartBtnRadius, rawProps?.btnRadius, cardAddToCartCss?.borderRadius], 6);
  const addToCartFontSize   = resolveFirstNumber([rawProps?.addToCartFontSize, rawProps?.cartBtnFontSize, cardAddToCartCss?.fontSize], 13);
  const addToCartFontWeight = toFontWeight(rawProps?.addToCartFontWeight ?? rawProps?.cartBtnFontWeight ?? cardAddToCartCss?.fontWeight, "600");
  const addToCartFontFamily = cleanFontFamily(toString(rawProps?.addToCartFontFamily ?? rawProps?.cartBtnFontFamily ?? cardAddToCartCss?.fontFamily, ""));
  const atcPadT   = resolveFirstNumber([rawProps?.atcPadT, rawProps?.atcPadY], 6);
  const atcPadB   = resolveFirstNumber([rawProps?.atcPadB, rawProps?.atcPadY], 6);
  const atcPadL   = resolveFirstNumber([rawProps?.atcPadL, rawProps?.atcPadX], 10);
  const atcPadR   = resolveFirstNumber([rawProps?.atcPadR, rawProps?.atcPadX], 10);
  const atcMarginT = resolveFirstNumber([rawProps?.atcMarginT, rawProps?.atcMarginTop], 4);
  const atcMarginB = resolveFirstNumber([rawProps?.atcMarginB, rawProps?.atcMarginBottom], 8);
  const atcMarginX = resolveFirstNumber([rawProps?.atcMarginX, rawProps?.atcMarginH], 8);
  const atcAlignRaw = toString(
    rawProps?.atcAlign ??
    rawProps?.addToCartAlign ??
    rawProps?.cartBtnAlign ??
    rawProps?.btnAlign ??
    rawProps?.buttonAlign ??
    rawProps?.alignment,
    ""
  ).toLowerCase();
  // justifyContent for the wrapper row-View that wraps the button
  const atcWrapJustify =
    atcAlignRaw === "center" ? "center" :
    atcAlignRaw === "right"  ? "flex-end" :
    atcAlignRaw === "left"   ? "flex-start" :
    "flex-start"; // stretch: button uses flex:1 inside wrapper
  // When no explicit alignment, button fills full width via flex:1
  const atcIsStretch = !atcAlignRaw || atcAlignRaw === "stretch";

  // ── Add-to-Cart icon ──────────────────────────────────────────────────────
  const atcAvailableIconId = toString(rawProps?.atcAvailableIconId ?? rawProps?.atcIconId, "");
  const atcSoldOutIconId   = toString(rawProps?.atcSoldOutIconId, "");
  const atcIconPosition    = toString(rawProps?.atcIconPosition, "left").toLowerCase();
  const atcIconSize        = resolveFirstNumber([rawProps?.atcIconSize], 14);

  // ── Add-to-Cart position ──────────────────────────────────────────────────
  // "Above Product Details" → render ATC between image and title/price
  // "Below Product Details" → render ATC after title/price (default)
  const atcPositionRaw = toString(
    rawProps?.atcPosition ??
    rawProps?.addToCartPosition ??
    rawProps?.cartBtnPosition ??
    rawProps?.atcPos ??
    rawProps?.buttonPosition ??
    rawProps?.cartPosition,
    "below"
  ).toLowerCase();
  const atcAbove =
    atcPositionRaw.includes("above") ||
    atcPositionRaw.includes("top") ||
    atcPositionRaw.includes("before");

  // ── Container spacing ─────────────────────────────────────────────────────
  const pt = resolveFirstNumber([rawProps?.pt, rawProps?.paddingTop],    12);
  const pb = resolveFirstNumber([rawProps?.pb, rawProps?.paddingBottom],  0);
  const pl = resolveFirstNumber([rawProps?.pl, rawProps?.paddingLeft],   16);
  const pr = resolveFirstNumber([rawProps?.pr, rawProps?.paddingRight],  16);

  // ── Grid gaps + card width ────────────────────────────────────────────────
  const resolvedColGap = resolveFirstNumber([rawProps?.colGap, rawProps?.columnGap, rawProps?.gapX, rawProps?.gridGap, gridObj?.gap], 8);
  const resolvedRowGap = resolveFirstNumber([rawProps?.rowGap, rawProps?.gapY, gridObj?.rowGap], 8);
  const gridGap        = resolvedColGap;
  const screenWidth    = Dimensions.get("window").width;
  const totalGap       = gridGap * (resolvedColumns - 1);
  const cardWidth      = Math.max(0, (screenWidth - pl - pr - totalGap) / resolvedColumns);

  // ── Final image height (from ratio or explicit height) ────────────────────
  const imageHeight = imageAspectMultiplier ? cardWidth * imageAspectMultiplier : resolvedImageHeight;
  const imageCorner = resolvedImageCorner ?? 0;

  // ── Header row bottom margin ──────────────────────────────────────────────
  const headerMarginBottom = resolveFirstNumber([rawProps?.headerMarginBottom, rawProps?.titleMarginBottom, rawProps?.headerMb], 12);

  // ── Background color ──────────────────────────────────────────────────────
  const resolvedBgColor = toString(rawProps?.bgColor ?? presentationCss?.container?.backgroundColor, "");

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddToCart = useCallback((product, e) => {
    if (e?.stopPropagation) e.stopPropagation();
    const variantId =
      product?.variantId ||
      product?.variants?.[0]?.id ||
      product?.defaultVariantId ||
      product?.id ||
      "";
    dispatch(
      addItem({
        item: {
          id:             variantId || product?.id,
          variantId:      String(variantId),
          handle:         product?.handle || "",
          title:          product?.title || "",
          image:          product?.imageUrl || "",
          price:          parseFloat(product?.priceAmount) || 0,
          compareAtPrice: parseFloat(product?.compareAtPrice) || 0,
          vendor:         product?.vendor || "",
          variant:        product?.variantTitle || "",
          currency:       product?.priceCurrency || "",
          quantity:       1,
        },
      })
    );
  }, [dispatch]);

  const detailSections = useMemo(() => {
    const candidates = [
      rawProps?.productDetailSections,
      rawProps?.detailSections,
      rawProps?.productDetails,
      rawProps?.detail,
      rawProps?.details,
    ];
    for (const candidate of candidates) {
      const resolved = unwrapValue(candidate, undefined);
      if (Array.isArray(resolved)) return resolved;
      if (Array.isArray(resolved?.sections)) return resolved.sections;
    }
    return [];
  }, [rawProps]);

  // ── Data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    const loadProducts = async () => {
      setLoading(true);
      setError("");
      try {
        let payload;
        if (useCollectionFetch && collectionHandle) {
          payload = await fetchShopifyCollectionProducts({
            handle: collectionHandle,
            first:  resolvedLimit,
          });
        } else {
          payload = await fetchShopifyProductsPage({
            first: resolvedLimit,
            after: null,
            options: {
              shop:  shopifyDomain || undefined,
              token: shopifyToken  || undefined,
            },
          });
        }
        if (isMounted) {
          setProducts(payload?.products || []);
          setHasMore(Boolean(payload?.pageInfo?.hasNextPage));
        }
      } catch {
        if (isMounted) setError("Unable to load products right now. Please try again later.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProducts();
    return () => { isMounted = false; };
  }, [useCollectionFetch, collectionHandle, resolvedLimit, shopifyDomain, shopifyToken]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.wrapper,
        resolvedBgColor ? { backgroundColor: resolvedBgColor } : null,
        { paddingTop: pt, paddingBottom: pb, paddingLeft: pl, paddingRight: pr },
      ]}
    >
      {/* Section header row */}
      {(resolvedShowGridTitle || (resolvedViewAllActive && hasMore)) && (
        <View style={[styles.headerRow, { marginBottom: headerMarginBottom }]}>
          {resolvedTitleAlign === "right" ? (
            <>
              {resolvedViewAllActive && hasMore && (
                <TouchableOpacity
                  style={styles.viewAllInline}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("AllProducts", { title: resolvedTitle, detailSections })}
                >
                  <Text
                    style={[
                      styles.viewAllText,
                      {
                        color:      resolvedViewAllColor,
                        fontSize:   resolvedViewAllFontSize,
                        fontWeight: resolvedViewAllWeight,
                        ...(resolvedViewAllFontFamily ? { fontFamily: resolvedViewAllFontFamily } : null),
                      },
                    ]}
                  >
                    {resolvedViewAllText} ›
                  </Text>
                </TouchableOpacity>
              )}
              {resolvedShowGridTitle && (
                <Text
                  style={[
                    styles.heading,
                    {
                      textAlign:  "right",
                      fontSize:   resolvedTitleFontSize,
                      color:      resolvedTitleColor,
                      fontWeight: resolvedTitleWeight,
                      ...(resolvedTitleFontFamily ? { fontFamily: resolvedTitleFontFamily } : null),
                    },
                  ]}
                >
                  {resolvedTitle}
                </Text>
              )}
            </>
          ) : (
            <>
          {resolvedShowGridTitle && (
            <Text
              style={[
                styles.heading,
                {
                  textAlign:  resolvedTitleAlign,
                  fontSize:   resolvedTitleFontSize,
                  color:      resolvedTitleColor,
                  fontWeight: resolvedTitleWeight,
                  ...(resolvedTitleFontFamily ? { fontFamily: resolvedTitleFontFamily } : null),
                },
              ]}
            >
              {resolvedTitle}
            </Text>
          )}

          {resolvedViewAllActive && hasMore && (
            <TouchableOpacity
              style={styles.viewAllInline}
              activeOpacity={0.8}
              onPress={() => navigation.navigate("AllProducts", { title: resolvedTitle, detailSections })}
            >
              <Text
                style={[
                  styles.viewAllText,
                  {
                    color:      resolvedViewAllColor,
                    fontSize:   resolvedViewAllFontSize,
                    fontWeight: resolvedViewAllWeight,
                    ...(resolvedViewAllFontFamily ? { fontFamily: resolvedViewAllFontFamily } : null),
                  },
                ]}
              >
                {resolvedViewAllText} ›
              </Text>
            </TouchableOpacity>
          )}
            </>
          )}
        </View>
      )}

      {/* Loading */}
      {loading && (
        <Text
          style={[
            styles.status,
            {
              color:      resolvedStatusColor,
              fontSize:   resolvedStatusFontSize,
              fontWeight: resolvedStatusWeight,
              ...(resolvedStatusFontFamily ? { fontFamily: resolvedStatusFontFamily } : null),
            },
          ]}
        >
          Loading products...
        </Text>
      )}

      {/* Error */}
      {!!error && (
        <Text
          style={[
            styles.error,
            {
              color:      resolvedErrorColor,
              fontSize:   resolvedErrorFontSize,
              fontWeight: resolvedErrorWeight,
              ...(resolvedErrorFontFamily ? { fontFamily: resolvedErrorFontFamily } : null),
            },
          ]}
        >
          {error}
        </Text>
      )}

      {/* Product grid */}
      {!loading && !error && (
        <View style={styles.grid}>
          {products.map((product, index) => {
            const prodId = String(product?.id || product?.variantId || product?.handle || product?.title || "").trim();
            const isInWishlist = prodId ? wishlistItems.some((p) => String(p.id || "").trim() === prodId) : false;

            // Suppress marginBottom on last-row cards so no phantom gap appears
            // below the grid (CSS gap never applies after the last row; RN marginBottom does).
            const totalRows  = Math.ceil(products.length / resolvedColumns);
            const currentRow = Math.floor(index / resolvedColumns) + 1;
            const isLastRow  = currentRow === totalRows;

            return (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.card,
                  {
                    width:           cardWidth,
                    marginRight:     (index + 1) % resolvedColumns === 0 ? 0 : gridGap,
                    marginBottom:    isLastRow ? 0 : resolvedRowGap,
                    borderRadius:    cardCorner,
                    backgroundColor: resolvedCardBgColor,
                    borderColor:     resolvedCardBorderColor,
                    borderWidth:     resolvedCardBorderWidth,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => navigation.navigate("ProductDetail", { product, detailSections })}
              >
                {/* Favorite badge */}
                {resolvedShowFavorite && (
                  <TouchableOpacity
                    style={[styles.favoriteBadge, { backgroundColor: resolvedFavBgColor }]}
                    activeOpacity={0.8}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      const adding = !isInWishlist;
                      dispatch(toggleWishlist({
                        product: {
                          id:             prodId,
                          title:          product?.title || "",
                          image:          product?.imageUrl || "",
                          price:          product?.priceAmount ?? product?.price ?? 0,
                          compareAtPrice: product?.compareAtPrice ?? product?.originalPrice ?? 0,
                          currency:       product?.priceCurrency || product?.currency || "",
                          handle:         product?.handle || "",
                          vendor:         product?.vendor || "",
                        },
                      }));
                      setSnackMessage(adding ? "Product added to wishlist successfully." : "Product removed from wishlist successfully.");
                      setSnackVisible(true);
                    }}
                  >
                    <Text
                      style={[
                        styles.favoriteIcon,
                        {
                          color:      isInWishlist ? "#EF4444" : resolvedFavIconColor,
                          fontSize:   resolvedFavIconSize,
                          fontWeight: resolvedFavIconWeight,
                          ...(resolvedFavIconFontFamily ? { fontFamily: resolvedFavIconFontFamily } : null),
                        },
                      ]}
                    >
                      {isInWishlist ? "♥" : "♡"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Product image */}
                {product.imageUrl ? (
                  <View style={[styles.imageWrapper, { padding: imagePad }]}>
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={[
                        styles.image,
                        {
                          height:          imageHeight,
                          borderRadius:    imageCorner,
                          backgroundColor: resolvedImageBgColor,
                        },
                      ]}
                      resizeMode={imageResizeMode}
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.imagePlaceholder,
                      {
                        height:          imageHeight,
                        borderRadius:    imageCorner,
                        backgroundColor: resolvedImageBgColor,
                        margin:          imagePad,
                      },
                    ]}
                  >
                    <Text style={styles.placeholderLetter}>
                      {(product.title || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* Add to Cart — rendered above card body when position = "above" */}
                {showAddToCart && atcAbove && (() => {
                  const btnIconName = resolveFA4IconName(atcAvailableIconId);
                  return (
                    <View
                      style={{
                        flexDirection:  "row",
                        justifyContent: atcWrapJustify,
                        marginTop:      atcMarginT,
                        marginBottom:   atcMarginB,
                        marginLeft:     atcMarginX,
                        marginRight:    atcMarginX,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.addToCartBtn,
                          {
                            backgroundColor: addToCartBgColor,
                            borderRadius:    addToCartBorderRadius,
                            paddingTop:      atcPadT,
                            paddingBottom:   atcPadB,
                            paddingLeft:     atcPadL,
                            paddingRight:    atcPadR,
                            ...(atcIsStretch ? { flex: 1 } : {}),
                          },
                        ]}
                        onPress={(e) => handleAddToCart(product, e)}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {!!btnIconName && atcIconPosition !== "right" && (
                            <FontAwesome name={btnIconName} size={atcIconSize} color={addToCartTextColor} />
                          )}
                          <Text
                            style={[
                              styles.addToCartText,
                              {
                                color:      addToCartTextColor,
                                fontSize:   addToCartFontSize,
                                fontWeight: addToCartFontWeight,
                                ...(addToCartFontFamily ? { fontFamily: addToCartFontFamily } : null),
                              },
                            ]}
                          >
                            {addToCartLabel}
                          </Text>
                          {!!btnIconName && atcIconPosition === "right" && (
                            <FontAwesome name={btnIconName} size={atcIconSize} color={addToCartTextColor} />
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })()}

                {/* Card body — title + price */}
                <View style={[styles.content, { paddingHorizontal: cardPadX, paddingVertical: cardPadY }]}>
                  {resolvedShowCardTitle && (
                    <Text
                      numberOfLines={resolvedTitleWrap ? 1 : 2}
                      style={[
                        styles.name,
                        {
                          textAlign:  resolvedAlignText,
                          fontSize:   resolvedProductTitleSize,
                          color:      resolvedProductTitleColor,
                          fontWeight: resolvedProductTitleWeight,
                          ...(resolvedProductTitleFontFamily ? { fontFamily: resolvedProductTitleFontFamily } : null),
                        },
                      ]}
                    >
                      {product.title}
                    </Text>
                  )}
                  {resolvedShowPrice && (
                    <Text
                      style={[
                        styles.price,
                        {
                          marginTop:  resolvedPriceMarginTop,
                          textAlign:  resolvedAlignText,
                          fontSize:   resolvedPriceSize,
                          color:      resolvedPriceColor,
                          fontWeight: resolvedPriceWeight,
                          ...(resolvedPriceFontFamily ? { fontFamily: resolvedPriceFontFamily } : null),
                        },
                      ]}
                    >
                      {product.priceCurrency} {product.priceAmount}
                    </Text>
                  )}
                </View>

                {/* Add to Cart — rendered below card body when position = "below" (default) */}
                {showAddToCart && !atcAbove && (() => {
                  const btnIconName = resolveFA4IconName(atcAvailableIconId);
                  return (
                    <View
                      style={{
                        flexDirection:  "row",
                        justifyContent: atcWrapJustify,
                        marginTop:      atcMarginT,
                        marginBottom:   atcMarginB,
                        marginLeft:     atcMarginX,
                        marginRight:    atcMarginX,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                          styles.addToCartBtn,
                          {
                            backgroundColor: addToCartBgColor,
                            borderRadius:    addToCartBorderRadius,
                            paddingTop:      atcPadT,
                            paddingBottom:   atcPadB,
                            paddingLeft:     atcPadL,
                            paddingRight:    atcPadR,
                            ...(atcIsStretch ? { flex: 1 } : {}),
                          },
                        ]}
                        onPress={(e) => handleAddToCart(product, e)}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {!!btnIconName && atcIconPosition !== "right" && (
                            <FontAwesome name={btnIconName} size={atcIconSize} color={addToCartTextColor} />
                          )}
                          <Text
                            style={[
                              styles.addToCartText,
                              {
                                color:      addToCartTextColor,
                                fontSize:   addToCartFontSize,
                                fontWeight: addToCartFontWeight,
                                ...(addToCartFontFamily ? { fontFamily: addToCartFontFamily } : null),
                              },
                            ]}
                          >
                            {addToCartLabel}
                          </Text>
                          {!!btnIconName && atcIconPosition === "right" && (
                            <FontAwesome name={btnIconName} size={atcIconSize} color={addToCartTextColor} />
                          )}
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Snackbar
        visible={snackVisible}
        message={snackMessage}
        onDismiss={() => setSnackVisible(false)}
        duration={2500}
        type="success"
      />
    </View>
  );
}

export function ProductGridExample() {
  return <ProductGrid limit={8} title="Featured Products" />;
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  headerRow: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  heading: {
    fontSize:   18,
    fontWeight: "700",
    color:      "#111827",
    flex:       1,
  },
  grid: {
    flexDirection: "row",
    flexWrap:      "wrap",
  },
  card: {
    borderWidth:     1,
    borderColor:     "#e5e7eb",
    borderRadius:    8,
    overflow:        "hidden",
    backgroundColor: "#fff",
  },
  favoriteBadge: {
    position:         "absolute",
    top:              8,
    right:            8,
    zIndex:           2,
    backgroundColor:  "rgba(255,255,255,0.9)",
    borderRadius:     14,
    paddingHorizontal: 7,
    paddingVertical:  3,
  },
  favoriteIcon: {
    color:      "#e11d48",
    fontSize:   14,
    fontWeight: "700",
  },
  imageWrapper: {
    width: "100%",
  },
  image: {
    width:           "100%",
    backgroundColor: "#f3f4f6",
  },
  imagePlaceholder: {
    width:           "100%",
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "#f3f4f6",
  },
  placeholderLetter: {
    fontSize:   28,
    fontWeight: "700",
    color:      "#9CA3AF",
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical:   8,
  },
  name: {
    fontSize:   14,
    fontWeight: "600",
    color:      "#111827",
  },
  price: {
    color:      "#111827",
    fontWeight: "600",
    fontSize:   14,
  },
  status: {
    paddingVertical: 12,
    textAlign:       "center",
    color:           "#6b7280",
  },
  error: {
    paddingVertical: 12,
    textAlign:       "center",
    color:           "#b91c1c",
  },
  viewAllInline: {
    paddingVertical: 4,
    paddingLeft:     12,
  },
  viewAllText: {
    color:      "#111827",
    fontWeight: "600",
    fontSize:   14,
  },
  addToCartBtn: {
    alignItems:     "center",
    justifyContent: "center",
  },
  addToCartText: {
    fontSize:   13,
    fontWeight: "600",
    color:      "#FFFFFF",
    textAlign:  "center",
  },
});

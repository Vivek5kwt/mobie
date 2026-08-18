import React, { useEffect, useState } from "react";
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import FontAwesome from "react-native-vector-icons/FontAwesome";

import { resolveFirstFont } from "../services/typographyService";

import {
  formatPrice as formatCurrencyPrice,
  hydrateCurrencyFromStorage,
  subscribeCurrency,
} from "../utils/currencyStore";

import {
  getVariantSelection,
  subscribeVariantSelection,
} from "../utils/variantSelectionStore";


/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === "object") {
    if (value.value !== undefined) {
      return unwrapValue(value.value, fallback);
    }

    if (value.const !== undefined) {
      return unwrapValue(value.const, fallback);
    }

    if (value.properties !== undefined) {
      return unwrapValue(value.properties, fallback);
    }
  }

  return value;
};


const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);

  if (resolved === undefined || resolved === null) {
    return fallback;
  }

  return String(resolved);
};


const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);

  if (
    resolved === undefined ||
    resolved === null ||
    resolved === ""
  ) {
    return fallback;
  }

  if (typeof resolved === "number") {
    return Number.isFinite(resolved)
      ? resolved
      : fallback;
  }

  const parsed = parseFloat(resolved);

  return Number.isNaN(parsed)
    ? fallback
    : parsed;
};


const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);

  if (
    resolved === undefined ||
    resolved === null
  ) {
    return fallback;
  }

  if (typeof resolved === "boolean") {
    return resolved;
  }

  if (typeof resolved === "string") {
    const normalized = resolved
      .trim()
      .toLowerCase();

    if (
      ["true", "1", "yes", "y", "on"]
        .includes(normalized)
    ) {
      return true;
    }

    if (
      ["false", "0", "no", "n", "off"]
        .includes(normalized)
    ) {
      return false;
    }
  }

  return Boolean(resolved);
};


const firstDefined = (...values) => {
  return values.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );
};


const normalizeTextAlign = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "left" ||
    normalized === "center" ||
    normalized === "right"
  ) {
    return normalized;
  }

  return "left";
};


/*
 * Supports:
 *
 * Top Right
 * top-right
 * top_right
 * TOP RIGHT
 * TopRight
 */
const normalizePosition = (
  value,
  fallback = "top-right"
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  let normalized = String(value)
    .trim()
    .toLowerCase();

  normalized = normalized
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");

  normalized = normalized
    .replace("topleft", "top-left")
    .replace("topright", "top-right")
    .replace("bottomleft", "bottom-left")
    .replace("bottomright", "bottom-right");

  const valid = [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];

  return valid.includes(normalized)
    ? normalized
    : fallback;
};


/*
 * React Native FontAwesome icon normalization.
 */
const normalizeIconName = (
  icon,
  fallback
) => {
  if (
    icon === undefined ||
    icon === null ||
    icon === "" ||
    icon === "none"
  ) {
    return fallback;
  }

  const normalized = String(icon)
    .trim()
    .toLowerCase()
    .replace(/^fa-/, "")
    .replace(/^fas-/, "")
    .replace(/^far-/, "");

  const iconMap = {
    "share-nodes": "share-alt",
    share: "share-alt",
    "share-alt": "share-alt",

    star: "star",

    heart: "heart",
    tag: "tag",
    gift: "gift",
    fire: "fire",
    bell: "bell",
    cart: "shopping-cart",
    truck: "truck",
    info: "info-circle",
  };

  return iconMap[normalized] || normalized || fallback;
};


/* -------------------------------------------------------------------------- */
/* Product Info                                                               */
/* -------------------------------------------------------------------------- */

export default function ProductInfo({
  section,
}) {

  /* ------------------------------------------------------------------------ */
  /* Currency                                                                 */
  /* ------------------------------------------------------------------------ */

  const [, setCurrencyVersion] =
    useState(0);

  useEffect(() => {
    let mounted = true;

    const bump = () => {
      if (mounted) {
        setCurrencyVersion(
          (version) =>
            version + 1
        );
      }
    };

    hydrateCurrencyFromStorage()
      .then(bump);

    const unsubscribe =
      subscribeCurrency(bump);

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);


  /* ------------------------------------------------------------------------ */
  /* Variant selection                                                        */
  /* ------------------------------------------------------------------------ */

  const [, setVariantVersion] =
    useState(0);

  useEffect(() => {
    return subscribeVariantSelection(
      () => {
        setVariantVersion(
          (version) =>
            version + 1
        );
      }
    );
  }, []);


  /* ------------------------------------------------------------------------ */
  /* Resolve DSL props                                                        */
  /* ------------------------------------------------------------------------ */

  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};


  const raw =
    unwrapValue(
      propsNode?.raw,
      {}
    ) || {};


  const layoutCss =
    unwrapValue(
      raw?.layout?.css,
      undefined
    ) ||
    unwrapValue(
      propsNode?.layout?.value?.css,
      undefined
    ) ||
    unwrapValue(
      propsNode?.layout?.css,
      undefined
    ) ||
    unwrapValue(
      section?.layout?.cssSnapshot,
      undefined
    ) ||
    unwrapValue(
      section?.presentation?.cssSnapshot,
      {}
    ) ||
    {};


  const titleCss =
    unwrapValue(
      propsNode?.title,
      {}
    ) || {};


  const vendorCss =
    unwrapValue(
      propsNode?.vendor,
      {}
    ) || {};


  const priceCss =
    unwrapValue(
      propsNode?.price,
      {}
    ) || {};


  const reviewsCss =
    unwrapValue(
      propsNode?.reviews ??
        propsNode?.rating ??
        propsNode?.review ??
        raw?.reviews ??
        raw?.rating,
      {}
    ) || {};


  const shareCss =
    unwrapValue(
      propsNode?.share ??
        raw?.share ??
        layoutCss?.share,
      {}
    ) || {};


  const visibility =
    unwrapValue(
      propsNode?.visibility,
      {}
    ) || {};


  const background =
    unwrapValue(
      propsNode?.backgroundAndPadding,
      {}
    ) || {};


  /* ------------------------------------------------------------------------ */
  /* Product data                                                             */
  /* ------------------------------------------------------------------------ */

  const titleText = toString(
    raw?.titleText ??
      raw?.title,
    toString(
      titleCss?.text,
      ""
    )
  );


  const vendorText = toString(
    raw?.vendorText ??
      raw?.shop,
    toString(
      vendorCss?.text,
      ""
    )
  );


  const productKey =
    toString(raw?.id) ||
    toString(raw?.productId) ||
    toString(raw?.handle) ||
    toString(raw?.productHandle);


  const selectedVariant =
    productKey
      ? getVariantSelection(productKey)
      : null;


  /* ------------------------------------------------------------------------ */
  /* Currency and price                                                       */
  /* ------------------------------------------------------------------------ */

  const currencyLabel =
    toString(
      selectedVariant?.price?.currencyCode ??
        raw?.priceCurrency ??
        raw?.currencyCode ??
        raw?.currency ??
        raw?.currencySymbol ??
        priceCss?.currencyCode ??
        priceCss?.currency ??
        priceCss?.currencySymbol,
      "$"
    );


  const salePrice =
    selectedVariant?.price != null
      ? selectedVariant.price
      : raw?.salePrice ??
        priceCss?.salePrice;


  const standardPrice =
    selectedVariant?.compareAtPrice != null
      ? selectedVariant.compareAtPrice
      : raw?.standardPrice ??
        priceCss?.standardPrice;


  /* ------------------------------------------------------------------------ */
  /* Review data                                                              */
  /* ------------------------------------------------------------------------ */

  const reviewRatingValue =
    toString(
      raw?.ratingText ??
        raw?.rating ??
        raw?.reviewRating ??
        reviewsCss?.rating ??
        reviewsCss?.value,
      ""
    );


  const reviewCountText =
    toString(
      raw?.ratingCountText ??
        raw?.ratingCount ??
        raw?.reviewsCount ??
        raw?.reviewCount ??
        reviewsCss?.count,
      ""
    );


  /* ------------------------------------------------------------------------ */
  /* Layout CSS                                                               */
  /* ------------------------------------------------------------------------ */

  const titleStyleCss =
    unwrapValue(
      layoutCss?.title,
      {}
    ) || {};


  const vendorStyleCss =
    unwrapValue(
      layoutCss?.vendor,
      {}
    ) || {};


  /* ------------------------------------------------------------------------ */
  /* Visibility                                                               */
  /* ------------------------------------------------------------------------ */

  const showTitle =
    toBoolean(
      visibility?.productTitle ??
        visibility?.title,
      true
    );


  const showVendor =
    toBoolean(
      visibility?.vendor,
      true
    );


  const showPrice =
    toBoolean(
      visibility?.price,
      true
    );


  const showSale =
    toBoolean(
      visibility?.priceSale ??
        visibility?.salePrice,
      true
    );


  const showStandard =
    toBoolean(
      visibility?.priceStandard ??
        visibility?.standardPrice,
      false
    );


  const showStrikethrough =
    toBoolean(
      visibility?.priceStrikethrough,
      false
    );


  const showReviews =
    toBoolean(
      firstDefined(
        visibility?.reviews,
        visibility?.rating,
        raw?.showReviews,
        raw?.showRating
      ),
      true
    );


  const showReviewsIcon =
    toBoolean(
      firstDefined(
        visibility?.reviewsIcon,
        visibility?.ratingIcon
      ),
      true
    );


  const showReviewsRating =
    toBoolean(
      firstDefined(
        visibility?.reviewsRating,
        visibility?.ratingText
      ),
      true
    );


  const showReviewsCount =
    toBoolean(
      firstDefined(
        visibility?.reviewsRatingCounter,
        visibility?.ratingCount
      ),
      false
    );


  const showShare =
    toBoolean(
      firstDefined(
        visibility?.share,
        raw?.showShare,
        raw?.shareVisible,
        raw?.showShareIcon
      ),
      true
    );


  const hasData =
    !!titleText ||
    !!vendorText ||
    salePrice !== undefined ||
    standardPrice !== undefined;


  if (!hasData) {
    return null;
  }


  /* ------------------------------------------------------------------------ */
  /* Background and padding                                                   */
  /* ------------------------------------------------------------------------ */

  const bgPaddingEnabled =
    toBoolean(
      firstDefined(
        visibility?.bgPadding,
        raw?.bgSettingsEnabled
      ),
      true
    );


  const basePaddingTop =
    bgPaddingEnabled
      ? toNumber(
          background?.paddingTop ??
            raw?.paddingTop ??
            raw?.pt,
          0
        )
      : 0;


  const basePaddingBottom =
    bgPaddingEnabled
      ? toNumber(
          background?.paddingBottom ??
            raw?.paddingBottom ??
            raw?.pb,
          0
        )
      : 0;


  let paddingLeft =
    bgPaddingEnabled
      ? toNumber(
          background?.paddingLeft ??
            raw?.paddingLeft ??
            raw?.pl,
          0
        )
      : 0;


  let paddingRight =
    bgPaddingEnabled
      ? toNumber(
          background?.paddingRight ??
            raw?.paddingRight ??
            raw?.pr,
          0
        )
      : 0;


  /* ------------------------------------------------------------------------ */
  /* Title styles                                                             */
  /* ------------------------------------------------------------------------ */

  const titleAlign =
    normalizeTextAlign(
      titleCss?.align ??
        raw?.titleAlignment ??
        raw?.titleAttributes?.align ??
        titleStyleCss?.textAlign ??
        "left"
    );


  const titleFontSize =
    toNumber(
      titleCss?.fontSize ??
        raw?.titleFontSize ??
        raw?.titleSize ??
        raw?.titleAttributes?.size ??
        titleStyleCss?.fontSize,
      18
    );


  const titleLineHeight =
    toNumber(
      titleCss?.lineHeight ??
        raw?.titleLineHeight ??
        raw?.titleAttributes?.lineHeight ??
        titleStyleCss?.lineHeight,
      undefined
    );


  const titleLetterSpacing =
    toNumber(
      titleCss?.letterSpacing ??
        raw?.titleLetterSpacing ??
        raw?.titleAttributes?.letterSpacing ??
        titleStyleCss?.letterSpacing,
      undefined
    );


  const titleFontFamily =
    resolveFirstFont(
      raw?.titleFontFamily,
      raw?.titleAttributes?.fontFamily,
      titleCss?.fontFamily,
      titleStyleCss?.fontFamily,
      raw?.headlineFontFamily,
      raw?.fontFamily
    );


  /* ------------------------------------------------------------------------ */
  /* Vendor styles                                                            */
  /* ------------------------------------------------------------------------ */

  const vendorAlign =
    normalizeTextAlign(
      vendorCss?.align ??
        raw?.vendorAlignment ??
        raw?.vendorAttributes?.align ??
        vendorStyleCss?.textAlign ??
        "left"
    );


  const vendorFontFamily =
    resolveFirstFont(
      raw?.vendorFontFamily,
      raw?.vendorAttributes?.fontFamily,
      vendorCss?.fontFamily,
      vendorStyleCss?.fontFamily,
      raw?.subtextFontFamily,
      raw?.fontFamily
    );


  /* ------------------------------------------------------------------------ */
  /* Price font                                                               */
  /* ------------------------------------------------------------------------ */

  const priceFontFamily =
    resolveFirstFont(
      raw?.priceFontFamily,
      raw?.priceAttributes?.fontFamily,
      priceCss?.standard?.fontFamily,
      priceCss?.sale?.fontFamily,
      priceCss?.strikethrough?.fontFamily,
      priceCss?.fontFamily,
      raw?.fontFamily
    );


  /* ------------------------------------------------------------------------ */
  /* Review styles                                                            */
  /* ------------------------------------------------------------------------ */

  const reviewsBgEnabled =
    toBoolean(
      firstDefined(
        visibility?.reviewsBgPadding,
        raw?.reviewsBgPadding
      ),
      true
    );


  const reviewsBg =
    toString(
      reviewsCss?.bg ??
        reviewsCss?.background ??
        raw?.reviewsBg,
      "#FFFFFF"
    );


  const reviewsBorderRadius =
    toNumber(
      reviewsCss?.corner ??
        reviewsCss?.cornerRadius ??
        raw?.reviewsCorner ??
        raw?.reviewsCornerRadius,
      8
    );


  const reviewsBorderLine =
    toString(
      reviewsCss?.borderLine ??
        raw?.reviewsBorderLine,
      ""
    );


  const reviewsBorderWidth =
    reviewsBorderLine &&
    reviewsBorderLine !== "none"
      ? 1
      : 0;


  const reviewsBorderColor =
    toString(
      reviewsCss?.borderColor ??
        raw?.reviewsBorderColor,
      "#DDD3D3"
    );


  const reviewsIconName =
    normalizeIconName(
      reviewsCss?.icon?.value ??
        reviewsCss?.icon ??
        raw?.reviewsIconValue,
      "star"
    );


  const reviewsIconColor =
    toString(
      reviewsCss?.icon?.color ??
        reviewsCss?.iconColor ??
        raw?.reviewsIconColor,
      "#111827"
    );


  const reviewsIconSize =
    toNumber(
      reviewsCss?.icon?.size ??
        reviewsCss?.iconSize ??
        raw?.reviewsIconSize,
      12
    );


  const reviewsFontSize =
    toNumber(
      reviewsCss?.fontSize ??
        reviewsCss?.rating?.fontSize ??
        raw?.ratingFontSize ??
        raw?.reviewsFontSize,
      12
    );


  const reviewsColor =
    toString(
      reviewsCss?.color ??
        reviewsCss?.rating?.color ??
        raw?.ratingColor ??
        raw?.reviewsColor,
      "#111827"
    );


  const reviewsFontWeight =
    toString(
      reviewsCss?.fontWeight ??
        reviewsCss?.rating?.fontWeight ??
        raw?.ratingFontWeight ??
        raw?.reviewsFontWeight,
      "600"
    );


  const reviewsFontFamily =
    resolveFirstFont(
      raw?.ratingFontFamily,
      raw?.reviewsFontFamily,
      reviewsCss?.rating?.fontFamily,
      reviewsCss?.fontFamily,
      raw?.fontFamily
    );


  const reviewsCountSize =
    toNumber(
      reviewsCss?.count?.fontSize ??
        raw?.reviewsCountFontSize,
      12
    );


  const reviewsCountColor =
    toString(
      reviewsCss?.count?.color ??
        raw?.reviewsCountColor,
      "#6B7280"
    );


  const reviewsCountFontFamily =
    resolveFirstFont(
      raw?.ratingCountFontFamily,
      raw?.reviewsCountFontFamily,
      reviewsCss?.count?.fontFamily,
      reviewsCss?.fontFamily,
      raw?.fontFamily
    );


  const reviewsPaddingTop =
    toNumber(
      reviewsCss?.paddingTop ??
        raw?.reviewsPaddingTop,
      6
    );


  const reviewsPaddingBottom =
    toNumber(
      reviewsCss?.paddingBottom ??
        raw?.reviewsPaddingBottom,
      6
    );


  const reviewsPaddingLeft =
    toNumber(
      reviewsCss?.paddingLeft ??
        raw?.reviewsPaddingLeft,
      6
    );


  const reviewsPaddingRight =
    toNumber(
      reviewsCss?.paddingRight ??
        raw?.reviewsPaddingRight,
      6
    );


  /* ------------------------------------------------------------------------ */
  /* Share styles                                                             */
  /* ------------------------------------------------------------------------ */

  const shareBgEnabled =
    toBoolean(
      firstDefined(
        visibility?.bgSharePadding,
        raw?.bgSharePadding
      ),
      true
    );


  const shareBg =
    shareBgEnabled
      ? toString(
          shareCss?.bg ??
            shareCss?.background ??
            raw?.bgShareColor,
          "#FFFFFF"
        )
      : "transparent";


  const shareCorner =
    toNumber(
      shareCss?.corner ??
        shareCss?.cornerRadius ??
        raw?.cornerShareRadius ??
        raw?.shareCornerRadius,
      8
    );


  const shareIconName =
    normalizeIconName(
      shareCss?.icon?.value ??
        shareCss?.icon ??
        raw?.shareIconId,
      "share-alt"
    );


  const shareIconColor =
    toString(
      shareCss?.icon?.color ??
        shareCss?.iconColor ??
        raw?.shareColor,
      "#000000"
    );


  const shareIconSize =
    toNumber(
      shareCss?.icon?.size ??
        shareCss?.iconSize ??
        raw?.shareIconSize,
      16
    );


  /*
   * Builder Preview does not force a fixed square.
   * It uses actual icon size + padding.
   */
  const sharePaddingTop =
    toNumber(
      shareCss?.paddingTop ??
        raw?.paddingShareTop,
      0
    );


  const sharePaddingBottom =
    toNumber(
      shareCss?.paddingBottom ??
        raw?.paddingShareBottom,
      0
    );


  const sharePaddingLeft =
    toNumber(
      shareCss?.paddingLeft ??
        raw?.paddingShareLeft,
      0
    );


  const sharePaddingRight =
    toNumber(
      shareCss?.paddingRight ??
        raw?.paddingShareRight,
      0
    );


  const shareBorderLine =
    toString(
      shareCss?.borderLine ??
        raw?.borderShareLine,
      ""
    );


  const shareBorderWidth =
    shareBgEnabled &&
    shareBorderLine &&
    shareBorderLine !== "none"
      ? 1
      : 0;


  const shareBorderColor =
    toString(
      shareCss?.borderColor ??
        raw?.borderShareColor,
      "#D1D5DB"
    );


  /* ------------------------------------------------------------------------ */
  /* Positions                                                                */
  /* ------------------------------------------------------------------------ */

  const sharePosition =
    normalizePosition(
      shareCss?.position ??
        raw?.sharePosition,
      "top-right"
    );


  const reviewsPosition =
    normalizePosition(
      reviewsCss?.position ??
        raw?.reviewsPosition,
      "top-right"
    );


  /* ------------------------------------------------------------------------ */
  /* Reserve space for floating badges                                        */
  /* ------------------------------------------------------------------------ */

  const EDGE_GAP = 10;
  const BADGE_MARGIN = 10;


  /*
   * Approximate actual review width.
   * This is intentionally based on the real font/icon/padding settings,
   * similar to PreviewLive.
   */
  const estimatedRatingWidth =
    showReviewsRating
      ? reviewsFontSize * 2.5
      : 0;


  const estimatedCountWidth =
    showReviewsCount
      ? reviewsCountSize * 3
      : 0;


  const reviewsBadgeWidth =
    showReviews
      ? (
          (showReviewsIcon
            ? reviewsIconSize
            : 0) +
          estimatedRatingWidth +
          estimatedCountWidth +
          (
            showReviewsIcon &&
            (
              showReviewsRating ||
              showReviewsCount
            )
              ? 4
              : 0
          ) +
          (
            reviewsBgEnabled
              ? reviewsPaddingLeft +
                reviewsPaddingRight
              : 0
          )
        )
      : 0;


  const shareBadgeWidth =
    showShare
      ? (
          shareIconSize +
          (
            shareBgEnabled
              ? sharePaddingLeft +
                sharePaddingRight
              : 0
          )
        )
      : 0;


  const leftBadgeWidth =
    Math.max(
      showReviews &&
      reviewsPosition.includes("left")
        ? reviewsBadgeWidth
        : 0,

      showShare &&
      sharePosition.includes("left")
        ? shareBadgeWidth
        : 0
    );


  const rightBadgeWidth =
    Math.max(
      showReviews &&
      reviewsPosition.includes("right")
        ? reviewsBadgeWidth
        : 0,

      showShare &&
      sharePosition.includes("right")
        ? shareBadgeWidth
        : 0
    );


  if (leftBadgeWidth > 0) {
    paddingLeft +=
      leftBadgeWidth +
      EDGE_GAP +
      BADGE_MARGIN;
  }


  if (rightBadgeWidth > 0) {
    paddingRight +=
      rightBadgeWidth +
      EDGE_GAP +
      BADGE_MARGIN;
  }


  const paddingStyle = {
    paddingTop: basePaddingTop,
    paddingBottom: basePaddingBottom,
    paddingLeft,
    paddingRight,

    backgroundColor:
      bgPaddingEnabled
        ? toString(
            background?.bgColor ??
              raw?.bgColor,
            "#FFFFFF"
          )
        : "#FFFFFF",

    borderRadius:
      bgPaddingEnabled
        ? toNumber(
            background?.cornerRadius ??
              raw?.borderRadius,
            0
          )
        : 0,

    borderWidth:
      bgPaddingEnabled &&
      background?.borderLine
        ? 1
        : 0,

    borderColor:
      toString(
        background?.borderColor,
        "#E5E7EB"
      ),
  };


  /* ------------------------------------------------------------------------ */
  /* Share action                                                             */
  /* ------------------------------------------------------------------------ */

  const handleShare = async () => {
    try {
      await Share.share({
        message: titleText
          ? `Check out ${titleText}`
          : "Check out this product!",
      });
    } catch (_) {
      // Ignore cancelled share
    }
  };


  /* ------------------------------------------------------------------------ */
  /* Review badge                                                             */
  /* ------------------------------------------------------------------------ */

  const renderReviews = () => {
    if (!showReviews) {
      return null;
    }

    return (
      <View
        style={[
          styles.reviewsBadge,
          {
            backgroundColor:
              reviewsBgEnabled
                ? reviewsBg
                : "transparent",

            borderRadius:
              reviewsBgEnabled
                ? reviewsBorderRadius
                : 0,

            borderWidth:
              reviewsBgEnabled
                ? reviewsBorderWidth
                : 0,

            borderColor:
              reviewsBorderColor,

            paddingTop:
              reviewsBgEnabled
                ? reviewsPaddingTop
                : 0,

            paddingBottom:
              reviewsBgEnabled
                ? reviewsPaddingBottom
                : 0,

            paddingLeft:
              reviewsBgEnabled
                ? reviewsPaddingLeft
                : 0,

            paddingRight:
              reviewsBgEnabled
                ? reviewsPaddingRight
                : 0,
          },
        ]}
      >
        {showReviewsIcon && (
          <FontAwesome
            name={reviewsIconName}
            size={reviewsIconSize}
            color={reviewsIconColor}
            style={{
              marginRight:
                showReviewsRating ||
                showReviewsCount
                  ? 4
                  : 0,
            }}
          />
        )}

        {showReviewsRating && (
          <Text
            numberOfLines={1}
            style={{
              fontSize:
                reviewsFontSize,

              color:
                reviewsColor,

              fontWeight:
                reviewsFontWeight,

              ...(reviewsFontFamily
                ? {
                    fontFamily:
                      reviewsFontFamily,
                  }
                : {}),
            }}
          >
            {reviewRatingValue ||
              "4.5"}
          </Text>
        )}

        {showReviewsCount && (
          <Text
            numberOfLines={1}
            style={{
              marginLeft:
                showReviewsRating
                  ? 4
                  : 0,

              fontSize:
                reviewsCountSize,

              color:
                reviewsCountColor,

              ...(reviewsCountFontFamily
                ? {
                    fontFamily:
                      reviewsCountFontFamily,
                  }
                : {}),
            }}
          >
            {reviewCountText ||
              "(0)"}
          </Text>
        )}
      </View>
    );
  };


  /* ------------------------------------------------------------------------ */
  /* Share badge                                                              */
  /* ------------------------------------------------------------------------ */

  const renderShare = () => {
    if (!showShare) {
      return null;
    }

    return (
      <TouchableOpacity
        onPress={handleShare}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Share product"
        style={[
          styles.shareBadge,
          {
            backgroundColor:
              shareBg,

            borderRadius:
              shareBgEnabled
                ? shareCorner
                : 0,

            borderWidth:
              shareBorderWidth,

            borderColor:
              shareBorderColor,

            paddingTop:
              shareBgEnabled
                ? sharePaddingTop
                : 0,

            paddingBottom:
              shareBgEnabled
                ? sharePaddingBottom
                : 0,

            paddingLeft:
              shareBgEnabled
                ? sharePaddingLeft
                : 0,

            paddingRight:
              shareBgEnabled
                ? sharePaddingRight
                : 0,
          },
        ]}
      >
        <FontAwesome
          name={shareIconName}
          size={shareIconSize}
          color={shareIconColor}
        />
      </TouchableOpacity>
    );
  };


  /* ------------------------------------------------------------------------ */
  /* Floating badge groups                                                    */
  /* ------------------------------------------------------------------------ */

  const renderFloatingBadges = () => {
    const groups = {
      "top-left": [],
      "top-right": [],
      "bottom-left": [],
      "bottom-right": [],
    };


    if (showReviews) {
      groups[reviewsPosition].push(
        <View
          key="reviews"
          style={styles.badgeItem}
        >
          {renderReviews()}
        </View>
      );
    }


    if (showShare) {
      groups[sharePosition].push(
        <View
          key="share"
          style={styles.badgeItem}
        >
          {renderShare()}
        </View>
      );
    }


    return (
      <>
        {groups["top-left"].length > 0 && (
          <View
            pointerEvents="box-none"
            style={styles.topLeftGroup}
          >
            {groups["top-left"]}
          </View>
        )}


        {groups["top-right"].length > 0 && (
          <View
            pointerEvents="box-none"
            style={styles.topRightGroup}
          >
            {groups["top-right"]}
          </View>
        )}


        {groups["bottom-left"].length > 0 && (
          <View
            pointerEvents="box-none"
            style={styles.bottomLeftGroup}
          >
            {groups["bottom-left"]}
          </View>
        )}


        {groups["bottom-right"].length > 0 && (
          <View
            pointerEvents="box-none"
            style={styles.bottomRightGroup}
          >
            {groups["bottom-right"]}
          </View>
        )}
      </>
    );
  };


  /* ------------------------------------------------------------------------ */
  /* Render                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <View
      style={[
        styles.container,
        paddingStyle,
      ]}
    >

      {/* Floating Review + Share badges */}

      {renderFloatingBadges()}


      {/* Product title */}

      {showTitle &&
        !!titleText && (
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              {
                fontSize:
                  titleFontSize,

                color:
                  toString(
                    titleCss?.color ??
                      raw?.titleColor ??
                      raw?.titleAttributes?.color ??
                      titleStyleCss?.color,
                    "#111827"
                  ),

                fontWeight:
                  toString(
                    titleCss?.fontWeight ??
                      raw?.titleFontWeight ??
                      raw?.titleAttributes?.weight ??
                      titleStyleCss?.fontWeight,
                    "700"
                  ),

                textAlign:
                  titleAlign,

                ...(titleLineHeight !==
                undefined
                  ? {
                      lineHeight:
                        titleLineHeight,
                    }
                  : {}),

                ...(titleLetterSpacing !==
                undefined
                  ? {
                      letterSpacing:
                        titleLetterSpacing,
                    }
                  : {}),

                ...(titleFontFamily
                  ? {
                      fontFamily:
                        titleFontFamily,
                    }
                  : {}),
              },
            ]}
          >
            {titleText}
          </Text>
        )}


      {/* Vendor */}

      {showVendor &&
        !!vendorText && (
          <Text
            style={[
              styles.vendor,
              {
                fontSize:
                  toNumber(
                    vendorCss?.fontSize ??
                      raw?.vendorFontSize ??
                      raw?.vendorSize ??
                      raw?.vendorAttributes?.size ??
                      vendorStyleCss?.fontSize,
                    13
                  ),

                color:
                  toString(
                    vendorCss?.color ??
                      raw?.vendorColor ??
                      raw?.vendorAttributes?.color ??
                      vendorStyleCss?.color,
                    "#6B7280"
                  ),

                fontWeight:
                  toString(
                    vendorCss?.fontWeight ??
                      raw?.vendorFontWeight ??
                      raw?.vendorAttributes?.weight ??
                      vendorStyleCss?.fontWeight,
                    "400"
                  ),

                textAlign:
                  vendorAlign,

                ...(vendorFontFamily
                  ? {
                      fontFamily:
                        vendorFontFamily,
                    }
                  : {}),
              },
            ]}
          >
            {vendorText}
          </Text>
        )}


      {/* Price */}

      {showPrice &&
        (
          salePrice !== undefined ||
          standardPrice !== undefined
        ) && (
          <View
            style={styles.priceRow}
          >

            {showSale &&
              salePrice !== undefined && (
                <Text
                  style={[
                    styles.priceSale,
                    {
                      fontSize:
                        toNumber(
                          priceCss?.sale?.fontSize ??
                            raw?.priceFontSize,
                          18
                        ),

                      color:
                        toString(
                          priceCss?.sale?.color ??
                            raw?.saleColor ??
                            raw?.priceColor,
                          "#111827"
                        ),

                      fontWeight:
                        toString(
                          priceCss?.sale?.fontWeight ??
                            raw?.priceFontWeight,
                          "700"
                        ),

                      ...(priceFontFamily
                        ? {
                            fontFamily:
                              priceFontFamily,
                          }
                        : {}),
                    },
                  ]}
                >
                  {formatCurrencyPrice(
                    salePrice,
                    currencyLabel
                  )}
                </Text>
              )}


            {showStrikethrough &&
              standardPrice !== undefined &&
              showSale && (
                <Text
                  style={[
                    styles.priceStrike,
                    {
                      fontSize:
                        toNumber(
                          priceCss?.strikethrough
                            ?.fontSize,
                          13
                        ),

                      color:
                        toString(
                          priceCss?.strikethrough
                            ?.color,
                          "#9CA3AF"
                        ),

                      fontWeight:
                        toString(
                          priceCss?.strikethrough
                            ?.fontWeight,
                          "400"
                        ),

                      ...(priceFontFamily
                        ? {
                            fontFamily:
                              priceFontFamily,
                          }
                        : {}),
                    },
                  ]}
                >
                  {formatCurrencyPrice(
                    standardPrice,
                    currencyLabel
                  )}
                </Text>
              )}


            {!showSale &&
              showStandard &&
              standardPrice !== undefined && (
                <Text
                  style={[
                    styles.priceStandard,
                    {
                      fontSize:
                        toNumber(
                          priceCss?.standard
                            ?.fontSize ??
                            raw?.priceFontSize,
                          16
                        ),

                      color:
                        toString(
                          priceCss?.standard
                            ?.color ??
                            raw?.standardPriceColor ??
                            raw?.priceColor,
                          "#111827"
                        ),

                      fontWeight:
                        toString(
                          priceCss?.standard
                            ?.fontWeight ??
                            raw?.priceFontWeight,
                          "600"
                        ),

                      ...(priceFontFamily
                        ? {
                            fontFamily:
                              priceFontFamily,
                          }
                        : {}),
                    },
                  ]}
                >
                  {formatCurrencyPrice(
                    standardPrice,
                    currencyLabel
                  )}
                </Text>
              )}

          </View>
        )}

    </View>
  );
}


/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({

  container: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },


  title: {
    marginBottom: 2,
    flexShrink: 1,
  },


  vendor: {
    marginTop: 2,
    marginBottom: 10,
    flexShrink: 1,
  },


  /* ------------------------------------------------------------------------ */
  /* Floating groups                                                          */
  /* ------------------------------------------------------------------------ */

  topLeftGroup: {
    position: "absolute",
    top: 10,
    left: 10,
    zIndex: 10,
    alignItems: "flex-start",
  },


  topRightGroup: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    alignItems: "flex-end",
  },


  bottomLeftGroup: {
    position: "absolute",
    bottom: 10,
    left: 10,
    zIndex: 10,
    alignItems: "flex-start",
    flexDirection: "column-reverse",
  },


  bottomRightGroup: {
    position: "absolute",
    bottom: 10,
    right: 10,
    zIndex: 10,
    alignItems: "flex-end",
    flexDirection: "column-reverse",
  },


  badgeItem: {
    marginBottom: 6,
  },


  /* ------------------------------------------------------------------------ */
  /* Reviews                                                                  */
  /* ------------------------------------------------------------------------ */

  reviewsBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    flexShrink: 0,

    shadowColor: "#000",

    shadowOffset: {
      width: 0,
      height: 1,
    },

    shadowOpacity: 0.08,
    shadowRadius: 3,

    elevation: 2,
  },


  /* ------------------------------------------------------------------------ */
  /* Share                                                                    */
  /* ------------------------------------------------------------------------ */

  shareBadge: {
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    flexShrink: 0,
  },


  /* ------------------------------------------------------------------------ */
  /* Price                                                                    */
  /* ------------------------------------------------------------------------ */

  priceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",

    marginTop: 6,

    columnGap: 8,
    rowGap: 4,

    maxWidth: "100%",
  },


  priceSale: {
    flexShrink: 1,
  },


  priceStandard: {
    flexShrink: 1,
  },


  priceStrike: {
    textDecorationLine: "line-through",
    flexShrink: 1,
  },

});
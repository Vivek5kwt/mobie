import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useDispatch } from "react-redux";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import {
  fetchShopifyProductsPage,
  fetchShopifyCollectionProducts,
} from "../services/shopify";
import { addItem } from "../store/slices/cartSlice";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
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

const parseIconName = (iconId) => {
  if (!iconId || typeof iconId !== "string") return null;
  // Remove "fa-" prefix if present
  const name = iconId.replace(/^fa-/, "").trim();
  return name || null;
};

const parseAspectRatio = (ratio) => {
  if (!ratio || typeof ratio !== "string") return null;
  const match = ratio.match(/(\d+):(\d+)/);
  if (match) {
    const [, w, h] = match;
    return parseFloat(w) / parseFloat(h);
  }
  return null;
};

const getImageResizeMode = (scale) => {
  const normalized = String(scale || "").toLowerCase();
  if (normalized === "cover") return "cover";
  if (normalized === "contain") return "contain";
  if (normalized === "stretch") return "stretch";
  return "cover"; // Default
};

export default function ProductCarousel({ section }) {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState(new Set());

  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const raw = rawProps?.raw || {};

  // Data source configuration
  const dataSource = section?.dataSource || rawProps?.dataSource || {};
  const dataSourceType = unwrapValue(dataSource?.type, "storefront");
  const dataSourceMode = unwrapValue(dataSource?.mode, "all_products");
  const collectionHandle = toString(dataSource?.collectionHandle, "");

  // Grid configuration
  const grid = raw?.grid || {};
  const columns = Math.max(1, toNumber(grid?.columns, 2));
  const itemsShown = toNumber(grid?.itemsShown, 3);

  // Background padding
  const bgPadT = toNumber(raw?.bgPadT, 8);
  const bgPadR = toNumber(raw?.bgPadR, 8);
  const bgPadB = toNumber(raw?.bgPadB, 8);
  const bgPadL = toNumber(raw?.bgPadL, 8);
  const bgColor = toString(raw?.bgColor, "#FFFFFF");
  const backgroundActive = toBoolean(raw?.backgroundActive, true);

  // Gaps
  const colGap = toNumber(raw?.colGap, 10);
  const rowGap = toNumber(raw?.rowGap, 12);

  // Header configuration
  const headerGroupActive = toBoolean(raw?.headerGroupActive, true);
  const header = unwrapValue(raw?.header, "");
  const headerSize = toNumber(raw?.headerSize, 14);
  const headerColor = toString(raw?.headerColor, "#000000");
  const headerFamily = toString(raw?.headerFamily, "Inter");
  const headerWeight = toFontWeight(raw?.headerWeight, "700");
  const headerBold = toBoolean(raw?.headerBold, false);
  const headerItalic = toBoolean(raw?.headerItalic, false);
  const headerUnderline = toBoolean(raw?.headerUnderline, false);
  const headerLinkHref = toString(raw?.headerLinkHref, "");
  const gridTitleActive = toBoolean(raw?.gridTitleActive, true);

  // View All configuration
  const viewAllActive = toBoolean(raw?.viewAllActive, true);
  const viewAllText = unwrapValue(raw?.viewAllText, "View all");
  const viewAllSize = toNumber(raw?.viewAllSize, 14);
  const viewAllColor = toString(raw?.viewAllColor, "#000000");
  const viewAllFamily = toString(raw?.viewAllFamily, "Inter");
  const viewAllWeight = toFontWeight(raw?.viewAllWeight, "700");
  const viewAllBold = toBoolean(raw?.viewAllBold, false);
  const viewAllItalic = toBoolean(raw?.viewAllItalic, false);
  const viewAllUnderline = toBoolean(raw?.viewAllUnderline, false);
  const viewAllLinkHref = toString(raw?.viewAllLinkHref, "");
  const viewAllIconId = toString(raw?.viewAllIconId, "fa-chevron-right");
  const viewAllIconSize = toNumber(raw?.viewAllIconSize, 14);
  const viewAllIconColor = toString(raw?.viewAllIconColor, "#000000");

  // Image configuration
  const cardImageActive = toBoolean(raw?.cardImageActive, true);
  const imageRatio = toString(raw?.imageRatio, "1:1");
  const imageScale = toString(raw?.imageScale, "Fill");
  const imageCorner = toNumber(raw?.imageCorner, 6);
  const imageAspectRatio = parseAspectRatio(imageRatio);
  const imageResizeMode = getImageResizeMode(imageScale);

  // Title configuration
  const cardTitleActive = toBoolean(raw?.cardTitleActive, true);
  const titleSize = toNumber(raw?.titleSize, 14);
  const titleColor = toString(raw?.titleColor, "#000000");
  const titleFamily = toString(raw?.titleFamily, "Inter");
  const titleWeight = toFontWeight(raw?.titleWeight, "700");
  const titleAlign = toTextAlign(raw?.titleAlign, "Left");
  const titleWrap = toBoolean(raw?.titleWrap, true);

  // Price configuration
  const cardPriceActive = toBoolean(raw?.cardPriceActive, true);
  const priceSize = toNumber(raw?.priceSize, 14);
  const priceColor = toString(raw?.priceColor, "#000000");
  const priceFamily = toString(raw?.priceFamily, "Inter");
  const priceWeight = toFontWeight(raw?.priceWeight, "700");
  const priceAlign = toTextAlign(raw?.priceAlign, "Left");
  const priceStrike = toBoolean(raw?.priceStrike, false);
  const strikeSize = toNumber(raw?.strikeSize, 14);
  const strikeColor = toString(raw?.strikeColor, "#6B7280");
  const strikeFamily = toString(raw?.strikeFamily, "Inter");
  const strikeWeight = toFontWeight(raw?.strikeWeight, "700");

  // Favorite configuration
  const favActive = toBoolean(raw?.favActive, false);
  const favEnabled = toBoolean(raw?.favEnabled, false);
  const favoriteIconEnabled = toBoolean(raw?.favoriteIconEnabled, true);
  const favoriteIconId = toString(raw?.favoriteIconId, "fa-heart");
  const favoriteIconSize = toNumber(raw?.favIconSize, 16);
  const favoriteIconColor = toString(raw?.favIconColor, "#111827");
  const unfavoriteIconId = toString(raw?.unfavoriteIconId, "fa-heart");
  const unfavoriteIconSize = toNumber(raw?.unfavoriteIconSize, 16);
  const unfavoriteIconColor = toString(raw?.unfavoriteIconColor, "#111827");
  const unfavoriteIconEnabled = toBoolean(raw?.unfavoriteIconEnabled, false);
  const favPosition = toString(raw?.favPosition, "top-right");
  const favBubbleBgColor = toString(raw?.favBubbleBgColor, "#FFFFFF");
  const favBubblePadT = toNumber(raw?.favBubblePadT, 0);
  const favBubblePadR = toNumber(raw?.favBubblePadR, 0);
  const favBubblePadB = toNumber(raw?.favBubblePadB, 0);
  const favBubblePadL = toNumber(raw?.favBubblePadL, 0);

  // Add to Cart configuration
  const atcActive = toBoolean(raw?.atcActive, true);
  const atcAvailableText = unwrapValue(raw?.atcAvailableText, "Add To Cart");
  const atcSoldOutText = unwrapValue(raw?.atcSoldOutText, "Sold Out");
  const atcPosition = toString(raw?.atcPosition, "below");
  const atcAlign = toTextAlign(raw?.atcAlign, "Left");
  const atcSize = toNumber(raw?.atcSize, 12);
  const atcBgColor = toString(raw?.atcBgColor, "#096d70");
  const atcTextColor = toString(raw?.atcTextColor, "#FFFFFF");
  const atcFamily = toString(raw?.atcFamily, "Inter");
  const atcWeight = toFontWeight(raw?.atcWeight, "Semi Bold");
  const atcCorner = toNumber(raw?.atcCorner, 6);
  const atcPadT = toNumber(raw?.atcPadT, 6);
  const atcPadR = toNumber(raw?.atcPadR, 10);
  const atcPadB = toNumber(raw?.atcPadB, 6);
  const atcPadL = toNumber(raw?.atcPadL, 10);
  const atcPadX = toNumber(raw?.atcPadX, 10);
  const atcPadY = toNumber(raw?.atcPadY, 6);
  const atcAvailableBold = toBoolean(raw?.atcAvailableBold, false);
  const atcAvailableItalic = toBoolean(raw?.atcAvailableItalic, false);
  const atcAvailableUnderline = toBoolean(raw?.atcAvailableUnderline, false);
  const atcSoldOutBgColor = toString(raw?.atcSoldOutBgColor, "#E5E7EB");
  const atcSoldOutTextColor = toString(raw?.atcSoldOutTextColor, "#111827");
  const atcSoldOutBold = toBoolean(raw?.atcSoldOutBold, false);
  const atcSoldOutItalic = toBoolean(raw?.atcSoldOutItalic, false);
  const atcSoldOutUnderline = toBoolean(raw?.atcSoldOutUnderline, false);
  const atcBorderLine = toString(raw?.atcBorderLine, "");
  const atcBorderColor = toString(raw?.atcBorderColor, "#E5E7EB");

  // Card configuration
  const productCardGroupActive = toBoolean(raw?.productCardGroupActive, true);
  const borderSize = toNumber(raw?.borderSize, 1);
  const borderColor = toString(raw?.borderColor, "#E5E7EB");
  const borderLine = toString(raw?.borderLine, "");
  const outerCorners = toNumber(raw?.outerCorners, 0);
  const layoutAlign = toTextAlign(raw?.layoutAlign, "Left");

  // Calculate card width
  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = bgPadL + bgPadR;
  const totalGap = colGap * (columns - 1);
  const cardWidth = Math.max(
    120,
    (screenWidth - horizontalPadding - totalGap) / columns
  );

  // Fetch products
  useEffect(() => {
    let isMounted = true;

    const loadProducts = async () => {
      setLoading(true);
      setError("");

      try {
        let result;
        if (dataSourceMode === "collection" && collectionHandle) {
          result = await fetchShopifyCollectionProducts({
            handle: collectionHandle,
            first: itemsShown,
          });
        } else {
          result = await fetchShopifyProductsPage({
            first: itemsShown,
          });
        }

        const nextProducts = result?.products || [];

        if (isMounted) {
          setProducts(nextProducts);
        }
      } catch (err) {
        if (isMounted) {
          setError("Unable to load products right now. Please try again later.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [dataSourceMode, collectionHandle, itemsShown]);

  const toggleFavorite = (productId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleAddToCart = (product) => {
    // Extract variant ID from product ID if needed
    const variantId = product.variantId || product.id || "";
    
    dispatch(
      addItem({
        item: {
          id: product.id || `product-${Date.now()}`,
          variantId: variantId,
          title: product.title || "Product Name",
          image: product.imageUrl || "",
          price: parseFloat(product.priceAmount || 0),
          variant: "",
          currency: product.priceCurrency || "USD",
          quantity: 1,
        },
      })
    );
  };

  const handleProductPress = (product) => {
    navigation.navigate("ProductDetail", {
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        imageUrl: product.imageUrl,
        priceAmount: product.priceAmount,
        priceCurrency: product.priceCurrency,
      },
    });
  };

  const renderHeader = () => {
    if (!headerGroupActive || !gridTitleActive) return null;

    const headerText = Array.isArray(header)
      ? header.map((h) => unwrapValue(h)).join(" ")
      : toString(header, "");

    if (!headerText) return null;

    const headerStyle = {
      fontSize: headerSize,
      color: headerColor,
      fontWeight: headerBold ? "700" : headerWeight,
      fontStyle: headerItalic ? "italic" : "normal",
      textDecorationLine: headerUnderline ? "underline" : "none",
      ...(headerFamily && headerFamily !== "Inter" ? { fontFamily: headerFamily } : {}),
    };

    const headerContent = (
      <Text style={[styles.headerText, headerStyle]}>{headerText}</Text>
    );

    if (headerLinkHref) {
      return (
        <TouchableOpacity
          onPress={() => {
            // Handle header link navigation
            if (headerLinkHref.startsWith("/")) {
              navigation.navigate(headerLinkHref);
            }
          }}
        >
          {headerContent}
        </TouchableOpacity>
      );
    }

    return headerContent;
  };

  const renderViewAll = () => {
    if (!viewAllActive) return null;

    const viewAllTextStr = Array.isArray(viewAllText)
      ? viewAllText.map((t) => unwrapValue(t)).join(" ")
      : toString(viewAllText, "");

    if (!viewAllTextStr) return null;

    const viewAllStyle = {
      fontSize: viewAllSize,
      color: viewAllColor,
      fontWeight: viewAllBold ? "700" : viewAllWeight,
      fontStyle: viewAllItalic ? "italic" : "normal",
      textDecorationLine: viewAllUnderline ? "underline" : "none",
      ...(viewAllFamily && viewAllFamily !== "Inter" ? { fontFamily: viewAllFamily } : {}),
    };

    const viewAllIconName = parseIconName(viewAllIconId);

    const viewAllContent = (
      <View style={styles.viewAllContainer}>
        <Text style={[styles.viewAllText, viewAllStyle]}>{viewAllTextStr}</Text>
        {viewAllIconName && (
          <FontAwesome
            name={viewAllIconName}
            size={viewAllIconSize}
            color={viewAllIconColor}
            style={styles.viewAllIcon}
          />
        )}
      </View>
    );

    if (viewAllLinkHref) {
      return (
        <TouchableOpacity
          onPress={() => {
            if (viewAllLinkHref.startsWith("/")) {
              navigation.navigate(viewAllLinkHref);
            }
          }}
        >
          {viewAllContent}
        </TouchableOpacity>
      );
    }

    return viewAllContent;
  };

  const renderFavorite = (product, isFavorite) => {
    if (!favActive && !favEnabled) return null;

    const showFavorite = isFavorite && favoriteIconEnabled;
    const showUnfavorite = !isFavorite && unfavoriteIconEnabled;

    if (!showFavorite && !showUnfavorite) return null;

    const iconId = isFavorite ? favoriteIconId : unfavoriteIconId;
    const iconSize = isFavorite ? favoriteIconSize : unfavoriteIconSize;
    const iconColor = isFavorite ? favoriteIconColor : unfavoriteIconColor;
    const iconName = parseIconName(iconId);

    if (!iconName) return null;

    const positionStyle = {};
    if (favPosition.includes("top")) {
      positionStyle.top = favBubblePadT;
    }
    if (favPosition.includes("bottom")) {
      positionStyle.bottom = favBubblePadB;
    }
    if (favPosition.includes("left")) {
      positionStyle.left = favBubblePadL;
    }
    if (favPosition.includes("right")) {
      positionStyle.right = favBubblePadR;
    }

    return (
      <TouchableOpacity
        style={[
          styles.favoriteButton,
          positionStyle,
          {
            backgroundColor: favBubbleBgColor,
            paddingTop: favBubblePadT,
            paddingRight: favBubblePadR,
            paddingBottom: favBubblePadB,
            paddingLeft: favBubblePadL,
          },
        ]}
        onPress={() => toggleFavorite(product.id)}
        activeOpacity={0.7}
      >
        <FontAwesome name={iconName} size={iconSize} color={iconColor} />
      </TouchableOpacity>
    );
  };

  const renderAddToCart = (product, isSoldOut = false) => {
    if (!atcActive) return null;

    const isAvailable = !isSoldOut;
    const buttonText = isAvailable ? atcAvailableText : atcSoldOutText;
    const buttonBgColor = isAvailable ? atcBgColor : atcSoldOutBgColor;
    const buttonTextColor = isAvailable ? atcTextColor : atcSoldOutTextColor;
    const buttonBold = isAvailable ? atcAvailableBold : atcSoldOutBold;
    const buttonItalic = isAvailable ? atcAvailableItalic : atcSoldOutItalic;
    const buttonUnderline = isAvailable ? atcAvailableUnderline : atcSoldOutUnderline;

    const buttonStyle = {
      backgroundColor: buttonBgColor,
      borderRadius: atcCorner,
      paddingTop: atcPadY || atcPadT,
      paddingRight: atcPadX || atcPadR,
      paddingBottom: atcPadY || atcPadB,
      paddingLeft: atcPadX || atcPadL,
      ...(atcBorderLine && atcBorderLine !== "none"
        ? {
            borderWidth: 1,
            borderColor: atcBorderColor,
            borderStyle: atcBorderLine,
          }
        : {}),
    };

    const textStyle = {
      fontSize: atcSize,
      color: buttonTextColor,
      fontWeight: buttonBold ? "700" : atcWeight,
      fontStyle: buttonItalic ? "italic" : "normal",
      textDecorationLine: buttonUnderline ? "underline" : "none",
      ...(atcFamily && atcFamily !== "Inter" ? { fontFamily: atcFamily } : {}),
    };

    const alignStyle = {
      alignSelf:
        atcAlign === "center"
          ? "center"
          : atcAlign === "right"
          ? "flex-end"
          : "flex-start",
    };

    return (
      <TouchableOpacity
        style={[styles.addToCartButton, buttonStyle, alignStyle]}
        onPress={() => (isAvailable ? handleAddToCart(product) : null)}
        disabled={!isAvailable}
        activeOpacity={isAvailable ? 0.7 : 1}
      >
        <Text style={[styles.addToCartText, textStyle]}>{buttonText}</Text>
      </TouchableOpacity>
    );
  };

  if (!productCardGroupActive) return null;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: bgPadT,
          paddingRight: bgPadR,
          paddingBottom: bgPadB,
          paddingLeft: bgPadL,
          backgroundColor: backgroundActive ? bgColor : "transparent",
        },
      ]}
    >
      {headerGroupActive && (
        <View style={styles.headerContainer}>
          {renderHeader()}
          {renderViewAll()}
        </View>
      )}

      {loading && <Text style={styles.statusText}>Loading products...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && products.length === 0 && (
        <Text style={styles.statusText}>No products available.</Text>
      )}

      {!loading && !error && products.length > 0 && (
        <View style={styles.grid}>
          {products.slice(0, itemsShown).map((product, index) => {
            const isFavorite = favorites.has(product.id);
            const isSoldOut = false; // TODO: Check product availability
            const isLastInRow = (index + 1) % columns === 0;

            return (
              <TouchableOpacity
                key={product.id || index}
                style={[
                  styles.card,
                  {
                    width: cardWidth,
                    marginRight: isLastInRow ? 0 : colGap,
                    marginBottom: rowGap,
                    borderRadius: outerCorners,
                    borderWidth: borderSize,
                    borderColor: borderColor,
                    ...(borderLine && borderLine !== "none"
                      ? { borderStyle: borderLine }
                      : {}),
                  },
                ]}
                onPress={() => handleProductPress(product)}
                activeOpacity={0.85}
              >
                {cardImageActive && product.imageUrl && (
                  <View
                    style={[
                      styles.imageContainer,
                      {
                        borderRadius: imageCorner,
                        aspectRatio: imageAspectRatio || 1,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: product.imageUrl }}
                      style={[
                        styles.image,
                        {
                          borderRadius: imageCorner,
                        },
                      ]}
                      resizeMode={imageResizeMode}
                    />
                    {renderFavorite(product, isFavorite)}
                  </View>
                )}

                <View style={styles.cardContent}>
                  {cardTitleActive && (
                    <Text
                      numberOfLines={titleWrap ? 2 : undefined}
                      style={[
                        styles.title,
                        {
                          fontSize: titleSize,
                          color: titleColor,
                          fontWeight: titleWeight,
                          textAlign: titleAlign,
                          ...(titleFamily && titleFamily !== "Inter"
                            ? { fontFamily: titleFamily }
                            : {}),
                        },
                      ]}
                    >
                      {product.title}
                    </Text>
                  )}

                  {cardPriceActive && (
                    <View
                      style={[
                        styles.priceContainer,
                        {
                          alignItems:
                            priceAlign === "center"
                              ? "center"
                              : priceAlign === "right"
                              ? "flex-end"
                              : "flex-start",
                        },
                      ]}
                    >
                      {priceStrike && (
                        <Text
                          style={[
                            styles.strikePrice,
                            {
                              fontSize: strikeSize,
                              color: strikeColor,
                              fontWeight: strikeWeight,
                              ...(strikeFamily && strikeFamily !== "Inter"
                                ? { fontFamily: strikeFamily }
                                : {}),
                            },
                          ]}
                        >
                          {product.priceCurrency} {product.priceAmount}
                        </Text>
                      )}
                      <Text
                        style={[
                          styles.price,
                          {
                            fontSize: priceSize,
                            color: priceColor,
                            fontWeight: priceWeight,
                            ...(priceFamily && priceFamily !== "Inter"
                              ? { fontFamily: priceFamily }
                              : {}),
                          },
                        ]}
                      >
                        {product.priceCurrency} {product.priceAmount}
                      </Text>
                    </View>
                  )}

                  {atcPosition === "below" && renderAddToCart(product, isSoldOut)}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
  },
  viewAllContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {},
  viewAllIcon: {
    marginLeft: 4,
  },
  statusText: {
    textAlign: "center",
    color: "#6B7280",
    paddingVertical: 12,
  },
  errorText: {
    textAlign: "center",
    color: "#B91C1C",
    paddingVertical: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  card: {
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    position: "relative",
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    zIndex: 2,
    borderRadius: 20,
  },
  cardContent: {
    padding: 12,
    gap: 8,
  },
  title: {
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  price: {},
  strikePrice: {
    textDecorationLine: "line-through",
  },
  addToCartButton: {
    marginTop: 4,
  },
  addToCartText: {},
});

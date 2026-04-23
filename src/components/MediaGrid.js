import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { convertStyles } from "../utils/convertStyles";
import { resolveTextDecorationLine } from "../utils/textDecoration";
import { fetchShopifyProductsPage } from "../services/shopify";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  return fallback;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const resolveRadius = (value, fallback = 0) => {
  const candidates = Array.isArray(value) ? value : [value];

  for (const candidate of candidates) {
    const resolved = unwrapValue(candidate, undefined);
    if (resolved === undefined || resolved === null || resolved === "") continue;
    if (typeof resolved === "number") return resolved;
    if (typeof resolved === "string") {
      const trimmed = resolved.trim();
      if (!trimmed) continue;
      if (trimmed.includes("%") || trimmed === "999px" || trimmed === "9999px") {
        return 9999;
      }
      const parsed = parseFloat(trimmed);
      if (!Number.isNaN(parsed)) return parsed;
      continue;
    }

    const parsed = toNumber(resolved, undefined);
    if (parsed !== undefined) return parsed;
  }

  return fallback;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const deriveWeight = (value, fallback = "700") => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "string") {
    const lowered = resolved.toLowerCase();
    if (lowered === "bold") return "700";
    if (lowered === "medium") return "500";
    if (lowered === "regular") return "400";
  }
  return String(resolved);
};

// Returns null for "Auto" (caller should use Image.getSize instead)
const parseAspectRatio = (value) => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved || typeof resolved !== "string") return null;
  const trimmed = resolved.trim().toLowerCase();
  if (!trimmed || trimmed === "auto") return null;
  const parts = trimmed.split(":").map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  const n = parseFloat(trimmed);
  return Number.isNaN(n) || n <= 0 ? null : n;
};

// Sub-component that resolves image natural size when no fixed aspect ratio is given
function MediaCard({
  item,
  cardWidth,
  fixedAspectRatio,   // null → use Image.getSize
  cardRadius,
  imageRadius,
  showCardTitle,
  cardTitleColor,
  cardTitleSize,
  cardTitleWeight,
  cardTitleAlign,
  cardStyle,
  mediaStyle,
  gap,
  onPress,
}) {
  const [naturalRatio, setNaturalRatio] = useState(16 / 9); // landscape fallback while loading
  const didFetch = useRef(false);

  useEffect(() => {
    if (fixedAspectRatio !== null || !item.src || didFetch.current) return;
    didFetch.current = true;
    Image.getSize(
      item.src,
      (w, h) => { if (w > 0 && h > 0) setNaturalRatio(w / h); },
      () => {} // keep fallback on error
    );
  }, [item.src, fixedAspectRatio]);

  const ratio = fixedAspectRatio !== null ? fixedAspectRatio : naturalRatio;
  const imageHeight = Math.round(cardWidth / ratio);

  return (
    <TouchableOpacity
      activeOpacity={item.src ? 0.88 : 1}
      onPress={onPress}
      style={[
        styles.card,
        cardStyle,
        { width: cardWidth, borderRadius: cardRadius, overflow: "hidden" },
      ]}
    >
      {/* Image */}
      <View
        style={[
          styles.mediaContainer,
          { width: cardWidth, height: imageHeight, borderRadius: imageRadius },
        ]}
      >
        {item.src ? (
          <Image
            source={{ uri: item.src }}
            style={[styles.media, mediaStyle, { borderRadius: imageRadius }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholder, mediaStyle, { borderRadius: imageRadius }]}>
            <Text style={styles.placeholderText}>
              {item.title ? item.title.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
        )}
        {item.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : null}
      </View>

      {/* Card title */}
      {showCardTitle && !!item.title && (
        <Text
          numberOfLines={2}
          style={[
            styles.cardTitle,
            {
              color: cardTitleColor,
              fontSize: cardTitleSize,
              fontWeight: toBoolean(item.titleBold, false) ? "700" : cardTitleWeight,
              fontStyle: toBoolean(item.titleItalic, false) ? "italic" : "normal",
              textDecorationLine: resolveTextDecorationLine({
                underline: toBoolean(item.titleUnderline, false),
                strikethrough: toBoolean(item.titleStrikethrough, false),
              }),
              textAlign: cardTitleAlign,
              padding: 8,
            },
          ]}
        >
          {item.title}
        </Text>
      )}

      {!!item.subtitle && (
        <Text style={[styles.subtitle, { textAlign: cardTitleAlign, paddingHorizontal: 8 }]}>
          {item.subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const normalizeItems = (rawItems) => {
  let source = [];

  if (Array.isArray(rawItems)) {
    source = rawItems;
  } else if (Array.isArray(rawItems?.items)) {
    // DSL shape: { type: "array", items: [ ... ] }
    source = rawItems.items;
  } else if (rawItems && typeof rawItems === "object") {
    // DSL shape: { item-1: {...}, item-2: {...} }
    source = Object.values(rawItems).filter(
      (entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    );
  }

  return source
    .map((item, idx) => {
      const props = item?.properties || item || {};
      const id = unwrapValue(props.id, `item-${idx}`);
      const title = unwrapValue(props.title, "");
      const subtitle = unwrapValue(props.subtitle, "");
      const badge = unwrapValue(props.badge, "");
      const src = unwrapValue(props.src, "");
      const mediaType = unwrapValue(props.mediaType, "image");
      const titleBold = unwrapValue(props.titleBold, false);
      const titleItalic = unwrapValue(props.titleItalic, false);
      const titleUnderline = unwrapValue(props.titleUnderline, false);
      const titleStrikethrough = unwrapValue(props.titleStrikethrough, false);

      if (!title && !src && !subtitle) return null;
      return {
        id,
        title,
        subtitle,
        badge,
        src,
        mediaType,
        titleBold,
        titleItalic,
        titleUnderline,
        titleStrikethrough,
      };
    })
    .filter(Boolean);
};

export default function MediaGrid({ section }) {
  const navigation = useNavigation();
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};

  const [shopifyItems, setShopifyItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const items = useMemo(() => normalizeItems(rawProps?.items || []), [rawProps?.items]);

  const columns = Math.max(1, toNumber(rawProps?.columns, 2));
  const gap = toNumber(rawProps?.cardGap, 8);
  // null means "Auto" — MediaCard will call Image.getSize per item
  const cardAspectRatio = parseAspectRatio(rawProps?.cardAspectRatio);

  const showHeader = toBoolean(rawProps?.showHeader, true);
  const headerText = unwrapValue(
    rawProps?.headerText,
    unwrapValue(rawProps?.title, "Media Gallery")
  );
  const headerSize = toNumber(rawProps?.headerSize, 16);
  const headerColor = unwrapValue(rawProps?.headerColor, "#111827");
  const headerBold = toBoolean(rawProps?.headerBold, false);
  const headerItalic = toBoolean(rawProps?.headerItalic, false);
  const headerUnderline = toBoolean(rawProps?.headerUnderline, false);
  const headerStrikethrough = toBoolean(rawProps?.headerStrikethrough, false);
  const headerDecorationLine = resolveTextDecorationLine({
    underline: headerUnderline,
    strikethrough: headerStrikethrough,
  });

  const showButton = toBoolean(rawProps?.showButton, false);
  const buttonLabel = unwrapValue(rawProps?.buttonLabel, "View all");
  const buttonTextColor = unwrapValue(rawProps?.buttonTextColor, "#FFFFFF");
  const buttonBgColor = unwrapValue(rawProps?.buttonBgColor, "#111827");
  const buttonRadius = toNumber(rawProps?.buttonRadius, 4);
  const buttonFontSize = toNumber(rawProps?.buttonFontSize, 12);
  const buttonTextBold = toBoolean(rawProps?.buttonTextBold, false);
  const buttonTextItalic = toBoolean(rawProps?.buttonTextItalic, false);
  const buttonTextUnderline = toBoolean(rawProps?.buttonTextUnderline, false);
  const buttonTextStrikethrough = toBoolean(
    rawProps?.buttonTextStrikethrough ?? rawProps?.buttonStrikethrough,
    false
  );
  const buttonTextDecorationLine = resolveTextDecorationLine({
    underline: buttonTextUnderline,
    strikethrough: buttonTextStrikethrough,
  });
  const buttonPaddingTop = toNumber(rawProps?.buttonPaddingTop, 10);
  const buttonPaddingBottom = toNumber(rawProps?.buttonPaddingBottom, 10);
  const buttonPaddingLeft = toNumber(rawProps?.buttonPaddingLeft, 40);
  const buttonPaddingRight = toNumber(rawProps?.buttonPaddingRight, 40);

  const showCardTitle = toBoolean(rawProps?.showCardTitle, true);
  const showGrid = toBoolean(rawProps?.showGrid, true);
  const showMediaCard = toBoolean(rawProps?.showMediaCard, true);
  const cardTitleColor = unwrapValue(rawProps?.cardTitleColor, "#000000");
  const cardTitleSize = toNumber(rawProps?.cardTitleSize, 12);
  const cardTitleWeight = deriveWeight(rawProps?.cardTitleWeight, "500");
  const cardTitleAlign = (unwrapValue(rawProps?.cardTitleAlign, "left") || "left").toLowerCase();

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const shopifyDomain = toString(rawProps?.shopifyDomain, "");
  const shopifyToken = toString(rawProps?.storefrontToken, "");
  // Only use Shopify when DSL has no items OR explicitly enabled via useShopifyProducts
  const preferShopifyProducts = toBoolean(rawProps?.useShopifyProducts, items.length === 0);
  const hasShopifyConfig = Boolean(shopifyDomain || shopifyToken);
  const shopifyLimit = Math.max(
    1,
    toNumber(rawProps?.productsToShow, toNumber(rawProps?.productCount, items.length || 4))
  );

  const shouldUseShopify = preferShopifyProducts || (hasShopifyConfig && items.length === 0);
  const resolvedItems = shouldUseShopify ? shopifyItems : items;

  useEffect(() => {
    if (!shouldUseShopify) return;
    let isMounted = true;

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const payload = await fetchShopifyProductsPage({
          first: shopifyLimit,
          after: null,
          options: {
            shop: shopifyDomain || undefined,
            token: shopifyToken || undefined,
          },
        });
        const mapped = (payload?.products || []).map((product, index) => ({
          id: product.id || `shopify-${index}`,
          handle: product.handle || "",
          title: product.title || "Product",
          subtitle:
            product.priceCurrency && product.priceAmount
              ? `${product.priceCurrency} ${product.priceAmount}`
              : product.priceAmount
              ? String(product.priceAmount)
              : "",
          badge: "",
          src: product.imageUrl || "",
          mediaType: "image",
          titleBold: false,
          titleItalic: false,
          titleUnderline: false,
        }));

        if (isMounted) {
          setShopifyItems(mapped);
          if (!mapped.length) {
            setLoadError("No products available right now.");
          }
        }
      } catch (error) {
        if (isMounted) {
          setLoadError("Unable to load products right now.");
          setShopifyItems([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [shouldUseShopify, shopifyLimit, shopifyDomain, shopifyToken]);

  const containerStyle = convertStyles(layoutCss?.container || {});
  const headerStyle = convertStyles(layoutCss?.header || {});
  const gridStyle = convertStyles(layoutCss?.grid || {});
  const cardStyle = convertStyles(layoutCss?.card || {});
  const mediaStyle = convertStyles(layoutCss?.media || {});
  const buttonStyle = convertStyles(layoutCss?.button || {});
  const cardTitleStyle = convertStyles(layoutCss?.cardTitle || {});
  const buttonRowStyle = convertStyles(layoutCss?.buttonRow || {});

  const contentPadding = {
    paddingTop: toNumber(rawProps?.pt, 0),
    paddingRight: toNumber(rawProps?.pr, 16),
    paddingBottom: toNumber(rawProps?.pb, 0),
    paddingLeft: toNumber(rawProps?.pl, 16),
  };

  const screenWidth = Dimensions.get("window").width;
  const horizontalPadding = (contentPadding.paddingLeft || 0) + (contentPadding.paddingRight || 0);
  const totalGap = gap * (columns - 1);
  const computedCardWidth = (screenWidth - horizontalPadding - totalGap) / columns;
  // Corner radii stay square by default and only round when the DSL/DSR asks for it.
  const containerBorderRadius = resolveRadius(
    [
      rawProps?.style?.borderRadius,
      rawProps?.style?.radius,
      rawProps?.style?.cornerRadius,
      rawProps?.containerBorderRadius,
      rawProps?.borderRadius,
      rawProps?.radius,
      containerStyle?.borderRadius,
      layoutCss?.container?.borderRadius,
    ],
    0
  );
  const cardBorderRadius = resolveRadius(
    [
      rawProps?.style?.cardBorderRadius,
      rawProps?.style?.cardRadius,
      rawProps?.style?.cardCorner,
      rawProps?.style?.cardCornerRadius,
      rawProps?.cardRadius,
      rawProps?.cardBorderRadius,
      rawProps?.cardCorner,
      rawProps?.cardCornerRadius,
      rawProps?.cornerRadius,
      cardStyle?.borderRadius,
      layoutCss?.card?.borderRadius,
    ],
    0
  );
  const imageBorderRadius = resolveRadius(
    [
      rawProps?.style?.imageCorner,
      rawProps?.style?.imageCornerRadius,
      rawProps?.style?.imageRadius,
      rawProps?.imageCorner,
      rawProps?.imageCornerRadius,
      rawProps?.imageRadius,
      rawProps?.cardRadius,
      rawProps?.cardBorderRadius,
      rawProps?.cardCorner,
      rawProps?.cardCornerRadius,
      rawProps?.cornerRadius,
      mediaStyle?.borderRadius,
      cardStyle?.borderRadius,
      layoutCss?.media?.borderRadius,
      layoutCss?.image?.borderRadius,
      layoutCss?.card?.borderRadius,
    ],
    cardBorderRadius
  );
  const {
    backgroundColor: _containerBackgroundColor,
    background: _containerBackground,
    borderRadius: _containerBorderRadius,
    ...containerStyleWithoutRadius
  } = containerStyle;

  const handleItemPress = (item) => {
    const ref  = (item.navigateRef  || "").trim();
    const type = (item.navigateType || "").trim().toLowerCase();
    if (ref && type) {
      if (type === "collection") navigation.navigate("CollectionProducts", { handle: ref });
      else if (type === "product") navigation.navigate("ProductDetail", { handle: ref });
      else if (type === "allproducts" || type === "all_products") navigation.navigate("AllProducts");
      else if (type === "route") navigation.navigate(ref);
    } else if (item.handle) {
      navigation.navigate("ProductDetail", { handle: item.handle });
    }
    // href / linkTo links → no-op in native (no browser)
  };

  const renderItem = ({ item }) => (
    <MediaCard
      item={item}
      cardWidth={computedCardWidth}
      fixedAspectRatio={cardAspectRatio}
      cardRadius={cardBorderRadius}
      imageRadius={imageBorderRadius}
      showCardTitle={showCardTitle}
      cardTitleColor={cardTitleColor}
      cardTitleSize={cardTitleSize}
      cardTitleWeight={cardTitleWeight}
      cardTitleAlign={cardTitleAlign}
      cardStyle={cardStyle}
      mediaStyle={mediaStyle}
      gap={gap}
      onPress={() => handleItemPress(item)}
    />
  );

  if (!resolvedItems.length && !isLoading && !loadError) return null;


  return (
    <View
      style={[
        styles.container,
        containerStyleWithoutRadius,
        { backgroundColor: bgColor, borderRadius: containerBorderRadius },
        contentPadding,
      ]}
    >
      {showHeader && (
        <Text
          style={[
            styles.header,
            headerStyle,
            {
              color: headerColor,
              fontSize: headerSize,
              fontWeight: headerBold ? "700" : "600",
              fontStyle: headerItalic ? "italic" : "normal",
              textDecorationLine: headerDecorationLine,
            },
          ]}
        >
          {headerText}
        </Text>
      )}

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={headerColor} />
          <Text style={[styles.statusText, { color: headerColor }]}>Loading products...</Text>
        </View>
      )}

      {!isLoading && loadError ? (
        <Text style={[styles.statusText, styles.errorText]}>{loadError}</Text>
      ) : null}

      {showGrid && showMediaCard && (
        <FlatList
          key={`media-grid-${columns}`}
          data={resolvedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { columnGap: gap } : undefined}
          contentContainerStyle={[{ rowGap: gap }, gridStyle]}
          scrollEnabled={false}
        />
      )}

      {showButton && !!buttonLabel && (
        <View style={[styles.buttonRow, { marginTop: 12 }, buttonRowStyle]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.button,
              buttonStyle,
              {
                backgroundColor: buttonBgColor,
                borderRadius: buttonRadius,
                paddingTop: buttonPaddingTop,
                paddingBottom: buttonPaddingBottom,
                paddingLeft: buttonPaddingLeft,
                paddingRight: buttonPaddingRight,
              },
            ]}
          >
            <Text
              style={{
                color: buttonTextColor,
                fontSize: buttonFontSize,
                fontWeight: buttonTextBold ? "700" : "600",
                fontStyle: buttonTextItalic ? "italic" : "normal",
                textDecorationLine: buttonTextDecorationLine,
              }}
            >
              {buttonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 0,
  },
  header: {
    marginBottom: 12,
    fontWeight: "700",
  },
  mediaContainer: {
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  placeholderText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  card: {
    overflow: "hidden",
  },
  cardTitle: {
    paddingTop: 8,
  },
  subtitle: {
    color: "#4B5563",
    fontSize: 12,
    paddingBottom: 10,
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#22C55E",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buttonRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 12,
    color: "#6B7280",
  },
  errorText: {
    color: "#DC2626",
  },
});

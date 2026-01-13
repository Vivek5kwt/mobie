import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { convertStyles } from "../utils/convertStyles";
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

const parseAspectRatio = (value, fallback = 1) => {
  const resolved = unwrapValue(value, undefined);
  if (!resolved || typeof resolved !== "string") return fallback;
  const parts = resolved.split(":").map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] / parts[1];
  }
  return fallback;
};

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
      };
    })
    .filter(Boolean);
};

export default function MediaGrid({ section }) {
  const rawProps =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};

  const [shopifyItems, setShopifyItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const items = useMemo(() => normalizeItems(rawProps?.items || []), [rawProps?.items]);

  const columns = Math.max(1, toNumber(rawProps?.columns, 2));
  const gap = toNumber(rawProps?.cardGap, 8);
  const cardRadius = toNumber(rawProps?.cardRadius, 8);
  const cardAspectRatio = parseAspectRatio(rawProps?.cardAspectRatio, 4 / 5);

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

  const showButton = toBoolean(rawProps?.showButton, false);
  const buttonLabel = unwrapValue(rawProps?.buttonLabel, "View all");
  const buttonTextColor = unwrapValue(rawProps?.buttonTextColor, "#FFFFFF");
  const buttonBgColor = unwrapValue(rawProps?.buttonBgColor, "#111827");
  const buttonRadius = toNumber(rawProps?.buttonRadius, 4);
  const buttonFontSize = toNumber(rawProps?.buttonFontSize, 12);
  const buttonTextBold = toBoolean(rawProps?.buttonTextBold, false);
  const buttonTextItalic = toBoolean(rawProps?.buttonTextItalic, false);
  const buttonTextUnderline = toBoolean(rawProps?.buttonTextUnderline, false);

  const showCardTitle = toBoolean(rawProps?.showCardTitle, true);
  const showGrid = toBoolean(rawProps?.showGrid, true);
  const showMediaCard = toBoolean(rawProps?.showMediaCard, true);
  const cardTitleColor = unwrapValue(rawProps?.cardTitleColor, "#000000");
  const cardTitleSize = toNumber(rawProps?.cardTitleSize, 12);
  const cardTitleWeight = deriveWeight(rawProps?.cardTitleWeight, "500");
  const cardTitleAlign = (unwrapValue(rawProps?.cardTitleAlign, "left") || "left").toLowerCase();

  const bgColor = unwrapValue(rawProps?.bgColor, "#FFFFFF");
  const shopifyLimit = Math.max(
    1,
    toNumber(rawProps?.productsToShow, toNumber(rawProps?.productCount, items.length || 4))
  );

  const resolvedItems = items.length ? items : shopifyItems;

  useEffect(() => {
    if (items.length) return;
    let isMounted = true;

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const payload = await fetchShopifyProductsPage({
          first: shopifyLimit,
          after: null,
        });
        const response = payload?.products || [];
        const mapped = response.map((product, index) => ({
          id: product.id || `shopify-${index}`,
          title: product.title || "Product",
          subtitle:
            product.priceAmount && product.priceCurrency
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
  }, [items.length, shopifyLimit]);

  const containerStyle = convertStyles(layoutCss?.container || {});
  const headerStyle = convertStyles(layoutCss?.header || {});
  const gridStyle = convertStyles(layoutCss?.grid || {});
  const cardStyle = convertStyles(layoutCss?.card || {});
  const mediaStyle = convertStyles(layoutCss?.media || {});
  const buttonStyle = convertStyles(layoutCss?.button || {});
  const cardTitleStyle = convertStyles(layoutCss?.cardTitle || {});
  const buttonRowStyle = convertStyles(layoutCss?.buttonRow || {});

  const contentPadding = {
    paddingTop: toNumber(rawProps?.pt, 16),
    paddingRight: toNumber(rawProps?.pr, 16),
    paddingBottom: toNumber(rawProps?.pb, 16),
    paddingLeft: toNumber(rawProps?.pl, 16),
  };

  const cardWidth = () => {
    const screenWidth = Dimensions.get("window").width;
    const horizontalPadding = (contentPadding.paddingLeft || 0) + (contentPadding.paddingRight || 0);
    const totalGap = gap * (columns - 1);
    return (screenWidth - horizontalPadding - totalGap) / columns;
  };

  const renderItem = ({ item }) => (
    <View
      style={[
        styles.card,
        cardStyle,
        {
          width: cardWidth(),
          marginBottom: gap,
          borderRadius: cardRadius,
          overflow: "hidden",
          backgroundColor: cardStyle.backgroundColor || "#F3F4F6",
        },
      ]}
    >
      {toBoolean(rawProps?.showMediaImage, true) && (
        <View
          style={[
            styles.mediaContainer,
            {
              width: "100%",
              aspectRatio: cardAspectRatio,
              borderRadius: cardRadius,
            },
          ]}
        >
          {item.src ? (
            <Image
              source={{ uri: item.src }}
              style={[styles.media, mediaStyle]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholder, mediaStyle]}>
              <Text style={styles.placeholderText}>Image</Text>
            </View>
          )}
          {item.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : null}
        </View>
      )}

      {showCardTitle && (
        <Text
          numberOfLines={2}
          style={[
            styles.cardTitle,
            cardTitleStyle,
            {
              color: cardTitleColor,
              fontSize: cardTitleSize,
              fontWeight: toBoolean(item.titleBold, false) ? "700" : cardTitleWeight,
              fontStyle: toBoolean(item.titleItalic, false) ? "italic" : "normal",
              textDecorationLine: toBoolean(item.titleUnderline, false) ? "underline" : "none",
              textAlign: cardTitleAlign,
              padding: 8,
            },
          ]}
        >
          {item.title}
        </Text>
      )}

      {item.subtitle ? (
        <Text style={[styles.subtitle, { textAlign: cardTitleAlign, paddingHorizontal: 8 }]}>
          {item.subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (!resolvedItems.length && !isLoading && !loadError) return null;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, containerStyle, contentPadding]}>
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
              textDecorationLine: headerUnderline ? "underline" : "none",
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
          data={resolvedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          columnWrapperStyle={{ columnGap: gap }}
          contentContainerStyle={[{ rowGap: gap }, gridStyle]}
          scrollEnabled={false}
        />
      )}

      {showButton && (
        <View style={[styles.buttonRow, { marginTop: 12 }, buttonRowStyle]}>
          <Text
            style={[
              styles.button,
              buttonStyle,
              {
                color: buttonTextColor,
                backgroundColor: buttonBgColor,
                borderRadius: buttonRadius,
                fontSize: buttonFontSize,
                fontWeight: buttonTextBold ? "700" : "600",
                fontStyle: buttonTextItalic ? "italic" : "normal",
                textDecorationLine: buttonTextUnderline ? "underline" : "none",
              },
            ]}
          >
            {buttonLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
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

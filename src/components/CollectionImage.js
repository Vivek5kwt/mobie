import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchShopifyCollections, SHOPIFY_SHOP } from "../services/shopify";
import { convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
  }
  return value;
};

const asBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof resolved === "number") return resolved !== 0;
  return fallback;
};

const asNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildCollections = (collectionsBlock = {}) => {
  const normalized = Array.isArray(collectionsBlock)
    ? collectionsBlock
    : Object.values(collectionsBlock);
  const values = normalized.filter((item) => item);

  return values
    .map((item) => {
      const props = item.properties || item;
      const title = unwrapValue(props?.title, "");
      const image = unwrapValue(props?.image, "");
      const link = unwrapValue(props?.link, "");
      const handle = unwrapValue(props?.handle, "");

      if (!title && !image) return null;
      return { title, image, link, handle };
    })
    .filter(Boolean);
};

const deriveFontWeight = (input, fallback = "700") => {
  if (!input) return fallback;
  const value = unwrapValue(input, fallback);
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "bold") return "700";
    if (lowered === "medium") return "500";
    if (lowered === "regular") return "400";
  }
  return String(value);
};

export default function CollectionImage({ section }) {
  const navigation = useNavigation();
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const behavior = rawProps?.behavior?.properties || rawProps?.behavior || {};
  const headerCfg = rawProps?.header?.properties || rawProps?.header || {};
  const cardCfg = rawProps?.card?.properties || rawProps?.card || {};

  const collections = useMemo(
    () => buildCollections(rawProps?.collections || {}),
    [rawProps?.collections]
  );
  const [shopifyCollections, setShopifyCollections] = useState([]);

  const showHeader = asBoolean(rawProps?.showHeader, true);
  const showCardImage = asBoolean(rawProps?.showCardImage, true);

  const headerText = unwrapValue(
    headerCfg?.headerText ??
      headerCfg?.title ??
      headerCfg?.text ??
      section?.properties?.title ??
      section?.title,
    "Featured Collections"
  );
  const headerSize = asNumber(headerCfg?.headerSize, 16);
  const headerColor = unwrapValue(headerCfg?.headerColor, "#000000");
  const headerWeight = deriveFontWeight(headerCfg?.headerWeight, "700");

  const cardTextSize = asNumber(cardCfg?.textSize, 12);
  const cardTextColor = unwrapValue(cardCfg?.textColor, "#000000");
  const cardTextWeight = deriveFontWeight(cardCfg?.textWeight, "500");
  const cardImageSize = asNumber(cardCfg?.imageSize, 64);
  const cardImageBorder = asNumber(cardCfg?.imageBorder, 0);
  const cardImageBorderColor = unwrapValue(cardCfg?.imageBorderColor, "#A8A7AE");
  const textAlign = (unwrapValue(cardCfg?.textAlign, "left") || "left").toLowerCase();
  const imageShape = (unwrapValue(cardCfg?.imageShape, "circle") || "circle").toLowerCase();

  const sliderCfg = layoutCss?.slider || {};
  const gapPx = asNumber(sliderCfg?.gapPx ?? sliderCfg?.gap, 12);
  const autoScrollEnabled = asBoolean(behavior?.autoScroll ?? sliderCfg?.autoScroll, true);
  const showIndicators = asBoolean(
    behavior?.showIndicators ?? sliderCfg?.showIndicators,
    true
  );
  const scrollSpeedSec = asNumber(behavior?.scrollSpeed, 3);

  const cardWidth = asNumber(layoutCss?.card?.width, 96);
  const containerStyle = convertStyles(layoutCss?.container || {});
  const headerStyle = convertStyles(layoutCss?.header || {});
  const cardTextStyle = convertStyles(layoutCss?.card?.text || {});
  const cardImageStyle = convertStyles(layoutCss?.card?.image || {});
  const cardContainerStyle = useMemo(() => {
    const rawCard = layoutCss?.card || {};
    const allowed = {};

    Object.entries(rawCard).forEach(([key, val]) => {
      if (key === "text" || key === "image") return;
      allowed[key] = val;
    });

    return convertStyles(allowed);
  }, [layoutCss?.card]);

  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const collectionsLimit = asNumber(rawProps?.collectionsLimit, 12);
  const resolvedCollections = collections.length ? collections : shopifyCollections;
  const resolveCollectionHandle = (item) => {
    if (item?.handle) return item.handle;
    const link = item?.link || "";
    if (!link) return "";
    const marker = "/collections/";
    if (link.includes(marker)) {
      const handle = link.split(marker)[1] || "";
      return handle.split(/[?#/]/)[0];
    }
    return link;
  };

  const handleCollectionPress = (item) => {
    const handle = resolveCollectionHandle(item);
    if (!handle) return;
    navigation.navigate("CollectionProducts", {
      collectionHandle: handle,
      collectionTitle: item?.title || "Collection",
    });
  };

  useEffect(() => {
    indexRef.current = 0;
    setCurrentIndex(0);
  }, [resolvedCollections.length]);

  useEffect(() => {
    if (collections.length) return;

    let isMounted = true;

    const loadCollections = async () => {
      const response = await fetchShopifyCollections(collectionsLimit);
      if (!isMounted) return;

      const nextCollections = response.map((collection) => ({
        title: collection?.title || "",
        image: collection?.imageUrl || "",
        handle: collection?.handle || "",
        link: collection?.handle
          ? `https://${SHOPIFY_SHOP}/collections/${collection.handle}`
          : "",
      }));

      setShopifyCollections(nextCollections.filter((item) => item.title || item.image));
    };

    loadCollections();

    return () => {
      isMounted = false;
    };
  }, [collections.length, collectionsLimit]);

  useEffect(() => {
    if (!autoScrollEnabled || resolvedCollections.length <= 1) return undefined;

    const interval = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % resolvedCollections.length;
      const xOffset = nextIndex * (cardWidth + gapPx);
      scrollRef.current?.scrollTo({ x: xOffset, animated: true });
      indexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }, Math.max(scrollSpeedSec, 1) * 1000);

    return () => clearInterval(interval);
  }, [autoScrollEnabled, resolvedCollections.length, cardWidth, gapPx, scrollSpeedSec]);

  const handleScroll = (event) => {
    const xOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(xOffset / (cardWidth + gapPx));
    if (index !== currentIndex) {
      indexRef.current = index;
      setCurrentIndex(index);
    }
  };

  if (!resolvedCollections.length) return null;

  return (
    <View style={[styles.container, containerStyle]}>
      {showHeader && (
        <Text
          style={[
            styles.header,
            headerStyle,
            { color: headerColor, fontSize: headerSize, fontWeight: headerWeight },
          ]}
        >
          {headerText}
        </Text>
      )}

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        snapToInterval={cardWidth + gapPx}
        decelerationRate="fast"
      >
        {resolvedCollections.map((item, idx) => (
          <TouchableOpacity
            key={`${item.title}-${idx}`}
            style={[
              styles.card,
              {
                width: cardWidth,
                marginRight: idx === resolvedCollections.length - 1 ? 0 : gapPx,
              },
              cardContainerStyle,
            ]}
            activeOpacity={0.85}
            onPress={() => handleCollectionPress(item)}
            disabled={!resolveCollectionHandle(item)}
          >
            {showCardImage && (
              <View
                style={[
                  styles.imageWrap,
                  {
                    width: cardImageSize + cardImageBorder * 2,
                    height: cardImageSize + cardImageBorder * 2,
                    borderRadius: (cardImageSize + cardImageBorder * 2) / 2,
                    borderWidth: cardImageBorder,
                    borderColor: cardImageBorderColor,
                  },
                  cardImageStyle,
                ]}
              >
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={{
                      width: cardImageSize,
                      height: cardImageSize,
                      borderRadius: imageShape === "circle" ? cardImageSize / 2 : 8,
                      backgroundColor: cardImageStyle?.backgroundColor || "#f5f5f5",
                    }}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={{
                      width: cardImageSize,
                      height: cardImageSize,
                      borderRadius: cardImageSize / 2,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#e9ecef",
                    }}
                  >
                    <Text style={{ color: "#9CA3AF", fontWeight: "600" }}>n/a</Text>
                  </View>
                )}
              </View>
            )}

            {asBoolean(cardCfg?.showText, true) && (
              <Text
                numberOfLines={2}
                style={[
                  styles.cardTitle,
                  cardTextStyle,
                  {
                    color: cardTextColor,
                    fontSize: cardTextSize,
                    fontWeight: cardTextWeight,
                    textAlign,
                  },
                ]}
              >
                {item.title}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </Animated.ScrollView>

      {showIndicators && resolvedCollections.length > 1 && (
        <View style={styles.dotsRow}>
          {resolvedCollections.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <View
                key={`dot-${idx}`}
                style={[
                  styles.dot,
                  { opacity: isActive ? 1 : 0.3, backgroundColor: "#016D77" },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  header: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  card: {
    alignItems: "center",
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    marginTop: 6,
  },
  dotsRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
});

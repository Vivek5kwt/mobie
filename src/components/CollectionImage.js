import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { fetchShopifyCollections, getShopifyDomain } from "../services/shopify";
import { convertStyles } from "../utils/convertStyles";

// ─── helpers ──────────────────────────────────────────────────────────────────

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
    const l = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
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

const deriveFontWeight = (input, fallback = "700") => {
  if (!input) return fallback;
  const value = unwrapValue(input, fallback);
  if (typeof value === "string") {
    const l = value.toLowerCase();
    if (l === "bold") return "700";
    if (l === "semibold" || l === "semi bold") return "600";
    if (l === "medium") return "500";
    if (l === "regular" || l === "normal") return "400";
  }
  return String(value);
};

const buildCollections = (block = {}) => {
  const arr = Array.isArray(block) ? block : Object.values(block);
  return arr
    .filter(Boolean)
    .map((item) => {
      const p = item.properties || item;
      const title  = unwrapValue(p?.title,  "");
      const image  = unwrapValue(p?.image,  "");
      const link   = unwrapValue(p?.link,   "");
      const handle = unwrapValue(p?.handle, "");
      if (!title && !image) return null;
      return { title, image, link, handle };
    })
    .filter(Boolean);
};

const deriveHandle = (item) => {
  if (item?.handle) return item.handle;
  const link = item?.link || "";
  if (link) {
    const m = "/collections/";
    if (link.includes(m)) return link.split(m)[1]?.split(/[?#/]/)[0] || "";
    return link;
  }
  // fallback: slugify title
  return String(item?.title || "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const SCREEN_W = Dimensions.get("window").width;

// ─── component ────────────────────────────────────────────────────────────────

export default function CollectionImage({ section }) {
  const navigation = useNavigation();

  const rawProps = useMemo(
    () =>
      section?.props ||
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      {},
    [section]
  );

  const layoutCss    = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const behavior     = rawProps?.behavior?.properties    || rawProps?.behavior    || {};
  const headerCfg    = rawProps?.header?.properties      || rawProps?.header      || {};
  const cardCfg      = rawProps?.card?.properties        || rawProps?.card        || {};
  const containerCfg = rawProps?.container?.properties   || rawProps?.container   || {};

  // ── Collections ──────────────────────────────────────────────────────────────
  const dslCollections = useMemo(() => buildCollections(rawProps?.collections || {}), [rawProps]);
  const [shopifyCollections, setShopifyCollections] = useState([]);
  const collectionsLimit = asNumber(rawProps?.collectionsLimit, 12);
  const items = dslCollections.length ? dslCollections : shopifyCollections;

  // ── Layout ───────────────────────────────────────────────────────────────────
  const containerPt = asNumber(containerCfg?.pt, 0);
  const containerPb = asNumber(containerCfg?.pb, 0);
  const containerPl = asNumber(containerCfg?.pl, 0);
  const containerPr = asNumber(containerCfg?.pr, 0);
  const bgColor     = unwrapValue(containerCfg?.bgColor, "#FFFFFF");

  // ── Header ───────────────────────────────────────────────────────────────────
  const showHeader   = asBoolean(rawProps?.showHeader, true);
  const headerText   = unwrapValue(
    headerCfg?.headerText ?? headerCfg?.title ?? headerCfg?.text ??
    section?.properties?.title ?? section?.title,
    "Featured Collections"
  );
  const headerSize   = asNumber(headerCfg?.headerSize, 16);
  const headerColor  = unwrapValue(headerCfg?.headerColor, "#000000");
  const headerWeight = deriveFontWeight(headerCfg?.headerWeight, "700");
  const headerCssStyle = convertStyles(layoutCss?.header || {});

  // ── Card ─────────────────────────────────────────────────────────────────────
  const showCardImage       = asBoolean(rawProps?.showCardImage, true);
  const cardTextSize        = asNumber(cardCfg?.textSize, 12);
  const cardTextColor       = unwrapValue(cardCfg?.textColor, "#000000");
  const cardTextWeight      = deriveFontWeight(cardCfg?.textWeight, "500");
  const cardImageSize       = asNumber(cardCfg?.imageSize, 68);
  const cardImageBorder     = asNumber(cardCfg?.imageBorder, 0);
  const cardImageBorderColor = unwrapValue(cardCfg?.imageBorderColor, "#A8A7AE");
  const textAlign  = (unwrapValue(cardCfg?.textAlign, "center") || "center").toLowerCase();
  const imageShape = (unwrapValue(cardCfg?.imageShape, "circle") || "circle").toLowerCase();

  const imageRadius = imageShape === "square" ? 0
    : imageShape === "circle" ? cardImageSize / 2
    : Math.max(8, Math.round(cardImageSize * 0.2));
  const imageWrapRadius = imageShape === "square" ? 0
    : imageShape === "circle" ? (cardImageSize + cardImageBorder * 2) / 2
    : imageRadius + cardImageBorder;

  const cardCssStyle = useMemo(() => {
    const raw = layoutCss?.card || {};
    const clean = {};
    Object.entries(raw).forEach(([k, v]) => { if (k !== "text" && k !== "image") clean[k] = v; });
    return convertStyles(clean);
  }, [layoutCss?.card]);

  const cardTextCssStyle  = convertStyles(layoutCss?.card?.text  || {});
  const cardImageCssStyle = convertStyles(layoutCss?.card?.image || {});

  // ── Slider ───────────────────────────────────────────────────────────────────
  const sliderCfg        = layoutCss?.slider || {};
  const gapPx            = asNumber(sliderCfg?.gapPx ?? sliderCfg?.gap, 12);
  const autoScrollEnabled = asBoolean(behavior?.autoScroll ?? sliderCfg?.autoScroll, true);
  const showIndicators   = asBoolean(behavior?.showIndicators ?? sliderCfg?.showIndicators, true);
  const scrollSpeedSec   = Math.max(asNumber(behavior?.scrollSpeed, 3), 1);

  // Each card width from DSL; constrain so at least partial next card peeks
  const rawCardW = asNumber(layoutCss?.card?.width, 80);
  // ITEM SIZE = card width. STEP SIZE = cardW + gap (right margin per item)
  // No left/right padding on the list — margins live on the items themselves.
  const cardW  = Math.max(40, Math.min(rawCardW, SCREEN_W - containerPl - containerPr - gapPx * 3));
  const stepSize = cardW + gapPx; // exact distance between snap points

  // ── Dots ─────────────────────────────────────────────────────────────────────
  const dotActiveBg   = unwrapValue(behavior?.dotActiveColor   ?? sliderCfg?.dotActiveColor,   "#016D77");
  const dotInactiveBg = unwrapValue(behavior?.dotInactiveColor ?? sliderCfg?.dotInactiveColor, "#C4C4C4");
  const dotActiveW    = asNumber(behavior?.dotActiveWidth  ?? sliderCfg?.dotActiveWidth,  20);
  const dotInactiveW  = asNumber(behavior?.dotInactiveWidth ?? sliderCfg?.dotInactiveWidth, 8);
  const dotH          = asNumber(behavior?.dotHeight ?? sliderCfg?.dotHeight, 8);

  // ── State ────────────────────────────────────────────────────────────────────
  const listRef        = useRef(null);
  const indexRef       = useRef(0);
  const autoScrollRef  = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // One Animated.Value per dot — created lazily in useEffect when item count is known
  const dotAnims = useRef([]);

  useEffect(() => {
    // Re-initialise dot animations whenever the collection list changes
    dotAnims.current = items.map(
      (_, i) => new Animated.Value(i === 0 ? dotActiveW : dotInactiveW)
    );
    indexRef.current = 0;
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  // We only want this to fire when the item list or dot sizes change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, dotActiveW, dotInactiveW]);

  // Animate all dots to reflect `newIndex`
  const animateDots = useCallback((newIndex) => {
    dotAnims.current.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === newIndex ? dotActiveW : dotInactiveW,
        useNativeDriver: false,
        speed: 30,
        bounciness: 0,
      }).start();
    });
    indexRef.current = newIndex;
    setActiveIndex(newIndex);
  }, [dotActiveW, dotInactiveW]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoScrollEnabled || items.length < 2) return;

    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % items.length;
      autoScrollRef.current = true;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      animateDots(next);
      // Clear flag after transition completes
      setTimeout(() => { autoScrollRef.current = false; }, 500);
    }, scrollSpeedSec * 1000);

    return () => clearInterval(timer);
  }, [autoScrollEnabled, items.length, scrollSpeedSec, animateDots]);

  // ── Shopify fallback ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (dslCollections.length) return;
    let alive = true;
    fetchShopifyCollections(collectionsLimit).then((resp) => {
      if (!alive) return;
      setShopifyCollections(
        resp
          .map((c) => ({
            title: c?.title || "",
            image: c?.imageUrl || "",
            handle: c?.handle || "",
            link: c?.handle ? `https://${getShopifyDomain()}/collections/${c.handle}` : "",
          }))
          .filter((x) => x.title || x.image)
      );
    }).catch(() => {});
    return () => { alive = false; };
  }, [rawProps, collectionsLimit, dslCollections.length]);

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  // FlatList getItemLayout — required for scrollToIndex to work correctly
  const getItemLayout = useCallback(
    (_, index) => ({ length: stepSize, offset: stepSize * index, index }),
    [stepSize]
  );

  // Only update index when the user finishes a manual swipe
  const onMomentumScrollEnd = useCallback((e) => {
    if (autoScrollRef.current) return;
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const newIndex = Math.min(
      Math.max(Math.round(x / stepSize), 0),
      items.length - 1
    );
    if (newIndex !== indexRef.current) animateDots(newIndex);
  }, [stepSize, items.length, animateDots]);

  const onDotPress = useCallback((idx) => {
    listRef.current?.scrollToIndex({ index: idx, animated: true });
    animateDots(idx);
  }, [animateDots]);

  const onItemPress = useCallback((item) => {
    const handle = deriveHandle(item);
    if (!handle) return;
    navigation.navigate("CollectionProducts", {
      collectionHandle: handle,
      collectionTitle: item?.title || "Collection",
    });
  }, [navigation]);

  // ── Render item ───────────────────────────────────────────────────────────────
  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        cardCssStyle,
        { width: cardW, marginRight: gapPx },
      ]}
      activeOpacity={0.82}
      onPress={() => onItemPress(item)}
      disabled={!deriveHandle(item)}
    >
      {showCardImage && (
        <View
          style={[
            styles.imageWrap,
            {
              width: cardImageSize + cardImageBorder * 2,
              height: cardImageSize + cardImageBorder * 2,
              borderRadius: imageWrapRadius,
              borderWidth: cardImageBorder,
              borderColor: cardImageBorderColor,
            },
            cardImageCssStyle,
          ]}
        >
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={{
                width: cardImageSize,
                height: cardImageSize,
                borderRadius: imageRadius,
                backgroundColor: cardImageCssStyle?.backgroundColor || "#e0f2f1",
              }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: cardImageSize,
                height: cardImageSize,
                borderRadius: imageRadius,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#e0f2f1",
              }}
            >
              <Text style={{ color: "#096d70", fontSize: cardImageSize * 0.4, fontWeight: "700" }}>
                {(item.title || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      )}

      {asBoolean(cardCfg?.showText, true) && (
        <Text
          numberOfLines={2}
          style={[
            styles.cardTitle,
            cardTextCssStyle,
            { color: cardTextColor, fontSize: cardTextSize, fontWeight: cardTextWeight, textAlign, maxWidth: cardW },
          ]}
        >
          {item.title}
        </Text>
      )}
    </TouchableOpacity>
  ), [
    cardCssStyle, cardW, gapPx, onItemPress,
    showCardImage, cardImageSize, cardImageBorder, imageWrapRadius,
    cardImageBorderColor, cardImageCssStyle, imageRadius,
    cardCfg, cardTextCssStyle, cardTextColor, cardTextSize, cardTextWeight, textAlign,
  ]);

  if (!items.length) return null;

  const isScrollable = items.length > 1;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          paddingTop: containerPt,
          paddingBottom: containerPb,
          paddingLeft: containerPl,
          paddingRight: containerPr,
        },
        convertStyles(layoutCss?.container || {}),
      ]}
    >
      {/* Header */}
      {showHeader && (
        <Text
          style={[
            styles.header,
            headerCssStyle,
            { color: headerColor, fontSize: headerSize, fontWeight: headerWeight },
          ]}
        >
          {headerText}
        </Text>
      )}

      {/* FlatList — exact snap with getItemLayout */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, idx) => `${item.title}-${idx}`}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={isScrollable}
        // Snap: each step is exactly cardW + gapPx (the marginRight)
        snapToInterval={stepSize}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        // getItemLayout makes scrollToIndex pixel-perfect
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={onMomentumScrollEnd}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingLeft: containerPl > 0 ? 0 : 0 }}
      />

      {/* Dot indicators — tappable, animated width */}
      {showIndicators && items.length > 1 && (
        <View style={styles.dotsRow}>
          {items.map((_, idx) => {
            const isActive = idx === activeIndex;
            const animW = dotAnims.current[idx];
            return (
              <TouchableOpacity
                key={`dot-${idx}`}
                onPress={() => onDotPress(idx)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={{
                    width: animW ?? (isActive ? dotActiveW : dotInactiveW),
                    height: dotH,
                    borderRadius: dotH / 2,
                    backgroundColor: isActive ? dotActiveBg : dotInactiveBg,
                    marginHorizontal: 3,
                  }}
                />
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
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  cardTitle: {
    marginTop: 4,
    textAlign: "center",
    lineHeight: 16,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    paddingBottom: 4,
  },
});

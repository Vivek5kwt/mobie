import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

const buildSlides = (slidesBlock = {}) => {
  const candidateArray = Array.isArray(slidesBlock?.items)
    ? slidesBlock.items
    : Array.isArray(slidesBlock)
      ? slidesBlock
      : Object.values(slidesBlock || {});

  return candidateArray
    .map((item, idx) => {
      const props = item?.properties || item;
      const headline = unwrapValue(props?.headline ?? props?.title, "");
      const subtext = unwrapValue(props?.subtext ?? props?.subtitle, "");
      const image = unwrapValue(props?.image, "");
      const buttonLabel = unwrapValue(props?.buttonLabel ?? props?.cta ?? "Shop Now", "");
      const buttonHref = unwrapValue(props?.buttonHref ?? props?.href, "");

      if (!headline && !subtext && !image) return null;

      return {
        id: unwrapValue(props?.id, `slide-${idx}`),
        headline,
        subtext,
        image,
        buttonLabel,
        buttonHref,
      };
    })
    .filter(Boolean);
};

export default function BannerSlider({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const behavior = rawProps?.behavior?.properties || rawProps?.behavior || {};
  const slides = useMemo(() => buildSlides(rawProps?.slides || []), [rawProps?.slides]);

  const sliderCfg = layoutCss?.slider || {};
  const headingStyleFromCss = convertStyles(layoutCss?.heading || {});
  const subheadingStyleFromCss = convertStyles(layoutCss?.subheading || {});
  const buttonStyleFromCss = convertStyles(layoutCss?.button || {});
  const containerStyleFromCss = convertStyles(layoutCss?.container || {});
  const slideStyleFromCss = convertStyles(layoutCss?.slide || {});

  const showDots = asBoolean(
    behavior?.showDots ?? behavior?.showIndicators ?? sliderCfg?.showIndicators,
    true
  );
  const autoScroll = asBoolean(behavior?.autoScroll ?? sliderCfg?.autoScroll, true);
  const scrollSpeedSec = asNumber(
    behavior?.scrollSpeedSec ?? behavior?.scrollSpeed ?? sliderCfg?.autoScrollSpeed,
    4
  );
  const bannerHeight = asNumber(sliderCfg?.bannerHeight, 180);
  const bannerRadius = asNumber(sliderCfg?.bannerRadius, 12);
  const headingAlign = unwrapValue(sliderCfg?.headingAlign ?? layoutCss?.heading?.align, "Center");
  const subheadingAlign = unwrapValue(
    sliderCfg?.subheadingAlign ?? layoutCss?.subheading?.align,
    "Center"
  );

  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get("window").width - 24
  );

  useEffect(() => {
    indexRef.current = 0;
    setCurrentIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [slides.length]);

  useEffect(() => {
    if (!autoScroll || slides.length <= 1 || !containerWidth) return undefined;

    const interval = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % slides.length;
      const xOffset = nextIndex * containerWidth;
      scrollRef.current?.scrollTo({ x: xOffset, animated: true });
      indexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }, Math.max(scrollSpeedSec, 1) * 1000);

    return () => clearInterval(interval);
  }, [autoScroll, slides.length, containerWidth, scrollSpeedSec]);

  const handleScroll = (event) => {
    const xOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(xOffset / Math.max(containerWidth, 1));
    if (index !== currentIndex) {
      indexRef.current = index;
      setCurrentIndex(index);
    }
  };

  if (!slides.length) return null;

  return (
    <View
      style={[styles.container, containerStyleFromCss]}
      onLayout={(event) => {
        const width = event?.nativeEvent?.layout?.width;
        if (width) setContainerWidth(width);
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        scrollEventThrottle={16}
      >
        {slides.map((slide, idx) => (
          <View key={slide.id || idx} style={{ width: containerWidth }}>
            <View
              style={[
                styles.slide,
                slideStyleFromCss,
                {
                  minHeight: bannerHeight,
                  borderRadius: bannerRadius,
                  backgroundColor: slideStyleFromCss?.backgroundColor || "#CFFAFE",
                },
              ]}
            >
              <View style={styles.textBlock}>
                {slide.headline ? (
                  <Text
                    style={[
                      styles.heading,
                      headingStyleFromCss,
                      { textAlign: String(headingAlign).toLowerCase() },
                    ]}
                  >
                    {slide.headline}
                  </Text>
                ) : null}

                {slide.subtext ? (
                  <Text
                    style={[
                      styles.subheading,
                      subheadingStyleFromCss,
                      { textAlign: String(subheadingAlign).toLowerCase() },
                    ]}
                  >
                    {slide.subtext}
                  </Text>
                ) : null}

                {slide.buttonLabel ? (
                  <TouchableOpacity activeOpacity={0.85} style={[styles.button, buttonStyleFromCss]}>
                    <Text style={[styles.buttonText, { color: buttonStyleFromCss?.color || "#FFFFFF" }]}>
                      {slide.buttonLabel}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {slide.image ? (
                <Image
                  source={{ uri: slide.image }}
                  style={[styles.image, { borderRadius: bannerRadius }]}
                  resizeMode={buttonStyleFromCss?.resizeMode || "cover"}
                />
              ) : null}
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      {showDots && slides.length > 1 ? (
        <View style={styles.dotsRow}>
          {slides.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <View
                key={`dot-${idx}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: "#016D77",
                    opacity: isActive ? 1 : 0.35,
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 8,
  },
  slide: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 8,
  },
  heading: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subheading: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#016D77",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  image: {
    width: 140,
    height: 140,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

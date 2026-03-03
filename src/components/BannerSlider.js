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
import { useNavigation } from "@react-navigation/native";
import { convertStyles } from "../utils/convertStyles";

const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties !== undefined) return value.properties;
  }
  return value;
};

/** Recursively unwrap { value: x } and { properties: x } so we get primitives from schema-shaped JSON */
const deepUnwrap = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value, value.value);
  if (value.const !== undefined) return deepUnwrap(value.const, value.const);
  if (Array.isArray(value)) return value.map((v) => deepUnwrap(v, v));
  if (value.properties !== undefined) return deepUnwrap(value.properties, value.properties);
  const out = {};
  for (const key of Object.keys(value)) {
    out[key] = deepUnwrap(value[key], value[key]);
  }
  return out;
};

const asBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = String(resolved).trim().toLowerCase();
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

const parsePaddingRaw = (paddingRaw) => {
  const node = paddingRaw?.properties || paddingRaw || {};
  return {
    paddingTop: asNumber(node.pt, 8),
    paddingBottom: asNumber(node.pb, 8),
    paddingLeft: asNumber(node.pl, 8),
    paddingRight: asNumber(node.pr, 8),
  };
};

/** Build slides from props.slides (schema array) or rawProps.value.items – fully dynamic */
const buildSlides = (rawProps = {}) => {
  const rawPropsValue = deepUnwrap(rawProps.rawProps, {});
  if (typeof rawPropsValue !== "object" || rawPropsValue === null) return [];

  const slidesSchema = rawProps.slides;
  const unwrappedSlides = deepUnwrap(slidesSchema, slidesSchema);

  let candidateArray = [];
  if (Array.isArray(unwrappedSlides)) {
    candidateArray = unwrappedSlides;
  } else if (Array.isArray(slidesSchema?.items)) {
    candidateArray = slidesSchema.items;
  } else if (Array.isArray(slidesSchema)) {
    candidateArray = slidesSchema;
  } else if (Array.isArray(rawPropsValue?.items)) {
    candidateArray = rawPropsValue.items;
  }

  const defaultButtonLabel =
    rawPropsValue?.buttonText ?? rawPropsValue?.buttonLabel ?? "Button";

  return candidateArray
    .map((item, idx) => {
      const raw = item?.properties ?? item;
      const props = typeof raw === "object" && raw !== null ? deepUnwrap(raw, raw) : raw;
      const headline =
        props?.headline ?? props?.title ?? "";
      const subtext =
        props?.subtext ?? props?.subtitle ?? "";
      const image = props?.image ?? "";
      const perSlideLabel = props?.buttonLabel ?? props?.cta;
      const buttonLabel =
        perSlideLabel !== undefined && perSlideLabel !== null && perSlideLabel !== ""
          ? String(perSlideLabel)
          : defaultButtonLabel;
      const buttonHref =
        props?.buttonHref ?? props?.buttonLinkHref ?? props?.href ?? props?.link ?? "";
      const titleStrikethrough = asBoolean(props?.titleStrikethrough, false);
      const subtitleStrikethrough = asBoolean(props?.subtitleStrikethrough, false);
      const buttonStrikethrough = asBoolean(props?.buttonStrikethrough, false);

      if (!headline && !subtext && !image) return null;

      return {
        id: props?.id ?? `slide-${idx + 1}`,
        headline: String(headline),
        subtext: String(subtext),
        image: typeof image === "string" ? image : "",
        buttonLabel: String(buttonLabel),
        buttonHref: typeof buttonHref === "string" ? buttonHref : "",
        titleStrikethrough,
        subtitleStrikethrough,
        buttonStrikethrough,
      };
    })
    .filter(Boolean);
};

export default function BannerSlider({ section }) {
  const navigation = useNavigation();
  const rawProps = useMemo(() => {
    const p =
      section?.props ??
      section?.properties?.props?.properties ??
      section?.properties?.props ??
      {};
    return typeof p === "object" && p !== null ? deepUnwrap(p, p) : p;
  }, [section]);

  const styleNode = rawProps?.style?.properties ?? rawProps?.style ?? {};
  const layoutNode = rawProps?.layout?.properties ?? rawProps?.layout ?? {};
  const layoutCss = layoutNode?.css ?? rawProps?.layout?.css ?? {};
  const behaviorNode = rawProps?.behavior?.properties ?? rawProps?.behavior ?? {};
  const rawPropsValue = rawProps?.rawProps ?? {};

  const slides = useMemo(() => buildSlides(rawProps), [rawProps]);

  const containerStyleFromProps = useMemo(() => {
    const bgColor = unwrapValue(styleNode.bgColor, rawPropsValue?.backgroundColor) || "#FFFFFF";
    const paddingRaw = parsePaddingRaw(styleNode.paddingRaw);
    const paddingStr = unwrapValue(styleNode.padding, "");
    let padding = {
      paddingTop: asNumber(rawPropsValue?.paddingTop, paddingRaw.paddingTop),
      paddingBottom: asNumber(rawPropsValue?.paddingBottom, paddingRaw.paddingBottom),
      paddingLeft: asNumber(rawPropsValue?.paddingLeft, paddingRaw.paddingLeft),
      paddingRight: asNumber(rawPropsValue?.paddingRight, paddingRaw.paddingRight),
    };
    if (typeof paddingStr === "string" && paddingStr.includes("px")) {
      const parts = paddingStr.replace(/px/g, "").trim().split(/\s+/).map(Number);
      if (parts.length >= 4) {
        padding = {
          paddingTop: parts[0] ?? 8,
          paddingRight: parts[1] ?? 8,
          paddingBottom: parts[2] ?? 8,
          paddingLeft: parts[3] ?? 8,
        };
      } else if (parts.length >= 1) {
        const n = parts[0] ?? 8;
        padding = { paddingTop: n, paddingBottom: n, paddingLeft: n, paddingRight: n };
      }
    }
    return {
      backgroundColor: bgColor,
      ...padding,
    };
  }, [styleNode, rawPropsValue]);

  const sliderCfg = layoutCss?.slider || {};
  const headingStyleFromCss = convertStyles(layoutCss?.heading || {});
  const subheadingStyleFromCss = convertStyles(layoutCss?.subheading || {});
  const buttonStyleFromCss = convertStyles(layoutCss?.button || {});
  const containerLayoutCss = convertStyles(layoutCss?.container || {});
  const slideStyleFromCss = convertStyles(layoutCss?.slide || {});
  const imageStyleFromCss = convertStyles(layoutCss?.image || {});
  const dotsStyleFromCss = convertStyles(layoutCss?.dots || {});

  const buttonConfig = useMemo(() => {
    const bg = buttonStyleFromCss?.background ?? buttonStyleFromCss?.backgroundColor ?? rawPropsValue?.buttonBgColor ?? "#016D77";
    const color = buttonStyleFromCss?.color ?? rawPropsValue?.buttonTextColor ?? "#FFFFFF";
    const fontSize = asNumber(rawPropsValue?.buttonFontSize, buttonStyleFromCss?.fontSize ?? 12);
    const fontWeight = String(buttonStyleFromCss?.fontWeight ?? rawPropsValue?.buttonFontWeight ?? "600");
    const borderRadius = asNumber(rawPropsValue?.buttonBorderRadius, buttonStyleFromCss?.borderRadius ?? 999);
    const paddingVertical = asNumber(rawPropsValue?.buttonPaddingVertical, buttonStyleFromCss?.paddingVertical ?? 8);
    const paddingHorizontal = asNumber(rawPropsValue?.buttonPaddingHorizontal, buttonStyleFromCss?.paddingHorizontal ?? 14);
    return {
      containerStyle: {
        ...buttonStyleFromCss,
        backgroundColor: bg,
        borderRadius,
        paddingVertical,
        paddingHorizontal,
        alignSelf: buttonStyleFromCss?.alignSelf ?? rawPropsValue?.buttonAlignSelf ?? "flex-start",
      },
      textStyle: {
        color,
        fontSize,
        fontWeight,
        ...(buttonStyleFromCss?.fontStyle && { fontStyle: buttonStyleFromCss.fontStyle }),
        ...(buttonStyleFromCss?.textDecorationLine && { textDecorationLine: buttonStyleFromCss.textDecorationLine }),
      },
    };
  }, [buttonStyleFromCss, rawPropsValue]);

  const showDots = asBoolean(
    behaviorNode?.showDots ?? behaviorNode?.showIndicators ?? sliderCfg?.showIndicators ?? rawPropsValue?.showIndicators,
    true
  );
  const autoScroll = asBoolean(
    behaviorNode?.autoScroll ?? sliderCfg?.autoScroll ?? rawPropsValue?.autoPlay,
    true
  );
  const showArrows = asBoolean(
    behaviorNode?.showArrows ?? sliderCfg?.showArrows,
    false
  );
  const scrollSpeedSec = asNumber(
    behaviorNode?.scrollSpeedSec ?? behaviorNode?.scrollSpeed ?? sliderCfg?.autoScrollSpeed ?? rawPropsValue?.autoPlayDelay / 1000,
    4
  );
  const bannerHeight = asNumber(
    sliderCfg?.bannerHeight ?? rawPropsValue?.imageHeight,
    180
  );
  const bannerRadius = asNumber(
    sliderCfg?.bannerRadius ?? rawPropsValue?.imageBorderRadius,
    12
  );
  const imageResizeMode = imageStyleFromCss?.resizeMode || sliderCfg?.scale === "Fill" ? "stretch" : (sliderCfg?.scale === "Contain" ? "contain" : "cover");
  const headingAlign = unwrapValue(
    layoutCss?.heading?.align ?? rawPropsValue?.headingAlign ?? sliderCfg?.headingAlign,
    "Center"
  );
  const subheadingAlign = unwrapValue(
    layoutCss?.subheading?.align ?? rawPropsValue?.subheadingAlign ?? sliderCfg?.subheadingAlign,
    "Center"
  );
  const containerAlign = String(unwrapValue(styleNode?.align, "Center")).toLowerCase();

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
    const delayMs = Math.max(asNumber(rawPropsValue?.autoPlayDelay, scrollSpeedSec * 1000), 1000);
    const interval = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % slides.length;
      const xOffset = nextIndex * containerWidth;
      scrollRef.current?.scrollTo({ x: xOffset, animated: true });
      indexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }, delayMs);
    return () => clearInterval(interval);
  }, [autoScroll, slides.length, containerWidth, scrollSpeedSec, rawPropsValue?.autoPlayDelay]);

  const handleScroll = (event) => {
    const xOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(xOffset / Math.max(containerWidth, 1));
    if (index !== currentIndex) {
      indexRef.current = index;
      setCurrentIndex(index);0
    }
  };

  const onSlideButtonPress = (slide) => {
    const href = slide?.buttonHref || "";
    if (!href) return;
    if (href.startsWith("/") || href.startsWith("http")) {
      navigation.navigate("LayoutScreen", { pageName: href.replace(/^\//, "") });
    }
  };

  if (!slides.length) return null;

  const alignMap = { left: "flex-start", center: "center", right: "flex-end" };
  const containerAlignStyle = alignMap[containerAlign] || "center";

  return (
    <View
      style={[
        styles.container,
        containerStyleFromProps,
        containerLayoutCss,
        { alignItems: containerAlign === "center" ? "center" : undefined, marginTop: 0, marginBottom: 0 },
      ]}
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
        style={styles.scrollView}
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
                  backgroundColor: slideStyleFromCss?.backgroundColor ?? rawPropsValue?.backgroundColor ?? "#CFFAFE",
                },
              ]}
            >
              {slide.image ? (
                <Image
                  source={{ uri: slide.image }}
                  style={[
                    styles.imageBackground,
                    imageStyleFromCss,
                    { borderRadius: bannerRadius },
                  ]}
                  resizeMode={imageResizeMode}
                />
              ) : null}

              <View style={styles.textBlock}>
                {slide.headline ? (
                  <Text
                    style={[
                      styles.heading,
                      headingStyleFromCss,
                      { textAlign: String(headingAlign).toLowerCase() },
                      slide.titleStrikethrough && styles.strikethrough,
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
                      slide.subtitleStrikethrough && styles.strikethrough,
                    ]}
                  >
                    {slide.subtext}
                  </Text>
                ) : null}

                {slide.buttonLabel && asBoolean(rawPropsValue?.showButton, true) ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.button, buttonConfig.containerStyle]}
                    onPress={() => onSlideButtonPress(slide)}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        buttonConfig.textStyle,
                        slide.buttonStrikethrough && styles.strikethrough,
                      ]}
                    >
                      {slide.buttonLabel}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </Animated.ScrollView>

      {showDots && slides.length > 1 ? (
        <View style={[styles.dotsRow, dotsStyleFromCss]}>
          {slides.map((_, idx) => {
            const isActive = idx === currentIndex;
            return (
              <View
                key={`dot-${idx}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: dotsStyleFromCss?.backgroundColor ?? "#016D77",
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
    paddingVertical: 0,
    paddingHorizontal: 8,
    marginTop: 0,
    marginBottom: 0,
  },
  scrollView: {
    flexGrow: 0,
  },
  slide: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  textBlock: {
    flex: 1,
    gap: 6,
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
  button: {},
  buttonText: {},
  strikethrough: {
    textDecorationLine: "line-through",
  },
  imageBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

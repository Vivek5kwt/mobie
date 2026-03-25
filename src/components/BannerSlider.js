import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

// ─── DSL helpers ────────────────────────────────────────────────────────────

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
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const l = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(l)) return true;
    if (["false", "0", "no", "n"].includes(l)) return false;
  }
  if (typeof value === "number") return value !== 0;
  return fallback;
};

const asNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return value;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const parseFontWeight = (value, fallback = "700") => {
  if (!value) return fallback;
  if (typeof value === "number") return String(value);
  const l = String(value).toLowerCase();
  if (l === "bold") return "700";
  if (l === "semi bold" || l === "semibold" || l === "600") return "600";
  if (l === "medium" || l === "500") return "500";
  if (l === "regular" || l === "normal" || l === "400") return "400";
  return String(value);
};

// ─── Slide builder ───────────────────────────────────────────────────────────

const buildSlides = (rawProps = {}, defaultButtonLabel = "Shop Now") => {
  // Try props.slides (schema array) first, then rawProps.items
  const slidesSchema = rawProps?.slides;
  let candidateArray = [];

  if (Array.isArray(slidesSchema)) {
    candidateArray = slidesSchema;
  } else if (Array.isArray(slidesSchema?.items)) {
    candidateArray = slidesSchema.items;
  } else if (Array.isArray(rawProps?.rawProps?.items)) {
    candidateArray = rawProps.rawProps.items;
  }

  return candidateArray
    .map((item, idx) => {
      const raw = item?.properties ?? item;
      const props = typeof raw === "object" ? deepUnwrap(raw, raw) : {};
      const headline = props?.headline ?? props?.title ?? "";
      const subtext = props?.subtext ?? props?.subtitle ?? "";
      const image = typeof props?.image === "string" ? props.image : "";
      const btnLabel = props?.buttonLabel ?? props?.cta;
      const buttonLabel =
        btnLabel !== undefined && btnLabel !== null && btnLabel !== ""
          ? String(btnLabel)
          : defaultButtonLabel;
      const buttonHref = props?.buttonHref ?? props?.href ?? props?.link ?? "";
      const titleStrikethrough = asBoolean(props?.titleStrikethrough, false);
      const subtitleStrikethrough = asBoolean(props?.subtitleStrikethrough, false);
      const buttonStrikethrough = asBoolean(props?.buttonStrikethrough, false);

      if (!headline && !subtext && !image) return null;
      return {
        id: props?.id ?? `slide-${idx + 1}`,
        headline: String(headline),
        subtext: String(subtext),
        image,
        buttonLabel: String(buttonLabel),
        buttonHref: typeof buttonHref === "string" ? buttonHref : "",
        titleStrikethrough,
        subtitleStrikethrough,
        buttonStrikethrough,
      };
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BannerSlider({ section }) {
  const navigation = useNavigation();

  // Unwrap the full props object
  const rawProps = useMemo(() => {
    const p =
      section?.props ??
      section?.properties?.props?.properties ??
      section?.properties?.props ??
      {};
    return typeof p === "object" && p !== null ? deepUnwrap(p, p) : p;
  }, [section]);

  // The flat rawProps.value object from DSL — primary source of truth for all styling
  const rp = rawProps?.rawProps ?? {};

  const slides = useMemo(
    () => buildSlides(rawProps, rp?.buttonText ?? rp?.buttonLabel ?? "Shop Now"),
    [rawProps, rp?.buttonText, rp?.buttonLabel]
  );

  // ── Container ──
  const bgColor = rp?.bgColor || "#8fd0d6";
  const bannerHeight = asNumber(rp?.bannerHeight, 180);
  const bannerRadius = asNumber(rp?.bannerRadius, 0);

  // Padding inside each slide
  const slidePt = asNumber(rp?.pt, 40);
  const slidePb = asNumber(rp?.pb, 40);
  const slidePl = asNumber(rp?.pl, 16);
  const slidePr = asNumber(rp?.pr, 16);

  // ── Slider behavior ──
  const autoScroll = asBoolean(rp?.autoScroll ?? rp?.autoPlay, true);
  const autoScrollSpeed = asNumber(rp?.autoScrollSpeed ?? rp?.scrollSpeedSec, 4);
  const showDots = asBoolean(rp?.showIndicators ?? rp?.showDots, true);

  // ── Heading ──
  const headingColor = rp?.headingColor || "#FFFFFF";
  const headingSize = asNumber(rp?.headingSize, 16);
  const headingAlign = (rp?.headingAlign || "center").toLowerCase();
  const headingWeight = parseFontWeight(rp?.headingWeight, "700");
  const headingItalic = asBoolean(rp?.headingItalic, false);
  const headingUnderline = asBoolean(rp?.headingUnderline, false);

  // ── Subheading ──
  const subheadingColor = rp?.subheadingColor || "#E5E7EB";
  const subheadingSize = asNumber(rp?.subheadingSize, 12);
  const subheadingAlign = (rp?.subheadingAlign || "center").toLowerCase();
  const subheadingWeight = parseFontWeight(rp?.subheadingWeight, "400");

  // ── Button ──
  const showButton = asBoolean(rp?.showButton, true);
  const buttonBgColor = rp?.buttonBgColor || "#016D77";
  const buttonTextColor = rp?.buttonTextColor || "#FFFFFF";
  const buttonFontSize = asNumber(rp?.buttonFontSize, 11);
  const buttonFontWeight = parseFontWeight(rp?.buttonWeight ?? rp?.buttonFontWeight, "600");
  const buttonRadius = asNumber(rp?.buttonRadius ?? rp?.buttonBorderRadius, 999);
  const buttonPt = asNumber(rp?.buttonPt, 8);
  const buttonPb = asNumber(rp?.buttonPb, 8);
  const buttonPl = asNumber(rp?.buttonPl, 16);
  const buttonPr = asNumber(rp?.buttonPr, 16);
  const buttonAlignSelf =
    (rp?.buttonAlign || "center").toLowerCase() === "right"
      ? "flex-end"
      : (rp?.buttonAlign || "center").toLowerCase() === "left"
      ? "flex-start"
      : "center";

  // ── Indicators ──
  const indicatorSize = asNumber(rp?.indicatorSize, 7);
  const indicatorColor = rp?.indicatorColor || "rgba(1,109,119,0.35)";
  const indicatorSelectedColor = rp?.indicatorSelectedColor || "#FFFFFF";

  // ── Scroll state ──
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(Dimensions.get("window").width);

  useEffect(() => {
    indexRef.current = 0;
    setCurrentIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [slides.length]);

  useEffect(() => {
    if (!autoScroll || slides.length <= 1 || !containerWidth) return undefined;
    const intervalMs = Math.max(autoScrollSpeed, 1) * 1000;
    const interval = setInterval(() => {
      const nextIndex = (indexRef.current + 1) % slides.length;
      scrollRef.current?.scrollTo({ x: nextIndex * containerWidth, animated: true });
      indexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [autoScroll, slides.length, containerWidth, autoScrollSpeed]);

  const handleScroll = (event) => {
    const xOffset = event?.nativeEvent?.contentOffset?.x || 0;
    const index = Math.round(xOffset / Math.max(containerWidth, 1));
    if (index !== currentIndex) {
      indexRef.current = index;
      setCurrentIndex(index);
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

  return (
    <View
      style={[styles.wrapper, { backgroundColor: bgColor }]}
      onLayout={(e) => {
        const w = e?.nativeEvent?.layout?.width;
        if (w && w > 0) setContainerWidth(w);
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false, listener: handleScroll }
        )}
        style={styles.scrollView}
      >
        {slides.map((slide, idx) => (
          <View
            key={slide.id || idx}
            style={{
              width: containerWidth,
              minHeight: bannerHeight,
              borderRadius: bannerRadius,
              overflow: "hidden",
            }}
          >
            {/* Background image */}
            {slide.image ? (
              <Image
                source={{ uri: slide.image }}
                style={[StyleSheet.absoluteFill, { borderRadius: bannerRadius }]}
                resizeMode="cover"
              />
            ) : null}

            {/* Slide content — column, centered */}
            <View
              style={[
                styles.slideContent,
                {
                  paddingTop: slidePt,
                  paddingBottom: slidePb,
                  paddingLeft: slidePl,
                  paddingRight: slidePr,
                  minHeight: bannerHeight,
                },
              ]}
            >
              {slide.headline ? (
                <Text
                  style={[
                    styles.heading,
                    {
                      color: headingColor,
                      fontSize: headingSize,
                      fontWeight: headingWeight,
                      textAlign: headingAlign,
                      fontStyle: headingItalic ? "italic" : "normal",
                      textDecorationLine: headingUnderline ? "underline" : "none",
                    },
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
                    {
                      color: subheadingColor,
                      fontSize: subheadingSize,
                      fontWeight: subheadingWeight,
                      textAlign: subheadingAlign,
                    },
                    slide.subtitleStrikethrough && styles.strikethrough,
                  ]}
                >
                  {slide.subtext}
                </Text>
              ) : null}

              {slide.buttonLabel && showButton ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.button,
                    {
                      backgroundColor: buttonBgColor,
                      borderRadius: buttonRadius,
                      paddingTop: buttonPt,
                      paddingBottom: buttonPb,
                      paddingLeft: buttonPl,
                      paddingRight: buttonPr,
                      alignSelf: buttonAlignSelf,
                    },
                  ]}
                  onPress={() => onSlideButtonPress(slide)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      {
                        color: buttonTextColor,
                        fontSize: buttonFontSize,
                        fontWeight: buttonFontWeight,
                      },
                      slide.buttonStrikethrough && styles.strikethrough,
                    ]}
                  >
                    {slide.buttonLabel}
                  </Text>
                </TouchableOpacity>
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
                style={{
                  width: indicatorSize,
                  height: indicatorSize,
                  borderRadius: indicatorSize / 2,
                  backgroundColor: isActive ? indicatorSelectedColor : indicatorColor,
                  marginHorizontal: 3,
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
  scrollView: {
    flexGrow: 0,
  },
  slideContent: {
    justifyContent: "center",
    alignItems: "stretch",
    gap: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  subheading: {
    fontSize: 12,
    color: "#E5E7EB",
    lineHeight: 18,
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
});

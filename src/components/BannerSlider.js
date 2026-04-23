import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveTextDecorationLine } from "../utils/textDecoration";

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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseAspectRatio = (value) => {
  if (value === undefined || value === null) return undefined;
  const ratio = String(value).trim().toLowerCase();
  if (!ratio || ratio === "auto") return undefined;
  if (ratio.includes(":")) {
    const [w, h] = ratio.split(":").map((part) => parseFloat(part));
    if (w > 0 && h > 0) return w / h;
  }
  const parsed = parseFloat(ratio);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
      const titleUnderline = asBoolean(props?.titleUnderline, false);
      const titleStrikethrough = asBoolean(props?.titleStrikethrough, false);
      const subtitleUnderline = asBoolean(props?.subtitleUnderline, false);
      const subtitleStrikethrough = asBoolean(props?.subtitleStrikethrough, false);
      const buttonUnderline = asBoolean(props?.buttonUnderline, false);
      const buttonStrikethrough = asBoolean(props?.buttonStrikethrough, false);

      if (!headline && !subtext && !image) return null;
      return {
        id: props?.id ?? `slide-${idx + 1}`,
        headline: String(headline),
        subtext: String(subtext),
        image,
        buttonLabel: String(buttonLabel),
        buttonHref: typeof buttonHref === "string" ? buttonHref : "",
        titleUnderline,
        titleStrikethrough,
        titleDecorationLine: resolveTextDecorationLine({
          underline: titleUnderline,
          strikethrough: titleStrikethrough,
        }),
        subtitleUnderline,
        subtitleStrikethrough,
        subtitleDecorationLine: resolveTextDecorationLine({
          underline: subtitleUnderline,
          strikethrough: subtitleStrikethrough,
        }),
        buttonUnderline,
        buttonStrikethrough,
        buttonDecorationLine: resolveTextDecorationLine({
          underline: buttonUnderline,
          strikethrough: buttonStrikethrough,
        }),
      };
    })
    .filter(Boolean);
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BannerSlider({ section }) {
  const navigation = useNavigation();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

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

  // CSS snapshot (from layout.css) — secondary source for style tokens
  const layoutCss = rawProps?.layout?.css ?? {};

  // ── Container ──
  const styleProp = rawProps?.style || {};
  const bgColor = rp?.bgColor || styleProp?.bgColor || "transparent";
  const requestedBannerHeight = asNumber(
    rp?.bannerHeight ?? layoutCss?.slider?.bannerHeight ?? styleProp?.height,
    undefined
  );
  const bannerRatio = parseAspectRatio(
    rp?.ratio ?? layoutCss?.slider?.ratio ?? styleProp?.ratio
  );
  const bannerRadius = asNumber(rp?.bannerRadius ?? rp?.imageCorner ?? layoutCss?.slider?.bannerRadius, 0);

  const paddingRaw = styleProp?.paddingRaw || {};
  const outerMt = 0;
  const outerMb = 0;
  // Horizontal padding from DSL becomes text-content inner padding (not frame).
  const outerPl = asNumber(rp?.pl ?? paddingRaw?.pl, 0);
  const outerPr = asNumber(rp?.pr ?? paddingRaw?.pr, 0);

  // Slide content padding (text area inside the banner).
  // boxPl/boxPr/boxPt/boxPb take priority; fall back to DSL outer h-padding.
  const slidePl = asNumber(rp?.boxPl, outerPl || 16);
  const slidePr = asNumber(rp?.boxPr, outerPr || 16);
  const slidePt = asNumber(rp?.boxPt, 16);
  const slidePb = asNumber(rp?.boxPb, 16);

  // Overlay on image
  const overlayColor = rp?.overlayColor || "rgba(0,0,0,0)";
  const imageActive = asBoolean(rp?.imageActive, true);
  const textActive  = asBoolean(rp?.textActive, true);

  // ── Slider behavior ──
  const autoScroll = asBoolean(rp?.autoScroll ?? rp?.autoPlay, true);
  const autoScrollSpeed = asNumber(rp?.autoScrollSpeed ?? rp?.scrollSpeedSec, 4);
  const showDots = asBoolean(rp?.showIndicators ?? rp?.showDots, true);

  // ── Heading ──
  const headingColor  = rp?.headingColor  || layoutCss?.heading?.color  || "#FFFFFF";
  const headingSize   = asNumber(rp?.headingSize ?? layoutCss?.heading?.fontSize, 18);
  // textAlign is the correct CSS property name; also support legacy "align" key
  const headingAlignRaw = (
    rp?.headingAlign ||
    layoutCss?.heading?.textAlign ||
    layoutCss?.heading?.["text-align"] ||
    layoutCss?.heading?.align ||
    "left"
  ).toLowerCase();
  const headingAlign  = headingAlignRaw;
  const headingWeight = parseFontWeight(rp?.headingWeight ?? layoutCss?.heading?.fontWeight, "700");
  const headingItalic = asBoolean(rp?.headingItalic, false);
  const headingUnderline = asBoolean(rp?.headingUnderline, false);
  const headingStrikethrough = asBoolean(rp?.headingStrikethrough, false);
  const headingTransform = (layoutCss?.heading?.textTransform || "none").toLowerCase();
  const headingLetterSpacing = asNumber(layoutCss?.heading?.letterSpacing, 0);
  const headingDecorationLine = resolveTextDecorationLine({
    underline: headingUnderline,
    strikethrough: headingStrikethrough,
  });

  // ── Subheading ──
  const subheadingColor  = rp?.subheadingColor  || layoutCss?.subheading?.color  || "#E5E7EB";
  const subheadingSize   = asNumber(rp?.subheadingSize ?? layoutCss?.subheading?.fontSize, 13);
  const subheadingAlign  = (
    rp?.subheadingAlign ||
    layoutCss?.subheading?.textAlign ||
    layoutCss?.subheading?.["text-align"] ||
    layoutCss?.subheading?.align ||
    headingAlignRaw   // inherit from heading direction
  ).toLowerCase();
  const subheadingWeight = parseFontWeight(rp?.subheadingWeight ?? layoutCss?.subheading?.fontWeight, "400");

  // ── Content container alignment (flex-start for left, center, flex-end for right) ──
  const contentAlignItems =
    headingAlign === "right" ? "flex-end"
    : headingAlign === "center" ? "center"
    : "flex-start";

  // ── Button ──
  const showButton = asBoolean(rp?.showButton, true);
  const buttonBgColor =
    rp?.buttonBgColor ||
    layoutCss?.button?.background ||
    layoutCss?.button?.backgroundColor ||
    "#111111";
  const buttonTextColor =
    rp?.buttonTextColor || layoutCss?.button?.color || "#FFFFFF";
  const buttonFontSize = asNumber(
    rp?.buttonFontSize ?? layoutCss?.button?.fontSize,
    12
  );
  const buttonFontWeight = parseFontWeight(
    rp?.buttonWeight ?? rp?.buttonFontWeight ?? layoutCss?.button?.fontWeight,
    "600"
  );
  const buttonRadius = asNumber(
    rp?.buttonRadius ?? rp?.buttonBorderRadius ?? layoutCss?.button?.borderRadius,
    999
  );
  const buttonPt = asNumber(rp?.buttonPt, 8);
  const buttonPb = asNumber(rp?.buttonPb, 8);
  const buttonPl = asNumber(rp?.buttonPl, 16);
  const buttonPr = asNumber(rp?.buttonPr, 16);
  // Button aligns to match heading direction by default; DSL buttonAlign overrides
  const rawButtonAlign = (rp?.buttonAlign || headingAlignRaw || "left").toLowerCase();
  const buttonAlignSelf =
    rawButtonAlign === "right" ? "flex-end"
    : rawButtonAlign === "center" ? "center"
    : "flex-start";
  const rawButtonIcon = (
    rp?.iconType ||
    rp?.iconName ||
    rp?.buttonIcon ||
    rp?.icon ||
    ""
  );
  const buttonIconName = resolveFA4IconName(rawButtonIcon);
  const showButtonIcon = asBoolean(rp?.iconActive ?? rp?.showIcon, true) && !!buttonIconName;
  const buttonIconPosition = toString(rp?.iconAlign ?? rp?.iconPosition, "left").toLowerCase();
  const buttonIconSize = asNumber(rp?.iconSize, 14);
  const buttonIconColor = rp?.iconColor || buttonTextColor;
  const buttonIconGap = asNumber(rp?.iconGap ?? rp?.buttonIconGap, 6);
  const [containerWidth, setContainerWidth] = useState(Math.max(windowWidth, 1));

  const bannerHeight = useMemo(() => {
    const availableWidth = Math.max(containerWidth || windowWidth || 1, 1);
    const textWidth = Math.max(availableWidth - slidePl - slidePr, 1);

    const estimateSlideHeight = (slide) => {
      const headlineText = String(slide?.headline || "").trim();
      const subtextText = String(slide?.subtext || "").trim();
      const showSlideButton = showButton && !!slide?.buttonLabel;

      const headlineLines = headlineText
        ? Math.max(1, Math.ceil((headlineText.length * headingSize * 0.55) / textWidth))
        : 0;
      const subheadingLines = subtextText
        ? Math.max(1, Math.ceil((subtextText.length * subheadingSize * 0.5) / textWidth))
        : 0;

      const headlineBlock = headlineLines ? headlineLines * headingSize * 1.25 : 0;
      const subheadingBlock = subheadingLines ? subheadingLines * subheadingSize * 1.4 : 0;
      const buttonBlock = showSlideButton ? buttonFontSize * 1.8 + buttonPt + buttonPb + 8 : 0;
      const gapCount = [headlineBlock, subheadingBlock, buttonBlock].filter(Boolean).length;
      const gapSpace = gapCount > 1 ? (gapCount - 1) * 8 : 0;

      return slidePt + slidePb + headlineBlock + subheadingBlock + buttonBlock + gapSpace + 24;
    };

    const estimatedContentHeight = slides.reduce(
      (maxHeight, slide) => Math.max(maxHeight, estimateSlideHeight(slide)),
      0
    );
    const responsiveHeight = bannerRatio
      ? Math.round(availableWidth / bannerRatio)
      : Math.round(availableWidth * 0.52);

    const fallbackHeight = Math.max(estimatedContentHeight, responsiveHeight, 160);
    const maxMobileHeight = Math.max(180, Math.round((windowHeight || 0) * 0.4));

    return clamp(
      requestedBannerHeight ?? fallbackHeight,
      160,
      maxMobileHeight
    );
  }, [
    bannerRatio,
    buttonFontSize,
    buttonPb,
    buttonPt,
    containerWidth,
    requestedBannerHeight,
    showButton,
    slidePb,
    slidePl,
    slidePt,
    slides,
    subheadingSize,
    headingSize,
    windowHeight,
    windowWidth,
  ]);

  // ── Indicators ──
  const indicatorSize = asNumber(rp?.indicatorSize, 7);
  const indicatorColor = rp?.indicatorColor || "rgba(1,109,119,0.35)";
  const indicatorSelectedColor = rp?.indicatorSelectedColor || "#FFFFFF";
  // "inside" = dots overlaid at the bottom of the banner image; "bottom" = below the banner
  const indicatorPosition = (
    rp?.indicatorPosition ||
    layoutCss?.slider?.indicatorPosition ||
    "bottom"
  ).toLowerCase();
  const indicatorsInside =
    indicatorPosition === "inside" || indicatorPosition === "inside-bottom";

  // ── Scroll state ──
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
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
      style={[
        styles.wrapper,
        {
          marginTop: outerMt,
          marginBottom: outerMb,
          backgroundColor: bgColor || "transparent",
          minHeight: bannerHeight,
        },
      ]}
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
        style={[styles.scrollView, { height: bannerHeight }]}
      >
        {slides.map((slide, idx) => {
          const trimmedSubtext = slide.subtext ? slide.subtext.trim() : "";
          return (
          <View
            key={slide.id || idx}
            style={{
              width: containerWidth,
              height: bannerHeight,
              borderRadius: bannerRadius,
              overflow: "hidden",
              backgroundColor: bgColor || "transparent",
            }}
          >
            {/* Background image */}
            {imageActive && slide.image ? (
              <Image
                source={{ uri: slide.image }}
                style={[StyleSheet.absoluteFill, { borderRadius: bannerRadius }]}
                resizeMode="cover"
              />
            ) : null}

            {/* Dark overlay */}
            {overlayColor && overlayColor !== "rgba(0,0,0,0)" && overlayColor !== "transparent" ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: overlayColor, borderRadius: bannerRadius },
                ]}
              />
            ) : null}

            {/* Slide content */}
            {textActive ? (
            <View
              style={[
                styles.slideContent,
                {
                  flex: 1,
                  paddingTop: slidePt,
                  paddingBottom: slidePb,
                  paddingLeft: slidePl,
                  paddingRight: slidePr,
                  alignItems: contentAlignItems,
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
                      lineHeight: Math.round(headingSize * 1.25),
                      fontWeight: headingWeight,
                      textAlign: headingAlign,
                      fontStyle: headingItalic ? "italic" : "normal",
                      textDecorationLine: headingDecorationLine,
                      textTransform: headingTransform !== "none" ? headingTransform : undefined,
                      letterSpacing: headingLetterSpacing || undefined,
                      width: "100%",
                    },
                    { textDecorationLine: slide.titleDecorationLine },
                  ]}
                >
                  {slide.headline}
                </Text>
              ) : null}

              {trimmedSubtext ? (
                <Text
                  style={[
                    styles.subheading,
                    {
                      color: subheadingColor,
                      fontSize: subheadingSize,
                      lineHeight: Math.round(subheadingSize * 1.4),
                      fontWeight: subheadingWeight,
                      textAlign: subheadingAlign,
                      width: "100%",
                    },
                    { textDecorationLine: slide.subtitleDecorationLine },
                  ]}
                >
                  {trimmedSubtext}
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
                  <View
                    style={styles.buttonInner}
                  >
                    {showButtonIcon && buttonIconPosition !== "right" ? (
                      <FontAwesome
                        name={buttonIconName}
                        size={buttonIconSize}
                        color={buttonIconColor}
                        style={{ marginRight: buttonIconGap }}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.buttonText,
                        {
                          color: buttonTextColor,
                          fontSize: buttonFontSize,
                          fontWeight: buttonFontWeight,
                        },
                        { textDecorationLine: slide.buttonDecorationLine },
                      ]}
                    >
                      {slide.buttonLabel}
                    </Text>
                    {showButtonIcon && buttonIconPosition === "right" ? (
                      <FontAwesome
                        name={buttonIconName}
                        size={buttonIconSize}
                        color={buttonIconColor}
                        style={{ marginLeft: buttonIconGap }}
                      />
                    ) : null}
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
            ) : null}

            {/* Dots overlaid inside the banner (indicatorPosition: "inside") */}
            {indicatorsInside && showDots && slides.length > 1 ? (
              <View style={styles.dotsInside}>
                {slides.map((_, dotIdx) => {
                  const isActive = dotIdx === currentIndex;
                  return (
                    <View
                      key={`dot-in-${dotIdx}`}
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
        })}
      </Animated.ScrollView>

      {/* Dots below the banner (indicatorPosition: "bottom" or default) */}
      {!indicatorsInside && showDots && slides.length > 1 ? (
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
    // No overflow:hidden here — bgColor must paint in padding areas.
    // Each slide clips itself via overflow:hidden + borderRadius.
  },
  scrollView: {
    flexGrow: 0,
  },
  slideContent: {
    justifyContent: "center",
    gap: 8,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  subheading: {
    fontSize: 12,
    color: "#E5E7EB",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
  // Dots overlaid at the bottom-center of the banner image
  dotsInside: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

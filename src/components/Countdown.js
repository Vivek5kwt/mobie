import React, { PureComponent } from "react";
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles, extractGradientInfo } from "../utils/convertStyles";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties?.value !== undefined) return value.properties.value;
  }
  return value;
};

const asBoolean = (value, fallback = true) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") {
    const lowered = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(lowered)) return true;
    if (["false", "0", "no", "n"].includes(lowered)) return false;
  }
  if (typeof resolved === "number") return resolved !== 0;
  return fallback;
};

const asNumber = (value, fallback = undefined) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const applyTextAttributes = (baseStyle, attributes) => {
  const attrs = attributes || {};
  const next = { ...(baseStyle || {}) };

  const size = asNumber(attrs.size, undefined);
  if (size != null) next.fontSize = size;

  const color = unwrapValue(attrs.color, undefined);
  if (color) next.color = color;

  const bold = asBoolean(attrs.bold, undefined);
  if (bold === true) next.fontWeight = "700";

  const italic = asBoolean(attrs.italic, undefined);
  if (italic === true) next.fontStyle = "italic";

  const underline = asBoolean(attrs.underline, undefined);
  const strikethrough = asBoolean(attrs.strikethrough, undefined);
  if (underline || strikethrough) {
    if (underline && strikethrough) {
      next.textDecorationLine = "underline line-through";
    } else if (underline) {
      next.textDecorationLine = "underline";
    } else {
      next.textDecorationLine = "line-through";
    }
  }

  const fontFamily = unwrapValue(attrs.fontFamily, undefined);
  if (fontFamily) next.fontFamily = fontFamily;

  return next;
};

const parseDateValue = (value) => {
  const raw = unwrapValue(value, null);

  if (!raw) return null;

  const normalize = (input) => {
    if (typeof input === "number") {
      return input < 1e12 ? input * 1000 : input;
    }

    if (typeof input === "string") {
      const trimmed = input.trim();
      const asNumberValue = Number(trimmed);

      if (!Number.isNaN(asNumberValue)) {
        return asNumberValue < 1e12 ? asNumberValue * 1000 : asNumberValue;
      }

      return trimmed;
    }

    return input;
  };

  const parsed = new Date(normalize(raw));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildCountdown = (endTime, startTime) => {
  if (!endTime) return null;

  const now = Date.now();
  const baseline = startTime?.getTime?.() || now;
  const diff = Math.max(0, endTime.getTime() - now);

  // If a future start time is configured, keep showing the time until start
  // instead of freezing the countdown. This prevents the timer from looking
  // stuck when the start time is later than "now".
  const effectiveDiff = Math.max(diff, baseline - now);

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, remainingMs: effectiveDiff };
};

// Deep-unwrap DSL envelope (value / const wrappers)
const deepUnwrap = (v) => {
  if (v === undefined || v === null) return v;
  if (typeof v !== "object") return v;
  if (v.value !== undefined) return deepUnwrap(v.value);
  if (v.const !== undefined) return deepUnwrap(v.const);
  return v;
};

// Merge the .raw sub-object into root so DSL data is reachable at top-level
const getRawProps = (section) => {
  const root =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const raw = deepUnwrap(root?.raw);
  return (raw && typeof raw === "object") ? { ...root, ...raw } : root;
};

// Read CSS from both 'layout' and 'presentation' — App Builder may use either.
// Return merged per-slot objects so every caller gets the right CSS block.
const getLayoutCss = (rawProps) => {
  const fromLayout = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const presUnwrapped = deepUnwrap(rawProps?.presentation) || {};
  const fromPres = presUnwrapped?.properties?.css || presUnwrapped?.css || {};
  const fromCss   = deepUnwrap(rawProps?.css) || {};
  const merge = (key) => ({
    ...(fromLayout[key] || {}),
    ...(fromPres[key]    || {}),
    ...(fromCss[key]     || {}),
  });
  return {
    container: merge("container"),
    timer:     merge("timer"),
    title:     merge("title"),
    subtext:   merge("subtext"),
    button:    merge("button"),
    icon:      merge("icon"),
    // Top-level bg from any source
    _bgRaw:
      fromCss.backgroundColor   || fromCss.background   ||
      fromPres.backgroundColor  || fromPres.background  ||
      fromLayout.backgroundColor|| fromLayout.background||
      null,
  };
};

const deriveContainerStyles = (layoutCss, styleBlock) => {
  // Resolve any DSL-wrapped { type, value } objects in styleBlock before converting.
  // Without this, convertStyles sets containerStyle.backgroundColor to the raw wrapper
  // object instead of the color string, which React Native ignores (shows white).
  const resolvedBlock = {};
  for (const k of Object.keys(styleBlock || {})) {
    const v = unwrapValue(styleBlock[k], undefined);
    if (v !== undefined && v !== null && typeof v !== "object") {
      resolvedBlock[k] = v;
    }
  }
  const converted = convertStyles({ ...(layoutCss.container || {}), ...resolvedBlock });
  const { _gradient, ...rest } = converted;
  return { containerStyle: rest, gradientInfo: extractGradientInfo(converted) };
};

const parseTiming = (rawProps, fallbackStartTime = null) => {
  const timerAttributes = rawProps?.timerAttributes?.properties || rawProps?.timerAttributes || {};
  const timingBlock = rawProps?.timing?.properties || rawProps?.timing || {};

  const parsedEndTime = parseDateValue(
    rawProps?.endTime ??
      rawProps?.end_date ??
      timerAttributes?.endTime ??
      timerAttributes?.end_time ??
      timerAttributes?.end_date ??
      timingBlock?.endTime ??
      timingBlock?.end_time ??
      timingBlock?.end_date
  );

  const parsedStartTime =
    parseDateValue(
      rawProps?.startTime ??
        rawProps?.start_time ??
        rawProps?.startDate ??
        rawProps?.start_date ??
        timerAttributes?.startTime ??
        timerAttributes?.start_time ??
        timerAttributes?.startDate ??
        timerAttributes?.start_date ??
        timingBlock?.startTime ??
        timingBlock?.start_time ??
        timingBlock?.startDate ??
        timingBlock?.start_date
    ) || fallbackStartTime;

  return {
    endTime: parsedEndTime,
    startTime: parsedStartTime,
  };
};

const isSameTime = (a, b) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
};

class Countdown extends PureComponent {
  constructor(props) {
    super(props);

    const rawProps = getRawProps(props.section);
    const { endTime, startTime } = parseTiming(rawProps, new Date());

    this.state = {
      endTime,
      startTime,
      countdown: buildCountdown(endTime, startTime),
    };

    this.intervalId = null;
  }

  componentDidMount() {
    this.setupTimer();
  }

  componentDidUpdate(prevProps, prevState) {
    const rawProps = getRawProps(this.props.section);
    const { endTime, startTime } = parseTiming(rawProps, this.state.startTime || new Date());

    if (!isSameTime(endTime, prevState.endTime) || !isSameTime(startTime, prevState.startTime)) {
      this.updateTiming(endTime, startTime);
    }
  }

  componentWillUnmount() {
    this.clearTimer();
  }

  updateTiming(endTime, startTime) {
    this.clearTimer();

    this.setState(
      {
        endTime,
        startTime,
        countdown: buildCountdown(endTime, startTime),
      },
      () => this.setupTimer()
    );
  }

  setupTimer() {
    const { endTime, startTime } = this.state;

    if (!endTime) return;

    this.intervalId = setInterval(() => {
      const nextCountdown = buildCountdown(endTime, startTime);

      if (!nextCountdown || nextCountdown.remainingMs === 0) {
        this.clearTimer();
      }

      this.setState({ countdown: nextCountdown });
    }, 1000);
  }

  clearTimer() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  render() {
    const { countdown } = this.state;
    const rawProps = getRawProps(this.props.section);

    const layoutCss = getLayoutCss(rawProps);
    // deepUnwrap styleBlock so wrapped DSL values are resolved
    const styleBlock = deepUnwrap(rawProps?.style?.properties ?? rawProps?.style) || {};

    const { containerStyle, gradientInfo } = deriveContainerStyles(layoutCss, styleBlock);

    const alignmentAndPadding =
      rawProps?.alignmentAndPadding?.properties || rawProps?.alignmentAndPadding || {};
    const paddingRaw =
      alignmentAndPadding?.paddingRaw?.properties || alignmentAndPadding?.paddingRaw || {};

    // Container background — check every possible DSL source in priority order:
    // 1. Explicit scalar props (bgColor / backgroundColor / containerBgColor / background / containerBackground)
    // 2. Direct style.properties.backgroundColor (handles { type, value } envelope)
    // 3. style block's backgroundColor
    // 4. CSS container block (from presentation / layout / css)
    // 5. Top-level CSS bg gathered by getLayoutCss
    const cssBg = unwrapValue(
      layoutCss.container?.backgroundColor ??
      layoutCss.container?.background ??
      layoutCss._bgRaw,
      null
    );
    // Direct read of style.properties.backgroundColor — the most common DSL path
    const stylePropsNode = rawProps?.style?.properties || {};
    const stylePropsBg = unwrapValue(
      stylePropsNode?.backgroundColor ?? stylePropsNode?.background ?? stylePropsNode?.bgColor,
      null
    );
    const dslBgColor = unwrapValue(
      rawProps?.bgColor ??
      rawProps?.backgroundColor ??
      rawProps?.containerBgColor ??
      rawProps?.background ??
      rawProps?.containerBackground ??
      styleBlock?.backgroundColor ??
      styleBlock?.background,
      null
    ) || stylePropsBg || cssBg || unwrapValue(containerStyle?.backgroundColor, null) || null;

    let enhancedContainerStyle = {
      ...containerStyle,
      ...(dslBgColor ? { backgroundColor: dslBgColor } : {}),
    };

    const pt = asNumber(paddingRaw?.pt ?? rawProps?.pt, undefined);
    const pr = asNumber(paddingRaw?.pr ?? rawProps?.pr, undefined);
    const pb = asNumber(paddingRaw?.pb ?? rawProps?.pb, undefined);
    const pl = asNumber(paddingRaw?.pl ?? rawProps?.pl, undefined);

    if (pt != null) enhancedContainerStyle.paddingTop = pt;
    if (pr != null) enhancedContainerStyle.paddingRight = pr;
    if (pb != null) enhancedContainerStyle.paddingBottom = pb;
    if (pl != null) enhancedContainerStyle.paddingLeft = pl;

    const align = unwrapValue(alignmentAndPadding?.align, null);
    if (typeof align === "string") {
      const lowered = align.trim().toLowerCase();
      if (lowered === "center") enhancedContainerStyle.alignItems = "center";
      else if (lowered === "left") enhancedContainerStyle.alignItems = "flex-start";
      else if (lowered === "right") enhancedContainerStyle.alignItems = "flex-end";
    }

    // Container border / radius from DSL (overrides CSS)
    const contBorderLine = unwrapValue(rawProps?.containerBorderLine, "all").toLowerCase();
    const contBorderColor = unwrapValue(rawProps?.containerBorderColor, "#D1D5DB");
    const contBorderRadius = asNumber(rawProps?.containerBorderRadius, undefined);
    if (contBorderRadius != null) enhancedContainerStyle.borderRadius = contBorderRadius;
    if (contBorderLine === "none") {
      enhancedContainerStyle.borderWidth = 0;
    } else if (contBorderLine === "all") {
      enhancedContainerStyle.borderWidth = 1;
      enhancedContainerStyle.borderColor = contBorderColor;
    }

    const resolvedTextAlign = unwrapValue(alignmentAndPadding?.textAlign, undefined);

    const baseTitleStyle = convertStyles(layoutCss.title || {});
    const baseSubtextStyle = convertStyles(layoutCss.subtext || {});
    const timerStyle = convertStyles(layoutCss.timer || {});
    const buttonStyle = convertStyles(layoutCss.button || {});
    const iconStyle = convertStyles(layoutCss.icon || {});

    const titleAttributes =
      rawProps?.titleAttributes?.properties || rawProps?.titleAttributes || {};
    const subtextAttributes =
      rawProps?.subtextAttributes?.properties || rawProps?.subtextAttributes || {};

    const titleStyle = applyTextAttributes(baseTitleStyle, titleAttributes);
    const subtextStyle = applyTextAttributes(baseSubtextStyle, subtextAttributes);

    // Title alignment: prefer alignmentAndPadding.textAlign, fall back to titleAttributes.align
    const titleAlignAttr = unwrapValue(titleAttributes?.align, null);
    const effectiveTitleAlign =
      (resolvedTextAlign || titleAlignAttr || "").toLowerCase() || undefined;

    const titleText = unwrapValue(rawProps?.title, "");
    const subtextText = unwrapValue(rawProps?.subtext, "");

    const stripFaPrefix = (name) => {
      if (!name || typeof name !== "string") return "";
      return name.replace(/^fa-/, "").trim();
    };

    const buttonAttributes = rawProps?.buttonAttributes?.properties || rawProps?.buttonAttributes || {};
    const buttonLabel = unwrapValue(buttonAttributes?.label, "");
    const buttonBgColor = unwrapValue(buttonAttributes?.bgColor, buttonStyle.backgroundColor);
    const buttonTextColor = unwrapValue(buttonAttributes?.textColor, "#FFFFFF");

    const buttonFontSize = asNumber(buttonAttributes?.fontSize, undefined);
    const buttonBold = asBoolean(buttonAttributes?.bold, undefined);
    const buttonItalic = asBoolean(buttonAttributes?.italic, undefined);
    const buttonUnderline = asBoolean(buttonAttributes?.underline, undefined);
    const buttonStrikethrough = asBoolean(buttonAttributes?.strikethrough, undefined);
    const buttonBorderRadius = asNumber(buttonAttributes?.borderRadius, undefined);
    const buttonPaddingX = asNumber(buttonAttributes?.paddingX, undefined);
    const buttonPaddingY = asNumber(buttonAttributes?.paddingY, undefined);
    const buttonFontWeightRaw = unwrapValue(buttonAttributes?.fontWeight, undefined);
    const buttonFontWeight =
      typeof buttonFontWeightRaw === "number"
        ? String(buttonFontWeightRaw)
        : buttonFontWeightRaw || undefined;

    // Button icon
    const buttonIconName = stripFaPrefix(
      unwrapValue(buttonAttributes?.iconName ?? buttonAttributes?.icon, "")
    );
    const buttonIconSize  = asNumber(buttonAttributes?.iconSize, 14);
    const buttonIconColor = unwrapValue(buttonAttributes?.iconColor, buttonTextColor ?? "#FFFFFF");

    // Button alignment (left / center / right)
    const buttonAlignRaw = unwrapValue(buttonAttributes?.align, "Center");
    const buttonAlignSelf = (() => {
      const a = String(buttonAlignRaw || "").trim().toLowerCase();
      if (a === "left")  return "flex-start";
      if (a === "right") return "flex-end";
      return "center";
    })();

    const timerAttributes = rawProps?.timerAttributes?.properties || rawProps?.timerAttributes || {};
    const timerLabelColor = unwrapValue(timerAttributes?.labelColor ?? rawProps?.timerLabelColor, "#6B7280");
    const timerValueColor = unwrapValue(timerAttributes?.valueColor ?? rawProps?.timerValueColor, "#111111");
    const timerHeight = asNumber(timerAttributes?.height ?? rawProps?.timerHeight, timerStyle.height);
    const timerBackgroundColor = unwrapValue(
      timerAttributes?.bgColor ?? rawProps?.timerBgColor,
      timerStyle.backgroundColor || "#FFFFFF"
    );
    const timerBorderColor = unwrapValue(
      timerAttributes?.borderColor ?? rawProps?.timerBorderColor,
      "#E5E7EB"
    );
    const timerBorderWidth = asNumber(
      timerAttributes?.borderWidth ?? rawProps?.timerBorderWidth,
      1
    );
    const timerGap = asNumber(
      timerAttributes?.gap ?? timerStyle.gap ?? rawProps?.timerGap,
      8
    );

    const {
      backgroundColor: _timerContainerBg,
      borderRadius: timerBoxRadius,
      height: timerStyleHeight,
      ...timerContainerStyle
    } = timerStyle;

    const timerFontSize = asNumber(timerAttributes?.fontSize, undefined);
    const timerFontWeightRaw = unwrapValue(timerAttributes?.fontWeight, undefined);
    const timerFontWeight =
      typeof timerFontWeightRaw === "number"
        ? String(timerFontWeightRaw)
        : timerFontWeightRaw;

    const iconAttributes = rawProps?.iconAttributes?.properties || rawProps?.iconAttributes || {};
    // Strip "fa-" prefix — FontAwesome expects "bolt" not "fa-bolt"
    const iconName = stripFaPrefix(unwrapValue(iconAttributes?.iconName, ""));
    const iconColor = unwrapValue(iconAttributes?.iconColor, iconStyle.color || "#111827");
    const iconBgColor = unwrapValue(iconAttributes?.iconBgColor, iconStyle.backgroundColor);

    const showTitle = asBoolean(rawProps?.showTitle, true);
    const showSubtext = asBoolean(rawProps?.showSubtext, true);
    const showTimer = asBoolean(rawProps?.showTimer, true);
    const showButton = asBoolean(rawProps?.showButton, true) && !!buttonLabel;
    // Default showIcon to false — only show when DSL explicitly enables it AND provides an icon name
    const showIcon = asBoolean(rawProps?.showIcon, false) && !!iconName;
    const showImage = asBoolean(rawProps?.showImage, false);
    const imageUrl = showImage
      ? unwrapValue(rawProps?.image ?? rawProps?.imageUrl ?? rawProps?.backgroundImage, null)
      : null;

    const ContainerComponent = gradientInfo ? LinearGradient : View;
    const containerProps = gradientInfo
      ? {
          colors: gradientInfo.colors || ["#F3F4F6", "#E5E7EB"],
          angle: gradientInfo.angle || 0,
          useAngle: true,
        }
      : {};

    const renderTimerValue = (value) => String(value ?? "00").padStart(2, "0");
    const resolvedCountdown = countdown || { days: 0, hours: 0, minutes: 0, seconds: 0 };

    const timerUnits = [
      { key: "days", label: "DAY" },
      { key: "hours", label: "HRS" },
      { key: "minutes", label: "MIN" },
      { key: "seconds", label: "SEC" },
    ];

    // ── Inner content (header, timer, subtext, button) ────────────────────────
    const innerContent = (
      <>
        <View style={showIcon ? styles.headerRow : styles.headerRowNoIcon}>
          {showIcon && (
            <View style={[styles.iconWrap, iconStyle, iconBgColor ? { backgroundColor: iconBgColor } : null]}>
              <FontAwesome name={iconName} size={18} color={iconColor || "#111827"} />
            </View>
          )}
          {showTitle && (
            <Text
              style={[
                styles.title,
                titleStyle,
                showIcon ? null : styles.titleCentered,
                effectiveTitleAlign ? { textAlign: effectiveTitleAlign } : null,
              ]}
            >
              {titleText}
            </Text>
          )}
        </View>

        {showTimer && (
          <View style={styles.timerRow}>
            {timerUnits.map(({ key, label }, idx) => (
              <View
                key={key}
                style={[
                  styles.timerSegment,
                  idx > 0 && { marginLeft: timerGap },
                ]}
              >
                <View
                  style={[
                    styles.timerValueBox,
                    {
                      backgroundColor: timerBackgroundColor,
                      borderColor: timerBorderColor,
                      borderWidth: timerBorderWidth,
                    },
                    timerBoxRadius ? { borderRadius: timerBoxRadius } : null,
                    timerHeight
                      ? { height: timerHeight, minHeight: timerHeight }
                      : timerStyleHeight
                        ? { height: timerStyleHeight, minHeight: timerStyleHeight }
                        : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.timerValue,
                      { color: timerValueColor },
                      timerFontSize != null ? { fontSize: timerFontSize } : null,
                      timerFontWeight ? { fontWeight: timerFontWeight } : null,
                    ]}
                  >
                    {renderTimerValue(resolvedCountdown[key])}
                  </Text>
                </View>
                <Text style={[styles.timerLabel, { color: timerLabelColor }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {showSubtext && !!subtextText && (
          <Text
            style={[
              styles.subtext,
              subtextStyle,
              effectiveTitleAlign ? { textAlign: effectiveTitleAlign } : null,
            ]}
          >
            {subtextText}
          </Text>
        )}

        {showButton && (
          <TouchableOpacity
            activeOpacity={0.9}
            style={[
              styles.button,
              buttonStyle,
              buttonBgColor ? { backgroundColor: buttonBgColor } : null,
              buttonBorderRadius != null ? { borderRadius: buttonBorderRadius } : null,
              buttonPaddingX != null ? { paddingHorizontal: buttonPaddingX } : null,
              buttonPaddingY != null ? { paddingVertical: buttonPaddingY } : null,
              { alignSelf: buttonAlignSelf },
              buttonIconName ? styles.buttonRow : null,
            ]}
          >
            {!!buttonIconName && (
              <FontAwesome
                name={buttonIconName}
                size={buttonIconSize}
                color={buttonIconColor}
                style={buttonLabel ? styles.buttonIconGap : null}
              />
            )}
            {!!buttonLabel && (
              <Text
                style={[
                  styles.buttonText,
                  { color: buttonTextColor },
                  buttonFontSize != null ? { fontSize: buttonFontSize } : null,
                  buttonFontWeight ? { fontWeight: buttonFontWeight } : null,
                  buttonBold === true ? { fontWeight: "700" } : null,
                  buttonItalic === true ? { fontStyle: "italic" } : null,
                  buttonUnderline || buttonStrikethrough
                    ? {
                        textDecorationLine:
                          buttonUnderline && buttonStrikethrough
                            ? "underline line-through"
                            : buttonUnderline
                              ? "underline"
                              : "line-through",
                      }
                    : null,
                ]}
              >
                {buttonLabel}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </>
    );

    // ── When a background image is configured, overlay the content on top ─────
    // The ImageBackground must be full-width (no horizontal padding on the outer
    // container). Padding is moved to an inner View so the image extends edge-to-edge.
    if (imageUrl) {
      const imageCornerRadius = asNumber(
        rawProps?.imageCorner ?? rawProps?.imageCornerRadius,
        enhancedContainerStyle.borderRadius ?? 0
      );
      // Collect content padding separately so the image is not clipped by padding
      const contentPadding = {
        paddingTop:    enhancedContainerStyle.paddingTop    ?? pt ?? 16,
        paddingBottom: enhancedContainerStyle.paddingBottom ?? pb ?? 16,
        paddingLeft:   enhancedContainerStyle.paddingLeft   ?? pl ?? 16,
        paddingRight:  enhancedContainerStyle.paddingRight  ?? pr ?? 16,
      };
      // Outer style: full-width, no padding, keep border/radius/background for frame
      const {
        paddingTop: _pt, paddingBottom: _pb, paddingLeft: _pl, paddingRight: _pr,
        padding: _p, alignItems: _ai,
        ...outerStyle
      } = enhancedContainerStyle;

      return (
        <ImageBackground
          source={{ uri: imageUrl }}
          style={[styles.imageContainer, outerStyle]}
          imageStyle={{ borderRadius: imageCornerRadius }}
          resizeMode="cover"
        >
          <View style={[contentPadding, { width: "100%" }]}>
            {innerContent}
          </View>
        </ImageBackground>
      );
    }

    return (
      <ContainerComponent
        style={[styles.container, enhancedContainerStyle]}
        {...containerProps}
      >
        {innerContent}
      </ContainerComponent>
    );
  }
}

export default Countdown;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  // Used when image is the background — no padding so image fills edge-to-edge
  imageContainer: {
    width: "100%",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerRowNoIcon: {
    width: "100%",
    marginBottom: 12,
  },
  titleCentered: {
    width: "100%",
    textAlign: "center",
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "#E5F3F4",
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111111",
  },
  subtext: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
    marginTop: 10,
  },
  timerSegment: {
    flex: 1,
    alignItems: "center",
  },
  timerValueBox: {
    width: "100%",
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  timerLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  timerValue: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  button: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: "#111111",
    borderRadius: 999,
    alignSelf: "center",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonIconGap: {
    marginRight: 6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

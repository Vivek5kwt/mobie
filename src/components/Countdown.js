import React, { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

const parseDateValue = (value) => {
  const raw = unwrapValue(value, null);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildCountdown = (endTime, startTime) => {
  if (!endTime) return null;
  const now = Date.now();
  const baseline = startTime ? Math.max(now, startTime.getTime()) : now;
  const diff = Math.max(0, endTime.getTime() - baseline);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
};

export default function Countdown({ section }) {
  const rawProps =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};

  const layoutCss = rawProps?.layout?.properties?.css || rawProps?.layout?.css || {};
  const styleBlock = rawProps?.style?.properties || rawProps?.style || {};

  const { containerStyle, gradientInfo } = useMemo(() => {
    const converted = convertStyles({ ...(layoutCss.container || {}), ...styleBlock });
    const { _gradient, ...rest } = converted;
    return { containerStyle: rest, gradientInfo: extractGradientInfo(converted) };
  }, [layoutCss.container, styleBlock]);
  const titleStyle = convertStyles(layoutCss.title || {});
  const subtextStyle = convertStyles(layoutCss.subtext || {});
  const timerStyle = convertStyles(layoutCss.timer || {});
  const buttonStyle = convertStyles(layoutCss.button || {});
  const iconStyle = convertStyles(layoutCss.icon || {});

  const titleText = unwrapValue(rawProps?.title, "Sale Ends In");
  const subtextText = unwrapValue(rawProps?.subtext, "Limited time offer. Don’t miss out on this deal.");

  const buttonAttributes = rawProps?.buttonAttributes?.properties || rawProps?.buttonAttributes || {};
  const buttonLabel = unwrapValue(buttonAttributes?.label, "");
  const buttonBgColor = unwrapValue(buttonAttributes?.bgColor, buttonStyle.backgroundColor);
  const buttonTextColor = unwrapValue(buttonAttributes?.textColor, "#FFFFFF");

  const timerAttributes = rawProps?.timerAttributes?.properties || rawProps?.timerAttributes || {};
  const timerLabelColor = unwrapValue(timerAttributes?.labelColor, "#6B7280");
  const timerValueColor = unwrapValue(timerAttributes?.valueColor, "#111111");
  const timerHeight = asNumber(timerAttributes?.height, timerStyle.height);
  const timerBackgroundColor = unwrapValue(
    timerAttributes?.bgColor,
    timerStyle.backgroundColor || "#FFFFFF"
  );

  const iconAttributes = rawProps?.iconAttributes?.properties || rawProps?.iconAttributes || {};
  const iconName = unwrapValue(iconAttributes?.iconName, "clock-o");
  const iconColor = unwrapValue(iconAttributes?.iconColor, iconStyle.color || "#111827");
  const iconBgColor = unwrapValue(iconAttributes?.iconBgColor, iconStyle.backgroundColor);

  const showTitle = asBoolean(rawProps?.showTitle, true);
  const showSubtext = asBoolean(rawProps?.showSubtext, true);
  const showTimer = asBoolean(rawProps?.showTimer, true);
  const showButton = asBoolean(rawProps?.showButton, true) && !!buttonLabel;
  const showIcon = asBoolean(rawProps?.showIcon, true);
  const showImage = asBoolean(rawProps?.showImage, false);

  const endTime = useMemo(() => parseDateValue(rawProps?.endTime), [rawProps?.endTime]);
  const startTime = useMemo(() => parseDateValue(rawProps?.startTime), [rawProps?.startTime]);
  const [countdown, setCountdown] = useState(() => buildCountdown(endTime, startTime));

  useEffect(() => {
    if (!endTime) return undefined;

    const id = setInterval(() => {
      setCountdown(buildCountdown(endTime, startTime));
    }, 1000);

    return () => clearInterval(id);
  }, [endTime, startTime]);

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
    { key: "days", label: "DAYS" },
    { key: "hours", label: "HRS" },
    { key: "minutes", label: "MINS" },
    { key: "seconds", label: "SEC" },
  ];

  return (
    <ContainerComponent
      style={[styles.container, containerStyle]}
      {...containerProps}
    >
      {showImage && rawProps?.image ? (
        <Image
          source={{ uri: unwrapValue(rawProps.image) }}
          style={{ width: "100%", height: 120, borderRadius: 8, marginBottom: 12 }}
          resizeMode="cover"
        />
      ) : null}

      <View style={styles.headerRow}>
        {showIcon && (
          <View style={[styles.iconWrap, iconStyle, iconBgColor ? { backgroundColor: iconBgColor } : null]}>
            <FontAwesome name={iconName || "clock-o"} size={18} color={iconColor || "#111827"} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          {showTitle && (
            <Text style={[styles.title, titleStyle]}>{titleText}</Text>
          )}
          {showSubtext && (
            <Text style={[styles.subtext, subtextStyle]}>{subtextText}</Text>
          )}
        </View>
      </View>

      {showTimer && (
        <View
          style={[
            styles.timer,
            timerStyle,
            timerHeight ? { height: timerHeight } : null,
          ]}
        >
          {timerUnits.map(({ key, label }) => (
            <View
              key={key}
              style={[styles.timerSegment, timerBackgroundColor ? { backgroundColor: timerBackgroundColor } : null]}
            >
              <Text style={[styles.timerValue, { color: timerValueColor }]}>
                {renderTimerValue(resolvedCountdown[key])}
              </Text>
              <Text style={[styles.timerLabel, { color: timerLabelColor }]}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {showButton && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.button, buttonStyle, buttonBgColor ? { backgroundColor: buttonBgColor } : null]}
        >
          <Text style={[styles.buttonText, { color: buttonTextColor }]}>{buttonLabel}</Text>
        </TouchableOpacity>
      )}
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
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
  timer: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  timerSegment: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 4,
  },
  timerLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  timerValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  button: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: "#111111",
    borderRadius: 999,
    alignSelf: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});

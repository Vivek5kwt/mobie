import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { convertStyles } from "../utils/convertStyles";
import { resolveFA4IconName } from "../utils/faIconAlias";
import { resolveFont } from "../services/typographyService";
import { navigateToDslTarget } from "../utils/navigationTarget";

const deepUnwrap = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => deepUnwrap(item));
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return deepUnwrap(value.value);
  if (value.const !== undefined) return deepUnwrap(value.const);
  if (value.properties !== undefined) return deepUnwrap(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = deepUnwrap(next);
    return acc;
  }, {});
};

const str = (value, fallback = "") => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null) return fallback;
  const text = String(resolved).trim();
  return text ? text : fallback;
};

const num = (value, fallback = 0) => {
  const resolved = deepUnwrap(value);
  if (resolved === undefined || resolved === null || resolved === "") return fallback;
  if (typeof resolved === "number" && Number.isFinite(resolved)) return resolved;
  const parsed = Number.parseFloat(String(resolved).replace("px", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = true) => {
  const resolved = deepUnwrap(value);
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "number") return resolved !== 0;
  if (typeof resolved === "string") {
    const normalized = resolved.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

const fontWeight = (value, fallback = "400") => {
  const raw = str(value, fallback).toLowerCase();
  if (/^\d+$/.test(raw)) return raw;
  if (raw === "bold") return "700";
  if (raw === "semibold" || raw === "semi bold") return "600";
  if (raw === "medium") return "500";
  if (raw === "regular" || raw === "normal") return "400";
  return fallback;
};

const parseIconName = (value) => {
  const tokens = String(value || "").split(/\s+/).filter(Boolean);
  const skip = new Set(["fa-solid", "fa-regular", "fa-light", "fa-thin", "fa-brands"]);
  const token =
    tokens.find((item) => item.startsWith("fa-") && !skip.has(item)) ||
    tokens.find((item) => item.startsWith("fa-")) ||
    value;
  return resolveFA4IconName(String(token || "").replace(/^fa-/, ""));
};

const getProps = (section) => {
  const propsRoot =
    section?.props ||
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    {};
  const normalized = deepUnwrap(propsRoot) || {};
  const raw = normalized?.raw && typeof normalized.raw === "object" ? normalized.raw : {};
  return { normalized, raw: { ...normalized, ...raw } };
};

const resolveRows = (notifications, raw) => {
  if (Array.isArray(notifications) && notifications.length > 0) {
    return notifications.filter(Boolean);
  }

  const rawItems = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.notifications)
      ? raw.notifications
      : [];
  if (rawItems.length > 0) return rawItems.filter(Boolean);

  const title = str(raw?.title, "");
  const description = str(raw?.description ?? raw?.body ?? raw?.message, "");
  const timeText = str(raw?.timeText ?? raw?.dateText, "");
  const image = str(raw?.image ?? raw?.imageUrl, "");
  const iconName = str(raw?.iconName ?? raw?.icon, "");
  if (!title && !description && !timeText && !image && !iconName) return [];

  return [{
    id: "dsl-notification",
    title,
    body: description,
    timeText,
    image,
    iconName,
    navigateRef: raw?.navigateRef,
    navigateType: raw?.navigateType,
    link: raw?.link,
    actionUrl: raw?.actionUrl,
  }];
};

const resolveTitle = (item) =>
  str(item?.title ?? item?.heading ?? item?.name ?? item?.label, "");

const resolveBody = (item) =>
  str(item?.body ?? item?.description ?? item?.message ?? item?.subtitle ?? item?.subtext, "");

const resolveImage = (item, raw) =>
  str(item?.image ?? item?.imageUrl ?? item?.iconImage ?? item?.thumbnail ?? raw?.image ?? raw?.imageUrl, "");

const resolveIcon = (item, raw) =>
  parseIconName(item?.iconName ?? item?.icon ?? item?.iconClass ?? raw?.iconName ?? raw?.icon);

const resolveDateText = (item, raw) => {
  const explicit = str(item?.timeText ?? item?.dateText ?? item?.createdText, "");
  if (explicit) return explicit;

  const source = item?.created_at ?? item?.createdAt ?? item?.date ?? item?.timestamp;
  if (!source) return str(raw?.timeText, "");

  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return str(source, "");

  const diffMs = Date.now() - date.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs >= 0 && diffMs < minuteMs) return str(raw?.nowText, "Just now");
  if (diffMs >= 0 && diffMs < hourMs) return `${Math.floor(diffMs / minuteMs)}m ago`;
  if (diffMs >= 0 && diffMs < dayMs) return `${Math.floor(diffMs / hourMs)}h ago`;
  if (diffMs >= 0 && diffMs < 7 * dayMs) return `${Math.floor(diffMs / dayMs)}d ago`;

  try {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (_) {
    return str(source, "");
  }
};

const resolveAction = (item = {}) => ({
  orderId: item?.order_id ?? item?.orderId,
  url: str(item?.actionUrl ?? item?.url ?? item?.href ?? item?.linkUrl, ""),
  page: str(item?.navigateRef ?? item?.pageName ?? item?.page ?? item?.screen ?? item?.link, ""),
  navigateType: str(item?.navigateType ?? item?.actionType, "Screen"),
});

function NotificationCard({ item, raw, stylesConfig }) {
  const navigation = useNavigation();
  const title = resolveTitle(item);
  const body = resolveBody(item);
  const image = resolveImage(item, raw);
  const iconName = resolveIcon(item, raw);
  const timeText = resolveDateText(item, raw);
  const action = resolveAction(item);
  const hasAction = Boolean(action.orderId || action.url || action.page);

  const handlePress = () => {
    if (!hasAction) return;
    try {
      if (action.orderId) {
        navigation.navigate("OrderDetail", { orderId: action.orderId });
        return;
      }
      if (action.url || action.navigateType.toLowerCase() === "url") {
        navigation.navigate("CheckoutWebView", { url: action.url || action.page, title });
        return;
      }
      void navigateToDslTarget(navigation, {
        target: action.page,
        navigateRef: action.page,
        navigateType: action.navigateType,
        label: title,
        fallbackTitle: title || action.page,
      });
    } catch (_) {}
  };

  return (
    <TouchableOpacity
      activeOpacity={hasAction ? 0.72 : 1}
      disabled={!hasAction}
      onPress={handlePress}
      style={[styles.card, stylesConfig.card]}
    >
      {(image || iconName) && (
        <View style={[styles.iconWrap, stylesConfig.iconWrap]}>
          {image ? (
            <Image source={{ uri: image }} style={[styles.image, stylesConfig.image]} resizeMode="cover" />
          ) : (
            <FontAwesome
              name={iconName}
              size={stylesConfig.iconSize}
              color={stylesConfig.iconColor}
            />
          )}
        </View>
      )}

      <View style={styles.textArea}>
        {!!title && (
          <Text numberOfLines={2} style={[styles.title, stylesConfig.title]}>
            {title}
          </Text>
        )}
        {!!body && (
          <Text numberOfLines={3} style={[styles.body, stylesConfig.body]}>
            {body}
          </Text>
        )}
      </View>

      {!!timeText && (
        <Text numberOfLines={1} style={[styles.time, stylesConfig.time]}>
          {timeText}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function NotificationList({
  section,
  notifications = [],
  loading = false,
  bottomPad = 0,
}) {
  const { normalized, raw } = useMemo(() => getProps(section), [section]);
  const css = normalized?.presentation?.css || normalized?.layout?.css || {};
  const rows = useMemo(() => resolveRows(notifications, raw), [notifications, raw]);

  const containerCss = convertStyles(css?.container || {});
  const cardCss = convertStyles(css?.card || css?.row || {});
  const titleCss = convertStyles(css?.title || {});
  const bodyCss = convertStyles(css?.description || css?.body || {});
  const timeCss = convertStyles(css?.time || {});
  const imageCss = convertStyles(css?.image || {});

  const titleFontFamily = resolveFont(str(raw?.titleFontFamily ?? raw?.fontFamily, "")) || titleCss.fontFamily;
  const bodyFontFamily = resolveFont(str(raw?.descriptionFontFamily ?? raw?.fontFamily, "")) || bodyCss.fontFamily;
  const timeFontFamily = resolveFont(str(raw?.timeFontFamily ?? raw?.fontFamily, "")) || timeCss.fontFamily;

  const stylesConfig = {
    container: {
      ...containerCss,
      paddingTop: num(raw?.pt, containerCss.paddingTop ?? 0),
      paddingRight: num(raw?.pr, containerCss.paddingRight ?? 0),
      paddingBottom: num(raw?.pb, containerCss.paddingBottom ?? 0) + bottomPad,
      paddingLeft: num(raw?.pl, containerCss.paddingLeft ?? 0),
      backgroundColor: str(raw?.containerBgColor ?? raw?.backgroundColor, containerCss.backgroundColor || "transparent"),
    },
    card: {
      ...cardCss,
      backgroundColor: str(raw?.bgColor ?? raw?.cardBgColor, cardCss.backgroundColor || "#FFFFFF"),
      borderRadius: num(raw?.borderRadius ?? raw?.cardBorderRadius, cardCss.borderRadius || 0),
    },
    title: {
      ...titleCss,
      color: str(raw?.titleColor, titleCss.color || "#111111"),
      fontSize: num(raw?.titleFontSize, titleCss.fontSize || 18),
      fontWeight: fontWeight(raw?.titleFontWeight, titleCss.fontWeight || "600"),
      ...(titleFontFamily ? { fontFamily: titleFontFamily } : {}),
    },
    body: {
      ...bodyCss,
      color: str(raw?.descriptionColor ?? raw?.bodyColor, bodyCss.color || "#222222"),
      fontSize: num(raw?.descriptionFontSize ?? raw?.bodyFontSize, bodyCss.fontSize || 14),
      fontWeight: fontWeight(raw?.descriptionFontWeight ?? raw?.bodyFontWeight, bodyCss.fontWeight || "400"),
      ...(bodyFontFamily ? { fontFamily: bodyFontFamily } : {}),
    },
    time: {
      ...timeCss,
      color: str(raw?.timeColor, timeCss.color || "#2D2D2D"),
      fontSize: num(raw?.timeFontSize, timeCss.fontSize || 13),
      fontWeight: fontWeight(raw?.timeFontWeight, timeCss.fontWeight || "400"),
      ...(timeFontFamily ? { fontFamily: timeFontFamily } : {}),
    },
    iconWrap: {
      width: num(raw?.iconWidth ?? raw?.imageWidth, imageCss.width || 40),
      height: num(raw?.iconHeight ?? raw?.imageHeight, imageCss.height || 40),
      borderRadius: num(raw?.iconBorderRadius ?? raw?.imageBorderRadius, 20),
      backgroundColor: str(raw?.iconBgColor, "transparent"),
    },
    image: {
      width: num(raw?.iconWidth ?? raw?.imageWidth, imageCss.width || 40),
      height: num(raw?.iconHeight ?? raw?.imageHeight, imageCss.height || 40),
      borderRadius: num(raw?.iconBorderRadius ?? raw?.imageBorderRadius, 20),
    },
    iconSize: num(raw?.iconSize, 20),
    iconColor: str(raw?.iconColor, "#111111"),
  };

  if (loading && rows.length === 0) {
    return (
      <View style={[styles.container, stylesConfig.container, styles.centered]}>
        <ActivityIndicator size="large" color={stylesConfig.time.color} />
        {!!str(raw?.loadingText, "") && (
          <Text style={[styles.body, stylesConfig.body, styles.loadingText]}>
            {str(raw?.loadingText, "")}
          </Text>
        )}
      </View>
    );
  }

  if (!rows.length) {
    const emptyTitle = str(raw?.emptyTitle, "");
    const emptyMessage = str(raw?.emptyMessage ?? raw?.emptySubtitle, "");
    if (!emptyTitle && !emptyMessage) return <View style={[styles.container, stylesConfig.container]} />;
    return (
      <View style={[styles.container, stylesConfig.container, styles.centered]}>
        {!!emptyTitle && <Text style={[styles.title, stylesConfig.title]}>{emptyTitle}</Text>}
        {!!emptyMessage && <Text style={[styles.body, stylesConfig.body]}>{emptyMessage}</Text>}
      </View>
    );
  }

  const showHeader = bool(raw?.headerVisible ?? raw?.showHeader, false);
  const headerText = str(raw?.headerText ?? raw?.listTitle, "");

  return (
    <View style={[styles.container, stylesConfig.container]}>
      {showHeader && !!headerText && (
        <Text style={[styles.header, stylesConfig.title]}>{headerText}</Text>
      )}
      {rows.map((item, index) => (
        <NotificationCard
          key={String(item?.id ?? `${resolveTitle(item)}-${index}`)}
          item={item}
          raw={raw}
          stylesConfig={stylesConfig}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 180,
  },
  loadingText: {
    marginTop: 8,
  },
  header: {
    marginBottom: 12,
  },
  card: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    marginRight: 12,
  },
  image: {
    overflow: "hidden",
  },
  textArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#111111",
    fontSize: 18,
    fontWeight: "600",
  },
  body: {
    color: "#222222",
    fontSize: 14,
    marginTop: 4,
  },
  time: {
    flexShrink: 0,
    marginLeft: 10,
  },
});

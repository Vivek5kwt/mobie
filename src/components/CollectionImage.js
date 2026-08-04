import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { convertStyles } from "../utils/convertStyles";
import { resolveFont } from "../services/typographyService";
import { navigateToDslTarget } from "../utils/navigationTarget";

// ─── helpers ──────────────────────────────────────────────────────────────────

// Unwraps DSL value envelopes: { value }, { const }, or { default } (used by behavior props)
const unwrapValue = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.default !== undefined) return value.default;
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

const asString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const firstDefined = (...values) =>
  values.find((value) => {
    const resolved = unwrapValue(value, undefined);
    return resolved !== undefined && resolved !== null && resolved !== "";
  });

const unwrapObject = (value) => {
  const resolved = unwrapValue(value, {});
  return resolved?.properties || resolved || {};
};

const unwrapDeep = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== "object") return value;
  if (value.value !== undefined) return unwrapDeep(value.value);
  if (value.const !== undefined) return unwrapDeep(value.const);
  if (value.properties !== undefined) return unwrapDeep(value.properties);
  return value;
};

const parseAspectRatio = (value, fallback = 1) => {
  const resolved = asString(value, "").trim();
  if (!resolved) return fallback;
  const ratioMatch = resolved.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (ratioMatch) {
    const width = Number.parseFloat(ratioMatch[1]);
    const height = Number.parseFloat(ratioMatch[2]);
    return width > 0 && height > 0 ? width / height : fallback;
  }
  const parsed = Number.parseFloat(resolved);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const buildBorderStyle = (side, color) => {
  const normalized = asString(side, "").trim().toLowerCase();
  if (!normalized || normalized === "none" || normalized === "false" || normalized === "0") return {};
  const resolvedColor = asString(color, "#E5E7EB");
  if (["all", "full", "solid"].includes(normalized)) return { borderWidth: 1, borderColor: resolvedColor };
  const style = { borderColor: resolvedColor };
  if (normalized === "top") style.borderTopWidth = 1;
  if (normalized === "bottom") style.borderBottomWidth = 1;
  if (normalized === "left") style.borderLeftWidth = 1;
  if (normalized === "right") style.borderRightWidth = 1;
  return style;
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

// Parses the DSL collections block — supports:
//   • Plain array: [{ title, image, link }, ...]
//   • DSL schema object with collection-N keys: { "collection-1": { properties: {...} }, ... }
const buildCollections = (block = {}) => {
  if (!block || typeof block !== "object") return [];

  let items;
  if (Array.isArray(block)) {
    items = block;
  } else {
    // Only pick keys matching collection-N pattern so schema metadata
    // (type, required, description) is never mistaken for a collection item.
    items = Object.entries(block)
      .filter(([key]) => /^collection-\d+$/i.test(key))
      .map(([, val]) => val);
  }

  return items
    .filter(Boolean)
    .map((item) => {
      const p = item?.properties || item;
      const id     = asString(unwrapValue(p?.id, ""));
      const title  = asString(unwrapValue(p?.title,  ""));
      const image  = asString(unwrapValue(p?.image,  ""));
      const link   = asString(unwrapValue(p?.link,   ""));
      const handle = asString(unwrapValue(p?.handle ?? p?.collectionHandle ?? p?.navigateRef ?? p?.linkTo, ""));
      // "Choose where users will be redirected" (Inspector's NavigateToField)
      // was parsed only as a fallback source for `handle`, never as its own
      // type — a Product/URL/Screen choice was silently treated as "Collection".
      const navigateType = asString(unwrapValue(p?.navigateType, ""));
      const navigateRef  = asString(unwrapValue(p?.navigateRef,  ""));
      const linkTo       = asString(unwrapValue(p?.linkTo,       ""));
      const children = toArray(
        p?.children ??
        p?.items ??
        p?.subCategories ??
        p?.sub_categories ??
        p?.subCollections ??
        p?.sub_collections
      );
      if (!title && !image) return null;
      return { id, title, image, link, handle, children, navigateType, navigateRef, linkTo };
    })
    .filter(Boolean);
};

const isEmptyLinkValue = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || ["none", "null", "undefined", "#"].includes(normalized);
};

const deriveHandle = (item) => {
  if (item?.handle) return item.handle;
  const link = item?.link || "";
  if (!isEmptyLinkValue(link)) {
    const m = "/collections/";
    if (link.includes(m)) return link.split(m)[1]?.split(/[?#/]/)[0] || "";
    return link;
  }
  return String(item?.title || "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const normalizeKey = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const cleanFontFamily = (family) => resolveFont(family) || "";

const toArray = (value) => {
  const resolved = unwrapValue(value, value);
  if (Array.isArray(resolved)) return resolved;
  if (Array.isArray(resolved?.value)) return resolved.value;
  if (Array.isArray(resolved?.items)) return resolved.items;
  return [];
};

const isSvgUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase().split("?")[0];
  return lower.endsWith(".svg") || lower.includes(".svg");
};

const isRenderableImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const value = url.trim();
  if (!value) return false;
  if (/^blob:/i.test(value)) return false;
  return /^(https?:|data:image\/|file:)/i.test(value);
};

// ─── component ────────────────────────────────────────────────────────────────

export default function CollectionImage({ section }) {
  const navigation = useNavigation();
  const route = useRoute();
  const { width: screenW } = useWindowDimensions();

  const rawProps = useMemo(
    () =>
      section?.props ||
      section?.properties?.props?.properties ||
      section?.properties?.props ||
      {},
    [section]
  );

  const directSnapshot = rawProps && typeof rawProps === "object" ? rawProps : {};
  const rawPropsSnapshot = unwrapDeep(rawProps?.rawProps);
  const rawSnapshotBase  = unwrapDeep(rawProps?.raw);
  const rawSnapshot = {
    ...directSnapshot,
    ...((rawSnapshotBase && typeof rawSnapshotBase === "object") ? rawSnapshotBase : {}),
    ...((rawPropsSnapshot && typeof rawPropsSnapshot === "object") ? rawPropsSnapshot : {}),
  };
  const layoutSource = rawSnapshot?.layout || rawProps?.layout || {};
  // On a block's first-ever save (before any restore round-trip has run once
  // to flatten it via the rawProps blob-dump fallback above), `layout` here is
  // still schema-wrapped as `{ type: "object", properties: { css, ... } }`
  // rather than the flat `{ css: {...} }` shape — so `layoutSource.css` alone
  // resolves to undefined, layoutCss silently becomes `{}`, and every reader
  // below falls through to hardcoded defaults (or, for headerText, all the way
  // through to `section.title`, which literally displays the schema's own
  // "Collection Image Component Schema" doc title instead of the merchant's
  // heading). Check both shapes directly instead of relying on a later restore
  // cycle to have already flattened it.
  const layoutCss    = unwrapDeep(layoutSource?.css ?? layoutSource?.properties?.css) || {};
  const generalNode  = unwrapValue(rawProps?.general, {});
  const titleNode    = unwrapValue(rawProps?.title, {});
  const imageNode    = unwrapValue(rawProps?.image, {});
  const behavior     = rawProps?.behavior?.properties    || rawProps?.behavior    || {};
  const headerCfg    = rawProps?.header?.properties      || rawProps?.header      || {};
  const cardCfg      = rawProps?.card?.properties        || rawProps?.card        || {};
  const containerCfg = rawProps?.container?.properties   || rawProps?.container   || {};
  const visibilityCfg = {
    ...unwrapObject(layoutCss?.visibility),
    ...unwrapObject(rawSnapshot?.visibility),
    ...unwrapObject(rawProps?.visibility),
  };

  // ── Collections ──────────────────────────────────────────────────────────────
  // Priority: explicit items array → rawSnapshot items → collections object (DSL schema format)
  const dslCollections = useMemo(() => {
    const fromItems = buildCollections(toArray(rawProps?.items));
    if (fromItems.length) return fromItems;

    const fromRawItems = buildCollections(toArray(rawSnapshot?.items));
    if (fromRawItems.length) return fromRawItems;

    const fromRawPropsItems = buildCollections(toArray(rawPropsSnapshot?.items));
    if (fromRawPropsItems.length) return fromRawPropsItems;

    // DSL sends collections as an object with collection-N keys
    const fromCollections = buildCollections(rawProps?.collections ?? {});
    if (fromCollections.length) return fromCollections;

    return [];
  }, [rawProps, rawSnapshot, rawPropsSnapshot]);

  const items = dslCollections;

  // ── Container ────────────────────────────────────────────────────────────────
  const containerPt = asNumber(
    firstDefined(containerCfg?.pt, containerCfg?.paddingTop, rawSnapshot?.Pt, rawSnapshot?.pt, rawSnapshot?.paddingTop, layoutCss?.container?.paddingTop),
    0
  );
  const containerPb = asNumber(
    firstDefined(containerCfg?.pb, containerCfg?.paddingBottom, rawSnapshot?.Pb, rawSnapshot?.pb, rawSnapshot?.paddingBottom, layoutCss?.container?.paddingBottom),
    0
  );
  const containerPl = asNumber(
    firstDefined(containerCfg?.pl, containerCfg?.paddingLeft, rawSnapshot?.Pl, rawSnapshot?.pl, rawSnapshot?.paddingLeft, layoutCss?.container?.paddingLeft),
    0
  );
  const containerPr = asNumber(
    firstDefined(containerCfg?.pr, containerCfg?.paddingRight, rawSnapshot?.Pr, rawSnapshot?.pr, rawSnapshot?.paddingRight, layoutCss?.container?.paddingRight),
    0
  );
  const bgColor = asString(
    unwrapValue(
      firstDefined(
        containerCfg?.bgColor,
        containerCfg?.backgroundColor,
        rawSnapshot?.bgColor,
        rawSnapshot?.backgroundColor,
        rawSnapshot?.containerBgColor,
        rawSnapshot?.sectionBgColor,
        generalNode?.bgColor,
        generalNode?.backgroundColor,
        rawProps?.bgColor,
        rawProps?.backgroundColor,
        layoutCss?.container?.background,
        layoutCss?.container?.backgroundColor,
      ),
      "#FFFFFF"
    )
  );
  // The Inspector's container border controls write flat borderLineCollection/
  // borderColorCollection/borderRadiusCollection — none of the candidates below
  // matched those names (containerCfg/rawSnapshot.bgBorder* are dead legacy
  // names with no Inspector control writing them, and the CSS snapshot's
  // container section never carried a border at all), so the border never
  // rendered in the APK regardless of what was set in the Inspector.
  const containerRadius = asNumber(
    firstDefined(rawProps?.borderRadiusCollection, containerCfg?.borderRadius, containerCfg?.radius, rawSnapshot?.bgBorderRadius, rawSnapshot?.borderRadius, layoutCss?.container?.borderRadius),
    0
  );
  const containerBorderStyle = buildBorderStyle(
    firstDefined(rawProps?.borderLineCollection, containerCfg?.borderLine, containerCfg?.borderSide, rawSnapshot?.bgBorderSide, rawSnapshot?.borderLine),
    firstDefined(rawProps?.borderColorCollection, containerCfg?.borderColor, rawSnapshot?.bgBorderColor, rawSnapshot?.borderColor, layoutCss?.container?.borderColor)
  );

  // ── Header ───────────────────────────────────────────────────────────────────
  const showHeader   = asBoolean(
    firstDefined(
      visibilityCfg?.header,
      visibilityCfg?.heading,
      visibilityCfg?.sectionTitle,
      rawProps?.showHeader,
      rawSnapshot?.showHeader,
      layoutCss?.header?.text ? true : undefined
    ),
    Boolean(layoutCss?.header?.text)
  );
  // rawProps?.headerText is where composeLayout-2.ts actually saves this (a
  // flat top-level field) — headerCfg?.headerText/title/text never matched
  // anything real. Worse, `section?.title` was in this chain too: every
  // saved Collection Image section always HAS a `title` (it's the schema's
  // own fixed doc title, "Collection Image Component Schema" — schema
  // metadata, not merchant content), so that fallback always "succeeded"
  // and the chain never reached its intended "Featured Collections"
  // default, let alone the merchant's real heading.
  const headerText   = asString(
    unwrapValue(
      rawProps?.headerText ??
      layoutCss?.header?.text ??
      headerCfg?.headerText ?? headerCfg?.title ?? headerCfg?.text,
      "Featured Collections"
    )
  );
  const headerSize        = asNumber(headerCfg?.headerSize ?? rawProps?.headerSize ?? layoutCss?.header?.fontSize, 16);
  const headerColor       = asString(unwrapValue(headerCfg?.headerColor ?? rawProps?.headerColor ?? layoutCss?.header?.color, "#000000"));
  const headerMarginBottom = asNumber(firstDefined(headerCfg?.marginBottom, headerCfg?.mb, rawSnapshot?.headerMarginBottom, layoutCss?.header?.marginBottom), 8);
  const headerBold        = asBoolean(headerCfg?.headerBold ?? rawProps?.headerBold, false);
  const headerWeight      = headerBold ? "700" : deriveFontWeight(headerCfg?.headerWeight ?? rawProps?.headerWeight ?? layoutCss?.header?.fontWeight, "700");
  const headerItalic      = asBoolean(headerCfg?.headerItalic ?? rawProps?.headerItalic, false);
  const headerUnderline   = asBoolean(headerCfg?.headerUnderline ?? rawProps?.headerUnderline, false);
  const headerStrikethrough = asBoolean(headerCfg?.headerStrikethrough ?? rawProps?.headerStrikethrough, false);
  const headerFontFamily  = cleanFontFamily(
    asString(unwrapValue(headerCfg?.headerFontFamily ?? headerCfg?.fontFamily ?? rawProps?.headerFontFamily ?? layoutCss?.header?.fontFamily, ""))
  ) || cleanFontFamily(convertStyles(layoutCss?.header || {})?.fontFamily);

  const headerDecorationLine = (() => {
    if (headerUnderline && headerStrikethrough) return "underline line-through";
    if (headerUnderline) return "underline";
    if (headerStrikethrough) return "line-through";
    return "none";
  })();

  // ── Card ─────────────────────────────────────────────────────────────────────
  const showCardImage       = asBoolean(rawProps?.showCardImage, true);
  const showCardText        = asBoolean(
    firstDefined(
      visibilityCfg?.collectionTitle,
      visibilityCfg?.cardTitle,
      visibilityCfg?.title,
      rawSnapshot?.titleActive,
      rawSnapshot?.titleVisible,
      rawSnapshot?.showTitle,
      cardCfg?.showText
    ),
    true
  );
  const layoutCardText      = layoutCss?.card?.text || {};
  const layoutCardImage     = layoutCss?.card?.image || {};
  const cardTextSize        = asNumber(titleNode?.fontSize ?? rawSnapshot?.titleFontSize ?? cardCfg?.textSize ?? layoutCardText?.size, 12);
  const cardTextColor       = asString(unwrapValue(titleNode?.color ?? rawSnapshot?.titleSubCColor ?? rawSnapshot?.titleColor ?? cardCfg?.textColor ?? layoutCardText?.color, "#000000"));
  const cardTextWeight      = deriveFontWeight(titleNode?.fontWeight ?? rawSnapshot?.titleFontWeight ?? cardCfg?.textWeight ?? layoutCardText?.weight, "500");
  const cardFontFamily      = cleanFontFamily(
    asString(unwrapValue(titleNode?.fontFamily ?? rawSnapshot?.titleFontFamily ?? cardCfg?.textFontFamily ?? cardCfg?.fontFamily ?? rawProps?.textFontFamily ?? layoutCardText?.fontFamily, ""))
  ) || cleanFontFamily(convertStyles(layoutCss?.card?.text || {})?.fontFamily);
  const cardTextAlign       = asString(unwrapValue(titleNode?.align ?? rawSnapshot?.titleAlign ?? cardCfg?.textAlign ?? layoutCardText?.align, "center")).toLowerCase();
  const titlePosition       = asString(unwrapValue(titleNode?.position ?? rawSnapshot?.titlePosition ?? cardCfg?.titlePosition, "below")).toLowerCase();
  const cardTitleMarginTop  = asNumber(firstDefined(titleNode?.marginTop, titleNode?.mt, rawSnapshot?.titleMarginTop, cardCfg?.titleMarginTop, layoutCss?.cardTitle?.marginTop), 6);
  const cardTitleLineHeight = asNumber(firstDefined(titleNode?.lineHeight, rawSnapshot?.titleLineHeight, cardCfg?.titleLineHeight, layoutCss?.cardTitle?.lineHeight), Math.round(cardTextSize * 1.35));
  const cardPaddingTop      = asNumber(firstDefined(cardCfg?.paddingTop, cardCfg?.pt, rawSnapshot?.cardPt, layoutCss?.card?.paddingTop), 0);
  const cardPaddingBottom   = asNumber(firstDefined(cardCfg?.paddingBottom, cardCfg?.pb, rawSnapshot?.cardPb, layoutCss?.card?.paddingBottom), 0);
  const cardPaddingLeft     = asNumber(firstDefined(cardCfg?.paddingLeft, cardCfg?.pl, rawSnapshot?.cardPl, layoutCss?.card?.paddingLeft), 0);
  const cardPaddingRight    = asNumber(firstDefined(cardCfg?.paddingRight, cardCfg?.pr, rawSnapshot?.cardPr, layoutCss?.card?.paddingRight), 0);
  const cardBackgroundColor = asString(unwrapValue(firstDefined(cardCfg?.bgColor, cardCfg?.backgroundColor, rawSnapshot?.cardBgColor, layoutCss?.card?.backgroundColor), "transparent"));
  const cardBorderRadius    = asNumber(firstDefined(cardCfg?.borderRadius, cardCfg?.radius, rawSnapshot?.cardBorderRadius, layoutCss?.card?.borderRadius), 0);

  const rawColumns          = asNumber(generalNode?.columns ?? rawSnapshot?.columns, 0);
  const sliderCfg           = layoutCss?.slider || {};
  const hGap                = asNumber(generalNode?.hGap ?? rawSnapshot?.hGap ?? sliderCfg?.gapPx, 12);
  const vGap                = asNumber(generalNode?.vGap ?? rawSnapshot?.vGap, 12);
  const availableW          = screenW - containerPl - containerPr;
  const gridColumns         = Math.max(1, rawColumns || 2);
  const gridCardW           = (availableW - hGap * (gridColumns - 1)) / gridColumns;

  // layoutMode drives horizontal slider vs grid
  const layoutMode = asString(unwrapValue(behavior?.layoutMode ?? layoutCss?.slider?.layout, rawColumns ? "grid" : "horizontal")).toLowerCase();
  const isGrid     = layoutMode === "grid";
  const shouldFitHorizontalRow = !isGrid && items.length > 0 && items.length <= 4;
  const fitRowCardW = shouldFitHorizontalRow
    ? Math.max(40, (availableW - hGap * Math.max(items.length - 1, 0)) / items.length)
    : null;

  // Image dimensions from card config
  const configuredImageSize = asNumber(cardCfg?.imageSize ?? rawSnapshot?.imageSize ?? layoutCardImage?.size, Math.max(72, gridCardW));
  const cardImageSize       = shouldFitHorizontalRow
    ? Math.max(28, Math.min(configuredImageSize, fitRowCardW))
    : configuredImageSize;
  const borderMatch = asString(layoutCardImage?.border, "").match(/(\d+(?:\.\d+)?)px\s+\w+\s+([^,\s]+)/i);
  const cardImageBorder     = asNumber(cardCfg?.imageBorder ?? rawSnapshot?.imageBorder, borderMatch ? Number(borderMatch[1]) : 0);
  const cardImageBorderColor = asString(unwrapValue(cardCfg?.imageBorderColor ?? rawSnapshot?.imageBorderColor, borderMatch?.[2] || "#A8A7AE"));
  // Match the card's own background so any letterbox space around a
  // Fit-scaled image blends with the card instead of a mismatched
  // hardcoded white.
  const cardImageBgColor    = asString(unwrapValue(firstDefined(imageNode?.bgColor, imageNode?.backgroundColor, rawSnapshot?.imageBgColor, cardCfg?.imageBgColor), cardBackgroundColor));
  const placeholderBgColor  = asString(unwrapValue(firstDefined(rawSnapshot?.placeholderBgColor, cardCfg?.placeholderBgColor, imageNode?.placeholderBgColor), "#E0F2F1"));
  const placeholderTextColor = asString(unwrapValue(firstDefined(rawSnapshot?.placeholderTextColor, cardCfg?.placeholderTextColor, imageNode?.placeholderTextColor), "#096D70"));
  const imageShape          = asString(unwrapValue(cardCfg?.imageShape ?? layoutCardImage?.shape, rawSnapshot?.imageRadius != null ? "rounded" : "circle")).toLowerCase();
  const imageScale          = asString(unwrapValue(imageNode?.scale ?? rawSnapshot?.imageScale, "cover")).toLowerCase();
  const imageAspectRatio    = parseAspectRatio(firstDefined(imageNode?.ratio, rawSnapshot?.imageRatio, cardCfg?.imageRatio), 1);
  const defaultImageWidth   = isGrid
    ? Math.max(0, gridCardW - cardPaddingLeft - cardPaddingRight)
    : cardImageSize;
  const cardImageWidth      = asNumber(firstDefined(imageNode?.width, rawSnapshot?.imageWidth, cardCfg?.imageWidth), defaultImageWidth);
  const cardImageHeight     = asNumber(firstDefined(imageNode?.height, rawSnapshot?.imageHeight, cardCfg?.imageHeight), cardImageWidth / imageAspectRatio);
  const imageCircleRadius   = Math.min(cardImageWidth, cardImageHeight) / 2;
  const imageRadius         = rawSnapshot?.imageRadius != null || imageNode?.radius != null
    ? asNumber(imageNode?.radius ?? rawSnapshot?.imageRadius, 16)
    : imageShape === "square" ? 0
    : imageShape === "circle" ? imageCircleRadius
    : Math.max(8, Math.round(Math.min(cardImageWidth, cardImageHeight) * 0.2));

  // ── Behavior ─────────────────────────────────────────────────────────────────
  // behavior props use "default" keys in the DSL schema — unwrapValue now handles this
  const showArrows        = asBoolean(behavior?.showArrows ?? layoutCss?.slider?.showArrows, false);

  const routePageSlug = normalizeKey(
    route?.params?.pageName ||
    route?.params?.link ||
    route?.params?.title ||
    route?.name ||
    ""
  );
  const isHomeContext =
    route?.name === "LayoutScreen" ||
    routePageSlug === "home" ||
    routePageSlug === "layoutscreen" ||
    !routePageSlug;
  const flowValue = asString(
    unwrapValue(
      behavior?.navigationFlow ??
      behavior?.collectionFlow ??
      rawSnapshot?.navigationFlow ??
      rawSnapshot?.collectionFlow ??
      rawProps?.navigationFlow,
      ""
    )
  ).toLowerCase();
  const explicitSubCollectionFlow = asBoolean(
    behavior?.openSubCollections ??
    behavior?.enableSubCollections ??
    behavior?.subCollectionFlow ??
    rawSnapshot?.openSubCollections ??
    rawSnapshot?.enableSubCollections ??
    rawProps?.openSubCollections,
    false
  );
  const useSubCollectionFlow =
    !isHomeContext &&
    (explicitSubCollectionFlow || flowValue.includes("sub"));

  // Grid columns: explicit DSL column count, or derived from layoutMode
  const columns = isGrid
    ? gridColumns
    : 1;

  // ── Slider / Card sizing ──────────────────────────────────────────────────────
  // Card container width: read from layout.css.card.width ("96px" → 96)
  // Fallback: image size + text padding
  const rawCardW = asNumber(
    layoutCss?.card?.width,
    isGrid
      ? gridCardW
      : cardImageSize + 20
  );
  const cardW    = shouldFitHorizontalRow ? fitRowCardW : Math.max(40, Math.min(rawCardW, availableW));
  const stepSize = cardW + hGap;
  const isScrollable = !shouldFitHorizontalRow && items.length > 1;

  // ── State ────────────────────────────────────────────────────────────────────
  const listRef  = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [items.length]);

  const updateIndex = useCallback((newIndex) => {
    indexRef.current = newIndex;
  }, []);

  // ── Callbacks ─────────────────────────────────────────────────────────────────
  const getItemLayout = useCallback(
    (_, index) => ({ length: stepSize, offset: stepSize * index, index }),
    [stepSize]
  );

  const onMomentumScrollEnd = useCallback((e) => {
    const x = e?.nativeEvent?.contentOffset?.x ?? 0;
    const newIndex = Math.min(Math.max(Math.round(x / stepSize), 0), items.length - 1);
    if (newIndex !== indexRef.current) updateIndex(newIndex);
  }, [stepSize, items.length, updateIndex]);

  const onItemPress = useCallback((item) => {
    // An explicit Product/URL/Screen/etc. choice overrides the block's
    // default "open this collection" behavior — only a truly empty/"None"/
    // "Collection" choice falls through to the existing collection flow, so
    // pages saved before this field existed keep behaving exactly as before.
    const navType = String(item?.navigateType || "").trim().toLowerCase();
    if (navType && navType !== "none" && navType !== "collection" && navType !== "collections") {
      void navigateToDslTarget(navigation, {
        target: item?.navigateRef || item?.linkTo,
        navigateRef: item?.navigateRef,
        navigateType: item?.navigateType,
        linkTo: item?.linkTo,
        fallbackTitle: item?.title || "Collection",
      });
      return;
    }

    const handle = deriveHandle(item);
    if (!handle) return;
    const params = {
      collectionHandle: handle,
      collectionTitle: item?.title || "Collection",
      parentCollection: {
        handle,
        title: item?.title || "Collection",
        image: item?.image || "",
        link: item?.link || "",
        subCollections: item?.children || [],
      },
      sourcePageName: routePageSlug,
    };

    if (useSubCollectionFlow) {
      navigation.navigate("SubCollections", params);
      return;
    }

    navigation.navigate("CollectionProducts", params);
  }, [navigation, routePageSlug, useSubCollectionFlow]);

  // ── Render item ───────────────────────────────────────────────────────────────
  // Image inner size excludes the border width on each side
  const imageInnerWidth = Math.max(0, cardImageWidth - cardImageBorder * 2);
  const imageInnerHeight = Math.max(0, cardImageHeight - cardImageBorder * 2);

  const renderItem = useCallback(({ item }) => (
    <TouchableOpacity
      style={[
        styles.card,
        {
          width: cardW,
          marginRight: isGrid ? 0 : hGap,
          paddingTop: cardPaddingTop,
          paddingBottom: cardPaddingBottom,
          paddingLeft: cardPaddingLeft,
          paddingRight: cardPaddingRight,
          backgroundColor: cardBackgroundColor,
          borderRadius: cardBorderRadius,
        },
      ]}
      activeOpacity={0.82}
      onPress={() => onItemPress(item)}
      disabled={!deriveHandle(item)}
    >
      {showCardImage && (
        <View
          style={{
            width: cardImageWidth,
            height: cardImageHeight,
            borderRadius: imageRadius,
            borderWidth: cardImageBorder,
            borderColor: cardImageBorderColor,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cardImageBgColor,
          }}
        >
          {isRenderableImageUrl(item.image) ? (
            isSvgUrl(item.image) ? (
              <WebView
                source={{
                  html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:transparent}img{width:100%;height:100%;object-fit:contain;display:block}</style></head><body><img src="${item.image}" /></body></html>`,
                }}
                style={{
                  width: imageInnerWidth,
                  height: imageInnerHeight,
                  borderRadius: imageRadius,
                  backgroundColor: "transparent",
                }}
                scrollEnabled={false}
                pointerEvents="none"
                originWhitelist={["*"]}
              />
            ) : (
              <Image
                source={{ uri: item.image }}
                style={{
                  width: imageInnerWidth,
                  height: imageInnerHeight,
                  borderRadius: imageRadius,
                }}
                resizeMode={["contain", "fit"].includes(imageScale) ? "contain" : "cover"}
              />
            )
          ) : (
            <View
              style={{
                width: imageInnerWidth,
                height: imageInnerHeight,
                borderRadius: imageRadius,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: placeholderBgColor,
              }}
            >
              <Text style={{ color: placeholderTextColor, fontSize: Math.min(cardImageWidth, cardImageHeight) * 0.35, fontWeight: "700" }}>
                {(item.title || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {showCardText && titlePosition === "inside" && (
            <View style={styles.insideTitleWrap}>
              <Text
                numberOfLines={2}
                style={[
                  styles.cardTitle,
                  styles.insideTitle,
                  {
                    color: cardTextColor,
                    fontSize: cardTextSize,
                    fontWeight: cardTextWeight,
                    textAlign: cardTextAlign,
                    lineHeight: cardTitleLineHeight,
                    ...(cardFontFamily ? { fontFamily: cardFontFamily } : {}),
                  },
                ]}
              >
                {item.title}
              </Text>
            </View>
          )}
        </View>
      )}

      {showCardText && titlePosition !== "inside" && (
        <Text
          numberOfLines={2}
          style={[
            styles.cardTitle,
            {
              color: cardTextColor,
              fontSize: cardTextSize,
              fontWeight: cardTextWeight,
              textAlign: cardTextAlign,
              lineHeight: cardTitleLineHeight,
              maxWidth: cardW,
              marginTop: cardTitleMarginTop,
              ...(cardFontFamily ? { fontFamily: cardFontFamily } : {}),
            },
          ]}
        >
          {item.title}
        </Text>
      )}
    </TouchableOpacity>
  ), [
    cardW, hGap, isGrid, onItemPress,
    cardPaddingTop, cardPaddingBottom, cardPaddingLeft, cardPaddingRight, cardBackgroundColor, cardBorderRadius,
    showCardImage, cardImageWidth, cardImageHeight, imageRadius, cardImageBorder, cardImageBorderColor, cardImageBgColor,
    imageInnerWidth, imageInnerHeight, placeholderBgColor, placeholderTextColor,
    showCardText, titlePosition, imageScale, cardTextColor, cardTextSize, cardTextWeight,
    cardTextAlign, cardTitleLineHeight, cardTitleMarginTop, cardFontFamily,
  ]);

  const containerStyle = [
    styles.container,
    {
      backgroundColor: bgColor,
      paddingTop: containerPt,
      paddingBottom: containerPb,
      paddingLeft: containerPl,
      paddingRight: containerPr,
      borderRadius: containerRadius,
      ...containerBorderStyle,
    },
  ];

  if (!items.length) {
    return null;
  }

  return (
    <View style={containerStyle}>
      {/* Header */}
      {showHeader && !!headerText && (
        <Text
          style={[
            styles.header,
            {
              color: headerColor,
              fontSize: headerSize,
              fontWeight: headerWeight,
              fontStyle: headerItalic ? "italic" : "normal",
              textDecorationLine: headerDecorationLine,
              marginBottom: headerMarginBottom,
              marginLeft: 10,
              ...(headerFontFamily ? { fontFamily: headerFontFamily } : {}),
            },
          ]}
        >
          {headerText}
        </Text>
      )}

      {/* FlatList — horizontal slider or grid */}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, idx) => `${item.title}-${idx}`}
        renderItem={renderItem}
        horizontal={!isGrid}
        numColumns={isGrid ? columns : 1}
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!isGrid ? isScrollable : false}
        snapToInterval={!isGrid && isScrollable ? stepSize : undefined}
        snapToAlignment={!isGrid && isScrollable ? "start" : undefined}
        decelerationRate={!isGrid && isScrollable ? "fast" : "normal"}
        disableIntervalMomentum={!isGrid && isScrollable}
        getItemLayout={!isGrid && isScrollable ? getItemLayout : undefined}
        onMomentumScrollEnd={!isGrid && isScrollable ? onMomentumScrollEnd : undefined}
        scrollEventThrottle={32}
        // FlatList throws "columnWrapperStyle not supported for single
        // column lists" whenever numColumns resolves to 1 — isGrid alone
        // isn't enough to gate this, since a merchant can legitimately
        // configure a 1-column grid (gridColumns=1), which still passes
        // isGrid=true. Match the numColumns condition exactly, same as
        // AllProductsScreen.js/CollectionProductsScreen.js/MediaGrid.js.
        columnWrapperStyle={isGrid && columns > 1 ? { columnGap: hGap, marginBottom: vGap } : undefined}
        contentContainerStyle={
          isGrid
            ? undefined
            : shouldFitHorizontalRow
            ? { width: availableW }
            : undefined
        }
      />

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
  cardTitle: {
    marginTop: 6,
    textAlign: "center",
    lineHeight: 16,
  },
  insideTitleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 4,
    paddingVertical: 4,
    alignItems: "center",
  },
  insideTitle: {
    marginTop: 0,
    textShadowColor: "rgba(255,255,255,0.65)",
    textShadowRadius: 2,
    textShadowOffset: { width: 0, height: 1 },
  },
});

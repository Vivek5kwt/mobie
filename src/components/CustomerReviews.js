import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

// ─── DSL helpers ──────────────────────────────────────────────────────────────

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toString = (value, fallback = "") => {
  const r = unwrapValue(value, fallback);
  return r === undefined || r === null ? fallback : String(r);
};

const toNumber = (value, fallback) => {
  const r = unwrapValue(value, undefined);
  if (r === undefined || r === "") return fallback;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fallback : p;
};

const toBoolean = (value, fallback = true) => {
  const r = unwrapValue(value, fallback);
  if (r === undefined || r === null) return fallback;
  if (typeof r === "boolean") return r;
  if (typeof r === "string") return ["true", "1", "yes", "y"].includes(r.toLowerCase());
  return Boolean(r);
};

// ─── Normalize review items ───────────────────────────────────────────────────

const normalizeReviews = (raw) => {
  if (!raw) return [];
  let src = raw;
  if (raw?.value) src = raw.value;
  else if (raw?.properties?.value) src = raw.properties.value;

  const mapItem = (item) => {
    if (!item) return null;
    const p = item?.properties || item || {};
    return {
      id:          toString(p?.id ?? p?.reviewId, String(Math.random())),
      author:      toString(p?.author ?? p?.name ?? p?.reviewer, "Anonymous"),
      avatar:      toString(p?.avatar ?? p?.avatarUrl, ""),
      avatarColor: toString(p?.avatarColor ?? p?.color, "#0D9488"),
      date:        toString(p?.date ?? p?.createdAt ?? p?.time, ""),
      rating:      toNumber(p?.rating ?? p?.stars, 5),
      title:       toString(p?.title ?? p?.heading, ""),
      body:        toString(p?.body ?? p?.text ?? p?.content ?? p?.review, ""),
      verified:    toBoolean(p?.verified ?? p?.verifiedPurchase, false),
      filter:      toString(p?.filter ?? p?.type, "all"),
    };
  };

  if (Array.isArray(src)) return src.map(mapItem).filter(Boolean);
  if (src && typeof src === "object") return Object.values(src).map(mapItem).filter(Boolean);
  return [];
};

// ─── Normalize rating breakdown ───────────────────────────────────────────────

const normalizeBreakdown = (raw) => {
  if (!raw) return [];
  let src = raw;
  if (raw?.value) src = raw.value;

  const mapItem = (item) => {
    if (!item) return null;
    const p = item?.properties || item || {};
    const stars = toNumber(p?.stars ?? p?.star ?? p?.level, 0);
    const pct   = toNumber(p?.percentage ?? p?.percent ?? p?.pct, 0);
    if (stars === 0 && pct === 0) return null;
    return { stars, pct };
  };

  if (Array.isArray(src)) return src.map(mapItem).filter(Boolean).sort((a, b) => b.stars - a.stars);
  return [];
};

// ─── Normalize filter tabs ────────────────────────────────────────────────────

const normalizeTabs = (raw) => {
  if (!raw) return [];
  let src = raw;
  if (raw?.value) src = raw.value;

  if (Array.isArray(src)) {
    return src.map((t) => {
      if (typeof t === "string") return { label: t, key: t.toLowerCase() };
      const p = t?.properties || t || {};
      return {
        label: toString(p?.label ?? p?.text ?? p?.title, ""),
        key:   toString(p?.key ?? p?.value ?? p?.id, "").toLowerCase() || toString(p?.label ?? p?.text, "").toLowerCase(),
      };
    }).filter((t) => t.label);
  }
  return [];
};

// ─── Star row helper ──────────────────────────────────────────────────────────

const StarRow = ({ count = 5, filled = 0, size = 12, color = "#F59E0B", emptyColor = "#D1D5DB" }) => {
  const stars = [];
  for (let i = 1; i <= count; i++) {
    stars.push(
      <FontAwesome
        key={i}
        name={i <= Math.round(filled) ? "star" : "star-o"}
        size={size}
        color={i <= Math.round(filled) ? color : emptyColor}
        style={{ marginRight: 2 }}
      />
    );
  }
  return <View style={{ flexDirection: "row", alignItems: "center" }}>{stars}</View>;
};

// ─── Avatar initials ──────────────────────────────────────────────────────────

const AvatarInitial = ({ author, avatarColor, size = 36 }) => {
  const initial = (author || "A").trim()[0].toUpperCase();
  return (
    <View
      style={{
        width:           size,
        height:          size,
        borderRadius:    size / 2,
        backgroundColor: avatarColor || "#0D9488",
        alignItems:      "center",
        justifyContent:  "center",
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: size * 0.44, fontWeight: "700" }}>
        {initial}
      </Text>
    </View>
  );
};

// ─── Default tabs (always shown for UI structure) ─────────────────────────────

const DEFAULT_TABS = [
  { label: "All",    key: "all" },
  { label: "Newest", key: "newest" },
  { label: "Photos", key: "photos" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerReviews({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw         = unwrapValue(propsNode?.raw, {});
  const bgCss       = unwrapValue(propsNode?.backgroundAndPadding ?? propsNode?.background, {});
  const headingCss  = unwrapValue(propsNode?.heading ?? propsNode?.title, {});
  const ratingCss   = unwrapValue(propsNode?.ratingStyle ?? propsNode?.rating, {});
  const barCss      = unwrapValue(propsNode?.barStyle ?? propsNode?.bar, {});
  const tabCss      = unwrapValue(propsNode?.tabStyle ?? propsNode?.tab, {});
  const reviewCss   = unwrapValue(propsNode?.reviewStyle ?? propsNode?.review, {});
  const buttonCss   = unwrapValue(propsNode?.writeButton ?? propsNode?.button, {});
  const visibility  = unwrapValue(propsNode?.visibility, {});

  // ── Dynamic data: rating comes from Shopify metafields (merged by ProductDetailScreen)
  // raw.rating / raw.ratingText are injected by buildProductDefaults when the product
  // has been enriched by fetchShopifyProductDetails (reviews.rating metafield).
  // raw.reviewCount / raw.ratingCountText are injected similarly.
  const overallRating = toString(
    raw?.rating ?? raw?.ratingText ?? raw?.averageRating,
    toString(ratingCss?.value, "")
  );
  const reviewCountRaw = toString(
    raw?.reviewCount ?? raw?.totalReviews ?? raw?.count,
    ""
  );
  const reviewCountText = reviewCountRaw ? `${reviewCountRaw} reviews` : "";

  // ── DSL-provided reviews / breakdown / tabs ─────────────────────────────────
  const dslReviews   = useMemo(() => normalizeReviews(raw?.reviews ?? propsNode?.reviews),   [raw?.reviews,        propsNode?.reviews]);
  const dslBreakdown = useMemo(() => normalizeBreakdown(raw?.ratingBreakdown ?? raw?.breakdown ?? propsNode?.breakdown), [raw?.ratingBreakdown, raw?.breakdown, propsNode?.breakdown]);
  const dslTabs      = useMemo(() => normalizeTabs(raw?.tabs ?? propsNode?.tabs),             [raw?.tabs,           propsNode?.tabs]);

  // Real reviews come from DSL only — no fake hardcoded reviews.
  // Breakdown bars are shown only when DSL provides them.
  // Tabs always show (UI chrome).
  const reviews   = dslReviews;
  const breakdown = dslBreakdown;
  const tabs      = dslTabs.length > 0 ? dslTabs : DEFAULT_TABS;

  // ── Active tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "all");

  const visibleReviews = useMemo(() => {
    if (activeTab === "all" || !activeTab) return reviews;
    return reviews.filter((r) => r.filter === activeTab || r.filter === "all");
  }, [reviews, activeTab]);

  // ── Visibility ──────────────────────────────────────────────────────────────
  const showHeading    = toBoolean(visibility?.heading ?? visibility?.title, true);
  const showSummary    = toBoolean(visibility?.summary ?? visibility?.ratingBreakdown, true);
  const showTabs       = toBoolean(visibility?.tabs ?? visibility?.filters, true);
  const showReviews    = toBoolean(visibility?.reviews ?? visibility?.list, true);
  const showWriteBtn   = toBoolean(visibility?.writeButton ?? visibility?.cta, true);

  // ── Container ───────────────────────────────────────────────────────────────
  const resolvedPL = (() => { const v = toNumber(bgCss?.paddingLeft, 16); return v === 0 ? 16 : v; })();
  const resolvedPR = (() => { const v = toNumber(bgCss?.paddingRight, 16); return v === 0 ? 16 : v; })();
  const containerStyle = {
    paddingTop:      toNumber(bgCss?.paddingTop, 16),
    paddingBottom:   toNumber(bgCss?.paddingBottom, 20),
    paddingLeft:     resolvedPL,
    paddingRight:    resolvedPR,
    backgroundColor: toString(bgCss?.bgColor, "#FFFFFF"),
    borderRadius:    toNumber(bgCss?.cornerRadius, 0),
    borderWidth:     bgCss?.borderLine ? 1 : 0,
    borderColor:     toString(bgCss?.borderColor, "#E5E7EB"),
  };

  // ── Heading ─────────────────────────────────────────────────────────────────
  const headingText   = toString(headingCss?.text ?? raw?.headingText, "Customer Reviews");
  const headingSize   = toNumber(headingCss?.fontSize, 17);
  const headingColor  = toString(headingCss?.color, "#111827");
  const headingWeight = toString(headingCss?.fontWeight, "700");

  // ── Rating summary ──────────────────────────────────────────────────────────
  const ratingNumSize    = toNumber(ratingCss?.fontSize ?? ratingCss?.numberFontSize, 40);
  const ratingNumColor   = toString(ratingCss?.color ?? ratingCss?.numberColor, "#111827");
  const ratingCountColor = toString(ratingCss?.countColor, "#6B7280");
  const starColor        = toString(ratingCss?.starColor, "#F59E0B");
  const starEmptyColor   = toString(ratingCss?.starEmptyColor, "#D1D5DB");
  const starSize         = toNumber(ratingCss?.starSize, 14);

  // ── Bar ─────────────────────────────────────────────────────────────────────
  const barFillColor  = toString(barCss?.fillColor ?? barCss?.color, "#0D9488");
  const barTrackColor = toString(barCss?.trackColor ?? barCss?.emptyColor, "#E5E7EB");
  const barHeight     = toNumber(barCss?.height, 8);
  const barRadius     = toNumber(barCss?.borderRadius, 4);
  const barLabelColor = toString(barCss?.labelColor, "#6B7280");
  const barPctColor   = toString(barCss?.percentColor, "#6B7280");

  // ── Tab ─────────────────────────────────────────────────────────────────────
  const tabActiveBg      = toString(tabCss?.activeBg, "#0D9488");
  const tabActiveColor   = toString(tabCss?.activeColor, "#FFFFFF");
  const tabInactiveBg    = toString(tabCss?.inactiveBg, "#F3F4F6");
  const tabInactiveColor = toString(tabCss?.inactiveColor, "#6B7280");
  const tabBorderRadius  = toNumber(tabCss?.borderRadius, 20);
  const tabFontSize      = toNumber(tabCss?.fontSize, 12);
  const tabFontWeight    = toString(tabCss?.fontWeight, "600");

  // ── Review card ─────────────────────────────────────────────────────────────
  const reviewTitleSize   = toNumber(reviewCss?.titleFontSize, 13);
  const reviewTitleColor  = toString(reviewCss?.titleColor, "#111827");
  const reviewBodySize    = toNumber(reviewCss?.bodyFontSize, 12);
  const reviewBodyColor   = toString(reviewCss?.bodyColor, "#374151");
  const reviewDateColor   = toString(reviewCss?.dateColor, "#9CA3AF");
  const reviewAuthorColor = toString(reviewCss?.authorColor, "#111827");
  const reviewAuthorSize  = toNumber(reviewCss?.authorFontSize, 13);
  const reviewStarSize    = toNumber(reviewCss?.starSize, 12);
  const reviewBorderColor = toString(reviewCss?.borderColor, "#E5E7EB");
  const avatarSize        = toNumber(reviewCss?.avatarSize, 36);

  // ── Write review button ─────────────────────────────────────────────────────
  const btnText         = toString(buttonCss?.text ?? raw?.writeButtonText, "Write a Review");
  const btnBg           = toString(buttonCss?.bgColor ?? buttonCss?.bg, "#111827");
  const btnTextColor    = toString(buttonCss?.textColor ?? buttonCss?.color, "#FFFFFF");
  const btnFontSize     = toNumber(buttonCss?.fontSize, 14);
  const btnFontWeight   = toString(buttonCss?.fontWeight, "600");
  const btnBorderRadius = toNumber(buttonCss?.borderRadius, 8);
  const btnPV           = toNumber(buttonCss?.paddingV, 13);

  return (
    <View style={[styles.container, containerStyle]}>

      {/* ── Heading ─────────────────────────────────────────────────────────── */}
      {showHeading && (
        <Text style={{ fontSize: headingSize, color: headingColor, fontWeight: headingWeight, marginBottom: 14 }}>
          {headingText}
        </Text>
      )}

      {/* ── Rating Summary ──────────────────────────────────────────────────── */}
      {showSummary && (
        <View style={styles.summaryRow}>
          {/* Left: big number + stars + count */}
          <View style={styles.summaryLeft}>
            {!!overallRating && (
              <Text style={{ fontSize: ratingNumSize, fontWeight: "700", color: ratingNumColor, lineHeight: ratingNumSize + 4 }}>
                {overallRating}
              </Text>
            )}
            <StarRow
              filled={toNumber(overallRating, 0)}
              size={starSize}
              color={starColor}
              emptyColor={starEmptyColor}
            />
            {!!reviewCountText && (
              <Text style={{ fontSize: 11, color: ratingCountColor, marginTop: 3 }}>
                {reviewCountText}
              </Text>
            )}
          </View>

          {/* Right: bar chart — only shown when DSL provides breakdown data */}
          {breakdown.length > 0 && (
            <View style={styles.summaryRight}>
              {breakdown.map((row) => (
                <View key={row.stars} style={styles.barRow}>
                  <Text style={{ fontSize: 11, color: barLabelColor, width: 8, marginRight: 6 }}>
                    {row.stars}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: barTrackColor, height: barHeight, borderRadius: barRadius }]}>
                    <View
                      style={{
                        width:           `${Math.min(row.pct, 100)}%`,
                        height:          barHeight,
                        borderRadius:    barRadius,
                        backgroundColor: barFillColor,
                      }}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: barPctColor, width: 30, textAlign: "right" }}>
                    {row.pct}%
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Filter tabs ─────────────────────────────────────────────────────── */}
      {showTabs && tabs.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.75}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? tabActiveBg   : tabInactiveBg,
                    borderRadius:    tabBorderRadius,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize:   tabFontSize,
                    fontWeight: tabFontWeight,
                    color:      isActive ? tabActiveColor : tabInactiveColor,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Review list ─────────────────────────────────────────────────────── */}
      {showReviews && visibleReviews.map((review, idx) => (
        <View
          key={review.id}
          style={[
            styles.reviewCard,
            {
              borderTopColor: reviewBorderColor,
              borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
        >
          {/* Author row */}
          <View style={styles.reviewHeader}>
            <AvatarInitial
              author={review.author}
              avatarColor={review.avatarColor}
              size={avatarSize}
            />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={{ fontSize: reviewAuthorSize, fontWeight: "600", color: reviewAuthorColor }}>
                {review.author}
              </Text>
              {!!review.date && (
                <Text style={{ fontSize: 11, color: reviewDateColor, marginTop: 1 }}>
                  {review.date}
                </Text>
              )}
            </View>
          </View>

          {/* Stars */}
          <View style={{ marginTop: 8 }}>
            <StarRow
              filled={review.rating}
              size={reviewStarSize}
              color={starColor}
              emptyColor={starEmptyColor}
            />
          </View>

          {/* Title */}
          {!!review.title && (
            <Text style={{ fontSize: reviewTitleSize, fontWeight: "700", color: reviewTitleColor, marginTop: 6 }}>
              {review.title}
            </Text>
          )}

          {/* Body */}
          {!!review.body && (
            <Text
              numberOfLines={4}
              style={{ fontSize: reviewBodySize, color: reviewBodyColor, marginTop: 4, lineHeight: reviewBodySize * 1.6 }}
            >
              {review.body}
            </Text>
          )}
        </View>
      ))}

      {showReviews && visibleReviews.length === 0 && (
        <Text style={styles.noReviews}>
          {activeTab === "all"
            ? "Be the first to review this product"
            : `No ${activeTab} reviews yet`}
        </Text>
      )}

      {/* ── Write a Review button ─────────────────────────────────────────── */}
      {showWriteBtn && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.writeBtn,
            {
              backgroundColor: btnBg,
              borderRadius:    btnBorderRadius,
              paddingVertical: btnPV,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={btnText}
        >
          <Text style={{ fontSize: btnFontSize, fontWeight: btnFontWeight, color: btnTextColor }}>
            {btnText}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  // ── Summary ──────────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection: "row",
    alignItems:   "center",
    marginBottom: 16,
    gap:          16,
  },
  summaryLeft: {
    alignItems: "flex-start",
    minWidth:   80,
  },
  summaryRight: {
    flex: 1,
    gap:  4,
  },
  barRow: {
    flexDirection: "row",
    alignItems:   "center",
  },
  barTrack: {
    flex:     1,
    overflow: "hidden",
  },
  // ── Tabs ─────────────────────────────────────────────────────────────────
  tabsRow: {
    flexDirection: "row",
    gap:           8,
    marginBottom:  16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  // ── Review card ───────────────────────────────────────────────────────────
  reviewCard: {
    paddingVertical: 14,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems:   "center",
  },
  noReviews: {
    textAlign:    "center",
    color:        "#9CA3AF",
    fontSize:     13,
    paddingVertical: 16,
  },
  // ── Write button ──────────────────────────────────────────────────────────
  writeBtn: {
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      16,
    borderWidth:    1,
    borderColor:    "transparent",
  },
});

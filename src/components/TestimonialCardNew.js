import React, { useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const unwrap = (v, fb) => {
  if (v === undefined || v === null) return fb;
  if (typeof v === "object") {
    if (v.value !== undefined) return v.value;
    if (v.const !== undefined) return v.const;
  }
  return v !== undefined ? v : fb;
};

const toNum = (v, fb = 0) => {
  const r = unwrap(v, undefined);
  if (r === undefined || r === null || r === "") return fb;
  if (typeof r === "number") return r;
  const p = parseFloat(r);
  return Number.isNaN(p) ? fb : p;
};

const toStr = (v, fb = "") => {
  const r = unwrap(v, fb);
  return r === null || r === undefined ? fb : String(r);
};

const toBool = (v, fb = true) => {
  const r = unwrap(v, undefined);
  if (r === undefined) return fb;
  if (typeof r === "boolean") return r;
  const s = String(r).toLowerCase();
  return ["true", "1", "yes"].includes(s) ? true : ["false", "0", "no"].includes(s) ? false : fb;
};

const textAlign = (align) => {
  const a = String(align || "").toLowerCase();
  return a === "left" ? "left" : a === "right" ? "right" : "center";
};

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating = 0, size = 14, filledColor = "#FBBF24", emptyColor = "#E5E7EB" }) {
  return (
    <View style={starStyles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesome
          key={star}
          name="star"
          size={size}
          color={star <= rating ? filledColor : emptyColor}
          style={{ marginHorizontal: 1 }}
        />
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
});

// ─── Single Card ──────────────────────────────────────────────────────────────

function TestimonialCard({ item, cardStyle, avatarSize, avatarRadius, nameStyle, designationStyle, ratingConfig, descStyle }) {
  return (
    <View style={[styles.card, cardStyle]}>
      {/* Avatar */}
      {item.userImage ? (
        <Image
          source={{ uri: item.userImage }}
          style={[
            styles.avatar,
            { width: avatarSize, height: avatarSize, borderRadius: avatarRadius },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.avatarPlaceholder,
            { width: avatarSize, height: avatarSize, borderRadius: avatarRadius },
          ]}
        >
          <FontAwesome name="user" size={avatarSize * 0.45} color="#9CA3AF" />
        </View>
      )}

      {/* Name */}
      <Text style={[styles.name, nameStyle]} numberOfLines={1}>
        {item.userName || item.title || ""}
      </Text>

      {/* Designation */}
      {!!item.userDesignation && (
        <Text style={[styles.designation, designationStyle]} numberOfLines={1}>
          {item.userDesignation}
        </Text>
      )}

      {/* Stars */}
      {ratingConfig.visible && item.rating > 0 && (
        <View style={styles.ratingWrap}>
          <StarRating
            rating={item.rating}
            size={ratingConfig.size}
            filledColor={ratingConfig.filledColor}
            emptyColor={ratingConfig.emptyColor}
          />
        </View>
      )}

      {/* Message */}
      {!!item.message && (
        <Text style={[styles.message, descStyle]}>{item.message}</Text>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TestimonialCardNew({ section }) {
  const propsNode =
    section?.properties?.props?.properties ||
    section?.properties?.props ||
    section?.props ||
    {};

  const raw = useMemo(() => unwrap(propsNode?.raw, {}), [propsNode]);
  const dslStyles = raw?.styles || {};

  const items = useMemo(
    () => (Array.isArray(raw?.items) ? raw.items : []),
    [raw]
  );

  // ── Container ──────────────────────────────────────────────────────────────
  const containerDsl = dslStyles.container || {};
  const containerBg = toStr(containerDsl.backgroundColor, "#FFFFFF");
  const containerPad = containerDsl.padding || {};

  // ── Card (from layout.css.card) ────────────────────────────────────────────
  const layoutCss = useMemo(
    () => unwrap(propsNode?.layout?.properties?.css ?? propsNode?.layout?.css, {}),
    [propsNode]
  );
  const cardCss = unwrap(layoutCss?.card, {});
  const cardBg = toStr(cardCss.backgroundColor, "#FFFFFF");
  const cardBorderRadius = toNum(
    String(cardCss.borderRadius || "").replace(/[^0-9.]/g, "") || undefined,
    10
  );
  const cardBorderColor = String(cardCss.border || "").match(/#[0-9a-fA-F]+/)?.[0] || "#E5E7EB";

  // ── Avatar ─────────────────────────────────────────────────────────────────
  const avatarDsl = dslStyles.avatar || {};
  const avatarSize = Math.min(toNum(avatarDsl.size, 56), 80);
  const avatarRadius = toNum(avatarDsl.borderRadius, 12);

  // ── Name ───────────────────────────────────────────────────────────────────
  const headerDsl = dslStyles.header || {};
  const nameStyle = {
    color: toStr(headerDsl.color, "#0F172A"),
    fontSize: Math.min(toNum(headerDsl.fontSize, 14), 18),
    fontWeight: String(headerDsl.fontWeight || "600"),
    textAlign: textAlign(headerDsl.align),
    marginTop: 8,
  };

  // ── Designation ────────────────────────────────────────────────────────────
  const subDsl = dslStyles.subHeader || {};
  const designationStyle = {
    color: toStr(subDsl.color, "#64748B"),
    fontSize: Math.min(toNum(subDsl.fontSize, 12), 14),
    fontWeight: String(subDsl.fontWeight || "400"),
    textAlign: textAlign(subDsl.align),
    marginTop: 2,
  };

  // ── Rating ─────────────────────────────────────────────────────────────────
  const ratingDsl = dslStyles.rating || {};
  const ratingConfig = {
    visible: toBool(ratingDsl.visible, true),
    size: Math.min(toNum(ratingDsl.size, 14), 20),
    filledColor: toStr(ratingDsl.filledColor, "#FBBF24"),
    emptyColor: toStr(ratingDsl.emptyColor, "#E5E7EB"),
  };

  // ── Description ────────────────────────────────────────────────────────────
  const descDsl = dslStyles.description || {};
  const descStyle = {
    color: toStr(descDsl.color, "#475569"),
    fontSize: Math.min(toNum(descDsl.fontSize, 13), 15),
    fontWeight: String(descDsl.fontWeight || "400"),
    textAlign: textAlign(descDsl.align),
    marginTop: 8,
    lineHeight: 18,
  };

  // ── Card style ─────────────────────────────────────────────────────────────
  const cardStyle = {
    backgroundColor: cardBg,
    borderRadius: cardBorderRadius,
    borderColor: cardBorderColor,
  };

  if (!items.length) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBg,
          paddingTop: toNum(containerPad.top, 0) * 4,
          paddingBottom: toNum(containerPad.bottom, 0) * 4,
        },
      ]}
    >
      {/* 2-column grid */}
      <View style={styles.grid}>
        {items.map((item, i) => (
          <View key={item.id || i} style={styles.gridItem}>
            <TestimonialCard
              item={item}
              cardStyle={cardStyle}
              avatarSize={avatarSize}
              avatarRadius={avatarRadius}
              nameStyle={nameStyle}
              designationStyle={designationStyle}
              ratingConfig={ratingConfig}
              descStyle={descStyle}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    // Each item takes ~half width accounting for gap
    flexBasis: "47%",
    flexGrow: 1,
  },
  card: {
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  avatar: {
    backgroundColor: "#F3F4F6",
  },
  avatarPlaceholder: {
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
  },
  designation: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  ratingWrap: {
    marginTop: 6,
  },
  message: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 17,
  },
});

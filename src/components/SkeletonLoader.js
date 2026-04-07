import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Single shimmer bone ────────────────────────────────────────────────────
function Bone({ style }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  return <Animated.View style={[styles.bone, style, { opacity }]} />;
}

// ── Header skeleton ────────────────────────────────────────────────────────
function HeaderSkeleton() {
  return (
    <View style={styles.headerRow}>
      <Bone style={styles.headerTitle} />
      <Bone style={styles.headerIcon} />
    </View>
  );
}

// ── Banner skeleton ────────────────────────────────────────────────────────
function BannerSkeleton() {
  return <Bone style={styles.banner} />;
}

// ── Product card skeleton ──────────────────────────────────────────────────
function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Bone style={styles.cardImage} />
      <Bone style={styles.cardLine1} />
      <Bone style={styles.cardLine2} />
      <Bone style={styles.cardPrice} />
    </View>
  );
}

// ── Row of product cards ───────────────────────────────────────────────────
function ProductRowSkeleton() {
  return (
    <View style={styles.cardRow}>
      <ProductCardSkeleton />
      <ProductCardSkeleton />
    </View>
  );
}

// ── Text block skeleton ────────────────────────────────────────────────────
function TextBlockSkeleton() {
  return (
    <View style={styles.textBlock}>
      <Bone style={styles.textLine1} />
      <Bone style={styles.textLine2} />
    </View>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function SkeletonLoader() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <HeaderSkeleton />

      {/* Hero banner */}
      <BannerSkeleton />

      {/* Section title */}
      <TextBlockSkeleton />

      {/* Product grid row 1 */}
      <ProductRowSkeleton />

      {/* Product grid row 2 */}
      <ProductRowSkeleton />

      {/* Another banner */}
      <Bone style={styles.bannerSmall} />

      {/* Product grid row 3 */}
      <ProductRowSkeleton />
    </View>
  );
}

const CARD_W = (SCREEN_W - 48) / 2;
const BONE_BG = "#E2E8F0";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
  },
  bone: {
    backgroundColor: BONE_BG,
    borderRadius: 8,
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 0,
  },
  headerTitle: {
    width: 120,
    height: 20,
    borderRadius: 6,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  // Banner
  banner: {
    width: "100%",
    height: 180,
    borderRadius: 14,
    marginBottom: 20,
  },
  bannerSmall: {
    width: "100%",
    height: 110,
    borderRadius: 14,
    marginBottom: 20,
  },

  // Text block
  textBlock: {
    marginBottom: 14,
    gap: 8,
  },
  textLine1: {
    width: "55%",
    height: 18,
    borderRadius: 6,
  },
  textLine2: {
    width: "35%",
    height: 13,
    borderRadius: 6,
  },

  // Product card row
  cardRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  card: {
    width: CARD_W,
    gap: 8,
  },
  cardImage: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 12,
  },
  cardLine1: {
    width: "80%",
    height: 13,
    borderRadius: 5,
  },
  cardLine2: {
    width: "60%",
    height: 11,
    borderRadius: 5,
  },
  cardPrice: {
    width: "40%",
    height: 14,
    borderRadius: 5,
  },
});

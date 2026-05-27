import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, useWindowDimensions, View } from "react-native";
import { getResponsiveColumns } from "../utils/responsiveLayout";

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
function ProductCardSkeleton({ cardWidth }) {
  return (
    <View style={[styles.card, { width: cardWidth }]}>
      <Bone style={[styles.cardImage, { width: cardWidth, height: cardWidth }]} />
      <Bone style={styles.cardLine1} />
      <Bone style={styles.cardLine2} />
      <Bone style={styles.cardPrice} />
    </View>
  );
}

// ── Row of product cards ───────────────────────────────────────────────────
function ProductRowSkeleton({ cardWidth, columns, gap }) {
  return (
    <View style={[styles.cardRow, { gap }]}>
      {Array.from({ length: columns }).map((_, index) => (
        <ProductCardSkeleton key={index} cardWidth={cardWidth} />
      ))}
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
  const { width } = useWindowDimensions();
  const gap = 16;
  const columns = getResponsiveColumns({
    screenWidth: width,
    requestedColumns: 2,
    horizontalPadding: 32,
    gap,
    minCardWidth: 180,
    maxColumns: 6,
  });
  const cardWidth = Math.max(0, (Math.max(1, width) - 32 - gap * (columns - 1)) / columns);

  return (
    <View style={styles.container}>
      {/* Header */}
      <HeaderSkeleton />

      {/* Hero banner */}
      <BannerSkeleton />

      {/* Section title */}
      <TextBlockSkeleton />

      {/* Product grid row 1 */}
      <ProductRowSkeleton cardWidth={cardWidth} columns={columns} gap={gap} />

      {/* Product grid row 2 */}
      <ProductRowSkeleton cardWidth={cardWidth} columns={columns} gap={gap} />

      {/* Another banner */}
      <Bone style={styles.bannerSmall} />

      {/* Product grid row 3 */}
      <ProductRowSkeleton cardWidth={cardWidth} columns={columns} gap={gap} />
    </View>
  );
}

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
    marginBottom: 16,
  },
  card: {
    gap: 8,
  },
  cardImage: {
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

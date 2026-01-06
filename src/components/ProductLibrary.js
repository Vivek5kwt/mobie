import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { PinchGestureHandler, State } from "react-native-gesture-handler";

const unwrapValue = (value, fallback = undefined) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") {
    if (value.value !== undefined) return value.value;
    if (value.const !== undefined) return value.const;
    if (value.properties) return unwrapValue(value.properties, fallback);
  }
  return value;
};

const toNumber = (value, fallback) => {
  const resolved = unwrapValue(value, undefined);
  if (resolved === undefined || resolved === "") return fallback;
  if (typeof resolved === "number") return resolved;
  const parsed = parseFloat(resolved);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toString = (value, fallback = "") => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  return String(resolved);
};

const toBoolean = (value, fallback = false) => {
  const resolved = unwrapValue(value, fallback);
  if (resolved === undefined || resolved === null) return fallback;
  if (typeof resolved === "boolean") return resolved;
  if (typeof resolved === "string") return resolved.toLowerCase() === "true";
  return Boolean(resolved);
};

const buildInsets = (layout = {}) => ({
  paddingTop: toNumber(layout?.paddingTop, 0),
  paddingRight: toNumber(layout?.paddingRight, 0),
  paddingBottom: toNumber(layout?.paddingBottom, 0),
  paddingLeft: toNumber(layout?.paddingLeft, 0),
});

export default function ProductLibrary({ section }) {
  const navigation = useNavigation();
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const scale = Animated.multiply(baseScale, pinchScale);
  const propsNode =
    section?.properties?.props?.properties || section?.properties?.props || section?.props || {};
  const layout = unwrapValue(propsNode?.layout, {});
  const raw = unwrapValue(propsNode?.raw, {});

  const css = layout?.css || {};
  const outer = css?.outer || {};
  const classNames = css?.classNames || {};
  const visibility = css?.visibility || {};

  const resolvedImageUrl = toString(raw?.imageUrl, "");
  const showRating = toBoolean(raw?.showRating, true);
  const ratingText = toString(raw?.ratingText, "0");
  const ratingCountText = toString(raw?.ratingCountText, "(0)");
  const showBackButton = toBoolean(raw?.showBackButton, true);
  const initialFavourite = toBoolean(raw?.isFavourite, false);

  const containerStyle = [
    styles.container,
    {
      backgroundColor: toString(outer?.background, "#ffffff"),
      borderColor: toString(outer?.borderColor, "#e5e7eb"),
      borderRadius: toNumber(outer?.borderRadius, 0),
      borderWidth: outer?.borderLine ? 1 : 0,
    },
    buildInsets(outer),
  ];

  const screenWidth = Dimensions.get("window").width;
  const metrics = layout?.metrics?.elements || {};
  const imageMetrics = metrics?.image || {};
  const imageWidth = imageMetrics?.width ? Number(imageMetrics.width) : screenWidth - 32;
  const imageHeight = imageMetrics?.height
    ? Number(imageMetrics.height)
    : Math.round(imageWidth * 1.05);

  const ratingVisible = toBoolean(visibility?.reviews, showRating);
  const shareVisible = toBoolean(visibility?.share, true);
  const favouriteVisible = toBoolean(visibility?.favourite, true);

  useEffect(() => {
    setIsFavourite(initialFavourite);
  }, [initialFavourite]);

  useEffect(() => {
    if (!isFullscreenVisible) {
      baseScale.setValue(1);
      pinchScale.setValue(1);
      lastScale.current = 1;
    }
  }, [baseScale, pinchScale, isFullscreenVisible]);

  const onPinchGestureEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });

  const onPinchHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const rawNextScale = lastScale.current * event.nativeEvent.scale;
      const nextScale = Math.max(1, Math.min(rawNextScale, 4));
      lastScale.current = nextScale;
      baseScale.setValue(nextScale);
      pinchScale.setValue(1);
    }
  };

  return (
    <View style={containerStyle}>
      <View style={styles.imageWrap}>
        {resolvedImageUrl ? (
          <Pressable
            onPress={() => setIsFullscreenVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open product image fullscreen"
          >
            <View style={[styles.imageCard, { width: imageWidth, height: imageHeight }]}>
              <Image
                source={{ uri: resolvedImageUrl }}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel="Product"
              />
            </View>
          </Pressable>
        ) : (
          <View style={[styles.imageCard, styles.imagePlaceholder, { width: imageWidth, height: imageHeight }]}>
            <Text style={styles.placeholderText}>Product image</Text>
          </View>
        )}

        {showBackButton && navigation?.canGoBack?.() && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.iconBubble, styles.backBubble]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.iconText}>←</Text>
          </Pressable>
        )}

        {favouriteVisible && (
          <Pressable
            onPress={() => setIsFavourite((prev) => !prev)}
            style={[
              styles.iconBubble,
              styles.favoriteBubble,
              isFavourite ? styles.favoriteActiveBubble : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isFavourite ? "Remove from favorites" : "Add to favorites"}
          >
            <Text style={[styles.iconText, isFavourite ? styles.favoriteActiveText : null]}>
              {isFavourite ? "❤" : "♡"}
            </Text>
          </Pressable>
        )}

        {shareVisible && (
          <View style={[styles.iconBubble, styles.shareBubble]}>
            <Text style={styles.iconText}>⇪</Text>
          </View>
        )}

        {ratingVisible && (
          <View style={styles.ratingBubble}>
            <Text style={styles.ratingStar}>★</Text>
            <Text style={styles.ratingText}>
              {ratingText} {ratingCountText}
            </Text>
          </View>
        )}
      </View>

      {!!classNames && (
        <Text style={styles.debugLabel}>
          {classNames.container ? `.${classNames.container}` : "Product Library"}
        </Text>
      )}

      <Modal
        visible={isFullscreenVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFullscreenVisible(false)}
      >
        <Pressable
          style={styles.fullscreenBackdrop}
          onPress={() => setIsFullscreenVisible(false)}
        >
          <View style={styles.fullscreenImageWrap}>
            <PinchGestureHandler
              onGestureEvent={onPinchGestureEvent}
              onHandlerStateChange={onPinchHandlerStateChange}
            >
              <Animated.View style={[styles.fullscreenImage, { transform: [{ scale }] }]}>
                <Image
                  source={{ uri: resolvedImageUrl }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                  accessibilityLabel="Product image fullscreen"
                />
              </Animated.View>
            </PinchGestureHandler>
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={() => setIsFullscreenVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen image"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    padding: 16,
  },
  imageWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  imageCard: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f8fafc",
  },
  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: "#6b7280",
    fontSize: 12,
  },
  iconBubble: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e5f3f4",
  },
  iconText: {
    fontSize: 14,
    color: "#111827",
  },
  favoriteBubble: {
    top: 16,
    right: 16,
  },
  favoriteActiveBubble: {
    backgroundColor: "#111827",
  },
  favoriteActiveText: {
    color: "#ffffff",
  },
  backBubble: {
    top: 16,
    left: 16,
  },
  shareBubble: {
    top: 64,
    right: 16,
  },
  ratingBubble: {
    position: "absolute",
    left: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ratingStar: {
    fontSize: 12,
    color: "#111827",
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    color: "#111827",
  },
  debugLabel: {
    marginTop: 12,
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImageWrap: {
    width: "90%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 48,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});

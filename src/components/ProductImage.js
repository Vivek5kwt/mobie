import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";
import { resolveProductImageResizeMode } from "../utils/productImageFit";

const DEFAULT_PRODUCT_IMAGE_BG = "#FFFFFF";

function ShimmerBone({ style }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });

  return <Animated.View style={[style, { opacity }]} />;
}

export default function ProductImage({
  uri,
  style,
  resizeMode = resolveProductImageResizeMode(),
  placeholderBg = DEFAULT_PRODUCT_IMAGE_BG,
  iconColor = "#C8CDD5",
  iconSize = 28,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const noImage = !uri || failed;
  const borderRadius = style?.borderRadius ?? 0;

  const onLoad = () => {
    setLoaded(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Shimmer while loading — icon placeholder on failure */}
      {(!loaded || noImage) && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor: placeholderBg, borderRadius }]}>
          {noImage ? (
            <FontAwesome name="picture-o" size={iconSize} color={iconColor} />
          ) : (
            <ShimmerBone
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: placeholderBg, borderRadius },
              ]}
            />
          )}
        </View>
      )}

      {/* Image fades in once loaded */}
      {!noImage && (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim, borderRadius }]}
          resizeMode={resolveProductImageResizeMode(resizeMode)}
          onLoad={onLoad}
          onError={() => { setLoaded(false); setFailed(true); }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: DEFAULT_PRODUCT_IMAGE_BG,
  },
  overlay: {
    alignItems: "center",
    justifyContent: "center",
  },
});

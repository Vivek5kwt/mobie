import React, { useState } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

/**
 * Drop-in image component with:
 *  - Spinner overlay while the image is downloading
 *  - Smooth fade-in when the image is ready
 *  - Broken-image icon when the URL fails or is empty
 *
 * Pass `style` to size the container (width / height / aspectRatio / borderRadius).
 * The Image and all overlays are absolutely positioned inside, so the layout
 * never shifts as loading state changes.
 */
export default function ProductImage({
  uri,
  style,
  resizeMode = "cover",
  placeholderBg = "#F3F4F6",
  indicatorColor = "#9CA3AF",
  iconColor = "#D1D5DB",
  iconSize = 28,
}) {
  const [failed, setFailed] = useState(false);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const [showLoader, setShowLoader] = useState(true);

  const handleLoad = () => {
    setShowLoader(false);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  };

  const handleError = () => {
    setShowLoader(false);
    setFailed(true);
  };

  const noImage = !uri || failed;

  return (
    <View style={[styles.container, style]}>
      {/* Placeholder / loader background */}
      {(showLoader || noImage) && (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor: placeholderBg }]}>
          {noImage ? (
            <FontAwesome name="image" size={iconSize} color={iconColor} />
          ) : (
            <ActivityIndicator size="small" color={indicatorColor} />
          )}
        </View>
      )}

      {/* Actual image — fades in once loaded */}
      {!noImage && (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFillObject, { opacity }]}
          resizeMode={resizeMode}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  overlay: {
    alignItems: "center",
    justifyContent: "center",
  },
});

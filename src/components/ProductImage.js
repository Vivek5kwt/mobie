import React, { useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import FontAwesome from "react-native-vector-icons/FontAwesome";

/**
 * Drop-in image component with:
 *  - Spinner overlay while the image is downloading
 *  - Placeholder icon when the URL is empty or fails to load
 *
 * Pass `style` to size the container (width / height / aspectRatio / borderRadius).
 * The Image and overlay are absolutely positioned inside the container.
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const noImage = !uri || failed;

  return (
    <View style={[styles.container, style]}>
      {/* Placeholder / loader shown while loading or on failure */}
      {(!loaded || noImage) && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.overlay,
            { backgroundColor: placeholderBg },
          ]}
        >
          {noImage ? (
            <FontAwesome name="picture-o" size={iconSize} color={iconColor} />
          ) : (
            <ActivityIndicator size="small" color={indicatorColor} />
          )}
        </View>
      )}

      {/* Actual image — rendered once uri is available */}
      {!noImage && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setFailed(true);
          }}
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

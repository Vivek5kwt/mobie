import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import LinearGradient from "react-native-linear-gradient";
import { useAuth } from "../services/AuthContext";
import {
  fetchBrandKitAssets,
  getBrandKitAssetsSync,
  getSplashImageSync,
} from "../services/brandKitService";

const MIN_SPLASH_MS = 1200;
const BRAND_ASSET_WAIT_MS = 3500;
const DEFAULT_BACKGROUND = "#FFFFFF";

const toRemoteImageSource = (url) => {
  if (typeof url !== "string" || !url.trim()) return null;
  return { uri: url.trim() };
};

const normalizeColor = (value, fallback = DEFAULT_BACKGROUND) => {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return color || fallback;
};

export default function SplashScreen() {
  const navigation = useNavigation();
  const { initializing } = useAuth();

  const cachedBrandAssets = useMemo(() => getBrandKitAssetsSync() || {}, []);
  const cachedSplashImageUrl = useMemo(() => getSplashImageSync(), []);
  const hasCachedBrandAssets = Object.keys(cachedBrandAssets).length > 0;

  const [brandAssets, setBrandAssets] = useState(cachedBrandAssets);
  const [splashSource, setSplashSource] = useState(() =>
    toRemoteImageSource(cachedSplashImageUrl)
  );
  const [brandReady, setBrandReady] = useState(hasCachedBrandAssets);
  const [authReady, setAuthReady] = useState(false);
  const [minTimeReady, setMinTimeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishWithAssets = async (assets = {}) => {
      if (cancelled) return;

      const splashUrl =
        typeof assets?.splashImageUrl === "string"
          ? assets.splashImageUrl.trim()
          : "";

      setBrandAssets(assets || {});

      if (splashUrl) {
        try {
          await Image.prefetch(splashUrl);
        } catch (_) {}
        if (!cancelled) setSplashSource(toRemoteImageSource(splashUrl));
      } else {
        setSplashSource(null);
      }

      if (!cancelled) setBrandReady(true);
    };

    const fallbackTimer = setTimeout(() => {
      if (!cancelled) setBrandReady(true);
    }, BRAND_ASSET_WAIT_MS);

    fetchBrandKitAssets()
      .then((assets) => finishWithAssets(assets || getBrandKitAssetsSync() || {}))
      .catch(() => finishWithAssets(getBrandKitAssetsSync() || {}))
      .finally(() => clearTimeout(fallbackTimer));

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    if (!initializing) setAuthReady(true);
  }, [initializing]);

  useEffect(() => {
    if (!brandReady) return undefined;
    const timer = setTimeout(() => setMinTimeReady(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [brandReady]);

  useEffect(() => {
    if (authReady && brandReady && minTimeReady) {
      navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] });
    }
  }, [authReady, brandReady, minTimeReady, navigation]);

  const splashBgColor = normalizeColor(
    brandAssets?.splashBgColor || brandAssets?.splashGradStart
  );
  const splashGradStart = normalizeColor(
    brandAssets?.splashGradStart || brandAssets?.splashBgColor,
    splashBgColor
  );
  const splashGradEnd = normalizeColor(brandAssets?.splashGradEnd, splashBgColor);

  return (
    <View style={[styles.container, { backgroundColor: splashBgColor }]}>
      <StatusBar barStyle="dark-content" backgroundColor={splashBgColor} />
      <LinearGradient
        colors={[splashGradStart, splashGradEnd]}
        style={StyleSheet.absoluteFillObject}
      />

      {splashSource ? (
        <Image
          source={splashSource}
          resizeMode="contain"
          style={styles.splashImage}
          onError={() => setSplashSource(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "72%",
    height: "72%",
    maxWidth: 360,
    maxHeight: 360,
  },
});

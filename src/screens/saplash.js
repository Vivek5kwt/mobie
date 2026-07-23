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
} from "../services/brandKitService";

const MIN_SPLASH_MS = 1200;
const BRAND_ASSET_WAIT_MS = 3500;
const DEFAULT_BACKGROUND = "transparent";

const toRemoteImageSource = (url) => {
  if (typeof url !== "string" || !url.trim()) return null;
  return { uri: url.trim() };
};

const normalizeColor = (value, fallback = DEFAULT_BACKGROUND) => {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  return color || fallback;
};

const isDarkColor = (value) => {
  if (typeof value !== "string") return false;
  const raw = value.trim().replace("#", "");
  const hex =
    raw.length === 3
      ? raw.split("").map((char) => char + char).join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false;

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
};

const resolveSplashUrl = (assets = {}) => {
  const splashUrl =
    typeof assets?.splashImageUrl === "string" ? assets.splashImageUrl.trim() : "";
  if (splashUrl) return splashUrl;

  if (assets?.splashShowBrandIcon === false) return "";

  const logoUrl = typeof assets?.logoUrl === "string" ? assets.logoUrl.trim() : "";
  if (logoUrl) return logoUrl;

  return typeof assets?.faviconUrl === "string" ? assets.faviconUrl.trim() : "";
};

export default function SplashScreen() {
  const navigation = useNavigation();
  const { initializing } = useAuth();

  const cachedBrandAssets = useMemo(() => getBrandKitAssetsSync() || {}, []);
  const hasCachedBrandAssets = Object.keys(cachedBrandAssets).length > 0;
  const cachedSplashUrl = useMemo(
    () => resolveSplashUrl(cachedBrandAssets),
    [cachedBrandAssets]
  );

  const [brandAssets, setBrandAssets] = useState(cachedBrandAssets);
  const [splashSource, setSplashSource] = useState(
    toRemoteImageSource(cachedSplashUrl)
  );
  const [brandReady, setBrandReady] = useState(hasCachedBrandAssets);
  const [authReady, setAuthReady] = useState(false);
  const [minTimeReady, setMinTimeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const finishWithAssets = async (assets = {}) => {
      if (cancelled) return;

      const splashUrl = resolveSplashUrl(assets);

      setBrandAssets(assets || {});

      if (splashUrl) {
        try {
          await Image.prefetch(splashUrl);
        } catch (_) {}
        if (!cancelled) {
          setSplashSource(toRemoteImageSource(splashUrl));
        }
      } else if (!cancelled) {
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

  const splashGradStart = normalizeColor(
    brandAssets?.splashGradStart || brandAssets?.splashBgColor,
    DEFAULT_BACKGROUND
  );
  const splashBgColor = normalizeColor(
    brandAssets?.splashBgColor || splashGradStart,
    splashGradStart
  );
  const splashGradEnd = normalizeColor(
    brandAssets?.splashGradEnd || brandAssets?.splashBgColor,
    splashGradStart
  );
  const statusBarStyle = isDarkColor(splashGradStart)
    ? "light-content"
    : "dark-content";

  return (
    <View style={[styles.container, { backgroundColor: splashBgColor }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={splashGradStart} />
      <LinearGradient
        colors={[splashGradStart, splashGradEnd]}
        style={StyleSheet.absoluteFillObject}
      />

      {splashSource ? (
        <Image
          source={splashSource}
          resizeMode="cover"
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
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";
import { fetchStoreConfig } from "../services/storeService";
import { getAppNameSync, getAppLogoSync } from "../utils/appInfo";

const { width: W, height: H } = Dimensions.get("window");
const DEFAULT_LOGO = require("../assets/logo/mobidraglogo.png");

// Minimum time the splash is visible — long enough to show the brand,
// short enough not to annoy users. Navigation happens when BOTH this
// flag AND auth initialisation are done (whichever takes longer).
const MIN_SPLASH_MS = 1200;

// ── Animated particles ────────────────────────────────────────────────────────
// Reduced from 18 → 8 to cut animation overhead on cold start.
function Particle({ delay, size, startX, startY, color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2400 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2400 + Math.random() * 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -55] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.65, 0.65, 0] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

// Deterministic — no re-creation on re-render, only 8 particles
const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  delay:  (i * 220) % 1600,
  size:   4 + (i % 4) * 2,
  startX: (i * 97) % (W - 20),
  startY: H * 0.3 + (i * 67) % (H * 0.45),
  color: i % 3 === 0 ? "#A78BFA" : i % 3 === 1 ? "#60A5FA" : "#34D399",
}));

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ progress }) {
  return (
    <View style={styles.progressTrack}>
      <Animated.View
        style={[
          styles.progressFill,
          {
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

// ── Main splash ───────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const navigation      = useNavigation();
  const { initializing } = useAuth();

  // ── Branding ──────────────────────────────────────────────────────────────
  const [appName,    setAppName]    = useState(getAppNameSync() || "MobiDrag");
  const [shopName,   setShopName]   = useState("");
  const [logoSource, setLogoSource] = useState(() => {
    const url = getAppLogoSync();
    return url ? { uri: url } : DEFAULT_LOGO;
  });

  // fetchStoreConfig is cosmetic only (shop name / logo) — never block navigation on it.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => { cancelled = true; }, 3000); // hard cut-off

    fetchStoreConfig().then((store) => {
      if (cancelled || !store) return;
      if (store.shop_name) setShopName(store.shop_name);
      const logo = getAppLogoSync();
      if (!logo && store.shopify_domain) {
        setLogoSource({ uri: `https://${store.shopify_domain}/favicon.ico` });
      }
    }).catch(() => {});

    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  // ── Animation values ──────────────────────────────────────────────────────
  const bgScale      = useRef(new Animated.Value(1.1)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const logoScale    = useRef(new Animated.Value(0.55)).current;
  const logoGlow     = useRef(new Animated.Value(0)).current;
  const titleY       = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subY         = useRef(new Animated.Value(16)).current;
  const subOpacity   = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale   = useRef(new Animated.Value(0.85)).current;
  const progress     = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  const ring1   = useRef(new Animated.Value(0.6)).current;
  const ring2   = useRef(new Animated.Value(0.6)).current;
  const ring1Op = useRef(new Animated.Value(0.4)).current;
  const ring2Op = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    // Background subtle zoom
    Animated.timing(bgScale, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    // Pulsing rings
    const pulse = (scale, opacity, dur, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 1.6, duration: dur, easing: Easing.out(Easing.sin), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,   duration: dur, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale,   { toValue: 0.6, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    pulse(ring1, ring1Op, 1400, 0);
    pulse(ring2, ring2Op, 1400, 700);

    // Logo springs in at 120ms
    Animated.sequence([
      Animated.delay(120),
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, friction: 5, tension: 65, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    // Logo glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // App name at 280ms
    Animated.sequence([
      Animated.delay(280),
      Animated.parallel([
        Animated.spring(titleY,       { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Sub-name at 420ms
    Animated.sequence([
      Animated.delay(420),
      Animated.parallel([
        Animated.spring(subY,       { toValue: 0, friction: 7, tension: 55, useNativeDriver: true }),
        Animated.timing(subOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    // Badge pops in at 580ms
    Animated.sequence([
      Animated.delay(580),
      Animated.parallel([
        Animated.spring(badgeScale,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]),
    ]).start();

    // Progress bar fills over MIN_SPLASH_MS starting immediately
    // useNativeDriver:false required for width % — kept on JS thread intentionally
    Animated.timing(progress, {
      toValue: 1,
      duration: MIN_SPLASH_MS - 100, // finishes just before navigate
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Footer fades in at 350ms
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(footerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Dual-ready navigation gate ────────────────────────────────────────────
  // Navigate only when BOTH conditions are true:
  //   1. Auth initialisation finished (restoreSession from AsyncStorage)
  //   2. Minimum brand-display time elapsed (MIN_SPLASH_MS)
  // Whichever finishes last triggers the navigation.
  const [authReady,    setAuthReady]    = useState(false);
  const [minTimeReady, setMinTimeReady] = useState(false);

  useEffect(() => {
    if (!initializing) setAuthReady(true);
  }, [initializing]);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeReady(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (authReady && minTimeReady) {
      navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] });
    }
  }, [authReady, minTimeReady, navigation]);

  const glowOpacity = logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
  const displayName = shopName || appName;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background layers */}
      <Animated.View style={[styles.bgLayer1, { transform: [{ scale: bgScale }] }]} />
      <View style={styles.bgLayer2} />
      <View style={styles.bgLayer3} />

      {/* Floating particles (8) */}
      {PARTICLES.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      {/* Pulse rings */}
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.ring,  { transform: [{ scale: ring1 }], opacity: ring1Op }]} />
        <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: ring2 }], opacity: ring2Op }]} />
      </View>

      {/* Center content */}
      <View style={styles.centerBlock}>
        <Animated.View style={[styles.logoHalo, { opacity: glowOpacity }]} />

        <Animated.View style={[styles.logoCard, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image
            source={logoSource}
            style={styles.logoImage}
            resizeMode="contain"
            onError={() => setLogoSource(DEFAULT_LOGO)}
          />
        </Animated.View>

        <Animated.Text
          style={[styles.appName, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}
          numberOfLines={1}
        >
          {displayName}
        </Animated.Text>

        <Animated.Text
          style={[styles.tagline, { opacity: subOpacity, transform: [{ translateY: subY }] }]}
        >
          YOUR STORE · EVERYWHERE
        </Animated.Text>

        <Animated.View style={[styles.badge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Powered by Mobidrag App Builder</Text>
        </Animated.View>
      </View>

      {/* Bottom area */}
      <Animated.View style={[styles.bottomBlock, { opacity: footerOpacity }]}>
        <ProgressBar progress={progress} />
        <Text style={styles.loadingLabel}>Loading your store…</Text>
      </Animated.View>
    </View>
  );
}

const ACCENT  = "#7C3AED";
const ACCENT2 = "#3B82F6";
const ACCENT3 = "#10B981";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A14",
    alignItems: "center",
    justifyContent: "center",
  },

  bgLayer1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0D0B1F",
  },
  bgLayer2: {
    position: "absolute",
    top: -H * 0.2,
    left: -W * 0.3,
    width: W * 1.1,
    height: W * 1.1,
    borderRadius: W,
    backgroundColor: "#1A0E3D",
    opacity: 0.6,
  },
  bgLayer3: {
    position: "absolute",
    bottom: -H * 0.1,
    right: -W * 0.2,
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W,
    backgroundColor: "#0C1A3A",
    opacity: 0.5,
  },

  ringContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: H * 0.5 - 110,
  },
  ring: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  ring2: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderColor: ACCENT2,
  },

  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -60,
  },

  logoHalo: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 60,
    elevation: 0,
  },

  logoCard: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 28,
  },
  logoImage: {
    width: 68,
    height: 68,
  },

  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 8,
    maxWidth: W * 0.8,
  },

  tagline: {
    fontSize: 11,
    color: "rgba(167,139,250,0.85)",
    letterSpacing: 4,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
  },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.15)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.35)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT3,
  },
  badgeText: {
    fontSize: 11,
    color: "rgba(167,139,250,0.9)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  bottomBlock: {
    position: "absolute",
    bottom: H * 0.08,
    left: 40,
    right: 40,
    alignItems: "center",
    gap: 10,
  },

  progressTrack: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },
  loadingLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 0.5,
    fontWeight: "400",
  },
});

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

// ── Animated particles ─────────────────────────────────────────────────────
function Particle({ delay, size, startX, startY, color }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 2800 + Math.random() * 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 2800 + Math.random() * 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.7, 0.7, 0] });

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

// Deterministic particles so we don't re-create on every render
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay:  (i * 320) % 2400,
  size:   3 + (i % 5) * 2,
  startX: (i * 71) % (W - 20),
  startY: H * 0.3 + (i * 53) % (H * 0.5),
  color: i % 3 === 0 ? "#A78BFA" : i % 3 === 1 ? "#60A5FA" : "#34D399",
}));

// ── Progress bar ───────────────────────────────────────────────────────────
function ProgressBar({ progress }) {
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
    </View>
  );
}

// ── Main splash ────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const navigation   = useNavigation();
  const { initializing } = useAuth();

  // ── Dynamic branding from store / app.json ──────────────────────────────
  const [appName,    setAppName]    = useState(getAppNameSync() || "MobiDrag");
  const [shopName,   setShopName]   = useState("");
  const [logoSource, setLogoSource] = useState(() => {
    const url = getAppLogoSync();
    return url ? { uri: url } : DEFAULT_LOGO;
  });

  useEffect(() => {
    fetchStoreConfig().then((store) => {
      if (!store) return;
      if (store.shop_name) setShopName(store.shop_name);
      // Use app.json logo first; only fall back to store domain-based logo
      const logo = getAppLogoSync();
      if (!logo && store.shopify_domain) {
        // Shopify stores often have a favicon we can try
        setLogoSource({ uri: `https://${store.shopify_domain}/favicon.ico` });
      }
    });
  }, []);

  // ── Animation values ─────────────────────────────────────────────────────
  const bgScale     = useRef(new Animated.Value(1.15)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.5)).current;
  const logoGlow    = useRef(new Animated.Value(0)).current;
  const titleY      = useRef(new Animated.Value(30)).current;
  const titleOpacity= useRef(new Animated.Value(0)).current;
  const subY        = useRef(new Animated.Value(20)).current;
  const subOpacity  = useRef(new Animated.Value(0)).current;
  const badgeOpacity= useRef(new Animated.Value(0)).current;
  const badgeScale  = useRef(new Animated.Value(0.8)).current;
  const progress    = useRef(new Animated.Value(0)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;

  // Ring pulse
  const ring1 = useRef(new Animated.Value(0.6)).current;
  const ring2 = useRef(new Animated.Value(0.6)).current;
  const ring1Op = useRef(new Animated.Value(0.4)).current;
  const ring2Op = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    // Background subtle zoom-in
    Animated.timing(bgScale, {
      toValue: 1,
      duration: 3000,
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
    pulse(ring1, ring1Op, 1600, 0);
    pulse(ring2, ring2Op, 1600, 800);

    // Logo springs in at 200ms
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Logo glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(logoGlow, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // App name slides up at 550ms
    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.spring(titleY,   { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
        Animated.timing(titleOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();

    // Shop sub-name at 750ms
    Animated.sequence([
      Animated.delay(750),
      Animated.parallel([
        Animated.spring(subY,   { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
        Animated.timing(subOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // "Built with Mobidrag" badge pops in at 1000ms
    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
        Animated.timing(badgeOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();

    // Progress bar fills over 2400ms starting at 400ms
    Animated.sequence([
      Animated.delay(400),
      Animated.timing(progress, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    // Footer fades in at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(footerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Navigate when ready ──────────────────────────────────────────────────
  useEffect(() => {
    if (initializing) return;
    const t = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] });
    }, 3200);
    return () => clearTimeout(t);
  }, [navigation, initializing]);

  const glowOpacity = logoGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
  const displayName = shopName || appName;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient-like overlay using layered views */}
      <Animated.View style={[styles.bgLayer1, { transform: [{ scale: bgScale }] }]} />
      <View style={styles.bgLayer2} />
      <View style={styles.bgLayer3} />

      {/* Floating particles */}
      {PARTICLES.map((p) => (
        <Particle key={p.id} {...p} />
      ))}

      {/* Pulse rings behind logo */}
      <View style={styles.ringContainer}>
        <Animated.View style={[styles.ring, { transform: [{ scale: ring1 }], opacity: ring1Op }]} />
        <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: ring2 }], opacity: ring2Op }]} />
      </View>

      {/* ── Center content ──────────────────────────────────────────────── */}
      <View style={styles.centerBlock}>

        {/* Logo glow halo */}
        <Animated.View style={[styles.logoHalo, { opacity: glowOpacity }]} />

        {/* Logo card */}
        <Animated.View style={[styles.logoCard, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image
            source={logoSource}
            style={styles.logoImage}
            resizeMode="contain"
            onError={() => setLogoSource(DEFAULT_LOGO)}
          />
        </Animated.View>

        {/* App / Shop name */}
        <Animated.Text
          style={[styles.appName, { opacity: titleOpacity, transform: [{ translateY: titleY }] }]}
          numberOfLines={1}
        >c;ls
          {displayName}
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[styles.tagline, { opacity: subOpacity, transform: [{ translateY: subY }] }]}
        >
          YOUR STORE · EVERYWHERE
        </Animated.Text>

        {/* "Built with Mobidrag" badge */}
        <Animated.View style={[styles.badge, { opacity: badgeOpacity, transform: [{ scale: badgeScale }] }]}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Powered by Mobidrag App Builder</Text>
        </Animated.View>
      </View>

      {/* ── Bottom area ──────────────────────────────────────────────────── */}
      <Animated.View style={[styles.bottomBlock, { opacity: footerOpacity }]}>
        {/* Progress bar */}
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

  // ── Background layers ─────────────────────────────────────────────────
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

  // ── Pulse rings ───────────────────────────────────────────────────────
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

  // ── Center block ──────────────────────────────────────────────────────
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -60,
  },

  // Glow halo behind the logo
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

  // Logo card
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

  // App name
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textAlign: "center",
    marginBottom: 8,
    maxWidth: W * 0.8,
  },

  // Tagline
  tagline: {
    fontSize: 11,
    color: "rgba(167,139,250,0.85)",
    letterSpacing: 4,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 24,
  },

  // "Built with Mobidrag" badge
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

  // ── Bottom block ──────────────────────────────────────────────────────
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

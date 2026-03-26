import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Text,
  Image,
  Dimensions,
} from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";
import { getAppNameSync, getAppLogoSync } from "../utils/appInfo";

const { height } = Dimensions.get("window");
const DEFAULT_LOGO = require("../assets/logo/mobidraglogo.png");

export default function SplashScreen() {
  const navigation = useNavigation();
  const { initializing } = useAuth();
  const [appName, setAppName] = useState("MobiDrag");
  const [logoSource, setLogoSource] = useState(DEFAULT_LOGO);

  // ── Animations ───────────────────────────────────────────────
  const logoFade    = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.65)).current;
  const ring1Scale  = useRef(new Animated.Value(0.5)).current;
  const ring1Opacity= useRef(new Animated.Value(0.5)).current;
  const ring2Scale  = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity= useRef(new Animated.Value(0.3)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;
  const taglineSlide= useRef(new Animated.Value(18)).current;
  const dot1        = useRef(new Animated.Value(0.2)).current;
  const dot2        = useRef(new Animated.Value(0.2)).current;
  const dot3        = useRef(new Animated.Value(0.2)).current;
  const footerFade  = useRef(new Animated.Value(0)).current;

  // ── Load dynamic app info ─────────────────────────────────────
  useEffect(() => {
    try {
      const name = getAppNameSync();
      const logoUrl = getAppLogoSync();
      setAppName(name);
      if (logoUrl && logoUrl.trim() !== "") {
        setLogoSource({ uri: logoUrl });
      }
    } catch (_) {}
  }, []);

  // ── Run animations ────────────────────────────────────────────
  useEffect(() => {
    // Logo springs in
    Animated.parallel([
      Animated.timing(logoFade, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing rings (loop)
    const pulseRing = (scale, opacity, duration, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1.5, duration, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.04, duration, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 0.6, duration, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.4, duration, useNativeDriver: true }),
          ]),
        ])
      ).start();
    };
    pulseRing(ring1Scale, ring1Opacity, 1800, 0);
    pulseRing(ring2Scale, ring2Opacity, 2000, 500);

    // Tagline slides up after logo
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(taglineFade, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(taglineSlide, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ]).start();
    }, 650);

    // Footer fades in
    setTimeout(() => {
      Animated.timing(footerFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();
    }, 1100);

    // Sequentially bouncing dots
    const animateDot = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 350, useNativeDriver: true }),
          Animated.delay(700),
        ])
      ).start();
    };
    animateDot(dot1, 0);
    animateDot(dot2, 220);
    animateDot(dot3, 440);

    if (initializing) return;

    const timeout = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [navigation, initializing]);

  return (
    <LinearGradient
      colors={["#0B1426", "#12224A", "#1B3068"]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}
    >
      {/* Pulsing background rings */}
      <Animated.View
        style={[
          styles.ring,
          { width: 300, height: 300, transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          { width: 450, height: 450, transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
        ]}
      />

      {/* Logo + branding */}
      <Animated.View
        style={[
          styles.brandBox,
          { opacity: logoFade, transform: [{ scale: logoScale }] },
        ]}
      >
        {/* Glow card around logo */}
        <View style={styles.logoCard}>
          <Image
            source={logoSource}
            style={styles.logo}
            onError={() => setLogoSource(DEFAULT_LOGO)}
          />
        </View>

        <Text style={styles.appName}>{appName}</Text>

        <Animated.Text
          style={[
            styles.tagline,
            { opacity: taglineFade, transform: [{ translateY: taglineSlide }] },
          ]}
        >
          BUILD · LAUNCH · SELL
        </Animated.Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, { opacity: dot1 }]} />
        <Animated.View style={[styles.dot, { opacity: dot2 }]} />
        <Animated.View style={[styles.dot, { opacity: dot3 }]} />
      </View>

      {/* Footer */}
      <Animated.Text style={[styles.footer, { opacity: footerFade }]}>
        Powered by MobiDrag
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  ring: {
    position: "absolute",
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#5B82FF",
  },

  brandBox: {
    alignItems: "center",
  },

  logoCard: {
    width: 128,
    height: 128,
    borderRadius: 32,
    backgroundColor: "rgba(91, 130, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    // Glow
    shadowColor: "#5B82FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 32,
    elevation: 14,
  },

  logo: {
    width: 88,
    height: 88,
    resizeMode: "contain",
  },

  appName: {
    fontSize: 38,
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
  },

  tagline: {
    fontSize: 12,
    color: "#7B9EFF",
    letterSpacing: 4,
    marginTop: 12,
    fontWeight: "600",
  },

  dotsRow: {
    flexDirection: "row",
    position: "absolute",
    bottom: height * 0.13,
    gap: 9,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#5B82FF",
  },

  footer: {
    position: "absolute",
    bottom: height * 0.055,
    color: "rgba(255, 255, 255, 0.22)",
    fontSize: 12,
    letterSpacing: 1.2,
  },
});

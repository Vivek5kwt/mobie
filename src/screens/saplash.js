import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Text, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";
const LOGO = require("../assets/logo/mobidraglogo.png");

export default function SplashScreen() {
  const navigation = useNavigation();
  const { session, initializing } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const circleScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),

      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),

      Animated.timing(circleScale, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]).start();

    if (initializing) return;

    // After animation → navigate based on auth state
    const timeout = setTimeout(() => {
      const nextRoute = session ? "LayoutScreen" : "Auth";
      navigation.reset({ index: 0, routes: [{ name: nextRoute }] });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [navigation, session, initializing]);

  return (
    <LinearGradient
      colors={["#0A0F29", "#1F233E", "#2D3A78"]}
      style={styles.container}
    >
      {/* Glowing expanding circle */}
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{ scale: circleScale }],
            opacity: circleScale.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.1],
            }),
          },
        ]}
      />

      <Animated.View
        style={[
          styles.brandBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image source={LOGO} style={styles.logo} />

        <Text style={styles.tagline}>Create. Drag. Build.</Text>
      </Animated.View>

      <Text style={styles.footerText}>
        Empowering Everyone To Build Apps
      </Text>
    </LinearGradient>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  circle: {
    position: "absolute",
    width: 340,
    height: 340,
    backgroundColor: "#657CFF",
    borderRadius: 200,
    opacity: 0.3,
    zIndex: -1,
  },

  brandBox: {
    alignItems: "center",
  },

  logo: {
    width: 200,
    height: 200,
    resizeMode: "contain",
    marginBottom: 12,
  },

  title: {
    fontSize: 34,
    color: "#FFFFFF",
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  tagline: {
    fontSize: 16,
    marginTop: -64,
    color: "#A9BEF9",
    letterSpacing: 0.5,
  },

  footerText: {
    position: "absolute",
    bottom: 40,
    color: "#B0C4FF",
    fontSize: 13
  },
});

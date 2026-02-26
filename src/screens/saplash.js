import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Animated, Text, Image } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/AuthContext";
import { getAppNameSync, getAppLogoSync } from "../utils/appInfo";

const DEFAULT_LOGO = require("../assets/logo/mobidraglogo.png");

export default function SplashScreen() {
  const navigation = useNavigation();
  const { initializing } = useAuth();
  const [appName, setAppName] = useState("MobiDrag");
  const [logoSource, setLogoSource] = useState(DEFAULT_LOGO);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.4)).current;
  const circleScale = useRef(new Animated.Value(0)).current;

  // Load app info on mount
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const name = getAppNameSync();
        const logoUrl = getAppLogoSync();
        
        setAppName(name);
        
        if (logoUrl && logoUrl.trim() !== "") {
          setLogoSource({ uri: logoUrl });
        } else {
          setLogoSource(DEFAULT_LOGO);
        }
      } catch (error) {
        console.log("Error loading app info:", error);
        setAppName("MobiDrag");
        setLogoSource(DEFAULT_LOGO);
      }
    };
    
    loadAppInfo();
  }, []);

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

    // After animation → always navigate directly to the main layout
    const timeout = setTimeout(() => {
      navigation.reset({ index: 0, routes: [{ name: "LayoutScreen" }] });
    }, 3000);

    return () => clearTimeout(timeout);
  }, [navigation, initializing]);

  return (
    <LinearGradient
      colors={["#F7F9FF", "#E7EEFF", "#D7E2FF"]}
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
        <Image 
          source={logoSource} 
          style={styles.logo}
          onError={() => setLogoSource(DEFAULT_LOGO)}
        />

        <Text style={styles.appName}>{appName}</Text>
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
    backgroundColor: "#9BB0FF",
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
    shadowColor: "#3C4A8A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },

  appName: {
    fontSize: 34,
    color: "#1F2A4B",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginTop: 16,
    textAlign: "center",
  },

  tagline: {
    fontSize: 16,
    marginTop: 8,
    color: "#5A6BA8",
    letterSpacing: 0.5,
  },

  footerText: {
    position: "absolute",
    bottom: 40,
    color: "#6B7BB3",
    fontSize: 13
  },
});
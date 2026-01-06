import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import { ApolloProvider } from "@apollo/client/react";
import client from "./src/apollo/client";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import SplashScreen from "./src/screens/saplash";
import LayoutScreen from './src/screens/LayoutScreen';
import AuthScreen from "./src/screens/AuthScreen";
import BottomNavScreen from "./src/screens/BottomNavScreen";
import ProductDetailScreen from "./src/screens/ProductDetailScreen";
import { AuthProvider } from "./src/services/AuthContext";

import tokenLogger from './src/utils/tokenLogger';
import messaging from '@react-native-firebase/messaging';

const Stack = createNativeStackNavigator();

export default function App() {

  /**
   * Request permission + get FCM token
   */
  const getFCMToken = async () => {
    try {
      console.log("🔔 Requesting notification permission...");

      // (iOS safe + Android ok)
      await messaging().registerDeviceForRemoteMessages();

      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log("🔐 Permission status:", authStatus);

      if (enabled) {
        const fcmToken = await messaging().getToken();

        if (fcmToken) {
          console.log("🔥 FCM TOKEN RECEIVED");
          await tokenLogger.setToken(fcmToken, true);
        } else {
          console.log("⚠️ FCM Token NOT received");
        }
      } else {
        console.log("❌ Notification permission NOT granted");
      }

    } catch (error: any) {
      console.log("🔥 FCM error:", error?.message || error);
    }
  };


  /**
   * Setup Device Token
   */
  const setupDeviceToken = async () => {
    try {
      console.log("📱 Setting up device token...");

      // 1️⃣ Check stored token first
      const storedToken = await tokenLogger.getStoredToken();

      if (storedToken) {
        console.log("✅ Stored token found — logging it again");
        await tokenLogger.setToken(storedToken, true);
      }

      // 2️⃣ Get fresh token
      await getFCMToken();

    } catch (error: any) {
      console.log("🔥 setupDeviceToken error:", error?.message || error);
    }
  };


  /**
   * Run once on app start
   */
  useEffect(() => {
    setupDeviceToken();
  }, []);

  /**
   * Listen for FCM notifications while app is open
   */
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage?.notification?.title || 'New Notification';
      const body = remoteMessage?.notification?.body || 'You have a new message.';
      const messageText = body ? `${title}\n${body}` : title;

      if (typeof global?.showToast === 'function') {
        global.showToast(messageText, 'LONG');
      } else {
        Alert.alert(title, body);
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Handle notifications opened from background/quit state
   */
  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      const title = remoteMessage?.notification?.title || 'Notification Opened';
      const body = remoteMessage?.notification?.body || '';
      const messageText = body ? `${title}\n${body}` : title;

      if (typeof global?.showToast === 'function') {
        global.showToast(messageText, 'LONG');
      } else {
        Alert.alert(title, body);
      }
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          const title = remoteMessage?.notification?.title || 'Notification Opened';
          const body = remoteMessage?.notification?.body || '';
          const messageText = body ? `${title}\n${body}` : title;

          if (typeof global?.showToast === 'function') {
            global.showToast(messageText, 'LONG');
          } else {
            Alert.alert(title, body);
          }
        }
      });

    return unsubscribe;
  }, []);


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ApolloProvider client={client}>
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{ headerShown: false }}
                initialRouteName="Splash"
              >

              {/* 🔥 First Screen: Splash */}
              <Stack.Screen name="Splash" component={SplashScreen} />

              {/* 🔥 Auth Screen */}
              <Stack.Screen name="Auth" component={AuthScreen} />

              {/* 🔥 Main Screen */}
              <Stack.Screen
                name="LayoutScreen"
                component={LayoutScreen}
                options={{ animation: "none" }}
              />

              {/* 🔥 Bottom navigation destinations */}
              <Stack.Screen
                name="BottomNavScreen"
                component={BottomNavScreen}
                options={{ animation: "none" }}
              />

              {/* 🔥 Product Details Screen */}
              <Stack.Screen
                name="ProductDetail"
                component={ProductDetailScreen}
                options={{ animation: "slide_from_right" }}
              />

              </Stack.Navigator>
            </NavigationContainer>
          </ApolloProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

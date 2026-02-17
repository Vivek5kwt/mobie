import React, { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ApolloProvider } from "@apollo/client/react";
import client from "./src/apollo/client";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "react-redux";

import SplashScreen from "./src/screens/saplash";
import LayoutScreen from './src/screens/LayoutScreen';
import AuthScreen from "./src/screens/AuthScreen";
import BottomNavScreen from "./src/screens/BottomNavScreen";
import ProductDetailScreen from "./src/screens/ProductDetailScreen";
import CheckoutWebViewScreen from "./src/screens/CheckoutWebViewScreen";
import CollectionProductsScreen from "./src/screens/CollectionProductsScreen";
import AllProductsScreen from "./src/screens/AllProductsScreen";
import { AuthProvider } from "./src/services/AuthContext";
import { store } from "./src/store";

import tokenLogger from './src/utils/tokenLogger';
import messaging from '@react-native-firebase/messaging';
import analytics from '@react-native-firebase/analytics';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | undefined>(undefined);

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
@@ -72,50 +75,69 @@ export default function App() {

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
   * Force-send a one-time Analytics event on app launch.
   */
  useEffect(() => {
    const logAppOpenTest = async () => {
      try {
        await analytics().setAnalyticsCollectionEnabled(true);
        await analytics().logEvent('app_open_test', {
          source: 'app_launch',
        });
        console.log('📊 Analytics event sent: app_open_test');
      } catch (error: any) {
        console.log('🔥 Analytics app_open_test error:', error?.message || error);
      }
    };

    logAppOpenTest();
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
@@ -133,51 +155,74 @@ export default function App() {
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
      <Provider store={store}>
        <SafeAreaProvider>
          <AuthProvider>
            <ApolloProvider client={client}>
              <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                  routeNameRef.current = navigationRef.getCurrentRoute()?.name;
                }}
                onStateChange={async () => {
                  const previousRouteName = routeNameRef.current;
                  const currentRouteName = navigationRef.getCurrentRoute()?.name;

                  if (currentRouteName && previousRouteName !== currentRouteName) {
                    try {
                      await analytics().logScreenView({
                        screen_name: currentRouteName,
                        screen_class: currentRouteName,
                      });
                      console.log(`📊 Analytics screen_view sent: ${currentRouteName}`);
                    } catch (error: any) {
                      console.log('🔥 Analytics screen_view error:', error?.message || error);
                    }
                  }

                  routeNameRef.current = currentRouteName;
                }}
              >
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

              {/* 🔥 Checkout WebView Screen */}
              <Stack.Screen
                name="CheckoutWebView"
                component={CheckoutWebViewScreen}
                options={{ animation: "slide_from_right" }}
              />

              {/* 🔥 Collection Products Screen */}
              <Stack.Screen
                name="CollectionProducts"
                component={CollectionProductsScreen}
                options={{ animation: "slide_from_right" }}
              />

              {/* 🔥 All Products Screen */}
              <Stack.Screen
                name="AllProducts"
                component={AllProductsScreen}
                options={{ animation: "slide_from_right" }}
              />

                </Stack.Navigator>
              </NavigationContainer>
            </ApolloProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

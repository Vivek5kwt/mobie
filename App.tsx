import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ApolloProvider } from '@apollo/client/react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import Firebase messaging safely - don't crash if Firebase is not initialized
let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
  console.log('⚠️ Firebase messaging not available in App.tsx:', (error as any)?.message);
}

import client from './src/apollo/client';
import AllProductsScreen from './src/screens/AllProductsScreen';
import BottomNavScreen from './src/screens/BottomNavScreen';
import CheckoutWebViewScreen from './src/screens/CheckoutWebViewScreen';
import CollectionProductsScreen from './src/screens/CollectionProductsScreen';
import LayoutScreen from './src/screens/LayoutScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import SplashScreen from './src/screens/saplash';
import AuthScreen from './src/screens/AuthScreen';
import AuthProvider from './src/services/AuthContext';
import { store } from './src/store';
import tokenLogger from './src/utils/tokenLogger';

const Stack = createNativeStackNavigator();

type AnalyticsModule = {
  setAnalyticsCollectionEnabled: (enabled: boolean) => Promise<void>;
  logEvent: (eventName: string, params?: Record<string, any>) => Promise<void>;
  logScreenView: (params: { screen_name: string; screen_class: string }) => Promise<void>;
};

const loadAnalytics = (): (() => AnalyticsModule) | null => {
  try {
    const moduleName = '@react-native-firebase/' + 'analytics';
    const analyticsModule = require(moduleName);
    return analyticsModule.default ?? analyticsModule;
  } catch (error: any) {
    console.log(
      '⚠️ Firebase analytics module is not installed. Analytics events will be skipped.',
      error?.message || error,
    );
    return null;
  }
};

type ToastGlobal = {
  showToast?: (message: string, duration?: string) => void;
};

type GestureHandlerRootViewComponent = React.ComponentType<
  PropsWithChildren<React.ComponentProps<typeof GestureHandlerRootView>>
>;

const GestureRootView = GestureHandlerRootView as GestureHandlerRootViewComponent;

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | undefined>(undefined);
  const analyticsRef = useRef<(() => AnalyticsModule) | null>(loadAnalytics());

  const showInAppMessage = (title: string, body: string) => {
    const messageText = body ? `${title}\n${body}` : title;
    const toastFn = (global as ToastGlobal)?.showToast;

    if (typeof toastFn === 'function') {
      toastFn(messageText, 'LONG');
    } else {
      Alert.alert(title, body);
    }
  };

  /**
   * Request permission + get FCM token.
   */
  const getFCMToken = async () => {
    try {
      // Check if Firebase messaging is available
      if (!messaging) {
        console.log('⚠️ Firebase messaging not available, skipping FCM token request');
        return;
      }

      console.log('🔔 Requesting notification permission...');

      // Check if Firebase is initialized before using it
      try {
        await messaging().registerDeviceForRemoteMessages();
      } catch (firebaseError: any) {
        console.log('⚠️ Firebase not initialized or package name mismatch:', firebaseError?.message);
        console.log('⚠️ Skipping Firebase messaging initialization');
        return;
      }

      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('🔐 Permission status:', authStatus);

      if (!enabled) {
        console.log('⚠️ Notification permissions not granted.');
        return;
      }

      const fcmToken = await messaging().getToken();

      if (fcmToken) {
        console.log('🔥 FCM TOKEN RECEIVED');
        await tokenLogger.setToken(fcmToken, true);
      } else {
        console.log('⚠️ No FCM token returned by Firebase.');
      }
    } catch (error: any) {
      console.log('🔥 getFCMToken error:', error?.message || error);
    }
  };

  const setupDeviceToken = async () => {
    try {
      const storedToken = await tokenLogger.getStoredToken();

      if (storedToken) {
        console.log('✅ Stored token found — logging it again');
        await tokenLogger.setToken(storedToken, true);
      }

      await getFCMToken();
    } catch (error: any) {
      console.log('🔥 setupDeviceToken error:', error?.message || error);
    }
  };

  useEffect(() => {
    setupDeviceToken();
  }, []);

  useEffect(() => {
    if (!analyticsRef.current) {
      return;
    }

    const logAppOpenTest = async () => {
      try {
        await analyticsRef.current?.().setAnalyticsCollectionEnabled(true);
        await analyticsRef.current?.().logEvent('app_open_test', {
          source: 'app_launch',
        });
        console.log('📊 Analytics event sent: app_open_test');
      } catch (error: any) {
        console.log('🔥 Analytics app_open_test error:', error?.message || error);
      }
    };

    logAppOpenTest();
  }, []);

  useEffect(() => {
    // Only set up message handler if Firebase messaging is available
    if (!messaging) {
      console.log('⚠️ Firebase messaging not available, skipping onMessage handler');
      return;
    }

    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage?.notification?.title || 'New Notification';
      const body = remoteMessage?.notification?.body || 'You have a new message.';
      showInAppMessage(title, body);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Only set up notification handlers if Firebase messaging is available
    if (!messaging) {
      console.log('⚠️ Firebase messaging not available, skipping notification handlers');
      return;
    }

    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      const title = remoteMessage?.notification?.title || 'Notification Opened';
      const body = remoteMessage?.notification?.body || '';
      showInAppMessage(title, body);
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (!remoteMessage) {
          return;
        }

        const title = remoteMessage?.notification?.title || 'Notification Opened';
        const body = remoteMessage?.notification?.body || '';
        showInAppMessage(title, body);
      })
      .catch((error: any) => {
        console.log('⚠️ Error getting initial notification:', error?.message);
      });

    return unsubscribe;
  }, []);

  return (
    <GestureRootView style={{ flex: 1 }}>
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
                    if (!analyticsRef.current) {
                      routeNameRef.current = currentRouteName;
                      return;
                    }

                    try {
                      await analyticsRef.current?.().logScreenView({
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
                  <Stack.Screen name="Splash" component={SplashScreen} />
                  <Stack.Screen name="Auth" component={AuthScreen} />

                  <Stack.Screen
                    name="LayoutScreen"
                    component={LayoutScreen}
                    options={{ animation: 'none' }}
                  />

                  <Stack.Screen
                    name="BottomNavScreen"
                    component={BottomNavScreen}
                    options={{ animation: 'none' }}
                  />

                  <Stack.Screen
                    name="ProductDetail"
                    component={ProductDetailScreen}
                    options={{ animation: 'slide_from_right' }}
                  />

                  <Stack.Screen
                    name="CheckoutWebView"
                    component={CheckoutWebViewScreen}
                    options={{ animation: 'slide_from_right' }}
                  />

                  <Stack.Screen
                    name="CollectionProducts"
                    component={CollectionProductsScreen}
                    options={{ animation: 'slide_from_right' }}
                  />

                  <Stack.Screen
                    name="AllProducts"
                    component={AllProductsScreen}
                    options={{ animation: 'slide_from_right' }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </ApolloProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureRootView>
  );
}

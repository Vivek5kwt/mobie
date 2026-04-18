import React, { PropsWithChildren, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { ApolloProvider } from '@apollo/client/react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import tokenLogger from './src/utils/tokenLogger';
import { resolveAppId } from './src/utils/appId';

// Import Firebase messaging safely - don't crash if Firebase is not initialized
let messaging: any = null;
try {
  messaging = require('@react-native-firebase/messaging').default;
} catch (error) {
  console.log('⚠️ Firebase messaging not available in App.tsx:', (error as any)?.message);
}

import client from './src/apollo/client';
import { StoreProvider } from './src/services/StoreContext';
import AllProductsScreen from './src/screens/AllProductsScreen';
import BottomNavScreen from './src/screens/BottomNavScreen';
import CheckoutWebViewScreen from './src/screens/CheckoutWebViewScreen';
import CollectionProductsScreen from './src/screens/CollectionProductsScreen';
import LayoutScreen from './src/screens/LayoutScreen';
import OrderDetailScreen from './src/screens/OrderDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PostPurchaseScreen from './src/screens/PostPurchaseScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';
import SplashScreen from './src/screens/saplash';
import AuthScreen from './src/screens/AuthScreen';
import AuthProvider from './src/services/AuthContext';
import { store } from './src/store';

const Stack = createNativeStackNavigator();

type ToastGlobal = {
  showToast?: (message: string, duration?: string) => void;
};

type GestureHandlerRootViewComponent = React.ComponentType<
  PropsWithChildren<React.ComponentProps<typeof GestureHandlerRootView>>
>;

const GestureRootView = GestureHandlerRootView as GestureHandlerRootViewComponent;

/** Order event types that map to specific screens when notification is tapped */
const ORDER_NOTIFICATION_TYPES = new Set([
  'order_placed',
  'order_purchased',
  'order_canceled',
]);

export default function App() {
  const navigationRef = useNavigationContainerRef();

  // ── In-app toast / alert for foreground notifications ─────────────────────
  const showInAppMessage = useCallback((title: string, body: string) => {
    const messageText = body ? `${title}\n${body}` : title;
    const toastFn = (global as ToastGlobal)?.showToast;
    if (typeof toastFn === 'function') {
      toastFn(messageText, 'LONG');
    } else {
      Alert.alert(title, body);
    }
  }, []);

  // ── Navigate to OrderDetail when user taps a notification ─────────────────
  const handleNotificationNavigation = useCallback(
    (remoteMessage: any) => {
      if (!remoteMessage) return;
      const data = remoteMessage?.data || {};
      const type: string = data?.type || '';

      if (!ORDER_NOTIFICATION_TYPES.has(type)) return;

      // Build a minimal order object from the notification data payload
      const order = {
        orderNumber: data.orderId ? `#${data.orderId}` : data.orderNumber || '',
        status: type === 'order_canceled' ? 'Canceled' : 'Order Placed',
      };

      // Navigate — works in background; for killed state use onReady callback below
      try {
        navigationRef.navigate('OrderDetail' as never, { order } as never);
      } catch (_) {}
    },
    [navigationRef],
  );

  // ── FCM setup: permission → token capture → all message listeners ─────────
  useEffect(() => {
    const setupFCM = async () => {
      try {
        if (!messaging) {
          console.log('⚠️ Firebase messaging not available — skipping FCM setup');
          return;
        }

        // 1. Request notification permission (required on iOS)
        const authStatus = await messaging().requestPermission();
        const granted =
          authStatus === messaging.AuthorizationStatus?.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus?.PROVISIONAL ||
          authStatus === 1 || // AUTHORIZED
          authStatus === 2;   // PROVISIONAL

        if (!granted) {
          console.log('⚠️ FCM permission denied by user');
          return;
        }

        // 2. Generate FCM token and register it on the backend immediately
        await tokenLogger.captureToken(resolveAppId());

        // 3. Foreground message: show in-app toast/alert while app is open
        const unsubMessage = messaging().onMessage(async (remoteMessage: any) => {
          const title = remoteMessage?.notification?.title || 'New Notification';
          const body  = remoteMessage?.notification?.body  || '';
          console.log('📩 Foreground FCM message received:', title);
          showInAppMessage(title, body);
        });

        // 4. Background tap: app was in background, user tapped notification
        const unsubOpen = messaging().onNotificationOpenedApp((remoteMessage: any) => {
          console.log('📲 Notification opened from background:', remoteMessage?.data?.type);
          handleNotificationNavigation(remoteMessage);
        });

        // 5. Token refresh — register new token on backend immediately
        const unsubRefresh = messaging().onTokenRefresh(async (newToken: string) => {
          console.log('🔄 FCM token refreshed');
          await tokenLogger.refreshToken(newToken, null, resolveAppId());
        });

        return () => {
          unsubMessage();
          unsubOpen();
          unsubRefresh();
        };
      } catch (error: any) {
        console.log('❌ FCM setup error:', error?.message);
      }
    };

    let cleanup: (() => void) | undefined;
    setupFCM().then((unsub) => { cleanup = unsub; });
    return () => { cleanup?.(); };
  }, [showInAppMessage, handleNotificationNavigation]);

  return (
    <GestureRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <StoreProvider>
            <AuthProvider>
              <ApolloProvider client={client}>
                <NavigationContainer
                  ref={navigationRef}
                  onReady={() => {
                    // 6. Killed-state: app was closed, user tapped notification to open it
                    if (!messaging) return;
                    messaging()
                      .getInitialNotification()
                      .then((remoteMessage: any) => {
                        if (remoteMessage) {
                          console.log('🚀 App opened from killed state via notification:', remoteMessage?.data?.type);
                          handleNotificationNavigation(remoteMessage);
                        }
                      })
                      .catch(() => {});
                  }}
                >
                  <Stack.Navigator
                    id={undefined}
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

                    <Stack.Screen
                      name="OrderDetail"
                      component={OrderDetailScreen}
                      options={{ animation: 'slide_from_right' }}
                    />

                    <Stack.Screen
                      name="Settings"
                      component={SettingsScreen}
                      options={{ animation: 'slide_from_right' }}
                    />

                    <Stack.Screen
                      name="PostPurchase"
                      component={PostPurchaseScreen}
                      options={{ animation: 'fade', gestureEnabled: false }}
                    />
                  </Stack.Navigator>
                </NavigationContainer>
              </ApolloProvider>
            </AuthProvider>
          </StoreProvider>
        </SafeAreaProvider>
      </Provider>
    </GestureRootView>
  );
}

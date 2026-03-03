import React, { PropsWithChildren } from 'react';
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

const Stack = createNativeStackNavigator();

type ToastGlobal = {
  showToast?: (message: string, duration?: string) => void;
};

type GestureHandlerRootViewComponent = React.ComponentType<
  PropsWithChildren<React.ComponentProps<typeof GestureHandlerRootView>>
>;

const GestureRootView = GestureHandlerRootView as GestureHandlerRootViewComponent;

export default function App() {
  const showInAppMessage = (title: string, body: string) => {
    const messageText = body ? `${title}\n${body}` : title;
    const toastFn = (global as ToastGlobal)?.showToast;

    if (typeof toastFn === 'function') {
      toastFn(messageText, 'LONG');
    } else {
      Alert.alert(title, body);
    }
  };

  return (
    <GestureRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <AuthProvider>
            <ApolloProvider client={client}>
              <NavigationContainer>
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

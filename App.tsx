
import React, { useEffect } from 'react';
import { ApolloProvider } from "@apollo/client/react";
import client from "./src/apollo/client";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "./src/screens/saplash";
import LayoutScreen from './src/screens/LayoutScreen';

import tokenLogger from './src/utils/tokenLogger';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    setupDeviceToken();
  }, []);

  const setupDeviceToken = async () => {
    try {
      const storedToken = await tokenLogger.getStoredToken();
      if (storedToken) {
        tokenLogger.setToken(storedToken);
        return;
      }
      await getFCMToken();
    } catch (error) {}
  };

  const getFCMToken = async () => {
    try {
      const messaging = require('@react-native-firebase/messaging');
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        const fcmToken = await messaging().getToken();
        if (fcmToken) tokenLogger.setToken(fcmToken);
      }
    } catch (error) {}
  };

  return (
    <ApolloProvider client={client}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          
          {/* 🔥 First Screen: Splash */}
          <Stack.Screen name="Splash" component={SplashScreen} />

          {/* 🔥 Main Screen: Your builder UI */}
          <Stack.Screen name="LayoutScreen" component={LayoutScreen} />

        </Stack.Navigator>
      </NavigationContainer>
    </ApolloProvider>
  );
}
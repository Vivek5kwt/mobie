/**
 * @format
 */

import { AppRegistry, Platform, ToastAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// ✅ Define toast globally for BOTH platforms
const resolveToastDuration = duration => {
  if (typeof duration === 'number') {
    return duration;
  }

  if (duration === 'LONG') {
    return ToastAndroid.LENGTH_LONG ?? 3500;
  }

  return ToastAndroid.LENGTH_SHORT ?? 2000;
};

global.showToast = (message, duration = 'SHORT') => {
  if (Platform.OS === 'android') {
    const safeMessage =
      typeof message === 'string' ? message : JSON.stringify(message ?? '');

    ToastAndroid.show(safeMessage, resolveToastDuration(duration));
  } else {
    Alert.alert('', String(message ?? ''));
  }
};

// ✅ Handle background messages (data-only or notification + data)
// Wrap in try-catch to prevent crashes if Firebase is not initialized
try {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('🔕 Background message received:', remoteMessage?.messageId);
  });
} catch (error) {
  console.log('⚠️ Firebase messaging not initialized, background handler not set:', error?.message);
}

AppRegistry.registerComponent(appName, () => App);

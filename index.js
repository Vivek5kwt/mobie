/**
 * @format
 */

import { AppRegistry, Platform, ToastAndroid, Alert } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Firebase is temporarily disabled for this build.

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

AppRegistry.registerComponent(appName, () => App);

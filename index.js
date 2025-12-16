/**
 * @format
 */

import { AppRegistry, Platform, ToastAndroid, Alert } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// ✅ Define toast globally for BOTH platforms
global.showToast = (message, duration = 'SHORT') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(
      message,
      duration === 'LONG'
        ? ToastAndroid.LENGTH_LONG
        : ToastAndroid.LENGTH_SHORT,
    );
  } else {
    Alert.alert('', message);
  }
};

AppRegistry.registerComponent(appName, () => App);

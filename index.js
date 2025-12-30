/**
 * @format
 */

import { AppRegistry, Platform, ToastAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
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

// ✅ Handle background messages (data-only or notification + data)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('🔕 Background message received:', remoteMessage?.messageId);
});

AppRegistry.registerComponent(appName, () => App);

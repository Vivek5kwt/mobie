/**
 * @format
 */

import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Better approach - Replace ToastAndroid with unified solution
if (Platform.OS === 'ios') {
  // Create a unified toast function that works on both platforms
  global.showToast = (message, duration = 'SHORT') => {
    if (Platform.OS === 'android') {
      const { ToastAndroid } = require('react-native');
      ToastAndroid.show(message, 
        duration === 'LONG' ? ToastAndroid.LENGTH_LONG : ToastAndroid.LENGTH_SHORT
      );
    } else {
      // For iOS, use Alert or any other UI feedback
      const { Alert } = require('react-native');
      Alert.alert('', message);
    }
  };
}

AppRegistry.registerComponent(appName, () => App);
import { Platform } from 'react-native';

let messagingModule = null;
let didCheckMessaging = false;

export const getFirebaseMessaging = () => {
  if (didCheckMessaging) {
    return messagingModule;
  }

  didCheckMessaging = true;

  try {
    if (Platform.OS === 'ios') {
      const firebaseApp = require('@react-native-firebase/app').default;
      const configuredApps = Array.isArray(firebaseApp?.apps) ? firebaseApp.apps : [];

      if (configuredApps.length === 0) {
        console.log(
          'Firebase messaging skipped on iOS: GoogleService-Info.plist is not configured.',
        );
        return null;
      }
    }

    const messaging = require('@react-native-firebase/messaging').default;
    messagingModule = typeof messaging === 'function' ? messaging : null;
  } catch (error) {
    console.log('Firebase messaging unavailable:', error?.message || String(error));
    messagingModule = null;
  }

  return messagingModule;
};

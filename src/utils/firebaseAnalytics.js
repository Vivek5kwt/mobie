import { Platform } from "react-native";

let analyticsModule = null;
let didCheckAnalytics = false;

export const getFirebaseAnalytics = () => {
  if (didCheckAnalytics) {
    return analyticsModule;
  }

  didCheckAnalytics = true;

  try {
    if (Platform.OS === "ios") {
      const firebaseApp = require("@react-native-firebase/app").default;
      const configuredApps = Array.isArray(firebaseApp?.apps) ? firebaseApp.apps : [];

      if (configuredApps.length === 0) {
        console.log(
          "Firebase analytics skipped on iOS: GoogleService-Info.plist is not configured."
        );
        return null;
      }
    }

    const analytics = require("@react-native-firebase/analytics").default;
    analyticsModule = typeof analytics === "function" ? analytics : null;
  } catch (error) {
    console.log("Firebase analytics unavailable:", error?.message || String(error));
    analyticsModule = null;
  }

  return analyticsModule;
};

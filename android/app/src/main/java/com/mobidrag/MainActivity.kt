package com.mobidrag

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   * Uses BuildConfig.APP_NAME which is set from app.json during build to ensure consistency
   */
  override fun getMainComponentName(): String {
    return try {
      // Use BuildConfig.APP_NAME which is set from app.json during Gradle build
      // This ensures it matches the app name used when React Native bundle was created
      com.mobidrag.BuildConfig.APP_NAME
    } catch (e: Exception) {
      // Fallback to default if BuildConfig is not available
      android.util.Log.e("MainActivity", "Error reading BuildConfig.APP_NAME: ${e.message}")
      "MobiDrag"
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

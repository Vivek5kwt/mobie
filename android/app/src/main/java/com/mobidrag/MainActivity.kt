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
      // Try to read app name from app.json in assets first (most reliable)
      val inputStream = assets.open("app.json")
      val json = inputStream.bufferedReader().use { it.readText() }
      val appJson = org.json.JSONObject(json)
      val appName = appJson.optString("name", null)
      inputStream.close()
      
      if (appName != null && appName.isNotEmpty()) {
        android.util.Log.d("MainActivity", "Using app name from app.json: $appName")
        return appName
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "Could not read app.json from assets: ${e.message}")
    }
    
    // Fallback 1: Try BuildConfig (only works if in same package)
    try {
      BuildConfig.APP_NAME.let { appName ->
        if (appName.isNotEmpty()) {
          android.util.Log.d("MainActivity", "✅ Using app name from BuildConfig: $appName")
          return appName
        }
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ Could not read BuildConfig.APP_NAME: ${e.message}")
    }
    
    // Fallback 2: Read from strings.xml
    try {
      val appName = resources.getString(R.string.app_name)
      if (appName.isNotEmpty()) {
        android.util.Log.d("MainActivity", "✅ Using app name from strings.xml: $appName")
        return appName
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ Could not read app name from strings.xml: ${e.message}")
    }
    
    // Final fallback
    android.util.Log.e("MainActivity", "❌ All methods failed, using default: MobiDrag")
    return "MobiDrag"
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

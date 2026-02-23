package com.mobidrag.builder.app160

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
    var appName: String? = null
    
    // Method 1: Read from app.json in assets (most reliable - matches index.js)
    try {
      val inputStream = assets.open("app.json")
      val json = inputStream.bufferedReader().use { it.readText() }
      val appJson = org.json.JSONObject(json)
      appName = appJson.optString("name", null)
      inputStream.close()
      
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from app.json: $appName")
        return appName
      }
    } catch (e: java.io.FileNotFoundException) {
      android.util.Log.w("MainActivity", "⚠️ app.json not found in assets, trying fallbacks...")
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ Error reading app.json: ${e.message}, trying fallbacks...")
    }
    
    // Method 2: Try BuildConfig from application package (not MainActivity package)
    try {
      val applicationPackageName = applicationContext.packageName
      @Suppress("UNCHECKED_CAST")
      val buildConfigClass = Class.forName("$applicationPackageName.BuildConfig")
      val appNameField = buildConfigClass.getField("APP_NAME")
      appName = appNameField.get(null) as? String
      
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from BuildConfig: $appName")
        return appName
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ BuildConfig not available: ${e.message}")
    }
    
    // Method 3: Read from strings.xml
    try {
      appName = resources.getString(R.string.app_name)
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from strings.xml: $appName")
        return appName
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ strings.xml not available: ${e.message}")
    }
    
    // Final fallback - must match index.js default
    // index.js uses: import { name as appName } from './app.json';
    // So default should be "MobiDrag" to match app.json
    android.util.Log.w("MainActivity", "⚠️ All methods failed, using default: MobiDrag")
    return "MobiDrag"
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}

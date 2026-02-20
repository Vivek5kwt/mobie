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
    var appName: String? = null
    
    // Method 1: Read from app.json in assets (most reliable)
    try {
      // List available assets for debugging
      val assetFiles = assets.list("")
      android.util.Log.d("MainActivity", "📁 Available assets: ${assetFiles?.joinToString(", ") ?: "none"}")
      
      val inputStream = assets.open("app.json")
      val json = inputStream.bufferedReader().use { it.readText() }
      android.util.Log.d("MainActivity", "📄 app.json content: $json")
      
      val appJson = org.json.JSONObject(json)
      appName = appJson.optString("name", null)
      inputStream.close()
      
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from app.json: $appName")
        return appName
      } else {
        android.util.Log.w("MainActivity", "⚠️ app.json 'name' field is empty or null")
      }
    } catch (e: java.io.FileNotFoundException) {
      android.util.Log.e("MainActivity", "❌ app.json not found in assets: ${e.message}")
    } catch (e: org.json.JSONException) {
      android.util.Log.e("MainActivity", "❌ Invalid JSON in app.json: ${e.message}")
    } catch (e: Exception) {
      android.util.Log.e("MainActivity", "❌ Error reading app.json: ${e.message}", e)
    }
    
    // Method 2: Try BuildConfig from application package (not MainActivity package)
    try {
      // Get the actual application package name (where BuildConfig is generated)
      val applicationPackageName = applicationContext.packageName
      @Suppress("UNCHECKED_CAST")
      val buildConfigClass = Class.forName("$applicationPackageName.BuildConfig")
      val appNameField = buildConfigClass.getField("APP_NAME")
      appName = appNameField.get(null) as? String
      
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from BuildConfig ($applicationPackageName): $appName")
        return appName
      }
    } catch (e: ClassNotFoundException) {
      android.util.Log.w("MainActivity", "⚠️ BuildConfig not found in application package")
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ Error reading BuildConfig: ${e.message}")
    }
    
    // Method 3: Read from strings.xml
    try {
      appName = resources.getString(R.string.app_name)
      if (!appName.isNullOrEmpty()) {
        android.util.Log.i("MainActivity", "✅ Using app name from strings.xml: $appName")
        return appName
      }
    } catch (e: Exception) {
      android.util.Log.w("MainActivity", "⚠️ Error reading strings.xml: ${e.message}")
    }
    
    // Final fallback - use default
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

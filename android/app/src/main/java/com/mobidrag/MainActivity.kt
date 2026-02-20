package com.mobidrag

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   * Reads from app.json in assets folder (copied during build)
   */
  override fun getMainComponentName(): String {
    return try {
      // Read app name from app.json in assets (copied during build)
      val inputStream = assets.open("app.json")
      val json = inputStream.bufferedReader().use { it.readText() }
      val appJson = org.json.JSONObject(json)
      val appName = appJson.optString("name", "MobiDrag")
      inputStream.close()
      appName
    } catch (e: Exception) {
      // Fallback to default if app.json can't be read
      android.util.Log.e("MainActivity", "Error reading app.json: ${e.message}")
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

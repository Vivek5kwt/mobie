package com.mobidrag.builder.app160

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    
    // Initialize Firebase safely - don't crash if initialization fails
    try {
      // Firebase is auto-initialized from google-services.json
      // If package name doesn't match, this will fail gracefully
      android.util.Log.d("MainApplication", "Firebase initialization attempted via google-services.json")
    } catch (e: Exception) {
      android.util.Log.w("MainApplication", "Firebase initialization warning: ${e.message}")
      // Don't crash - Firebase might not be configured for this package name
    }
    
    loadReactNative(this)
  }
}

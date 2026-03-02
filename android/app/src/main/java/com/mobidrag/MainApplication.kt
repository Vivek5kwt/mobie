package com.mobidrag

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost

class MainApplication : Application(), ReactApplication {

  // Provide a classic ReactNativeHost so old-architecture code paths
  // (like ReactActivityDelegate.getReactNativeHost) work correctly.
  override val reactNativeHost: ReactNativeHost by lazy {
    object : DefaultReactNativeHost(this) {
      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

      override fun getPackages(): List<ReactPackage> =
        PackageList(this@MainApplication).packages

      override fun getJSMainModuleName(): String = "index"
    }
  }

  // Keep the ReactHost for the New Architecture; this is used when
  // the runtime loads React Native via ReactNativeApplicationEntryPoint.
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
        },
    )
  }

  override fun onCreate() {
    super.onCreate()

    try {
      android.util.Log.d("MainApplication", "Firebase initialization attempted via google-services.json")
    } catch (_: Exception) {
    }

    // This will initialize the New Architecture entrypoint when enabled.
    loadReactNative(this)
  }
}



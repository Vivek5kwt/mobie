# Mobidrag Mobile App - Developer KT

This document is for giving quick KT to another developer. It explains what this project is, how data flows, what commands to run, and where to check when something breaks.

## 1. Project Summary

Mobidrag is a React Native mobile app for Android and iOS.

The app UI is not supposed to be hardcoded. Most screens are built from Builder DSL/API data. If the builder changes a component, page, color, spacing, title, icon, visibility, or sequence, the mobile app should render from that DSL.

Main idea:

```text
Builder/Admin DSL -> Mobile API fetch -> DSL cache -> DynamicRenderer -> React Native components
```

## 2. Repo And Branch

Local project path:

```text
C:\vivek\Live\ Project\mobidrag
```

Git remotes currently configured:

```text
gitlab  https://gitlab.com/mobidrag-group/mobidrag-app.git
origin  https://github.com/Vivek5kwt/mobie.git
```

Normal Git commands:

```sh
git status
git pull gitlab main
git add .
git commit -m "your message"
git push gitlab main
```

## 3. Install And Run

Install packages:

```sh
npm install
```

Start Metro:

```sh
npm start
```

Run Android:

```sh
npm run android
```

Run iOS:

```sh
npm run ios
```

If Gradle is stuck or interrupted:

```sh
cd android
.\gradlew.bat --stop
```

## 4. App ID And App Name

Single source file:

```text
config/appIdentity.json
```

Current value:

```json
{
  "appId": 132,
  "name": "MobiDrag",
  "displayName": "WOWEEYE"
}
```

Change this file when switching app/store.

After changing it, run:

```sh
npm run sync:app-identity
```

Important:

- `appId` is used for DSL/API calls.
- `displayName` is the user-visible app name.
- Keep `name` as `MobiDrag` unless React Native native module name is intentionally changed.

## 5. DSL Loading Flow

Important files:

```text
src/utils/appId.js
src/engine/dslHandler.js
src/graphql/queries/layoutVersionQuery.js
src/engine/DynamicRenderer.js
```

Flow:

1. `resolveAppId()` reads app id from env or `config/appIdentity.json`.
2. `dslHandler.js` calls the layout API using `LAYOUT_VERSION_QUERY`.
3. DSL is selected by page name/slug/handle.
4. Last good DSL is cached in memory and AsyncStorage.
5. `DynamicRenderer.js` maps each DSL component name to the correct React Native component.

If a screen shows `No DSL` or blank page, check:

```text
src/engine/dslHandler.js
src/graphql/queries/layoutVersionQuery.js
src/engine/DynamicRenderer.js
```

Also check whether `appId` is correct in:

```text
config/appIdentity.json
```

## 6. Dynamic Component Rendering

Component map lives here:

```text
src/engine/DynamicRenderer.js
```

Example DSL component names:

```text
hero_banner
banner_slider
product_grid
product_carousel
tab_product_grid
text_block
collection_image
collection_slider
bottom_navigation
side_navigation
notification_inbox
currency_switcher
logout
```

Rule for developers:

```text
DSL data is source of truth.
Do not hardcode color, spacing, radius, icon, title, page order, visibility, or text unless it is a fallback for missing DSL only.
```

When a Builder vs APK mismatch happens:

1. Get the exact DSL payload from the user.
2. Search the component name in `src/components`.
3. Check if the component reads `props.raw`, `layout.css`, `presentation`, and visibility flags.
4. Remove default hardcoded UI if DSL already provides the value.
5. Rebuild Android JS bundle if packaged APK needs the change.

## 7. Branding, Logo, Splash, Notification Icon

Important files:

```text
scripts/update-app-icon.js
scripts/update-ios-brand-assets.js
src/generated/brandAssets.json
android/app/src/main/AndroidManifest.xml
android/app/src/main/res/values/colors.xml
android/app/src/main/res/drawable/ic_notification.png
```

Branding should come from DSL/API fields like:

```text
logoUrl
faviconUrl
splashImageUrl
splashBgColor
splashGradStart
splashGradEnd
```

Android Gradle runs these before build:

```text
syncAppIdentity
updateDynamicAppIcon
```

For Android notification logo:

- Firebase notification default icon is set in `AndroidManifest.xml`.
- The generated icon is `android/app/src/main/res/drawable/ic_notification.png`.
- If notification icon looks old/wrong, run:

```sh
node scripts/update-app-icon.js
cd android
.\gradlew.bat clean assembleDebug
```

Then reinstall the APK and send a fresh notification. Old notifications already visible in the notification tray will not update.

## 8. Android Build

From project root:

```sh
npm run sync:app-identity
```

From Android folder:

```sh
cd android
.\gradlew.bat clean assembleDebug
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

For release:

```sh
cd android
.\gradlew.bat clean assembleRelease
```

Before giving APK to client, run:

```sh
git diff --check
git status --short
```

## 9. Packaged JS Bundle

Some APK builds use bundled JS assets. After JS/component renderer changes, refresh Android bundle:

```sh
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res
```

For iOS bundle:

```sh
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/main.jsbundle --assets-dest ios
```

## 10. iOS Notes

Important files:

```text
ios/MobiDrag/Info.plist
ios/MobiDrag.xcodeproj/project.pbxproj
ios/MobiDrag/Images.xcassets/AppIcon.appiconset
scripts/update-ios-brand-assets.js
```

After native dependency changes:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

For iOS icon/splash issue:

1. Check DSL/API branding values.
2. Run iOS brand asset update script if needed.
3. Clean build in Xcode.
4. Reinstall app on device/simulator.

## 11. Analytics

Important files:

```text
src/utils/firebaseAnalytics.js
src/utils/firebaseMessaging.js
docs/analytics-builder-api.md
```

Analytics should be app-wise, not mixed between apps. Always include app id/store id where analytics events are saved or queried.

For Android analytics debug:

```sh
npm run android:analytics-debug
```

## 12. Common Debug Checklist

For UI mismatch:

```text
Check DSL payload -> check DynamicRenderer mapping -> check component props parsing -> check hardcoded defaults -> rebuild bundle/APK.
```

For wrong app id/name:

```text
config/appIdentity.json -> npm run sync:app-identity -> rebuild app.
```

For wrong logo/splash/notification icon:

```text
DSL brand assets -> scripts/update-app-icon.js -> Android resources -> clean rebuild -> reinstall app.
```

For custom page blank:

```text
Page slug/action -> dslHandler page selection -> DynamicRenderer component support -> loading/error/empty states.
```

For cart/order user issue:

```text
Check auth state -> cart persistence key -> logout cleanup -> checkout payload -> order owner/email mapping.
```

## 13. Important Rule For Future Work

Do not fix Builder vs APK issues by adding static values.

Correct approach:

```text
Read DSL field -> normalize safely -> apply to component -> add fallback only for missing DSL -> verify APK/build.
```

This keeps the app dynamic for all apps, not only one client.


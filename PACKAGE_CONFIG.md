# Dynamic Package Name and App Name Configuration

This document describes how the dynamic package name and app name system works in the App Builder.

## Overview

Each generated mobile app must have a unique package name (Android) / bundle identifier (iOS) and app name. The system automatically generates these during the build process.

## Package Name Format

**Default Format:** `com.mobidrag.builder.{APP_ID}`

Examples:
- APP_ID: `123` → Package: `com.mobidrag.builder.123`
- APP_ID: `456` → Package: `com.mobidrag.builder.456`
- APP_ID: `789` → Package: `com.mobidrag.builder.789`

## Custom Package Name

You can override the default package name by providing a `package_name` field in the build request:

```json
{
  "app_id": 123,
  "app_name": "My Custom App",
  "package_name": "com.mycompany.myapp"
}
```

## App Name

The app name is fetched from:
1. **Mutation response** (`app_name` field) - Priority 1
2. **GraphQL API** (from `layouts.metadata.appName`) - Priority 2
3. **Default** (`MobiDrag`) - Fallback

## Files Modified

### Android

1. **`android/app/build.gradle`**
   - `namespace` - Updated to new package name
   - `applicationId` - Updated to new package name

2. **`android/app/src/main/AndroidManifest.xml`**
   - `package` attribute - Updated to new package name

3. **`android/app/src/main/res/values/strings.xml`**
   - `app_name` - Updated to app name from database/API

4. **`android/app/src/main/java/com/mobidrag/*.kt`**
   - Package declarations - Updated to new package name
   - Files may be moved to new package directory structure

### iOS

1. **`ios/MobiDrag/Info.plist`**
   - `CFBundleDisplayName` - Updated to app name

2. **`ios/MobiDrag.xcodeproj/project.pbxproj`**
   - `PRODUCT_BUNDLE_IDENTIFIER` - Updated to new package name
   - `PRODUCT_NAME` - Updated to app name (spaces removed)

## Build Process

### GitHub Actions Workflow

The package name update happens automatically in the CI/CD pipeline:

```yaml
- name: Update Package Name and App Name
  env:
    APP_ID: ${{ env.APP_ID }}
    APP_NAME: ${{ env.APP_NAME }}
    PACKAGE_NAME: ${{ github.event.client_payload.package_name || '' }}
  run: |
    node scripts/update-android-package.js
```

### Manual Execution

You can also run the scripts manually:

```bash
# Update both Android and iOS
APP_ID=123 APP_NAME="My App" node scripts/update-package-config.js

# Update only Android
APP_ID=123 APP_NAME="My App" node scripts/update-android-package.js

# Update only iOS
APP_ID=123 APP_NAME="My App" node scripts/update-ios-package.js
```

## Configuration Storage

After updating, the configuration is saved to `app-config.json`:

```json
{
  "appId": "123",
  "appName": "My Custom App",
  "packageName": "com.mobidrag.builder.123",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

This file can be used for future rebuilds to ensure consistency.

## Database Integration

The system expects the backend to store:
- `app_id` - Unique identifier for the app
- `app_name` - Display name of the app
- `package_name` (optional) - Custom package name if provided

When triggering a build via GraphQL mutation:

```graphql
mutation TriggerAndroidBuild(
  $appId: Int!
  $appName: String!
  $packageName: String
) {
  triggerAndroidBuild(
    app_id: $appId
    app_name: $appName
    package_name: $packageName
  ) {
    success
    message
  }
}
```

## Package Name Validation

Package names must follow these rules:
- ✅ Lowercase letters only
- ✅ Dots (.) as separators
- ✅ Numbers allowed
- ✅ Must start with a letter
- ❌ No spaces
- ❌ No special characters except dots
- ❌ Cannot start with a number

Examples:
- ✅ `com.mobidrag.builder.123`
- ✅ `com.mycompany.myapp`
- ❌ `com.MyCompany.MyApp` (uppercase)
- ❌ `com.my company.app` (space)
- ❌ `123.com.app` (starts with number)

## Troubleshooting

### Package name not updating

1. Check that `APP_ID` is set in environment variables
2. Verify the script has write permissions to the files
3. Check that files exist in expected locations

### App crashes after package name change

1. Ensure `MainActivity` package declaration matches new package name
2. Verify `AndroidManifest.xml` package attribute is updated
3. Check that `build.gradle` namespace matches package name
4. Rebuild the app completely (clean build)

### iOS build fails

1. Verify `Info.plist` has correct `CFBundleDisplayName`
2. Check `project.pbxproj` for correct `PRODUCT_BUNDLE_IDENTIFIER`
3. Ensure Xcode project is properly configured

## Best Practices

1. **Always use unique package names** - Never reuse package names across different apps
2. **Store package name in database** - Save the generated package name for future rebuilds
3. **Validate package names** - Ensure they follow Java/iOS naming conventions
4. **Test after changes** - Always test the app after package name changes
5. **Version control** - Commit `app-config.json` to track package name changes

## Example Workflow

1. User creates app with ID `123` and name `"My App"`
2. System generates package name: `com.mobidrag.builder.123`
3. Scripts update all configuration files
4. Configuration saved to `app-config.json`
5. Build proceeds with new package name
6. App installed with unique package identifier

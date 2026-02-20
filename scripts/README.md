# Build Scripts Documentation

## Package Name and App Name Configuration

This directory contains scripts for dynamically updating package names and app names during the build process.

## Scripts

### `update-package-config.js`
Main script that updates both Android and iOS configurations.

**Usage:**
```bash
APP_ID=123 APP_NAME="My App" node scripts/update-package-config.js
```

**With custom package name:**
```bash
APP_ID=123 APP_NAME="My App" PACKAGE_NAME="com.custom.package" node scripts/update-package-config.js
```

**What it does:**
- Updates Android `build.gradle` (namespace and applicationId)
- Updates `AndroidManifest.xml` (package attribute)
- Updates `strings.xml` (app_name)
- Updates Android package structure (moves Java/Kotlin files)
- Updates iOS `Info.plist` (CFBundleDisplayName)
- Updates iOS `project.pbxproj` (PRODUCT_BUNDLE_IDENTIFIER)
- Saves configuration to `app-config.json`

### `update-android-package.js`
Android-specific package updater.

**Usage:**
```bash
APP_ID=123 APP_NAME="My App" node scripts/update-android-package.js
```

### `update-ios-package.js`
iOS-specific package updater.

**Usage:**
```bash
APP_ID=123 APP_NAME="My App" node scripts/update-ios-package.js
```

## Package Name Format

Default format: `com.mobidrag.builder.{APP_ID}`

Example:
- APP_ID: 123 → Package: `com.mobidrag.builder.123`
- APP_ID: 456 → Package: `com.mobidrag.builder.456`

## Custom Package Name

You can override the default package name by setting the `PACKAGE_NAME` environment variable:

```bash
APP_ID=123 APP_NAME="My App" PACKAGE_NAME="com.mycompany.myapp" node scripts/update-package-config.js
```

## Configuration File

After running the script, a `app-config.json` file is created with the current configuration:

```json
{
  "appId": "123",
  "appName": "My App",
  "packageName": "com.mobidrag.builder.123",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Integration with CI/CD

The scripts are automatically called in the GitHub Actions workflow:

```yaml
- name: Update Package Name and App Name
  env:
    APP_ID: ${{ env.APP_ID }}
    APP_NAME: ${{ env.APP_NAME }}
    PACKAGE_NAME: ${{ github.event.client_payload.package_name || '' }}
  run: |
    node scripts/update-android-package.js
```

## Files Modified

### Android
- `android/app/build.gradle` - namespace and applicationId
- `android/app/src/main/AndroidManifest.xml` - package attribute
- `android/app/src/main/res/values/strings.xml` - app_name
- `android/app/src/main/java/com/mobidrag/*.kt` - package declarations

### iOS
- `ios/MobiDrag/Info.plist` - CFBundleDisplayName
- `ios/MobiDrag.xcodeproj/project.pbxproj` - PRODUCT_BUNDLE_IDENTIFIER

## Notes

- Package names must follow Java package naming conventions (lowercase, dots only)
- App names can contain spaces and special characters (will be escaped in XML)
- The scripts preserve existing file structure and formatting
- Always backup your files before running the scripts manually

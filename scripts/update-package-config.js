#!/usr/bin/env node

/**
 * Script to dynamically update package name and app name for Android and iOS
 * 
 * Usage:
 *   APP_ID=123 APP_NAME="My App" node scripts/update-package-config.js
 * 
 * Or with custom package name:
 *   APP_ID=123 APP_NAME="My App" PACKAGE_NAME="com.custom.package" node scripts/update-package-config.js
 */

const fs = require('fs');
const path = require('path');

// Get configuration from environment variables
const APP_ID = process.env.APP_ID;
const APP_NAME = process.env.APP_NAME || 'MobiDrag';
const CUSTOM_PACKAGE_NAME = process.env.PACKAGE_NAME;

// Generate package name: com.mobidrag.builder.{APP_ID}
const PACKAGE_NAME = CUSTOM_PACKAGE_NAME || `com.mobidrag.builder.${APP_ID}`;

if (!APP_ID) {
  console.error('❌ APP_ID environment variable is required');
  process.exit(1);
}

/**
 * Validate package name format
 */
function validatePackageName(packageName) {
  if (!packageName || packageName.length === 0) {
    return { valid: false, error: 'Package name cannot be empty' };
  }
  if (!/^[a-z]/.test(packageName)) {
    return { valid: false, error: 'Package name must start with a lowercase letter' };
  }
  if (!/^[a-z0-9.]+$/.test(packageName)) {
    return { valid: false, error: 'Package name can only contain lowercase letters, numbers, and dots' };
  }
  if (/\.\./.test(packageName)) {
    return { valid: false, error: 'Package name cannot contain consecutive dots' };
  }
  if (packageName.startsWith('.') || packageName.endsWith('.')) {
    return { valid: false, error: 'Package name cannot start or end with a dot' };
  }
  const segments = packageName.split('.');
  if (segments.length < 2) {
    return { valid: false, error: 'Package name must have at least 2 segments' };
  }
  if (!segments.every(seg => /^[a-z]/.test(seg))) {
    return { valid: false, error: 'Each package segment must start with a lowercase letter' };
  }
  return { valid: true };
}

// Validate package name
const validation = validatePackageName(PACKAGE_NAME);
if (!validation.valid) {
  console.error(`❌ Invalid package name: ${validation.error}`);
  console.error(`   Package name: ${PACKAGE_NAME}`);
  process.exit(1);
}

console.log('📦 Updating package configuration:');
console.log(`   APP_ID: ${APP_ID}`);
console.log(`   APP_NAME: ${APP_NAME}`);
console.log(`   PACKAGE_NAME: ${PACKAGE_NAME}`);

// Android paths
const androidBuildGradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const androidManifest = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const androidStrings = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const androidMainActivity = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'mobidrag', 'MainActivity.kt');
const androidMainApplication = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'mobidrag', 'MainApplication.kt');

// iOS paths
const iosInfoPlist = path.join(__dirname, '..', 'ios', 'MobiDrag', 'Info.plist');
const iosProjectPbxproj = path.join(__dirname, '..', 'ios', 'MobiDrag.xcodeproj', 'project.pbxproj');

/**
 * Update Android build.gradle
 */
function updateAndroidBuildGradle() {
  if (!fs.existsSync(androidBuildGradle)) {
    console.error(`❌ File not found: ${androidBuildGradle}`);
    return false;
  }

  let content = fs.readFileSync(androidBuildGradle, 'utf8');
  
  // Update namespace
  content = content.replace(/namespace\s+"[^"]+"/, `namespace "${PACKAGE_NAME}"`);
  
  // Update applicationId
  content = content.replace(/applicationId\s+"[^"]+"/, `applicationId "${PACKAGE_NAME}"`);
  
  fs.writeFileSync(androidBuildGradle, content, 'utf8');
  console.log('✅ Updated android/app/build.gradle');
  return true;
}

/**
 * Update AndroidManifest.xml
 */
function updateAndroidManifest() {
  if (!fs.existsSync(androidManifest)) {
    console.error(`❌ File not found: ${androidManifest}`);
    return false;
  }

  let content = fs.readFileSync(androidManifest, 'utf8');
  
  // Update package attribute
  content = content.replace(/package="[^"]+"/, `package="${PACKAGE_NAME}"`);
  
  fs.writeFileSync(androidManifest, content, 'utf8');
  console.log('✅ Updated AndroidManifest.xml');
  return true;
}

/**
 * Update strings.xml (app_name)
 */
function updateAndroidStrings() {
  if (!fs.existsSync(androidStrings)) {
    console.error(`❌ File not found: ${androidStrings}`);
    return false;
  }

  let content = fs.readFileSync(androidStrings, 'utf8');
  
  // Update app_name
  content = content.replace(/<string name="app_name">[^<]+<\/string>/, `<string name="app_name">${escapeXml(APP_NAME)}</string>`);
  
  fs.writeFileSync(androidStrings, content, 'utf8');
  console.log('✅ Updated strings.xml');
  return true;
}

/**
 * Update Java/Kotlin package declarations
 * Note: We update package declarations but don't move files to avoid breaking the build
 * The package structure can be reorganized later if needed
 */
function updateAndroidPackageStructure() {
  // Update package declarations in existing files
  const javaFiles = [
    androidMainActivity,
    androidMainApplication
  ];
  
  let updated = false;
  javaFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Update package declaration
      content = content.replace(/package\s+com\.mobidrag(\s|;)/g, `package ${PACKAGE_NAME}$1`);
      
      // Update BuildConfig reference if it exists
      content = content.replace(/com\.mobidrag\.BuildConfig/g, `${PACKAGE_NAME}.BuildConfig`);
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        updated = true;
      }
    }
  });
  
  if (updated) {
    console.log('✅ Updated Android package declarations');
  } else {
    console.log('⚠️ No Android package declarations found to update');
  }
  return true;
}

/**
 * Update iOS Info.plist
 */
function updateIOSInfoPlist() {
  if (!fs.existsSync(iosInfoPlist)) {
    console.error(`❌ File not found: ${iosInfoPlist}`);
    return false;
  }

  let content = fs.readFileSync(iosInfoPlist, 'utf8');
  
  // Update CFBundleDisplayName
  content = content.replace(/<key>CFBundleDisplayName<\/key>\s*<string>[^<]+<\/string>/, 
    `<key>CFBundleDisplayName</key>\n\t<string>${escapeXml(APP_NAME)}</string>`);
  
  fs.writeFileSync(iosInfoPlist, content, 'utf8');
  console.log('✅ Updated iOS Info.plist');
  return true;
}

/**
 * Update iOS project.pbxproj (PRODUCT_BUNDLE_IDENTIFIER)
 */
function updateIOSProjectPbxproj() {
  if (!fs.existsSync(iosProjectPbxproj)) {
    console.error(`❌ File not found: ${iosProjectPbxproj}`);
    return false;
  }

  let content = fs.readFileSync(iosProjectPbxproj, 'utf8');
  
  // Update PRODUCT_BUNDLE_IDENTIFIER
  // This is tricky because it can appear in multiple places
  // We'll replace all occurrences of com.mobidrag with the new package name
  content = content.replace(/com\.mobidrag/g, PACKAGE_NAME);
  
  // Also update PRODUCT_NAME if it contains the old app name
  content = content.replace(/PRODUCT_NAME = MobiDrag/g, `PRODUCT_NAME = ${APP_NAME.replace(/\s+/g, '')}`);
  
  fs.writeFileSync(iosProjectPbxproj, content, 'utf8');
  console.log('✅ Updated iOS project.pbxproj');
  return true;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Save configuration to app-config.json for future reference
 */
function saveConfig() {
  const config = {
    appId: APP_ID,
    appName: APP_NAME,
    packageName: PACKAGE_NAME,
    updatedAt: new Date().toISOString()
  };
  
  const configPath = path.join(__dirname, '..', 'app-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log('✅ Saved configuration to app-config.json');
}

// Main execution
try {
  console.log('\n🔧 Starting package configuration update...\n');
  
  updateAndroidBuildGradle();
  updateAndroidManifest();
  updateAndroidStrings();
  updateAndroidPackageStructure();
  updateIOSInfoPlist();
  updateIOSProjectPbxproj();
  saveConfig();
  
  console.log('\n✅ Package configuration update completed successfully!');
  console.log(`\n📱 Package Name: ${PACKAGE_NAME}`);
  console.log(`📱 App Name: ${APP_NAME}`);
  
} catch (error) {
  console.error('\n❌ Error updating package configuration:', error.message);
  console.error(error.stack);
  process.exit(1);
}

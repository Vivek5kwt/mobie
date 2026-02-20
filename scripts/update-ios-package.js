#!/usr/bin/env node

/**
 * iOS-specific package name updater
 * Updates iOS configuration files with new bundle identifier and app name
 */

const fs = require('fs');
const path = require('path');

/**
 * Fixes package name by prefixing numeric-only segments with "app"
 */
function fixPackageName(packageName) {
  if (!packageName || packageName.length === 0) {
    return packageName;
  }
  const segments = packageName.split('.');
  const fixedSegments = segments.map(segment => {
    if (/^[0-9]/.test(segment)) {
      return `app${segment}`;
    }
    return segment;
  });
  return fixedSegments.join('.');
}

const APP_ID = process.env.APP_ID;
const APP_NAME = process.env.APP_NAME || 'MobiDrag';
let PACKAGE_NAME = process.env.PACKAGE_NAME || `com.mobidrag.builder.app${APP_ID}`;

if (!APP_ID) {
  console.error('❌ APP_ID is required');
  process.exit(1);
}

// Fix package name if it has numeric-only segments
const originalPackageName = PACKAGE_NAME;
PACKAGE_NAME = fixPackageName(PACKAGE_NAME);

if (originalPackageName !== PACKAGE_NAME) {
  console.log(`🔧 Auto-fixed package name:`);
  console.log(`   Original: ${originalPackageName}`);
  console.log(`   Fixed:    ${PACKAGE_NAME}`);
}

console.log(`📦 Updating iOS bundle identifier: ${PACKAGE_NAME}`);
console.log(`📱 App Name: ${APP_NAME}`);

// Update Info.plist
const infoPlistPath = path.join(__dirname, '..', 'ios', 'MobiDrag', 'Info.plist');
if (fs.existsSync(infoPlistPath)) {
  let content = fs.readFileSync(infoPlistPath, 'utf8');
  
  // Update CFBundleDisplayName
  const displayNameRegex = /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+(<\/string>)/;
  if (displayNameRegex.test(content)) {
    content = content.replace(displayNameRegex, `$1${APP_NAME}$2`);
  } else {
    // Insert if not found (shouldn't happen, but just in case)
    content = content.replace(
      /(<key>CFBundleName<\/key>)/,
      `<key>CFBundleDisplayName</key>\n\t<string>${APP_NAME}</string>\n\t$1`
    );
  }
  
  fs.writeFileSync(infoPlistPath, content, 'utf8');
  console.log('✅ Updated Info.plist');
}

// Update project.pbxproj
const projectPath = path.join(__dirname, '..', 'ios', 'MobiDrag.xcodeproj', 'project.pbxproj');
if (fs.existsSync(projectPath)) {
  let content = fs.readFileSync(projectPath, 'utf8');
  
  // Replace all occurrences of com.mobidrag with new package name
  content = content.replace(/com\.mobidrag/g, PACKAGE_NAME);
  
  // Update PRODUCT_NAME (remove spaces from app name)
  const productName = APP_NAME.replace(/\s+/g, '');
  content = content.replace(/PRODUCT_NAME = MobiDrag/g, `PRODUCT_NAME = ${productName}`);
  
  fs.writeFileSync(projectPath, content, 'utf8');
  console.log('✅ Updated project.pbxproj');
}

console.log('✅ iOS package update completed');

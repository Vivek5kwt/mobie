#!/usr/bin/env node

/**
 * Android-specific package name updater
 * Updates all Android configuration files with new package name and app name
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

console.log(`📦 Updating Android package: ${PACKAGE_NAME}`);
console.log(`📱 App Name: ${APP_NAME}`);

// Update build.gradle
const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  content = content.replace(/namespace\s+"[^"]+"/, `namespace "${PACKAGE_NAME}"`);
  content = content.replace(/applicationId\s+"[^"]+"/, `applicationId "${PACKAGE_NAME}"`);
  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('✅ Updated build.gradle');
}

// Update AndroidManifest.xml
const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let content = fs.readFileSync(manifestPath, 'utf8');
  content = content.replace(/package="[^"]+"/, `package="${PACKAGE_NAME}"`);
  fs.writeFileSync(manifestPath, content, 'utf8');
  console.log('✅ Updated AndroidManifest.xml');
}

// Update strings.xml
const stringsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  let content = fs.readFileSync(stringsPath, 'utf8');
  content = content.replace(/<string name="app_name">[^<]+<\/string>/, 
    `<string name="app_name">${APP_NAME.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`);
  fs.writeFileSync(stringsPath, content, 'utf8');
  console.log('✅ Updated strings.xml');
}

console.log('✅ Android package update completed');

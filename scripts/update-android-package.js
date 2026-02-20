#!/usr/bin/env node

/**
 * Android-specific package name updater
 * Updates all Android configuration files with new package name and app name
 */

const fs = require('fs');
const path = require('path');

const APP_ID = process.env.APP_ID;
const APP_NAME = process.env.APP_NAME || 'MobiDrag';
const PACKAGE_NAME = process.env.PACKAGE_NAME || `com.mobidrag.builder.${APP_ID}`;

if (!APP_ID) {
  console.error('❌ APP_ID is required');
  process.exit(1);
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

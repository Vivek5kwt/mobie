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

// Update google-services.json (critical for Firebase/Google Services)
const googleServicesPath = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
if (fs.existsSync(googleServicesPath)) {
  try {
    const googleServicesContent = fs.readFileSync(googleServicesPath, 'utf8');
    const googleServices = JSON.parse(googleServicesContent);
    
    // Update package_name in all client entries
    if (googleServices.client && Array.isArray(googleServices.client)) {
      googleServices.client.forEach(client => {
        if (client.client_info && client.client_info.android_client_info) {
          client.client_info.android_client_info.package_name = PACKAGE_NAME;
        }
      });
    }
    
    fs.writeFileSync(googleServicesPath, JSON.stringify(googleServices, null, 2), 'utf8');
    console.log('✅ Updated google-services.json');
  } catch (error) {
    console.error('⚠️ Warning: Could not update google-services.json:', error.message);
    console.error('   Build may fail if package name does not match');
  }
} else {
  console.log('⚠️ google-services.json not found, skipping update');
}

// Update Kotlin/Java package structure
const oldPackagePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'mobidrag');
const newPackageSegments = PACKAGE_NAME.split('.');
const newPackagePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', ...newPackageSegments);

// Check if we need to move files (only if package name changed)
const needsMove = PACKAGE_NAME !== 'com.mobidrag' && fs.existsSync(oldPackagePath);

if (needsMove) {
  console.log(`📁 Moving Kotlin files from ${oldPackagePath} to ${newPackagePath}`);
  
  // Create new directory structure
  fs.mkdirSync(newPackagePath, { recursive: true });
  
  // Move and update files
  const files = fs.readdirSync(oldPackagePath);
  let movedCount = 0;
  
  files.forEach(file => {
    const oldFile = path.join(oldPackagePath, file);
    const newFile = path.join(newPackagePath, file);
    
    if (fs.statSync(oldFile).isFile() && (file.endsWith('.kt') || file.endsWith('.java'))) {
      let content = fs.readFileSync(oldFile, 'utf8');
      
      // Update package declaration
      const packageRegex = /package\s+com\.mobidrag(\s|;|$)/g;
      if (packageRegex.test(content)) {
        content = content.replace(packageRegex, `package ${PACKAGE_NAME}$1`);
      }
      
      // Update BuildConfig reference - use relative reference since it's in the same package
      // Replace any explicit package references like com.mobidrag.BuildConfig with just BuildConfig
      content = content.replace(/com\.mobidrag\.BuildConfig/g, 'BuildConfig');
      
      fs.writeFileSync(newFile, content, 'utf8');
      movedCount++;
      console.log(`✅ Moved and updated: ${file}`);
    }
  });
  
  if (movedCount > 0) {
    // Remove old directory if empty
    try {
      const remainingFiles = fs.readdirSync(oldPackagePath);
      if (remainingFiles.length === 0) {
        fs.rmdirSync(oldPackagePath);
        console.log(`✅ Removed old package directory`);
      } else {
        console.log(`⚠️ Old package directory not empty, keeping it`);
      }
    } catch (e) {
      console.log(`⚠️ Could not remove old package directory: ${e.message}`);
    }
    
    console.log(`✅ Updated Kotlin package structure (moved ${movedCount} files)`);
  } else {
    console.log('⚠️ No Kotlin/Java files found to move');
  }
} else if (PACKAGE_NAME === 'com.mobidrag') {
  // Package name hasn't changed, just update package declarations in place
  if (fs.existsSync(oldPackagePath)) {
    const files = fs.readdirSync(oldPackagePath);
    files.forEach(file => {
      const filePath = path.join(oldPackagePath, file);
      if (fs.statSync(filePath).isFile() && (file.endsWith('.kt') || file.endsWith('.java'))) {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Update BuildConfig reference if needed
        content = content.replace(/com\.mobidrag\.BuildConfig/g, 'BuildConfig');
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✅ Updated: ${file}`);
        }
      }
    });
  }
} else {
  // Files might already be in the new location, just update package declarations
  if (fs.existsSync(newPackagePath)) {
    const files = fs.readdirSync(newPackagePath);
    files.forEach(file => {
      const filePath = path.join(newPackagePath, file);
      if (fs.statSync(filePath).isFile() && (file.endsWith('.kt') || file.endsWith('.java'))) {
        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Update package declaration if it's still old
        content = content.replace(/package\s+com\.mobidrag(\s|;|$)/g, `package ${PACKAGE_NAME}$1`);
        // Update BuildConfig reference
        content = content.replace(/com\.mobidrag\.BuildConfig/g, 'BuildConfig');
        
        if (content !== originalContent) {
          fs.writeFileSync(filePath, content, 'utf8');
          console.log(`✅ Updated: ${file}`);
        }
      }
    });
  } else {
    console.log('⚠️ Package directory not found, files may need to be created manually');
  }
}

console.log('✅ Android package update completed');

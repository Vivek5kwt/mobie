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
    
    // Check if a client with the new package name already exists
    let clientExists = false;
    if (googleServices.client && Array.isArray(googleServices.client)) {
      clientExists = googleServices.client.some(client => 
        client.client_info?.android_client_info?.package_name === PACKAGE_NAME
      );
      
      // Update package_name in all existing client entries OR add a new client entry
      if (!clientExists) {
        // If no client exists with the new package name, update the first one or add a new entry
        if (googleServices.client.length > 0) {
          // Update the first client entry with the new package name
          const firstClient = googleServices.client[0];
          if (firstClient.client_info && firstClient.client_info.android_client_info) {
            firstClient.client_info.android_client_info.package_name = PACKAGE_NAME;
            console.log(`✅ Updated existing client entry in google-services.json to package: ${PACKAGE_NAME}`);
          }
        } else {
          // No clients exist, add a new one (this shouldn't happen normally)
          console.log('⚠️ No client entries found in google-services.json');
        }
      } else {
        // Client already exists with this package name, just ensure it's correct
        googleServices.client.forEach(client => {
          if (client.client_info?.android_client_info?.package_name === PACKAGE_NAME) {
            console.log(`✅ Client entry already exists for package: ${PACKAGE_NAME}`);
          }
        });
      }
    }
    
    fs.writeFileSync(googleServicesPath, JSON.stringify(googleServices, null, 2), 'utf8');
    console.log('✅ Updated google-services.json with package name:', PACKAGE_NAME);
  } catch (error) {
    console.error('⚠️ Warning: Could not update google-services.json:', error.message);
    console.error('   Firebase may not work correctly if package name does not match');
    console.error('   App will continue to build but Firebase features may be unavailable');
  }
} else {
  console.log('⚠️ google-services.json not found, skipping update');
  console.log('   Firebase features will not be available');
}

// Update Kotlin/Java package structure
const oldPackagePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'mobidrag');
const newPackageSegments = PACKAGE_NAME.split('.');
const newPackagePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', ...newPackageSegments);

// Find existing package location (could be old location or previous package location)
let sourcePackagePath = oldPackagePath;
if (!fs.existsSync(oldPackagePath)) {
  // Check if files are in a previous package location (e.g., com/mobidrag/builder/app160/)
  const javaBasePath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java');
  if (fs.existsSync(javaBasePath)) {
    const comPath = path.join(javaBasePath, 'com');
    if (fs.existsSync(comPath)) {
      const mobidragPath = path.join(comPath, 'mobidrag');
      if (fs.existsSync(mobidragPath)) {
        // Look for MainActivity.kt or MainApplication.kt in any subdirectory
        const findKotlinFiles = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && (entry.name === 'MainActivity.kt' || entry.name === 'MainApplication.kt')) {
              return path.dirname(fullPath);
            }
            if (entry.isDirectory()) {
              const found = findKotlinFiles(fullPath);
              if (found) return found;
            }
          }
          return null;
        };
        const foundPath = findKotlinFiles(mobidragPath);
        if (foundPath && foundPath !== newPackagePath) {
          sourcePackagePath = foundPath;
          console.log(`📁 Found existing files in: ${sourcePackagePath}`);
        }
      }
    }
  }
}

// Always check both old and new locations
const oldPathExists = fs.existsSync(oldPackagePath);
const sourcePathExists = fs.existsSync(sourcePackagePath);
const newPathExists = fs.existsSync(newPackagePath);

console.log(`📁 Package structure update:`);
console.log(`   Source path: ${sourcePackagePath}`);
console.log(`   Source path exists: ${sourcePathExists}`);
console.log(`   New path: ${newPackagePath}`);
console.log(`   New path exists: ${newPathExists}`);
console.log(`   Target package: ${PACKAGE_NAME}`);

// If package name changed and source path exists (and is different from new path), move files
if (PACKAGE_NAME !== 'com.mobidrag' && sourcePathExists && sourcePackagePath !== newPackagePath) {
  console.log(`📦 Moving files from ${sourcePackagePath} to new package...`);
  
  // Create new directory structure
  if (!newPathExists) {
    fs.mkdirSync(newPackagePath, { recursive: true });
    console.log(`✅ Created new package directory: ${newPackagePath}`);
  }
  
  // Move and update files
  const files = fs.readdirSync(sourcePackagePath);
  let movedCount = 0;
  
  files.forEach(file => {
    const oldFile = path.join(sourcePackagePath, file);
    const newFile = path.join(newPackagePath, file);
    
    if (fs.statSync(oldFile).isFile() && (file.endsWith('.kt') || file.endsWith('.java'))) {
      let content = fs.readFileSync(oldFile, 'utf8');
      
      // Update package declaration - match any package name and replace with new one
      // Handle both old package (com.mobidrag) and any previous package (com.mobidrag.builder.appXXX)
      const packageRegex = /package\s+[^\s;]+(\s|;|$)/g;
      content = content.replace(packageRegex, `package ${PACKAGE_NAME}$1`);
      
      // Update BuildConfig reference - use relative reference since it's in the same package
      content = content.replace(/com\.mobidrag(?:\.builder\.app\d+)?\.BuildConfig/g, 'BuildConfig');
      
      // Ensure new directory exists
      const newDir = path.dirname(newFile);
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
        console.log(`✅ Created directory: ${newDir}`);
      }
      
      // Write to new location
      fs.writeFileSync(newFile, content, 'utf8');
      movedCount++;
      console.log(`✅ Copied and updated: ${file} -> ${newFile}`);
      console.log(`   Package updated to: ${PACKAGE_NAME}`);
      
      // Delete old file after successful copy
      try {
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
          console.log(`✅ Deleted old file: ${oldFile}`);
        }
      } catch (e) {
        console.log(`⚠️ Could not delete old file: ${e.message}`);
        // Don't fail the build, but log the error
      }
    }
  });
  
  if (movedCount > 0) {
    // Force cleanup: Remove all remaining files in old directory
    try {
      const remainingFiles = fs.readdirSync(oldPackagePath);
      if (remainingFiles.length > 0) {
        console.log(`🧹 Cleaning up ${remainingFiles.length} remaining files in old directory...`);
        remainingFiles.forEach(file => {
          const filePath = path.join(oldPackagePath, file);
          try {
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              console.log(`✅ Removed: ${file}`);
            }
          } catch (e) {
            console.log(`⚠️ Could not remove ${file}: ${e.message}`);
          }
        });
      }
      
      // Now remove the directory if empty
      const finalCheck = fs.readdirSync(oldPackagePath);
      if (finalCheck.length === 0) {
        fs.rmdirSync(oldPackagePath);
        console.log(`✅ Removed old package directory`);
      } else {
        // Last resort: try recursive removal
        console.log(`⚠️ Directory still has files, attempting recursive removal...`);
        try {
          const { execSync } = require('child_process');
          execSync(`rm -rf "${oldPackagePath}"`, { stdio: 'inherit' });
          console.log(`✅ Recursively removed old package directory`);
        } catch (e) {
          console.log(`⚠️ Recursive removal failed: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Could not remove old package directory: ${e.message}`);
    }
    
    console.log(`✅ Updated Kotlin package structure (moved ${movedCount} files)`);
  } else {
    console.log('⚠️ No Kotlin/Java files found to move');
  }
}

// Also update files in new location if they exist (in case they were already moved)
if (newPathExists) {
  const files = fs.readdirSync(newPackagePath);
  let updatedCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(newPackagePath, file);
    if (fs.statSync(filePath).isFile() && (file.endsWith('.kt') || file.endsWith('.java'))) {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Update package declaration - replace any existing package with new one
      const packageRegex = /package\s+[^\s;]+(\s|;|$)/g;
      content = content.replace(packageRegex, `package ${PACKAGE_NAME}$1`);
      // Update BuildConfig reference - replace any package reference with relative
      content = content.replace(/[a-z][a-z0-9.]*\.BuildConfig/g, 'BuildConfig');
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        updatedCount++;
        console.log(`✅ Updated package in: ${file}`);
      }
    }
  });
  
  if (updatedCount > 0) {
    console.log(`✅ Updated ${updatedCount} files in new package location`);
  }
}

// Update React Native autogenerated file (ReactNativeApplicationEntryPoint.java)
// This file is generated by React Native autolinking and may use the old package name
const reactNativeEntryPointPath = path.join(__dirname, '..', 'android', 'app', 'build', 'generated', 'autolinking', 'src', 'main', 'java', 'com', 'facebook', 'react', 'ReactNativeApplicationEntryPoint.java');
if (fs.existsSync(reactNativeEntryPointPath)) {
  try {
    let content = fs.readFileSync(reactNativeEntryPointPath, 'utf8');
    const originalContent = content;
    
    // Replace any old package name references to BuildConfig with the new package name
    // Pattern: com.mobidrag.BuildConfig or com.mobidrag.builder.appXXX.BuildConfig -> PACKAGE_NAME.BuildConfig
    content = content.replace(/com\.mobidrag(?:\.builder\.app\d+)?\.BuildConfig/g, `${PACKAGE_NAME}.BuildConfig`);
    
    if (content !== originalContent) {
      fs.writeFileSync(reactNativeEntryPointPath, content, 'utf8');
      console.log('✅ Updated ReactNativeApplicationEntryPoint.java with new package name');
    }
  } catch (error) {
    console.log(`⚠️ Could not update ReactNativeApplicationEntryPoint.java: ${error.message}`);
    console.log('   This file will be regenerated on next build');
  }
} else {
  console.log('⚠️ ReactNativeApplicationEntryPoint.java not found (will be generated during build)');
}

// Final cleanup: Ensure old package directory is removed if package name changed
if (PACKAGE_NAME !== 'com.mobidrag' && fs.existsSync(oldPackagePath)) {
  console.log(`🧹 Final cleanup: Removing old package directory...`);
  try {
    const { execSync } = require('child_process');
    execSync(`rm -rf "${oldPackagePath}"`, { stdio: 'inherit' });
    console.log(`✅ Final cleanup: Removed old package directory`);
  } catch (e) {
    console.log(`⚠️ Final cleanup failed: ${e.message}`);
    console.log(`⚠️ Old files may still exist at: ${oldPackagePath}`);
  }
}

console.log('✅ Android package update completed');

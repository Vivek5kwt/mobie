#!/usr/bin/env node

/**
 * Script to download and update Android app icon
 * Downloads the icon from URL and replaces all launcher icon sizes
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_LOGO_URL = process.env.APP_LOGO;
const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

if (!APP_LOGO_URL) {
  console.log('⚠️ No APP_LOGO provided, skipping icon update');
  process.exit(0);
}

console.log(`📥 Downloading app icon from: ${APP_LOGO_URL}`);

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

const resizeImage = async (inputPath, outputPath, size) => {
  try {
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Input file not found: ${inputPath}`);
      return false;
    }

    // Try using ImageMagick convert if available (common in CI environments)
    try {
      execSync(`convert "${inputPath}" -resize ${size}x${size} "${outputPath}"`, { stdio: 'ignore' });
      console.log(`✅ Created icon: ${outputPath} (${size}x${size}) using ImageMagick`);
      return true;
    } catch (convertError) {
      // ImageMagick not available, try using ffmpeg if available
      try {
        execSync(`ffmpeg -i "${inputPath}" -vf scale=${size}:${size} "${outputPath}" -y`, { stdio: 'ignore' });
        console.log(`✅ Created icon: ${outputPath} (${size}x${size}) using ffmpeg`);
        return true;
      } catch (ffmpegError) {
        // Fallback: just copy the image (will work but may not be optimal size)
        fs.copyFileSync(inputPath, outputPath);
        console.log(`⚠️ Created icon: ${outputPath} (copied, not resized - install ImageMagick for proper resizing)`);
        return true;
      }
    }
  } catch (error) {
    console.error(`❌ Error resizing image: ${error.message}`);
    return false;
  }
};

(async () => {
  try {
    const tempIconPath = path.join(__dirname, '..', 'temp_icon.png');
    const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

    // Download the icon
    await downloadFile(APP_LOGO_URL, tempIconPath);
    console.log('✅ Icon downloaded successfully');

    // Update all launcher icon sizes
    for (const [folder, size] of Object.entries(ICON_SIZES)) {
      const folderPath = path.join(androidResPath, folder);
      const iconPath = path.join(folderPath, 'ic_launcher.png');

      // Ensure folder exists
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Copy/resize icon
      await resizeImage(tempIconPath, iconPath, size);
    }

    // Clean up temp file
    if (fs.existsSync(tempIconPath)) {
      fs.unlinkSync(tempIconPath);
    }

    console.log('✅ App icon updated successfully');
  } catch (error) {
    console.error('❌ Error updating app icon:', error.message);
    console.log('⚠️ Continuing build without icon update');
    process.exit(0); // Don't fail the build if icon update fails
  }
})();

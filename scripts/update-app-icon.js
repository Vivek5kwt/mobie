#!/usr/bin/env node

/**
 * Downloads brand assets and updates Android launcher/splash resources.
 * Priority:
 *   1. APP_LOGO / APP_ICON and SPLASH_IMAGE / SPLASH_IMAGE_URL environment variables
 *   2. _brandKitAssets from the live DSL
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let APP_LOGO_URL = process.env.APP_LOGO || process.env.APP_ICON;
let SPLASH_IMAGE_URL = process.env.SPLASH_IMAGE || process.env.SPLASH_IMAGE_URL;
const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID || '132';
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';
const ROOT_DIR = path.join(__dirname, '..');
const ANDROID_RES_PATH = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');
const DEFAULT_SPLASH_BACKGROUND = '#ffffff';

const ICON_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const unwrapDeep = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => unwrapDeep(item));
  if (!isObject(value)) return value;
  if (value.value !== undefined) return unwrapDeep(value.value);
  if (value.const !== undefined) return unwrapDeep(value.const);
  if (value.properties !== undefined) return unwrapDeep(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = unwrapDeep(next);
    return acc;
  }, {});
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const cleanString = (value) => {
  const resolved = unwrapDeep(value);
  if (resolved === undefined || resolved === null) return '';
  return String(resolved).trim();
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const resolved = cleanString(value);
    if (resolved) return resolved;
  }
  return '';
};

const collectBrandCandidates = (node, candidates = [], depth = 0, seen = new Set()) => {
  if (!isObject(node) && !Array.isArray(node)) return candidates;
  if (seen.has(node) || depth > 10) return candidates;
  seen.add(node);

  if (isObject(node)) {
    if (node.brandKit?.brand_assets) candidates.push(node.brandKit.brand_assets);
    if (node.brandKit?.brandAssets) candidates.push(node.brandKit.brandAssets);
    if (node.brand_assets) candidates.push(node.brand_assets);
    if (node.brandAssets) candidates.push(node.brandAssets);
    if (node._brandKitAssets) candidates.push(node._brandKitAssets);
    if (node.logoUrl || node.faviconUrl || node.splashImageUrl) candidates.push(node);
  }

  const values = Array.isArray(node) ? node : Object.values(node);
  values.forEach((value) => collectBrandCandidates(value, candidates, depth + 1, seen));
  return candidates;
};

const extractBrandAssets = (dsl) => {
  const root = unwrapDeep(parseMaybeJson(dsl));
  if (!isObject(root)) return {};

  return collectBrandCandidates(root).reduce((assets, candidate) => {
    const source = unwrapDeep(candidate) || {};
    if (!assets.logoUrl) assets.logoUrl = firstNonEmpty(source.logoUrl, source.logo, source.appLogo, source.appIcon);
    if (!assets.faviconUrl) assets.faviconUrl = firstNonEmpty(source.faviconUrl, source.favicon, source.iconUrl);
    if (!assets.splashImageUrl) assets.splashImageUrl = firstNonEmpty(source.splashImageUrl, source.splashImage, source.splashUrl);
    if (!assets.splashBgColor) assets.splashBgColor = firstNonEmpty(source.splashBgColor, source.backgroundColor, source.bgColor);
    if (!assets.splashGradStart) assets.splashGradStart = firstNonEmpty(source.splashGradStart, source.gradientStart);
    if (!assets.splashGradEnd) assets.splashGradEnd = firstNonEmpty(source.splashGradEnd, source.gradientEnd);
    return assets;
  }, {});
};

const requestJson = (url, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    if (process.env.GRAPHQL_TOKEN) {
      options.headers.Authorization = `Bearer ${process.env.GRAPHQL_TOKEN}`;
    }

    const req = protocol.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });

const fetchBrandAssetsFromDsl = async () => {
  const appIdInt = Number.parseInt(APP_ID, 10);
  if (!Number.isFinite(appIdInt)) return {};

  const query = `
    query Layouts($appId: Int) {
      layouts(app_id: $appId) {
        layout_versions {
          dsl
          version_number
        }
      }
    }
  `;

  const response = await requestJson(GRAPHQL_ENDPOINT, {
    query,
    variables: { appId: appIdInt },
  });

  if (response.errors) {
    throw new Error(JSON.stringify(response.errors));
  }

  const versions = (response?.data?.layouts || [])
    .flatMap((layout) => layout?.layout_versions || [])
    .sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0));

  for (const version of versions) {
    const assets = extractBrandAssets(version?.dsl);
    if (assets.logoUrl || assets.faviconUrl || assets.splashImageUrl) return assets;
  }

  return {};
};

const downloadFile = (url, dest, redirects = 0) =>
  new Promise((resolve, reject) => {
    if (!url || redirects > 5) {
      reject(new Error('Invalid icon URL'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        const nextUrl = new URL(response.headers.location, url).toString();
        downloadFile(nextUrl, dest, redirects + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
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
    }).on('error', reject);
  });

const resizeImage = async (inputPath, outputPath, size) => {
  try {
    if (!fs.existsSync(inputPath)) {
      console.error(`Input file not found: ${inputPath}`);
      return false;
    }

    try {
      execFileSync('magick', [inputPath, '-resize', `${size}x${size}`, outputPath], { stdio: 'ignore' });
      console.log(`Created icon: ${outputPath} (${size}x${size}) using ImageMagick`);
      return true;
    } catch (magickError) {
      try {
        if (process.platform !== 'win32') {
          execFileSync('convert', [inputPath, '-resize', `${size}x${size}`, outputPath], { stdio: 'ignore' });
          console.log(`Created icon: ${outputPath} (${size}x${size}) using ImageMagick convert`);
          return true;
        }
      } catch (convertError) {}

      try {
        execFileSync('ffmpeg', ['-i', inputPath, '-vf', `scale=${size}:${size}`, outputPath, '-y'], { stdio: 'ignore' });
        console.log(`Created icon: ${outputPath} (${size}x${size}) using ffmpeg`);
        return true;
      } catch (ffmpegError) {
        try {
          if (process.platform === 'win32') {
            const script = [
              'Add-Type -AssemblyName System.Drawing;',
              `$inputPath = ${JSON.stringify(inputPath)};`,
              `$outputPath = ${JSON.stringify(outputPath)};`,
              `$size = ${size};`,
              '$src = [System.Drawing.Image]::FromFile($inputPath);',
              '$bmp = New-Object System.Drawing.Bitmap($size, $size);',
              '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
              '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
              '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
              '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
              '$gfx.Clear([System.Drawing.Color]::Transparent);',
              '$gfx.DrawImage($src, 0, 0, $size, $size);',
              '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
              '$gfx.Dispose(); $bmp.Dispose(); $src.Dispose();',
            ].join(' ');
            execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: 'ignore' });
            console.log(`Created icon: ${outputPath} (${size}x${size}) using PowerShell`);
            return true;
          }
        } catch (powershellError) {}
      }
    }

    fs.copyFileSync(inputPath, outputPath);
    console.log(`Created icon: ${outputPath} (copied, not resized - install ImageMagick for proper resizing)`);
    return true;
  } catch (error) {
    console.error(`Error resizing image: ${error.message}`);
    return false;
  }
};

const normalizeHex = (value, fallback = DEFAULT_SPLASH_BACKGROUND) => {
  const raw = String(value || fallback).trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split('').map((char) => char + char).join('')}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`.toLowerCase();
  return fallback;
};

const escapePowerShell = (value) => String(value).replace(/'/g, "''");

const resizeImageContain = async (inputPath, outputPath, size) => {
  try {
    execFileSync(
      'magick',
      [
        inputPath,
        '-resize',
        `${size}x${size}`,
        '-background',
        'none',
        '-gravity',
        'center',
        '-extent',
        `${size}x${size}`,
        outputPath,
      ],
      { stdio: 'ignore' }
    );
    return true;
  } catch (_) {}

  try {
    const filter = `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
    execFileSync('ffmpeg', ['-i', inputPath, '-vf', filter, outputPath, '-y'], { stdio: 'ignore' });
    return true;
  } catch (_) {}

  try {
    if (process.platform === 'win32') {
      const script = [
        'Add-Type -AssemblyName System.Drawing;',
        `$inputPath = '${escapePowerShell(inputPath)}';`,
        `$outputPath = '${escapePowerShell(outputPath)}';`,
        `$size = ${size};`,
        '$src = [System.Drawing.Image]::FromFile($inputPath);',
        '$bmp = New-Object System.Drawing.Bitmap($size, $size);',
        '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
        '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
        '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
        '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
        '$gfx.Clear([System.Drawing.Color]::Transparent);',
        '$ratio = [Math]::Min($size / $src.Width, $size / $src.Height);',
        '$drawW = [int][Math]::Round($src.Width * $ratio);',
        '$drawH = [int][Math]::Round($src.Height * $ratio);',
        '$x = [int][Math]::Round(($size - $drawW) / 2);',
        '$y = [int][Math]::Round(($size - $drawH) / 2);',
        '$gfx.DrawImage($src, $x, $y, $drawW, $drawH);',
        '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
        '$gfx.Dispose(); $bmp.Dispose(); $src.Dispose();',
      ].join(' ');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: 'ignore' });
      return true;
    }
  } catch (_) {}

  fs.copyFileSync(inputPath, outputPath);
  return true;
};

const writeAndroidSplashXml = (startColor, endColor) => {
  const valuesDir = path.join(ANDROID_RES_PATH, 'values');
  const drawableDir = path.join(ANDROID_RES_PATH, 'drawable');

  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(drawableDir, { recursive: true });

  fs.writeFileSync(
    path.join(valuesDir, 'colors.xml'),
    [
      '<resources>',
      `    <color name="splash_screen_background">${startColor}</color>`,
      `    <color name="splash_screen_background_end">${endColor}</color>`,
      '</resources>',
      '',
    ].join('\n')
  );

  fs.writeFileSync(
    path.join(drawableDir, 'splash_background.xml'),
    [
      '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">',
      '    <gradient',
      '        android:angle="270"',
      '        android:startColor="@color/splash_screen_background"',
      '        android:endColor="@color/splash_screen_background_end" />',
      '</shape>',
      '',
    ].join('\n')
  );

  fs.writeFileSync(
    path.join(drawableDir, 'launch_screen.xml'),
    [
      '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
      '    <item android:drawable="@drawable/splash_background" />',
      '    <item>',
      '        <bitmap',
      '            android:gravity="fill"',
      '            android:src="@drawable/splash_image" />',
      '    </item>',
      '</layer-list>',
      '',
    ].join('\n')
  );

};

const writeTransparentPng = (dest) => {
  fs.writeFileSync(
    dest,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l5kW4wAAAABJRU5ErkJggg==',
      'base64'
    )
  );
};

const updateAndroidSplash = async (assets) => {
  const startColor = normalizeHex(
    assets.splashBgColor || assets.splashGradStart || DEFAULT_SPLASH_BACKGROUND
  );
  const endColor = normalizeHex(assets.splashGradEnd || startColor, startColor);
  const splashUrl = assets.splashImageUrl || '';

  writeAndroidSplashXml(startColor, endColor);

  const splashDir = path.join(ANDROID_RES_PATH, 'drawable-nodpi');
  const splashPath = path.join(splashDir, 'splash_image.png');
  fs.mkdirSync(splashDir, { recursive: true });

  if (!splashUrl) {
    writeTransparentPng(splashPath);
    console.log('No splashImageUrl found; Android native splash image set to transparent.');
    return;
  }

  const tempSplashPath = path.join(ROOT_DIR, 'temp_splash.png');
  console.log(`Downloading Android splash image from: ${splashUrl}`);
  await downloadFile(splashUrl, tempSplashPath);
  await resizeImageContain(tempSplashPath, splashPath, 432);
  fs.unlinkSync(tempSplashPath);
  console.log('Android native splash image updated successfully');
};

(async () => {
  try {
    let dslAssets = {};
    if (!APP_LOGO_URL || !SPLASH_IMAGE_URL) {
      console.log(`Fetching Android brand assets from DSL for APP_ID ${APP_ID}...`);
      dslAssets = await fetchBrandAssetsFromDsl();
    }

    APP_LOGO_URL = APP_LOGO_URL || dslAssets.logoUrl || dslAssets.faviconUrl;
    SPLASH_IMAGE_URL = SPLASH_IMAGE_URL || dslAssets.splashImageUrl;

    await updateAndroidSplash({
      ...dslAssets,
      splashImageUrl: SPLASH_IMAGE_URL || '',
    });

    if (!APP_LOGO_URL) {
      console.log('No app icon URL found in env or DSL, skipping icon update');
      process.exit(0);
    }

    console.log(`Downloading app icon from: ${APP_LOGO_URL}`);

    const tempIconPath = path.join(ROOT_DIR, 'temp_icon.png');

    await downloadFile(APP_LOGO_URL, tempIconPath);
    console.log('Icon downloaded successfully');

    for (const [folder, size] of Object.entries(ICON_SIZES)) {
      const folderPath = path.join(ANDROID_RES_PATH, folder);
      const iconPath = path.join(folderPath, 'ic_launcher.png');

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      await resizeImage(tempIconPath, iconPath, size);
    }

    if (fs.existsSync(tempIconPath)) {
      fs.unlinkSync(tempIconPath);
    }

    console.log('App icon updated successfully');
  } catch (error) {
    console.error('Error updating app icon:', error.message);
    console.log('Continuing build without icon update');
    process.exit(0);
  }
})();

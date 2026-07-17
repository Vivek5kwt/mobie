#!/usr/bin/env node

/**
 * Downloads brand assets and updates Android launcher/splash resources.
 * Priority:
 *   1. _brandKitAssets / brandKit.brand_assets from the live DSL
 *   2. APP_LOGO / APP_ICON and SPLASH_IMAGE / SPLASH_IMAGE_URL environment fallbacks
 *   3. previously generated brand assets as an offline fallback
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let APP_LOGO_URL = process.env.APP_LOGO || process.env.APP_ICON;
let SPLASH_IMAGE_URL = process.env.SPLASH_IMAGE || process.env.SPLASH_IMAGE_URL;
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';
const ROOT_DIR = path.join(__dirname, '..');
const APP_IDENTITY_PATH = path.join(ROOT_DIR, 'config', 'appIdentity.json');
const ANDROID_RES_PATH = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');
const ANDROID_MANIFEST_PATH = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const APP_JSON_PATH = path.join(ROOT_DIR, 'app.json');
const GENERATED_BRAND_ASSETS_PATH = path.join(ROOT_DIR, 'src', 'generated', 'brandAssets.json');
const DEFAULT_SPLASH_BACKGROUND = '#ffffff';
const NOTIFICATION_ICON_SIZE = 96;

const readAppIdentity = () => {
  try {
    if (!fs.existsSync(APP_IDENTITY_PATH)) return {};
    return JSON.parse(fs.readFileSync(APP_IDENTITY_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
};

const APP_IDENTITY = readAppIdentity();
let APP_DISPLAY_NAME = process.env.APP_DISPLAY_NAME || process.env.APP_NAME || APP_IDENTITY.displayName || APP_IDENTITY.name || '';
const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID || String(APP_IDENTITY.appId || '132');

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

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const GENERIC_APP_NAMES = new Set([
  'mobidrag',
  'app',
  'application',
  'app page layout dsl',
  'multi-page app layout dsl',
  'page layout dsl',
]);

const isMeaningfulAppName = (value) => {
  const name = cleanString(value);
  if (!name) return false;
  const lowered = name.toLowerCase();
  if (GENERIC_APP_NAMES.has(lowered)) return false;
  if (/^page[-\s]*\d+$/i.test(name)) return false;
  if (/layout\s+dsl/i.test(name)) return false;
  if (/^app[-\s]*\d+$/i.test(name)) return true;
  return name.length > 1;
};

const firstMeaningfulName = (...values) => {
  for (const value of values) {
    const name = cleanString(value);
    if (isMeaningfulAppName(name)) return name;
  }
  return '';
};

const normalizeBoolean = (value, fallback = undefined) => {
  const resolved = unwrapDeep(value);
  if (typeof resolved === 'boolean') return resolved;
  if (typeof resolved === 'number') return resolved !== 0;
  if (typeof resolved === 'string') {
    const lowered = resolved.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
    if (['false', '0', 'no', 'n'].includes(lowered)) return false;
  }
  return fallback;
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
    if (assets.splashShowBrandIcon === undefined) {
      assets.splashShowBrandIcon = normalizeBoolean(source.splashShowBrandIcon, undefined);
    }
    return assets;
  }, {});
};

const extractAppNameFromDsl = (dsl) => {
  const root = unwrapDeep(parseMaybeJson(dsl));
  if (!isObject(root)) return '';

  return firstMeaningfulName(
    root.appName,
    root.app_name,
    root.displayName,
    root.applicationName,
    root.brandName,
    root.brand_name,
    root.storeName,
    root.shopName,
    root.brandKit?.appName,
    root.brandKit?.app_name,
    root.brandKit?.displayName,
    root.brandKit?.brandName,
    root.brandKit?.brand_name,
    root.brandKit?.storeName,
    root.brandKit?.shopName,
    root.brandKit?.brand_assets?.appName,
    root.brandKit?.brand_assets?.app_name,
    root.brandKit?.brand_assets?.brandName,
    root.brandKit?.brandAssets?.appName,
    root.brandKit?.brandAssets?.app_name,
    root.brandKit?.brandAssets?.brandName
  );
};

const extractAppNameFromMetadata = (metadata) => {
  const source = unwrapDeep(parseMaybeJson(metadata));
  if (!isObject(source)) return '';
  return firstMeaningfulName(
    source.appName,
    source.app_name,
    source.displayName,
    source.applicationName,
    source.brandName,
    source.brand_name,
    source.storeName,
    source.shopName,
    source.name
  );
};

const writeGeneratedBrandAssets = (assets) => {
  fs.mkdirSync(path.dirname(GENERATED_BRAND_ASSETS_PATH), { recursive: true });
  fs.writeFileSync(
    GENERATED_BRAND_ASSETS_PATH,
    `${JSON.stringify({
      appId: Number.parseInt(APP_ID, 10),
      source: 'dsl-api',
      generatedAt: new Date().toISOString(),
      logoUrl: assets.logoUrl || '',
      faviconUrl: assets.faviconUrl || '',
      splashImageUrl: assets.splashImageUrl || '',
      appName: assets.appName || '',
      splashBgColor: assets.splashBgColor || '',
      splashGradStart: assets.splashGradStart || '',
      splashGradEnd: assets.splashGradEnd || '',
      splashShowBrandIcon: assets.splashShowBrandIcon,
    }, null, 2)}\n`
  );
};

const readJsonFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return {};
  }
};

const readCachedBrandAssets = () => {
  const generated = readJsonFile(GENERATED_BRAND_ASSETS_PATH);
  const appJson = readJsonFile(APP_JSON_PATH);
  return {
    logoUrl: firstNonEmpty(generated.logoUrl, appJson.logo),
    faviconUrl: firstNonEmpty(generated.faviconUrl),
    splashImageUrl: firstNonEmpty(generated.splashImageUrl),
    splashBgColor: firstNonEmpty(generated.splashBgColor),
    splashGradStart: firstNonEmpty(generated.splashGradStart),
    splashGradEnd: firstNonEmpty(generated.splashGradEnd),
    splashShowBrandIcon: generated.splashShowBrandIcon,
  };
};

const updateAndroidAppName = (appName) => {
  const resolvedName = cleanString(appName);
  if (!resolvedName) return;

  const valuesDir = path.join(ANDROID_RES_PATH, 'values');
  const stringsPath = path.join(valuesDir, 'strings.xml');
  fs.mkdirSync(valuesDir, { recursive: true });

  const escaped = escapeXml(resolvedName);
  let content = fs.existsSync(stringsPath)
    ? fs.readFileSync(stringsPath, 'utf8')
    : '<resources>\n</resources>\n';

  if (/<string\s+name="app_name">[^<]*<\/string>/.test(content)) {
    content = content.replace(
      /<string\s+name="app_name">[^<]*<\/string>/,
      `<string name="app_name">${escaped}</string>`
    );
  } else {
    content = content.replace(/<\/resources>/, `    <string name="app_name">${escaped}</string>\n</resources>`);
  }

  fs.writeFileSync(stringsPath, content);
  console.log(`Android app label updated from DSL/API: ${resolvedName}`);

  try {
    if (fs.existsSync(APP_JSON_PATH)) {
      const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
      const appIdInt = Number.parseInt(APP_ID, 10);
      let changed = false;
      if (Number.isFinite(appIdInt) && appJson.appId !== appIdInt) {
        appJson.appId = appIdInt;
        changed = true;
      }
      if (appJson.displayName !== resolvedName) {
        appJson.displayName = resolvedName;
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(APP_JSON_PATH, `${JSON.stringify(appJson, null, 2)}\n`);
        console.log(`app.json updated from DSL/API: appId=${appJson.appId || ''}, displayName=${appJson.displayName || ''}`);
      }
    }
  } catch (error) {
    console.log(`Could not update app.json displayName: ${error.message}`);
  }
};

const upsertAndroidAttribute = (tag, attrName, attrValue, indent = '        ') => {
  const attrRegex = new RegExp(`\\s${attrName.replace(':', '\\:')}="[^"]*"`);
  if (attrRegex.test(tag)) {
    return tag.replace(attrRegex, ` ${attrName}="${attrValue}"`);
  }
  return tag.replace(/>$/, `\n${indent}${attrName}="${attrValue}">`);
};

const updateAndroidManifestLauncherIcons = () => {
  if (!fs.existsSync(ANDROID_MANIFEST_PATH)) return;

  let content = fs.readFileSync(ANDROID_MANIFEST_PATH, 'utf8');
  content = content.replace(/<application\b[^>]*>/, (tag) => {
    let next = upsertAndroidAttribute(tag, 'android:icon', '@mipmap/ic_launcher', '        ');
    next = upsertAndroidAttribute(next, 'android:roundIcon', '@mipmap/ic_launcher_round', '        ');
    return next;
  });
  content = content.replace(
    /<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*>/,
    (tag) => {
      let next = upsertAndroidAttribute(tag, 'android:icon', '@mipmap/ic_launcher', '            ');
      next = upsertAndroidAttribute(next, 'android:roundIcon', '@mipmap/ic_launcher_round', '            ');
      return next;
    }
  );
  fs.writeFileSync(ANDROID_MANIFEST_PATH, content);
};

const upsertApplicationMetaData = (content, name, resource) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const metaDataRegex = new RegExp(
    `\\n\\s*<meta-data\\b(?=[^>]*android:name="${escapedName}")[^>]*\\/?>`,
    'm'
  );
  const metaData = [
    '        <meta-data',
    `            android:name="${name}"`,
    `            android:resource="${resource}"`,
    '            tools:replace="android:resource" />',
  ].join('\n');
  const withoutExisting = content.replace(metaDataRegex, '');
  return withoutExisting.replace(/(<application\b[^>]*>)/, `$1\n\n${metaData}`);
};

const updateAndroidManifestNotificationDefaults = () => {
  if (!fs.existsSync(ANDROID_MANIFEST_PATH)) return;

  let content = fs.readFileSync(ANDROID_MANIFEST_PATH, 'utf8');
  content = upsertApplicationMetaData(
    content,
    'com.google.firebase.messaging.default_notification_icon',
    '@drawable/ic_notification'
  );
  content = upsertApplicationMetaData(
    content,
    'com.google.firebase.messaging.default_notification_color',
    '@color/notification_icon_color'
  );
  fs.writeFileSync(ANDROID_MANIFEST_PATH, content);
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

const fetchBrandConfigFromDsl = async () => {
  const appIdInt = Number.parseInt(APP_ID, 10);
  if (!Number.isFinite(appIdInt)) return { assets: {}, appName: '' };

  const query = `
    query Layouts($appId: Int) {
      layouts(app_id: $appId) {
        layout_versions {
          metadata
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

  const layouts = response?.data?.layouts || [];
  let appName = '';

  const versions = layouts
    .flatMap((layout) => layout?.layout_versions || [])
    .sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0));

  for (const version of versions) {
    appName = appName || extractAppNameFromMetadata(version?.metadata);
    const assets = extractBrandAssets(version?.dsl);
    appName = appName || extractAppNameFromDsl(version?.dsl);
    if (assets.logoUrl || assets.faviconUrl || assets.splashImageUrl) {
      return { assets, appName };
    }
  }

  return { assets: {}, appName };
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
      return warnAndKeepExistingIcon(outputPath, size);
    }

    try {
      const tempOutput = makeTempPngPath(outputPath);
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
          `PNG32:${tempOutput}`,
        ],
        { stdio: 'ignore' }
      );
      if (finalizePngOutput(tempOutput, outputPath, size, 'ImageMagick')) {
        console.log(`Created icon: ${outputPath} (${size}x${size}) using ImageMagick`);
        return true;
      }
    } catch (magickError) {
      try {
        if (process.platform !== 'win32') {
          const tempOutput = makeTempPngPath(outputPath);
          execFileSync(
            'convert',
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
              `PNG32:${tempOutput}`,
            ],
            { stdio: 'ignore' }
          );
          if (finalizePngOutput(tempOutput, outputPath, size, 'ImageMagick convert')) {
            console.log(`Created icon: ${outputPath} (${size}x${size}) using ImageMagick convert`);
            return true;
          }
        }
      } catch (convertError) {}

      try {
        const tempOutput = makeTempPngPath(outputPath);
        const filter = `scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`;
        execFileSync('ffmpeg', ['-i', inputPath, '-vf', filter, '-frames:v', '1', tempOutput, '-y'], { stdio: 'ignore' });
        if (finalizePngOutput(tempOutput, outputPath, size, 'ffmpeg')) {
          console.log(`Created icon: ${outputPath} (${size}x${size}) using ffmpeg`);
          return true;
        }
      } catch (ffmpegError) {
        try {
          if (process.platform === 'win32') {
            const tempOutput = makeTempPngPath(outputPath);
            const script = [
              'Add-Type -AssemblyName System.Drawing;',
              `$inputPath = ${JSON.stringify(inputPath)};`,
              `$outputPath = ${JSON.stringify(tempOutput)};`,
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
            if (finalizePngOutput(tempOutput, outputPath, size, 'PowerShell')) {
              console.log(`Created icon: ${outputPath} (${size}x${size}) using PowerShell`);
              return true;
            }
          }
        } catch (powershellError) {}
      }
    }

    console.warn(`Unable to convert ${inputPath} into a launcher PNG; the existing icon will be preserved.`);
    return warnAndKeepExistingIcon(outputPath, size);
  } catch (error) {
    console.error(`Error resizing image: ${error.message}`);
    return warnAndKeepExistingIcon(outputPath, size);
  }
};

const createAndroidNotificationIcon = async (inputPath) => {
  const drawableDir = path.join(ANDROID_RES_PATH, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });

  const outputPath = path.join(drawableDir, 'ic_notification.png');
  const tempOutput = makeTempPngPath(outputPath);
  const iconContentSize = Math.floor(NOTIFICATION_ICON_SIZE * 0.72);

  try {
    execFileSync(
      'magick',
      [
        inputPath,
        '-resize',
        `${iconContentSize}x${iconContentSize}`,
        '-background',
        'none',
        '-gravity',
        'center',
        '-extent',
        `${NOTIFICATION_ICON_SIZE}x${NOTIFICATION_ICON_SIZE}`,
        '-fuzz',
        '14%',
        '-transparent',
        'white',
        '-alpha',
        'on',
        '-fill',
        'white',
        '-colorize',
        '100',
        `PNG32:${tempOutput}`,
      ],
      { stdio: 'ignore' }
    );

    if (finalizePngOutput(tempOutput, outputPath, NOTIFICATION_ICON_SIZE)) {
      console.log(`Android notification icon updated successfully: ${path.basename(outputPath)}`);
      return true;
    }
  } catch (_) {
    removeFileIfExists(tempOutput);
  }

  try {
    if (process.platform === 'win32') {
      const script = [
        'Add-Type -AssemblyName System.Drawing;',
        `$inputPath = '${escapePowerShell(inputPath)}';`,
        `$outputPath = '${escapePowerShell(tempOutput)}';`,
        `$size = ${NOTIFICATION_ICON_SIZE};`,
        '$src = [System.Drawing.Image]::FromFile($inputPath);',
        '$bmp = New-Object System.Drawing.Bitmap($size, $size);',
        '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
        '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
        '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
        '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
        '$gfx.Clear([System.Drawing.Color]::Transparent);',
        '$content = [Math]::Floor($size * 0.72);',
        '$ratio = [Math]::Min($content / $src.Width, $content / $src.Height);',
        '$drawW = [int][Math]::Max(1, [Math]::Round($src.Width * $ratio));',
        '$drawH = [int][Math]::Max(1, [Math]::Round($src.Height * $ratio));',
        '$x = [int][Math]::Round(($size - $drawW) / 2);',
        '$y = [int][Math]::Round(($size - $drawH) / 2);',
        '$gfx.DrawImage($src, $x, $y, $drawW, $drawH);',
        '$gfx.Dispose(); $src.Dispose();',
        'for ($px = 0; $px -lt $size; $px++) {',
        '  for ($py = 0; $py -lt $size; $py++) {',
        '    $color = $bmp.GetPixel($px, $py);',
        '    $isNearWhite = $color.R -ge 244 -and $color.G -ge 244 -and $color.B -ge 244;',
        '    if ($color.A -le 8 -or $isNearWhite) {',
        '      $bmp.SetPixel($px, $py, [System.Drawing.Color]::Transparent);',
        '    } else {',
        '      $bmp.SetPixel($px, $py, [System.Drawing.Color]::FromArgb($color.A, 255, 255, 255));',
        '    }',
        '  }',
        '}',
        '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
        '$bmp.Dispose();',
      ].join(' ');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: 'ignore' });
      if (finalizePngOutput(tempOutput, outputPath, NOTIFICATION_ICON_SIZE)) {
        console.log(`Android notification icon updated successfully: ${path.basename(outputPath)} using PowerShell`);
        return true;
      }
    }
  } catch (_) {
    removeFileIfExists(tempOutput);
  }

  console.warn('Unable to generate Android notification icon from DSL logo; preserving existing notification icon if present.');
  return isValidPng(outputPath, NOTIFICATION_ICON_SIZE);
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

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const removeFileIfExists = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const readPngDimensions = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const bytes = fs.readFileSync(filePath);
  if (bytes.length < 24 || !bytes.slice(0, 8).equals(PNG_SIGNATURE)) return null;
  if (bytes.slice(12, 16).toString('ascii') !== 'IHDR') return null;
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

const isValidPng = (filePath, expectedWidth, expectedHeight = expectedWidth) => {
  const dimensions = readPngDimensions(filePath);
  if (!dimensions) return false;
  if (expectedWidth && dimensions.width !== expectedWidth) return false;
  if (expectedHeight && dimensions.height !== expectedHeight) return false;
  return true;
};

const makeTempPngPath = (outputPath) =>
  `${outputPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

const finalizePngOutput = (tempPath, outputPath, size, toolName) => {
  if (!isValidPng(tempPath, size)) {
    removeFileIfExists(tempPath);
    console.warn(`${toolName} did not create a valid ${size}x${size} PNG for ${outputPath}`);
    return false;
  }
  removeFileIfExists(outputPath);
  fs.renameSync(tempPath, outputPath);
  return true;
};

const warnAndKeepExistingIcon = (outputPath, size) => {
  if (isValidPng(outputPath, size)) {
    console.warn(`Keeping existing valid launcher icon: ${outputPath}`);
    return true;
  }
  console.warn(`No valid existing launcher icon found for ${outputPath}`);
  return false;
};

const resizeImageCover = async (inputPath, outputPath, width, height) => {
  try {
    execFileSync(
      'magick',
      [
        inputPath,
        '-resize',
        `${width}x${height}^`,
        '-gravity',
        'center',
        '-extent',
        `${width}x${height}`,
        outputPath,
      ],
      { stdio: 'ignore' }
    );
    return true;
  } catch (_) {}

  try {
    const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
    execFileSync('ffmpeg', ['-i', inputPath, '-vf', filter, outputPath, '-y'], { stdio: 'ignore' });
    return true;
  } catch (_) {}

  try {
    if (process.platform === 'win32') {
      const script = [
        'Add-Type -AssemblyName System.Drawing;',
        `$inputPath = ${JSON.stringify(inputPath)};`,
        `$outputPath = ${JSON.stringify(outputPath)};`,
        `$targetW = ${width};`,
        `$targetH = ${height};`,
        '$src = [System.Drawing.Image]::FromFile($inputPath);',
        '$scale = [Math]::Max($targetW / $src.Width, $targetH / $src.Height);',
        '$drawW = [Math]::Ceiling($src.Width * $scale);',
        '$drawH = [Math]::Ceiling($src.Height * $scale);',
        '$x = [Math]::Floor(($targetW - $drawW) / 2);',
        '$y = [Math]::Floor(($targetH - $drawH) / 2);',
        '$bmp = New-Object System.Drawing.Bitmap($targetW, $targetH);',
        '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
        '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
        '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
        '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
        '$gfx.DrawImage($src, $x, $y, $drawW, $drawH);',
        '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
        '$gfx.Dispose(); $bmp.Dispose(); $src.Dispose();',
      ].join(' ');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { stdio: 'ignore' });
      return true;
    }
  } catch (_) {}

  return false;
};

const resizeImageContain = async (inputPath, outputPath, size, options = {}) => {
  const allowCopyFallback = options.allowCopyFallback !== false;

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

  if (allowCopyFallback) {
    fs.copyFileSync(inputPath, outputPath);
    return true;
  }

  return false;
};

const detectRasterExtension = (filePath) => {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length >= 8 && bytes.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return '.png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return '.jpg';
  }
  if (
    bytes.length >= 12 &&
    bytes.slice(0, 4).toString('ascii') === 'RIFF' &&
    bytes.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  return '.png';
};

const removeSplashImageFiles = (keepPath = '') => {
  const splashDir = path.join(ANDROID_RES_PATH, 'drawable-nodpi');
  const normalizedKeep = keepPath ? path.normalize(keepPath) : '';

  ['.png', '.jpg', '.jpeg', '.webp'].forEach((extension) => {
    const candidate = path.join(splashDir, `splash_image${extension}`);
    if (fs.existsSync(candidate) && path.normalize(candidate) !== normalizedKeep) {
      fs.unlinkSync(candidate);
    }
  });
};

const createAndroidSplashImage = async (inputPath, splashDir) => {
  const pngPath = path.join(splashDir, 'splash_image.png');
  removeSplashImageFiles();

  const converted = await resizeImageCover(inputPath, pngPath, 1080, 1920);

  if (converted) {
    removeSplashImageFiles(pngPath);
    return pngPath;
  }

  const extension = detectRasterExtension(inputPath);
  const outputPath = path.join(splashDir, `splash_image${extension}`);
  fs.copyFileSync(inputPath, outputPath);
  removeSplashImageFiles(outputPath);
  return outputPath;
};

const writeAndroidSplashXml = (
  startColor,
  endColor,
  {
    launchImageRef = '',
    launchImageGravity = 'fill',
    android12IconRef = '@drawable/splash_screen_transparent_icon',
  } = {}
) => {
  const valuesDir = path.join(ANDROID_RES_PATH, 'values');
  const valuesV31Dir = path.join(ANDROID_RES_PATH, 'values-v31');
  const drawableDir = path.join(ANDROID_RES_PATH, 'drawable');

  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(valuesV31Dir, { recursive: true });
  fs.mkdirSync(drawableDir, { recursive: true });

  fs.writeFileSync(
    path.join(valuesDir, 'colors.xml'),
    [
      '<resources>',
      `    <color name="splash_screen_background">${startColor}</color>`,
      `    <color name="splash_screen_background_end">${endColor}</color>`,
      `    <color name="notification_icon_color">${startColor}</color>`,
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

  const transparentIconPath = path.join(drawableDir, 'splash_screen_transparent_icon.xml');
  if (android12IconRef === '@drawable/splash_screen_transparent_icon') {
    fs.writeFileSync(
      transparentIconPath,
      [
        '<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">',
        '    <size android:width="1dp" android:height="1dp" />',
        '    <solid android:color="@android:color/transparent" />',
        '</shape>',
        '',
      ].join('\n')
    );
  } else if (fs.existsSync(transparentIconPath)) {
    fs.unlinkSync(transparentIconPath);
  }

  const launchScreenLines = [
    '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">',
    '    <item android:drawable="@drawable/splash_background" />',
  ];

  if (launchImageRef) {
    launchScreenLines.push(
      '    <item>',
      '        <bitmap',
      `            android:gravity="${launchImageGravity}"`,
      `            android:src="${launchImageRef}" />`,
      '    </item>'
    );
  }

  launchScreenLines.push('</layer-list>', '');
  fs.writeFileSync(path.join(drawableDir, 'launch_screen.xml'), launchScreenLines.join('\n'));

  fs.writeFileSync(
    path.join(valuesV31Dir, 'styles.xml'),
    [
      '<resources>',
      '',
      '    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">',
      '        <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>',
      '        <item name="android:windowNoTitle">true</item>',
      '        <item name="android:windowActionBar">false</item>',
      '        <item name="android:windowBackground">@drawable/launch_screen</item>',
      '        <item name="android:windowSplashScreenBackground">@color/splash_screen_background</item>',
      `        <item name="android:windowSplashScreenAnimatedIcon">${android12IconRef}</item>`,
      '        <item name="android:windowSplashScreenIconBackgroundColor">@android:color/transparent</item>',
      '        <item name="android:statusBarColor">@color/splash_screen_background</item>',
      '        <item name="android:navigationBarColor">@color/splash_screen_background</item>',
      '    </style>',
      '',
      '</resources>',
      '',
    ].join('\n')
  );
};

const updateAndroidSplash = async (assets) => {
  const startColor = normalizeHex(
    assets.splashGradStart || assets.splashBgColor || assets.splashGradEnd || DEFAULT_SPLASH_BACKGROUND
  );
  const endColor = normalizeHex(assets.splashGradEnd || assets.splashBgColor || startColor, startColor);
  const splashUrl = assets.splashImageUrl || '';
  const logoUrl = assets.logoUrl || assets.faviconUrl || '';
  const showBrandIcon = assets.splashShowBrandIcon !== false && Boolean(logoUrl);
  const android12IconRef = showBrandIcon
    ? '@mipmap/ic_launcher'
    : '@drawable/splash_screen_transparent_icon';

  const splashDir = path.join(ANDROID_RES_PATH, 'drawable-nodpi');
  fs.mkdirSync(splashDir, { recursive: true });

  if (!splashUrl) {
    writeAndroidSplashXml(startColor, endColor, {
      launchImageRef: showBrandIcon ? '@mipmap/ic_launcher' : '',
      launchImageGravity: 'center',
      android12IconRef,
    });
    removeSplashImageFiles();
    console.log('No splashImageUrl found; Android native splash will use the DSL background/logo.');
    return;
  }

  writeAndroidSplashXml(startColor, endColor, {
    launchImageRef: '@drawable/splash_image',
    launchImageGravity: 'fill',
    android12IconRef,
  });
  const tempSplashPath = path.join(ROOT_DIR, 'temp_splash_download');
  console.log(`Downloading Android splash image from: ${splashUrl}`);
  await downloadFile(splashUrl, tempSplashPath);
  const splashPath = await createAndroidSplashImage(tempSplashPath, splashDir);
  fs.unlinkSync(tempSplashPath);
  console.log(`Android native splash image updated successfully: ${path.basename(splashPath)}`);
};

(async () => {
  try {
    console.log(`Fetching Android brand assets from DSL for APP_ID ${APP_ID}...`);
    const dslBrandConfig = await fetchBrandConfigFromDsl();
    const dslAssets = dslBrandConfig.assets || {};
    const dslAppName = dslBrandConfig.appName || '';
    const cachedAssets = readCachedBrandAssets();

    APP_LOGO_URL = dslAssets.logoUrl || dslAssets.faviconUrl || APP_LOGO_URL || cachedAssets.logoUrl || cachedAssets.faviconUrl;
    SPLASH_IMAGE_URL = dslAssets.splashImageUrl || SPLASH_IMAGE_URL || cachedAssets.splashImageUrl;
    APP_DISPLAY_NAME = firstMeaningfulName(
      dslAppName,
      APP_DISPLAY_NAME
    ) || `App-${APP_ID}`;

    const finalBrandAssets = {
      ...cachedAssets,
      ...dslAssets,
      logoUrl: APP_LOGO_URL || dslAssets.logoUrl || '',
      faviconUrl: dslAssets.faviconUrl || cachedAssets.faviconUrl || '',
      splashImageUrl: SPLASH_IMAGE_URL || '',
      appName: APP_DISPLAY_NAME,
      splashShowBrandIcon:
        dslAssets.splashShowBrandIcon !== undefined
          ? dslAssets.splashShowBrandIcon
          : cachedAssets.splashShowBrandIcon,
    };

    writeGeneratedBrandAssets(finalBrandAssets);
    updateAndroidAppName(APP_DISPLAY_NAME);
    updateAndroidManifestLauncherIcons();
    updateAndroidManifestNotificationDefaults();
    await updateAndroidSplash(finalBrandAssets);

    if (!APP_LOGO_URL) {
      console.log('No app icon URL found in env or DSL, skipping icon update');
      process.exit(0);
    }

    console.log(`Downloading app icon from: ${APP_LOGO_URL}`);

    const tempIconPath = path.join(ROOT_DIR, 'temp_icon.png');

    await downloadFile(APP_LOGO_URL, tempIconPath);
    console.log('Icon downloaded successfully');

    let failedIconUpdates = 0;
    for (const [folder, size] of Object.entries(ICON_SIZES)) {
      const folderPath = path.join(ANDROID_RES_PATH, folder);
      const iconPath = path.join(folderPath, 'ic_launcher.png');
      const roundIconPath = path.join(folderPath, 'ic_launcher_round.png');

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      if (!(await resizeImage(tempIconPath, iconPath, size))) failedIconUpdates += 1;
      if (!(await resizeImage(tempIconPath, roundIconPath, size))) failedIconUpdates += 1;
    }

    if (!(await createAndroidNotificationIcon(tempIconPath))) failedIconUpdates += 1;

    if (fs.existsSync(tempIconPath)) {
      fs.unlinkSync(tempIconPath);
    }

    if (failedIconUpdates > 0) {
      console.warn(`App icon update finished with ${failedIconUpdates} preserved fallback resource(s).`);
    } else {
      console.log('App icon updated successfully');
    }
  } catch (error) {
    console.error('Error updating app icon:', error.message);
    console.log('Continuing build without icon update');
    process.exit(0);
  }
})();

#!/usr/bin/env node

/**
 * Downloads brand kit assets from the live DSL and updates iOS native assets.
 *
 * Native iOS launcher icons and LaunchScreen.storyboard are compiled into the
 * app bundle, so they must be generated at build time. The React Native splash
 * still loads dynamically at runtime; this script keeps the native first frame
 * aligned with the same DSL/API source of truth.
 *
 * Priority:
 *   1. _brandKitAssets / brandKit.brand_assets from the live DSL
 *   2. APP_LOGO / APP_ICON and SPLASH_IMAGE / SPLASH_IMAGE_URL environment fallbacks
 *   3. previously generated brand assets as an offline fallback
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const APP_IDENTITY_PATH = path.join(ROOT_DIR, 'config', 'appIdentity.json');
const IOS_ASSETS_DIR = path.join(ROOT_DIR, 'ios', 'MobiDrag', 'Images.xcassets');
const APP_ICON_SET_DIR = path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset');
const SPLASH_IMAGE_SET_DIR = path.join(IOS_ASSETS_DIR, 'SplashImage.imageset');
const SPLASH_BG_SET_DIR = path.join(IOS_ASSETS_DIR, 'SplashBackground.imageset');
const TEMP_DIR = path.join(ROOT_DIR, 'tmp', 'brand-assets');
const INFO_PLIST_PATH = path.join(ROOT_DIR, 'ios', 'MobiDrag', 'Info.plist');
const APP_JSON_PATH = path.join(ROOT_DIR, 'app.json');
const GENERATED_BRAND_ASSETS_PATH = path.join(ROOT_DIR, 'src', 'generated', 'brandAssets.json');

const readAppIdentity = () => {
  try {
    if (!fs.existsSync(APP_IDENTITY_PATH)) return {};
    return JSON.parse(fs.readFileSync(APP_IDENTITY_PATH, 'utf8'));
  } catch (_) {
    return {};
  }
};

const APP_IDENTITY = readAppIdentity();
const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID || String(APP_IDENTITY.appId || '187');
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';
const APP_LOGO_URL = process.env.APP_LOGO || process.env.APP_ICON || '';
const SPLASH_IMAGE_URL = process.env.SPLASH_IMAGE || process.env.SPLASH_IMAGE_URL || '';
const APP_DISPLAY_NAME = process.env.APP_DISPLAY_NAME || process.env.APP_NAME || APP_IDENTITY.displayName || APP_IDENTITY.name || '';

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
  } catch (_) {
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
      splashGradStart: assets.splashGradStart || assets.splashBgColor || '',
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

const replacePlistStringForKey = (content, key, value) => {
  const escaped = escapeXml(value);
  const regex = new RegExp(`(<key>${key}<\\/key>\\s*<string>)[^<]*(<\\/string>)`);
  if (regex.test(content)) {
    return content.replace(regex, `$1${escaped}$2`);
  }
  return content.replace('</dict>', `\t<key>${key}</key>\n\t<string>${escaped}</string>\n</dict>`);
};

const updateInfoPlistUsageMessage = (content, key, fallbackMessage) => {
  return replacePlistStringForKey(content, key, fallbackMessage);
};

const updateIosAppName = (appName) => {
  const resolvedName = cleanString(appName);
  if (!resolvedName || !fs.existsSync(INFO_PLIST_PATH)) return;

  let content = fs.readFileSync(INFO_PLIST_PATH, 'utf8');
  content = replacePlistStringForKey(content, 'CFBundleDisplayName', resolvedName);
  content = replacePlistStringForKey(content, 'CFBundleName', resolvedName);
  content = updateInfoPlistUsageMessage(
    content,
    'NSLocationWhenInUseUsageDescription',
    `${resolvedName} may use your location only when a feature needs nearby or delivery-related information.`
  );
  content = updateInfoPlistUsageMessage(
    content,
    'NSMicrophoneUsageDescription',
    `${resolvedName} uses the microphone when you start voice search.`
  );
  content = updateInfoPlistUsageMessage(
    content,
    'NSSpeechRecognitionUsageDescription',
    `${resolvedName} uses speech recognition to turn your voice search into text.`
  );
  fs.writeFileSync(INFO_PLIST_PATH, content);
  console.log(`iOS app display name updated from DSL/API: ${resolvedName}`);

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

  const versions = (response?.data?.layouts || [])
    .flatMap((layout) => layout?.layout_versions || [])
    .sort((a, b) => (b?.version_number || 0) - (a?.version_number || 0));

  let appName = '';
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
      reject(new Error('Invalid asset URL'));
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
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (error) => {
        fs.unlink(dest, () => {});
        reject(error);
      });
    }).on('error', reject);
  });

const normalizeHex = (value, fallback = '#ffffff') => {
  const raw = String(value || fallback).trim();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split('').map((char) => char + char).join('')}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex}`.toLowerCase();
  return fallback;
};

const colorToRgb = (value, fallback = '#ffffff') => {
  const hex = normalizeHex(value, fallback).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
};

const pngCrcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = pngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data = Buffer.alloc(0)) => {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
};

const writeGradientPng = (dest, width, height, startHex, endHex) => {
  const start = colorToRgb(startHex);
  const end = colorToRgb(endHex, startHex);
  const raw = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const t = height <= 1 ? 0 : y / (height - 1);
    const r = Math.round(start.r + (end.r - start.r) * t);
    const g = Math.round(start.g + (end.g - start.g) * t);
    const b = Math.round(start.b + (end.b - start.b) * t);
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  fs.writeFileSync(
    dest,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      pngChunk('IEND'),
    ])
  );
};

const writeTransparentPng = (dest, width, height) => {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  fs.writeFileSync(
    dest,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk('IHDR', ihdr),
      pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      pngChunk('IEND'),
    ])
  );
};

const escapePowerShell = (value) => String(value).replace(/'/g, "''");

const resizeImage = async (inputPath, outputPath, width, height, options = {}) => {
  const bgColor = normalizeHex(options.backgroundColor || '#ffffff');
  const opaque = Boolean(options.opaque);

  try {
    execFileSync(
      'magick',
      [
        inputPath,
        '-resize',
        `${width}x${height}`,
        ...(opaque ? ['-background', bgColor, '-alpha', 'remove', '-alpha', 'off'] : []),
        outputPath,
      ],
      { stdio: 'ignore' }
    );
    return true;
  } catch (_) {}

  try {
    if (process.platform === 'darwin') {
      execFileSync('sips', ['-z', String(height), String(width), inputPath, '--out', outputPath], {
        stdio: 'ignore',
      });
      return true;
    }
  } catch (_) {}

  try {
    const filter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${bgColor}`;
    execFileSync('ffmpeg', ['-i', inputPath, '-vf', filter, outputPath, '-y'], { stdio: 'ignore' });
    return true;
  } catch (_) {}

  try {
    if (process.platform === 'win32') {
      const clearColor = opaque ? bgColor : '#00000000';
      const script = [
        'Add-Type -AssemblyName System.Drawing;',
        `$inputPath = '${escapePowerShell(inputPath)}';`,
        `$outputPath = '${escapePowerShell(outputPath)}';`,
        `$width = ${width};`,
        `$height = ${height};`,
        `$clearColor = '${clearColor}';`,
        '$src = [System.Drawing.Image]::FromFile($inputPath);',
        '$bmp = New-Object System.Drawing.Bitmap($width, $height);',
        '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
        '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
        '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
        '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
        '$gfx.Clear([System.Drawing.ColorTranslator]::FromHtml($clearColor));',
        '$ratio = [Math]::Min($width / $src.Width, $height / $src.Height);',
        '$drawW = [int][Math]::Round($src.Width * $ratio);',
        '$drawH = [int][Math]::Round($src.Height * $ratio);',
        '$x = [int][Math]::Round(($width - $drawW) / 2);',
        '$y = [int][Math]::Round(($height - $drawH) / 2);',
        '$gfx.DrawImage($src, $x, $y, $drawW, $drawH);',
        '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
        '$gfx.Dispose(); $bmp.Dispose(); $src.Dispose();',
      ].join(' ');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        stdio: 'ignore',
      });
      return true;
    }
  } catch (_) {}

  fs.copyFileSync(inputPath, outputPath);
  return true;
};

const resizeImageCover = async (inputPath, outputPath, width, height, options = {}) => {
  const bgColor = normalizeHex(options.backgroundColor || '#ffffff');
  const opaque = Boolean(options.opaque);

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
        ...(opaque ? ['-background', bgColor, '-alpha', 'remove', '-alpha', 'off'] : []),
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
      const clearColor = opaque ? bgColor : '#00000000';
      const script = [
        'Add-Type -AssemblyName System.Drawing;',
        `$inputPath = '${escapePowerShell(inputPath)}';`,
        `$outputPath = '${escapePowerShell(outputPath)}';`,
        `$width = ${width};`,
        `$height = ${height};`,
        `$clearColor = '${clearColor}';`,
        '$src = [System.Drawing.Image]::FromFile($inputPath);',
        '$scale = [Math]::Max($width / $src.Width, $height / $src.Height);',
        '$drawW = [int][Math]::Ceiling($src.Width * $scale);',
        '$drawH = [int][Math]::Ceiling($src.Height * $scale);',
        '$x = [int][Math]::Floor(($width - $drawW) / 2);',
        '$y = [int][Math]::Floor(($height - $drawH) / 2);',
        '$bmp = New-Object System.Drawing.Bitmap($width, $height);',
        '$gfx = [System.Drawing.Graphics]::FromImage($bmp);',
        '$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;',
        '$gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;',
        '$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality;',
        '$gfx.Clear([System.Drawing.ColorTranslator]::FromHtml($clearColor));',
        '$gfx.DrawImage($src, $x, $y, $drawW, $drawH);',
        '$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png);',
        '$gfx.Dispose(); $bmp.Dispose(); $src.Dispose();',
      ].join(' ');
      execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        stdio: 'ignore',
      });
      return true;
    }
  } catch (_) {}

  return resizeImage(inputPath, outputPath, width, height, options);
};

const iconPixelSize = (entry) => {
  const size = Number.parseFloat(String(entry.size || '').split('x')[0]);
  const scale = Number.parseFloat(String(entry.scale || '1x').replace('x', ''));
  if (!Number.isFinite(size) || !Number.isFinite(scale)) return null;
  return Math.round(size * scale);
};

const writeImagesetContents = (dir, images) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'Contents.json'),
    `${JSON.stringify(
      {
        images,
        info: {
          author: 'xcode',
          version: 1,
        },
      },
      null,
      2
    )}\n`
  );
};

const updateAppIconSet = async (logoPath, bgColor) => {
  const contentsPath = path.join(APP_ICON_SET_DIR, 'Contents.json');
  const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf8'));

  for (const image of contents.images || []) {
    if (!image.filename) continue;
    const pixels = iconPixelSize(image);
    if (!pixels) continue;
    const outputPath = path.join(APP_ICON_SET_DIR, image.filename);
    await resizeImage(logoPath, outputPath, pixels, pixels, {
      backgroundColor: bgColor,
      opaque: true,
    });
  }
};

const updateSplashImageSet = async (splashPath, options = {}) => {
  const images = [
    { idiom: 'universal', filename: 'SplashImage.png', scale: '1x' },
    { idiom: 'universal', filename: 'SplashImage@2x.png', scale: '2x' },
    { idiom: 'universal', filename: 'SplashImage@3x.png', scale: '3x' },
  ];
  writeImagesetContents(SPLASH_IMAGE_SET_DIR, images);

  const sizes = [
    [390, 844],
    [780, 1688],
    [1170, 2532],
  ];
  for (let index = 0; index < images.length; index += 1) {
    const [width, height] = sizes[index];
    const outputPath = path.join(SPLASH_IMAGE_SET_DIR, images[index].filename);
    const resize = options.fullScreen === false ? resizeImage : resizeImageCover;
    await resize(splashPath, outputPath, width, height, {
      opaque: options.fullScreen !== false,
    });
  }
};

const clearSplashImageSet = () => {
  const images = [
    { idiom: 'universal', filename: 'SplashImage.png', scale: '1x' },
    { idiom: 'universal', filename: 'SplashImage@2x.png', scale: '2x' },
    { idiom: 'universal', filename: 'SplashImage@3x.png', scale: '3x' },
  ];
  writeImagesetContents(SPLASH_IMAGE_SET_DIR, images);

  const sizes = [
    [390, 844],
    [780, 1688],
    [1170, 2532],
  ];
  for (let index = 0; index < images.length; index += 1) {
    const [width, height] = sizes[index];
    writeTransparentPng(path.join(SPLASH_IMAGE_SET_DIR, images[index].filename), width, height);
  }
};

const updateSplashBackgroundSet = (startColor, endColor) => {
  const images = [
    { idiom: 'universal', filename: 'SplashBackground.png', scale: '1x' },
    { idiom: 'universal', filename: 'SplashBackground@2x.png', scale: '2x' },
    { idiom: 'universal', filename: 'SplashBackground@3x.png', scale: '3x' },
  ];
  writeImagesetContents(SPLASH_BG_SET_DIR, images);

  const sizes = [
    [64, 256],
    [128, 512],
    [192, 768],
  ];
  for (let index = 0; index < images.length; index += 1) {
    const [width, height] = sizes[index];
    writeGradientPng(path.join(SPLASH_BG_SET_DIR, images[index].filename), width, height, startColor, endColor);
  }
};

(async () => {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const dslBrandConfig = await fetchBrandConfigFromDsl();
    const dslAssets = dslBrandConfig.assets || {};
    const cachedAssets = readCachedBrandAssets();
    const appName = firstMeaningfulName(
      dslBrandConfig.appName,
      APP_DISPLAY_NAME
    ) || `App-${APP_ID}`;
    const logoUrl = dslAssets.logoUrl || dslAssets.faviconUrl || APP_LOGO_URL || cachedAssets.logoUrl || cachedAssets.faviconUrl || '';
    const splashUrl = dslAssets.splashImageUrl || SPLASH_IMAGE_URL || cachedAssets.splashImageUrl || '';
    const splashShowBrandIcon =
      dslAssets.splashShowBrandIcon !== undefined
        ? dslAssets.splashShowBrandIcon
        : cachedAssets.splashShowBrandIcon;
    const finalBrandAssets = {
      ...cachedAssets,
      ...dslAssets,
      logoUrl,
      faviconUrl: dslAssets.faviconUrl || cachedAssets.faviconUrl || '',
      splashImageUrl: splashUrl,
      appName,
      splashShowBrandIcon,
    };
    const effectiveSplashUrl =
      splashUrl ||
      (splashShowBrandIcon !== false ? logoUrl : '');
    const splashBgColor = normalizeHex(
      dslAssets.splashBgColor ||
        dslAssets.splashGradStart ||
        dslAssets.splashGradEnd ||
        cachedAssets.splashBgColor ||
        cachedAssets.splashGradStart ||
        cachedAssets.splashGradEnd ||
        '#ffffff'
    );
    const splashGradStart = normalizeHex(
      dslAssets.splashGradStart ||
        dslAssets.splashBgColor ||
        dslAssets.splashGradEnd ||
        cachedAssets.splashGradStart ||
        cachedAssets.splashBgColor ||
        cachedAssets.splashGradEnd ||
        splashBgColor
    );
    const splashGradEnd = normalizeHex(
      dslAssets.splashGradEnd ||
        dslAssets.splashBgColor ||
        cachedAssets.splashGradEnd ||
        cachedAssets.splashBgColor ||
        splashGradStart,
      splashGradStart
    );

    writeGeneratedBrandAssets({
      ...finalBrandAssets,
      splashBgColor,
      splashGradStart,
      splashGradEnd,
    });
    updateIosAppName(appName);
    updateSplashBackgroundSet(splashGradStart, splashGradEnd);

    if (logoUrl) {
      const logoPath = path.join(TEMP_DIR, 'ios-logo');
      console.log(`Updating iOS app icon from: ${logoUrl}`);
      await downloadFile(logoUrl, logoPath);
      await updateAppIconSet(logoPath, splashBgColor);
    } else {
      console.log('No logoUrl found for iOS app icon; keeping existing AppIcon assets.');
    }

    if (effectiveSplashUrl) {
      const splashPath = path.join(TEMP_DIR, 'ios-splash');
      console.log(`Updating iOS splash image from: ${effectiveSplashUrl}`);
      await downloadFile(effectiveSplashUrl, splashPath);
      await updateSplashImageSet(splashPath, { fullScreen: Boolean(splashUrl) });
    } else {
      clearSplashImageSet();
      console.log('No DSL splash image or logo found; cleared generated SplashImage assets to avoid stale splash art.');
    }

    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('iOS brand assets updated successfully');
  } catch (error) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.error('Error updating iOS brand assets:', error.message);
    console.log('Continuing build with existing iOS brand assets');
    process.exit(0);
  }
})();

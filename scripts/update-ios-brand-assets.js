#!/usr/bin/env node

/**
 * Downloads brand kit assets from the live DSL and updates iOS native assets.
 *
 * Native iOS launcher icons and LaunchScreen.storyboard are compiled into the
 * app bundle, so they must be generated at build time. The React Native splash
 * still loads dynamically at runtime; this script keeps the native first frame
 * aligned with the same DSL/API source of truth.
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID || '132';
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';
const APP_LOGO_URL = process.env.APP_LOGO || process.env.APP_ICON || '';
const SPLASH_IMAGE_URL = process.env.SPLASH_IMAGE || process.env.SPLASH_IMAGE_URL || '';

const ROOT_DIR = path.join(__dirname, '..');
const IOS_ASSETS_DIR = path.join(ROOT_DIR, 'ios', 'MobiDrag', 'Images.xcassets');
const APP_ICON_SET_DIR = path.join(IOS_ASSETS_DIR, 'AppIcon.appiconset');
const SPLASH_IMAGE_SET_DIR = path.join(IOS_ASSETS_DIR, 'SplashImage.imageset');
const SPLASH_BG_SET_DIR = path.join(IOS_ASSETS_DIR, 'SplashBackground.imageset');
const TEMP_DIR = path.join(ROOT_DIR, 'tmp', 'brand-assets');

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
    if (assets.logoUrl || assets.faviconUrl || assets.splashImageUrl) {
      return assets;
    }
  }

  return {};
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

const updateSplashImageSet = async (splashPath) => {
  const images = [
    { idiom: 'universal', filename: 'SplashImage.png', scale: '1x' },
    { idiom: 'universal', filename: 'SplashImage@2x.png', scale: '2x' },
    { idiom: 'universal', filename: 'SplashImage@3x.png', scale: '3x' },
  ];
  writeImagesetContents(SPLASH_IMAGE_SET_DIR, images);

  const sizes = [144, 288, 432];
  for (let index = 0; index < images.length; index += 1) {
    await resizeImage(splashPath, path.join(SPLASH_IMAGE_SET_DIR, images[index].filename), sizes[index], sizes[index], {
      opaque: false,
    });
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

    const dslAssets = await fetchBrandAssetsFromDsl();
    const logoUrl = APP_LOGO_URL || dslAssets.logoUrl || dslAssets.faviconUrl || '';
    const splashUrl = SPLASH_IMAGE_URL || dslAssets.splashImageUrl || '';
    const splashBgColor = normalizeHex(dslAssets.splashBgColor || '#ffffff');
    const splashGradEnd = normalizeHex(dslAssets.splashGradEnd || splashBgColor, splashBgColor);

    updateSplashBackgroundSet(splashBgColor, splashGradEnd);

    if (logoUrl) {
      const logoPath = path.join(TEMP_DIR, 'ios-logo');
      console.log(`Updating iOS app icon from: ${logoUrl}`);
      await downloadFile(logoUrl, logoPath);
      await updateAppIconSet(logoPath, splashBgColor);
    } else {
      console.log('No logoUrl found for iOS app icon; keeping existing AppIcon assets.');
    }

    if (splashUrl) {
      const splashPath = path.join(TEMP_DIR, 'ios-splash');
      console.log(`Updating iOS splash image from: ${splashUrl}`);
      await downloadFile(splashUrl, splashPath);
      await updateSplashImageSet(splashPath);
    } else {
      console.log('No splashImageUrl found; keeping existing SplashImage assets.');
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

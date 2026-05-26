#!/usr/bin/env node

/**
 * Downloads the app icon and updates Android launcher resources.
 * Priority:
 *   1. APP_LOGO / APP_ICON environment variable
 *   2. logoUrl from the live DSL brand kit assets
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let APP_LOGO_URL = process.env.APP_LOGO || process.env.APP_ICON;
const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID || '132';
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';

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
    if (node.brand_assets) candidates.push(node.brand_assets);
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
    if (!assets.splashImageUrl) assets.splashImageUrl = firstNonEmpty(source.splashImageUrl, source.splashImage);
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

const fetchLogoFromDsl = async () => {
  const appIdInt = Number.parseInt(APP_ID, 10);
  if (!Number.isFinite(appIdInt)) return null;

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
    const logo = assets.logoUrl || assets.faviconUrl;
    if (logo) return logo;
  }

  return null;
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
      execSync(`convert "${inputPath}" -resize ${size}x${size} "${outputPath}"`, { stdio: 'ignore' });
      console.log(`Created icon: ${outputPath} (${size}x${size}) using ImageMagick`);
      return true;
    } catch (convertError) {
      try {
        execSync(`ffmpeg -i "${inputPath}" -vf scale=${size}:${size} "${outputPath}" -y`, { stdio: 'ignore' });
        console.log(`Created icon: ${outputPath} (${size}x${size}) using ffmpeg`);
        return true;
      } catch (ffmpegError) {
        fs.copyFileSync(inputPath, outputPath);
        console.log(`Created icon: ${outputPath} (copied, not resized - install ImageMagick for proper resizing)`);
        return true;
      }
    }
  } catch (error) {
    console.error(`Error resizing image: ${error.message}`);
    return false;
  }
};

(async () => {
  try {
    if (!APP_LOGO_URL) {
      console.log(`No APP_LOGO/APP_ICON provided. Fetching logoUrl from DSL for APP_ID ${APP_ID}...`);
      APP_LOGO_URL = await fetchLogoFromDsl();
    }

    if (!APP_LOGO_URL) {
      console.log('No app icon URL found in env or DSL, skipping icon update');
      process.exit(0);
    }

    console.log(`Downloading app icon from: ${APP_LOGO_URL}`);

    const tempIconPath = path.join(__dirname, '..', 'temp_icon.png');
    const androidResPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

    await downloadFile(APP_LOGO_URL, tempIconPath);
    console.log('Icon downloaded successfully');

    for (const [folder, size] of Object.entries(ICON_SIZES)) {
      const folderPath = path.join(androidResPath, folder);
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

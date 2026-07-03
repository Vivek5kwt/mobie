#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const APP_IDENTITY_PATH = path.join(ROOT_DIR, 'config', 'appIdentity.json');
const APP_JSON_PATH = path.join(ROOT_DIR, 'app.json');
const ANDROID_ASSET_APP_JSON_PATH = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'assets', 'app.json');
const ANDROID_STRINGS_PATH = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
const IOS_INFO_PLIST_PATH = path.join(ROOT_DIR, 'ios', 'MobiDrag', 'Info.plist');
const GENERATED_BRAND_ASSETS_PATH = path.join(ROOT_DIR, 'src', 'generated', 'brandAssets.json');

const readJson = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
  }
};

const writeJson = (filePath, data) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const escapeXml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const replacePlistStringForKey = (content, key, value) => {
  const escaped = escapeXml(value);
  const regex = new RegExp(`(<key>${key}<\\/key>\\s*<string>)[^<]*(<\\/string>)`);
  if (regex.test(content)) return content.replace(regex, `$1${escaped}$2`);
  return content;
};

const updateAndroidStrings = (displayName) => {
  fs.mkdirSync(path.dirname(ANDROID_STRINGS_PATH), { recursive: true });
  const escaped = escapeXml(displayName);
  const fallback = '<resources>\n</resources>\n';
  let content = fs.existsSync(ANDROID_STRINGS_PATH)
    ? fs.readFileSync(ANDROID_STRINGS_PATH, 'utf8')
    : fallback;

  if (/<string\s+name="app_name">[^<]*<\/string>/.test(content)) {
    content = content.replace(
      /<string\s+name="app_name">[^<]*<\/string>/,
      `<string name="app_name">${escaped}</string>`
    );
  } else {
    content = content.replace(/<\/resources>/, `    <string name="app_name">${escaped}</string>\n</resources>`);
  }

  fs.writeFileSync(ANDROID_STRINGS_PATH, content);
};

const updateIosInfoPlist = (displayName) => {
  if (!fs.existsSync(IOS_INFO_PLIST_PATH)) return;
  let content = fs.readFileSync(IOS_INFO_PLIST_PATH, 'utf8');
  content = replacePlistStringForKey(content, 'CFBundleDisplayName', displayName);
  content = replacePlistStringForKey(content, 'CFBundleName', displayName);
  fs.writeFileSync(IOS_INFO_PLIST_PATH, content);
};

const main = () => {
  const identity = readJson(APP_IDENTITY_PATH);
  const appId = Number.parseInt(identity.appId, 10);

  if (!Number.isFinite(appId) || appId <= 1) {
    throw new Error('config/appIdentity.json must contain a valid numeric appId.');
  }

  const internalName = String(identity.name || 'MobiDrag').trim() || 'MobiDrag';
  const displayName = String(identity.displayName || internalName || `App-${appId}`).trim();

  const appJson = readJson(APP_JSON_PATH, { name: internalName });
  const nextAppJson = {
    ...appJson,
    name: appJson.name || internalName,
    appId,
    displayName,
  };

  writeJson(APP_JSON_PATH, nextAppJson);
  writeJson(ANDROID_ASSET_APP_JSON_PATH, nextAppJson);
  updateAndroidStrings(displayName);
  updateIosInfoPlist(displayName);

  const brandAssets = readJson(GENERATED_BRAND_ASSETS_PATH, {});
  writeJson(GENERATED_BRAND_ASSETS_PATH, {
    ...brandAssets,
    appId,
    appName: displayName,
  });

  console.log(`Synced app identity: appId=${appId}, displayName=${displayName}`);
};

try {
  main();
} catch (error) {
  console.error(`Failed to sync app identity: ${error.message}`);
  process.exit(1);
}

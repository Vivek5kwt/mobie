/**
 * Utility to read app information from the shared app identity config.
 * app.json is still supported as a legacy fallback.
 */
import { getBrandLogoSync } from '../services/brandKitService';

let cachedAppInfo = null;

/**
 * Synchronous version - reads shared app identity from project root.
 * Use this for components that can't be async
 */
export const getAppInfoSync = () => {
  if (cachedAppInfo) {
    return cachedAppInfo;
  }

  try {
    const appIdentity = require('../../config/appIdentity.json');
    const legacyAppInfo = (() => {
      try {
        return require('../../app.json');
      } catch (_) {
        return {};
      }
    })();
    const appInfo = {
      ...legacyAppInfo,
      ...appIdentity,
      displayName: appIdentity?.displayName || appIdentity?.name || legacyAppInfo?.displayName || legacyAppInfo?.name || '',
    };
    cachedAppInfo = appInfo;
    return appInfo;
  } catch (_) {}

  // Try to require app.json synchronously as a fallback.
  try {
    const appInfo = require('../../app.json');
    cachedAppInfo = appInfo;
    return appInfo;
  } catch (e) {
    // Keep missing app metadata blank so UI does not show a hardcoded brand.
    console.log('Could not read app.json, using defaults:', e.message);
    const defaultInfo = {
      name: '',
      displayName: '',
      logo: null,
    };
    cachedAppInfo = defaultInfo;
    return defaultInfo;
  }
};

/**
 * Gets app name from app identity config (synchronous)
 */
export const getAppNameSync = () => {
  const appInfo = getAppInfoSync();
  return appInfo?.displayName || appInfo?.name || '';
};

/**
 * Gets app logo URL from app identity config / brand assets (synchronous)
 */
export const getAppLogoSync = () => {
  const brandLogo = getBrandLogoSync();
  if (brandLogo) return brandLogo;

  const appInfo = getAppInfoSync();
  return appInfo?.logo || null;
};

/**
 * Async version - for components that can use async/await
 */
export const getAppInfo = async () => {
  return getAppInfoSync();
};

export const getAppName = async () => {
  return getAppNameSync();
};

export const getAppLogo = async () => {
  return getAppLogoSync();
};

/**
 * Utility to read app information from app.json
 * This file is copied to Android assets during build, so we can read it at runtime
 */

let cachedAppInfo = null;

/**
 * Synchronous version - reads app.json from project root
 * Use this for components that can't be async
 */
export const getAppInfoSync = () => {
  if (cachedAppInfo) {
    return cachedAppInfo;
  }

  // Try to require app.json synchronously
  try {
    const appInfo = require('../../app.json');
    cachedAppInfo = appInfo;
    return appInfo;
  } catch (e) {
    // Return default if can't read
    console.log('Could not read app.json, using defaults:', e.message);
    const defaultInfo = {
      name: 'MobiDrag',
      displayName: 'MobiDrag',
      logo: null,
    };
    cachedAppInfo = defaultInfo;
    return defaultInfo;
  }
};

/**
 * Gets app name from app.json (synchronous)
 */
export const getAppNameSync = () => {
  const appInfo = getAppInfoSync();
  return appInfo?.displayName || appInfo?.name || 'MobiDrag';
};

/**
 * Gets app logo URL from app.json (synchronous)
 */
export const getAppLogoSync = () => {
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

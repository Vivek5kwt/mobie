const DEFAULT_APP_ID = 94;

const isValidId = (n) => Number.isFinite(n) && n > 1;

export const resolveAppId = (appId) => {
  // 1. Caller-supplied value (highest priority)
  if (appId !== undefined && appId !== null && appId !== "") {
    const n = Number(appId);
    if (isValidId(n)) {
      console.log(`📱 Using provided appId: ${n}`);
      return n;
    }
  }

  // 2. app.json — written by CI at build time (most reliable in a bundled APK)
  try {
    const appJson = require('../../app.json');
    const n = Number(appJson?.appId);
    if (isValidId(n)) {
      console.log(`📱 Using appId from app.json: ${n}`);
      return n;
    }
  } catch (_) {}

  // 3. process.env.REACT_APP_APP_ID — inlined by Metro when env var is set during Gradle build
  const envAppId = process.env.REACT_APP_APP_ID;
  if (envAppId) {
    const n = Number(envAppId);
    if (isValidId(n)) {
      console.log(`📱 Using REACT_APP_APP_ID from env: ${n}`);
      return n;
    }
  }

  // 4. Fallback
  console.log(`📱 Using default appId: ${DEFAULT_APP_ID}`);
  return DEFAULT_APP_ID;
};

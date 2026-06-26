const DEFAULT_APP_ID = 173;

const isValidId = (n) => Number.isFinite(n) && n > 1;

export const resolveAppId = (appId) => {
  if (appId !== undefined && appId !== null && appId !== "") {
    const n = Number(appId);
    if (isValidId(n)) {
      console.log(`Using provided appId: ${n}`);
      return n;
    }
  }

  try {
    const appJson = require("../../app.json");
    const n = Number(appJson?.appId);
    if (isValidId(n)) {
      console.log(`Using appId from app.json: ${n}`);
      return n;
    }
  } catch (_) {}

  try {
    const brandAssets = require("../generated/brandAssets.json");
    const n = Number(brandAssets?.appId);
    if (isValidId(n)) {
      console.log(`Using appId from generated brand assets: ${n}`);
      return n;
    }
  } catch (_) {}

  const envAppId = process.env.REACT_APP_APP_ID || process.env.APP_ID;
  if (envAppId) {
    const n = Number(envAppId);
    if (isValidId(n)) {
      console.log(`Using appId from env: ${n}`);
      return n;
    }
  }

  console.log(`Using default appId: ${DEFAULT_APP_ID}`);
  return DEFAULT_APP_ID;
};

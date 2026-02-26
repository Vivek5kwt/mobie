const DEFAULT_APP_ID = 194;

export const resolveAppId = (appId) => {
  // First check if appId is provided directly
  if (appId !== undefined && appId !== null && appId !== "") {
    const numAppId = Number(appId);
    // Treat 1 as invalid (likely a default/placeholder value) and use default instead
    if (Number.isFinite(numAppId) && numAppId > 0 && numAppId !== 1) {
      console.log(`📱 Using provided appId: ${numAppId}`);
      return numAppId;
    } else if (numAppId === 1) {
      console.log(`📱 Provided appId is 1 (invalid), using default: ${DEFAULT_APP_ID}`);
    }
  }

  // Then check environment variable (set by GitHub Actions)
  const envAppId = process.env.REACT_APP_APP_ID;
  if (envAppId) {
    const numEnvAppId = Number(envAppId);
    // Treat 1 as invalid (likely a default/placeholder value) and use default instead
    if (Number.isFinite(numEnvAppId) && numEnvAppId > 0 && numEnvAppId !== 1) {
      console.log(`📱 Using REACT_APP_APP_ID from environment: ${numEnvAppId}`);
      return numEnvAppId;
    } else if (numEnvAppId === 1) {
      console.log(`📱 REACT_APP_APP_ID is 1 (invalid), using default: ${DEFAULT_APP_ID}`);
    }
  }

  // Fallback to default
  console.log(`📱 Using default appId: ${DEFAULT_APP_ID}`);
  return DEFAULT_APP_ID;
};

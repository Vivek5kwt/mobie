const DEFAULT_APP_ID = 1;

export const resolveAppId = (appId) => {
  // First check if appId is provided directly
  if (appId !== undefined && appId !== null && appId !== "") {
    const numAppId = Number(appId);
    if (Number.isFinite(numAppId) && numAppId > 0) {
      console.log(`📱 Using provided appId: ${numAppId}`);
      return numAppId;
    }
  }

  // Then check environment variable (set by GitHub Actions)
  const envAppId = process.env.REACT_APP_APP_ID;
  if (envAppId) {
    const numEnvAppId = Number(envAppId);
    if (Number.isFinite(numEnvAppId) && numEnvAppId > 0) {
      console.log(`📱 Using REACT_APP_APP_ID from environment: ${numEnvAppId}`);
      return numEnvAppId;
    }
  }

  // Fallback to default
  console.log(`📱 Using default appId: ${DEFAULT_APP_ID}`);
  return DEFAULT_APP_ID;
};

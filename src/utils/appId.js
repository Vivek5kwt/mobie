const DEFAULT_APP_ID = 1;

export const resolveAppId = (appId) => {
  if (appId !== undefined && appId !== null) {
    return appId;
  }

  const envAppId = Number(process.env.REACT_APP_APP_ID);
  return Number.isFinite(envAppId) ? envAppId : DEFAULT_APP_ID;
};

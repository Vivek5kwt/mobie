const BASE_URL = "https://api.domain.com"; // backend base url

export async function getBuildStatus(appId) {
  if (!appId) {
    throw new Error("appId is required to fetch build status");
  }

  const response = await fetch(
    `${BASE_URL}/api/app/build-status/${appId}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch build status (${response.status})`);
  }

  return response.json();
}

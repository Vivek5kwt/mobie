export async function getBuildStatus(appId) {
  if (!appId) {
    throw new Error("appId is required to fetch build status");
  }

  const response = await fetch(`/api/app/build-status/${appId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch build status (${response.status})`);
  }

  const data = await response.json();
  return data;
}

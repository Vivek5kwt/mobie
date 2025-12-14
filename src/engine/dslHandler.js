import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";

export async function fetchLiveDSL(appId = 1) {
  try {
    console.log("🔄 Fetching LIVE data from API...");

    const res = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId },
      fetchPolicy: "no-cache",
    });

    // Get the layout object
    const layout = res?.data?.layout;
    if (!layout) {
      console.log("❌ No layout data found");
      return null;
    }

    // Get all versions and sort by version_number (descending)
    const layoutVersions = layout?.layout_versions || [];
    if (layoutVersions.length === 0) {
      console.log("❌ No layout versions found");
      return null;
    }

    const sortedVersions = [...layoutVersions].sort(
      (a, b) => (b.version_number || 0) - (a.version_number || 0)
    );

    const latestVersion = sortedVersions[0];
    const dslData = latestVersion?.dsl;

    console.log(`✅ LIVE DATA FETCHED - Version ${latestVersion.version_number}`);
    console.log(`📊 Sections count: ${dslData?.sections?.length || 0}`);

    if (dslData?.sections) {
      const components = dslData.sections.map((s) => s.component || s.properties?.component);
      console.log(`🔍 Components found:`, components);
    }

    return dslData;
  } catch (error) {
    console.log("❌ LIVE DATA ERROR:", error);
    return null;
  }
}

/**
 * fetchDSL
 * - Now ALWAYS attempts to fetch live DSL and returns it (or null on failure).
 * - No dummy/local fallback exists anymore.
 */
export async function fetchDSL(appId = 1) {
  console.log("📊 fetchDSL called - fetching LIVE data only");
  const live = await fetchLiveDSL(appId);
  if (!live) {
    console.log("❌ Live data fetch failed. No dummy fallback available.");
  }
  return live;
}

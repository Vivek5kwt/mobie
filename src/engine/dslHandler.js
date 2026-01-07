import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";

const resolveAppId = (appId) => {
  const provided = Number(appId);
  if (Number.isFinite(provided) && provided > 0) return provided;

  const envAppId = Number(process.env.REACT_APP_APP_ID);
  if (Number.isFinite(envAppId) && envAppId > 0) return envAppId;

  return 1;
};

const normalizeName = (value) => (value ? String(value).trim().toLowerCase() : "");

const selectDslPage = (dslData, layoutMeta, pageOverride) => {
  if (!dslData?.pages || typeof dslData.pages !== "object") return dslData;

  const entries = Object.entries(dslData.pages);
  if (!entries.length) return dslData;

  const targetName = normalizeName(pageOverride || layoutMeta?.page_name);

  const match =
    targetName &&
    entries.find(([key, page]) => {
      const pageInfo = page?.page || {};
      const candidates = [
        normalizeName(key),
        normalizeName(pageInfo?.name),
        normalizeName(pageInfo?.handle),
      ];
      return candidates.includes(targetName);
    });

  const homeFallback =
    entries.find(([key, page]) => {
      const pageInfo = page?.page || {};
      return [
        normalizeName(key),
        normalizeName(pageInfo?.name),
        normalizeName(pageInfo?.handle),
      ].includes("home");
    }) || entries[0];

  const selected = (match && match[1]) || (homeFallback && homeFallback[1]);

  if (selected) {
    console.log("📄 Using page DSL:", selected?.page?.name || selected?.page?.handle || "Unknown");
  }

  return selected || dslData;
};

export async function fetchLiveDSL(appId, pageName) {
  try {
    console.log("🔄 Fetching LIVE data from API...");
    const resolvedAppId = resolveAppId(appId);
    console.log(`🆔 Using app_id for backend request: ${resolvedAppId}`);

    const res = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId: resolvedAppId },
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
    const dslData = selectDslPage(latestVersion?.dsl, layout, pageName);
    const versionNumber = latestVersion?.version_number ?? null;

    console.log(`✅ LIVE DATA FETCHED - Version ${latestVersion.version_number}`);
    console.log(`📊 Sections count: ${dslData?.sections?.length || 0}`);

    if (dslData?.sections) {
      const components = dslData.sections.map((s) => s.component || s.properties?.component);
      console.log(`🔍 Components found:`, components);
    }

    return { dsl: dslData, versionNumber };
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
export async function fetchDSL(appId, pageName) {
  console.log("📊 fetchDSL called - fetching LIVE data only");
  const live = await fetchLiveDSL(appId, pageName);
  if (!live) {
    console.log("❌ Live data fetch failed. No dummy fallback available.");
  }
  return live;
}

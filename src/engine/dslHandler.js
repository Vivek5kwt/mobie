import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import authLayoutFallback from "../data/authLayoutFallback";

const DEFAULT_APP_ID = 1;

const resolveAppId = (appId) => {
  if (appId !== undefined && appId !== null) {
    return appId;
  }

  const envAppId = Number(process.env.REACT_APP_APP_ID);
  return Number.isFinite(envAppId) ? envAppId : DEFAULT_APP_ID;
};

const normalizeName = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

const sanitizeSections = (dslPage) => {
  if (!dslPage || !Array.isArray(dslPage.sections)) return dslPage;
  const filteredSections = dslPage.sections.filter(Boolean);
  if (filteredSections.length === dslPage.sections.length) return dslPage;
  return { ...dslPage, sections: filteredSections };
};

const selectDslPage = (dslData, layoutMeta, pageOverride) => {
  if (!dslData?.pages || typeof dslData.pages !== "object") {
    if (!pageOverride) return dslData;

    const currentPageName = normalizeName(
      dslData?.page?.name || dslData?.page?.handle || layoutMeta?.page_name
    );
    const targetName = normalizeName(pageOverride);

    if (currentPageName && currentPageName === targetName) {
      return dslData;
    }

    console.log(`📄 No DSL match for "${pageOverride}". Returning empty page data.`);
    return { page: { name: pageOverride }, sections: [] };
  }

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

  if (pageOverride && !match) {
    console.log(`📄 No DSL match for "${pageOverride}". Returning empty page data.`);
    return { page: { name: pageOverride }, sections: [] };
  }

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

  return sanitizeSections(selected) || sanitizeSections(dslData);
};

export async function fetchLiveDSL(appId, pageName) {
  try {
    console.log("🔄 Fetching LIVE data from API...");
    const resolvedAppId = resolveAppId(appId);

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
    const dslData = sanitizeSections(selectDslPage(latestVersion?.dsl, layout, pageName));
    const versionNumber = latestVersion?.version_number ?? null;

    console.log(`✅ LIVE DATA FETCHED - Version ${latestVersion.version_number}`);
    console.log(`📊 Sections count: ${dslData?.sections?.length || 0}`);

    if (dslData?.sections) {
      const components = dslData.sections
        .filter(Boolean)
        .map((s) => s?.component || s?.properties?.component);
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
 * - Uses a local auth layout fallback for the signin page.
 * - Otherwise attempts to fetch live DSL and returns it (or null on failure).
 */
export async function fetchDSL(appId, pageName) {
  console.log("📊 fetchDSL called");
  const normalizedPageName = normalizeName(pageName);
  if (normalizedPageName === "signin-create-account") {
    console.log("📄 Using local auth layout fallback");
    return { dsl: authLayoutFallback, versionNumber: null };
  }
  const live = await fetchLiveDSL(appId, pageName);
  if (!live) {
    console.log("❌ Live data fetch failed. No dummy fallback available.");
  }
  return live;
}

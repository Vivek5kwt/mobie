import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import authLayoutFallback from "../data/authLayoutFallback";
import { resolveAppId } from "../utils/appId";

const normalizeName = (value) =>
  value
    ? String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";

// Common page name aliases — maps any incoming slug to alternatives worth trying
const PAGE_ALIASES = {
  "profile":      ["profile", "account", "accounts", "my-account", "my-profile", "user-profile", "user"],
  "account":      ["account", "accounts", "profile", "my-account", "user"],
  "accounts":     ["accounts", "account", "profile", "my-account"],
  "cart":         ["cart", "shopping-cart", "bag", "my-cart", "my-bag"],
  "search":       ["search", "search-results", "find", "explore"],
  "home":         ["home", "index", "main"],
  "notification": ["notification", "notifications", "alerts", "inbox"],
  "orders":       ["orders", "my-orders", "order-history", "order"],
};

// Find the best matching layout entry for a target page name.
// Priority: exact → alias → contains → null (no home fallback for non-home pages)
const findMatchingLayout = (layouts, targetName) => {
  if (!targetName || targetName === "home") return layouts[0];

  // 1. Exact match
  const exact = layouts.find(
    (e) => normalizeName(e?.page_name) === targetName
  );
  if (exact) return exact;

  // 2. Alias match
  const aliases = PAGE_ALIASES[targetName] || [];
  for (const alias of aliases) {
    const found = layouts.find((e) => normalizeName(e?.page_name) === alias);
    if (found) return found;
  }

  // 3. Partial / contains match (e.g. "user-profile" matches "profile")
  const partial = layouts.find((e) => {
    const n = normalizeName(e?.page_name);
    return n && (n.includes(targetName) || targetName.includes(n));
  });
  if (partial) return partial;

  // 4. No match — do NOT fall back to layouts[0] (that's the home page)
  return null;
};

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
    
    // Ensure appId is an integer for GraphQL query
    const appIdInt = Number.isInteger(resolvedAppId) ? resolvedAppId : Math.floor(Number(resolvedAppId));
    console.log(`🔍 Querying layouts with appId: ${appIdInt} (type: ${typeof appIdInt})`);

    const res = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId: appIdInt },
      fetchPolicy: "no-cache",
    });

    // Get the layout objects
    const layouts = res?.data?.layouts;
    if (!Array.isArray(layouts) || layouts.length === 0) {
      console.log("❌ No layout data found");
      return null;
    }

    const targetName = normalizeName(pageName);
    const layout = findMatchingLayout(layouts, targetName);
    if (!layout) {
      console.log(`❌ No layout found for page: "${pageName}" (normalized: "${targetName}")`);
      console.log("📋 Available pages:", layouts.map((e) => e?.page_name).join(", "));
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
    const fullDsl = latestVersion?.dsl;
    const dslData = sanitizeSections(selectDslPage(fullDsl, layout, pageName));
    // Preserve headerdefault from the full DSL even if selectDslPage picked a nested page
    const headerDefault = dslData?.headerdefault ?? fullDsl?.headerdefault ?? null;
    const dslWithDefaults = headerDefault != null
      ? { ...dslData, headerdefault: headerDefault }
      : dslData;
    const versionNumber = latestVersion?.version_number ?? null;

    console.log(`✅ LIVE DATA FETCHED - Version ${latestVersion.version_number}`);
    console.log(`📊 Sections count: ${dslWithDefaults?.sections?.length || 0}`);

    if (dslWithDefaults?.sections) {
      const components = dslWithDefaults.sections
        .filter(Boolean)
        .map((s) => s?.component || s?.properties?.component);
      console.log(`🔍 Components found:`, components);
    }

    return { dsl: dslWithDefaults, versionNumber };
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

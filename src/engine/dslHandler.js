import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import authLayoutFallback from "../data/authLayoutFallback";
import { resolveAppId } from "../utils/appId";
import { setTypography } from "../services/typographyService";
import { getStoreConfigSync } from "../services/storeService";

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
  "profile":        ["profile", "account", "accounts", "my-account", "my-profile", "user-profile", "user"],
  "account":        ["account", "accounts", "profile", "my-account", "user"],
  "accounts":       ["accounts", "account", "profile", "my-account"],
  "cart":           ["cart", "shopping-cart", "bag", "my-cart", "my-bag"],
  "search":         ["search", "search-results", "find", "explore"],
  "home":           ["home", "index", "main"],
  "notification":   ["notification", "notifications", "alerts", "inbox"],
  "orders":         ["orders", "my-orders", "order-history", "order"],
  "create-account": ["create-account", "signup", "sign-up", "register", "createaccount", "create-an-account"],
  "signup":         ["signup", "sign-up", "create-account", "register", "create-an-account"],
  "sign-up":        ["sign-up", "signup", "create-account", "register"],
  "post-purchase":  ["post-purchase", "post-purchase-screen", "order-confirmation", "order-confirmed", "thank-you", "thankyou", "purchase-complete", "order-complete"],
};

// Pages that should auto-show a sign-up form when DSL sections are empty
const CREATE_ACCOUNT_SLUGS = new Set([
  "create-account", "signup", "sign-up", "register", "createaccount", "create-an-account",
]);

// Build a sign_up DSL section using colors from the page's headerdefault
const buildSignUpSection = (headerDefault = {}) => {
  const accentColor = headerDefault?.backgroundColor || "#027579";
  const textColor   = headerDefault?.textColor       || "#111827";
  return {
    type: "object",
    title: "Sign Up Component Schema",
    properties: {
      props: {
        type: "object",
        properties: {
          raw: {
            type: "object",
            value: {
              pt: 32,
              pb: 32,
              pl: 20,
              pr: 20,
              bgColor:             "#FFFFFF",
              cardBgColor:         "#FFFFFF",
              authTitle:           "Create an Account",
              buttonText:          "Create Account",
              footerText:          "Already have an account?",
              footerLinkText:      "Sign In",
              titleColor:          textColor,
              buttonBgColor:       accentColor,
              buttonTextColor:     "#FFFFFF",
              footerLinkColor:     accentColor,
              footerTextColor:     "#6B7280",
              inputBorderColor:    "#D1D5DB",
              cardBorderColor:     "#E5E7EB",
              firstNameVisible:    true,
              lastNameVisible:     true,
              emailInputVisible:   true,
              passwordInputVisible:true,
              signInLinkVisible:   true,
            },
          },
        },
      },
      component: { const: "sign_up" },
    },
  };
};

// When a known create-account page has no sections from the builder yet,
// inject a sign_up section so the page is always functional.
const injectDefaultSectionsIfNeeded = (dslData, pageName) => {
  if (!dslData) return dslData;
  const sections = dslData?.sections || [];
  if (sections.length > 0) return dslData; // builder has content — use it as-is
  const normalized = normalizeName(pageName);
  if (!CREATE_ACCOUNT_SLUGS.has(normalized)) return dslData;
  console.log(`🔧 Injecting sign_up section for empty "${pageName}" page`);
  return {
    ...dslData,
    sections: [buildSignUpSection(dslData?.headerdefault)],
  };
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

  // 4. Fall back to layouts[0] so selectDslPage can search within a
  //    multi-page DSL (all pages stored under one layout's pages object).
  //    selectDslPage uses isPageNameMatch (alias-aware), so it will still
  //    find "My Account" when targetName is "profile".
  return layouts[0];
};

const sanitizeSections = (dslPage) => {
  if (!dslPage || !Array.isArray(dslPage.sections)) return dslPage;
  const filteredSections = dslPage.sections.filter(Boolean);
  if (filteredSections.length === dslPage.sections.length) return dslPage;
  return { ...dslPage, sections: filteredSections };
};

// Check if candidateName is an acceptable match for targetName (exact or alias)
const isPageNameMatch = (candidateName, targetName) => {
  if (!candidateName || !targetName) return false;
  if (candidateName === targetName) return true;
  // Check if candidateName appears in targetName's alias list
  const aliases = PAGE_ALIASES[targetName] || [];
  if (aliases.includes(candidateName)) return true;
  // Check reverse: targetName appears in candidateName's alias list
  const reverseAliases = PAGE_ALIASES[candidateName] || [];
  if (reverseAliases.includes(targetName)) return true;
  return false;
};

const selectDslPage = (dslData, layoutMeta, pageOverride) => {
  if (!dslData?.pages || typeof dslData.pages !== "object") {
    if (!pageOverride) return dslData;

    const currentPageName = normalizeName(
      dslData?.page?.name || dslData?.page?.handle || layoutMeta?.page_name
    );
    const targetName = normalizeName(pageOverride);

    // Accept if exact match OR alias match
    if (currentPageName && isPageNameMatch(currentPageName, targetName)) {
      return dslData;
    }

    // If layoutMeta confirms this is the right layout, trust it and return as-is
    // (findMatchingLayout already resolved the correct layout via alias)
    const layoutPageName = normalizeName(layoutMeta?.page_name);
    if (layoutPageName && isPageNameMatch(layoutPageName, targetName)) {
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
      return candidates.some((c) => isPageNameMatch(c, targetName));
    });

  if (pageOverride && !match) {
    // Last chance: if layoutMeta confirms the right layout, use first entry
    const layoutPageName = normalizeName(layoutMeta?.page_name);
    if (layoutPageName && isPageNameMatch(layoutPageName, targetName) && entries.length) {
      return sanitizeSections(entries[0][1]);
    }
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

    const storeId = getStoreConfigSync()?.id ?? null;
    const res = await client.query({
      query: LAYOUT_VERSION_QUERY,
      variables: { appId: appIdInt, ...(storeId ? { storeId } : {}) },
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
    // findMatchingLayout always returns at least layouts[0] — null only if layouts[] is empty
    if (!layout) {
      console.log(`❌ No layouts available at all for appId ${appIdInt}`);
      return null;
    }
    console.log(`🗂️ Layout selected: "${layout?.page_name}" for page "${pageName}"`);
    console.log("📋 All available pages:", layouts.map((e) => e?.page_name).join(", "));

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

    // Auto-inject sign_up section when builder left sections empty for create-account pages
    const finalDsl = injectDefaultSectionsIfNeeded(dslWithDefaults, pageName);

    const versionNumber = latestVersion?.version_number ?? null;

    // Cache global font families so every TextBlock can pick them up without
    // needing a React context (same pattern as headerDefaultService).
    setTypography(finalDsl);

    console.log(`✅ LIVE DATA FETCHED - Version ${latestVersion.version_number}`);
    console.log(`📊 Sections count: ${finalDsl?.sections?.length || 0}`);

    if (finalDsl?.sections) {
      const components = finalDsl.sections
        .filter(Boolean)
        .map((s) => {
          const c = s?.component || s?.properties?.component;
          return typeof c === "object" ? (c?.const || c?.value || JSON.stringify(c)) : c;
        });
      console.log(`🔍 Components found: ${components.join(" | ")}`);
    }

    if (finalDsl?.headerdefault) {
      const hd = finalDsl.headerdefault;
      console.log(`🎨 HeaderDefault: bg=${hd.backgroundColor||hd.bgColor} text=${hd.textColor} activeText=${hd.activeTextColor} inactiveText=${hd.inactiveTextColor} multiTab=${hd.multiTab} tabs=${JSON.stringify(hd.tabs)}`);
    }

    return { dsl: finalDsl, versionNumber };
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

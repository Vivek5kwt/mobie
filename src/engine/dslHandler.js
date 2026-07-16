import client from "../apollo/client";
import LAYOUT_VERSION_QUERY from "../graphql/queries/layoutVersionQuery";
import LAYOUT_VERSION_PAGE_QUERY from "../graphql/queries/layoutVersionPageQuery";
import AsyncStorage from "@react-native-async-storage/async-storage";
import authLayoutFallback from "../data/authLayoutFallback";
import { resolveAppId } from "../utils/appId";
import { setTypography } from "../services/typographyService";
import { setBrandKitAssetsFromDsl } from "../services/brandKitService";

const DSL_QUERY_TIMEOUT_MS = 8000;
const DSL_CACHE_TTL_MS = 30000;
const DSL_STALE_TTL_MS = 5 * 60 * 1000;
const DSL_PERSISTED_CACHE_PREFIX = "@mobidrag:lastGoodDsl:v1";
const liveDslCache = new Map();
const liveDslCacheTimes = new Map();
const liveLayoutsCache = new Map();
const liveLayoutRequests = new Map();

const PAGE_PATH_PREFIXES = new Set([
  "page",
  "pages",
  "screen",
  "screens",
  "custom-page",
  "custom-pages",
  "custompage",
  "custompages",
]);

const normalizeName = (value) => {
  if (!value) return "";
  let raw = String(value).trim().split(/[?#]/)[0].replace(/\\/g, "/");
  const parts = raw.replace(/^\/+/, "").split("/").filter(Boolean);
  const firstPart = parts[0]
    ? parts[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : "";
  if (parts.length > 1 && PAGE_PATH_PREFIXES.has(firstPart)) {
    raw = parts[parts.length - 1];
  }
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const getLiveDslCacheKey = (appId, pageName) =>
  `${appId}:${normalizeName(pageName || "home")}`;

const getLiveLayoutsCacheKey = (appId) => String(appId || "default");

const getPersistedDslCacheKey = (appId, pageName) =>
  `${DSL_PERSISTED_CACHE_PREFIX}:${getLiveDslCacheKey(appId, pageName)}`;

const isCacheableDsl = (dsl) =>
  Boolean(dsl && !dsl.__dslMissing && Array.isArray(dsl.sections));

const persistLastGoodDsl = async (appId, pageName, payload) => {
  if (!payload?.dsl || !isCacheableDsl(payload.dsl)) return;

  try {
    await AsyncStorage.setItem(
      getPersistedDslCacheKey(appId, pageName),
      JSON.stringify({
        dsl: payload.dsl,
        versionNumber: payload.versionNumber ?? null,
        cachedAt: Date.now(),
      })
    );
  } catch (error) {
    console.log("Could not persist DSL cache:", error?.message || error);
  }
};

const readLastGoodDsl = async (appId, pageName) => {
  try {
    const raw = await AsyncStorage.getItem(getPersistedDslCacheKey(appId, pageName));
    if (!raw) return null;

    const cached = JSON.parse(raw);
    if (!isCacheableDsl(cached?.dsl)) return null;

    const payload = {
      dsl: cached.dsl,
      versionNumber: cached.versionNumber ?? null,
      cachedAt: cached.cachedAt ?? null,
      fromPersistedCache: true,
    };
    const cacheKey = getLiveDslCacheKey(appId, pageName);
    liveDslCache.set(cacheKey, payload);
    liveDslCacheTimes.set(cacheKey, cached.cachedAt || Date.now());
    setTypography(cached.dsl);
    setBrandKitAssetsFromDsl(cached.dsl, appId);
    console.log(`Using persisted DSL cache for "${pageName || "home"}"`);
    return payload;
  } catch (error) {
    console.log("Could not read DSL cache:", error?.message || error);
    return null;
  }
};

const getCachedEntry = (cache, key, maxAgeMs) => {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - (entry.fetchedAt || 0);
  if (age > maxAgeMs) return null;
  return { ...entry, age };
};

const getFreshPageCache = (cacheKey) =>
  getCachedEntry(liveDslCache, cacheKey, DSL_CACHE_TTL_MS);

const getStalePageCache = (cacheKey) =>
  getCachedEntry(liveDslCache, cacheKey, DSL_STALE_TTL_MS);

const getFreshLayoutsCache = (appId) =>
  getCachedEntry(liveLayoutsCache, getLiveLayoutsCacheKey(appId), DSL_CACHE_TTL_MS);

const getStaleLayoutsCache = (appId) =>
  getCachedEntry(liveLayoutsCache, getLiveLayoutsCacheKey(appId), DSL_STALE_TTL_MS);

const unwrapGraphqlJson = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

const withTimeout = (promise, timeoutMs, label) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

// Common page name aliases — maps any incoming slug to alternatives worth trying
const PAGE_ALIASES = {
  "profile":        ["profile", "my-account", "account", "accounts", "my-profile", "user-profile", "user"],
  "account":        ["account", "my-account", "accounts", "profile", "user"],
  "accounts":       ["accounts", "my-account", "account", "profile"],
  "my-account":     ["my-account", "account", "profile", "accounts", "my-profile", "user-profile", "user"],
  "cart":           ["cart", "shopping-cart", "bag", "my-cart", "my-bag"],
  "search":         ["search", "search-results", "find", "explore"],
  "home":           ["home", "index", "main"],
  "notification":   ["notification", "notifications", "notification-inbox", "notification inbox", "alerts", "inbox"],
  "notifications":  ["notifications", "notification", "notification-inbox", "notification inbox", "alerts", "inbox"],
  "notification-inbox": ["notification-inbox", "notification", "notifications", "notification inbox", "alerts", "inbox"],
  "orders":         ["orders", "my-orders", "order-history", "order"],
  "settings":       ["settings", "setting", "my-account", "account"],
  "setting":        ["setting", "settings", "my-account", "account"],
  "signin":         ["signin", "sign-in", "login", "log-in", "auth", "sign-in-page"],
  "sign-in":        ["sign-in", "signin", "login", "log-in", "auth"],
  "login":          ["login", "signin", "sign-in", "log-in", "auth"],
  "auth":           ["auth", "signin", "sign-in", "login", "log-in"],
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
    generatedFallback: true,
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
  const exact = layouts.find((entry) =>
    layoutPageCandidates(entry).some((candidate) => candidate === targetName)
  );
  if (exact) return exact;

  // 2. Alias match
  const aliases = PAGE_ALIASES[targetName] || [];
  for (const alias of aliases) {
    const found = layouts.find((entry) =>
      layoutPageCandidates(entry).some((candidate) => candidate === alias)
    );
    if (found) return found;
  }

  // 3. Partial / contains match (e.g. "user-profile" matches "profile")
  const partial = layouts.find((entry) =>
    layoutPageCandidates(entry).some((candidate) =>
      candidate && (candidate.includes(targetName) || targetName.includes(candidate))
    )
  );
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

const sectionCount = (dslPage) =>
  Array.isArray(dslPage?.sections) ? dslPage.sections.filter(Boolean).length : 0;

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

const RESERVED_DSL_KEYS = new Set([
  "$schema",
  "type",
  "title",
  "description",
  "brandkit",
  "brand-kit",
  "brand_assets",
  "brand-assets",
  "metadata",
  "page",
  "sections",
  "headerdefault",
]);

const looksLikeDslPage = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Boolean(
    Array.isArray(value.sections) ||
      value.page ||
      value.headerdefault ||
      value.properties?.sections ||
      value.properties?.page
  );
};

const extractPagesObject = (dslData) => {
  if (!dslData || typeof dslData !== "object") return null;
  if (dslData.pages && typeof dslData.pages === "object") return dslData.pages;
  if (Array.isArray(dslData.sections)) return null;

  const pageEntries = Object.entries(dslData).filter(([key, value]) => {
    const normalizedKey = normalizeName(key);
    return !RESERVED_DSL_KEYS.has(normalizedKey) && looksLikeDslPage(value);
  });

  return pageEntries.length ? Object.fromEntries(pageEntries) : null;
};

const pageIdentityCandidates = ([key, page]) => {
  const pageInfo = page?.page || {};
  return [
    normalizeName(key),
    normalizeName(pageInfo?.name),
    normalizeName(pageInfo?.handle),
    normalizeName(pageInfo?.id),
    normalizeName(page?.name),
    normalizeName(page?.handle),
    normalizeName(page?.id),
    normalizeName(page?.layout_id),
  ].filter(Boolean);
};

const hasPageIdentity = ([key, page]) => {
  return pageIdentityCandidates([key, page]).length > 0;
};

const latestLayoutDsl = (layout) => {
  const versions = Array.isArray(layout?.layout_versions) ? layout.layout_versions : [];
  if (!versions.length) return null;
  const sorted = [...versions].sort(
    (a, b) => (b.version_number || 0) - (a.version_number || 0)
  );
  return sorted[0]?.dsl || null;
};

const layoutPageCandidates = (layout) => {
  const candidates = [
    normalizeName(layout?.page_name),
    normalizeName(layout?.handle),
    normalizeName(layout?.id),
    normalizeName(layout?.template_id),
  ].filter(Boolean);

  const dsl = latestLayoutDsl(layout);
  if (!dsl) return candidates;

  candidates.push(
    normalizeName(dsl?.page?.name),
    normalizeName(dsl?.page?.handle),
    normalizeName(dsl?.page?.id)
  );

  const pages = extractPagesObject(dsl);
  if (pages) {
    Object.entries(pages).forEach((entry) => {
      candidates.push(...pageIdentityCandidates(entry));
    });
  }

  return [...new Set(candidates.filter(Boolean))];
};

const selectDslPage = (dslData, layoutMeta, pageOverride) => {
  const pages = extractPagesObject(dslData);
  if (!pages) {
    if (!pageOverride) return dslData;

    const currentPageName = normalizeName(
      dslData?.page?.name || dslData?.page?.handle || dslData?.page?.id || layoutMeta?.page_name || layoutMeta?.handle
    );
    const targetName = normalizeName(pageOverride);

    // Accept if exact match OR alias match
    if (currentPageName && isPageNameMatch(currentPageName, targetName)) {
      return dslData;
    }

    // If layoutMeta confirms this is the right layout, trust it and return as-is
    // (findMatchingLayout already resolved the correct layout via alias)
    const layoutMatches = layoutPageCandidates(layoutMeta).some((candidate) =>
      isPageNameMatch(candidate, targetName)
    );
    if (layoutMatches) {
      return dslData;
    }

    console.log(`📄 No DSL match for "${pageOverride}". Returning empty page data.`);
    return { page: { name: pageOverride }, sections: [], __dslMissing: true };
  }

  const entries = Object.entries(pages);
  if (!entries.length) return dslData;

  const targetName = normalizeName(pageOverride || layoutMeta?.page_name);

  const exactMatch =
    targetName &&
    entries.find((entry) => pageIdentityCandidates(entry).some((candidate) => candidate === targetName));

  const aliasMatch =
    targetName &&
    entries.find((entry) => pageIdentityCandidates(entry).some((candidate) => isPageNameMatch(candidate, targetName)));

  const match = exactMatch || aliasMatch;

  if (pageOverride && !match) {
    // Last chance: if layoutMeta confirms the right layout and the DSL has
    // one unambiguous page payload, use it. With multiple named pages, picking
    // entries[0] can render a different screen inside the requested one.
    const layoutMatches = layoutPageCandidates(layoutMeta).some((candidate) =>
      isPageNameMatch(candidate, targetName)
    );
    const canUseOnlyEntry =
      entries.length === 1 ||
      (entries.length > 0 && entries.every((entry) => !hasPageIdentity(entry)));
    if (layoutMatches && canUseOnlyEntry) {
      return sanitizeSections(entries[0][1]);
    }
    console.log(`📄 No DSL match for "${pageOverride}". Returning empty page data.`);
    return { page: { name: pageOverride }, sections: [], __dslMissing: true };
  }

  const homeFallback =
    entries.find(([key, page]) => {
      return pageIdentityCandidates([key, page]).includes("home");
    }) || entries[0];

  const selected = (match && match[1]) || (homeFallback && homeFallback[1]);

  if (selected) {
    console.log("📄 Using page DSL:", selected?.page?.name || selected?.page?.handle || "Unknown");
  }

  return sanitizeSections(selected) || sanitizeSections(dslData);
};

const sortedLayoutVersions = (layout) =>
  [...(Array.isArray(layout?.layout_versions) ? layout.layout_versions : [])].sort(
    (a, b) => (b.version_number || 0) - (a.version_number || 0)
  );

const selectedPageCandidates = (dslPage = {}) => [
  normalizeName(dslPage?.page?.name),
  normalizeName(dslPage?.page?.handle),
  normalizeName(dslPage?.page?.id),
  normalizeName(dslPage?.name),
  normalizeName(dslPage?.handle),
  normalizeName(dslPage?.id),
  normalizeName(dslPage?.layout_id),
].filter(Boolean);

const scoreDslSelection = ({ dsl, layout }, targetName) => {
  if (!dsl || dsl.__dslMissing) return -1;
  const sections = sectionCount(dsl);
  if (!targetName || targetName === "home") return sections > 0 ? 20 : 5;

  const pageMatches = selectedPageCandidates(dsl).some((candidate) =>
    isPageNameMatch(candidate, targetName)
  );
  const layoutMatches = layoutPageCandidates(layout).some((candidate) =>
    isPageNameMatch(candidate, targetName)
  );

  if (!pageMatches && !layoutMatches) return -1;

  let score = 0;
  if (pageMatches) score += 100;
  if (layoutMatches) score += 50;
  if (sections > 0) score += 20;
  return score;
};

const buildDslSelection = (layout, version, pageName) => {
  const fullDsl = version?.dsl;
  if (!fullDsl) return null;

  const dslData = sanitizeSections(selectDslPage(fullDsl, layout, pageName));
  if (!dslData) return null;

  const headerDefault = dslData?.headerdefault ?? fullDsl?.headerdefault ?? null;
  const brandKit = dslData?.brandKit ?? fullDsl?.brandKit ?? null;
  const dslWithDefaults = {
    ...dslData,
    ...(headerDefault != null ? { headerdefault: headerDefault } : {}),
    ...(brandKit != null ? { brandKit } : {}),
  };

  return {
    layout,
    version,
    fullDsl,
    dsl: dslWithDefaults,
    versionNumber: version?.version_number ?? null,
  };
};

const selectBestDslFromLayouts = (layouts, pageName) => {
  const requestedPageName = pageName || "home";
  const targetName = normalizeName(requestedPageName);
  const firstMatch = findMatchingLayout(layouts, targetName);
  const orderedLayouts = [
    ...(firstMatch ? [firstMatch] : []),
    ...layouts.filter((layout) => layout !== firstMatch),
  ];

  let best = null;
  for (const layout of orderedLayouts) {
    for (const version of sortedLayoutVersions(layout)) {
      const selection = buildDslSelection(layout, version, requestedPageName);
      if (!selection) continue;
      const score = scoreDslSelection(selection, targetName);
      const sections = sectionCount(selection.dsl);
      const versionNumber = selection.versionNumber || 0;
      const bestVersion = best?.selection?.versionNumber || 0;

      if (
        !best ||
        score > best.score ||
        (score === best.score && sections > best.sections) ||
        (score === best.score && sections === best.sections && versionNumber > bestVersion)
      ) {
        best = { selection, score, sections };
      }

      if (score >= 100 && sections > 0) {
        return selection;
      }
    }
  }

  return best?.selection || null;
};

const buildLiveDslPayloadFromLayouts = (layouts, appIdInt, pageName, fetchedAt = Date.now()) => {
  if (!Array.isArray(layouts) || layouts.length === 0) {
    console.log("No layout data found");
    return null;
  }

  const selection = selectBestDslFromLayouts(layouts, pageName);
  if (!selection?.dsl) {
    console.log(`No matching DSL page found for "${pageName || "home"}"`);
    return null;
  }

  setBrandKitAssetsFromDsl(selection.fullDsl, appIdInt);
  const finalDsl = injectDefaultSectionsIfNeeded(selection.dsl, pageName);
  const versionNumber = selection.versionNumber;
  setTypography(finalDsl);

  if (!isCacheableDsl(finalDsl)) {
    console.log(`No usable DSL page found for "${pageName || "home"}"`);
    return null;
  }

  const payload = { dsl: finalDsl, versionNumber };
  const cacheKey = getLiveDslCacheKey(appIdInt, pageName);
  liveDslCache.set(cacheKey, payload);
  liveDslCacheTimes.set(cacheKey, fetchedAt);
  persistLastGoodDsl(appIdInt, pageName, payload).catch(() => {});
  return payload;
};

const buildLiveDslPayloadFromPageResult = (pageResult, appIdInt, pageName, fetchedAt = Date.now()) => {
  if (!pageResult) return null;

  const pageDsl = unwrapGraphqlJson(pageResult.page_dsl);
  if (!pageDsl) return null;

  const responseBrandKit = unwrapGraphqlJson(pageResult.brandKit) || pageResult.brandKit || null;
  const layoutMeta = {
    id: pageResult.layout_id,
    page_name: pageResult.page_name || pageName,
    layout_versions: [
      {
        id: pageResult.version_id,
        layout_id: pageResult.layout_id,
        version_number: pageResult.version_number,
        page_name: pageResult.page_name || pageName,
        dsl: pageDsl,
      },
    ],
  };

  const selectedDsl = sanitizeSections(selectDslPage(pageDsl, layoutMeta, pageName));
  if (!selectedDsl) return null;

  const dslWithDefaults = {
    ...selectedDsl,
    ...(responseBrandKit != null ? { brandKit: selectedDsl.brandKit ?? responseBrandKit } : {}),
  };
  const finalDsl = injectDefaultSectionsIfNeeded(dslWithDefaults, pageName);

  setBrandKitAssetsFromDsl({ ...pageDsl, ...(responseBrandKit != null ? { brandKit: responseBrandKit } : {}) }, appIdInt);
  setTypography(finalDsl);

  if (!isCacheableDsl(finalDsl)) {
    console.log(`No usable page DSL found for "${pageName || "home"}"`);
    return null;
  }

  const payload = {
    dsl: finalDsl,
    versionNumber: pageResult.version_number ?? null,
  };
  const cacheKey = getLiveDslCacheKey(appIdInt, pageName);
  liveDslCache.set(cacheKey, payload);
  liveDslCacheTimes.set(cacheKey, fetchedAt);
  persistLastGoodDsl(appIdInt, pageName, payload).catch(() => {});
  return payload;
};

const getLayoutVersionPageCandidates = (pageName) => {
  const original = String(pageName || "home").trim() || "home";
  const normalized = normalizeName(original) || "home";
  const aliases = PAGE_ALIASES[normalized] || [];
  return [...new Set([original, normalized, ...aliases].filter(Boolean))];
};

const fetchLayoutVersionPagePayload = async (appIdInt, pageName, options = {}) => {
  const storeId =
    options?.storeId ??
    options?.store_id ??
    options?.store?.id ??
    options?.session?.user?.storeId ??
    options?.session?.user?.store_id ??
    null;
  const storeIdNumber = Number(storeId);
  const storeIdVariable = Number.isFinite(storeIdNumber) && storeIdNumber > 0 ? storeIdNumber : null;
  const pageCandidates = getLayoutVersionPageCandidates(pageName);

  for (const candidate of pageCandidates) {
    try {
      console.log(`🔍 Querying layoutVersionPage appId=${appIdInt} page="${candidate}" storeId=${storeIdVariable || "none"}`);
      const res = await withTimeout(
        client.query({
          query: LAYOUT_VERSION_PAGE_QUERY,
          variables: {
            app_id: appIdInt,
            store_id: storeIdVariable,
            page_name: candidate,
          },
          fetchPolicy: "network-only",
        }),
        DSL_QUERY_TIMEOUT_MS,
        "DSL page query"
      );

      const pageResult = res?.data?.layoutVersionPage;
      const payload = buildLiveDslPayloadFromPageResult(pageResult, appIdInt, pageName, Date.now());
      if (payload) {
        console.log(`✅ LIVE PAGE DSL FETCHED - Page "${candidate}" Version ${payload.versionNumber}`);
        return payload;
      }
    } catch (error) {
      console.log(`layoutVersionPage failed for "${candidate}":`, error?.message || error);
    }
  }

  return null;
};

const isFresh = (fetchedAt, maxAgeMs) =>
  Boolean(fetchedAt && Date.now() - fetchedAt < maxAgeMs);

export async function fetchLiveDSL(appId, pageName, options = {}) {
  let cacheKey = "";
  let appIdInt = null;
  try {
    console.log("🔄 Fetching LIVE data from API...");
    // Hardcoded for layout fetching
    appIdInt = 148;
    options = { ...options, storeId: options?.storeId ?? 82 };
    cacheKey = getLiveDslCacheKey(appIdInt, pageName);
    const layoutsCacheKey = getLiveLayoutsCacheKey(appIdInt);
    const forceRefresh = Boolean(options?.forceRefresh);

    if (!forceRefresh) {
      const cachedPage = liveDslCache.get(cacheKey);
      if (cachedPage?.dsl && isFresh(liveDslCacheTimes.get(cacheKey), DSL_CACHE_TTL_MS)) {
        return cachedPage;
      }

      const cachedLayouts = liveLayoutsCache.get(layoutsCacheKey);
      if (cachedLayouts?.layouts && isFresh(cachedLayouts.fetchedAt, DSL_CACHE_TTL_MS)) {
        const cachedPayload = buildLiveDslPayloadFromLayouts(
          cachedLayouts.layouts,
          appIdInt,
          pageName,
          cachedLayouts.fetchedAt
        );
        if (cachedPayload) return cachedPayload;
        const persistedPayload = await readLastGoodDsl(appIdInt, pageName);
        if (persistedPayload) return persistedPayload;
      }

      if (cachedPage?.dsl && isFresh(liveDslCacheTimes.get(cacheKey), DSL_STALE_TTL_MS)) {
        if (!liveLayoutRequests.has(layoutsCacheKey)) {
          fetchLiveDSL(appId, pageName, { forceRefresh: true }).catch(() => {});
        }
        return cachedPage;
      }

      if (liveLayoutRequests.has(layoutsCacheKey)) {
        const pendingResult = await liveLayoutRequests.get(layoutsCacheKey);
        const pendingLayouts = pendingResult?.data?.layouts || pendingResult;
        const pendingFetchedAt = Date.now();
        if (Array.isArray(pendingLayouts)) {
          liveLayoutsCache.set(layoutsCacheKey, {
            layouts: pendingLayouts,
            fetchedAt: pendingFetchedAt,
          });
        }
        const pendingPayload = buildLiveDslPayloadFromLayouts(pendingLayouts, appIdInt, pageName, pendingFetchedAt);
        if (pendingPayload) return pendingPayload;
        const persistedPayload = await readLastGoodDsl(appIdInt, pageName);
        if (persistedPayload) return persistedPayload;
        return null;
      }
    }
    const pagePayload = await fetchLayoutVersionPagePayload(appIdInt, pageName, options);
    if (pagePayload) return pagePayload;

    console.log(`🔍 Querying layouts with appId: ${appIdInt} (type: ${typeof appIdInt})`);

    const layoutRequest = withTimeout(
      client.query({
        query: LAYOUT_VERSION_QUERY,
        variables: { appId: appIdInt },
        fetchPolicy: "network-only",
      }),
      DSL_QUERY_TIMEOUT_MS,
      "DSL query"
    ).finally(() => {
      liveLayoutRequests.delete(layoutsCacheKey);
    });
    liveLayoutRequests.set(layoutsCacheKey, layoutRequest);

    const res = await layoutRequest;

    // Get the layout objects
    const layouts = res?.data?.layouts;
    const fetchedAt = Date.now();
    if (!Array.isArray(layouts) || layouts.length === 0) {
      console.log("❌ No layout data found");
      return null;
    }

    console.log("📋 All available pages:", layouts.map((e) => e?.page_name).join(", "));

    const selection = selectBestDslFromLayouts(layouts, pageName);
    if (!selection?.dsl) {
      console.log(`❌ No matching DSL page found for "${pageName || "home"}"`);
      const persistedPayload = await readLastGoodDsl(appIdInt, pageName);
      if (persistedPayload) return persistedPayload;
      return null;
    }
    liveLayoutsCache.set(layoutsCacheKey, { layouts, fetchedAt });

    console.log(`🗂️ Layout selected: "${selection.layout?.page_name}" for page "${pageName || "home"}"`);
    setBrandKitAssetsFromDsl(selection.fullDsl, appIdInt);

    // Auto-inject sign_up section when builder left sections empty for create-account pages
    const finalDsl = injectDefaultSectionsIfNeeded(selection.dsl, pageName);

    const versionNumber = selection.versionNumber;

    // Cache global font families so every TextBlock can pick them up without
    // needing a React context (same pattern as headerDefaultService).
    setTypography(finalDsl);

    if (!isCacheableDsl(finalDsl)) {
      console.log(`No usable DSL page found for "${pageName || "home"}"`);
      const persistedPayload = await readLastGoodDsl(appIdInt, pageName);
      if (persistedPayload) return persistedPayload;
      return null;
    }

    console.log(`✅ LIVE DATA FETCHED - Version ${versionNumber}`);
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

    const payload = { dsl: finalDsl, versionNumber };
    liveDslCache.set(cacheKey, payload);
    liveDslCacheTimes.set(cacheKey, fetchedAt);
    persistLastGoodDsl(appIdInt, pageName, payload).catch(() => {});
    return payload;
  } catch (error) {
    console.log("❌ LIVE DATA ERROR:", error);
    const cached = cacheKey ? liveDslCache.get(cacheKey) : null;
    if (cached?.dsl) {
      console.log(`📦 Using cached DSL after live fetch failure for "${pageName || "home"}"`);
      return cached;
    }
    return null;
  }
}

/**
 * fetchDSL
 * - Uses a local auth layout fallback for the signin page.
 * - Otherwise attempts to fetch live DSL and returns it (or null on failure).
 */
export async function fetchDSL(appId, pageName, options = {}) {
  console.log("📊 fetchDSL called");
  const normalizedPageName = normalizeName(pageName);
  if (normalizedPageName === "signin-create-account") {
    console.log("📄 Using local auth layout fallback");
    return { dsl: authLayoutFallback, versionNumber: null };
  }
  const live = await fetchLiveDSL(appId, pageName, options);
  if (live?.dsl?.__dslMissing || !live) {
    console.log("❌ Live data fetch failed. No dummy fallback available.");
    const resolvedAppId = resolveAppId(appId);
    const appIdInt = Number.isInteger(resolvedAppId)
      ? resolvedAppId
      : Math.floor(Number(resolvedAppId));
    const persistedPayload = await readLastGoodDsl(appIdInt, pageName);
    if (persistedPayload) return persistedPayload;
  }
  return live;
}

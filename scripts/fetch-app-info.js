#!/usr/bin/env node

/**
 * Script to fetch app name and icon from GraphQL API
 * Used in GitHub Actions to dynamically set app name and icon for builds
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID;
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://app.mobidrag.com/graphql';

if (!APP_ID) {
  console.error('❌ APP_ID environment variable is required');
  process.exit(1);
}

const appIdInt = parseInt(APP_ID, 10);
if (isNaN(appIdInt)) {
  console.error(`❌ Invalid APP_ID: ${APP_ID}`);
  process.exit(1);
}

const query = `
  query GetAppInfo($appId: Int) {
    layouts(app_id: $appId) {
      app_id
      metadata
      layout_versions {
        metadata
        dsl
        version_number
      }
    }
  }
`;

const graphqlRequest = {
  query,
  variables: { appId: appIdInt },
};

const postData = JSON.stringify(graphqlRequest);

const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
  },
};

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const unwrapDeep = (value) => {
  if (value === undefined || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => unwrapDeep(item));
  if (!isObject(value)) return value;
  if (value.value !== undefined) return unwrapDeep(value.value);
  if (value.const !== undefined) return unwrapDeep(value.const);
  if (value.properties !== undefined) return unwrapDeep(value.properties);
  return Object.entries(value).reduce((acc, [key, next]) => {
    acc[key] = unwrapDeep(next);
    return acc;
  }, {});
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const cleanString = (value) => {
  const resolved = unwrapDeep(value);
  if (resolved === undefined || resolved === null) return '';
  return String(resolved).trim();
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const resolved = cleanString(value);
    if (resolved) return resolved;
  }
  return '';
};

const collectBrandCandidates = (node, candidates = [], depth = 0, seen = new Set()) => {
  if (!isObject(node) && !Array.isArray(node)) return candidates;
  if (seen.has(node) || depth > 10) return candidates;
  seen.add(node);

  if (isObject(node)) {
    if (node.brandKit?.brand_assets) candidates.push(node.brandKit.brand_assets);
    if (node.brandKit?.brandAssets) candidates.push(node.brandKit.brandAssets);
    if (node.brand_assets) candidates.push(node.brand_assets);
    if (node.brandAssets) candidates.push(node.brandAssets);
    if (node._brandKitAssets) candidates.push(node._brandKitAssets);
    if (node.logoUrl || node.faviconUrl || node.splashImageUrl) candidates.push(node);
  }

  const values = Array.isArray(node) ? node : Object.values(node);
  values.forEach((value) => collectBrandCandidates(value, candidates, depth + 1, seen));
  return candidates;
};

const extractBrandAssets = (dsl) => {
  const root = unwrapDeep(parseMaybeJson(dsl));
  if (!isObject(root)) return {};

  return collectBrandCandidates(root).reduce((assets, candidate) => {
    const source = unwrapDeep(candidate) || {};
    if (!assets.logoUrl) assets.logoUrl = firstNonEmpty(source.logoUrl, source.logo, source.appLogo, source.appIcon);
    if (!assets.faviconUrl) assets.faviconUrl = firstNonEmpty(source.faviconUrl, source.favicon, source.iconUrl);
    if (!assets.splashImageUrl) assets.splashImageUrl = firstNonEmpty(source.splashImageUrl, source.splashImage, source.splashUrl);
    return assets;
  }, {});
};

// Add authorization header if provided
if (process.env.GRAPHQL_TOKEN) {
  options.headers['Authorization'] = `Bearer ${process.env.GRAPHQL_TOKEN}`;
}

console.log(`🔍 Fetching app info for APP_ID: ${appIdInt}`);
console.log(`📡 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}`);

const req = https.request(GRAPHQL_ENDPOINT, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (response.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(response.errors, null, 2));
        process.exit(1);
      }

      const layouts = response?.data?.layouts;
      if (!Array.isArray(layouts) || layouts.length === 0) {
        console.error('❌ No layouts found for appId:', appIdInt);
        process.exit(1);
      }

      // Try to extract app name and icon from metadata or DSL
      let appName = null;
      let appIcon = null;

      // Check metadata in layouts
      for (const layout of layouts) {
        if (layout.metadata) {
          try {
            const metadata = typeof layout.metadata === 'string' 
              ? JSON.parse(layout.metadata) 
              : layout.metadata;
            
            if (metadata.appName || metadata.name) {
              appName = metadata.appName || metadata.name;
            }
            if (metadata.appIcon || metadata.icon) {
              appIcon = metadata.appIcon || metadata.icon;
            }
          } catch (e) {
            // Metadata might not be JSON
          }
        }

        // Check layout versions metadata and DSL
        if (layout.layout_versions && Array.isArray(layout.layout_versions)) {
          const sortedVersions = [...layout.layout_versions].sort(
            (a, b) => (b?.version_number || 0) - (a?.version_number || 0)
          );
          for (const version of sortedVersions) {
            if (version.metadata) {
              try {
                const metadata = typeof version.metadata === 'string'
                  ? JSON.parse(version.metadata)
                  : version.metadata;
                
                if (!appName && (metadata.appName || metadata.name)) {
                  appName = metadata.appName || metadata.name;
                }
                if (!appIcon && (metadata.appIcon || metadata.icon)) {
                  appIcon = metadata.appIcon || metadata.icon;
                }
              } catch (e) {
                // Metadata might not be JSON
              }
            }

            // Check DSL for app name/icon and brand kit assets
            if (version.dsl && (!appName || !appIcon)) {
              try {
                const dsl = parseMaybeJson(version.dsl);
                const brandAssets = extractBrandAssets(dsl);
                if (!appName && (dsl.appName || dsl.name)) {
                  appName = dsl.appName || dsl.name;
                }
                if (!appIcon) {
                  appIcon = brandAssets.logoUrl ||
                    brandAssets.faviconUrl ||
                    dsl.appIcon ||
                    dsl.icon ||
                    null;
                }
              } catch (e) {
                // DSL might not be JSON or might not have app info
              }
            }
          }
        }
      }

      // Fallback to default if not found
      appName = appName || `App-${appIdInt}`;
      appIcon = appIcon || null;

      console.log(`✅ App Name: ${appName}`);
      if (appIcon) {
        console.log(`✅ App Icon: ${appIcon}`);
      } else {
        console.log(`⚠️  App Icon: Not found, using default`);
      }

      // Output to GitHub Actions environment
      if (process.env.GITHUB_ENV) {
        fs.appendFileSync(process.env.GITHUB_ENV, `APP_NAME=${appName}\n`);
        if (appIcon) {
          fs.appendFileSync(process.env.GITHUB_ENV, `APP_ICON=${appIcon}\n`);
        }
      }

      // Output to GitHub Actions output
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `app_name=${appName}\n`);
        if (appIcon) {
          fs.appendFileSync(process.env.GITHUB_OUTPUT, `app_icon=${appIcon}\n`);
        }
      }

      // Also output as JSON for easy parsing
      const output = {
        appName,
        appIcon,
        appId: appIdInt,
      };
      
      console.log(`\n📦 App Info JSON:`);
      console.log(JSON.stringify(output, null, 2));
      
      // Write to file for use in workflow
      fs.writeFileSync(
        path.join(__dirname, '..', 'app-info.json'),
        JSON.stringify(output, null, 2)
      );

      console.log(`\n✅ App info saved to app-info.json`);

    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
  process.exit(1);
});

req.write(postData);
req.end();

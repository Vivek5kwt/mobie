#!/usr/bin/env node

/**
 * Script to fetch app name and icon from GraphQL API
 * Used in GitHub Actions to dynamically set app name and icon for builds
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.APP_ID || process.env.REACT_APP_APP_ID;
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://api.mobidrag.com/graphql';

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
          for (const version of layout.layout_versions) {
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

            // Check DSL for app name/icon in sections
            if (version.dsl && !appName) {
              try {
                const dsl = typeof version.dsl === 'string' ? JSON.parse(version.dsl) : version.dsl;
                if (dsl.appName || dsl.name) {
                  appName = dsl.appName || dsl.name;
                }
                if (dsl.appIcon || dsl.icon) {
                  appIcon = dsl.appIcon || dsl.icon;
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

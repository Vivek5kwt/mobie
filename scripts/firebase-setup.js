#!/usr/bin/env node
/**
 * firebase-setup.js
 *
 * Creates a Firebase Android app for the current APP_ID + PACKAGE_NAME,
 * downloads google-services.json, and injects it into android/app/.
 *
 * Requires:
 *   - firebase-tools installed (npm i -g firebase-tools)
 *   - FIREBASE_TOKEN  OR  GOOGLE_APPLICATION_CREDENTIALS set
 *   - FIREBASE_PROJECT_ID  (default: mobidrag-d2f5e)
 *   - APP_ID, APP_NAME, PACKAGE_NAME  (set by the GitHub Actions workflow)
 *   - GRAPHQL_ENDPOINT + GRAPHQL_TOKEN  (to persist the mapping)
 *
 * Outputs (to $GITHUB_ENV when running in Actions):
 *   FIREBASE_APP_ID   — the new Firebase mobilesdk_app_id
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const https        = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────
const APP_ID          = process.env.APP_ID || '';
const APP_NAME        = process.env.APP_NAME || `App-${APP_ID}`;
const PACKAGE_NAME    = process.env.PACKAGE_NAME || `com.mobidrag.app${APP_ID}`;
const FIREBASE_PROJECT= process.env.FIREBASE_PROJECT_ID || 'mobidrag-d2f5e';
const GRAPHQL_ENDPOINT= process.env.GRAPHQL_ENDPOINT || 'https://mobidrag.ampleteck.com/graphql';
const GRAPHQL_TOKEN   = process.env.GRAPHQL_TOKEN || '';

const GOOGLE_SERVICES_DEST = path.join(__dirname, '..', 'android', 'app', 'google-services.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg)  { console.log(msg); }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function err(msg)  { console.error(`❌ ${msg}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
  } catch (e) {
    throw new Error(e.stderr || e.stdout || e.message);
  }
}

function setGithubEnv(key, value) {
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
  }
  process.env[key] = value;
  log(`📤 Exported ${key}=${value}`);
}

function setGithubOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

// ─── Firebase CLI wrapper ─────────────────────────────────────────────────────

function firebaseCmd(args) {
  const token = process.env.FIREBASE_TOKEN ? `--token "${process.env.FIREBASE_TOKEN}"` : '';
  return run(`firebase ${args} --project "${FIREBASE_PROJECT}" ${token} --json`);
}

/**
 * Returns the existing Firebase Android app for this package, or null.
 */
function findExistingApp(packageName) {
  log(`🔍 Checking for existing Firebase app: ${packageName}`);
  try {
    const raw  = firebaseCmd('apps:list android');
    const data = JSON.parse(raw);
    const apps = data?.result || [];
    return apps.find((a) => a.packageName === packageName) || null;
  } catch (e) {
    warn(`Could not list apps: ${e.message}`);
    return null;
  }
}

/**
 * Creates a new Firebase Android app and returns the Firebase App ID.
 */
function createFirebaseApp(appName, packageName) {
  log(`🔥 Creating Firebase Android app…`);
  log(`   Display name : ${appName}`);
  log(`   Package name : ${packageName}`);

  const raw  = firebaseCmd(`apps:create android "${appName}" --package-name "${packageName}"`);
  const data = JSON.parse(raw);

  if (data.status !== 'success') {
    throw new Error(`Firebase app creation failed: ${JSON.stringify(data)}`);
  }

  const firebaseAppId = data?.result?.appId;
  if (!firebaseAppId) {
    throw new Error(`No appId returned by Firebase CLI: ${raw}`);
  }
  log(`✅ Firebase App created: ${firebaseAppId}`);
  return firebaseAppId;
}

/**
 * Downloads google-services.json for the given Firebase App ID.
 * Returns the parsed JSON object.
 */
function downloadGoogleServices(firebaseAppId) {
  log(`📥 Downloading google-services.json for: ${firebaseAppId}`);
  const raw  = firebaseCmd(`apps:sdkconfig android "${firebaseAppId}"`);
  const data = JSON.parse(raw);

  if (data.status !== 'success') {
    throw new Error(`SDK config download failed: ${JSON.stringify(data)}`);
  }

  // The config JSON is a string inside data.result.fileContents
  const configStr = data?.result?.fileContents;
  if (!configStr) {
    throw new Error(`No fileContents in sdkconfig response: ${raw}`);
  }
  return JSON.parse(configStr);
}

/**
 * Injects the downloaded config into android/app/google-services.json.
 */
function injectGoogleServices(config) {
  fs.writeFileSync(GOOGLE_SERVICES_DEST, JSON.stringify(config, null, 2));
  log(`✅ Injected google-services.json → ${GOOGLE_SERVICES_DEST}`);

  // Log the package name from the config for verification
  const pkgInConfig = config?.client?.[0]?.client_info?.android_client_info?.package_name;
  log(`   Package in config: ${pkgInConfig}`);
}

// ─── Backend mapping persistence ─────────────────────────────────────────────

function saveMapping({ appId, firebaseAppId, firebaseProjectId, packageName }) {
  return new Promise((resolve) => {
    const mutation = `
      mutation SaveFirebaseMapping(
        $appId: Int!
        $firebaseAppId: String!
        $firebaseProjectId: String!
        $packageName: String!
      ) {
        saveFirebaseMapping(
          app_id: $appId
          firebase_app_id: $firebaseAppId
          firebase_project_id: $firebaseProjectId
          package_name: $packageName
        ) {
          success
          message
        }
      }
    `;

    const body = JSON.stringify({
      query: mutation,
      variables: {
        appId:           parseInt(appId, 10),
        firebaseAppId,
        firebaseProjectId,
        packageName,
      },
    });

    const url     = new URL(GRAPHQL_ENDPOINT);
    const options = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(GRAPHQL_TOKEN ? { Authorization: `Bearer ${GRAPHQL_TOKEN}` } : {}),
      },
    };

    const lib = url.protocol === 'https:' ? https : require('http');
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            warn(`GraphQL errors saving mapping: ${JSON.stringify(json.errors)}`);
          } else {
            log(`✅ Firebase mapping saved to backend`);
          }
        } catch (_) {
          warn('Could not parse mapping save response');
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      warn(`Could not save Firebase mapping to backend: ${e.message}`);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!APP_ID) {
    err('APP_ID is required');
    process.exit(1);
  }

  log('');
  log('══════════════════════════════════════════');
  log(' Firebase App Setup');
  log(`  APP_ID       : ${APP_ID}`);
  log(`  APP_NAME     : ${APP_NAME}`);
  log(`  PACKAGE_NAME : ${PACKAGE_NAME}`);
  log(`  PROJECT      : ${FIREBASE_PROJECT}`);
  log('══════════════════════════════════════════');

  // 1. Check if this package already has a Firebase app
  let firebaseAppId = null;
  const existing = findExistingApp(PACKAGE_NAME);

  if (existing) {
    firebaseAppId = existing.appId;
    log(`♻️  Reusing existing Firebase app: ${firebaseAppId}`);
  } else {
    // 2. Create a new Firebase app
    firebaseAppId = createFirebaseApp(APP_NAME, PACKAGE_NAME);
  }

  // 3. Download google-services.json
  const config = downloadGoogleServices(firebaseAppId);

  // 4. Inject into android/app/
  injectGoogleServices(config);

  // 5. Export to GitHub Actions env
  setGithubEnv('FIREBASE_APP_ID', firebaseAppId);
  setGithubEnv('FIREBASE_PROJECT_ID', FIREBASE_PROJECT);
  setGithubOutput('firebase_app_id', firebaseAppId);

  // 6. Save mapping to backend (non-blocking, failure is a warning not an error)
  await saveMapping({
    appId:           APP_ID,
    firebaseAppId,
    firebaseProjectId: FIREBASE_PROJECT,
    packageName:     PACKAGE_NAME,
  });

  log('');
  log('✅ Firebase setup complete');
  log(`   Firebase App ID : ${firebaseAppId}`);
  log(`   Config written  : ${GOOGLE_SERVICES_DEST}`);
}

main().catch((e) => {
  err(`Firebase setup failed: ${e.message}`);
  err('Continuing build with existing google-services.json as fallback');
  // Non-zero exit would fail the build – warn only
  process.exit(0);
});

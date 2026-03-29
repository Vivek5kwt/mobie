#!/usr/bin/env node
/**
 * firebase-setup.js
 *
 * Strategy: ONE Firebase account → SEPARATE project per generated app
 *
 *   Firebase Account (Single)
 *   │
 *   ├── Project: mbdrag-1001   ← App ID 1001
 *   ├── Project: mbdrag-1002   ← App ID 1002
 *   └── Project: mbdrag-XXXX   ← App ID XXXX
 *
 * Steps per build:
 *   1. Create Firebase project  "mbdrag-{appId}"  (skip if already exists)
 *   2. Register Android app     with PACKAGE_NAME (skip if already exists)
 *   3. Download google-services.json
 *   4. Inject → android/app/google-services.json
 *   5. Save mapping to backend API
 *
 * Auth (one of):
 *   - GOOGLE_APPLICATION_CREDENTIALS  pointing to a service-account JSON file
 *   - FIREBASE_TOKEN                  from `firebase login:ci`
 *
 * Env vars required:
 *   APP_ID, APP_NAME, PACKAGE_NAME
 *
 * Env vars written to $GITHUB_ENV:
 *   FIREBASE_PROJECT_ID, FIREBASE_APP_ID, FCM_TOPIC, FIREBASE_SETUP_STATUS
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');
const https        = require('https');

// ─── Config ──────────────────────────────────────────────────────────────────

const APP_ID       = (process.env.APP_ID || '').trim();
const APP_NAME     = (process.env.APP_NAME || `App-${APP_ID}`).trim();
const PACKAGE_NAME = (process.env.PACKAGE_NAME || `com.mobidrag.app${APP_ID}`).trim();

// Firebase project ID format:  mbdrag-{appId}
// Short prefix to stay within Firebase's 30-char project ID limit
const FIREBASE_PROJECT_ID  = `mbdrag-${APP_ID}`;
const FIREBASE_DISPLAY_NAME = `Builder App ${APP_ID}`;

const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT || 'https://mobidrag.ampleteck.com/graphql';
const GRAPHQL_TOKEN    = process.env.GRAPHQL_TOKEN || '';

const GOOGLE_SERVICES_DEST = path.join(__dirname, '..', 'android', 'app', 'google-services.json');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const log  = (m) => console.log(m);
const warn = (m) => console.warn(`⚠️  ${m}`);

function setGithubEnv(key, value) {
  if (process.env.GITHUB_ENV) {
    fs.appendFileSync(process.env.GITHUB_ENV, `${key}=${value}\n`);
  }
  process.env[key] = value;
}

function setGithubOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

/**
 * Run a Firebase CLI command with --json output.
 * Returns the parsed result object, or throws on error.
 */
function firebase(args) {
  const token = process.env.FIREBASE_TOKEN
    ? `--token "${process.env.FIREBASE_TOKEN}"`
    : '';
  const cmd = `firebase ${args} ${token} --json`.trim();
  log(`  $ ${cmd.replace(process.env.FIREBASE_TOKEN || '__NONE__', '***')}`);
  try {
    const raw = execSync(cmd, {
      encoding: 'utf8',
      stdio:    ['pipe', 'pipe', 'pipe'],
      timeout:  120_000,
    }).trim();
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    // execSync throws on non-zero exit; try to parse stderr as JSON
    const output = e.stdout || e.stderr || e.message || '';
    try {
      return JSON.parse(output);
    } catch (_) {
      throw new Error(output || e.message);
    }
  }
}

// ─── Step 1: Create Firebase project ─────────────────────────────────────────

function createProject() {
  log(`\n📁 Step 1 — Create Firebase project: ${FIREBASE_PROJECT_ID}`);

  // First check if the project already exists
  try {
    const list   = firebase('projects:list');
    const exists = (list?.result || []).some(
      (p) => p.projectId === FIREBASE_PROJECT_ID
    );
    if (exists) {
      log(`  ♻️  Project already exists: ${FIREBASE_PROJECT_ID}`);
      return { alreadyExisted: true };
    }
  } catch (e) {
    warn(`Could not list projects: ${e.message} — will try to create anyway`);
  }

  // Create the project
  try {
    const result = firebase(
      `projects:create "${FIREBASE_PROJECT_ID}" --display-name "${FIREBASE_DISPLAY_NAME}"`
    );
    if (result?.status === 'success') {
      log(`  ✅ Project created: ${FIREBASE_PROJECT_ID}`);
      return { alreadyExisted: false };
    }
    throw new Error(JSON.stringify(result));
  } catch (e) {
    // "already exists" is not an error for us
    const msg = String(e.message || '').toLowerCase();
    if (msg.includes('already exists') || msg.includes('already in use')) {
      log(`  ♻️  Project already exists (caught from error): ${FIREBASE_PROJECT_ID}`);
      return { alreadyExisted: true };
    }
    throw e;
  }
}

// ─── Step 2: Register Android app in the project ─────────────────────────────

function registerAndroidApp() {
  log(`\n📱 Step 2 — Register Android app: ${PACKAGE_NAME}`);

  // Check if this package is already registered
  try {
    const list = firebase(`apps:list android --project "${FIREBASE_PROJECT_ID}"`);
    const apps = list?.result || [];
    const existing = apps.find((a) => a.packageName === PACKAGE_NAME);
    if (existing) {
      log(`  ♻️  Android app already registered: ${existing.appId}`);
      return existing.appId;
    }
  } catch (e) {
    warn(`Could not list apps: ${e.message} — will try to create anyway`);
  }

  // Register a new Android app
  const result = firebase(
    `apps:create android "${APP_NAME}" --package-name "${PACKAGE_NAME}" --project "${FIREBASE_PROJECT_ID}"`
  );
  if (result?.status !== 'success') {
    throw new Error(`apps:create failed: ${JSON.stringify(result)}`);
  }
  const firebaseAppId = result?.result?.appId;
  if (!firebaseAppId) {
    throw new Error(`No appId in response: ${JSON.stringify(result)}`);
  }
  log(`  ✅ Android app registered: ${firebaseAppId}`);
  return firebaseAppId;
}

// ─── Step 3: Download google-services.json ───────────────────────────────────

function downloadConfig(firebaseAppId) {
  log(`\n📥 Step 3 — Download google-services.json`);

  const result = firebase(
    `apps:sdkconfig android "${firebaseAppId}" --project "${FIREBASE_PROJECT_ID}"`
  );
  if (result?.status !== 'success') {
    throw new Error(`sdkconfig failed: ${JSON.stringify(result)}`);
  }

  const fileContents = result?.result?.fileContents;
  if (!fileContents) {
    throw new Error(`No fileContents in sdkconfig response`);
  }

  const config = JSON.parse(fileContents);
  log(`  ✅ Config downloaded`);
  return config;
}

// ─── Step 4: Inject google-services.json ─────────────────────────────────────

function injectConfig(config) {
  log(`\n💉 Step 4 — Inject google-services.json`);
  fs.writeFileSync(GOOGLE_SERVICES_DEST, JSON.stringify(config, null, 2));

  const pkg = config?.client?.[0]?.client_info?.android_client_info?.package_name;
  const pid = config?.project_info?.project_id;
  log(`  ✅ Written to: ${GOOGLE_SERVICES_DEST}`);
  log(`  📦 Package in config : ${pkg}`);
  log(`  🔥 Project in config : ${pid}`);
}

// ─── Step 5: Save mapping to backend ─────────────────────────────────────────

function saveMapping({ firebaseAppId, fcmTopic }) {
  return new Promise((resolve) => {
    const mutation = `
      mutation SaveFirebaseMapping(
        $appId: Int!
        $firebaseAppId: String!
        $firebaseProjectId: String!
        $packageName: String!
        $fcmTopic: String!
      ) {
        saveFirebaseMapping(
          app_id: $appId
          firebase_app_id: $firebaseAppId
          firebase_project_id: $firebaseProjectId
          package_name: $packageName
          fcm_topic: $fcmTopic
        ) {
          success
          message
        }
      }
    `;

    const body = JSON.stringify({
      query: mutation,
      variables: {
        appId:             parseInt(APP_ID, 10),
        firebaseAppId,
        firebaseProjectId: FIREBASE_PROJECT_ID,
        packageName:       PACKAGE_NAME,
        fcmTopic,
      },
    });

    let url;
    try { url = new URL(GRAPHQL_ENDPOINT); } catch (_) { return resolve(); }

    const lib     = url.protocol === 'https:' ? https : require('http');
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

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json?.errors) warn(`Backend save errors: ${JSON.stringify(json.errors)}`);
          else log(`  ✅ Mapping saved to backend`);
        } catch (_) { warn('Could not parse backend response'); }
        resolve();
      });
    });
    req.on('error', (e) => { warn(`Backend save failed: ${e.message}`); resolve(); });
    req.write(body);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!APP_ID) {
    console.error('❌ APP_ID is required');
    process.exit(1);
  }

  log('');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║           Firebase Per-App Project Setup                 ║');
  log('╠══════════════════════════════════════════════════════════╣');
  log(`║  APP_ID           : ${APP_ID}`);
  log(`║  APP_NAME         : ${APP_NAME}`);
  log(`║  PACKAGE_NAME     : ${PACKAGE_NAME}`);
  log(`║  Firebase Project : ${FIREBASE_PROJECT_ID}`);
  log('╚══════════════════════════════════════════════════════════╝');

  // Step 1
  await createProject();

  // Step 2
  const firebaseAppId = await registerAndroidApp();

  // Step 3
  const config = downloadConfig(firebaseAppId);

  // Step 4
  injectConfig(config);

  // FCM topic (isolated per project — no shared topics needed since projects are separate)
  const fcmTopic = `app-${APP_ID}-notifications`;

  // Step 5
  await saveMapping({ firebaseAppId, fcmTopic });

  // Export to GitHub Actions
  setGithubEnv('FIREBASE_PROJECT_ID', FIREBASE_PROJECT_ID);
  setGithubEnv('FIREBASE_APP_ID',     firebaseAppId);
  setGithubEnv('FCM_TOPIC',           fcmTopic);
  setGithubEnv('FIREBASE_SETUP_STATUS', 'success');
  setGithubOutput('firebase_project_id', FIREBASE_PROJECT_ID);
  setGithubOutput('firebase_app_id',     firebaseAppId);

  log('');
  log('╔══════════════════════════════════════════════════════════╗');
  log('║  ✅  Firebase Setup Complete                             ║');
  log('╠══════════════════════════════════════════════════════════╣');
  log(`║  Project   : ${FIREBASE_PROJECT_ID}`);
  log(`║  App ID    : ${firebaseAppId}`);
  log(`║  FCM Topic : ${fcmTopic}`);
  log(`║  Config    : android/app/google-services.json`);
  log('╚══════════════════════════════════════════════════════════╝');
}

main().catch((e) => {
  console.error(`\n❌ Firebase setup error: ${e.message}`);
  setGithubEnv('FIREBASE_SETUP_STATUS', 'failed');
  setGithubEnv('FIREBASE_SKIP_REASON',  e.message.replace(/\n/g, ' ').slice(0, 200));
  // Exit 0 so the build continues with the fallback google-services.json
  process.exit(0);
});

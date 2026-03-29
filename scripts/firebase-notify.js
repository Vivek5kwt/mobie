#!/usr/bin/env node
/**
 * firebase-notify.js
 *
 * Creates a unique FCM topic for this app so push notifications
 * are isolated per generated app.
 *
 * Topic format:  app-{appId}-notifications
 *
 * This script does NOT send a notification — it just verifies the
 * FCM topic name is reserved in the firebase-mapping.json file so
 * the backend knows which topic to target when pushing notifications.
 *
 * For actual server-side notification sending, use:
 *   POST https://fcm.googleapis.com/fcm/send
 *   { "to": "/topics/app-105-notifications", ... }
 *
 * Requires env:
 *   APP_ID, FIREBASE_APP_ID, FIREBASE_PROJECT_ID
 */

const fs   = require('fs');
const path = require('path');

const APP_ID             = process.env.APP_ID || '';
const FIREBASE_APP_ID    = process.env.FIREBASE_APP_ID || '';
const FIREBASE_PROJECT   = process.env.FIREBASE_PROJECT_ID || 'mobidrag-d2f5e';
const PACKAGE_NAME       = process.env.PACKAGE_NAME || `com.mobidrag.app${APP_ID}`;

if (!APP_ID) {
  // Not a fatal error — skip silently
  console.log('⚠️  APP_ID not set, skipping FCM topic registration');
  process.exit(0);
}

const topicName   = `app-${APP_ID}-notifications`;
const mappingFile = path.join(__dirname, '..', 'firebase-mapping.json');

// Load or init the mapping file
let mapping = {};
if (fs.existsSync(mappingFile)) {
  try {
    mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  } catch (_) {
    mapping = {};
  }
}

// Upsert this app's entry
mapping[APP_ID] = {
  appId:             APP_ID,
  packageName:       PACKAGE_NAME,
  firebaseAppId:     FIREBASE_APP_ID,
  firebaseProjectId: FIREBASE_PROJECT,
  fcmTopic:          topicName,
  createdAt:         mapping[APP_ID]?.createdAt || new Date().toISOString(),
  updatedAt:         new Date().toISOString(),
};

fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));

console.log(`✅ FCM topic reserved: ${topicName}`);
console.log(`📄 Mapping saved to firebase-mapping.json`);
console.log(JSON.stringify(mapping[APP_ID], null, 2));

// Export to GitHub Actions
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `FCM_TOPIC=${topicName}\n`);
}
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `fcm_topic=${topicName}\n`);
}

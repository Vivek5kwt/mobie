// src/utils/tokenLogger.js
import { createFcmToken, updateFcmToken } from '../services/fcmTokenService';
import { resolveAppId } from './appId';

const STORAGE_FCM_TOKEN_KEY     = '@device_fcm_token';
const STORAGE_FCM_RECORD_ID_KEY = '@fcm_record_id';   // id returned by createFcmToken

class TokenLogger {
  constructor() {
    this.token    = null;   // FCM token string
    this.recordId = null;   // backend record id (from createFcmToken response)
    this.AsyncStorage = null;
    this.initialized  = false;
  }

  // ── AsyncStorage bootstrap ─────────────────────────────────────────────────

  async _init() {
    if (this.initialized) return;
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      this.AsyncStorage = AsyncStorage;
    } catch (e) {
      console.log('⚠️ AsyncStorage not available:', e.message);
    }
    this.initialized = true;
  }

  // ── Storage helpers ────────────────────────────────────────────────────────

  async _save(key, value) {
    try {
      if (this.AsyncStorage && value != null) {
        await this.AsyncStorage.setItem(key, String(value));
      }
    } catch (_) {}
  }

  async _load(key) {
    try {
      if (this.AsyncStorage) return await this.AsyncStorage.getItem(key);
    } catch (_) {}
    return null;
  }

  async _remove(key) {
    try {
      if (this.AsyncStorage) await this.AsyncStorage.removeItem(key);
    } catch (_) {}
  }

  // ── Firebase helper ────────────────────────────────────────────────────────

  async _getFirebaseToken() {
    try {
      const messaging = require('@react-native-firebase/messaging').default;
      return await messaging().getToken();
    } catch (_) {
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * STEP 1 — called from App.tsx on every launch (after permission granted).
   *
   * • Gets the FCM token from Firebase.
   * • If the token is the same as last time AND we already have a backend record
   *   id, registration is skipped (idempotent — avoids duplicate rows).
   * • Otherwise calls createFcmToken immediately — userid is null at this point.
   *   The record id from the response is saved to AsyncStorage so Step 2 can
   *   update the same row instead of creating a second one.
   *
   * @param {number|null} appid  — pass resolveAppId() from App.tsx
   * @returns {Promise<object|null>}
   */
  async captureToken(appid = null) {
    await this._init();

    // ── 1. Get Firebase token ──────────────────────────────────────────────
    const firebaseToken = await this._getFirebaseToken();
    if (!firebaseToken) {
      console.log('⚠️ FCM token unavailable — Firebase not ready yet');
      return null;
    }

    // ── 2. Load previously stored token + record id ────────────────────────
    const savedToken    = await this._load(STORAGE_FCM_TOKEN_KEY);
    const savedRecordId = await this._load(STORAGE_FCM_RECORD_ID_KEY);

    this.token = firebaseToken;
    await this._save(STORAGE_FCM_TOKEN_KEY, firebaseToken);

    // ── 3. Skip backend call if already registered with the same token ─────
    if (firebaseToken === savedToken && savedRecordId) {
      this.recordId = savedRecordId;
      console.log(`✅ FCM token already registered (record id: ${savedRecordId}) — skipping re-registration`);
      return { id: savedRecordId, token: firebaseToken };
    }

    // ── 4. Register on backend — userid unknown at launch time ────────────
    const resolvedAppId = resolveAppId(appid);
    console.log(`📡 createFcmToken → token: ...${firebaseToken.slice(-8)}, userid: null, appid: ${resolvedAppId}`);

    try {
      const result = await createFcmToken({
        token:  firebaseToken,
        userid: null,         // will be filled in by updateTokenForUser after login
        appid:  resolvedAppId,
      });

      if (result?.id) {
        this.recordId = String(result.id);
        await this._save(STORAGE_FCM_RECORD_ID_KEY, this.recordId);
        console.log(`✅ FCM token registered on backend — id: ${result.id}, appid: ${resolvedAppId}`);
        console.log(`   Response: ${JSON.stringify(result)}`);
      } else {
        console.log('⚠️ createFcmToken: response contained no id');
      }

      return result ?? null;
    } catch (err) {
      console.log('❌ captureToken: backend registration failed:', err?.message);
      return null;
    }
  }

  /**
   * STEP 2 — called from AuthContext after login / signup / session restore.
   *
   * Patches the existing FCM record with the logged-in userid using
   * updateFcmToken. If no record exists yet (e.g. Firebase was unavailable
   * at launch) it falls back to createFcmToken.
   *
   * @param {number|string} userid
   * @param {number|string} appid
   */
  async updateTokenForUser(userid, appid) {
    await this._init();

    // ── Ensure we have a token ─────────────────────────────────────────────
    if (!this.token) this.token = await this._load(STORAGE_FCM_TOKEN_KEY);
    if (!this.token) {
      this.token = await this._getFirebaseToken();
      if (this.token) await this._save(STORAGE_FCM_TOKEN_KEY, this.token);
    }
    if (!this.token) {
      console.log('⚠️ updateTokenForUser: no FCM token available — skipping');
      return null;
    }

    // ── Ensure we have the record id ───────────────────────────────────────
    if (!this.recordId) this.recordId = await this._load(STORAGE_FCM_RECORD_ID_KEY);

    const resolvedAppId  = resolveAppId(appid);
    const resolvedUserId = userid ? Number(userid) : null;

    if (this.recordId) {
      // ── Update existing record with userid ───────────────────────────────
      console.log(`📡 updateFcmToken → id: ${this.recordId}, userid: ${resolvedUserId}, appid: ${resolvedAppId}`);
      try {
        const result = await updateFcmToken({
          id:     this.recordId,
          token:  this.token,
          userid: resolvedUserId,
          appid:  resolvedAppId,
        });
        if (result?.id) {
          console.log(`✅ FCM record updated with userid (id: ${result.id})`);
        }
        return result ?? null;
      } catch (err) {
        console.log('❌ updateTokenForUser (update) failed:', err?.message);
        return null;
      }
    } else {
      // ── No record yet — create one with userid (fallback) ─────────────────
      console.log(`📡 createFcmToken (with user) → userid: ${resolvedUserId}, appid: ${resolvedAppId}`);
      try {
        const result = await createFcmToken({
          token:  this.token,
          userid: resolvedUserId,
          appid:  resolvedAppId,
        });
        if (result?.id) {
          this.recordId = String(result.id);
          await this._save(STORAGE_FCM_RECORD_ID_KEY, this.recordId);
          console.log(`✅ FCM token registered with userid (id: ${result.id})`);
        }
        return result ?? null;
      } catch (err) {
        console.log('❌ updateTokenForUser (create fallback) failed:', err?.message);
        return null;
      }
    }
  }

  /**
   * Called when Firebase rotates the FCM token (onTokenRefresh).
   *
   * The old record id is discarded and a fresh createFcmToken call is made
   * so the new token is always registered, even mid-session.
   *
   * @param {string}      newToken
   * @param {number|null} userid   — pass current user id if logged in
   * @param {number|null} appid
   */
  async refreshToken(newToken, userid = null, appid = null) {
    await this._init();
    if (!newToken) return null;

    // Discard old record — new token means a new backend row
    this.token    = newToken;
    this.recordId = null;
    await this._save(STORAGE_FCM_TOKEN_KEY, newToken);
    await this._remove(STORAGE_FCM_RECORD_ID_KEY);
    console.log('🔄 FCM token rotated — registering new token on backend');

    const resolvedAppId  = resolveAppId(appid);
    const resolvedUserId = userid ? Number(userid) : null;

    try {
      const result = await createFcmToken({
        token:  newToken,
        userid: resolvedUserId,
        appid:  resolvedAppId,
      });

      if (result?.id) {
        this.recordId = String(result.id);
        await this._save(STORAGE_FCM_RECORD_ID_KEY, this.recordId);
        console.log(`✅ Rotated FCM token registered (id: ${result.id})`);
      }
      return result ?? null;
    } catch (err) {
      console.log('❌ refreshToken: backend registration failed:', err?.message);
      return null;
    }
  }

  /**
   * Clear all stored FCM data on logout.
   * The record id is preserved so the same device record can be reused
   * on next login — only the in-memory userid association is lost.
   */
  async clearToken() {
    await this._init();
    this.token    = null;
    this.recordId = null;
    await this._remove(STORAGE_FCM_TOKEN_KEY);
    await this._remove(STORAGE_FCM_RECORD_ID_KEY);
    console.log('🗑️ FCM token and record cleared');
  }
}

const tokenLogger = new TokenLogger();
export default tokenLogger;

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
      const token = await messaging().getToken();
      if (token) {
        console.log(`[FCM] Firebase token obtained (last 12): ...${token.slice(-12)}`);
      } else {
        console.warn('[FCM] messaging().getToken() returned null/empty');
      }
      return token;
    } catch (e) {
      console.error('[FCM] ✖ Failed to get Firebase token:', e?.message || String(e));
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * STEP 1 — called from App.tsx on every launch (after permission granted).
   *
   * Gets the FCM token from Firebase and stores it locally.
   * Does NOT call the backend — the backend requires a non-null userid
   * (Prisma NOT NULL constraint), so registration is deferred until
   * updateTokenForUser is called after login.
   *
   * @param {number|null} appid  — pass resolveAppId() from App.tsx (kept for API compat)
   * @returns {Promise<string|null>}  the raw FCM token string, or null if unavailable
   */
  async captureToken(appid = null) {
    await this._init();

    // ── 1. Get Firebase token ──────────────────────────────────────────────
    const firebaseToken = await this._getFirebaseToken();
    if (!firebaseToken) {
      console.log('⚠️ FCM token unavailable — Firebase not ready yet');
      return null;
    }

    // ── 2. Store token locally for use after login ─────────────────────────
    this.token = firebaseToken;
    await this._save(STORAGE_FCM_TOKEN_KEY, firebaseToken);
    console.log(`✅ FCM token captured locally (last 12): ...${firebaseToken.slice(-12)}`);
    console.log('ℹ️ Backend registration deferred — will register after login with userid');

    return firebaseToken;
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

    const resolvedUserIdCheck = userid ? Number(userid) : null;
    if (!resolvedUserIdCheck) {
      console.log('⚠️ updateTokenForUser: userid is required — skipping (backend requires non-null userid)');
      return null;
    }

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
    const resolvedUserId = resolvedUserIdCheck;   // already validated non-null above

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
   * Stores the new token locally. If a userid is already known (user is
   * logged in), immediately re-registers on the backend. Otherwise defers
   * registration until the next updateTokenForUser call after login.
   *
   * @param {string}      newToken
   * @param {number|null} userid   — pass current user id if logged in, or null
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

    const resolvedUserId = userid ? Number(userid) : null;

    // If user is not logged in, just store the token for later registration
    if (!resolvedUserId) {
      console.log('🔄 FCM token rotated — stored locally, will register after login');
      return null;
    }

    console.log('🔄 FCM token rotated — re-registering on backend');
    const resolvedAppId = resolveAppId(appid);

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

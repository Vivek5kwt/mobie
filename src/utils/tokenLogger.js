// src/utils/tokenLogger.js
import { createFcmToken } from '../services/fcmTokenService';
import { resolveAppId } from './appId';

const STORAGE_FCM_TOKEN_KEY = '@device_fcm_token';

class TokenLogger {
  constructor() {
    this.token = null;
    this.AsyncStorage = null;
    this.initialized = false;
  }

  // ── Init ───────────────────────────────────────────────────────────────────

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
    } catch (e) {}
  }

  async _load(key) {
    try {
      if (this.AsyncStorage) return await this.AsyncStorage.getItem(key);
    } catch (e) {}
    return null;
  }

  // ── Get Firebase token ─────────────────────────────────────────────────────

  async _getFirebaseToken() {
    try {
      const messaging = require('@react-native-firebase/messaging').default;
      return await messaging().getToken();
    } catch (e) {
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Step 1 — called from App.tsx on launch.
   * Just fetches the FCM token from Firebase and saves it locally.
   * Does NOT call the backend (userid is unknown at this point).
   */
  async captureToken() {
    await this._init();
    const firebaseToken = await this._getFirebaseToken();
    if (firebaseToken) {
      this.token = firebaseToken;
      await this._save(STORAGE_FCM_TOKEN_KEY, firebaseToken);
      console.log('✅ FCM token captured and saved locally');
    } else {
      console.log('⚠️ Firebase token not available — will retry after login');
    }
    return firebaseToken;
  }

  /**
   * Step 2 — called from AuthContext after login / signup / session restore.
   * Reads the cached token and calls createFcmToken with all 3 required fields.
   *
   * @param {number|string} userid  - logged-in user id
   * @param {number|string} appid   - user's app id
   */
  async syncFcmToken(userid, appid) {
    await this._init();

    // Get token — prefer in-memory, fall back to AsyncStorage
    if (!this.token) {
      this.token = await this._load(STORAGE_FCM_TOKEN_KEY);
    }

    // If still no token, try Firebase directly
    if (!this.token) {
      this.token = await this._getFirebaseToken();
      if (this.token) {
        await this._save(STORAGE_FCM_TOKEN_KEY, this.token);
      }
    }

    if (!this.token) {
      console.log('⚠️ syncFcmToken: no FCM token available — skipping');
      return;
    }

    const resolvedAppId = resolveAppId(appid);
    const resolvedUserId = userid ? Number(userid) : null;

    console.log(`📡 createFcmToken → token: ...${this.token.slice(-8)}, userid: ${resolvedUserId}, appid: ${resolvedAppId}`);

    try {
      const result = await createFcmToken({
        token: this.token,
        userid: resolvedUserId,
        appid: resolvedAppId,
      });

      if (result?.id) {
        console.log('✅ FCM token registered on backend, id:', result.id);
      } else {
        console.log('⚠️ createFcmToken: no id in response');
      }
    } catch (error) {
      console.log('❌ syncFcmToken failed:', error.message);
    }
  }

  /**
   * Called when Firebase rotates the token.
   * Saves the new token locally. Pass userid+appid if available to re-sync.
   */
  async refreshToken(newToken, userid = null, appid = null) {
    await this._init();
    if (!newToken) return;
    this.token = newToken;
    await this._save(STORAGE_FCM_TOKEN_KEY, newToken);
    console.log('🔄 FCM token refreshed and saved');

    if (userid) {
      await this.syncFcmToken(userid, appid);
    }
  }

  /**
   * Clear token on logout.
   */
  async clearToken() {
    await this._init();
    this.token = null;
    try {
      if (this.AsyncStorage) {
        await this.AsyncStorage.removeItem(STORAGE_FCM_TOKEN_KEY);
      }
    } catch (e) {}
    console.log('🗑️ FCM token cleared');
  }
}

const tokenLogger = new TokenLogger();
export default tokenLogger;

// src/utils/tokenLogger.js
import { createFcmToken, updateFcmToken } from '../services/fcmTokenService';
import { resolveAppId } from './appId';

const STORAGE_FCM_TOKEN_KEY = '@device_fcm_token';
const STORAGE_FCM_RECORD_ID_KEY = '@device_fcm_record_id';
const USER_PROFILE_KEY = '@auth_user_profile';

class TokenLogger {
  constructor() {
    this.token = null;
    this.recordId = null;   // ID returned by createFcmToken mutation
    this.logged = false;
    this.AsyncStorage = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      this.AsyncStorage = AsyncStorage;
    } catch (error) {
      console.log('⚠️ AsyncStorage not available:', error.message);
    }
    this.initialized = true;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Called on app launch / FCM token refresh.
   * Creates the token on the backend (anonymous) and stores the record ID.
   */
  async setToken(token, forceSync = false) {
    await this.initialize();
    if (!token) return;

    const isNew = token !== this.token;
    this.token = token;
    await this._saveToStorage(STORAGE_FCM_TOKEN_KEY, token);

    if (isNew || forceSync) {
      await this._syncCreate();
      this.logged = true;
    }
  }

  /**
   * Call this AFTER a successful login / signup.
   * Updates the existing FCM record with the real userid + appid.
   */
  async updateTokenForUser(userid, appid) {
    await this.initialize();

    // Make sure we have a token
    if (!this.token) {
      this.token = await this._loadFromStorage(STORAGE_FCM_TOKEN_KEY);
    }
    if (!this.token) {
      console.log('⚠️ updateTokenForUser: no FCM token available — skipping');
      return;
    }

    // Make sure we have a record ID from a previous createFcmToken call
    if (!this.recordId) {
      this.recordId = await this._loadFromStorage(STORAGE_FCM_RECORD_ID_KEY);
    }

    const numericAppId = resolveAppId(appid);

    try {
      if (this.recordId) {
        // Update existing record
        console.log(`📡 updateFcmToken — id: ${this.recordId}, userid: ${userid}, appid: ${numericAppId}`);
        const result = await updateFcmToken({
          id: this.recordId,
          token: this.token,
          userid: userid ? Number(userid) : null,
          appid: numericAppId,
        });
        if (result?.id) {
          console.log('✅ FCM token updated for user:', result.id);
        }
      } else {
        // No prior record — create a new one with userid included
        console.log(`📡 createFcmToken (with user) — userid: ${userid}, appid: ${numericAppId}`);
        const result = await createFcmToken({
          token: this.token,
          userid: userid ? Number(userid) : null,
          appid: numericAppId,
        });
        if (result?.id) {
          this.recordId = result.id;
          await this._saveToStorage(STORAGE_FCM_RECORD_ID_KEY, String(result.id));
          console.log('✅ FCM token created with user:', result.id);
        }
      }
    } catch (error) {
      console.log('❌ updateTokenForUser failed:', error.message);
    }
  }

  /**
   * Try to get FCM token from Firebase, then fall back to AsyncStorage.
   */
  async getTokenFromAnySource() {
    await this.initialize();

    // 1. Try real FCM token from Firebase
    const fcmToken = await this._getFCMToken();
    if (fcmToken) {
      console.log('✅ Got FCM token from Firebase');
      await this.setToken(fcmToken);
      return fcmToken;
    }

    // 2. Fall back to previously stored token
    const storedToken = await this._loadFromStorage(STORAGE_FCM_TOKEN_KEY);
    if (storedToken && !storedToken.startsWith('dummy_token_')) {
      console.log('✅ Using stored FCM token');
      this.token = storedToken;
      // Restore record ID too
      if (!this.recordId) {
        this.recordId = await this._loadFromStorage(STORAGE_FCM_RECORD_ID_KEY);
      }
      // Re-sync in case backend lost the record (e.g. first install)
      if (!this.recordId) {
        await this._syncCreate();
      }
      return storedToken;
    }

    console.log('⚠️ No FCM token available — Firebase may not be configured');
    return null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  async _syncCreate() {
    if (!this.token) return;

    try {
      // Read user profile for appid — userid is null at launch (anonymous)
      const profile = await this._getStoredUserProfile();
      const appid = resolveAppId(profile?.appId ?? profile?.app_id);
      const userid = profile?.id ? Number(profile.id) : null;

      console.log(`📡 createFcmToken — appid: ${appid}, userid: ${userid ?? 'anonymous'}`);
      const result = await createFcmToken({
        token: this.token,
        userid,
        appid,
      });

      if (result?.id) {
        this.recordId = result.id;
        await this._saveToStorage(STORAGE_FCM_RECORD_ID_KEY, String(result.id));
        console.log('✅ FCM token registered on backend, record id:', result.id);
      } else {
        console.log('⚠️ createFcmToken returned no data');
      }
    } catch (error) {
      console.log('❌ createFcmToken failed:', error.message);
    }
  }

  async _getFCMToken() {
    try {
      const messaging = require('@react-native-firebase/messaging').default;
      return await messaging().getToken();
    } catch (error) {
      console.log('⚠️ FCM not configured:', error.message);
      return null;
    }
  }

  async _getStoredUserProfile() {
    try {
      const raw = await this._loadFromStorage(USER_PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async _saveToStorage(key, value) {
    try {
      if (this.AsyncStorage && value != null) {
        await this.AsyncStorage.setItem(key, String(value));
      }
    } catch (error) {
      console.log(`⚠️ Could not save ${key}:`, error.message);
    }
  }

  async _loadFromStorage(key) {
    try {
      if (this.AsyncStorage) {
        return await this.AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.log(`⚠️ Could not load ${key}:`, error.message);
    }
    return null;
  }

  async clearToken() {
    await this.initialize();
    if (this.AsyncStorage) {
      await this.AsyncStorage.multiRemove([STORAGE_FCM_TOKEN_KEY, STORAGE_FCM_RECORD_ID_KEY]);
    }
    this.token = null;
    this.recordId = null;
    this.logged = false;
    console.log('🗑️ FCM token cleared');
  }
}

const tokenLogger = new TokenLogger();
export default tokenLogger;

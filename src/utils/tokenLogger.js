// src/utils/tokenLogger.js

/**
 * Device Token Logger Utility
 * Prints device token for backend team debugging
 */

import { createFcmToken } from '../services/fcmTokenService';
import { resolveAppId } from './appId';

const USER_PROFILE_KEY = '@auth_user_profile';

class TokenLogger {
  constructor() {
    this.token = null;
    this.logged = false;
    this.AsyncStorage = null;
    this.messaging = null;
    this.initialized = false;
  }

  /**
   * Initialize dependencies
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Dynamically import AsyncStorage
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      this.AsyncStorage = AsyncStorage;
      console.log('✅ AsyncStorage initialized');
    } catch (error) {
      console.log('⚠️ AsyncStorage not available:', error.message);
    }

    this.initialized = true;
  }

  /**
   * Set and log device token
   * @param {string} token - Device token
   * @param {boolean} forceLog - Force log even if already logged
   */
  async setToken(token, forceLog = false) {
    await this.initialize();

    if (!token) {
      console.warn('⚠️ TokenLogger: No token provided');
      return;
    }

    this.token = token;

    if (!this.logged || forceLog) {
      await this.logToken();
      this.logged = true;
    }
  }

  /**
   * Log token in readable format for backend team
   */
  async logToken() {
    await this.initialize();

    if (!this.token) {
      console.log('❌ No device token available');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('📱 DEVICE TOKEN FOR BACKEND TEAM');
    console.log('='.repeat(80));
    console.log(`Token: ${this.token}`);
    console.log(`Length: ${this.token.length} characters`);
    console.log(`Type: ${typeof this.token}`);
    console.log('='.repeat(80));
    console.log('📋 Copy this token for backend testing:');
    console.log('='.repeat(80));
    console.log(this.token);
    console.log('='.repeat(80) + '\n');

    // Also save to AsyncStorage for persistence
    await this.saveTokenToStorage();

    await this.syncTokenToBackend();
  }

  /**
   * Save token to AsyncStorage (optional)
   */
  async saveTokenToStorage() {
    try {
      if (this.AsyncStorage) {
        await this.AsyncStorage.setItem('@device_token', this.token);
        console.log('💾 Token saved to AsyncStorage');
      } else {
        console.log('⚠️ AsyncStorage not available for saving');
      }
    } catch (error) {
      console.log('⚠️ Could not save token to storage:', error.message);
    }
  }

  /**
   * Get stored token from AsyncStorage
   */
  async getStoredToken() {
    await this.initialize();

    try {
      if (this.AsyncStorage) {
        const token = await this.AsyncStorage.getItem('@device_token');
        return token;
      } else {
        console.log('⚠️ AsyncStorage not available');
        return null;
      }
    } catch (error) {
      console.log('⚠️ Could not get token from storage:', error.message);
      return null;
    }
  }

  async getStoredUserProfile() {
    await this.initialize();

    try {
      if (!this.AsyncStorage) {
        return null;
      }

      const rawProfile = await this.AsyncStorage.getItem(USER_PROFILE_KEY);
      if (!rawProfile) {
        return null;
      }

      return JSON.parse(rawProfile);
    } catch (error) {
      console.log('⚠️ Could not parse user profile:', error.message);
      return null;
    }
  }

  /**
   * Try to get FCM token
   */
  async getFCMToken() {
    try {
      // Dynamically import FCM (IMPORTANT FIX)
      const messaging = require('@react-native-firebase/messaging').default;

      const fcmToken = await messaging().getToken();
      return fcmToken;
    } catch (error) {
      console.log('⚠️ FCM not configured:', error.message);
      console.log('💡 Install: yarn add @react-native-firebase/app @react-native-firebase/messaging');
      return null;
    }
  }

  async syncTokenToBackend() {
    await this.initialize();

    if (!this.token) {
      console.log('⚠️ No device token available to sync');
      return;
    }

    try {
      const profile = await this.getStoredUserProfile();
      // userid is optional — send null for anonymous users, backend accepts nullable Int
      const userid = profile?.id ? Number(profile.id) : null;
      const profileAppId = profile?.appId ?? profile?.app_id;
      const appid = resolveAppId(profileAppId);

      console.log(`📡 Sending FCM token to backend — appid: ${appid}, userid: ${userid ?? 'anonymous'}`);
      const result = await createFcmToken({
        token: this.token,
        userid,   // null is fine — mutation declares Int (nullable)
        appid,
      });

      if (result?.id) {
        console.log('✅ FCM token synced to backend:', result.id);
      } else {
        console.log('⚠️ createFcmToken returned no data');
      }
    } catch (error) {
      console.log('❌ createFcmToken failed:', error.message);
    }
  }

  /**
   * Get token from any available source
   */
  async getTokenFromAnySource() {
    await this.initialize();

    // 1. Try real FCM token first
    const fcmToken = await this.getFCMToken();
    if (fcmToken) {
      console.log('✅ Got FCM token from Firebase');
      await this.setToken(fcmToken);
      return fcmToken;
    }

    // 2. Fall back to previously stored token (device offline / Firebase slow)
    const storedToken = await this.getStoredToken();
    if (storedToken && !storedToken.startsWith('dummy_token_')) {
      console.log('✅ Using stored FCM token');
      this.token = storedToken;
      await this.syncTokenToBackend();
      return storedToken;
    }

    console.log('⚠️ No real FCM token available — Firebase may not be configured');
    return null;
  }

  /**
   * Generate dummy token for testing
   */
  generateDummyToken() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `dummy_token_${timestamp}_${random}_for_testing`;
  }

  /**
   * Format token for API request
   */
  getTokenForAPI() {
    const { Platform } = require('react-native');
    return {
      device_token: this.token || 'no_token_available',
      platform: Platform.OS,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear token
   */
  async clearToken() {
    await this.initialize();

    if (this.AsyncStorage) {
      await this.AsyncStorage.removeItem('@device_token');
    }

    this.token = null;
    this.logged = false;
    console.log('🗑️ Token cleared');
  }
}

// Create singleton instance
const tokenLogger = new TokenLogger();

export default tokenLogger;

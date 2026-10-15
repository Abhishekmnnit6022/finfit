/**
 * Remote Configuration Service (Developer-Controlled)
 * 
 * Scalable API key management without rebuilding the APK.
 * 
 * How it works:
 * 1. The app automatically fetches the latest configuration from REMOTE_CONFIG_URL in the background.
 * 2. You (the developer) host a single config.json file (e.g. GitHub raw URL, secret GitHub Gist, or server).
 * 3. Whenever an API key expires, gets banned, or needs rotation, you simply edit your online config.json.
 * 4. All 1,000+ installed APKs automatically fetch and apply the new keys silently without any APK rebuild or user action.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOTE_CONFIG_CACHE_KEY = 'REMOTE_CONFIG_CACHE_V2';
const REMOTE_CONFIG_TIMESTAMP_KEY = 'REMOTE_CONFIG_TIMESTAMP_V2';
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes fresh cache

// =========================================================================
// DEVELOPER CONFIGURATION ENDPOINT:
// Live GitHub Gist (updates automatically whenever you edit the Gist online)
// =========================================================================
export const REMOTE_CONFIG_URL = 'https://gist.githubusercontent.com/Abhishekmnnit6022/3279fac073b3719d96915451e1f106d4/raw/config.json';

// Safe default configuration template (populated dynamically via REMOTE_CONFIG_URL)
export const DEFAULT_CONFIG = {
  OPENAI_API_KEY: '',
  OPENAI_MODEL: 'gpt-4o-mini',
  GROK_API_KEY: '',
  GROK_MODEL: 'grok-2-mini',
  OCR_API_KEY: '',
  EXCHANGE_RATE_API_KEY: '',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-1.5-flash',
  APP_VERSION: '1.0.0',
  MAINTENANCE_MODE: false,
  MAINTENANCE_MESSAGE: 'App is under maintenance. Please try again later.',
};

class RemoteConfigService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.isLoaded = false;
    this.loadPromise = null;
  }

  /**
   * Initializes the config service.
   * Loads cached keys immediately for zero startup delay, then checks for remote updates.
   */
  async initialize() {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this._loadConfig();
    await this.loadPromise;
    return this.config;
  }

  async _loadConfig() {
    try {
      // 1. Instantly load cached config
      const cached = await this._loadFromCache();
      if (cached) {
        this.config = { ...DEFAULT_CONFIG, ...cached };
        this.isLoaded = true;
      }

      // 2. Refresh from remote if cache is stale or if essential keys are missing
      const isFresh = await this._isCacheFresh();
      const needsImmediateFetch = !isFresh || !this.config.GROK_API_KEY;
      if (needsImmediateFetch) {
        const remote = await this._fetchRemoteConfig();
        if (remote && typeof remote === 'object') {
          this.config = { ...DEFAULT_CONFIG, ...remote };
          await this._saveToCache(this.config);
          this.isLoaded = true;
        }
      }
    } catch (error) {
      console.warn('RemoteConfig: Error loading config, using active keys:', error?.message);
    }
  }

  /**
   * Returns a config value by key.
   */
  get(key) {
    const val = this.config[key] ?? DEFAULT_CONFIG[key] ?? '';
    if (key === 'GEMINI_MODEL' && (!val || val === 'gemini-3.8-flash')) {
      return 'gemini-1.5-flash';
    }
    return val;
  }

  /**
   * Returns all active config values.
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Force refreshes the config from the developer endpoint.
   */
  async refresh() {
    try {
      const remote = await this._fetchRemoteConfig();
      if (remote && typeof remote === 'object') {
        this.config = { ...DEFAULT_CONFIG, ...remote };
        await this._saveToCache(this.config);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ---- Internal helper methods ----

  async _fetchRemoteConfig() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout

      const response = await fetch(REMOTE_CONFIG_URL, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data;
    } catch {
      // Graceful offline fallback
      return null;
    }
  }

  async _loadFromCache() {
    try {
      const cached = await AsyncStorage.getItem(REMOTE_CONFIG_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  async _saveToCache(config) {
    try {
      await AsyncStorage.setItem(REMOTE_CONFIG_CACHE_KEY, JSON.stringify(config));
      await AsyncStorage.setItem(REMOTE_CONFIG_TIMESTAMP_KEY, Date.now().toString());
    } catch {
      // Ignore cache write failure
    }
  }

  async _isCacheFresh() {
    try {
      const timestamp = await AsyncStorage.getItem(REMOTE_CONFIG_TIMESTAMP_KEY);
      if (!timestamp) return false;
      return (Date.now() - parseInt(timestamp)) < CACHE_DURATION;
    } catch {
      return false;
    }
  }
}

const remoteConfig = new RemoteConfigService();
export default remoteConfig;

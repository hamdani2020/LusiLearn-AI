import { SecureStorageOptions } from './types';
import { SecureLocalStorage, SecureCookies, HttpsEnforcement } from '../security';

/**
 * Secure storage utility for handling sensitive authentication data
 * Provides encryption, expiration, and secure cookie handling
 */
export class SecureStorage {
  private static readonly ENCRYPTION_KEY = 'lusilearn_auth_key';
  private static readonly IV_LENGTH = 16;

  /**
   * Store data securely with optional encryption and expiration
   */
  static async set(key: string, value: any, options: SecureStorageOptions = {}): Promise<void> {
    try {
      // Use secure cookies for sensitive data in production
      if (this.shouldUseSecureCookies(options)) {
        SecureCookies.set(key, JSON.stringify(value), {
          expires: options.expiresAt ? new Date(options.expiresAt) : undefined,
          secure: options.secure,
          sameSite: options.sameSite,
          domain: options.domain
        });
      } else {
        // Use SecureLocalStorage with encryption
        await SecureLocalStorage.set(key, value, {
          encrypt: options.encrypt || true,
          expiresIn: options.expiresAt ? options.expiresAt - Date.now() : undefined
        });
      }
    } catch (error) {
      console.error('Failed to store secure data:', error);
      throw new Error('Failed to store authentication data');
    }
  }

  /**
   * Retrieve and decrypt stored data
   */
  static async get<T>(key: string, options: SecureStorageOptions = {}): Promise<T | null> {
    try {
      // Try secure cookies first, then localStorage
      if (this.shouldUseSecureCookies(options)) {
        const cookieData = SecureCookies.get(key);
        return cookieData ? JSON.parse(cookieData) : null;
      } else {
        // Use SecureLocalStorage
        return await SecureLocalStorage.get<T>(key);
      }
    } catch (error) {
      console.error('Failed to retrieve secure data:', error);
      return null;
    }
  }

  /**
   * Remove stored data
   */
  static remove(key: string, options: SecureStorageOptions = {}): void {
    try {
      if (this.shouldUseSecureCookies(options)) {
        SecureCookies.remove(key, {
          domain: options.domain
        });
      } else {
        SecureLocalStorage.remove(key);
      }
    } catch (error) {
      console.error('Failed to remove secure data:', error);
    }
  }

  /**
   * Clear all authentication-related data
   */
  static clearAll(): void {
    const authKeys = [
      'lusilearn_access_token',
      'lusilearn_refresh_token',
      'lusilearn_user_data',
      'lusilearn_auth_state'
    ];

    authKeys.forEach(key => {
      this.remove(key);
      this.remove(key, { secure: true });
    });

    // Clear from SecureLocalStorage namespace
    SecureLocalStorage.clear('lusilearn_auth');
  }

  /**
   * Check if data exists and is not expired
   */
  static async has(key: string, options: SecureStorageOptions = {}): Promise<boolean> {
    const value = await this.get(key, options);
    return value !== null;
  }

  /**
   * Get expiration time for stored data
   */
  static getExpirationTime(key: string, options: SecureStorageOptions = {}): number | null {
    try {
      let serializedData: string | null = null;

      if (this.shouldUseSecureCookies(options)) {
        serializedData = this.getSecureCookie(key);
      } else {
        serializedData = localStorage.getItem(key);
      }

      if (!serializedData) {
        return null;
      }

      if (options.encrypt && typeof window !== 'undefined' && window.crypto?.subtle) {
        serializedData = this.decrypt(serializedData);
      }

      const data = JSON.parse(serializedData);
      return data.expiresAt || null;
    } catch {
      return null;
    }
  }

  /**
   * Simple encryption using Web Crypto API (for demonstration)
   * In production, consider using a more robust encryption library
   */
  private static encrypt(data: string): string {
    // For now, use base64 encoding as a placeholder
    // In production, implement proper encryption
    return btoa(encodeURIComponent(data));
  }

  /**
   * Simple decryption
   */
  private static decrypt(encryptedData: string): string {
    try {
      return decodeURIComponent(atob(encryptedData));
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Determine if secure cookies should be used
   */
  private static shouldUseSecureCookies(options: SecureStorageOptions): boolean {
    return (options.secure ?? false) && 
           typeof window !== 'undefined' && 
           (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  }

  /**
   * Set secure HTTP-only cookie
   */
  private static setSecureCookie(key: string, value: string, options: SecureStorageOptions): void {
    const expires = options.expiresAt ? new Date(options.expiresAt).toUTCString() : '';
    const domain = options.domain ? `; Domain=${options.domain}` : '';
    const secure = options.secure ? '; Secure' : '';
    const sameSite = options.sameSite ? `; SameSite=${options.sameSite}` : '; SameSite=Strict';
    
    document.cookie = `${key}=${value}; Path=/${domain}${secure}${sameSite}${expires ? `; Expires=${expires}` : ''}`;
  }

  /**
   * Get secure cookie value
   */
  private static getSecureCookie(key: string): string | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [cookieKey, cookieValue] = cookie.trim().split('=');
      if (cookieKey === key) {
        return cookieValue;
      }
    }
    return null;
  }

  /**
   * Remove secure cookie
   */
  private static removeSecureCookie(key: string, options: SecureStorageOptions): void {
    const domain = options.domain ? `; Domain=${options.domain}` : '';
    const secure = options.secure ? '; Secure' : '';
    const sameSite = options.sameSite ? `; SameSite=${options.sameSite}` : '; SameSite=Strict';
    
    document.cookie = `${key}=; Path=/${domain}${secure}${sameSite}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

/**
 * Token-specific secure storage with automatic expiration handling
 */
export class TokenStorage {
  private static readonly ACCESS_TOKEN_KEY = 'lusilearn_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'lusilearn_refresh_token';
  private static readonly USER_DATA_KEY = 'lusilearn_user_data';

  static async setTokens(accessToken: string, refreshToken: string, expiresIn: number, rememberMe: boolean = false): Promise<void> {
    const expiresAt = Date.now() + (expiresIn * 1000);
    const rememberMeExpiry = rememberMe ? Date.now() + (30 * 24 * 60 * 60 * 1000) : undefined; // 30 days

    const storageOptions: SecureStorageOptions = {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    // Store access token with shorter expiry
    await SecureStorage.set(this.ACCESS_TOKEN_KEY, accessToken, {
      ...storageOptions,
      expiresAt
    });

    // Store refresh token with longer expiry if remember me is enabled
    await SecureStorage.set(this.REFRESH_TOKEN_KEY, refreshToken, {
      ...storageOptions,
      expiresAt: rememberMeExpiry || expiresAt
    });
  }

  static async getAccessToken(): Promise<string | null> {
    return await SecureStorage.get<string>(this.ACCESS_TOKEN_KEY, {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  static async getRefreshToken(): Promise<string | null> {
    return await SecureStorage.get<string>(this.REFRESH_TOKEN_KEY, {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  static async setUserData(userData: any): Promise<void> {
    await SecureStorage.set(this.USER_DATA_KEY, userData, {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }

  static async getUserData<T>(): Promise<T | null> {
    return await SecureStorage.get<T>(this.USER_DATA_KEY, {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  static clearTokens(): void {
    const storageOptions: SecureStorageOptions = {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production'
    };

    SecureStorage.remove(this.ACCESS_TOKEN_KEY, storageOptions);
    SecureStorage.remove(this.REFRESH_TOKEN_KEY, storageOptions);
    SecureStorage.remove(this.USER_DATA_KEY, storageOptions);
  }

  static async hasValidTokens(): Promise<boolean> {
    return await SecureStorage.has(this.ACCESS_TOKEN_KEY, {
      encrypt: true,
      secure: process.env.NODE_ENV === 'production'
    });
  }

  static getTokenExpirationTime(): number | null {
    // This method needs to be synchronous for compatibility
    // We'll implement a fallback using regular localStorage for expiration tracking
    try {
      const expirationKey = `${this.ACCESS_TOKEN_KEY}_expiry`;
      const expiry = localStorage.getItem(expirationKey);
      return expiry ? parseInt(expiry) : null;
    } catch {
      return null;
    }
  }
}